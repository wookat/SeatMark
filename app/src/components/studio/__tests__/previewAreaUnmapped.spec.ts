// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import PreviewArea from '@/components/studio/PreviewArea.vue'
import { defaultTemplates } from '@/data/defaultTemplates'
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

async function openPngExportDialog(wrapper: Awaited<ReturnType<typeof mountPreview>>) {
  const exportBtn = wrapper.findAll('button').find((b) => b.text().includes('图片 PNG'))
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
    expect(subtitles.text()).toContain('打印 / 矢量 PDF：直接打印或交印刷厂（文字可选中、最清晰）')
    expect(subtitles.text()).toContain('图片版 PDF：发给别人打印的 PDF（保留排版，文件较大）')
    expect(subtitles.text()).toContain('PNG：发群/发朋友圈的图片（每张一图，多张打包 zip）')

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

describe('第 346 轮：PNG 导出弹窗高级选项默认折叠', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('普通模板：首屏只有成图单位 + 主按钮，输出尺寸/纯黑白/zip 命名收在默认折叠的「高级选项」里', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    expect(workspace.template.id).not.toBe('eink800')

    const wrapper = await mountPreview()
    await openPngExportDialog(wrapper)

    const advanced = wrapper.find('[data-testid="png-advanced-options"]')
    expect(advanced.exists()).toBe(true)
    expect(advanced.element.hasAttribute('open')).toBe(false)
    expect(advanced.find('summary').text()).toContain('高级选项')
    expect(advanced.text()).toContain('输出尺寸')
    expect(advanced.text()).toContain('纯黑白输出')
    expect(advanced.text()).toContain('zip 内文件命名')

    // 首屏：成图单位与主导出按钮在 details 之外
    expect(wrapper.find('label[for="png-unit"]').text()).toContain('成图单位')
    expect(advanced.find('label[for="png-unit"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="choose-clean"]').exists()).toBe(true)
    expect(advanced.find('[data-testid="choose-clean"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('电子座签模板（eink800）：高级选项默认展开', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    const eink = defaultTemplates.find((tpl) => tpl.id === 'eink800')
    expect(eink).toBeTruthy()
    workspace.selectTemplate(eink!)
    expect(workspace.template.id).toBe('eink800')

    const wrapper = await mountPreview()
    await openPngExportDialog(wrapper)

    const advanced = wrapper.find('[data-testid="png-advanced-options"]')
    expect(advanced.exists()).toBe(true)
    expect(advanced.element.hasAttribute('open')).toBe(true)
    expect(advanced.text()).toContain('分辨率预设（电子墨水屏）')

    wrapper.unmount()
  })
})
