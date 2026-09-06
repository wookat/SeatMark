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
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'auto', block: 'start' })

    wrapper.unmount()
    target.remove()
  })
})
