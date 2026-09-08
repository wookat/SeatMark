// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import NextStepBar, { type NextStep } from '@/components/NextStepBar.vue'
import { setLocale } from '@/i18n'

function mountBar(props: { step: NextStep; arrangeLabel: string; progress?: string; target: HTMLElement | null }) {
  return mount(NextStepBar, { props })
}

afterEach(async () => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  await setLocale('zh')
})

describe('NextStepBar', () => {
  it.each<[NextStep, string, string]>([
    ['import', '随机排座', '下一步：导入名单'],
    ['arrange', '随机排座', '下一步：随机排座'],
    ['arrange', '自动分配', '下一步：自动分配'],
    ['export', '自动分配', '下一步：检查并导出'],
  ])('状态 %s（%s）→ 主按钮文案「%s」', (step, arrangeLabel, expected) => {
    const target = document.createElement('section')
    const wrapper = mountBar({ step, arrangeLabel, progress: '12 人 / 48 座', target })
    expect(wrapper.find('[data-testid="next-step-action"]').text()).toBe(expected)
    expect(wrapper.find('[data-testid="next-step-progress"]').text()).toBe('12 人 / 48 座')
  })

  it('英文下文案同步', async () => {
    await setLocale('en')
    const target = document.createElement('section')
    expect(mountBar({ step: 'import', arrangeLabel: 'Random seating', target }).text()).toContain(
      'Next: import roster',
    )
    expect(mountBar({ step: 'arrange', arrangeLabel: 'Auto-assign', target }).text()).toContain(
      'Next: Auto-assign',
    )
    expect(mountBar({ step: 'export', arrangeLabel: 'Auto-assign', target }).text()).toContain(
      'Next: check & export',
    )
  })

  it('export 步骤带 quotaBadge 时在主按钮上渲染额度角标；其他步骤不渲染', () => {
    const target = document.createElement('section')
    const badge = { text: '今日剩余 1 次', cls: 'bg-emerald-100 text-emerald-700' }
    const exporting = mount(NextStepBar, {
      props: { step: 'export', arrangeLabel: '随机排座', target, quotaBadge: badge, quotaBadgeTitle: '额度说明' },
    })
    const badgeEl = exporting.find('[data-testid="next-step-quota-badge"]')
    expect(badgeEl.exists()).toBe(true)
    expect(badgeEl.text()).toBe('今日剩余 1 次')
    expect(badgeEl.classes()).toContain('bg-emerald-100')
    expect(exporting.find('[data-testid="next-step-action"]').attributes('title')).toBe('额度说明')

    const arranging = mount(NextStepBar, {
      props: { step: 'arrange', arrangeLabel: '随机排座', target, quotaBadge: badge },
    })
    expect(arranging.find('[data-testid="next-step-quota-badge"]').exists()).toBe(false)
    expect(mountBar({ step: 'export', arrangeLabel: '随机排座', target }).find('[data-testid="next-step-quota-badge"]').exists()).toBe(false)
  })

  it('第 367 轮：窄屏（<640px）且带额度角标时主按钮收短为「下一步：导出」，无角标或宽屏保持完整文案', async () => {
    const target = document.createElement('section')
    const badge = { text: '无水印 今日剩余 1 次', cls: 'bg-emerald-100 text-emerald-700' }
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(max-width: 639px)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
    const narrowWithBadge = mount(NextStepBar, {
      props: { step: 'export', arrangeLabel: '随机排座', target, quotaBadge: badge },
    })
    await narrowWithBadge.vm.$nextTick()
    const action = narrowWithBadge.find('[data-testid="next-step-action"]')
    expect(action.text()).toBe('下一步：导出 无水印 今日剩余 1 次')
    expect(action.find('[data-testid="next-step-quota-badge"]').classes()).toContain('whitespace-nowrap')

    const narrowNoBadge = mountBar({ step: 'export', arrangeLabel: '随机排座', target })
    await narrowNoBadge.vm.$nextTick()
    expect(narrowNoBadge.find('[data-testid="next-step-action"]').text()).toBe('下一步：检查并导出')

    await setLocale('en')
    const narrowEn = mount(NextStepBar, {
      props: { step: 'export', arrangeLabel: 'Random seating', target, quotaBadge: { ...badge, text: '1 watermark-free left today' } },
    })
    await narrowEn.vm.$nextTick()
    expect(narrowEn.find('[data-testid="next-step-action"]').text()).toContain('Next: export')
    expect(narrowEn.find('[data-testid="next-step-action"]').text()).not.toContain('check & export')

    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    const wideWithBadge = mount(NextStepBar, {
      props: { step: 'export', arrangeLabel: 'Random seating', target, quotaBadge: badge },
    })
    await wideWithBadge.vm.$nextTick()
    expect(wideWithBadge.find('[data-testid="next-step-action"]').text()).toContain('Next: check & export')
  })

  it('第 367 轮：窄屏上完整角标仍超出操作条右缘时退到 compactText（按真实渲染宽度判定），能放下时保持完整文案', async () => {
    const target = document.createElement('section')
    const badge = {
      text: '1 watermark-free left today',
      compactText: '1 watermark-free',
      cls: 'bg-emerald-100 text-emerald-700',
    }
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(max-width: 639px)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
    const rect = (right: number) => ({ left: 0, top: 0, right, bottom: 48, width: right, height: 48, x: 0, y: 0, toJSON: () => ({}) })
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.dataset.testid === 'next-step-bar') return rect(390) as DOMRect
      if (this.dataset.testid === 'next-step-action') return rect(507) as DOMRect
      return rect(0) as DOMRect
    })
    const overflowing = mount(NextStepBar, {
      props: { step: 'export', arrangeLabel: 'Random seating', target, quotaBadge: badge },
    })
    await overflowing.vm.$nextTick()
    await overflowing.vm.$nextTick()
    const badgeEl = overflowing.find('[data-testid="next-step-quota-badge"]')
    expect(badgeEl.text()).toBe('1 watermark-free')
    expect(badgeEl.attributes('data-compact')).toBe('true')
    overflowing.unmount()

    spy.mockImplementation(function (this: HTMLElement) {
      if (this.dataset.testid === 'next-step-bar') return rect(390) as DOMRect
      if (this.dataset.testid === 'next-step-action') return rect(356) as DOMRect
      return rect(0) as DOMRect
    })
    const fitting = mount(NextStepBar, {
      props: { step: 'export', arrangeLabel: 'Random seating', target, quotaBadge: badge },
    })
    await fitting.vm.$nextTick()
    await fitting.vm.$nextTick()
    const fittingBadge = fitting.find('[data-testid="next-step-quota-badge"]')
    expect(fittingBadge.text()).toBe('1 watermark-free left today')
    expect(fittingBadge.attributes('data-compact')).toBeUndefined()
    fitting.unmount()
    spy.mockRestore()
  })

  it('第 367 轮：次按钮被截断（scrollWidth > clientWidth）同样触发紧凑模式，并通过 secondary 作用域插槽下发 compact', async () => {
    const target = document.createElement('section')
    const badge = { text: '1 watermark-free left today', compactText: '1 watermark-free', cls: 'bg-emerald-100 text-emerald-700' }
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(max-width: 639px)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
    const scrollW = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.dataset.testid === 'secondary-stub' ? 150 : 0
    })
    const clientW = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.dataset.testid === 'secondary-stub' ? 26 : 0
    })
    const wrapper = mount(NextStepBar, {
      props: { step: 'export', arrangeLabel: 'Random seating', target, quotaBadge: badge },
      slots: {
        secondary: `<template #secondary="{ compact }"><button data-testid="secondary-stub" :data-compact="compact ? 'true' : 'false'">{{ compact ? 'Preview' : 'View seating preview' }}</button></template>`,
      },
    })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="next-step-quota-badge"]').text()).toBe('1 watermark-free')
    const stub = wrapper.find('[data-testid="secondary-stub"]')
    expect(stub.attributes('data-compact')).toBe('true')
    expect(stub.text()).toBe('Preview')
    wrapper.unmount()
    scrollW.mockRestore()
    clientW.mockRestore()
  })

  it('无目标区块时不渲染', () => {
    const wrapper = mountBar({ step: 'import', arrangeLabel: '随机排座', target: null })
    expect(wrapper.find('[data-testid="next-step-bar"]').exists()).toBe(false)
  })

  it('目标进入视口时隐藏，离开视口时再显示', async () => {
    let callback: IntersectionObserverCallback | undefined
    const observe = vi.fn()
    const disconnect = vi.fn()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          callback = cb
        }
        observe = observe
        disconnect = disconnect
        unobserve() {}
      },
    )
    const target = document.createElement('section')
    const wrapper = mountBar({ step: 'export', arrangeLabel: '自动分配', target })
    expect(observe).toHaveBeenCalledWith(target)
    expect(wrapper.find('[data-testid="next-step-bar"]').exists()).toBe(true)

    callback!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="next-step-bar"]').exists()).toBe(false)

    callback!([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="next-step-bar"]').exists()).toBe(true)

    wrapper.unmount()
    expect(disconnect).toHaveBeenCalled()
  })

  it('键盘焦点在操作条内时，目标进入视口也保持显示；失焦后隐藏', async () => {
    let callback: IntersectionObserverCallback | undefined
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          callback = cb
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    )
    const target = document.createElement('section')
    const wrapper = mountBar({ step: 'export', arrangeLabel: '自动分配', target })
    await wrapper.find('[data-testid="next-step-action"]').trigger('focusin')

    callback!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="next-step-bar"]').exists()).toBe(true)

    await wrapper.find('[data-testid="next-step-action"]').trigger('focusout')
    expect(wrapper.find('[data-testid="next-step-bar"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('可见时在 <html> 标记 has-next-step-bar，隐藏/卸载时移除', async () => {
    let callback: IntersectionObserverCallback | undefined
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          callback = cb
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    )
    const html = document.documentElement
    const target = document.createElement('section')
    const wrapper = mountBar({ step: 'export', arrangeLabel: '自动分配', target })
    expect(html.classList.contains('has-next-step-bar')).toBe(true)

    callback!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    await wrapper.vm.$nextTick()
    expect(html.classList.contains('has-next-step-bar')).toBe(false)

    callback!([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver)
    await wrapper.vm.$nextTick()
    expect(html.classList.contains('has-next-step-bar')).toBe(true)

    wrapper.unmount()
    expect(html.classList.contains('has-next-step-bar')).toBe(false)
  })

  it('点击后平滑滚动并聚焦目标；prefers-reduced-motion 时不平滑', async () => {
    const target = document.createElement('section')
    document.body.appendChild(target)
    const scrollIntoView = vi.fn()
    target.scrollIntoView = scrollIntoView
    const matchMedia = vi.fn().mockReturnValue({ matches: false })
    vi.stubGlobal('matchMedia', matchMedia)

    const wrapper = mountBar({ step: 'import', arrangeLabel: '随机排座', target })
    await wrapper.find('[data-testid="next-step-action"]').trigger('click')
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    expect(target.getAttribute('tabindex')).toBe('-1')
    expect(document.activeElement).toBe(target)

    matchMedia.mockReturnValue({ matches: true })
    await wrapper.find('[data-testid="next-step-action"]').trigger('click')
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'instant', block: 'start' })

    wrapper.unmount()
    target.remove()
  })
})

