// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setLocale } from '@/i18n'
import { guides } from '@/data/guides'
import BanquetView from '@/views/BanquetView.vue'
import GuideArticleView from '@/views/GuideArticleView.vue'
import SeatingView from '@/views/SeatingView.vue'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

type IOCallback = (entries: Array<{ isIntersecting: boolean }>) => void
/** 按被观察元素记录回调：页面上同时有预览区 / 名单输入区 / 下一步条三个观察者 */
const ioCallbacks = new Map<Element, IOCallback>()
/** 按被观察元素记录观察选项（rootMargin 等） */
const ioOptions = new Map<Element, IntersectionObserverInit | undefined>()
class IntersectionObserverStub {
  constructor(
    private readonly cb: IOCallback,
    private readonly options?: IntersectionObserverInit,
  ) {}
  observe(el: Element) {
    ioCallbacks.set(el, this.cb)
    ioOptions.set(el, this.options)
  }
  unobserve() {}
  disconnect() {}
}
function intersect(el: Element | undefined, isIntersecting: boolean) {
  if (!el) throw new Error('intersect: element not observed')
  ioCallbacks.get(el)?.([{ isIntersecting }])
}
/** 预览容器（胶囊的观察目标） */
function previewOf(wrapper: ReturnType<typeof mount>) {
  return wrapper.find('.overflow-auto').element
}

async function mountView(component: typeof BanquetView | typeof SeatingView) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/banquet', component: BanquetView },
      { path: '/seating', component: SeatingView },
      { path: '/studio', component: { template: '<div />' } },
    ],
  })
  const wrapper = mount(component, {
    global: { plugins: [router], stubs: { Teleport: true, Transition: true } },
    attachTo: document.body,
  })
  await wrapper.vm.$nextTick()
  return wrapper
}

beforeEach(async () => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)
  ioCallbacks.clear()
  ioOptions.clear()
  Element.prototype.scrollIntoView = vi.fn()
  localStorage.clear()
  setActivePinia(createPinia())
  await setLocale('zh')
})

describe('第 347 轮：/seating /banquet 移动端预览可达', () => {
  it('SeatingView：吸底跳转按钮仅 <md 渲染，随画布是否在视口切换文案并滚动到对应区块', async () => {
    const wrapper = await mountView(SeatingView)
    const jump = wrapper.find('[data-testid="mobile-preview-jump"]')
    expect(jump.exists()).toBe(true)
    expect(jump.classes()).toContain('md:hidden')
    expect(jump.classes()).toContain('fixed')
    expect(jump.text()).toBe('查看座位预览 ↓')
    expect(jump.attributes('data-state')).toBe('at-settings')

    const scroll = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>
    scroll.mockClear()
    await jump.trigger('click')
    expect(scroll).toHaveBeenCalledTimes(1)
    const previewEl = scroll.mock.instances[0] as HTMLElement
    expect(previewEl.className).toContain('overflow-auto')

    intersect(previewOf(wrapper), true)
    await wrapper.vm.$nextTick()
    expect(jump.text()).toBe('回到设置 ↑')
    expect(jump.attributes('data-state')).toBe('at-preview')
    scroll.mockClear()
    await jump.trigger('click')
    const settingsEl = scroll.mock.instances[0] as HTMLElement
    expect(settingsEl.textContent).toContain('基本信息')

    wrapper.unmount()
  })

  it('SeatingView：画布上方有触屏点选互换提示（<md），并提供「放大查看 / 适配屏宽」切换', async () => {
    const wrapper = await mountView(SeatingView)
    const hint = wrapper.find('[data-testid="touch-swap-hint"]')
    expect(hint.exists()).toBe(true)
    expect(hint.classes()).toContain('md:hidden')
    expect(hint.text()).toBe('触屏：先点一个座位再点另一个即可互换（拖拽仅支持鼠标）')

    const toggle = wrapper.find('[data-testid="canvas-fit-toggle"]')
    expect(toggle.exists()).toBe(true)
    expect(['放大查看', '适配屏宽']).toContain(toggle.text())
    const before = toggle.text()
    await toggle.trigger('click')
    expect(toggle.text()).not.toBe(before)
    wrapper.unmount()
  })

  it('BanquetView：吸底跳转按钮存在且英文文案正确', async () => {
    await setLocale('en')
    const wrapper = await mountView(BanquetView)
    const jump = wrapper.find('[data-testid="mobile-preview-jump"]')
    expect(jump.exists()).toBe(true)
    expect(jump.classes()).toContain('md:hidden')
    expect(jump.text()).toBe('View seating preview ↓')
    intersect(previewOf(wrapper), true)
    await wrapper.vm.$nextTick()
    expect(jump.text()).toBe('Back to settings ↑')
    wrapper.unmount()
  })
})

