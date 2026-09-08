// @vitest-environment jsdom
/**
 * 第 359 轮：模板库 <640px 分类 chips 渐隐区内加可点击「›」按钮——点击按 clientWidth×0.6 平滑滚动，
 * 滚到尽头随渐隐一起隐藏；chips 容器 role=tablist、chip 带 aria-pressed。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setLocale } from '@/i18n'
import TemplatesView from '@/views/TemplatesView.vue'

const CHIPS = '[data-testid="templates-category-chips"]'
const FADE = '[data-testid="templates-chips-fade"]'
const MORE = '[data-testid="templates-chips-more"]'

const fadeShown = (wrapper: ReturnType<typeof mount>) =>
  !(wrapper.get(FADE).attributes('style') ?? '').includes('display: none')

function stubViewport(narrow: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: narrow && query === '(max-width: 639px)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
}

async function mountView(path = '/templates') {
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
  const wrapper = mount(TemplatesView, {
    global: { plugins: [router], stubs: { TemplateThumb: true } },
  })
  await flushPromises()
  return wrapper
}

function fakeScrollMetrics(el: HTMLElement, metrics: { scrollWidth: number; clientWidth: number; scrollLeft: number }) {
  Object.defineProperty(el, 'scrollWidth', { value: metrics.scrollWidth, configurable: true })
  Object.defineProperty(el, 'clientWidth', { value: metrics.clientWidth, configurable: true })
  Object.defineProperty(el, 'scrollLeft', { value: metrics.scrollLeft, configurable: true, writable: true })
}

describe('第 359 轮：TemplatesView 分类 chips「›」更多按钮', () => {
  afterEach(async () => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
    await setLocale('zh')
  })

  it('chips 可滚动时渲染「›」按钮（pointer-events-auto、aria-label），点击按 clientWidth×0.6 平滑滚动', async () => {
    stubViewport(true)
    const wrapper = await mountView()
    const chips = wrapper.get(CHIPS)
    const el = chips.element as HTMLElement
    fakeScrollMetrics(el, { scrollWidth: 600, clientWidth: 300, scrollLeft: 0 })
    const scrollBy = vi.fn()
    el.scrollBy = scrollBy as unknown as HTMLElement['scrollBy']
    await chips.trigger('scroll')
    expect(fadeShown(wrapper)).toBe(true)

    const more = wrapper.get(MORE)
    expect(more.element.tagName).toBe('BUTTON')
    expect(more.classes()).toContain('pointer-events-auto')
    expect(more.attributes('aria-label')).toBe('查看更多分类')
    expect(wrapper.get(FADE).element.contains(more.element)).toBe(true)
    expect(wrapper.get(FADE).classes()).toContain('w-10')
    expect(wrapper.get(FADE).classes()).toContain('pointer-events-none')

    await more.trigger('click')
    expect(scrollBy).toHaveBeenCalledTimes(1)
    expect(scrollBy).toHaveBeenCalledWith({ left: 180, behavior: 'smooth' })
    wrapper.unmount()
  })

  it('滚到尽头后「›」随渐隐一起隐藏；滚回恢复', async () => {
    stubViewport(true)
    const wrapper = await mountView()
    const chips = wrapper.get(CHIPS)
    const el = chips.element as HTMLElement
    fakeScrollMetrics(el, { scrollWidth: 600, clientWidth: 300, scrollLeft: 300 })
    await chips.trigger('scroll')
    expect(fadeShown(wrapper)).toBe(false)
    expect(wrapper.get(MORE).isVisible()).toBe(false)

    el.scrollLeft = 0
    await chips.trigger('scroll')
    expect(fadeShown(wrapper)).toBe(true)
    wrapper.unmount()
  })

  it('chips 容器 role=tablist，当前分类 chip aria-pressed=true 其余 false；/en 下 aria-label 为英文', async () => {
    stubViewport(true)
    await setLocale('en')
    const wrapper = await mountView('/en/templates')
    const chips = wrapper.get(CHIPS)
    expect(chips.attributes('role')).toBe('tablist')
    expect(chips.attributes('aria-label')).toBe('Template categories')
    const tabs = chips.findAll('button[role="tab"]')
    expect(tabs.length).toBeGreaterThan(1)
    expect(tabs.filter((b) => b.attributes('aria-pressed') === 'true')).toHaveLength(1)
    expect(tabs.filter((b) => b.attributes('aria-pressed') === 'false')).toHaveLength(tabs.length - 1)
    expect(wrapper.get(MORE).attributes('aria-label')).toBe('See more categories')
    wrapper.unmount()
  })

  it('≥640px：不渲染「›」按钮（桌面端布局不变）', async () => {
    stubViewport(false)
    const wrapper = await mountView()
    expect(wrapper.find(MORE).exists()).toBe(false)
    wrapper.unmount()
  })
})
