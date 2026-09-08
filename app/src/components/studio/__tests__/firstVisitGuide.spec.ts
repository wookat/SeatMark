// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import FirstVisitGuide from '@/components/studio/FirstVisitGuide.vue'
import { setLocale } from '@/i18n'
import { useWorkspaceStore } from '@/stores/workspace'
import { markStudioExported, studioExportedOnce, studioGuideDismissed } from '@/utils/firstVisit'

const CJK = /[\u4e00-\u9fff]/

describe('FirstVisitGuide 四步引导', () => {
  beforeEach(async () => {
    localStorage.clear()
    setActivePinia(createPinia())
    studioGuideDismissed.value = false
    await setLocale('zh')
  })

  afterEach(async () => {
    await setLocale('zh')
  })

  it('zh：标题「选模板、导入名单、核对预览、导出打印，4 步」，四步与左侧 1-4 编号一一对应', () => {
    const wrapper = mount(FirstVisitGuide)
    expect(wrapper.text()).toContain('选模板、导入名单、核对预览、导出打印，4 步')
    const steps = wrapper.findAll('li')
    expect(steps).toHaveLength(4)
    expect(steps.map((li) => li.find('p').text())).toEqual([
      '选模板',
      '导入名单',
      '核对字段映射与版式',
      '导出打印',
    ])
    // 未导入前：第 1 步已完成（打勾），2/3/4 显示编号
    expect(steps[1]!.text()).toContain('2')
    expect(steps[2]!.text()).toContain('3')
    expect(steps[3]!.text()).toContain('4')
    expect(steps[2]!.text()).toContain('字段已按表头自动匹配，若表头不同请手动选择')
  })

  it('导入演示数据后第 2 步打勾并提示名单已就绪', async () => {
    const wrapper = mount(FirstVisitGuide)
    useWorkspaceStore().useDemoData()
    await wrapper.vm.$nextTick()
    const steps = wrapper.findAll('li')
    expect(steps[1]!.text()).toContain('名单已就绪')
    expect(steps[1]!.find('svg').exists()).toBe(true)
    expect(wrapper.find('.btn-primary').exists()).toBe(false)
  })

  it('en：四步文案全部英文，无中英混排', async () => {
    await setLocale('en')
    const wrapper = mount(FirstVisitGuide)
    expect(wrapper.text()).toContain('Pick a template, import the list, check the preview, export — 4 steps')
    const steps = wrapper.findAll('li')
    expect(steps).toHaveLength(4)
    for (const li of steps) expect(li.text(), li.text()).not.toMatch(CJK)
    expect(steps[2]!.text()).toContain('Check field mapping & layout')
  })
})

