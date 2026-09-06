// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import PreviewArea from '@/components/studio/PreviewArea.vue'
import { useWorkspaceStore } from '@/stores/workspace'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

async function mountPreview() {
  const wrapper = mount(PreviewArea, {
    global: {
      stubs: {
        LabelSheet: true,
        CalibrationDialog: true,
        DuplexGuideDialog: true,
        Teleport: true,
        Transition: true,
      },
    },
    attachTo: document.body,
  })
  await wrapper.vm.$nextTick()
  return wrapper
}

async function openPdfExportDialog(wrapper: Awaited<ReturnType<typeof mountPreview>>) {
  const exportBtn = wrapper
    .findAll('button')
    .find((b) => b.text().includes('导出 PDF') || (b.attributes('title') ?? '').includes('逐页渲染'))
  expect(exportBtn).toBeTruthy()
  await exportBtn!.trigger('click')
  await wrapper.vm.$nextTick()
}

describe('PreviewArea 导出弹窗：未映射字段提示条', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('有未映射字段时渲染提示条（含数量与字段名示例），「去映射」关闭弹窗并向上抛事件', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    const [first, second] = workspace.mappableFields
    expect(first && second).toBeTruthy()
    workspace.setMappingValue(first!.id, '')
    workspace.setMappingValue(second!.id, '')
    expect(workspace.unmappedFields.length).toBe(2)

    const wrapper = await mountPreview()
    await openPdfExportDialog(wrapper)

    const notice = wrapper.find('[data-testid="unmapped-export-notice"]')
    expect(notice.exists()).toBe(true)
    expect(notice.text()).toContain('2')
    expect(notice.text()).toContain('个字段未映射')
    expect(notice.text()).toContain(first!.label)
    expect(notice.text()).toContain(second!.label)
    expect(notice.text()).toContain('成品中将留空')

    // 三种输出的一行副标题在弹窗内可见
    const subtitles = wrapper.find('[data-testid="output-subtitles"]')
    expect(subtitles.text()).toContain('打印 / 矢量 PDF：文字可选中')
    expect(subtitles.text()).toContain('图片版 PDF：每页高清栅格')
    expect(subtitles.text()).toContain('PNG：逐张成图')

    await wrapper.find('[data-testid="unmapped-go-mapping"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('focusMapping')).toHaveLength(1)
    expect(wrapper.find('[data-testid="output-subtitles"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('「仍然导出」收起提示条但保留导出选项；重新打开弹窗再次提示', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    const [first] = workspace.mappableFields
    workspace.setMappingValue(first!.id, '')

    const wrapper = await mountPreview()
    await openPdfExportDialog(wrapper)
    expect(wrapper.find('[data-testid="unmapped-export-notice"]').exists()).toBe(true)

    await wrapper.find('[data-testid="unmapped-export-anyway"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="unmapped-export-notice"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="choose-clean"]').exists()).toBe(true)
    expect(wrapper.emitted('focusMapping')).toBeUndefined()

    // 关闭后重新打开：提示条重新出现
    const modalClose = wrapper.find('button[aria-label="关闭"]')
    expect(modalClose.exists()).toBe(true)
    await modalClose.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="choose-clean"]').exists()).toBe(false)
    await openPdfExportDialog(wrapper)
    expect(wrapper.find('[data-testid="unmapped-export-notice"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('全部字段已映射时不渲染提示条，副标题仍显示', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    expect(workspace.unmappedFields.length).toBe(0)

    const wrapper = await mountPreview()
    await openPdfExportDialog(wrapper)

    expect(wrapper.find('[data-testid="unmapped-export-notice"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="output-subtitles"]').exists()).toBe(true)

    wrapper.unmount()
  })
})
