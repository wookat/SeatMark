/**
 * edge-functions/api/[[default]].js 的桩测试：
 * 直接调用 onRequest（内存 KV 降级），覆盖本轮新增的
 * devCode 环境限制与 /api/admin/health 健康检查。
 */
import { describe, expect, it } from 'vitest'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { onRequest } from '../../../edge-functions/api/[[default]].js'

interface Env {
  AUTH_SECRET?: string
  ADMIN_EMAILS?: string
  RESEND_API_KEY?: string
  DEV?: string
  seatmark_blob?: MockBlobStore
}

/** 与 @edgeone/pages-blob Store 同接口子集的内存模拟 */
interface MockBlobStore {
  get(key: string, options?: { consistency?: string }): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
  list(options?: {
    prefix?: string
    limit?: number
    cursor?: string
    paginate?: boolean
    consistency?: string
  }): Promise<{ blobs: { key: string; etag: string }[]; directories: string[]; cursor?: string }>
}

function createMockBlobStore(): MockBlobStore & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    async get(key) {
      return data.has(key) ? (data.get(key) as string) : null
    },
    async set(key, value) {
      data.set(key, String(value))
    },
    async delete(key) {
      data.delete(key)
    },
    async list({ prefix = '', limit = 1000, cursor = '' } = {}) {
      const keys = [...data.keys()].filter((k) => k.startsWith(prefix)).sort()
      const start = cursor ? keys.indexOf(cursor) + 1 : 0
      const page = keys.slice(start, start + limit)
      const hasMore = start + limit < keys.length
      return {
        blobs: page.map((key) => ({ key, etag: '' })),
        directories: [],
        ...(hasMore && page.length ? { cursor: page[page.length - 1] } : {}),
      }
    },
  }
}

async function call(
  method: string,
  url: string,
  { body, env = {}, cookie }: { body?: unknown; env?: Env; cookie?: string } = {},
) {
  const headers = new Headers()
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  if (cookie) headers.set('Cookie', cookie)
  const request = new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const response: Response = await onRequest({ request, env })
  return { response, data: (await response.json()) as Record<string, unknown> }
}

describe('/api/auth/code devCode 环境限制', () => {
  it('本地开发（localhost）未配邮件时返回 devCode', async () => {
    const { response, data } = await call('POST', 'http://localhost:5173/api/auth/code', {
      body: { email: 'dev-user@example.com' },
    })
    expect(response.status).toBe(200)
    expect(data.delivery).toBe('stub')
    expect(String(data.devCode)).toMatch(/^\d{6}$/)
  })

  it('生产域名未配邮件时不返回 devCode，报明确错误', async () => {
    const { response, data } = await call('POST', 'https://www.seatmark.cn/api/auth/code', {
      body: { email: 'prod-user@example.com' },
    })
    expect(response.status).toBe(503)
    expect(data.devCode).toBeUndefined()
    expect(data.error).toBe('邮件服务未配置，请联系管理员')
  })

  it('生产域名但显式设置 DEV 环境变量时仍可联调', async () => {
    const { response, data } = await call('POST', 'https://www.seatmark.cn/api/auth/code', {
      body: { email: 'dev-flag@example.com' },
      env: { DEV: '1' },
    })
    expect(response.status).toBe(200)
    expect(data.delivery).toBe('stub')
  })
})

