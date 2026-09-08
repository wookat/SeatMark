// @vitest-environment jsdom
/**
 * 第 361 轮：预览工具栏 md–lg（768–1023）从 3 行收敛到 2 行——
 * 汇总 chip 与缩放选择在 md:max-lg 隐藏，移入「显示选项」折叠面板首行（面板内复制一份缩放控件 + 汇总文本）；
 * <768 与 ≥1024 布局不变。
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

describe('PreviewArea md–lg 工具栏收敛到 2 行（r361）', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('汇总 chip 在 md:max-lg 隐藏，xl 仍隐藏（由三枚原 chip 承载）', async () => {
    const wrapper = mountPreview()
    await wrapper.vm.$nextTick()
    const summary = wrapper.get('[data-testid="preview-toolbar-summary"]')
    expect(summary.classes()).toEqual(expect.arrayContaining(['md:max-lg:hidden', 'xl:hidden']))
    expect(summary.classes()).not.toContain('hidden')
    wrapper.unmount()
  })

  it('工具栏缩放选择在 md:max-lg 隐藏；面板首行复制一份缩放控件 + 汇总文本，仅 md:max-lg 显示', async () => {
    const wrapper = mountPreview()
    await wrapper.vm.$nextTick()
    const zoom = wrapper.get('[data-testid="preview-zoom-select"]')
    expect(zoom.classes()).toEqual(expect.arrayContaining(['w-20', 'md:max-lg:hidden', 'xl:w-24']))

    const panel = wrapper.get('[data-testid="display-options-panel"]')
    const row = panel.get('[data-testid="display-options-md-row"]')
    expect(row.classes()).toEqual(expect.arrayContaining(['hidden', 'md:max-lg:flex', 'w-full']))
    expect(panel.element.firstElementChild).toBe(row.element)

    const zoomMd = row.get('[data-testid="preview-zoom-select-md"]')
    expect(zoomMd.classes()).toContain('w-20')
    expect(zoomMd.classes()).not.toContain('xl:w-24')
    expect(row.get('[data-testid="display-options-md-summary"]').text()).toBe(
      wrapper.get('[data-testid="preview-toolbar-summary"]').text(),
    )
    wrapper.unmount()
  })

  it('面板内缩放控件与工具栏缩放控件共用同一 zoomMode', async () => {
    const wrapper = mountPreview()
    await wrapper.vm.$nextTick()
    const zoom = wrapper.get('[data-testid="preview-zoom-select"]')
    const zoomMd = wrapper.get('[data-testid="preview-zoom-select-md"]')
    expect(zoom.get('button').text()).toBe(zoomMd.get('button').text())

    await zoomMd.get('button').trigger('click')
    const option = zoomMd.findAll('[role="option"]').find((o) => o.text().includes('200%'))!
    await option.trigger('click')
    expect(zoom.get('button').text()).toContain('200%')
    expect(zoomMd.get('button').text()).toContain('200%')
    wrapper.unmount()
  })

  it('折叠面板 xl 起 display:contents，不含面板首行以外的新增控件；md 仍在面板内', async () => {
    const wrapper = mountPreview()
    await wrapper.vm.$nextTick()
    const panel = wrapper.get('[data-testid="display-options-panel"]')
    expect(panel.classes()).toEqual(expect.arrayContaining(['w-full', 'xl:contents', 'hidden']))
    const toggle = wrapper.get('[data-testid="display-options-toggle"]')
    await toggle.trigger('click')
    expect(panel.classes()).toContain('flex')
    expect(panel.classes()).not.toContain('hidden')
    wrapper.unmount()
  })
})