describe('第 349 轮：390 宽下浮动胶囊让位', () => {
  it('SeatingView：textarea 聚焦时胶囊隐藏（opacity-0 + aria-hidden），失焦后恢复', async () => {
    const wrapper = await mountView(SeatingView)
    const jump = wrapper.find('[data-testid="mobile-preview-jump"]')
    expect(jump.attributes('data-hidden')).toBe('false')
    expect(jump.classes()).toContain('opacity-100')

    const textarea = wrapper.find('textarea')
    expect(textarea.exists()).toBe(true)
    ;(textarea.element as HTMLTextAreaElement).focus()
    document.dispatchEvent(new FocusEvent('focusin'))
    await wrapper.vm.$nextTick()
    expect(document.activeElement).toBe(textarea.element)
    expect(jump.attributes('data-hidden')).toBe('true')
    expect(jump.classes()).toContain('opacity-0')
    expect(jump.classes()).toContain('pointer-events-none')
    expect(jump.attributes('aria-hidden')).toBe('true')

    ;(textarea.element as HTMLTextAreaElement).blur()
    document.dispatchEvent(new FocusEvent('focusout'))
    await wrapper.vm.$nextTick()
    expect(jump.attributes('data-hidden')).toBe('false')
    expect(jump.attributes('aria-hidden')).toBeUndefined()
    wrapper.unmount()
  })

  function scrollTo(y: number) {
    Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true })
    window.dispatchEvent(new Event('scroll'))
  }

  it('BanquetView（第 353 轮）：向下滚动后收起且停止滚动也不自动恢复；预览区不在视口时向上滚动恢复；回顶 <80px 恢复', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = await mountView(BanquetView)
      const jump = wrapper.find('[data-testid="mobile-preview-jump"]')
      expect(jump.attributes('data-hidden')).toBe('false')

      scrollTo(120)
      await wrapper.vm.$nextTick()
      expect(jump.attributes('data-hidden')).toBe('true')

      // 停止滚动任意时长都不再自动恢复
      vi.advanceTimersByTime(2000)
      await wrapper.vm.$nextTick()
      expect(jump.attributes('data-hidden')).toBe('true')

      // 继续向下仍收起
      scrollTo(600)
      await wrapper.vm.$nextTick()
      expect(jump.attributes('data-hidden')).toBe('true')

      // 预览区不在视口，向上滚动 → 恢复
      scrollTo(500)
      await wrapper.vm.$nextTick()
      expect(jump.attributes('data-hidden')).toBe('false')

      // 再向下 → 收起；回到顶部 (<80) → 恢复
      scrollTo(700)
      await wrapper.vm.$nextTick()
      expect(jump.attributes('data-hidden')).toBe('true')
      scrollTo(40)
      await wrapper.vm.$nextTick()
      expect(jump.attributes('data-hidden')).toBe('false')
      wrapper.unmount()
    } finally {
      vi.useRealTimers()
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true })
    }
  })

  it('SeatingView（第 353 轮）：预览区在视口内时向上滚动不恢复（不遮画布），离开视口后再向上才恢复', async () => {
    try {
      const wrapper = await mountView(SeatingView)
      const jump = wrapper.find('[data-testid="mobile-preview-jump"]')
      scrollTo(900)
      await wrapper.vm.$nextTick()
      expect(jump.attributes('data-hidden')).toBe('true')

      intersect(previewOf(wrapper), true)
      scrollTo(850)
      await wrapper.vm.$nextTick()
      expect(jump.attributes('data-hidden')).toBe('true')

      intersect(previewOf(wrapper), false)
      scrollTo(800)
      await wrapper.vm.$nextTick()
      expect(jump.attributes('data-hidden')).toBe('false')
      wrapper.unmount()
    } finally {
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true })
    }
  })

  it('底部操作条可见时（第 358 轮）：悬浮胶囊隐藏（已并入条内），客服 FAB 按实际条高 --sm-nextstep-h + 12px 抬高', async () => {
    const wrapper = await mountView(SeatingView)
    const jump = wrapper.find('[data-testid="mobile-preview-jump"]')
    expect(jump.classes()).toContain('[.has-next-step-bar_&]:hidden')
    expect(jump.classes()).toContain('[.has-sticky-actions_&]:bottom-[4.25rem]')
    const { default: FeedbackButton } = await import('@/components/ui/FeedbackButton.vue')
    const fab = mount(FeedbackButton, { global: { stubs: { Teleport: true, Transition: true } } })
    expect(fab.find('button').classes()).toContain(
      '[.has-next-step-bar_&]:bottom-[calc(var(--sm-nextstep-h,3rem)_+_0.75rem)]',
    )
    expect(fab.find('button').classes()).toContain(
      '[.has-sticky-actions_&]:bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))]',
    )
    expect(fab.find('button').classes()).toContain('max-md:size-10')
    expect(fab.find('button').classes()).toContain('max-md:right-3')
    fab.unmount()
    wrapper.unmount()
  })
})