describe('/api/auth/register 与 /api/auth/login 密码登录', () => {
  const EMAIL = 'pw-user@example.com'
  const PASSWORD = 'super-secret-1'

  it('注册成功即签发会话，/api/auth/me 可见用户', async () => {
    const { response, data } = await call('POST', 'https://www.seatmark.cn/api/auth/register', {
      body: { email: EMAIL, password: PASSWORD },
    })
    expect(response.status).toBe(200)
    expect((data.user as Record<string, unknown>).email).toBe(EMAIL)
    const cookie = (response.headers.get('Set-Cookie') || '').split(';')[0]
    expect(cookie).toContain('sm_session=')

    const { data: meData } = await call('GET', 'https://www.seatmark.cn/api/auth/me', { cookie })
    expect((meData.user as Record<string, unknown>).email).toBe(EMAIL)
  })

  it('重复注册返回 409', async () => {
    await call('POST', 'https://www.seatmark.cn/api/auth/register', {
      body: { email: 'dup@example.com', password: PASSWORD },
    })
    const { response, data } = await call('POST', 'https://www.seatmark.cn/api/auth/register', {
      body: { email: 'dup@example.com', password: 'another-pass-2' },
    })
    expect(response.status).toBe(409)
    expect(data.error).toBe('该邮箱已注册，请直接登录')
  })

  it('密码过短返回 400', async () => {
    const { response } = await call('POST', 'https://www.seatmark.cn/api/auth/register', {
      body: { email: 'short@example.com', password: '1234567' },
    })
    expect(response.status).toBe(400)
  })

  it('正确密码登录成功，错误密码 401', async () => {
    await call('POST', 'https://www.seatmark.cn/api/auth/register', {
      body: { email: 'login@example.com', password: PASSWORD },
    })
    const { response: okRes, data: okData } = await call(
      'POST',
      'https://www.seatmark.cn/api/auth/login',
      { body: { email: 'login@example.com', password: PASSWORD } },
    )
    expect(okRes.status).toBe(200)
    expect((okData.user as Record<string, unknown>).email).toBe('login@example.com')

    const { response: badRes, data: badData } = await call(
      'POST',
      'https://www.seatmark.cn/api/auth/login',
      { body: { email: 'login@example.com', password: 'wrong-password' } },
    )
    expect(badRes.status).toBe(401)
    expect(badData.error).toBe('邮箱或密码不正确')
  })

  it('未注册邮箱登录返回 401（不泄露账号是否存在）', async () => {
    const { response, data } = await call('POST', 'https://www.seatmark.cn/api/auth/login', {
      body: { email: 'nobody@example.com', password: PASSWORD },
    })
    expect(response.status).toBe(401)
    expect(data.error).toBe('邮箱或密码不正确')
  })

  it('历史验证码账号（无密码）可通过注册补设密码', async () => {
    // 先用 devCode 通道创建无密码账号
    const { data: codeData } = await call('POST', 'http://localhost:5173/api/auth/code', {
      body: { email: 'legacy@example.com' },
    })
    await call('POST', 'http://localhost:5173/api/auth/verify', {
      body: { email: 'legacy@example.com', code: codeData.devCode },
    })
    // 未设密码时直接登录提示先注册
    const { response: earlyRes } = await call('POST', 'https://www.seatmark.cn/api/auth/login', {
      body: { email: 'legacy@example.com', password: PASSWORD },
    })
    expect(earlyRes.status).toBe(409)
    // 注册补设密码
    const { response: regRes } = await call('POST', 'https://www.seatmark.cn/api/auth/register', {
      body: { email: 'legacy@example.com', password: PASSWORD },
    })
    expect(regRes.status).toBe(200)
    const { response: loginRes } = await call('POST', 'https://www.seatmark.cn/api/auth/login', {
      body: { email: 'legacy@example.com', password: PASSWORD },
    })
    expect(loginRes.status).toBe(200)
  })

  it('连续 10 次错密码后限流 429', async () => {
    await call('POST', 'https://www.seatmark.cn/api/auth/register', {
      body: { email: 'ratelimit@example.com', password: PASSWORD },
    })
    for (let i = 0; i < 10; i++) {
      await call('POST', 'https://www.seatmark.cn/api/auth/login', {
        body: { email: 'ratelimit@example.com', password: 'wrong-password' },
      })
    }
    const { response, data } = await call('POST', 'https://www.seatmark.cn/api/auth/login', {
      body: { email: 'ratelimit@example.com', password: PASSWORD },
    })
    expect(response.status).toBe(429)
    expect(data.error).toBe('失败次数过多，请 15 分钟后再试')
  })
})

