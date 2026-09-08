/**
 * edge-functions/api/ai-design.js 的桩测试：
 * 直接调用 onRequest（内存 KV 放行），覆盖 413 字节上限、按 IP 限频 429、
 * 上游超时 504 与超长回复截断标记。上游 fetch 全部 mock，不访问网络。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  AI_MAX_BODY_BYTES,
  AI_MAX_CONTENT_CHARS,
  AI_RATE_LIMIT,
  AI_UPSTREAM_TIMEOUT_MS,
  onRequest,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore JS 模块无类型声明
} from '../../../edge-functions/api/ai-design.js'

interface Env {
  SEATMARK_ALLOW_MEMORY_STORAGE?: string
  DEEPSEEK_API_KEY?: string
  AI_API_KEY?: string
  SEATMARK_AI_ANON_FALLBACK?: string
}

const ENV: Env = { SEATMARK_ALLOW_MEMORY_STORAGE: '1' }

let ipSeq = 0
function freshIp(): string {
  ipSeq += 1
  return `203.0.113.${ipSeq}`
}

function post(body: string | Record<string, unknown>, ip: string, headers: Record<string, string> = {}) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body)
  return new Request('https://www.seatmark.cn/api/ai-design', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'EO-Connecting-IP': ip, ...headers },
    body: raw,
  })
}

const messages = [{ role: 'user', content: '设计一张考场桌贴' }]

function chatReply(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = vi.fn(async () => chatReply('{"fields":[]}')) as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.useRealTimers()
})

describe('ai-design 请求体上限', () => {
  it('Content-Length 超过 32KB 直接 413，不读取正文', async () => {
    const res = await onRequest({
      request: post({ messages }, freshIp(), { 'Content-Length': String(AI_MAX_BODY_BYTES + 1) }),
      env: ENV,
    })
    expect(res.status).toBe(413)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('实际正文超过 32KB 返回 413', async () => {
    const big = { messages: [{ role: 'user', content: 'x'.repeat(AI_MAX_BODY_BYTES) }] }
    const res = await onRequest({ request: post(big, freshIp()), env: ENV })
    expect(res.status).toBe(413)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('正常体积请求透传上游并 200', async () => {
    const res = await onRequest({ request: post({ messages }, freshIp()), env: ENV })
    expect(res.status).toBe(200)
    const data = (await res.json()) as { choices: Array<{ message: { content: string } }>; truncated?: boolean }
    expect(data.choices[0]!.message.content).toBe('{"fields":[]}')
    expect(data.truncated).toBeUndefined()
  })
})

describe('ai-design 按 IP 限频', () => {
  it('同一 IP 一小时内第 31 次返回 429 并带 Retry-After', async () => {
    const ip = freshIp()
    for (let i = 0; i < AI_RATE_LIMIT; i++) {
      const res = await onRequest({ request: post({ messages }, ip), env: ENV })
      expect(res.status).toBe(200)
    }
    const res = await onRequest({ request: post({ messages }, ip), env: ENV })
    expect(res.status).toBe(429)
    const retryAfter = Number(res.headers.get('Retry-After'))
    expect(retryAfter).toBeGreaterThan(0)
    expect(retryAfter).toBeLessThanOrEqual(3600)
    expect(globalThis.fetch).toHaveBeenCalledTimes(AI_RATE_LIMIT)
  })

  it('不同 IP 互不影响', async () => {
    const res = await onRequest({ request: post({ messages }, freshIp()), env: ENV })
    expect(res.status).toBe(200)
  })

  it('存储为 memory 且未放行时限频降级跳过，仍可正常代理', async () => {
    const ip = freshIp()
    for (let i = 0; i < AI_RATE_LIMIT + 2; i++) {
      const res = await onRequest({ request: post({ messages }, ip), env: {} })
      expect(res.status).toBe(200)
    }
  })
})

describe('ai-design 上游超时与截断', () => {
  it('上游 25s 未响应时中止并返回 504', async () => {
    // 只伪造 setTimeout：限频里的 crypto.subtle / 存储初始化走真实事件循环
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const fail = () => reject(new DOMException('The operation was aborted.', 'AbortError'))
          if (init.signal?.aborted) fail()
          else init.signal?.addEventListener('abort', fail)
        }),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const pending = onRequest({ request: post({ messages }, freshIp()), env: ENV })
    // vi.waitFor 用真实计时器轮询，等到上游 fetch 已发出（限频等前置异步步骤走真实事件循环）
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await vi.advanceTimersByTimeAsync(AI_UPSTREAM_TIMEOUT_MS + 10)
    const res = await pending
    expect(res.status).toBe(504)
    const data = (await res.json()) as { error: string }
    expect(data.error).toContain('超时')
    // 第 363 轮：超时后 break 出上游循环，不再逐个尝试后续 Pollinations 模型
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('第 363 轮：有密钥上游超时后不再尝试兜底上游，fetch 只调用 1 次', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const fail = () => reject(new DOMException('The operation was aborted.', 'AbortError'))
          if (init.signal?.aborted) fail()
          else init.signal?.addEventListener('abort', fail)
        }),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const env: Env = { ...ENV, DEEPSEEK_API_KEY: 'test-key', AI_API_KEY: 'test-key-2' }
    const pending = onRequest({ request: post({ messages }, freshIp()), env })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await vi.advanceTimersByTimeAsync(AI_UPSTREAM_TIMEOUT_MS + 10)
    const res = await pending
    expect(res.status).toBe(504)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]![0])).toContain('api.deepseek.com')
  })

  it('回复 content 超过 20KB 截断并标记 truncated:true', async () => {
    const long = 'a'.repeat(AI_MAX_CONTENT_CHARS + 500)
    globalThis.fetch = vi.fn(async () => chatReply(long)) as unknown as typeof fetch
    const res = await onRequest({ request: post({ messages }, freshIp()), env: ENV })
    expect(res.status).toBe(200)
    const data = (await res.json()) as { choices: Array<{ message: { content: string } }>; truncated?: boolean }
    expect(data.truncated).toBe(true)
    expect(data.choices[0]!.message.content.length).toBe(AI_MAX_CONTENT_CHARS)
  })
})

describe('第 363 轮：匿名兜底可关闭 + 502 不泄露上游模型名', () => {
  it('SEATMARK_AI_ANON_FALLBACK=0 且无任何密钥 → 502，fetch 未调用 Pollinations，body 为固定文案', async () => {
    const fetchMock = vi.fn(async () => chatReply('should not be called'))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const env: Env = { ...ENV, SEATMARK_AI_ANON_FALLBACK: '0' }
    const res = await onRequest({ request: post({ messages }, freshIp()), env })
    expect(res.status).toBe(502)
    expect(fetchMock).not.toHaveBeenCalled()
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('AI 服务暂时不可用，请稍后再试')
    warn.mockRestore()
  })

  it('SEATMARK_AI_ANON_FALLBACK=0 且密钥上游失败 → 直接 502，不再请求 Pollinations', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('upstream down', { status: 500 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const env: Env = { ...ENV, SEATMARK_AI_ANON_FALLBACK: '0', AI_API_KEY: 'test-key' }
    const res = await onRequest({ request: post({ messages }, freshIp()), env })
    expect(res.status).toBe(502)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).not.toContain('pollinations')
    }
    warn.mockRestore()
  })

  it('默认开启匿名兜底：全部 Pollinations 模型失败 → 502，body 不含模型名/HTTP 状态，详情只进 console.warn', async () => {
    const fetchMock = vi.fn(async () => new Response('rate limited', { status: 429 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await onRequest({ request: post({ messages }, freshIp()), env: ENV })
    expect(res.status).toBe(502)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const body = await res.text()
    expect(body).toBe(JSON.stringify({ error: 'AI 服务暂时不可用，请稍后再试' }))
    for (const leak of ['openai', 'mistral', 'deepseek', 'glm', 'pollinations', '429', 'HTTP']) {
      expect(body).not.toContain(leak)
    }
    const logged = warn.mock.calls.map((c) => c.map(String).join(' ')).join('\n')
    expect(logged).toContain('openai: HTTP 429')
    warn.mockRestore()
  })
})