describe('第 355 轮：胶囊改右下角 + 名单输入区滚入视口时自动隐藏', () => {
  it('胶囊靠右下（right-14，紧邻客服 FAB 左侧），不再固定在左下角', async () => {
    const wrapper = await mountView(SeatingView)
    const jump = wrapper.find('[data-testid="mobile-preview-jump"]')
    expect(jump.classes()).toContain('right-14')
    expect(jump.classes()).toContain('bottom-[calc(var(--sm-nextstep-h,0px)_+_1rem)]')
    expect(jump.classes()).not.toContain('left-4')
    // FAB max-sm: right-3(12px) + size-10(40px) = 52px < right-14(56px)，两者不重叠
    expect(14 * 4).toBeGreaterThan(3 * 4 + 10 * 4)
    wrapper.unmount()
  })

  it.each([
    ['SeatingView', SeatingView],
    ['BanquetView', BanquetView],
  ] as const)('%s：名单 textarea 滚入视口 → 胶囊隐藏；离开视口 → 恢复', async (_name, view) => {
    const wrapper = await mountView(view)
    const jump = wrapper.find('[data-testid="mobile-preview-jump"]')
    const textarea = wrapper.find('textarea').element
    expect(ioCallbacks.has(textarea)).toBe(true)
    expect(jump.attributes('data-hidden')).toBe('false')

    intersect(textarea, true)
    await wrapper.vm.$nextTick()
    expect(jump.attributes('data-avoid-visible')).toBe('true')
    expect(jump.attributes('data-hidden')).toBe('true')
    expect(jump.classes()).toContain('opacity-0')

    intersect(textarea, false)
    await wrapper.vm.$nextTick()
    expect(jump.attributes('data-hidden')).toBe('false')
    wrapper.unmount()
  })

  it('/seating 与 /banquet 表单列底部留白：页面根容器 pb-fixed-layers（操作条实际高 + FAB + 安全区 + 16px），底部常驻条不压最后一个控件', async () => {
    for (const view of [SeatingView, BanquetView]) {
      const wrapper = await mountView(view)
      const root = wrapper.find('.mx-auto.w-full')
      expect(root.classes()).toContain('pb-fixed-layers')
      expect(root.classes()).not.toContain('pb-20')
      wrapper.unmount()
    }
  })
})

