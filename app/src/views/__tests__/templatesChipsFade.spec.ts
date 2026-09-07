// @vitest-environment jsdom
/**
 * 第 352 轮：模板库 <640px 分类 chips 右侧白色渐隐遮罩——初始可见提示可横滑；
 * 滚到末尾隐藏、滚回恢复；内容未溢出时隐藏；≥640px（无 chips 行）不渲染。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import TemplatesView from '@/views/TemplatesView.vue'

const CHIPS = '[data-testid="templates-category-chips"]'
const FADE = '[data-testid="templates-chips-fade"]'

/** v-show 通过 inline display:none 隐藏（jsdom 下不依赖 isVisible 的布局计算） */
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

/** jsdom 无布局：手动给 chips 容器塞尺寸（scrollWidth / clientWidth / scrollLeft） */
function fakeScrollMetrics(el: HTMLElement, metrics: { scrollWidth: number; clientWidth: number; scrollLeft: number }) {
  Object.defineProperty(el, 'scrollWidth', { value: metrics.scrollWidth, configurable: true })
  Object.defineProperty(el, 'clientWidth', { value: metrics.clientWidth, configurable: true })
  Object.defineProperty(el, 'scrollLeft', { value: metrics.scrollLeft, configurable: true, writable: true })
}

describe('第 352 轮：TemplatesView 分类 chips 渐隐遮罩', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  it('<640px：遮罩初始可见，位于 chips 的 relative 容器右侧且 pointer-events-none；chips 尺寸/snap 类不变', async () => {
    stubViewport(true)
    const wrapper = await mountView()
    const chips = wrapper.get(CHIPS)
    const fade = wrapper.get(FADE)
    expect(fadeShown(wrapper)).toBe(true)
    expect(fade.classes()).toEqual(
      expect.arrayContaining(['pointer-events-none', 'absolute', 'right-0', 'w-8', 'bg-gradient-to-l', 'from-white']),
    )
    expect(fade.element.parentElement).toBe(chips.element.parentElement)
    expect(fade.element.parentElement!.classList.contains('relative')).toBe(true)
    expect(chips.classes()).toEqual(expect.arrayContaining(['overflow-x-auto', 'snap-x', 'snap-mandatory', 'scrollbar-none']))
    for (const chip of chips.findAll('button')) {
      expect(chip.classes()).toContain('shrink-0')
      expect(chip.classes()).toContain('snap-start')
    }
    wrapper.unmount()
  })

  it('滚到末尾后遮罩隐藏，滚回时恢复；内容未溢出时也隐藏', async () => {
    stubViewport(true)
    const wrapper = await mountView()
    const chips = wrapper.get(CHIPS)
    const el = chips.element as HTMLElement

    fakeScrollMetrics(el, { scrollWidth: 600, clientWidth: 300, scrollLeft: 0 })
    await chips.trigger('scroll')
    expect(fadeShown(wrapper)).toBe(true)

    el.scrollLeft = 300
    await chips.trigger('scroll')
    expect(fadeShown(wrapper)).toBe(false)

    el.scrollLeft = 120
    await chips.trigger('scroll')
    expect(fadeShown(wrapper)).toBe(true)

    fakeScrollMetrics(el, { scrollWidth: 300, clientWidth: 300, scrollLeft: 0 })
    await chips.trigger('scroll')
    expect(fadeShown(wrapper)).toBe(false)
    wrapper.unmount()
  })

  it('≥640px：无 chips 横滑行，也不渲染遮罩', async () => {
    stubViewport(false)
    const wrapper = await mountView()
    expect(wrapper.find(CHIPS).exists()).toBe(false)
    expect(wrapper.find(FADE).exists()).toBe(false)
    wrapper.unmount()
  })
})
