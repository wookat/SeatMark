import { describe, expect, it } from 'vitest'

import { resolveSeo } from '@/data/seo'

/**
 * /pricing 静态 SEO 口径中性化：
 * title/description 不再承诺「注册送 7 天」（账号服务维护期该承诺可能不成立，运行时由 PricingView 降级），
 * 但 JSON-LD offers 三档价格口径不变（限时 0 折 → price 0，原价 ¥19/¥49 写在描述里）。
 */

interface Offer {
  '@type': string
  name: string
  price: string
  priceCurrency: string
  description: string
}

const zh = await resolveSeo('/pricing')
const en = await resolveSeo('/en/pricing')

const BANNED = ['注册送', '注册即送', '7 天', '7天', 'trial on sign-up', 'Trial on Sign-up', '7-day', '7-Day']

describe('/pricing 静态 SEO 不含注册赠送承诺', () => {
  it('中文 title/description 不含「注册送 / 7 天」', () => {
    for (const word of BANNED) {
      expect(zh.title, `zh title 含「${word}」`).not.toContain(word)
      expect(zh.description, `zh description 含「${word}」`).not.toContain(word)
    }
  })

  it('英文 title/description 不含 trial on sign-up / 7-day', () => {
    for (const word of BANNED) {
      expect(en.title, `en title 含「${word}」`).not.toContain(word)
      expect(en.description, `en description 含「${word}」`).not.toContain(word)
    }
  })

  it('中文 title/description 保留定价核心口径', () => {
    expect(zh.title).toContain('限时 0 折免费')
    expect(zh.description).toContain('¥19')
    expect(zh.description).toContain('¥49')
    expect(en.description).toContain('¥19')
    expect(en.description).toContain('¥49')
  })

  it('JSON-LD offers 三档口径不变：price 0/0/0，原价 ¥19/¥49 仍在描述', () => {
    const app = zh.jsonLd?.find((j) => Array.isArray((j as { offers?: unknown }).offers)) as
      | { offers: Offer[] }
      | undefined
    expect(app).toBeDefined()
    const offers = app!.offers
    expect(offers).toHaveLength(3)
    expect(offers.map((o) => o.price)).toEqual(['0', '0', '0'])
    expect(offers[0]!.name).toBe('免费版')
    expect(offers[1]!.description).toContain('原价 ¥19/月')
    expect(offers[2]!.description).toContain('原价 ¥49/月')
    for (const o of offers) expect(o.priceCurrency).toBe('CNY')
  })
})
