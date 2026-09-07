// @vitest-environment jsdom
/**
 * 第 348 轮：预览工具栏「图片版 PDF（推荐）」按钮不换行、不被右上角次数徽标挤出；「（推荐）」仅 ≥md 显示。
 */
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PreviewArea from '@/components/studio/PreviewArea.vue'
import { useWorkspaceStore } from '@/stores/workspace'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('PreviewArea 导出按钮排版', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('PDF 按钮 whitespace-nowrap，「（推荐）」在 md 以下隐藏；按钮组容器可换行且带间距', async () => {
    useWorkspaceStore().useDemoData()
    const wrapper = mount(PreviewArea, {
      global: { stubs: { LabelSheet: true, CalibrationDialog: true, DuplexGuideDialog: true, Teleport: true } },
    })
    await wrapper.vm.$nextTick()
    const pdf = wrapper.get('[data-testid="export-pdf-button"]')
    expect(pdf.classes()).toContain('whitespace-nowrap')
    const recommended = pdf.findAll('span').find((s) => s.text() === '（推荐）')
    expect(recommended).toBeTruthy()
    expect(recommended!.classes()).toContain('hidden')
    expect(recommended!.classes()).toContain('md:inline')
    expect(recommended!.classes()).not.toContain('sm:inline')

    const group = pdf.element.parentElement!
    expect(group.classList.contains('flex')).toBe(true)
    expect(group.classList.contains('flex-wrap')).toBe(true)
    expect([...group.classList].some((c) => /^gap-/.test(c))).toBe(true)
    wrapper.unmount()
  })
})