describe('第 357 轮：反馈 FAB 与底部固定层对画布 / 过道按钮避让', () => {
  it.each([
    ['SeatingView', SeatingView, 'seating-preview-column'],
    ['BanquetView', BanquetView, 'banquet-canvas-column'],
  ] as const)(
    '%s：挂载时 <html> 加 has-canvas-safe-area，卸载时移除；画布列 md:pr-16 md:pb-fixed-layers 预留右下空区',
    async (_name, view, columnTestId) => {
      expect(document.documentElement.classList.contains('has-canvas-safe-area')).toBe(false)
      const wrapper = await mountView(view)
      expect(document.documentElement.classList.contains('has-canvas-safe-area')).toBe(true)
      const column = wrapper.find(`[data-testid="${columnTestId}"]`)
      expect(column.exists()).toBe(true)
      expect(column.classes()).toContain('md:pr-16')
      expect(column.classes()).toContain('md:pb-fixed-layers')
      wrapper.unmount()
      expect(document.documentElement.classList.contains('has-canvas-safe-area')).toBe(false)
    },
  )

  it('FeedbackButton：has-canvas-safe-area 页在 ≥md 缩为 size-10 / right-3（与预览列 pr-16 空区不交集），文本输入聚焦时窄屏收起', async () => {
    const { default: FeedbackButton } = await import('@/components/ui/FeedbackButton.vue')
    const fab = mount(FeedbackButton, {
      global: { stubs: { Teleport: true, Transition: true } },
      attachTo: document.body,
    })
    const btn = fab.find('button')
    expect(btn.classes()).toContain('md:[.has-canvas-safe-area_&]:size-10')
    expect(btn.classes()).toContain('md:[.has-canvas-safe-area_&]:right-3')
    // 默认 right-5 / bottom-5 保留，非画布页不变
    expect(btn.classes()).toContain('right-5')
    expect(btn.classes()).toContain('bottom-5')
    // ≥md 时：FAB 占用右侧 right-3(12px)+size-10(40px)=52px < 预览列 pr-16(64px)，横向无交集
    expect(3 * 4 + 10 * 4).toBeLessThan(16 * 4)

    expect(btn.attributes('data-collapsed')).toBe('false')
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()
    document.dispatchEvent(new FocusEvent('focusin'))
    await fab.vm.$nextTick()
    expect(btn.attributes('data-input-focused')).toBe('true')
    expect(btn.attributes('data-collapsed')).toBe('true')
    expect(btn.classes()).toContain('max-md:opacity-0')
    expect(btn.classes()).toContain('max-md:pointer-events-none')
    textarea.blur()
    document.dispatchEvent(new FocusEvent('focusout'))
    await fab.vm.$nextTick()
    expect(btn.attributes('data-collapsed')).toBe('false')
    textarea.remove()
    fab.unmount()
  })

  it('GuideArticleView：正文 pb-20，<sm 末段 pr-12，滚到底部 FAB（right-3 + size-10 = 52px）不压最后一段右缘', async () => {
    const slug = guides[0]!.slug
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/guides/:slug', component: GuideArticleView },
      ],
    })
    await router.push(`/guides/${slug}`)
    await router.isReady()
    const wrapper = mount(GuideArticleView, {
      global: { plugins: [router], stubs: { Teleport: true, Transition: true } },
    })
    await wrapper.vm.$nextTick()
    const body = wrapper.find('[data-testid="guide-article-body"]')
    expect(body.exists()).toBe(true)
    expect(body.classes()).toContain('pb-20')
    expect(body.classes()).toContain('max-sm:[&>*:last-child]:pr-12')
    // pr-12 = 48px ≥ FAB 在 <sm 占用的 right-3(12px)+size-10(40px) − 页面 px-4(16px) = 36px
    expect(12 * 4).toBeGreaterThanOrEqual(3 * 4 + 10 * 4 - 4 * 4)
    wrapper.unmount()
  })

  it('SeatingView：过道「列间」按钮行落到视口底部条带（rootMargin -75%）时胶囊让位，离开后恢复', async () => {
    const wrapper = await mountView(SeatingView)
    const jump = wrapper.find('[data-testid="mobile-preview-jump"]')
    const aisleRow = wrapper.find('[data-testid="aisle-row"]')
    expect(aisleRow.exists()).toBe(true)
    expect(aisleRow.findAll('button').length).toBeGreaterThan(0)
    expect(aisleRow.findAll('button')[0]!.text()).toMatch(/^列间 1-2$/)
    expect(ioCallbacks.has(aisleRow.element)).toBe(true)
    expect(ioOptions.get(aisleRow.element)?.rootMargin).toBe('-75% 0px 0px 0px')
    expect(jump.attributes('data-hidden')).toBe('false')

    intersect(aisleRow.element, true)
    await wrapper.vm.$nextTick()
    expect(jump.attributes('data-avoid-near-bottom')).toBe('true')
    expect(jump.attributes('data-hidden')).toBe('true')
    expect(jump.classes()).toContain('pointer-events-none')

    intersect(aisleRow.element, false)
    await wrapper.vm.$nextTick()
    expect(jump.attributes('data-hidden')).toBe('false')
    wrapper.unmount()
  })
})

