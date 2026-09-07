// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import GuidesView from '@/views/GuidesView.vue'
import PapersView from '@/views/PapersView.vue'
import TemplatesView from '@/views/TemplatesView.vue'
import VsIndexView from '@/views/VsIndexView.vue'
import { setLocale } from '@/i18n'

const CJK = /[\u4e00-\u9fff]/

const NOTICE_TEXT =
  'This section is currently available in Chinese only. The Studio, Seating Chart, Banquet planner and Pricing pages are fully in English.'

const VIEWS = [
  { name: 'GuidesView', component: GuidesView, path: '/guides' },
  { name: 'TemplatesView', component: TemplatesView, path: '/templates' },
  { name: 'PapersView', component: PapersView, path: '/papers' },
  { name: 'VsIndexView', component: VsIndexView, path: '/vs' },
] as const

async function mountView(view: (typeof VIEWS)[number], locale: 'zh' | 'en') {
  const path = locale === 'en' ? `/en${view.path}` : view.path
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: view.path, component: view.component },
      { path: `/en${view.path}`, component: view.component },
      { path: '/:rest(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  await setLocale(locale)
  return mount(view.component, {
    global: {
      plugins: [router],
      stubs: { TemplateThumb: true },
    },
  })
}

function normalizeSpace(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/** 含汉字的文本节点数（注释、空白不计） */
function cjkTextNodes(root: Element): string[] {
  const out: string[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const s = n.textContent ?? ''
    if (CJK.test(s)) out.push(s.trim())
  }
  return out
}

/** 第 350 轮：列表区已收敛为英文壳的三页 */
const SHELL_VIEWS = VIEWS.filter((v) => v.name !== 'TemplatesView')

afterEach(async () => {
  await setLocale('zh')
})

describe('/en 内容站索引页外壳', () => {
  for (const view of VIEWS) {
    it(`${view.name}：en 下渲染 ZhOnlyNotice，h1 与筛选器无中文`, async () => {
      const wrapper = await mountView(view, 'en')
      const notice = wrapper.find('[data-testid="zh-only-notice"]')
      expect(notice.exists()).toBe(true)
      expect(normalizeSpace(notice.text())).toContain(NOTICE_TEXT)
      const links = notice.findAll('a').map((a) => a.attributes('href'))
      expect(links).toContain('/en/studio')
      expect(links).toContain('/en')
      expect(notice.find('[data-testid="zh-only-notice-zh-link"]').attributes('href')).toBe(
        view.path,
      )

      expect(wrapper.find('h1').text()).not.toMatch(CJK)
      for (const btn of wrapper.findAll('button')) {
        expect(btn.text()).not.toMatch(CJK)
      }
      for (const input of wrapper.findAll('input[type="search"]')) {
        expect(input.attributes('placeholder') ?? '').not.toMatch(CJK)
      }
      wrapper.unmount()
    })

    it(`${view.name}：zh 下不渲染提示条，h1 保持中文`, async () => {
      const wrapper = await mountView(view, 'zh')
      expect(wrapper.find('[data-testid="zh-only-notice"]').exists()).toBe(false)
      expect(wrapper.find('h1').text()).toMatch(CJK)
      wrapper.unmount()
    })
  }

  it('GuidesView zh：空态文案与重置按钮仍在（中文页零改动）', async () => {
    const wrapper = await mountView(VIEWS[0], 'zh')
    await wrapper.find('input[type="search"]').setValue('zzzz-no-such-guide')
    expect(wrapper.text()).toContain('该条件下暂无教程')
    expect(wrapper.text()).toContain('清除筛选')
    wrapper.unmount()
  })
})

describe('第 350 轮：/en/guides /en/vs /en/papers 不再整列渲染中文卡片', () => {
  for (const view of SHELL_VIEWS) {
    it(`${view.name}：en 下中文文本节点 ≤3，含 Browse in Chinese 主按钮与 ≤3 条英文精选入口`, async () => {
      const wrapper = await mountView(view, 'en')
      const cjk = cjkTextNodes(wrapper.element)
      expect(cjk.length, `CJK nodes: ${JSON.stringify(cjk)}`).toBeLessThanOrEqual(3)

      const shell = wrapper.find('[data-testid="en-index-shell"]')
      expect(shell.exists()).toBe(true)
      expect(shell.attributes('lang')).toBe('en')
      expect(shell.text()).not.toMatch(CJK)
      const browse = shell.find('[data-testid="en-index-browse-zh"]')
      expect(browse.text().trim()).toBe('Browse in Chinese')
      expect(browse.classes()).toContain('btn-primary')
      expect(browse.attributes('href')).toBe(view.path)

      const featured = shell.findAll('[data-testid="en-index-featured"] a')
      expect(featured.length).toBeGreaterThan(0)
      expect(featured.length).toBeLessThanOrEqual(3)
      for (const a of featured) {
        expect(a.text()).not.toMatch(CJK)
        expect(a.attributes('href')).toMatch(new RegExp(`^${view.path}/[a-z0-9-]+$`))
      }
      wrapper.unmount()
    })

    it(`${view.name}：zh 下不渲染英文壳，列表卡片照常渲染`, async () => {
      const wrapper = await mountView(view, 'zh')
      expect(wrapper.find('[data-testid="en-index-shell"]').exists()).toBe(false)
      const cards = wrapper.findAll(`a[href^="${view.path}/"]`)
      expect(cards.length).toBeGreaterThan(3)
      wrapper.unmount()
    })
  }
})
