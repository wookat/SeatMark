// @vitest-environment jsdom
/**
 * 第 346 轮：定价卡原价与现价视觉分层——原价「原价 ¥19/月 · 限时 0 折」独立一行位于现价下方，
 * 免费版无原价时保留同高占位；价格数值（¥0 / ¥19 / ¥49）不变。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import { setLocale } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import PricingView from '@/views/PricingView.vue'

const stubs = { RouterLink: RouterLinkStub, Teleport: true, Transition: true }
const CJK = /[\u4e00-\u9fff]/

function mountPricing() {
  const auth = useAuthStore()
  auth.ready = false
  return mount(PricingView, { global: { stubs } })
}

describe('第 346 轮：PricingView 原价独立一行', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 404 }))
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await setLocale('zh')
  })

  it('zh：三卡各有价格行 + 原价行；专业版/团队版原价与现价不在同一 DOM 行且文案含「原价」', () => {
    const wrapper = mountPricing()
    const priceRows = wrapper.findAll('[data-testid="plan-price"]')
    const originalRows = wrapper.findAll('[data-testid="plan-original-price"]')
    expect(priceRows).toHaveLength(3)
    expect(originalRows).toHaveLength(3)

    // 现价行只含 ¥0 + 单位（+ 试用徽标），不再含原价
    for (const row of priceRows) {
      expect(row.text()).toContain('¥0')
      expect(row.text()).not.toContain('¥19')
      expect(row.text()).not.toContain('¥49')
      expect(row.find('s, .line-through').exists()).toBe(false)
    }

    // 原价行：免费版为空占位（保高对齐），专业版 ¥19、团队版 ¥49 且数字带删除线
    expect(originalRows[0]!.text()).toBe('')
    expect(originalRows[0]!.attributes('aria-hidden')).toBe('true')
    expect(originalRows[0]!.classes()).toContain('min-h-4')
    expect(originalRows[1]!.text()).toContain('原价')
    expect(originalRows[1]!.text()).toContain('限时 0 折')
    expect(originalRows[1]!.find('s').text()).toBe('¥19')
    expect(originalRows[2]!.find('s').text()).toBe('¥49')
    expect(originalRows[1]!.attributes('aria-hidden')).toBeUndefined()

    // 原价行紧跟现价行之后，是独立兄弟元素而非同一行内
    for (let i = 0; i < 3; i++) {
      expect(priceRows[i]!.element.nextElementSibling).toBe(originalRows[i]!.element)
      expect(originalRows[i]!.element.contains(priceRows[i]!.element)).toBe(false)
    }
    wrapper.unmount()
  })

  it('三卡价格行对齐：卡片顶部内距不随徽标变化，标语在 md 起预留两行等高', () => {
    const wrapper = mountPricing()
    const priceRows = wrapper.findAll('[data-testid="plan-price"]')
    expect(priceRows).toHaveLength(3)
    for (const row of priceRows) {
      const card = row.element.parentElement!
      expect(card.className).toContain('pt-7')
      const tagline = card.querySelector('h2 + p')!
      expect(tagline.className).toContain('md:min-h-8')
    }
    wrapper.unmount()
  })

  it('en：原价行为「Original price CNY 19/mo · Limited-time free」，现价 CNY 0，无 CJK；中文仍为 ¥', async () => {
    await setLocale('en')
    const wrapper = mountPricing()
    const originalRows = wrapper.findAll('[data-testid="plan-original-price"]')
    const pro = originalRows[1]!.text().replace(/\s+/g, ' ')
    expect(pro).toBe('Original price CNY 19/mo · Limited-time free')
    expect(originalRows[2]!.text().replace(/\s+/g, ' ')).toBe('Original price CNY 49/mo · Limited-time free')
    expect(pro).not.toMatch(CJK)
    expect(pro).not.toContain('¥')
    for (const row of wrapper.findAll('[data-testid="plan-price"]')) {
      expect(row.text().replace(/\s+/g, ' ')).toContain('CNY 0/mo')
    }
    wrapper.unmount()
  })

  it('第 363 轮：md 档两列 + 第三卡跨两列居中同宽；服务不可用时每张卡维护提示至多 1 处且不在 features 中重复', () => {
    const auth = useAuthStore()
    auth.ready = false
    auth.serviceUnavailable = true
    const wrapper = mount(PricingView, { global: { stubs } })

    const cards = wrapper.findAll('[data-testid="pricing-plan-card"]')
    expect(cards).toHaveLength(3)
    const grid = cards[0]!.element.parentElement!
    expect(grid.className).toContain('md:grid-cols-2')
    expect(grid.className).toContain('lg:grid-cols-3')
    expect(grid.className).not.toContain('md:grid-cols-3')
    expect(cards[2]!.classes()).toEqual(
      expect.arrayContaining(['md:col-span-2', 'lg:col-span-1', 'md:mx-auto', 'md:w-[calc(50%-0.625rem)]']),
    )
    expect(cards[0]!.classes()).not.toContain('md:col-span-2')

    for (const card of cards) {
      const hints = card.findAll('[data-testid="pricing-maintenance-hint"]')
      expect(hints.length).toBeLessThanOrEqual(1)
      const bullets = card.findAll('li').map((li) => li.text())
      expect(bullets.some((b) => b.includes('账号服务维护中'))).toBe(false)
      const occurrences = card.text().split('账号服务维护中').length - 1
      expect(occurrences).toBeLessThanOrEqual(1)
    }
    const proHints = cards[1]!.findAll('[data-testid="pricing-maintenance-hint"]')
    expect(proHints).toHaveLength(1)
    expect(proHints[0]!.text()).toBe('账号服务维护中，带水印导出不限次；恢复后可领取')
    wrapper.unmount()
  })

  it('第 347 轮：底部 CTA 英文行内链接前后有空格，中文无空格', async () => {
    const zh = mountPricing()
    const zhText = zh.findAll('p').map((p) => p.text()).find((s) => s.includes('还不确定'))
    expect(zhText).toBe('还不确定？先看看教程中心或模板库')
    zh.unmount()

    await setLocale('en')
    const en = mountPricing()
    const enText = en.findAll('p').map((p) => p.text()).find((s) => s.includes('Not sure yet'))
    expect(enText).toBe('Not sure yet? Take a look at the Guide center or Template library')
    en.unmount()
  })
})