describe('/api/admin/health', () => {
  const env: Env = {
    AUTH_SECRET: 'test-secret',
    ADMIN_EMAILS: 'admin@example.com',
  }

  it('未登录返回 401', async () => {
    const { response } = await call('GET', 'https://www.seatmark.cn/api/admin/health')
    expect(response.status).toBe(401)
  })

  it('管理员登录后返回存储与配置状态', async () => {
    // 本地开发通道拿 devCode 登录
    const { data: codeData } = await call('POST', 'http://localhost:5173/api/auth/code', {
      body: { email: 'admin@example.com' },
      env,
    })
    const { response: verifyRes } = await call('POST', 'http://localhost:5173/api/auth/verify', {
      body: { email: 'admin@example.com', code: codeData.devCode },
      env,
    })
    expect(verifyRes.status).toBe(200)
    const cookie = (verifyRes.headers.get('Set-Cookie') || '').split(';')[0]

    const { response, data } = await call('GET', 'https://www.seatmark.cn/api/admin/health', {
      env,
      cookie,
    })
    expect(response.status).toBe(200)
    expect(data).toEqual({
      kvBound: false,
      blobAvailable: false,
      storage: 'memory',
      mailConfigured: false,
      mailChannel: 'none',
      authSecretConfigured: true,
    })
  })

  it('非管理员返回 403', async () => {
    const { data: codeData } = await call('POST', 'http://localhost:5173/api/auth/code', {
      body: { email: 'member@example.com' },
      env,
    })
    const { response: verifyRes } = await call('POST', 'http://localhost:5173/api/auth/verify', {
      body: { email: 'member@example.com', code: codeData.devCode },
      env,
    })
    const cookie = (verifyRes.headers.get('Set-Cookie') || '').split(';')[0]
    const { response } = await call('GET', 'https://www.seatmark.cn/api/admin/health', {
      env,
      cookie,
    })
    expect(response.status).toBe(403)
  })
})

describe('/api/share/tpl 存储防御', () => {
  const PAYLOAD = 'v0.eyJhIjoxfQ'

  it('内存后备下短码写入/读取往返成功', async () => {
    const { response, data } = await call('POST', 'http://localhost:5173/api/share/tpl', {
      body: { payload: PAYLOAD },
    })
    expect(response.status).toBe(200)
    expect(String(data.code)).toMatch(/^[0-9a-f]{10}$/)

    const { response: getRes, data: getData } = await call(
      'GET',
      `http://localhost:5173/api/share/tpl?code=${data.code}`,
    )
    expect(getRes.status).toBe(200)
    expect(getData.payload).toBe(PAYLOAD)
  })

  it('存储写入首次失败时防御重试成功，返回 200', async () => {
    let putCalls = 0
    const flakyKv = {
      async get() {
        return null
      },
      async put() {
        putCalls++
        if (putCalls === 1) throw new Error('blob init timeout')
      },
      async delete() {},
    }
    const { response, data } = await call('POST', 'http://localhost:5173/api/share/tpl', {
      body: { payload: PAYLOAD },
      env: { seatmark_kv: flakyKv } as unknown as Env,
    })
    expect(putCalls).toBe(2)
    expect(response.status).toBe(200)
    expect(String(data.code)).toMatch(/^[0-9a-f]{10}$/)
  })

  it('存储持续失败时返回结构化 503 而不是未捕获异常', async () => {
    const brokenKv = {
      async get() {
        throw new Error('storage down')
      },
      async put() {
        throw new Error('storage down')
      },
      async delete() {},
    }
    const env = { seatmark_kv: brokenKv } as unknown as Env
    const { response } = await call('POST', 'http://localhost:5173/api/share/tpl', {
      body: { payload: PAYLOAD },
      env,
    })
    expect(response.status).toBe(503)

    const { response: getRes } = await call(
      'GET',
      'http://localhost:5173/api/share/tpl?code=0123456789',
      { env },
    )
    expect(getRes.status).toBe(503)
  })

  it('顶层兜底：路由内部抛出异常时返回 JSON 500 而不是 545', async () => {
    const explodingKv = {
      get() {
        throw new Error('boom')
      },
      async put() {
        throw new Error('boom')
      },
      async delete() {},
    }
    // /api/auth/code 的 kv.get 无局部防御，异常应被顶层兜底捕获
    const { response, data } = await call('POST', 'http://localhost:5173/api/auth/code', {
      body: { email: 'boom@example.com' },
      env: { seatmark_kv: explodingKv } as unknown as Env,
    })
    expect(response.status).toBe(500)
    expect(data.error).toBe('服务暂时不可用，请稍后重试')
  })
})