describe('第 355 轮：常驻底部操作条不遮页脚版权行 / 额度文字内联', () => {
  it('AppFooter 在 html.has-next-step-bar 下补 pb-12（= NextStepBar h-12 条高）', async () => {
    const { default: AppFooter } = await import('@/components/ui/AppFooter.vue')
    const { createPinia, setActivePinia } = await import('pinia')
    const { RouterLinkStub } = await import('@vue/test-utils')
    setActivePinia(createPinia())
    const wrapper = mount(AppFooter, { global: { stubs: { RouterLink: RouterLinkStub } } })
    const footer = wrapper.find('footer')
    expect(footer.classes()).toContain('[.has-next-step-bar_&]:pb-12')
    expect(footer.classes()).toContain('[.has-sticky-actions_&]:pb-12')
    const target = document.createElement('section')
    const bar = mountBar({ step: 'export', arrangeLabel: '随机排座', target })
    expect(bar.find('.h-12').exists()).toBe(true)
    bar.unmount()
    wrapper.unmount()
  })

  it('额度文字作为按钮内联次要文字渲染（不再 absolute 骑压按钮边缘）', () => {
    const target = document.createElement('section')
    const badge = { text: '今日剩余 1 次', cls: 'bg-emerald-100 text-emerald-700' }
    const wrapper = mount(NextStepBar, {
      props: { step: 'export', arrangeLabel: '随机排座', target, quotaBadge: badge, quotaBadgeTitle: '额度说明' },
    })
    const badgeEl = wrapper.find('[data-testid="next-step-quota-badge"]')
    expect(badgeEl.classes()).not.toContain('absolute')
    expect(wrapper.find('[data-testid="next-step-action"]').element.contains(badgeEl.element)).toBe(true)
    wrapper.unmount()
  })
})

