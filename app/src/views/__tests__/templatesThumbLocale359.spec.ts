// @vitest-environment jsdom
/**
 * 第 359 轮：TemplateThumb 缩略图按 locale 本地化——en 下固定文案（座位号 SEAT→SEAT NO.）不再外泄中文，
 * 仍含中文示例值的缩略图外层标 lang="zh"；zh 下渲染原模板且不带 lang。
 * 覆盖模板库橱窗与 Studio 模板选择器两处调用方（同一组件）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import TemplateThumb from '@/components/label/TemplateThumb.vue'
import { defaultTemplates } from '@/data/defaultTemplates'
import { setLocale } from '@/i18n'
import TemplatesView from '@/views/TemplatesView.vue'

const CJK = /[\u4e00-\u9fff]/
const THUMB = '[data-testid="template-thumb-card"]'
const ROOT = 'div.w-full.border'

const standard = defaultTemplates.find((t) => t.id === 'standard')!
const zhSample = defaultTemplates.find((t) => t.id === 'courseSchedule')!

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

async function mountView(path: string) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/templates', component: TemplatesView },
      { path: '/en/templates', component: TemplatesView },
      { path: '/:rest(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(TemplatesView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('第 359 轮：TemplateThumb en 本地化 + lang="zh" 标注', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  })
  afterEach(async () => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
    await setLocale('zh')
  })

  it('en：固定文案英文化且不含中文；示例值全英文的模板不带 lang', async () => {
    await setLocale('en')
    const wrapper = mount(TemplateThumb, { props: { template: standard } })
    await flushPromises()
    const card = wrapper.get(THUMB)
    expect(card.text()).toContain('SEAT NO.')
    expect(card.text()).not.toMatch(CJK)
    expect(wrapper.get(ROOT).attributes('lang')).toBeUndefined()
  })

  it('en：本地化后仍含中文示例值的模板：固定文案已英文化，外层带 lang="zh"', async () => {
    await setLocale('en')
    const wrapper = mount(TemplateThumb, { props: { template: zhSample } })
    await flushPromises()
    expect(wrapper.get(ROOT).attributes('lang')).toBe('zh')
    for (const f of zhSample.fields) if (f.fixedText) expect(wrapper.text()).not.toContain(f.fixedText)
  })

  it('zh：渲染原模板固定文案（座位号 SEAT），不设置 lang', async () => {
    const wrapper = mount(TemplateThumb, { props: { template: standard } })
    await flushPromises()
    expect(wrapper.get(THUMB).text()).toContain('座位号 SEAT')
    expect(wrapper.get(ROOT).attributes('lang')).toBeUndefined()
  })

  it('模板库 /en/templates：首屏缩略图固定文案不含中文，/templates 保持中文', async () => {
    await setLocale('en')
    const en = await mountView('/en/templates')
    const enCards = en.findAll(THUMB)
    expect(enCards.length).toBeGreaterThan(0)
    for (const card of enCards) {
      const fixedNodes = card.findAll('.label-field__content')
      // 只断言固定文案：示例值允许中文但必须在 lang="zh" 内
      for (const n of fixedNodes) {
        if (CJK.test(n.text())) expect(n.element.closest('[lang="zh"]')).not.toBeNull()
      }
    }
    en.unmount()
    await setLocale('zh')
    const zh = await mountView('/templates')
    expect(zh.text()).toContain('座位号 SEAT')
    expect(zh.findAll('[lang="zh"]').length).toBe(0)
  })
})
