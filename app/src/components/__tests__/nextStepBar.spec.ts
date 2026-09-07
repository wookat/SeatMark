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
