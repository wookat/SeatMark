/**
 * edge-functions/api/[[default]].js 的桩测试：
 * 直接调用 onRequest，覆盖 devCode 环境限制、/api/admin/health 健康检查、
 * AUTH_SECRET / 存储 fail-closed 与 CSPRNG 验证码。
 *
 * 默认 env（BASE_ENV）模拟“已配置密钥 + 允许内存存储”的联调环境，
 * fail-closed 用例通过 raw: true 绕过默认值模拟线上配置缺失。
 */
import { describe, expect, it, vi } from 'vitest'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { onRequest } from '../../../edge-functions/api/[[default]].js'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { onRequest as onFeedbackRequest } from '../../../edge-functions/api/feedback.js'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { onRequest as onAiDesignRequest } from '../../../edge-functions/api/ai-design.js'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { isDevEnvironment, randomDigits, randomInt } from '../../../edge-functions/api/_security.js'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { StorageUnavailableError, getStorage } from '../../../edge-functions/api/_storage.js'

interface Env {
  AUTH_SECRET?: string
  ADMIN_EMAILS?: string
  RESEND_API_KEY?: string
  DEV?: string
  SEATMARK_DEV?: string
  ALLOW_MEMORY_STORAGE?: string
  FEEDBACK_WEBHOOK?: string
  ALERT_WEBHOOK?: string
  seatmark_blob?: MockBlobStore
}

/** 默认联调环境：密钥已配置，允许内存存储（否则非 localhost 的写接口会 fail-closed） */
const BASE_ENV: Env = { AUTH_SECRET: 'test-secret', ALLOW_MEMORY_STORAGE: '1' }

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

/** 获取并解答一张图片验证码（从 SVG 文本节点还原字符），供注册/登录/重置密码请求携带 */
async function solvedCaptcha(env: Env = {}) {
  const request = new Request('https://www.seatmark.cn/api/auth/captcha', { method: 'GET' })
  const response: Response = await onRequest({ request, env: { ...BASE_ENV, ...env } })
  const data = (await response.json()) as { image: string; token: string }
  const b64 = data.image.replace(/^data:image\/svg\+xml;base64,/, '')
  const svg = Buffer.from(b64, 'base64').toString('utf-8')
  const answer = [...svg.matchAll(/<text [^>]*>([^<])<\/text>/g)].map((m) => m[1]).join('')
  if (answer.length !== 4) throw new Error(`无法解析验证码图片字符：${svg}`)
  // 混合大小写作答验证不区分大小写
  return { captchaToken: data.token, captchaAnswer: answer.toLowerCase() }
}

const CAPTCHA_PATHS = ['/api/auth/register', '/api/auth/login', '/api/auth/reset-code']

