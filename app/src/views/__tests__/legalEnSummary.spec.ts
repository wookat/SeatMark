// @vitest-environment jsdom
/**
 * 第 349 轮：/en/terms、/en/privacy 不再静默跳中文，而是渲染英文摘要页——
 * 含精确免责声明 "The Chinese version is the legally binding text" 与中文全文链接；
 * 预渲染清单与 hreflang 覆盖两页，中文页保持原文不受影响。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'

import { isSitemapEligible, prerenderPaths, resolveSeo } from '@/data/seo'
import { setLocale } from '@/i18n'
import PrivacyView from '@/views/PrivacyView.vue'
import TermsView from '@/views/TermsView.vue'

const stubs = { RouterLink: RouterLinkStub }
const CJK = /[\u4e00-\u9fff]/
const DISCLAIMER = 'The Chinese version is the legally binding text'

const PAGES = [
  { name: 'TermsView', component: TermsView, zhPath: '/terms', zhTitle: '用户协议' },
  { name: 'PrivacyView', component: PrivacyView, zhPath: '/privacy', zhTitle: '隐私政策' },
] as const

afterEach(async () => {
  await setLocale('zh')
})

describe('第 349 轮：法务页 en 英文摘要', () => {
  for (const page of PAGES) {
    it(`${page.name}：en 下渲染英文摘要、免责声明与中文全文链接`, async () => {
      await setLocale('en')
      const wrapper = mount(page.component, { global: { stubs } })
      const summary = wrapper.find('[data-testid="legal-en-summary"]')
      expect(summary.exists()).toBe(true)
      expect(summary.attributes('lang')).toBe('en')
      expect(wrapper.find('h1').text()).not.toMatch(CJK)
      expect(wrapper.find('h1').text()).toContain('English Summary')

      expect(wrapper.find('[data-testid="legal-en-disclaimer"]').text()).toContain(DISCLAIMER)
      const zhLink = wrapper.findComponent<typeof RouterLinkStub>('[data-testid="legal-zh-full-link"]')
      expect(zhLink.exists()).toBe(true)
      expect(zhLink.props('to')).toBe(page.zhPath)

      // 3-5 个要点标题，均为英文
      const headings = summary.findAll('h2').map((h) => h.text())
      expect(headings.length).toBeGreaterThanOrEqual(3)
      expect(headings.length).toBeLessThanOrEqual(5)
      for (const h of headings) expect(h).not.toMatch(CJK)
      wrapper.unmount()
    })

    it(`${page.name}：zh 下保持中文全文，不渲染英文摘要壳`, async () => {
      await setLocale('zh')
      const wrapper = mount(page.component, { global: { stubs } })
      expect(wrapper.find('[data-testid="legal-en-summary"]').exists()).toBe(false)
      expect(wrapper.find('h1').text()).toBe(page.zhTitle)
      expect(wrapper.text()).not.toContain(DISCLAIMER)
      wrapper.unmount()
    })

    it(`/en${page.zhPath}：进入预渲染清单、可索引且中英互挂 hreflang`, async () => {
      const enPath = `/en${page.zhPath}`
      expect(await prerenderPaths()).toContain(enPath)
      const seo = await resolveSeo(enPath)
      expect(seo.lang).toBe('en')
      expect(seo.path).toBe(enPath)
      expect(seo.title).not.toMatch(CJK)
      expect(seo.description).toContain(DISCLAIMER)
      expect(isSitemapEligible(seo)).toBe(true)
      expect(seo.alternates?.map((a) => [a.hreflang, a.path])).toEqual([
        ['zh-CN', page.zhPath],
        ['en', enPath],
        ['x-default', page.zhPath],
      ])
      const zhSeo = await resolveSeo(page.zhPath)
      expect(zhSeo.alternates?.find((a) => a.hreflang === 'en')?.path).toBe(enPath)
    })
  }
})
