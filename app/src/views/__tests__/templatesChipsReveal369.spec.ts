// @vitest-environment jsdom
/**
 * 第 369 轮：模板库窄屏分类 chips——当前分类保持可见（深链 ?cat= / 切换分类后 scrollIntoView）+ 左侧对称渐隐（scrollLeft > 0 时显示）。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setLocale } from '@/i18n'
import TemplatesView from '@/views/TemplatesView.vue'

const CHIPS = '[data-testid="templates-category-chips"]'
const FADE_RIGHT = '[data-testid="templates-chips-fade"]'
const FADE_LEFT = '[data-testid="templates-chips-fade-left"]'
const BACK = '[data-testid="templates-chips-back"]'

const shown = (wrapper: ReturnType<typeof mount>, sel: string) =>
  !(wrapper.get(sel).attributes('style') ?? '').includes('display: none')

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

describe('第 369 轮：TemplatesView 分类 chips 当前分类可见 + 左渐隐', () => {
  const scrollIntoView = vi.fn()

  afterEach(async () => {
    vi.unstubAllGlobals()
    scrollIntoView.mockReset()
    sessionStorage.clear()
    await setLocale('zh')
  })

  it('深链 ?cat=life 进入：挂载后对选中 chip 调 scrollIntoView({ inline: nearest, block: nearest })，不动页面纵向', async () => {
    stubViewport(true)
    Element.prototype.scrollIntoView = scrollIntoView
    const wrapper = await mountView('/templates?cat=life')
    const active = wrapper.get(`${CHIPS} [aria-selected="true"]`)
    expect(active.text()).toContain('生活办公')
    expect(scrollIntoView).toHaveBeenCalled()
    const call = scrollIntoView.mock.calls.at(-1)!
    expect(call[0]).toEqual({ inline: 'nearest', block: 'nearest' })
    expect(scrollIntoView.mock.instances.at(-1)).toBe(active.element)
    wrapper.unmount()
  })

  it('切换分类后再次把新选中 chip 滚入视区', async () => {
    stubViewport(true)
    Element.prototype.scrollIntoView = scrollIntoView
    const wrapper = await mountView()
    scrollIntoView.mockClear()
    const wedding = wrapper.findAll(`${CHIPS} button`).find((b) => b.text().includes('婚庆喜宴'))!
    await wedding.trigger('click')
    await flushPromises()
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.instances[0]).toBe(wedding.element)
    expect(wedding.attributes('aria-selected')).toBe('true')
    wrapper.unmount()
  })

  it('左渐隐：scrollLeft=0 隐藏，>0 显示且带「‹」按钮（点击按 clientWidth×0.6 反向滚动）；右渐隐行为不变', async () => {
    stubViewport(true)
    const wrapper = await mountView()
    const chips = wrapper.get(CHIPS)
    const el = chips.element as HTMLElement
    fakeScrollMetrics(el, { scrollWidth: 600, clientWidth: 300, scrollLeft: 0 })
    await chips.trigger('scroll')
    expect(shown(wrapper, FADE_LEFT)).toBe(false)
    expect(shown(wrapper, FADE_RIGHT)).toBe(true)

    el.scrollLeft = 120
    await chips.trigger('scroll')
    expect(shown(wrapper, FADE_LEFT)).toBe(true)
    expect(shown(wrapper, FADE_RIGHT)).toBe(true)
    const left = wrapper.get(FADE_LEFT)
    expect(left.classes()).toEqual(
      expect.arrayContaining(['pointer-events-none', 'absolute', 'left-0', 'w-10', 'bg-gradient-to-r', 'from-white']),
    )
    expect(left.element.parentElement).toBe(chips.element.parentElement)
    const back = wrapper.get(BACK)
    expect(back.attributes('aria-label')).toBe('查看前面的分类')
    expect(back.classes()).toContain('pointer-events-auto')
    const scrollBy = vi.fn()
    el.scrollBy = scrollBy as unknown as HTMLElement['scrollBy']
    await back.trigger('click')
    expect(scrollBy).toHaveBeenCalledWith({ left: -180, behavior: 'smooth' })

    el.scrollLeft = 300
    await chips.trigger('scroll')
    expect(shown(wrapper, FADE_LEFT)).toBe(true)
    expect(shown(wrapper, FADE_RIGHT)).toBe(false)

    fakeScrollMetrics(el, { scrollWidth: 300, clientWidth: 300, scrollLeft: 0 })
    await chips.trigger('scroll')
    expect(shown(wrapper, FADE_LEFT)).toBe(false)
    expect(shown(wrapper, FADE_RIGHT)).toBe(false)
    wrapper.unmount()
  })

  it('/en：左渐隐按钮 aria-label 为英文', async () => {
    stubViewport(true)
    await setLocale('en')
    const wrapper = await mountView('/en/templates')
    expect(wrapper.get(BACK).attributes('aria-label')).toBe('See previous categories')
    wrapper.unmount()
  })

  it('≥640px：不渲染左渐隐（桌面布局不变）', async () => {
    stubViewport(false)
    const wrapper = await mountView()
    expect(wrapper.find(FADE_LEFT).exists()).toBe(false)
    expect(wrapper.find(BACK).exists()).toBe(false)
    wrapper.unmount()
  })
})
