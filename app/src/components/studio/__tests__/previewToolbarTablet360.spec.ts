// @vitest-environment jsdom
/**
 * 第 360 轮：预览工具栏平板（md–xl）收敛——统计 chip 合并为一枚、左簇 min-w-0 + 右簇 ml-auto、
 * 导出按钮短标签但 aria-label / title 保留完整文案、testid 不变、缩放选择 <xl 用 w-20。
 * 跟进：md–xl 两簇 display:contents 让全部控件在同一 flex-wrap 内紧凑排布（xl 起恢复左/右簇），
 * 汇总 chip 纸张只取预设名（A4），「打印 / 矢量 PDF」在 md–xl 显示为「打印」但 aria-label 完整。
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

function mountPreview() {
  useWorkspaceStore().useDemoData()
  return mount(PreviewArea, {
    global: { stubs: { LabelSheet: true, CalibrationDialog: true, DuplexGuideDialog: true, Teleport: true } },
  })
}

describe('PreviewArea 平板工具栏收敛（r360）', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('统计 chip：<xl 一枚汇总「N 个标签 · P 页 · 纸张」，三枚原 chip 仅 xl 显示', async () => {
    const wrapper = mountPreview()
    await wrapper.vm.$nextTick()
    const ws = useWorkspaceStore()
    const summary = wrapper.get('[data-testid="preview-toolbar-summary"]')
    expect(summary.classes()).toContain('xl:hidden')
    const text = summary.text()
    expect(text).toContain(`${ws.excel.rows.length} 个标签`)
    expect(text).toContain(`${ws.totalPages} 页`)
    expect(text.split(' · ')).toHaveLength(3)
    expect(text.endsWith(' · A4')).toBe(true)
    const chips = summary.element.parentElement!.querySelectorAll('span')
    expect(chips).toHaveLength(4)
    Array.from(chips)
      .slice(1)
      .forEach((chip) => {
        expect(chip.classList.contains('hidden')).toBe(true)
        expect(chip.classList.contains('xl:inline')).toBe(true)
      })
    wrapper.unmount()
  })

  it('左簇 flex-wrap + min-w-0 且含统计与翻页器；右簇 ml-auto；toolbar testid 与 sticky 不变', async () => {
    const wrapper = mountPreview()
    await wrapper.vm.$nextTick()
    const toolbar = wrapper.get('[data-testid="preview-toolbar"]')
    expect(toolbar.classes()).toContain('sticky')
    const left = wrapper.get('[data-testid="preview-toolbar-left"]')
    expect(left.classes()).toEqual(
      expect.arrayContaining(['flex', 'flex-wrap', 'min-w-0', 'md:max-xl:contents']),
    )
    expect(left.find('[data-testid="preview-toolbar-summary"]').exists()).toBe(true)
    expect(left.find('input[type="number"]').exists()).toBe(true)
    const right = wrapper.get('[data-testid="export-pdf-button"]').element.parentElement!
    expect(right.classList.contains('ml-auto')).toBe(true)
    expect(right.classList.contains('md:max-xl:contents')).toBe(true)
    expect(right.parentElement).toBe(toolbar.element)
    expect(left.element.parentElement).toBe(toolbar.element)
    wrapper.unmount()
  })

  it('导出按钮：md–xl 短标签 PDF / PNG，完整文案保留在 aria-label 与 title，testid 不变', async () => {
    const wrapper = mountPreview()
    await wrapper.vm.$nextTick()
    const pdf = wrapper.get('[data-testid="export-pdf-button"]')
    expect(pdf.attributes('aria-label')).toBe('图片版 PDF（推荐）')
    expect(pdf.attributes('title')).toContain('PDF')
    const pdfSpans = pdf.findAll('span')
    const full = pdfSpans.find((s) => s.text() === '图片版 PDF')!
    expect(full.classes()).toEqual(expect.arrayContaining(['md:hidden', 'xl:inline']))
    const short = pdfSpans.find((s) => s.text() === 'PDF')!
    expect(short.classes()).toEqual(expect.arrayContaining(['hidden', 'md:inline', 'xl:hidden']))
    const recommended = pdfSpans.find((s) => s.text() === '（推荐）')!
    expect(recommended.classes()).toEqual(expect.arrayContaining(['hidden', 'md:inline', 'md:max-xl:hidden']))
    expect(pdf.find('[data-testid="export-quota-badge"]').exists()).toBe(true)

    const png = wrapper.get('[data-testid="export-png-button"]')
    expect(png.attributes('aria-label')).toBe('图片 PNG')
    const pngSpans = png.findAll('span')
    expect(pngSpans.find((s) => s.text() === '图片 PNG')!.classes()).toEqual(
      expect.arrayContaining(['md:hidden', 'xl:inline']),
    )
    expect(pngSpans.find((s) => s.text() === 'PNG')!.classes()).toEqual(
      expect.arrayContaining(['hidden', 'md:inline', 'xl:hidden']),
    )

    // 「打印 / 矢量 PDF」：sm–md 与 xl 起显示全文，md–xl 只显示「打印」，aria-label 恒为全文
    const print = wrapper.findAll('button').find((b) => b.text().includes('矢量 PDF'))!
    expect(print.text().replace(/\s+/g, ' ')).toBe('打印 / 矢量 PDF')
    expect(print.attributes('aria-label')).toBe('打印 / 矢量 PDF')
    const printSuffix = print.findAll('span').find((s) => s.text().includes('矢量 PDF'))!
    expect(printSuffix.classes()).toEqual(
      expect.arrayContaining(['hidden', 'sm:inline', 'md:max-xl:hidden']),
    )
    wrapper.unmount()
  })

  it('缩放选择 <xl 用 w-20、xl 起 w-24', async () => {
    const wrapper = mountPreview()
    await wrapper.vm.$nextTick()
    const toolbar = wrapper.get('[data-testid="preview-toolbar"]')
    const zoom = toolbar.findAll('.w-20').find((el) => el.classes().includes('xl:w-24'))
    expect(zoom).toBeTruthy()
    expect(toolbar.findAll('.w-24').filter((el) => !el.classes().includes('xl:w-24'))).toHaveLength(0)
    wrapper.unmount()
  })
})
