// @vitest-environment jsdom
/**
 * 第 359 轮：预览工具栏「显示选项」折叠从 <sm 扩到 <xl（640–1279 也收纳），
 * 1024 宽下折叠容器默认 hidden、点击后 flex；「打印 / 矢量 PDF」副标题仍按 sm 显示。
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

describe('PreviewArea 显示选项折叠（<xl）', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    localStorage.clear()
    setActivePinia(createPinia())
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('max-width: 639px') ? false : false,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => false,
      })),
    )
  })

  it('1024 宽：折叠按钮 xl:hidden、容器 xl:contents 且默认 hidden，点击后 flex', async () => {
    useWorkspaceStore().useDemoData()
    const wrapper = mount(PreviewArea, {
      global: { stubs: { LabelSheet: true, CalibrationDialog: true, DuplexGuideDialog: true, Teleport: true } },
    })
    await wrapper.vm.$nextTick()

    const toggle = wrapper.get('[data-testid="display-options-toggle"]')
    expect(toggle.classes()).toContain('xl:hidden')
    expect(toggle.classes()).not.toContain('sm:hidden')
    expect(toggle.attributes('aria-expanded')).toBe('false')

    const panel = toggle.element.nextElementSibling as HTMLElement
    expect(panel.classList.contains('xl:contents')).toBe(true)
    expect(panel.classList.contains('sm:contents')).toBe(false)
    expect(panel.classList.contains('hidden')).toBe(true)
    expect(panel.classList.contains('flex')).toBe(false)
    // 低频显示选项（裁切线/高亮缺失/…）都在折叠容器内，演示数据下至少 3 个复选框
    expect(panel.querySelectorAll('input[type="checkbox"]').length).toBeGreaterThanOrEqual(3)

    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(panel.classList.contains('flex')).toBe(true)
    expect(panel.classList.contains('hidden')).toBe(false)

    // 主导出按钮不在折叠容器内，且「/ 矢量 PDF」副标题仍是 sm:inline（不随本轮改动）
    const pdf = wrapper.get('[data-testid="export-pdf-button"]')
    expect(panel.contains(pdf.element)).toBe(false)
    const vectorPdf = wrapper.findAll('span').find((s) => s.text().includes('矢量 PDF'))
    expect(vectorPdf).toBeTruthy()
    expect(vectorPdf!.classes()).toContain('sm:inline')
    wrapper.unmount()
  })
})
