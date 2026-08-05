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

describe('/api/admin/health', () => {
  const env: Env = {
    AUTH_SECRET: 'test-secret',
    ADMIN_EMAILS: 'admin@example.com',
  }

  it('未登录返回 401', async () => {
    const { response } = await call('GET', 'https://www.seatmark.cn/api/admin/health')
    expect(response.status).toBe(401)
  })

  it('管理员登录后返回三项配置状态', async () => {
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