describe('第 358 轮：<md 预览按钮并入底部操作条 + 反馈 FAB 页脚淡出', () => {
  it.each([
    ['SeatingView', SeatingView, '查看座位预览 ↓'],
    ['BanquetView', BanquetView, '查看座位预览 ↓'],
  ] as const)('%s：操作条内渲染行内预览按钮（md:hidden、非 fixed），点击滚动到预览区；悬浮胶囊在 has-next-step-bar 下隐藏', async (_name, view, label) => {
    const wrapper = await mountView(view)
    const bar = wrapper.find('[data-testid="next-step-bar"]')
    expect(bar.exists()).toBe(true)
    const inline = bar.find('[data-testid="mobile-preview-jump-inline"]')
    expect(inline.exists()).toBe(true)
    expect(inline.classes()).toContain('md:hidden')
    expect(inline.classes()).not.toContain('fixed')
    expect(inline.text()).toBe(label)
    const scroll = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>
    scroll.mockClear()
    await inline.trigger('click')
    expect(scroll).toHaveBeenCalledTimes(1)
    expect((scroll.mock.instances[0] as HTMLElement).className).toContain('overflow-auto')

    const floating = wrapper.find('[data-testid="mobile-preview-jump"]')
    expect(floating.classes()).toContain('fixed')
    expect(floating.classes()).toContain('[.has-next-step-bar_&]:hidden')
    wrapper.unmount()
  })

  it('FeedbackButton：页脚进入视口且页面可滚动时淡出（opacity-0 + aria-hidden），离开视口恢复', async () => {
    const footer = document.createElement('footer')
    document.body.appendChild(footer)
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 3000, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true, writable: true })
    const { default: FeedbackButton } = await import('@/components/ui/FeedbackButton.vue')
    const fab = mount(FeedbackButton, {
      global: { stubs: { Teleport: true, Transition: true } },
      attachTo: document.body,
    })
    const btn = fab.find('button')
    expect(ioCallbacks.has(footer)).toBe(true)
    expect(btn.attributes('data-footer-visible')).toBe('false')

    intersect(footer, true)
    await fab.vm.$nextTick()
    expect(btn.attributes('data-footer-visible')).toBe('true')
    expect(btn.classes()).toContain('opacity-0')
    expect(btn.classes()).toContain('pointer-events-none')
    expect(btn.attributes('aria-hidden')).toBe('true')

    intersect(footer, false)
    await fab.vm.$nextTick()
    expect(btn.attributes('data-footer-visible')).toBe('false')
    expect(btn.attributes('aria-hidden')).toBeUndefined()
    fab.unmount()
    footer.remove()
  })

  it('FeedbackButton：短页面（不可滚动）页脚常驻可见时不淡出，反馈入口保留', async () => {
    const footer = document.createElement('footer')
    document.body.appendChild(footer)
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 600, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true, writable: true })
    const { default: FeedbackButton } = await import('@/components/ui/FeedbackButton.vue')
    const fab = mount(FeedbackButton, {
      global: { stubs: { Teleport: true, Transition: true } },
      attachTo: document.body,
    })
    intersect(footer, true)
    await fab.vm.$nextTick()
    expect(fab.find('button').attributes('data-footer-visible')).toBe('false')
    fab.unmount()
    footer.remove()
  })
})
