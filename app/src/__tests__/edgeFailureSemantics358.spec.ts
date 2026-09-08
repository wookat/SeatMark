/**
 * 第 358 轮：边缘函数失败语义
 * - ai-design 无密钥兜底全部 502 时：响应 body 为固定文案（第 363 轮起连模型名/HTTP 状态也不出 body），上游诊断只进 console.warn（前 300 字）
 * - feedback KV 归档与 webhook 都失败 → 503 且 console.error 被调用
 * - feedback 仅 webhook 失败 → 200，ctx.waitUntil 收到 2s 后重试的 promise
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { onRequest as aiOnRequest } from '../../../edge-functions/api/ai-design.js'
import {
  FEEDBACK_UNAVAILABLE_MESSAGE,
  FEEDBACK_WEBHOOK_RETRY_DELAY_MS,
  onRequest as feedbackOnRequest,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore JS 模块无类型声明
} from '../../../edge-functions/api/feedback.js'

const originalFetch = globalThis.fetch

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const SENSITIVE = 'upstream diag: api key sk-secret-1234 at 10.0.0.7 traceback line 42'

describe('第 358 轮：ai-design 上游 502 诊断不出 body', () => {
  it('mock 上游 502 带敏感诊断：客户端只见固定文案（第 363 轮：不含模型名/状态码），诊断只进 console.warn', async () => {
    const fetchMock = vi.fn(async () => new Response(SENSITIVE.repeat(20), { status: 502 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const res: Response = await aiOnRequest({
      request: new Request('https://www.seatmark.cn/api/ai-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'EO-Connecting-IP': '203.0.113.200' },
        body: JSON.stringify({ messages: [{ role: 'user', content: '设计一张桌贴' }] }),
      }),
      env: { SEATMARK_ALLOW_MEMORY_STORAGE: '1' },
    })
    expect(res.status).toBe(502)
    const text = await res.text()
    expect(text).toContain('AI 服务暂时不可用，请稍后再试')
    expect(text).not.toMatch(/HTTP 502/)
    expect(text).not.toContain('openai')
    expect(text).not.toContain('mistral')
    expect(text).not.toContain('sk-secret')
    expect(text).not.toContain('traceback')
    expect(text).not.toContain('10.0.0.7')
    expect(fetchMock).toHaveBeenCalled()
    const warned = vi.mocked(console.warn).mock.calls.map((c) => c.map(String).join(' '))
    const diag = warned.filter((line) => line.includes('HTTP 502'))
    expect(diag.length).toBe(fetchMock.mock.calls.length)
    for (const line of diag) {
      expect(line).toContain('sk-secret')
      const idx = line.indexOf('HTTP 502 ')
      expect(line.slice(idx + 'HTTP 502 '.length).length).toBeLessThanOrEqual(300)
    }
  })
})

function feedbackPost(content: string) {
  return new Request('https://www.seatmark.cn/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'EO-Connecting-IP': '203.0.113.201' },
    body: JSON.stringify({ type: 'bug', content, page: '/studio' }),
  })
}

function failingArchiveKv() {
  const store = new Map<string, string>()
  return {
    async get(key: string) {
      return store.get(key) ?? null
    },
    async put(key: string, value: string) {
      if (key.startsWith('fb:')) throw new Error('kv write quota exceeded')
      store.set(key, value)
    },
    async delete(key: string) {
      store.delete(key)
    },
  }
}

function okKv() {
  const store = new Map<string, string>()
  return {
    store,
    async get(key: string) {
      return store.get(key) ?? null
    },
    async put(key: string, value: string) {
      store.set(key, value)
    },
    async delete(key: string) {
      store.delete(key)
    },
  }
}

describe('第 358 轮：feedback 双失败不再假成功', () => {
  it('KV 归档 reject 且 webhook fetch reject → 503 {ok:false}，console.error 被调用，告警走 ALERT_WEBHOOK', async () => {
    const urls: string[] = []
    globalThis.fetch = (async (url: unknown) => {
      urls.push(String(url))
      throw new Error('network down')
    }) as typeof fetch
    const waitUntil = vi.fn()
    const res: Response = await feedbackOnRequest({
      request: feedbackPost('双失败'),
      env: {
        FEEDBACK_WEBHOOK: 'https://open.feishu.cn/open-apis/bot/v2/hook/test',
        ALERT_WEBHOOK: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test',
        seatmark_kv: failingArchiveKv(),
      },
      waitUntil,
    })
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ ok: false, error: FEEDBACK_UNAVAILABLE_MESSAGE })
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('archive failed'),
      expect.stringContaining('kv write quota exceeded'),
    )
    await Promise.all(waitUntil.mock.calls.map((c) => Promise.resolve(c[0]).catch(() => {})))
    expect(urls.some((u) => u.startsWith('https://qyapi.weixin.qq.com/'))).toBe(true)
  })

  it('归档失败但 webhook 成功 → 仍 200（反馈已送达）', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch
    const res: Response = await feedbackOnRequest({
      request: feedbackPost('归档失败推送成功'),
      env: {
        FEEDBACK_WEBHOOK: 'https://open.feishu.cn/open-apis/bot/v2/hook/test',
        seatmark_kv: failingArchiveKv(),
      },
      waitUntil: vi.fn(),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(console.error).toHaveBeenCalled()
  })

  it('只 webhook 失败 → 200，waitUntil 收到重试 promise，2s 后重发一次', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValue(new Response('{}', { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const waitUntil = vi.fn()
    const kv = okKv()
    const res: Response = await feedbackOnRequest({
      request: feedbackPost('只推送失败'),
      env: { FEEDBACK_WEBHOOK: 'https://open.feishu.cn/open-apis/bot/v2/hook/test', seatmark_kv: kv },
      waitUntil,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect([...kv.store.keys()].some((k) => k.startsWith('fb:'))).toBe(true)
    expect(waitUntil).toHaveBeenCalledTimes(1)
    expect(waitUntil.mock.calls[0]![0]).toBeInstanceOf(Promise)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(FEEDBACK_WEBHOOK_RETRY_DELAY_MS - 1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await waitUntil.mock.calls[0]![0]
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(console.error).not.toHaveBeenCalled()
  })

  it('无 ctx.waitUntil 的运行时：webhook 失败不抛出，仍 200', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('boom')
    }) as unknown as typeof fetch
    const res: Response = await feedbackOnRequest({
      request: feedbackPost('无 waitUntil'),
      env: { FEEDBACK_WEBHOOK: 'https://open.feishu.cn/open-apis/bot/v2/hook/test', seatmark_kv: okKv() },
    })
    expect(res.status).toBe(200)
  })
})