describe('Blob 后备存储（KV 未绑定时）', () => {
  it('登录全链路走 Blob，响应头标记 blob', async () => {
    const blob = createMockBlobStore()
    const env: Env = { AUTH_SECRET: 'test-secret', seatmark_blob: blob }
    const { response: codeRes, data: codeData } = await call(
      'POST',
      'http://localhost:5173/api/auth/code',
      { body: { email: 'blob-user@example.com' }, env },
    )
    expect(codeRes.headers.get('X-SeatMark-Storage')).toBe('blob')
    expect(blob.data.has('code:blob-user@example.com')).toBe(true)

    const { response: verifyRes, data: verifyData } = await call(
      'POST',
      'http://localhost:5173/api/auth/verify',
      { body: { email: 'blob-user@example.com', code: codeData.devCode }, env },
    )
    expect(verifyRes.status).toBe(200)
    expect((verifyData.user as Record<string, unknown>).email).toBe('blob-user@example.com')
    expect(blob.data.has('user:blob-user@example.com')).toBe(true)
  })

  it('云端模板优先存 Blob 并可回读', async () => {
    const blob = createMockBlobStore()
    const env: Env = { AUTH_SECRET: 'test-secret', seatmark_blob: blob }
    const { data: codeData } = await call('POST', 'http://localhost:5173/api/auth/code', {
      body: { email: 'tpl-user@example.com' },
      env,
    })
    const { response: verifyRes } = await call('POST', 'http://localhost:5173/api/auth/verify', {
      body: { email: 'tpl-user@example.com', code: codeData.devCode },
      env,
    })
    const cookie = (verifyRes.headers.get('Set-Cookie') || '').split(';')[0]

    const templates = [{ id: 't1', name: '测试模板' }]
    const { response: putRes } = await call('PUT', 'http://localhost:5173/api/account/templates', {
      body: { templates },
      env,
      cookie,
    })
    expect(putRes.status).toBe(200)
    expect(blob.data.get('tpl:tpl-user@example.com')).toBe(JSON.stringify(templates))

    const { data: getData } = await call('GET', 'http://localhost:5173/api/account/templates', {
      env,
      cookie,
    })
    expect(getData.templates).toEqual(templates)
  })

  it('管理员健康检查报告 Blob 可用', async () => {
    const blob = createMockBlobStore()
    const env: Env = {
      AUTH_SECRET: 'test-secret',
      ADMIN_EMAILS: 'blob-admin@example.com',
      seatmark_blob: blob,
    }
    const { data: codeData } = await call('POST', 'http://localhost:5173/api/auth/code', {
      body: { email: 'blob-admin@example.com' },
      env,
    })
    const { response: verifyRes } = await call('POST', 'http://localhost:5173/api/auth/verify', {
      body: { email: 'blob-admin@example.com', code: codeData.devCode },
      env,
    })
    const cookie = (verifyRes.headers.get('Set-Cookie') || '').split(';')[0]

    const { data } = await call('GET', 'https://www.seatmark.cn/api/admin/health', {
      env,
      cookie,
    })
    expect(data.kvBound).toBe(false)
    expect(data.blobAvailable).toBe(true)
    expect(data.storage).toBe('blob')
  })
})