async function call(
  method: string,
  url: string,
  {
    body,
    env = {},
    cookie,
    raw = false,
  }: { body?: unknown; env?: Env; cookie?: string; raw?: boolean } = {},
) {
  if (!raw) env = { ...BASE_ENV, ...env }
  // 需携带验证码的认证路径：未显式传入时自动解答并注入（各用例聚焦自身断言）
  if (
    body &&
    typeof body === 'object' &&
    !('captchaToken' in (body as Record<string, unknown>)) &&
    CAPTCHA_PATHS.some((p) => url.includes(p))
  ) {
    body = { ...(body as Record<string, unknown>), ...(await solvedCaptcha(env)) }
  }
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

describe('_security.js CSPRNG 与开发环境判定', () => {
  it('randomDigits(6) 恒为 6 位数字字符串', () => {
    for (let i = 0; i < 500; i++) expect(randomDigits(6)).toMatch(/^\d{6}$/)
    expect(randomDigits(1)).toMatch(/^\d$/)
    expect(() => randomDigits(0)).toThrow(RangeError)
  })

  it('randomInt 返回 [0, max) 内的整数，非法参数报错', () => {
    expect(randomInt(1)).toBe(0)
    for (let i = 0; i < 1000; i++) {
      const v = randomInt(7)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(7)
    }
    expect(() => randomInt(0)).toThrow(RangeError)
    expect(() => randomInt(2.5)).toThrow(RangeError)
  })

  it('10k 次采样各值频率在合理区间（无明显模偏差）', () => {
    const max = 10
    const n = 10000
    const counts = new Array<number>(max).fill(0)
    for (let i = 0; i < n; i++) counts[randomInt(max)]!++
    // 期望 1000/值，标准差≈ 30；±200 ≈ 6.7σ，假阳概率可忽略
    for (const c of counts) {
      expect(c).toBeGreaterThan(800)
      expect(c).toBeLessThan(1200)
    }
  })

  it('isDevEnvironment：SEATMARK_DEV=1 / DEV / localhost 为真，线上域名为假', () => {
    expect(isDevEnvironment({ SEATMARK_DEV: '1' }, 'www.seatmark.cn')).toBe(true)
    expect(isDevEnvironment({ DEV: '1' }, 'www.seatmark.cn')).toBe(true)
    expect(isDevEnvironment({}, 'localhost')).toBe(true)
    expect(isDevEnvironment({}, '127.0.0.1')).toBe(true)
    expect(isDevEnvironment({}, 'www.seatmark.cn')).toBe(false)
    expect(isDevEnvironment(undefined, 'www.seatmark.cn')).toBe(false)
  })
})

describe('AUTH_SECRET fail-closed', () => {
  it('线上缺 AUTH_SECRET：认证/管理/需会话路由 503 auth_secret_missing，响应头标记 missing', async () => {
    const env: Env = { ALLOW_MEMORY_STORAGE: '1' }
    for (const [method, path] of [
      ['GET', '/api/auth/captcha'],
      ['POST', '/api/auth/login'],
      ['GET', '/api/auth/me'],
      ['GET', '/api/quota'],
      ['GET', '/api/admin/reservations'],
    ] as const) {
      const { response, data } = await call(method, `https://www.seatmark.cn${path}`, {
        env,
        raw: true,
        body: method === 'POST' ? { email: 'x@example.com', password: 'p' } : undefined,
      })
      expect(response.status, path).toBe(503)
      expect(data.code, path).toBe('auth_secret_missing')
      expect(response.headers.get('X-SeatMark-Auth')).toBe('missing')
    }
  })

  it('线上缺 AUTH_SECRET：/api/admin/health 仍报告 authSecretConfigured=false', async () => {
    const { response, data } = await call('GET', 'https://www.seatmark.cn/api/admin/health', {
      env: { ALLOW_MEMORY_STORAGE: '1' },
      raw: true,
    })
    expect(response.status).toBe(503)
    expect(data.authSecretConfigured).toBe(false)
    expect(data.code).toBe('auth_secret_missing')
  })

  it('线上缺 AUTH_SECRET：不依赖密钥的公开接口（公告/短链）照常可用', async () => {
    const { response } = await call('GET', 'https://www.seatmark.cn/api/announcement', {
      env: { ALLOW_MEMORY_STORAGE: '1' },
      raw: true,
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('X-SeatMark-Auth')).toBe('missing')
  })

  it('开发环境（localhost / SEATMARK_DEV=1）缺 AUTH_SECRET 时放行并标记 dev-default', async () => {
    const { response } = await call('GET', 'http://localhost:5173/api/auth/captcha', {
      env: {},
      raw: true,
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('X-SeatMark-Auth')).toBe('dev-default')

    const { response: flagRes } = await call('GET', 'https://www.seatmark.cn/api/auth/captcha', {
      env: { SEATMARK_DEV: '1' },
      raw: true,
    })
    expect(flagRes.status).toBe(200)
    expect(flagRes.headers.get('X-SeatMark-Auth')).toBe('dev-default')
  })

  it('已配置 AUTH_SECRET 时响应头标记 configured', async () => {
    const { response } = await call('GET', 'https://www.seatmark.cn/api/auth/captcha')
    expect(response.status).toBe(200)
    expect(response.headers.get('X-SeatMark-Auth')).toBe('configured')
  })
})

describe('存储 fail-closed（无 KV/Blob）', () => {
  const prodEnv: Env = { AUTH_SECRET: 'test-secret' }

  it('getStorage 线上无持久化存储时抛 StorageUnavailableError，开发/显式开关时降级内存', async () => {
    await expect(getStorage({}, { hostname: 'www.seatmark.cn' })).rejects.toBeInstanceOf(
      StorageUnavailableError,
    )
    expect((await getStorage({}, { hostname: 'localhost' })).storage).toBe('memory')
    expect((await getStorage({ SEATMARK_DEV: '1' }, { hostname: 'www.seatmark.cn' })).storage).toBe(
      'memory',
    )
    expect(
      (await getStorage({ ALLOW_MEMORY_STORAGE: '1' }, { hostname: 'www.seatmark.cn' })).storage,
    ).toBe('memory')
  })

  it('线上写接口（登录/发码/兑换/预约）返回 503 storage_unavailable，响应头标记 unavailable', async () => {
    for (const [path, body] of [
      ['/api/auth/code', { email: 'a@example.com' }],
      ['/api/auth/login', { email: 'a@example.com', password: 'pw', captchaToken: 't', captchaAnswer: 'x' }],
      ['/api/redeem', { code: 'ABCDEFGHJKMN' }],
      ['/api/team/reserve', { email: 'a@example.com' }],
    ] as const) {
      const { response, data } = await call('POST', `https://www.seatmark.cn${path}`, {
        body,
        env: prodEnv,
        raw: true,
      })
      expect(response.status, path).toBe(503)
      expect(data.code, path).toBe('storage_unavailable')
      expect(response.headers.get('X-SeatMark-Storage')).toBe('unavailable')
    }
  })

  it('线上只读接口照常响应：验证码出图、公告、匿名配额、未登录 me', async () => {
    for (const path of ['/api/auth/captcha', '/api/announcement', '/api/quota', '/api/auth/me']) {
      const { response } = await call('GET', `https://www.seatmark.cn${path}`, {
        env: prodEnv,
        raw: true,
      })
      expect(response.status, path).toBe(200)
      expect(response.headers.get('X-SeatMark-Storage')).toBe('unavailable')
    }
  })

  it('线上存储不可用时 /api/admin/health 未登录仍 401，管理员会话下报告 storage=unavailable', async () => {
    const { response } = await call('GET', 'https://www.seatmark.cn/api/admin/health', {
      env: prodEnv,
      raw: true,
    })
    expect(response.status).toBe(401)

    // 用开发环境签发管理员会话（同一 AUTH_SECRET），再以线上无存储环境读 health
    const adminEnv: Env = { AUTH_SECRET: 'test-secret', ADMIN_EMAILS: 'ops@example.com' }
    const { data: codeData } = await call('POST', 'http://localhost:5173/api/auth/code', {
      body: { email: 'ops@example.com' },
      env: adminEnv,
    })
    const { response: verifyRes } = await call('POST', 'http://localhost:5173/api/auth/verify', {
      body: { email: 'ops@example.com', code: codeData.devCode },
      env: adminEnv,
    })
    const cookie = (verifyRes.headers.get('Set-Cookie') || '').split(';')[0]
    const { response: healthRes, data } = await call(
      'GET',
      'https://www.seatmark.cn/api/admin/health',
      { env: adminEnv, cookie, raw: true },
    )
    expect(healthRes.status).toBe(200)
    expect(data.storage).toBe('unavailable')
    expect(data.kvBound).toBe(false)
    expect(data.authSecretConfigured).toBe(true)
  })

  it('ALLOW_MEMORY_STORAGE=1 时线上写接口与现状一致（内存降级）', async () => {
    const { response } = await call('POST', 'https://www.seatmark.cn/api/team/reserve', {
      body: { email: 'mem@example.com' },
      env: { AUTH_SECRET: 'test-secret', ALLOW_MEMORY_STORAGE: '1' },
      raw: true,
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('X-SeatMark-Storage')).toBe('memory')
  })

  it('/api/feedback 线上无存储时 503，不再静默报成功', async () => {
    const request = new Request('https://www.seatmark.cn/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'bug', content: '测试' }),
    })
    const response: Response = await onFeedbackRequest({ request, env: {} })
    expect(response.status).toBe(503)
    expect(((await response.json()) as { code: string }).code).toBe('storage_unavailable')
  })
})

describe('webhook 未配置时不外发请求', () => {
  it('/api/feedback 无 FEEDBACK_WEBHOOK：只落库，不调用 fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    try {
      const request = new Request('http://localhost:5173/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'suggestion', content: '希望支持更多模板' }),
      })
      const response: Response = await onFeedbackRequest({ request, env: {} })
      expect(response.status).toBe(200)
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('/api/feedback 配置 FEEDBACK_WEBHOOK 时才推送', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }))
    try {
      const request = new Request('http://localhost:5173/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'bug', content: '导出报错' }),
      })
      await onFeedbackRequest({
        request,
        env: { FEEDBACK_WEBHOOK: 'https://open.feishu.cn/open-apis/bot/v2/hook/test' },
      })
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(String(fetchSpy.mock.calls[0]![0])).toContain('open.feishu.cn')
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('/api/ai-design 无密钥且无 ALERT_WEBHOOK：上游失败不会向任何 webhook 发告警', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('upstream down', { status: 500 }))
    try {
      const request = new Request('https://www.seatmark.cn/api/ai-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
      })
      await onAiDesignRequest({ request, env: { DEEPSEEK_API_KEY: 'sk-test' } })
      const hosts = fetchSpy.mock.calls.map((c) => new URL(String(c[0])).hostname)
      expect(hosts.some((h) => h.endsWith('weixin.qq.com'))).toBe(false)
      expect(hosts.some((h) => h.includes('webhook'))).toBe(false)
    } finally {
      fetchSpy.mockRestore()
    }
  })
})

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

