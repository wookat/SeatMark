/**
 * edge-functions/api/feedback.js：请求体上限（413）、非 JSON（400）、正常提交（200）、
 * 以及存储降级 memory 时的行为（反馈无持久化承诺：存档静默走内存，仍返回 200）。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { onRequest, FEEDBACK_MAX_BODY_BYTES } from '../../../edge-functions/api/feedback.js'

interface Env {
  FEEDBACK_WEBHOOK?: string
  seatmark_kv?: unknown
}

function post(body: string, headers: Record<string, string> = {}) {
  return new Request('https://www.seatmark.cn/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  })
}

async function send(request: Request, env: Env = {}) {
  const response: Response = await onRequest({ request, env })
  return { response, data: (await response.json()) as Record<string, unknown> }
}

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('feedback.js 请求体上限', () => {
  it('上限常量为 32KB', () => {
    expect(FEEDBACK_MAX_BODY_BYTES).toBe(32 * 1024)
  })

  it('Content-Length 声明超限时直接 413，不读取请求体', async () => {
    const request = post(JSON.stringify({ type: 'other', content: 'x' }), {
      'Content-Length': String(FEEDBACK_MAX_BODY_BYTES + 1),
    })
    const text = vi.spyOn(request, 'text')
    const { response, data } = await send(request)
    expect(response.status).toBe(413)
    expect(data).toEqual({ error: '请求体过大' })
    expect(text).not.toHaveBeenCalled()
  })

  it('实际字节数超 32KB（40KB 体）返回 413', async () => {
    const body = JSON.stringify({ type: 'other', content: 'a'.repeat(40 * 1024) })
    const { response, data } = await send(post(body))
    expect(response.status).toBe(413)
    expect(data.error).toBe('请求体过大')
  })

  it('多字节字符按 UTF-8 字节计数', async () => {
    // 20000 个汉字 = 60000 字节 > 32KB，但字符数 < content 的 2000 字校验前就应被拦下
    const body = JSON.stringify({ type: 'other', content: '测'.repeat(20000) })
    const { response } = await send(post(body))
    expect(response.status).toBe(413)
  })

  it('非 JSON 请求体返回 400', async () => {
    const { response, data } = await send(post('{not json'))
    expect(response.status).toBe(400)
    expect(data.error).toBe('请求体格式错误')
  })

  it('正常提交（约 200 字节）返回 200，不受上限影响', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const body = JSON.stringify({
      type: 'other',
      content: '单测：正常提交（这是一条测试反馈，不含真实联系方式）'.padEnd(120, '。'),
      page: '/privacy',
    })
    expect(new TextEncoder().encode(body).length).toBeLessThan(1024)
    const { response, data } = await send(post(body))
    expect(response.status).toBe(200)
    expect(data).toEqual({ ok: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('字段级长度校验沿用：content 超 2000 字（但字节未超限）仍 400', async () => {
    const body = JSON.stringify({ type: 'other', content: 'a'.repeat(2001) })
    const { response, data } = await send(post(body))
    expect(response.status).toBe(400)
    expect(String(data.error)).toContain('2000')
  })
})

describe('feedback.js 存储与 webhook', () => {
  it('存储降级 memory 且未配置 webhook：不发起任何 fetch，仍返回 200（行为不变）', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { response, data } = await send(
      post(JSON.stringify({ type: 'suggestion', content: '单测：memory 降级' })),
      {},
    )
    expect(response.status).toBe(200)
    expect(data).toEqual({ ok: true })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('webhook not configured'))
  })

  it('限频键用哈希后的客户端 IP，KV 中不落明文 IP', async () => {
    const store = new Map<string, string>()
    const kv = {
      async get(key: string) {
        return store.get(key) ?? null
      },
      async put(key: string, value: string) {
        store.set(key, value)
      },
      async delete(key: string) {
        store.delete(key)
      },
      async list() {
        return { keys: [...store.keys()].map((name) => ({ name })), complete: true, cursor: '' }
      },
    }
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { response } = await send(
      post(JSON.stringify({ type: 'bug', content: '单测：限频键' }), {
        'EO-Connecting-IP': '203.0.113.9',
      }),
      { seatmark_kv: kv },
    )
    expect(response.status).toBe(200)
    const keys = [...store.keys()]
    expect(keys.some((k) => k.startsWith('rl:fb:'))).toBe(true)
    expect(keys.some((k) => k.startsWith('fb:'))).toBe(true)
    expect(keys.join('\n')).not.toContain('203.0.113.9')
  })
})
