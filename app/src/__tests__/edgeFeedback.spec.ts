/**
 * edge-functions/api/feedback.js：请求体上限（413）、非 JSON（400）、正常提交（200）、
 * 以及存储降级 memory 时的行为（反馈无持久化承诺：存档静默走内存，仍返回 200）。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { onRequest, FEEDBACK_ARCHIVE_TTL_SECONDS, FEEDBACK_MAX_BODY_BYTES } from '../../../edge-functions/api/feedback.js'

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

  it('第 359 轮：反馈存档带 180 天 expirationTtl（Blob/内存后端由 _storage.js 包装值生效）', async () => {
    expect(FEEDBACK_ARCHIVE_TTL_SECONDS).toBe(180 * 24 * 3600)
    const puts: Array<{ key: string; ttl?: number }> = []
    const kv = {
      async get() {
        return null
      },
      async put(key: string, _value: string, options?: { expirationTtl?: number }) {
        puts.push({ key, ttl: options?.expirationTtl })
      },
      async delete() {},
      async list() {
        return { keys: [], complete: true, cursor: '' }
      },
    }
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { response } = await send(post(JSON.stringify({ type: 'bug', content: '单测：存档 TTL' })), {
      seatmark_kv: kv,
    })
    expect(response.status).toBe(200)
    const archive = puts.find((p) => p.key.startsWith('fb:'))
    expect(archive?.ttl).toBe(FEEDBACK_ARCHIVE_TTL_SECONDS)
  })
})

describe('第 350 轮：webhook 文本页面字段与存档同规格截断', () => {
  it('传 5000 字符 page：webhook body 中「页面：」字段 ≤200 字符，存档 page 同为 200', async () => {
    const bodies: string[] = []
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      bodies.push(String(init?.body ?? ''))
      return new Response('{}', { status: 200 })
    }) as typeof fetch
    const store = new Map<string, string>()
    const env: Env = {
      FEEDBACK_WEBHOOK: 'https://open.feishu.cn/open-apis/bot/v2/hook/test',
      seatmark_kv: {
        async get(k: string) {
          return store.get(k) ?? null
        },
        async put(k: string, v: string) {
          store.set(k, v)
        },
        async delete(k: string) {
          store.delete(k)
        },
      },
    }
    const longPage = '/studio?' + 'q'.repeat(4992)
    expect(longPage.length).toBe(5000)
    const { response, data } = await send(
      post(JSON.stringify({ type: 'bug', content: 'hello', page: longPage })),
      env,
    )
    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(bodies).toHaveLength(1)
    const webhook = JSON.parse(bodies[0]!) as { content: { text: string } }
    const pageLine = webhook.content.text.split('\n').find((l) => l.startsWith('页面：'))!
    expect(pageLine).toBeDefined()
    const pageField = pageLine.slice('页面：'.length)
    expect(pageField.length).toBe(200)
    expect(pageField).toBe(longPage.slice(0, 200))
    const fbKey = [...store.keys()].find((k) => k.startsWith('fb:'))!
    const archived = JSON.parse(store.get(fbKey)!) as { page: string }
    expect(archived.page.length).toBe(200)
    // 日限键带 TTL：走 kv.put 第三参数（自定义 KV 忽略即可，此处只验不抛错）
    expect([...store.keys()].some((k) => k.startsWith('rl:fb:'))).toBe(true)
  })
})

describe('第 351 轮：webhook 按平台分发 schema', () => {
  function kvEnv(webhook: string): Env {
    const store = new Map<string, string>()
    return {
      FEEDBACK_WEBHOOK: webhook,
      seatmark_kv: {
        async get(k: string) {
          return store.get(k) ?? null
        },
        async put(k: string, v: string) {
          store.set(k, v)
        },
        async delete(k: string) {
          store.delete(k)
        },
      },
    }
  }

  function captureFetch() {
    const bodies: string[] = []
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      bodies.push(String(init?.body ?? ''))
      return new Response('{}', { status: 200 })
    }) as typeof fetch
    return bodies
  }

  it('钉钉 oapi.dingtalk.com：body 为 { msgtype:"text", text:{ content } }', async () => {
    const bodies = captureFetch()
    const { response } = await send(
      post(JSON.stringify({ type: 'bug', content: '钉钉分发', page: '/studio' })),
      kvEnv('https://oapi.dingtalk.com/robot/send?access_token=test'),
    )
    expect(response.status).toBe(200)
    expect(bodies).toHaveLength(1)
    const body = JSON.parse(bodies[0]!) as { msgtype: string; text: { content: string }; msg_type?: unknown }
    expect(body.msgtype).toBe('text')
    expect(body.text.content).toContain('钉钉分发')
    expect(body.msg_type).toBeUndefined()
  })

  it('企业微信 qyapi.weixin.qq.com：同为 msgtype/text.content', async () => {
    const bodies = captureFetch()
    await send(
      post(JSON.stringify({ type: 'bug', content: '企微分发' })),
      kvEnv('https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test'),
    )
    const body = JSON.parse(bodies[0]!) as { msgtype: string; text: { content: string } }
    expect(body.msgtype).toBe('text')
    expect(body.text.content).toContain('企微分发')
  })

  it('飞书维持默认 { msg_type:"text", content:{ text } }', async () => {
    const bodies = captureFetch()
    await send(
      post(JSON.stringify({ type: 'bug', content: '飞书分发' })),
      kvEnv('https://open.feishu.cn/open-apis/bot/v2/hook/test'),
    )
    const body = JSON.parse(bodies[0]!) as { msg_type: string; content: { text: string }; msgtype?: unknown }
    expect(body.msg_type).toBe('text')
    expect(body.content.text).toContain('飞书分发')
    expect(body.msgtype).toBeUndefined()
  })
})
