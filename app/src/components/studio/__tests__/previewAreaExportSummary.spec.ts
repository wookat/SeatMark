// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import PreviewArea from '@/components/studio/PreviewArea.vue'
import SelectField from '@/components/ui/SelectField.vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { summarizeDuplicateRows } from '@/utils/duplicateRows'

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

async function openExportDialog(
  wrapper: Awaited<ReturnType<typeof mountPreview>>,
  kind: 'pdf' | 'png' | 'print',
) {
  const buttons = wrapper.findAll('button')
  const btn =
    kind === 'png'
      ? buttons.find((b) => b.attributes('data-testid') === 'export-png-button')
      : kind === 'pdf'
        ? buttons.find((b) => b.attributes('data-testid') === 'export-pdf-button')
        : buttons.find((b) => (b.attributes('aria-label') ?? '').startsWith('打印 /'))
  expect(btn).toBeTruthy()
  await btn!.trigger('click')
  await wrapper.vm.$nextTick()
}

describe('第 363 轮：导出弹窗「本次输出」摘要', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('演示数据：三种导出弹窗均含模板名 · A4 · 26 个标签 / 2 页 · 水印状态', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    expect(workspace.excel.rows.length).toBe(26)
    expect(workspace.totalPages).toBe(2)

    const wrapper = await mountPreview()
    for (const kind of ['pdf', 'print'] as const) {
      await openExportDialog(wrapper, kind)
      const summary = wrapper.find('[data-testid="export-summary"]')
      expect(summary.exists()).toBe(true)
      const text = summary.text()
      expect(text).toContain(workspace.template.name)
      expect(text).toContain('A4')
      expect(text).toContain('26')
      expect(text).toContain('2 页')
      expect(text).toContain('带底边细线水印')
      // 摘要在输出副标题列表之上
      const html = wrapper.find('[role="dialog"]').html()
      expect(html.indexOf('export-summary')).toBeLessThan(html.indexOf('output-subtitles'))
      await wrapper.find('button[aria-label="关闭"]').trigger('click')
      await wrapper.vm.$nextTick()
    }
    wrapper.unmount()
  })

  it('PNG：按标签导出写「26 张 PNG，打包 zip」，切到整页后写「2 张整页 PNG」', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()

    const wrapper = await mountPreview()
    await openExportDialog(wrapper, 'png')
    const summary = () => wrapper.find('[data-testid="export-summary"]').text()
    expect(summary()).toContain('26 张 PNG，打包 zip')
    expect(summary()).toContain('A4')

    // SelectField 为自绘下拉：直接触发 update:modelValue
    const unit = wrapper.findAllComponents(SelectField).find((s) => s.attributes('id') === 'png-unit')
    expect(unit).toBeTruthy()
    unit!.vm.$emit('update:modelValue', 'page')
    await wrapper.vm.$nextTick()
    expect(summary()).toContain('2 张整页 PNG')
    expect(summary()).not.toContain('打包 zip')
    wrapper.unmount()
  })
})

describe('第 363 轮：导出前重复行检查', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('summarizeDuplicateRows：3 行中 2 行完全相同 → 1 组 / 2 行并给出示例；全部不同 → 0', () => {
    const rows = [
      { 姓名: '张三', 考场: '3 考场', 座位号: '12 号' },
      { 姓名: '李四', 考场: '3 考场', 座位号: '13 号' },
      { 姓名: '张三 ', 考场: '3 考场', 座位号: '12 号' },
    ]
    const texts = (r: (typeof rows)[number]) => [r.姓名, r.考场, r.座位号]
    expect(summarizeDuplicateRows(rows, texts)).toEqual({
      groups: 1,
      rows: 2,
      example: '张三·3 考场·12 号',
    })
    expect(summarizeDuplicateRows(rows.slice(0, 2), texts)).toEqual({
      groups: 0,
      rows: 0,
      example: null,
    })
    // 全空行不算重复
    expect(summarizeDuplicateRows([{ a: '' }, { a: ' ' }], (r) => [r.a]).groups).toBe(0)
  })

  it('workspace.duplicateRows 只看已映射字段；弹窗渲染提示条，「仍然导出」收起且不改数据', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    const [first] = workspace.mappableFields
    const header = workspace.mapping[first!.id]!
    const base = workspace.excel.rows.slice(0, 3).map((row) => ({ ...row }))
    workspace.excel.rows = base
    expect(workspace.duplicateRows.groups).toBe(0)

    // 第 3 行复制第 1 行 → 完全重复
    workspace.excel.rows = [base[0]!, base[1]!, { ...base[0]! }]
    expect(workspace.duplicateRows).toMatchObject({ groups: 1, rows: 2 })
    expect(workspace.duplicateRows.example).toContain(String(base[0]![header]))

    const wrapper = await mountPreview()
    await openExportDialog(wrapper, 'pdf')
    const notice = wrapper.find('[data-testid="duplicate-rows-export-notice"]')
    expect(notice.exists()).toBe(true)
    expect(notice.text()).toContain('2')
    expect(notice.text()).toContain('行内容完全重复')
    expect(notice.text()).toContain('示例：')
    expect(notice.text()).toContain(String(base[0]![header]))

    await wrapper.find('[data-testid="duplicate-rows-export-anyway"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="duplicate-rows-export-notice"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="choose-clean"]').exists()).toBe(true)
    expect(workspace.excel.rows.length).toBe(3)
    expect(workspace.duplicateRows.rows).toBe(2)
    wrapper.unmount()
  })

  it('「去查看」关闭弹窗并抛 focusMapping；名单无重复时不渲染', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    const base = workspace.excel.rows.slice(0, 2)
    workspace.excel.rows = [base[0]!, base[1]!, { ...base[1]! }]

    const wrapper = await mountPreview()
    await openExportDialog(wrapper, 'png')
    await wrapper.find('[data-testid="duplicate-rows-go-mapping"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('focusMapping')).toHaveLength(1)
    expect(wrapper.find('[data-testid="output-subtitles"]').exists()).toBe(false)

    workspace.excel.rows = [base[0]!, base[1]!]
    await openExportDialog(wrapper, 'png')
    expect(wrapper.find('[data-testid="duplicate-rows-export-notice"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="export-summary"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
