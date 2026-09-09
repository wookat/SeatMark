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
    ['import', '随机排座', '跳到：导入名单'],
    ['arrange', '随机排座', '跳到：随机排座'],
    ['arrange', '自动分配', '跳到：自动分配'],
    ['export', '自动分配', '跳到：检查并导出'],
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
      'Go to: Import roster',
    )
    expect(mountBar({ step: 'arrange', arrangeLabel: 'Auto-assign', target }).text()).toContain(
      'Go to: Auto-assign',
    )
    expect(mountBar({ step: 'export', arrangeLabel: 'Auto-assign', target }).text()).toContain(
      'Go to: Check & export',
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
    expect(action.text()).toBe('跳到：导出 无水印 今日剩余 1 次')
    expect(action.find('[data-testid="next-step-quota-badge"]').classes()).toContain('whitespace-nowrap')

    const narrowNoBadge = mountBar({ step: 'export', arrangeLabel: '随机排座', target })
    await narrowNoBadge.vm.$nextTick()
    expect(narrowNoBadge.find('[data-testid="next-step-action"]').text()).toBe('跳到：检查并导出')

    await setLocale('en')
    const narrowEn = mount(NextStepBar, {
      props: { step: 'export', arrangeLabel: 'Random seating', target, quotaBadge: { ...badge, text: '1 watermark-free left today' } },
    })
    await narrowEn.vm.$nextTick()
    expect(narrowEn.find('[data-testid="next-step-action"]').text()).toContain('Go to: Export')
    expect(narrowEn.find('[data-testid="next-step-action"]').text()).not.toContain('Check & export')

    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    const wideWithBadge = mount(NextStepBar, {
      props: { step: 'export', arrangeLabel: 'Random seating', target, quotaBadge: badge },
    })
    await wideWithBadge.vm.$nextTick()
    expect(wideWithBadge.find('[data-testid="next-step-action"]').text()).toContain('Go to: Check & export')
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

  describe('第 370 轮：窄屏下不限步骤测量，进度文案保留最小宽度', () => {
    const narrowMatchMedia = () =>
      vi.stubGlobal(
        'matchMedia',
        vi.fn((query: string) => ({
          matches: query === '(max-width: 639px)',
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      )
    const secondarySlot = {
      secondary: `<template #secondary="{ compact }"><button data-testid="secondary-stub" :data-compact="compact ? 'true' : 'false'">{{ compact ? 'Preview ↓' : 'View seating preview ↓' }}</button></template>`,
    }

    it.each<NextStep>(['arrange', 'import'])('%s 步骤（无角标）窄屏次按钮被截断 → compact=true，次按钮切短文案', async (step) => {
      narrowMatchMedia()
      const target = document.createElement('section')
      const scrollW = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
        return this.dataset.testid === 'secondary-stub' ? 150 : 0
      })
      const clientW = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
        return this.dataset.testid === 'secondary-stub' ? 26 : 0
      })
      const wrapper = mount(NextStepBar, {
        props: { step, arrangeLabel: 'Random seating', progress: '2 loaded (0 seated)', target },
        slots: secondarySlot,
      })
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()
      const stub = wrapper.find('[data-testid="secondary-stub"]')
      expect(stub.attributes('data-compact')).toBe('true')
      expect(stub.text()).toBe('Preview ↓')
      expect(wrapper.find('[data-testid="next-step-quota-badge"]').exists()).toBe(false)
      wrapper.unmount()
      scrollW.mockRestore()
      clientW.mockRestore()
    })

    it('arrange 步骤窄屏进度文案 clientWidth < 56px（被挤到只剩「(」）→ compact=true', async () => {
      narrowMatchMedia()
      const target = document.createElement('section')
      const clientW = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
        return this.dataset.testid === 'next-step-progress' ? 4 : 0
      })
      const wrapper = mount(NextStepBar, {
        props: { step: 'arrange', arrangeLabel: 'Random seating', progress: '2 loaded (0 seated)', target },
        slots: secondarySlot,
      })
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="secondary-stub"]').attributes('data-compact')).toBe('true')
      wrapper.unmount()
      clientW.mockRestore()
    })

    it('窄屏一切放得下（进度 ≥ 56px、次按钮未截断、主按钮未越界）→ compact=false；宽屏即使被截断也不 compact', async () => {
      narrowMatchMedia()
      const target = document.createElement('section')
      const clientW = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
        return this.dataset.testid === 'next-step-progress' ? 120 : 0
      })
      const fitting = mount(NextStepBar, {
        props: { step: 'arrange', arrangeLabel: '随机排座', progress: '12 人 / 48 座', target },
        slots: secondarySlot,
      })
      await fitting.vm.$nextTick()
      await fitting.vm.$nextTick()
      expect(fitting.find('[data-testid="secondary-stub"]').attributes('data-compact')).toBe('false')
      fitting.unmount()
      clientW.mockRestore()

      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
      const scrollW = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(150)
      const clientW2 = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(26)
      const wide = mount(NextStepBar, {
        props: { step: 'arrange', arrangeLabel: '随机排座', progress: '12 人 / 48 座', target },
        slots: secondarySlot,
      })
      await wide.vm.$nextTick()
      await wide.vm.$nextTick()
      expect(wide.find('[data-testid="secondary-stub"]').attributes('data-compact')).toBe('false')
      wide.unmount()
      scrollW.mockRestore()
      clientW2.mockRestore()
    })

    it('进度元素保留 min-w-[3.5rem]（56px）且仍 truncate，最差情况可读一部分而非完全消失', () => {
      const target = document.createElement('section')
      const wrapper = mountBar({ step: 'arrange', arrangeLabel: '随机排座', progress: '12 人 / 48 座', target })
      const progress = wrapper.find('[data-testid="next-step-progress"]')
      expect(progress.classes()).toContain('min-w-[3.5rem]')
      expect(progress.classes()).toContain('truncate')
      expect(progress.classes()).not.toContain('min-w-0')
      wrapper.unmount()
    })
  })

  describe('第 372 轮：进度文案被挤压时切 progressCompact，完整文案保留在 title / aria-label', () => {
    const narrowMatchMedia = () =>
      vi.stubGlobal(
        'matchMedia',
        vi.fn((query: string) => ({
          matches: query === '(max-width: 639px)',
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      )
    const squeezeProgress = () => {
      const clientW = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
        return this.dataset.testid === 'next-step-progress' ? 71 : 0
      })
      const scrollW = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
        return this.dataset.testid === 'next-step-progress' ? 140 : 0
      })
      return () => {
        clientW.mockRestore()
        scrollW.mockRestore()
      }
    }

    it('窄屏进度 scrollWidth > clientWidth → 显示 compact 文案，title/aria-label 为全文，仍 truncate 单行', async () => {
      narrowMatchMedia()
      const restore = squeezeProgress()
      const target = document.createElement('section')
      const wrapper = mount(NextStepBar, {
        props: { step: 'import', arrangeLabel: 'Random seating', progress: '0 students / 48 seats', progressCompact: '0/48', target },
      })
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()
      const progress = wrapper.find('[data-testid="next-step-progress"]')
      expect(progress.text()).toBe('0/48')
      expect(progress.attributes('title')).toBe('0 students / 48 seats')
      expect(progress.attributes('aria-label')).toBe('0 students / 48 seats')
      expect(progress.attributes('data-compact')).toBe('true')
      expect(progress.classes()).toContain('truncate')
      wrapper.unmount()
      restore()
    })

    it('未提供 progressCompact 时退化为两行换行（line-clamp-2），文案不变', async () => {
      narrowMatchMedia()
      const restore = squeezeProgress()
      const target = document.createElement('section')
      const wrapper = mount(NextStepBar, {
        props: { step: 'import', arrangeLabel: 'Random seating', progress: '0 students / 48 seats', target },
      })
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()
      const progress = wrapper.find('[data-testid="next-step-progress"]')
      expect(progress.text()).toBe('0 students / 48 seats')
      expect(progress.classes()).toContain('line-clamp-2')
      expect(progress.classes()).toContain('whitespace-normal')
      expect(progress.classes()).not.toContain('truncate')
      expect(progress.attributes('title')).toBeUndefined()
      wrapper.unmount()
      restore()
    })

    it('放得下（未被截断、宽度 ≥ 56px）或宽屏时保持完整文案，不加 title', async () => {
      narrowMatchMedia()
      const clientW = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
        return this.dataset.testid === 'next-step-progress' ? 140 : 0
      })
      const target = document.createElement('section')
      const fitting = mount(NextStepBar, {
        props: { step: 'import', arrangeLabel: 'Random seating', progress: '0 students / 48 seats', progressCompact: '0/48', target },
      })
      await fitting.vm.$nextTick()
      await fitting.vm.$nextTick()
      const progress = fitting.find('[data-testid="next-step-progress"]')
      expect(progress.text()).toBe('0 students / 48 seats')
      expect(progress.attributes('title')).toBeUndefined()
      expect(progress.attributes('data-compact')).toBeUndefined()
      fitting.unmount()
      clientW.mockRestore()

      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
      const restore = squeezeProgress()
      const wide = mount(NextStepBar, {
        props: { step: 'import', arrangeLabel: 'Random seating', progress: '0 students / 48 seats', progressCompact: '0/48', target },
      })
      await wide.vm.$nextTick()
      await wide.vm.$nextTick()
      expect(wide.find('[data-testid="next-step-progress"]').text()).toBe('0 students / 48 seats')
      wide.unmount()
      restore()
    })
  })

  describe('第 372 轮：go() 聚焦目标区块内的 [data-next-step-primary] 主按钮并加一次性 sm-attn', () => {
    it('有主按钮标记 → activeElement 是主按钮，带 sm-attn，animationend 后移除；区块不再被赋 tabindex', async () => {
      const target = document.createElement('section')
      const other = document.createElement('button')
      const primary = document.createElement('button')
      primary.setAttribute('data-next-step-primary', '')
      target.append(other, primary)
      document.body.appendChild(target)
      target.scrollIntoView = vi.fn()
      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))

      const wrapper = mountBar({ step: 'arrange', arrangeLabel: '随机排座', target })
      await wrapper.find('[data-testid="next-step-action"]').trigger('click')
      expect(document.activeElement).toBe(primary)
      expect(primary.classList.contains('sm-attn')).toBe(true)
      expect(target.hasAttribute('tabindex')).toBe(false)

      primary.dispatchEvent(new Event('animationend'))
      expect(primary.classList.contains('sm-attn')).toBe(false)
      wrapper.unmount()
      target.remove()
    })

    it('主按钮 disabled 时跳过它，退回聚焦区块；无标记时同样退回', async () => {
      const target = document.createElement('section')
      const primary = document.createElement('button')
      primary.setAttribute('data-next-step-primary', '')
      primary.disabled = true
      target.append(primary)
      document.body.appendChild(target)
      target.scrollIntoView = vi.fn()
      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))

      const wrapper = mountBar({ step: 'export', arrangeLabel: '随机排座', target })
      await wrapper.find('[data-testid="next-step-action"]').trigger('click')
      expect(document.activeElement).toBe(target)
      expect(target.getAttribute('tabindex')).toBe('-1')
      expect(primary.classList.contains('sm-attn')).toBe(false)
      wrapper.unmount()
      target.remove()
    })

    it('减少动效时仍聚焦主按钮并加类，没有 animationend 时由定时器兑底移除', async () => {
      vi.useFakeTimers()
      const target = document.createElement('section')
      const primary = document.createElement('button')
      primary.setAttribute('data-next-step-primary', '')
      target.append(primary)
      document.body.appendChild(target)
      target.scrollIntoView = vi.fn()
      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))

      const wrapper = mountBar({ step: 'import', arrangeLabel: '随机排座', target })
      await wrapper.find('[data-testid="next-step-action"]').trigger('click')
      expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'instant', block: 'start' })
      expect(document.activeElement).toBe(primary)
      expect(primary.classList.contains('sm-attn')).toBe(true)
      vi.advanceTimersByTime(1600)
      expect(primary.classList.contains('sm-attn')).toBe(false)
      wrapper.unmount()
      target.remove()
      vi.useRealTimers()
    })
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
