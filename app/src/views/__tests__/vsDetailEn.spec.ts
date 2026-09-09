// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setLocale } from '@/i18n'
import VsDetailView from '@/views/VsDetailView.vue'
import VsIndexView from '@/views/VsIndexView.vue'

const CJK = /[\u4e00-\u9fff]/

function cjkTextNodes(root: Element): string[] {
  const out: string[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const s = n.textContent ?? ''
    if (CJK.test(s)) out.push(s.trim())
  }
  return out
}

async function mountAt(component: typeof VsDetailView | typeof VsIndexView, path: string, locale: 'zh' | 'en') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/vs', component: VsIndexView },
      { path: '/en/vs', component: VsIndexView },
      { path: '/vs/:slug', component: VsDetailView },
      { path: '/en/vs/:slug', component: VsDetailView },
      { path: '/:rest(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  await setLocale(locale)
  const wrapper = mount(component, { global: { plugins: [router] } })
  return { wrapper, router }
}

afterEach(async () => {
  await setLocale('zh')
})

/** 第 372 轮：/en/vs/prismm-alternative 为独立英文正文页，chrome 走 t()，不渲染 ChineseOnlyNotice */
describe('VsDetailView 英文对比页', () => {
  it('en 下渲染英文 h1 与 chrome，无 ChineseOnlyNotice，无任何中文文本节点', async () => {
    const { wrapper } = await mountAt(VsDetailView, '/en/vs/prismm-alternative', 'en')
    expect(wrapper.find('[data-testid="chinese-only-notice"]').exists()).toBe(false)
    expect(wrapper.find('h1').text()).toMatch(/^Prismm \(Allseated\) alternative/)
    expect(wrapper.find('nav').attributes('aria-label')).toBe('Breadcrumb')
    const h2s = wrapper.findAll('h2').map((h) => h.text())
    expect(h2s).toContain('Where Prismm (formerly Allseated) is stronger')
    expect(h2s).toContain('Feature-by-feature comparison')
    expect(h2s).toContain('FAQ')
    expect(wrapper.find('thead').text()).toContain('Dimension')
    expect(wrapper.find('thead').text()).toContain('SeatMark')
    expect(cjkTextNodes(wrapper.element)).toEqual([])
    expect(wrapper.find('[data-testid="vs-table-scroll"]').classes()).toContain('overflow-x-auto')
    // 面包屑与 CTA 指向 /en 路由
    const hrefs = wrapper.findAll('a').map((a) => a.attributes('href'))
    expect(hrefs).toContain('/en')
    expect(hrefs).toContain('/en/vs')
    expect(hrefs).toContain('/en/studio')
    expect(hrefs).toContain('/en/banquet')
    wrapper.unmount()
  })

  it('中文对比页 zh 下 chrome 文案不变', async () => {
    const { wrapper } = await mountAt(VsDetailView, '/vs/canva', 'zh')
    expect(wrapper.find('nav').attributes('aria-label')).toBe('面包屑')
    const h2s = wrapper.findAll('h2').map((h) => h.text())
    expect(h2s).toContain('Canva 可画 的长处')
    expect(h2s).toContain('逐项能力对照')
    expect(h2s).toContain('常见问答')
    expect(wrapper.text()).toContain('以上为我们 2026-08 的实际上手/公开页面调研结论')
    expect(wrapper.find('thead').text()).toContain('SeatMark 座签')
    wrapper.unmount()
  })

  it('从中文路径 /vs/prismm-alternative 进入时换到规范英文路径', async () => {
    const { wrapper, router } = await mountAt(VsDetailView, '/vs/prismm-alternative', 'zh')
    await router.isReady()
    await new Promise((r) => setTimeout(r, 0))
    expect(router.currentRoute.value.path).toBe('/en/vs/prismm-alternative')
    wrapper.unmount()
  })
})

describe('VsIndexView 语言分流', () => {
  it('/vs 中文索引只列中文页，不出现 Prismm', async () => {
    const { wrapper } = await mountAt(VsIndexView, '/vs', 'zh')
    const hrefs = wrapper.findAll('a').map((a) => a.attributes('href'))
    expect(hrefs).toContain('/vs/canva')
    expect(hrefs.some((h) => h?.includes('prismm'))).toBe(false)
    expect(wrapper.text()).not.toContain('Prismm')
    wrapper.unmount()
  })

  it('/en/vs 列出英文 Prismm 页，中文页带 Chinese 徽标', async () => {
    const { wrapper } = await mountAt(VsIndexView, '/en/vs', 'en')
    const enList = wrapper.find('[data-testid="vs-en-list"]')
    expect(enList.exists()).toBe(true)
    const enLinks = enList.findAll('a')
    expect(enLinks.map((a) => a.attributes('href'))).toEqual(['/en/vs/prismm-alternative'])
    expect(enList.find('[data-testid="lang-badge-zh"]').exists()).toBe(false)
    expect(cjkTextNodes(enList.element)).toEqual([])

    const featured = wrapper.findAll('[data-testid="en-index-featured"] a')
    expect(featured.length).toBe(3)
    for (const a of featured) expect(a.find('[data-testid="lang-badge-zh"]').text()).toBe('Chinese')
    wrapper.unmount()
  })
})
