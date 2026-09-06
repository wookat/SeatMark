/**
 * edge-functions/api/_random.js 安全随机工具 + 验证码/邮箱码取值范围测试。
 */
import { describe, expect, it } from 'vitest'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { randomDigits, randomId, randomInt, randomToken } from '../../../edge-functions/api/_random.js'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { onRequest } from '../../../edge-functions/api/[[default]].js'

const CAPTCHA_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const CAPTCHA_LENGTH = 4
const ENV = { SEATMARK_ALLOW_MEMORY_STORAGE: '1' }

describe('_random 工具', () => {
  it('randomInt 落在 [0, max) 且覆盖到边界值', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 2000; i++) {
      const n = randomInt(7) as number
      expect(Number.isInteger(n)).toBe(true)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(7)
      seen.add(n)
    }
    expect(seen.size).toBe(7)
    expect(() => randomInt(0)).toThrow(RangeError)
  })

  it('randomToken / randomDigits 长度与字符集正确', () => {
    for (let i = 0; i < 200; i++) {
      const token = randomToken(12, CAPTCHA_CHARSET) as string
      expect(token).toHaveLength(12)
      expect([...token].every((c) => CAPTCHA_CHARSET.includes(c))).toBe(true)
      expect(randomDigits(6)).toMatch(/^\d{6}$/)
    }
    expect(randomId()).toMatch(/^\d{13}-[0-9a-z]{6}$/)
  })
})

describe('验证码与邮箱码使用安全随机', () => {
  it('图片验证码字符全部落在 CAPTCHA_CHARSET 且长度为 4', async () => {
    for (let i = 0; i < 30; i++) {
      const request = new Request('https://www.seatmark.cn/api/auth/captcha', { method: 'GET' })
      const response: Response = await onRequest({ request, env: ENV })
      expect(response.status).toBe(200)
      const data = (await response.json()) as { image: string }
      const svg = Buffer.from(data.image.replace(/^data:image\/svg\+xml;base64,/, ''), 'base64').toString(
        'utf-8',
      )
      const answer = [...svg.matchAll(/<text [^>]*>([^<])<\/text>/g)].map((m) => m[1]).join('')
      expect(answer).toHaveLength(CAPTCHA_LENGTH)
      expect([...answer].every((c) => CAPTCHA_CHARSET.includes(c))).toBe(true)
    }
  })

  it('兑换码 SM-XXXX-XXXX-XXXX 格式正确、字符全落在无歧义字母表且分布无明显偏差', async () => {
    const env = { ...ENV, ADMIN_EMAILS: 'redeem-admin@example.com' }
    const post = (path: string, body: unknown, cookie = '') =>
      onRequest({
        request: new Request(`http://localhost:5173${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
          body: JSON.stringify(body),
        }),
        env,
      }) as Promise<Response>
    const codeRes = await post('/api/auth/code', { email: 'redeem-admin@example.com' })
    const { devCode } = (await codeRes.json()) as { devCode: string }
    const verifyRes = await post('/api/auth/verify', { email: 'redeem-admin@example.com', code: devCode })
    const cookie = (verifyRes.headers.get('Set-Cookie') || '').split(';')[0]!

    const counts = new Map<string, number>()
    let total = 0
    for (let round = 0; round < 3; round++) {
      const res = await post('/api/admin/codes', { days: 30, count: 200 }, cookie)
      expect(res.status).toBe(200)
      const { codes } = (await res.json()) as { codes: string[] }
      expect(codes).toHaveLength(200)
      for (const code of codes) {
        expect(code).toMatch(/^SM-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/)
        for (const c of code.slice(3).replaceAll('-', '')) {
          counts.set(c, (counts.get(c) ?? 0) + 1)
          total++
        }
      }
    }
    // 7200 次采样、31 个字符：每个字符期望 ≈232 次（σ≈15），全部出现且落在 ±35%（>5σ）内；
    // 这是防退化的分布健全性检查（±11% 的模偏差需更大样本才能统计判别，无偏性由 randomInt 拒绝采样保证）
    expect(counts.size).toBe(CAPTCHA_CHARSET.length)
    const expected = total / CAPTCHA_CHARSET.length
    for (const c of CAPTCHA_CHARSET) {
      const n = counts.get(c) ?? 0
      expect(n).toBeGreaterThan(expected * 0.65)
      expect(n).toBeLessThan(expected * 1.35)
    }
  })

  it('memory 存储下未配 AUTH_SECRET 仍可签发会话（开发默认密钥）', async () => {
    const request = new Request('http://localhost:5173/api/auth/code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rand-dev@example.com' }),
    })
    const response: Response = await onRequest({ request, env: ENV })
    expect(response.status).toBe(200)
    const data = (await response.json()) as { devCode?: string }
    expect(data.devCode).toMatch(/^\d{6}$/)
  })
})
