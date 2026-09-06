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

  it('GuidesView en：空态文案与重置按钮为英文', async () => {
    const wrapper = await mountView(VIEWS[0], 'en')
    await wrapper.find('input[type="search"]').setValue('zzzz-no-such-guide')
    expect(wrapper.text()).toContain('No guides match these filters')
    expect(wrapper.text()).toContain('Reset filters')
    wrapper.unmount()
  })
})