describe('第 346 轮：FirstVisitGuide compact 折叠态', () => {
  beforeEach(async () => {
    localStorage.clear()
    setActivePinia(createPinia())
    studioGuideDismissed.value = false
    await setLocale('zh')
  })

  it('compact=true 时只渲染单行「新手四步引导 ▸」，点击展开后恢复完整四步；compact 回 false 自动恢复完整态', async () => {
    const wrapper = mount(FirstVisitGuide, { props: { compact: true } })
    expect(wrapper.find('[data-testid="first-visit-guide-compact"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="first-visit-guide"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('新手四步引导')
    expect(wrapper.text()).not.toContain('选模板、导入名单、核对预览、导出打印，4 步')
    expect(wrapper.findAll('li')).toHaveLength(0)

    await wrapper.find('[data-testid="first-visit-guide-compact"] button').trigger('click')
    expect(wrapper.find('[data-testid="first-visit-guide"]').exists()).toBe(true)
    expect(wrapper.findAll('li')).toHaveLength(4)

    // 错配消失 → 完整态；再次错配 → 重新折叠
    await wrapper.setProps({ compact: false })
    expect(wrapper.find('[data-testid="first-visit-guide"]').exists()).toBe(true)
    await wrapper.setProps({ compact: true })
    expect(wrapper.find('[data-testid="first-visit-guide-compact"]').exists()).toBe(true)
    expect(wrapper.findAll('li')).toHaveLength(0)
  })

  it('compact 默认 false：完整态与既有渲染一致；已关闭引导时 compact 也不渲染', async () => {
    const full = mount(FirstVisitGuide)
    expect(full.find('[data-testid="first-visit-guide"]').exists()).toBe(true)
    expect(full.find('[data-testid="first-visit-guide-compact"]').exists()).toBe(false)

    studioGuideDismissed.value = true
    const dismissed = mount(FirstVisitGuide, { props: { compact: true } })
    expect(dismissed.find('section').exists()).toBe(false)
  })

  it('en：折叠态文案为英文', async () => {
    await setLocale('en')
    const wrapper = mount(FirstVisitGuide, { props: { compact: true } })
    // 第 355 轮：390px 下胶囊不再截断为「Getting-started gu…」，英文改短为「Guide ▸」
    expect(wrapper.text()).toContain('Guide')
    expect(wrapper.text()).not.toContain('Getting-started')
    expect(wrapper.text()).not.toMatch(CJK)
  })
})

describe('第 352 轮：FirstVisitGuide compact 行保留演示数据按钮', () => {
  beforeEach(async () => {
    localStorage.clear()
    setActivePinia(createPinia())
    studioGuideDismissed.value = false
    await setLocale('zh')
  })

  it('compact + 无数据：单行内渲染「用演示数据先试试」小按钮（btn-sm，与展开箭头同行）；点击后导入演示数据并隐藏按钮', async () => {
    const wrapper = mount(FirstVisitGuide, { props: { compact: true } })
    const demo = wrapper.get('[data-testid="first-visit-guide-demo"]')
    expect(demo.text()).toBe('用演示数据先试试')
    expect(demo.classes()).toEqual(expect.arrayContaining(['btn', 'btn-sm', 'shrink-0']))
    const row = demo.element.parentElement!
    expect(row.classList.contains('flex')).toBe(true)
    expect(row.querySelector('[aria-expanded]')).toBeTruthy()
    expect(wrapper.findAll('li')).toHaveLength(0)

    await demo.trigger('click')
    expect(useWorkspaceStore().excel.rows.length).toBeGreaterThan(0)
    expect(wrapper.find('[data-testid="first-visit-guide-demo"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="first-visit-guide-compact"]').exists()).toBe(true)
  })

  it('compact + 已有数据：不渲染演示按钮；点击箭头仍展开完整四步', async () => {
    useWorkspaceStore().useDemoData()
    const wrapper = mount(FirstVisitGuide, { props: { compact: true } })
    expect(wrapper.find('[data-testid="first-visit-guide-demo"]').exists()).toBe(false)
    await wrapper.get('[data-testid="first-visit-guide-compact"] button[aria-expanded]').trigger('click')
    expect(wrapper.find('[data-testid="first-visit-guide"]').exists()).toBe(true)
    expect(wrapper.findAll('li')).toHaveLength(4)
    expect(wrapper.findAll('li')[1]!.text()).toContain('名单已就绪')
  })

  it('en：compact 行演示按钮为英文', async () => {
    await setLocale('en')
    const wrapper = mount(FirstVisitGuide, { props: { compact: true } })
    expect(wrapper.get('[data-testid="first-visit-guide-demo"]').text()).not.toMatch(CJK)
  })
})

describe('第 364 轮：第 3/4 步进度真实化', () => {
  beforeEach(async () => {
    localStorage.clear()
    setActivePinia(createPinia())
    studioGuideDismissed.value = false
    studioExportedOnce.value = false
    await setLocale('zh')
  })

  it('未导入名单：第 3 步未勾选；导入演示数据且字段全部映射 → 第 3 步 done', async () => {
    const wrapper = mount(FirstVisitGuide)
    expect(wrapper.findAll('li')[2]!.find('svg').exists()).toBe(false)
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    await wrapper.vm.$nextTick()
    expect(workspace.mappableFields.length).toBeGreaterThan(0)
    expect(workspace.unmappedFields).toHaveLength(0)
    const step3 = wrapper.findAll('li')[2]!
    expect(step3.find('svg').exists()).toBe(true)
    expect(step3.text()).toContain('字段已按表头自动匹配，若表头不同请手动选择')
  })

  it('有未映射字段 → 第 3 步不勾且提示「还有 N 个字段未对上列」', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    const first = workspace.mappableFields[0]!
    delete workspace.mapping[first.id]
    const wrapper = mount(FirstVisitGuide)
    await wrapper.vm.$nextTick()
    expect(workspace.unmappedFields.length).toBeGreaterThan(0)
    const step3 = wrapper.findAll('li')[2]!
    expect(step3.find('svg').exists()).toBe(false)
    expect(step3.text()).toContain(`还有 ${workspace.unmappedFields.length} 个字段未对上列`)
  })

  it('第 4 步跟随 studioExportedOnce：默认不勾，markStudioExported 后勾选', async () => {
    useWorkspaceStore().useDemoData()
    const wrapper = mount(FirstVisitGuide)
    expect(wrapper.findAll('li')[3]!.find('svg').exists()).toBe(false)
    markStudioExported()
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('li')[3]!.find('svg').exists()).toBe(true)
  })
})
