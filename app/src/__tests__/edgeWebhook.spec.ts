/**
 * edge-functions/api/feedback.js 与 ai-design.js 的 webhook 推送桩测试：
 * webhook 只允许来自环境变量，env 未配置时不得发起任何 fetch（无硬编码兜底值）。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { onRequest as feedbackRequest } from '../../../edge-functions/api/feedback.js'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { onRequest as aiDesignRequest } from '../../../edge-functions/api/ai-design.js'

interface Env {
  FEEDBACK_WEBHOOK?: string
  ALERT_WEBHOOK?: string
  DEEPSEEK_API_KEY?: string
  SEATMARK_ALLOW_MEMORY_STORAGE?: string
}

function postJson(url: string, body: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('feedback.js webhook 仅读 env.FEEDBACK_WEBHOOK', () => {
  it('env 未配置 webhook 时不发起 fetch，反馈仍返回成功', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const env: Env = {}
    const response: Response = await feedbackRequest({
      request: postJson('https://www.seatmark.cn/api/feedback', {
        type: 'suggestion',
        content: '单测：无 webhook',
      }),
      env,
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('webhook not configured'))
  })

  it('env 配置 webhook 时只向该地址推送一次', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const env: Env = { FEEDBACK_WEBHOOK: 'https://example.com/hook' }
    const response: Response = await feedbackRequest({
      request: postJson('https://www.seatmark.cn/api/feedback', {
        type: 'bug',
        content: '单测：有 webhook',
      }),
      env,
    })
    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(url).toBe('https://example.com/hook')
  })
})

describe('ai-design.js 告警 webhook 仅读 env.ALERT_WEBHOOK', () => {
  it('主模型失败且 env 未配置 webhook 时，除上游调用外不发起任何推送', async () => {
    const calls: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      calls.push(url)
      // 主模型 402；其余上游（兜底/匿名代理）也失败，走 502
      return new Response('{"error":"insufficient balance"}', { status: 402 })
    }) as unknown as typeof fetch
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const env: Env = { DEEPSEEK_API_KEY: 'test-key', SEATMARK_ALLOW_MEMORY_STORAGE: '1' }
    const response: Response = await aiDesignRequest({
      request: postJson('https://www.seatmark.cn/api/ai-design', {
        messages: [{ role: 'user', content: 'hi' }],
      }),
      env,
    })
    expect(response.status).toBe(502)
    expect(calls.some((u) => u.includes('qyapi.weixin.qq.com'))).toBe(false)
    expect(calls.every((u) => /deepseek|pollinations/.test(u))).toBe(true)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('webhook not configured'))
  })

  it('env 配置 ALERT_WEBHOOK 时向该地址推送告警', async () => {
    const calls: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      calls.push(url)
      return new Response('{}', { status: url.includes('example.com') ? 200 : 402 })
    }) as unknown as typeof fetch

    const env: Env = {
      DEEPSEEK_API_KEY: 'test-key',
      ALERT_WEBHOOK: 'https://example.com/alert',
      SEATMARK_ALLOW_MEMORY_STORAGE: '1',
    }
    await aiDesignRequest({
      request: postJson('https://www.seatmark.cn/api/ai-design', {
        messages: [{ role: 'user', content: 'hi' }],
      }),
      env,
    })
    expect(calls.filter((u) => u === 'https://example.com/alert')).toHaveLength(1)
  })
})
