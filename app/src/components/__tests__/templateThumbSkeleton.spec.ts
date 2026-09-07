// @vitest-environment jsdom
/**
 * 第 356 轮：模板缩略图懒渲染骨架占位——defer 且未进入视口时渲染 aria-hidden 骨架，
 * 相交后替换为真实标签卡；无 IntersectionObserver / 不 defer 时直接渲染卡片无骨架。
 */
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import TemplateThumb from '@/components/label/TemplateThumb.vue'
import { defaultTemplates } from '@/data/defaultTemplates'

const SKELETON = '[data-testid="template-thumb-skeleton"]'
const CARD = '[data-testid="template-thumb-card"]'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const standard = defaultTemplates.find((t) => t.id === 'standard')!

function stubIntersectionObserver() {
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
  return { fire: (isIntersecting: boolean) => callback!([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver), observe, disconnect }
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
})
afterEach(() => vi.unstubAllGlobals())

describe('第 356 轮：TemplateThumb 懒渲染骨架', () => {
  it('不 defer：直接渲染卡片，无骨架', async () => {
    const wrapper = mount(TemplateThumb, { props: { template: standard } })
    await wrapper.vm.$nextTick()
    expect(wrapper.find(CARD).exists()).toBe(true)
    expect(wrapper.find(SKELETON).exists()).toBe(false)
    wrapper.unmount()
  })

  it('defer 但环境无 IntersectionObserver：退化为直接渲染卡片，无骨架', async () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const wrapper = mount(TemplateThumb, { props: { template: standard, defer: true } })
    await wrapper.vm.$nextTick()
    expect(wrapper.find(CARD).exists()).toBe(true)
    expect(wrapper.find(SKELETON).exists()).toBe(false)
    wrapper.unmount()
  })

  it('defer 且未相交：渲染 aria-hidden 骨架（虚线轮廓 + 两条 slate-200 短条）；相交后骨架消失出现卡片', async () => {
    const io = stubIntersectionObserver()
    const wrapper = mount(TemplateThumb, { props: { template: standard, defer: true } })
    await wrapper.vm.$nextTick()
    expect(io.observe).toHaveBeenCalledTimes(1)

    const skeleton = wrapper.find(SKELETON)
    expect(skeleton.exists()).toBe(true)
    expect(skeleton.attributes('aria-hidden')).toBe('true')
    expect(wrapper.find(CARD).exists()).toBe(false)
    // 骨架与卡片共用同一 aspect-ratio 容器
    expect(skeleton.element.parentElement!.getAttribute('style')).toContain(
      `aspect-ratio: ${standard.label.width} / ${standard.label.height}`,
    )
    const outline = skeleton.find('.border-dashed')
    expect(outline.exists()).toBe(true)
    expect(outline.classes()).toContain('w-3/5')
    expect(outline.findAll('.bg-slate-200')).toHaveLength(2)

    io.fire(false)
    await wrapper.vm.$nextTick()
    expect(wrapper.find(SKELETON).exists()).toBe(true)
    expect(wrapper.find(CARD).exists()).toBe(false)

    io.fire(true)
    await wrapper.vm.$nextTick()
    expect(wrapper.find(SKELETON).exists()).toBe(false)
    expect(wrapper.find(CARD).exists()).toBe(true)
    expect(io.disconnect).toHaveBeenCalled()
    wrapper.unmount()
  })
})
