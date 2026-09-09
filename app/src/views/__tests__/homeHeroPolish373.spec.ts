// @vitest-environment jsdom
/**
 * 第 373 轮 P3 视觉小包：
 *   - Hero A4 拼贴容器右缘加渐隐 mask（mask-r-from-85%），避免 EN 长名 mid-word 硬裁；移动端底部渐隐保留；
 *   - 常驻深色「A4 实际排版效果 · 24 枚/页」气泡改为小角标：默认只露「A4」，hover / focus 展开，aria-label 保留全文；
 *   - TemplateThumb 卡片四周留 3% 安全边（top-[3%] + 94% 缩放），高瘦模板不再贴底裁切。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import TemplateThumb from '@/components/label/TemplateThumb.vue'
import { defaultTemplates } from '@/data/defaultTemplates'
import { setLocale } from '@/i18n'
import { MM_TO_PX } from '@/utils/layout'
import HomeView from '@/views/HomeView.vue'

const io = class {
  observe() {}
  disconnect() {}
  unobserve() {}
}
let prevIO: typeof IntersectionObserver
let prevRO: typeof ResizeObserver
let prevMatchMedia: typeof window.matchMedia

beforeEach(() => {
  prevIO = globalThis.IntersectionObserver
  prevRO = globalThis.ResizeObserver
  prevMatchMedia = window.matchMedia
  globalThis.IntersectionObserver = io as unknown as typeof IntersectionObserver
  globalThis.ResizeObserver = io as unknown as typeof ResizeObserver
  window.matchMedia = (() => ({ matches: true, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
})

afterEach(async () => {
  globalThis.IntersectionObserver = prevIO
  globalThis.ResizeObserver = prevRO
  window.matchMedia = prevMatchMedia
  await setLocale('zh')
})

async function mountHome(path: '/' | '/en') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path, component: HomeView },
      { path: '/:rest(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  await setLocale(path === '/en' ? 'en' : 'zh')
  return mount(HomeView, {
    global: { plugins: [router], stubs: { TemplateThumb: true, LabelSheet: true } },
  })
}

describe('第 373 轮：Hero 拼贴右缘渐隐 + 尺寸角标收起', () => {
  it.each(['/', '/en'] as const)('%s：hero-sheet 带右缘与底部 mask，桌面端仅取消底部渐隐', async (path) => {
    const wrapper = await mountHome(path)
    const sheet = wrapper.get('[data-testid="hero-sheet"]')
    expect(sheet.classes()).toEqual(expect.arrayContaining(['overflow-hidden', 'mask-r-from-85%', 'mask-b-from-72%', 'sm:mask-b-from-100%']))
    expect(sheet.attributes('class')).not.toContain('[mask-image:')
    wrapper.unmount()
  })

  it.each([
    ['/', 'A4 实际排版效果 · 24 枚/页'],
    ['/en', 'Actual A4 layout · 24 labels per page'],
  ] as const)('%s：角标可聚焦、aria-label 为全文，可见常驻文本只有「A4」，全文在 hover/focus 展开层', async (path, full) => {
    const wrapper = await mountHome(path)
    const badge = wrapper.get('[data-testid="hero-sheet-badge"]')
    expect(badge.attributes('tabindex')).toBe('0')
    expect(badge.attributes('aria-label')).toBe(full)
    expect(badge.classes()).toContain('group')
    const [short, expanded] = badge.findAll(':scope > span')
    expect(short!.text()).toBe('A4')
    expect(expanded!.text()).toBe(full)
    expect(expanded!.classes()).toEqual(
      expect.arrayContaining(['max-w-0', 'overflow-hidden', 'opacity-0', 'group-hover:opacity-100', 'group-focus-visible:opacity-100']),
    )
    // 不再是常驻 <p> 气泡
    expect(wrapper.findAll('p').some((p) => p.text() === full)).toBe(false)
    wrapper.unmount()
  })
})

describe('第 373 轮：TemplateThumb 3% 安全边', () => {
  it('卡片仍为 aspect-ratio 容器的直接子元素（骨架结构不变），顶部留 3% 安全边、按 94% 尺寸缩放', async () => {
    const tall = defaultTemplates.find((t) => t.label.height / t.label.width > 1.6) ?? defaultTemplates[0]!
    let resizeCb: ResizeObserverCallback | null = null
    class FakeResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        resizeCb = cb
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    const prev = globalThis.ResizeObserver
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver
    try {
      const wrapper = mount(TemplateThumb, { props: { template: tall } })
      await wrapper.vm.$nextTick()
      const container = wrapper.get('[data-testid="template-thumb-container"]')
      expect(container.classes()).toEqual(expect.arrayContaining(['relative', 'overflow-hidden']))
      expect(container.attributes('style')).toContain(`aspect-ratio: ${tall.label.width} / ${tall.label.height}`)
      const card = wrapper.get('[data-testid="template-thumb-card"]')
      expect(card.element.parentElement).toBe(container.element)
      expect(card.classes()).toEqual(expect.arrayContaining(['absolute', 'top-[3%]', 'left-1/2', 'origin-top']))

      // 容器宽 200px：无安全边时 scale = 200 / (width mm × MM_TO_PX)，有安全边后为其 94%
      const naturalWidth = tall.label.width * MM_TO_PX
      const naturalHeight = tall.label.height * MM_TO_PX
      const containerWidth = 200
      const containerHeight = (containerWidth * tall.label.height) / tall.label.width
      resizeCb!(
        [{ contentRect: { width: containerWidth, height: containerHeight } } as ResizeObserverEntry],
        {} as ResizeObserver,
      )
      await wrapper.vm.$nextTick()
      const expected = Math.min((containerWidth * 0.94) / naturalWidth, (containerHeight * 0.94) / naturalHeight)
      const style = card.attributes('style') ?? ''
      const match = /scale\(([\d.]+)\)/.exec(style)
      expect(match).not.toBeNull()
      expect(Number(match![1])).toBeCloseTo(expected, 5)
      expect(style).not.toContain('visibility: hidden')
      wrapper.unmount()
    } finally {
      globalThis.ResizeObserver = prev
    }
  })
})
