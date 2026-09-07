// @vitest-environment jsdom
/**
 * 第 348 轮：工坊预览与映射消歧 ——
 * (a) 预览区顶部「有 N 个字段未匹配到名单列」可关闭提示条，点击跳转 MappingPanel；
 * (b) 映射下拉项追加首行示例值（截断 8 字），无数据时不追加，自动列名「列N」保持不变。
 */
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import MappingPanel from '@/components/studio/MappingPanel.vue'
import PreviewArea from '@/components/studio/PreviewArea.vue'
import SelectField, { type SelectOption } from '@/components/ui/SelectField.vue'
import { setLocale } from '@/i18n'
import { createAppRouter } from '@/router'
import { useWorkspaceStore } from '@/stores/workspace'
import { headerOptionLabel } from '@/utils/fieldTemplate'

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

function mountPanel() {
  return mount(MappingPanel, {
    global: { plugins: [createAppRouter()], stubs: { RouterLink: true } },
  })
}

/** 首个字段映射下拉的全部选项（SelectField 为自绘下拉，从 props 读） */
function firstMappingOptions(wrapper: ReturnType<typeof mountPanel>): SelectOption[] {
  const select = wrapper.findAllComponents(SelectField).find((s) =>
    (s.props('options') as SelectOption[]).some((o) => o.value === '姓名'),
  )
  expect(select).toBeTruthy()
  return select!.props('options') as SelectOption[]
}

describe('headerOptionLabel（纯函数）', () => {
  it('有首行值时追加「 · 示例」，超过 8 字截断加省略号', () => {
    expect(headerOptionLabel('姓名', { 姓名: '张三' })).toBe('姓名 · 张三')
    expect(headerOptionLabel('列2', { 列2: '张三' })).toBe('列2 · 张三')
    expect(headerOptionLabel('备注', { 备注: '一二三四五六七八九十' })).toBe('备注 · 一二三四五六七八…')
    expect(headerOptionLabel('备注', { 备注: '一二三四五六七八' })).toBe('备注 · 一二三四五六七八')
  })

  it('无数据 / 首行该列为空 / 仅空白时不追加', () => {
    expect(headerOptionLabel('姓名', undefined)).toBe('姓名')
    expect(headerOptionLabel('姓名', {})).toBe('姓名')
    expect(headerOptionLabel('姓名', { 姓名: '  ' })).toBe('姓名')
  })

  it('示例值内的换行/多空格压成单空格', () => {
    expect(headerOptionLabel('地址', { 地址: '北京\n海淀' })).toBe('地址 · 北京 海淀')
  })
})

describe('第 348 轮：MappingPanel 下拉示例值', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(async () => {
    await setLocale('zh')
  })

  it('下拉 option 文案为「表头 · 首行值」，自动列名「列N」保持原样', async () => {
    const ws = useWorkspaceStore()
    ws.excel.headers = ['姓名', '列2', '列3']
    ws.excel.rows = [
      { 姓名: '张三', 列2: '高三（1）班教室东侧', 列3: '' },
      { 姓名: '李四', 列2: 'B', 列3: '2' },
    ]
    const wrapper = mountPanel()
    await wrapper.vm.$nextTick()
    const options = firstMappingOptions(wrapper)
    const texts = options.map((o) => o.label)
    expect(texts).toContain('姓名 · 张三')
    expect(texts).toContain('列2 · 高三（1）班教室…')
    expect(texts).toContain('列3')
    // value 仍是原始表头，映射不受示例值影响
    const values = options.map((o) => o.value)
    expect(values).toContain('姓名')
    expect(values).toContain('列2')
    expect(values).not.toContain('姓名 · 张三')

    // 打开下拉后真实渲染的选项文案也带示例值
    const trigger = wrapper.findAll('button[aria-haspopup="listbox"]')[0]!
    await trigger.trigger('click')
    await wrapper.vm.$nextTick()
    const rendered = wrapper.findAll('[role="option"]').map((o) => o.text())
    expect(rendered).toContain('姓名 · 张三')
    wrapper.unmount()
  })

  it('无名单数据时 option 不追加示例值', async () => {
    const ws = useWorkspaceStore()
    ws.excel.headers = ['姓名', '考场']
    ws.excel.rows = []
    const wrapper = mountPanel()
    await wrapper.vm.$nextTick()
    const texts = firstMappingOptions(wrapper).map((o) => o.label)
    expect(texts).toContain('姓名')
    expect(texts).toContain('考场')
    expect(texts.some((x) => x.includes(' · '))).toBe(false)
    wrapper.unmount()
  })
})

describe('第 348 轮：PreviewArea 顶部未匹配字段提示条', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(async () => {
    await setLocale('zh')
  })

  it('有未映射字段且名单已导入时显示；点「去设置映射」抛 focusMapping；可关闭', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    const [first, second] = workspace.mappableFields
    workspace.setMappingValue(first!.id, '')
    workspace.setMappingValue(second!.id, '')
    expect(workspace.unmappedFields.length).toBe(2)

    const wrapper = await mountPreview()
    const banner = wrapper.get('[data-testid="unmapped-preview-banner"]')
    expect(banner.attributes('role')).toBe('status')
    expect(banner.text()).toContain('有 2 个字段未匹配到名单列，导出时会留空')
    expect(banner.text()).toContain(first!.label)
    expect(banner.text()).toContain('去设置映射')
    expect(banner.text()).not.toContain('未映射')

    await wrapper.get('[data-testid="unmapped-banner-go-mapping"]').trigger('click')
    expect(wrapper.emitted('focusMapping')).toHaveLength(1)
    expect(wrapper.emitted('focusMapping')![0]).toEqual(['missing'])

    await wrapper.get('[data-testid="unmapped-banner-dismiss"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="unmapped-preview-banner"]').exists()).toBe(false)

    // 重新导入名单（表头引用变化）后提示条重新出现
    workspace.excel.headers = [...workspace.excel.headers]
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="unmapped-preview-banner"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('全部字段已映射时不显示；名单为空时不显示', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    expect(workspace.unmappedFields.length).toBe(0)
    const wrapper = await mountPreview()
    expect(wrapper.find('[data-testid="unmapped-preview-banner"]').exists()).toBe(false)

    const [first] = workspace.mappableFields
    workspace.setMappingValue(first!.id, '')
    workspace.excel.rows = []
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="unmapped-preview-banner"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('英文下提示条文案为英文且不含嵌套括号', async () => {
    await setLocale('en')
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    const [first] = workspace.mappableFields
    workspace.setMappingValue(first!.id, '')
    const wrapper = await mountPreview()
    const text = wrapper.get('[data-testid="unmapped-preview-banner"]').text()
    expect(text).toContain('1 field(s) not matched to a roster column')
    expect(text).toContain('Set up mapping')
    expect(text).not.toMatch(/\(\(|\) \(/)
    wrapper.unmount()
  })
})
