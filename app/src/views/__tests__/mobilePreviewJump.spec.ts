// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setLocale } from '@/i18n'
import BanquetView from '@/views/BanquetView.vue'
import SeatingView from '@/views/SeatingView.vue'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

type IOCallback = (entries: Array<{ isIntersecting: boolean }>) => void
let ioCallback: IOCallback | null = null
class IntersectionObserverStub {
  constructor(cb: IOCallback) {
    ioCallback = cb
  }
  observe() {}
  unobserve() {}
  disconnect() {}
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
  ioCallback = null
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

    ioCallback?.([{ isIntersecting: true }])
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
    ioCallback?.([{ isIntersecting: true }])
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

  it('BanquetView：向下滚动时收起，停止滚动 300ms 后恢复；向上滚动不收起', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = await mountView(BanquetView)
      const jump = wrapper.find('[data-testid="mobile-preview-jump"]')
      expect(jump.attributes('data-hidden')).toBe('false')

      Object.defineProperty(window, 'scrollY', { value: 120, configurable: true, writable: true })
      window.dispatchEvent(new Event('scroll'))
      await wrapper.vm.$nextTick()
      expect(jump.attributes('data-hidden')).toBe('true')

      vi.advanceTimersByTime(200)
      await wrapper.vm.$nextTick()
      expect(jump.attributes('data-hidden')).toBe('true')
      vi.advanceTimersByTime(100)
      await wrapper.vm.$nextTick()
      expect(jump.attributes('data-hidden')).toBe('false')

      Object.defineProperty(window, 'scrollY', { value: 40, configurable: true, writable: true })
      window.dispatchEvent(new Event('scroll'))
      await wrapper.vm.$nextTick()
      expect(jump.attributes('data-hidden')).toBe('false')
      wrapper.unmount()
    } finally {
      vi.useRealTimers()
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true })
    }
  })

  it('底部操作条（h-12 = 3rem）可见时，胶囊与客服 FAB 都抬到 4.25rem：与操作条留 ≥ 8px 间距', async () => {
    const wrapper = await mountView(SeatingView)
    const jump = wrapper.find('[data-testid="mobile-preview-jump"]')
    expect(jump.classes()).toContain('[.has-next-step-bar_&]:bottom-[4.25rem]')
    const { default: FeedbackButton } = await import('@/components/ui/FeedbackButton.vue')
    const fab = mount(FeedbackButton, { global: { stubs: { Teleport: true, Transition: true } } })
    expect(fab.find('button').classes()).toContain('[.has-next-step-bar_&]:bottom-[4.25rem]')
    // 4.25rem − 3rem（操作条高）= 1.25rem = 20px ≥ 8px
    expect(4.25 * 16 - 3 * 16).toBeGreaterThanOrEqual(8)
    fab.unmount()
    wrapper.unmount()
  })
})