describe('表单验证码与找回密码', () => {
  const PASSWORD = 'reset-secret-99'

  it('验证码答错时注册/登录被拒（400 + captcha 标记）', async () => {
    const cap = await solvedCaptcha()
    const wrong = { captchaToken: cap.captchaToken, captchaAnswer: '999' }
    const { response, data } = await call('POST', 'https://www.seatmark.cn/api/auth/register', {
      body: { email: 'cap-wrong@example.com', password: PASSWORD, ...wrong },
    })
    expect(response.status).toBe(400)
    expect(data.captcha).toBe(true)

    const { response: loginRes } = await call('POST', 'https://www.seatmark.cn/api/auth/login', {
      body: { email: 'cap-wrong@example.com', password: PASSWORD, ...wrong },
    })
    expect(loginRes.status).toBe(400)
  })

  it('缺验证码令牌时被拒', async () => {
    const { response } = await call('POST', 'https://www.seatmark.cn/api/auth/register', {
      body: { email: 'cap-none@example.com', password: PASSWORD, captchaToken: '', captchaAnswer: '' },
    })
    expect(response.status).toBe(400)
  })

  it('找回密码全链路：发码→验码设新密码→新密码可登录，旧密码失效', async () => {
    const email = 'reset-user@example.com'
    await call('POST', 'https://www.seatmark.cn/api/auth/register', {
      body: { email, password: PASSWORD },
    })
    // 本地开发未配邮件：重置码以 devCode 回显
    const { response: codeRes, data: codeData } = await call(
      'POST',
      'http://localhost:5173/api/auth/reset-code',
      { body: { email } },
    )
    expect(codeRes.status).toBe(200)
    expect(String(codeData.devCode)).toMatch(/^\d{6}$/)

    const newPassword = 'brand-new-pass-7'
    const { response: resetRes, data: resetData } = await call(
      'POST',
      'https://www.seatmark.cn/api/auth/reset-password',
      { body: { email, code: codeData.devCode, password: newPassword } },
    )
    expect(resetRes.status).toBe(200)
    expect((resetData.user as Record<string, unknown>).email).toBe(email)
    expect(resetRes.headers.get('Set-Cookie')).toContain('sm_session=')

    const { response: oldRes } = await call('POST', 'https://www.seatmark.cn/api/auth/login', {
      body: { email, password: PASSWORD },
    })
    expect(oldRes.status).toBe(401)
    const { response: newRes } = await call('POST', 'https://www.seatmark.cn/api/auth/login', {
      body: { email, password: newPassword },
    })
    expect(newRes.status).toBe(200)
  })

  it('未注册邮箱发重置码同样返回 ok（防枚举）且不落码', async () => {
    const { response, data } = await call(
      'POST',
      'http://localhost:5173/api/auth/reset-code',
      { body: { email: 'ghost@example.com' } },
    )
    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.devCode).toBeUndefined()

    const { response: resetRes } = await call(
      'POST',
      'https://www.seatmark.cn/api/auth/reset-password',
      { body: { email: 'ghost@example.com', code: '123456', password: PASSWORD } },
    )
    expect(resetRes.status).toBe(400)
  })

  it('重置码错误达上限后作废', async () => {
    const email = 'reset-lock@example.com'
    await call('POST', 'https://www.seatmark.cn/api/auth/register', {
      body: { email, password: PASSWORD },
    })
    const { data: codeData } = await call('POST', 'http://localhost:5173/api/auth/reset-code', {
      body: { email },
    })
    for (let i = 0; i < 5; i++) {
      const wrongCode = codeData.devCode === '000000' ? '111111' : '000000'
      await call('POST', 'https://www.seatmark.cn/api/auth/reset-password', {
        body: { email, code: wrongCode, password: PASSWORD },
      })
    }
    const { response } = await call('POST', 'https://www.seatmark.cn/api/auth/reset-password', {
      body: { email, code: codeData.devCode, password: PASSWORD },
    })
    expect(response.status).toBe(429)
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
