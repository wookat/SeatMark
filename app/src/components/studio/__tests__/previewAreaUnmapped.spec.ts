// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

  it('第 347 轮：已映射字段有空值时提示「N 行字段为空」，「去查看」带 missing 目标抛事件并关弹窗', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    const [first] = workspace.mappableFields
    const header = workspace.mapping[first!.id]!
    expect(header).toBeTruthy()
    workspace.excel.rows = workspace.excel.rows.slice(0, 3).map((row) => {
      const filled: Record<string, string> = {}
      for (const h of workspace.excel.headers) filled[h] = String(row[h] ?? '').trim() || 'x'
      return filled
    })
    expect(workspace.dataQuality.missingRows).toBe(0)
    workspace.excel.rows[0]![header] = ''
    workspace.excel.rows[2]![header] = ' '
    expect(workspace.dataQuality.missingRows).toBe(2)

    const wrapper = await mountPreview()
    await openPdfExportDialog(wrapper)

    const notice = wrapper.find('[data-testid="missing-rows-export-notice"]')
    expect(notice.exists()).toBe(true)
    expect(notice.text()).toContain('2')
    expect(notice.text()).toContain('行字段为空，成品中将留空')

    await wrapper.find('[data-testid="missing-rows-go-mapping"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('focusMapping')).toEqual([['missing']])
    expect(wrapper.find('[data-testid="output-subtitles"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('第 366 轮：导出提示附首个缺失示例（行号 + 姓名 + 字段），多行时带「等 N 行」，不阻断导出', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    const nameHeader = workspace.mapping['name']!
    const seatField = workspace.mappableFields.find((f) => f.id !== 'name' && workspace.mapping[f.id])!
    const seatHeader = workspace.mapping[seatField.id]!
    workspace.excel.rows = workspace.excel.rows.slice(0, 4).map((row, i) => {
      const filled: Record<string, string> = {}
      for (const h of workspace.excel.headers) filled[h] = String(row[h] ?? '').trim() || 'x'
      filled[nameHeader] = `学生${i + 1}`
      return filled
    })
    expect(workspace.dataQuality.missingRows).toBe(0)
    workspace.excel.rows[2]![seatHeader] = ''
    workspace.excel.rows[3]![seatHeader] = ''
    expect(workspace.dataQuality.missingRows).toBe(2)
    expect(workspace.dataQuality.missingDetails[0]).toEqual({ rowIndex: 3, fields: [seatField.label], name: '学生3' })

    const wrapper = await mountPreview()
    await openPdfExportDialog(wrapper)
    const notice = wrapper.get('[data-testid="missing-rows-export-notice"]')
    const example = notice.get('[data-testid="missing-rows-export-example"]')
    expect(example.text()).toBe(`例：第 3 行 学生3 · ${seatField.label}为空 等 2 行`)
    // 仍可继续导出：提示条只是说明，主按钮不被禁用
    expect(wrapper.find('[data-testid="missing-rows-go-mapping"]').exists()).toBe(true)
    const primary = wrapper.findAll('button').filter((b) => b.attributes('disabled') !== undefined && b.text().includes('导出'))
    expect(primary).toHaveLength(0)

    // 只剩 1 行缺失：不带「等 N 行」
    workspace.excel.rows[3]![seatHeader] = 'x'
    await wrapper.vm.$nextTick()
    expect(notice.get('[data-testid="missing-rows-export-example"]').text()).toBe(`例：第 3 行 学生3 · ${seatField.label}为空`)

    // 姓名本身为空时示例不带姓名
    workspace.excel.rows[2]![nameHeader] = ''
    await wrapper.vm.$nextTick()
    const emptyLabels = workspace.dataQuality.missingDetails[0]!.fields.join('、')
    expect(emptyLabels.split('、').sort()).toEqual(['姓名', seatField.label].sort())
    expect(notice.get('[data-testid="missing-rows-export-example"]').text()).toBe(`例：第 3 行 · ${emptyLabels}为空`)
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

describe('第 347 轮：导出弹窗移动端主按钮首屏可见', () => {
  const originalMatchMedia = window.matchMedia

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  function mockViewport(maxWidth639Matches: boolean) {
    window.matchMedia = ((query: string) =>
      ({
        matches: query.includes('max-width: 639px') ? maxWidth639Matches : false,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => false,
      }) as MediaQueryList) as typeof window.matchMedia
  }

  function selectEink(workspace: ReturnType<typeof useWorkspaceStore>) {
    const eink = defaultTemplates.find((tpl) => tpl.id === 'eink800')
    expect(eink).toBeTruthy()
    workspace.selectTemplate(eink!)
    expect(workspace.template.id).toBe('eink800')
  }

  it('两个导出按钮渲染在 ModalDialog 的 actions 区（不随高级选项内容滚动）', async () => {
    mockViewport(true)
    const workspace = useWorkspaceStore()
    workspace.useDemoData()

    const wrapper = await mountPreview()
    await openPngExportDialog(wrapper)

    const actions = wrapper.find('[data-testid="export-choice-actions"]')
    expect(actions.exists()).toBe(true)
    expect(actions.find('[data-testid="choose-clean"]').exists()).toBe(true)
    expect(actions.find('[data-testid="choose-watermark"]').exists()).toBe(true)
    expect(actions.text()).toContain('选择导出方式')
    // actions 区位于滚动正文之外：其祖先链中没有 overflow-y-auto 的正文容器
    const scrollBody = wrapper.find('[role="dialog"] .overflow-y-auto')
    expect(scrollBody.exists()).toBe(true)
    expect(scrollBody.find('[data-testid="choose-clean"]').exists()).toBe(false)
    expect(scrollBody.find('[data-testid="choose-watermark"]').exists()).toBe(false)
    expect(scrollBody.find('[data-testid="png-advanced-options"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('移动端（<640px）eink800 高级选项默认折叠；预设 800×480 仍在折叠内保留', async () => {
    mockViewport(true)
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    selectEink(workspace)

    const wrapper = await mountPreview()
    await openPngExportDialog(wrapper)

    const advanced = wrapper.find('[data-testid="png-advanced-options"]')
    expect(advanced.exists()).toBe(true)
    expect(advanced.element.hasAttribute('open')).toBe(false)
    expect(advanced.text()).toContain('分辨率预设（电子墨水屏）')
    expect(advanced.text()).toContain('800×480')

    wrapper.unmount()
  })

  it('桌面端（≥640px）eink800 高级选项仍默认展开', async () => {
    mockViewport(false)
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    selectEink(workspace)

    const wrapper = await mountPreview()
    await openPngExportDialog(wrapper)

    expect(wrapper.find('[data-testid="png-advanced-options"]').element.hasAttribute('open')).toBe(true)

    wrapper.unmount()
  })
})
