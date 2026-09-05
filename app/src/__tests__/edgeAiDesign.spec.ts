/**
 * edge-functions/api/ai-design.js 护栏桩测试：
 * 请求体上限、按 IP 日限次（fail closed）、兜底只调用一次、错误不透传上游正文。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { onRequest } from '../../../edge-functions/api/ai-design.js'

interface Env {
  DEEPSEEK_API_KEY?: string
  AI_API_KEY?: string
  ALERT_WEBHOOK?: string
  SEATMARK_ALLOW_MEMORY_STORAGE?: string
}

const ALLOW: Env = { SEATMARK_ALLOW_MEMORY_STORAGE: '1' }

let ipSeq = 0
function nextIp() {
  ipSeq += 1
  return `10.0.${Math.floor(ipSeq / 256)}.${ipSeq % 256}`
}

function post(body: string | object, ip: string, extraHeaders: Record<string, string> = {}) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body)
  return new Request('https://www.seatmark.cn/api/ai-design', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'EO-Connecting-IP': ip, ...extraHeaders },
    body: raw,
  })
}

const validBody = { messages: [{ role: 'user', content: 'hi' }] }
const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  const calls: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    calls.push(url)
    return handler(url)
  }) as unknown as typeof fetch
  return calls
}

describe('ai-design 请求体护栏', () => {
  it('GET 返回 405，且响应头带 X-SeatMark-Rev', async () => {
    const res: Response = await onRequest({
      request: new Request('https://www.seatmark.cn/api/ai-design', { method: 'GET' }),
      env: ALLOW,
    })
    expect(res.status).toBe(405)
    expect(res.headers.get('X-SeatMark-Rev')).toMatch(/^r\d+$/)
  })

  it('空 / 非法 JSON 请求体返回 400', async () => {
    const fetchMock = mockFetch(() => new Response('{}'))
    const empty: Response = await onRequest({ request: post('', nextIp()), env: ALLOW })
    expect(empty.status).toBe(400)
    const bad: Response = await onRequest({ request: post('{not json', nextIp()), env: ALLOW })
    expect(bad.status).toBe(400)
    expect(fetchMock).toHaveLength(0)
  })

  it('Content-Length 超过 64KB 直接 400（不读正文、不调上游）', async () => {
    const calls = mockFetch(() => new Response('{}'))
    const res: Response = await onRequest({
      request: post(validBody, nextIp(), { 'Content-Length': String(64 * 1024 + 1) }),
      env: ALLOW,
    })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toContain('64KB')
    expect(calls).toHaveLength(0)
  })

  it('实际正文超过 64KB（每条消息不超 20000 字符）也返回 400', async () => {
    const calls = mockFetch(() => new Response('{}'))
    const chunk = 'x'.repeat(19000)
    const body = { messages: Array.from({ length: 4 }, () => ({ role: 'user', content: chunk })) }
    expect(JSON.stringify(body).length).toBeGreaterThan(64 * 1024)
    const res: Response = await onRequest({ request: post(body, nextIp()), env: ALLOW })
    expect(res.status).toBe(400)
    expect(calls).toHaveLength(0)
  })
})

describe('ai-design 按 IP 日限次', () => {
  it('同一 IP 第 31 次返回 429 并带 Retry-After；其他 IP 不受影响', async () => {
    mockFetch(() => new Response('{"choices":[]}', { status: 200 }))
    const env: Env = { ...ALLOW, DEEPSEEK_API_KEY: 'k' }
    const ip = nextIp()
    for (let i = 0; i < 30; i++) {
      const res: Response = await onRequest({ request: post(validBody, ip), env })
      expect(res.status).toBe(200)
    }
    const blocked: Response = await onRequest({ request: post(validBody, ip), env })
    expect(blocked.status).toBe(429)
    const retryAfter = Number(blocked.headers.get('Retry-After'))
    expect(retryAfter).toBeGreaterThan(0)
    expect(retryAfter).toBeLessThanOrEqual(86400)

    const other: Response = await onRequest({ request: post(validBody, nextIp()), env })
    expect(other.status).toBe(200)
  })

  it('存储降级 memory 且未放行时 fail closed 503，不调上游', async () => {
    const calls = mockFetch(() => new Response('{}'))
    const res: Response = await onRequest({
      request: post(validBody, nextIp()),
      env: { DEEPSEEK_API_KEY: 'k' },
    })
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'storage_unavailable' })
    expect(calls).toHaveLength(0)
  })
})

describe('ai-design 兜底与错误脱敏', () => {
  it('主上游失败后 fallback 仅调用一次，错误响应不透传上游正文', async () => {
    const calls = mockFetch(
      () => new Response('{"error":"SECRET-UPSTREAM-DETAIL quota exhausted"}', { status: 402 }),
    )
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res: Response = await onRequest({
      request: post(validBody, nextIp()),
      env: { ...ALLOW, DEEPSEEK_API_KEY: 'k', AI_API_KEY: 'k2' },
    })
    expect(res.status).toBe(502)
    expect(calls.filter((u) => u.includes('deepseek'))).toHaveLength(1)
    expect(calls.filter((u) => !u.includes('deepseek'))).toHaveLength(1)
    expect(calls.some((u) => u.includes('bigmodel'))).toBe(true)
    const text = await res.text()
    expect(text).not.toContain('SECRET-UPSTREAM-DETAIL')
    expect(JSON.parse(text)).toEqual({ error: 'AI 服务暂时不可用，请稍后再试', code: 'upstream_402' })
  })

  it('无兜底密钥时只尝试 1 个匿名代理模型', async () => {
    const calls = mockFetch(() => new Response('x', { status: 500 }))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res: Response = await onRequest({
      request: post(validBody, nextIp()),
      env: { ...ALLOW, DEEPSEEK_API_KEY: 'k' },
    })
    expect(res.status).toBe(502)
    expect(calls.filter((u) => u.includes('pollinations'))).toHaveLength(1)
    expect(calls).toHaveLength(2)
  })

  it('兜底调用的超时预算不超过 25s', async () => {
    const timeouts: number[] = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit & { eo?: { timeoutSetting: { readTimeout: number } } }) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (!url.includes('deepseek')) timeouts.push(init?.eo?.timeoutSetting.readTimeout ?? -1)
      return new Response('x', { status: 500 })
    }) as unknown as typeof fetch
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await onRequest({
      request: post(validBody, nextIp()),
      env: { ...ALLOW, DEEPSEEK_API_KEY: 'k', AI_API_KEY: 'k2' },
    })
    expect(timeouts).toEqual([25_000])
  })
})