describe('第 358 轮：操作条实际高度写入 --sm-nextstep-h', () => {
  type ROCallback = (entries: Array<{ target: Element; borderBoxSize: Array<{ blockSize: number; inlineSize: number }> }>) => void
  let roCallback: ROCallback | undefined
  let observed: Element | null = null
  let disconnected = 0
  class ResizeObserverStub {
    constructor(cb: ROCallback) {
      roCallback = cb
    }
    observe(el: Element) {
      observed = el
    }
    unobserve() {}
    disconnect() {
      disconnected += 1
    }
  }
  const cssVar = () => document.documentElement.style.getPropertyValue('--sm-nextstep-h')

  it('挂载后用 ResizeObserver 观察条本身，回调高度写入 <html> 的 --sm-nextstep-h；卸载时清零并断开观察', async () => {
    roCallback = undefined
    observed = null
    disconnected = 0
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    const target = document.createElement('section')
    const wrapper = mountBar({ step: 'import', arrangeLabel: '随机排座', target })
    await wrapper.vm.$nextTick()
    const bar = wrapper.find('[data-testid="next-step-bar"]')
    expect(bar.exists()).toBe(true)
    expect(observed).toBe(bar.element)
    expect(roCallback).toBeTypeOf('function')

    roCallback!([{ target: bar.element, borderBoxSize: [{ blockSize: 49, inlineSize: 390 }] }])
    expect(cssVar()).toBe('49px')
    // 文案折行等导致条变高时跟随更新
    roCallback!([{ target: bar.element, borderBoxSize: [{ blockSize: 72, inlineSize: 390 }] }])
    expect(cssVar()).toBe('72px')

    wrapper.unmount()
    expect(cssVar()).toBe('0px')
    expect(disconnected).toBeGreaterThan(0)
  })

  it('目标进入视口条隐藏（v-if 卸载）时清零，重新出现后再次写入', async () => {
    roCallback = undefined
    let ioCallback: IntersectionObserverCallback | undefined
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          ioCallback = cb
        }
        observe() {}
        disconnect() {}
      },
    )
    const target = document.createElement('section')
    const wrapper = mountBar({ step: 'import', arrangeLabel: '随机排座', target })
    await wrapper.vm.$nextTick()
    roCallback!([{ target: wrapper.find('[data-testid="next-step-bar"]').element, borderBoxSize: [{ blockSize: 48, inlineSize: 390 }] }])
    expect(cssVar()).toBe('48px')

    ioCallback!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="next-step-bar"]').exists()).toBe(false)
    expect(cssVar()).toBe('0px')

    ioCallback!([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver)
    await wrapper.vm.$nextTick()
    roCallback!([{ target: wrapper.find('[data-testid="next-step-bar"]').element, borderBoxSize: [{ blockSize: 50, inlineSize: 390 }] }])
    expect(cssVar()).toBe('50px')
    wrapper.unmount()
    expect(cssVar()).toBe('0px')
  })

  it('secondary 插槽渲染在主按钮左侧（同一右侧按钮组内）', () => {
    const target = document.createElement('section')
    const wrapper = mount(NextStepBar, {
      props: { step: 'import', arrangeLabel: '随机排座', target },
      slots: { secondary: '<button type="button" data-testid="secondary-slot">预览</button>' },
    })
    const secondary = wrapper.find('[data-testid="secondary-slot"]')
    const primary = wrapper.find('[data-testid="next-step-action"]')
    expect(secondary.exists()).toBe(true)
    expect(secondary.element.parentElement).toBe(primary.element.parentElement)
    expect(secondary.element.compareDocumentPosition(primary.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    wrapper.unmount()
  })
})
