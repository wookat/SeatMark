import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import TemplateThumb from '@/components/label/TemplateThumb.vue'
import { defaultTemplates } from '@/data/defaultTemplates'
import { MM_TO_PX } from '@/utils/layout'

type ROCallback = (entries: Array<{ contentRect: { width: number; height: number } }>) => void
let roCallback: ROCallback | null = null
class ResizeObserverStub {
  constructor(cb: ROCallback) {
    roCallback = cb
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

/** 「半页大桌牌版」：宽扁模板（宽 > 高），是第 355 轮被裁顶的典型 */
const deskHalf = defaultTemplates.find((t) => t.id === 'deskHalf')!
const standard = defaultTemplates.find((t) => t.id === 'standard')!

async function mountThumb(template = deskHalf) {
  const wrapper = mount(TemplateThumb, { props: { template } })
  await wrapper.vm.$nextTick()
  return wrapper
}

async function resize(wrapper: ReturnType<typeof mount>, width: number, height: number) {
  roCallback?.([{ contentRect: { width, height } }])
  await wrapper.vm.$nextTick()
}

/** 第 373 轮：卡片四周各留 3% 安全边，缩放按容器 94% 计算 */
const SAFE_FIT = 0.94

function scaleOf(style: string): number {
  const m = /scale\(([\d.]+)\)/.exec(style)
  expect(m).not.toBeNull()
  return Number(m![1])
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  roCallback = null
})
afterEach(() => vi.unstubAllGlobals())

describe('第 355 轮：模板缩略图 transform-origin 顶部居中 + 按容器宽高计算缩放', () => {
  it('卡片以顶部居中为缩放原点（origin-top + left-1/2 + translateX(-50%)），不再用固定负偏移', async () => {
    const wrapper = await mountThumb()
    const card = wrapper.find('[data-testid="template-thumb-card"]')
    expect(card.classes()).toContain('origin-top')
    expect(card.classes()).toContain('top-[3%]')
    expect(card.classes()).toContain('left-1/2')
    expect(card.classes()).not.toContain('origin-top-left')
    expect(card.attributes('style')).toContain('translateX(-50%)')
    expect(card.attributes('style')).not.toMatch(/margin-top:\s*-|top:\s*-/)
    wrapper.unmount()
  })

  it('外层容器 aspect-ratio 与模板纸张比例一致（宽扁模板保持宽扁）', async () => {
    const wrapper = await mountThumb()
    expect(deskHalf.label.width).toBeGreaterThan(deskHalf.label.height)
    const container = wrapper.find('.overflow-hidden')
    expect(container.attributes('style')).toContain(`aspect-ratio: ${deskHalf.label.width} / ${deskHalf.label.height}`)
    wrapper.unmount()
  })

  it('未测到尺寸前隐藏；测到后按 min(宽比, 高比) 缩放，宽扁模板整张落在容器内', async () => {
    const wrapper = await mountThumb()
    const card = wrapper.find('[data-testid="template-thumb-card"]')
    expect(card.attributes('style')).toContain('visibility: hidden')

    const naturalW = deskHalf.label.width * MM_TO_PX
    const naturalH = deskHalf.label.height * MM_TO_PX
    // 容器按比例给足高度：缩放 = 宽比 × 94%（四周各留 3% 安全边）
    await resize(wrapper, 224, (224 * naturalH) / naturalW)
    expect(card.attributes('style')).not.toContain('visibility: hidden')
    expect(scaleOf(card.attributes('style')!)).toBeCloseTo((224 * SAFE_FIT) / naturalW, 4)
    expect(naturalH * scaleOf(card.attributes('style')!)).toBeLessThanOrEqual((224 * naturalH) / naturalW + 0.01)

    // 容器高度被压缩到一半：改由高比决定，标签不会被裁顶/裁底
    const shortH = ((224 * naturalH) / naturalW) * 0.5
    await resize(wrapper, 224, shortH)
    expect(scaleOf(card.attributes('style')!)).toBeCloseTo((shortH * SAFE_FIT) / naturalH, 4)
    expect(naturalW * scaleOf(card.attributes('style')!)).toBeLessThanOrEqual(224 + 0.01)
    wrapper.unmount()
  })

  it('竖版模板同样按容器宽度缩放', async () => {
    const wrapper = await mountThumb(standard)
    const card = wrapper.find('[data-testid="template-thumb-card"]')
    const naturalW = standard.label.width * MM_TO_PX
    const naturalH = standard.label.height * MM_TO_PX
    await resize(wrapper, 64, (64 * naturalH) / naturalW)
    expect(scaleOf(card.attributes('style')!)).toBeCloseTo((64 * SAFE_FIT) / naturalW, 4)
    wrapper.unmount()
  })
})

describe('第 362 轮：defer 懒渲染的 IntersectionObserver 预取距离', () => {
  it('rootMargin 放宽到 900px，快速滚动一屏内的占位卡更早换成真实缩略图', async () => {
    const seen: Array<IntersectionObserverInit | undefined> = []
    class IntersectionObserverStub {
      constructor(_cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        seen.push(options)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)
    const wrapper = mount(TemplateThumb, { props: { template: standard, defer: true } })
    await wrapper.vm.$nextTick()
    expect(seen).toHaveLength(1)
    expect(seen[0]?.rootMargin).toBe('900px')
    wrapper.unmount()
  })
})
