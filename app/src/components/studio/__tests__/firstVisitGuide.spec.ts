// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import FirstVisitGuide from '@/components/studio/FirstVisitGuide.vue'
import { setLocale } from '@/i18n'
import { useWorkspaceStore } from '@/stores/workspace'
import { studioGuideDismissed } from '@/utils/firstVisit'

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
    expect(wrapper.text()).toContain('Getting-started guide (4 steps)')
    expect(wrapper.text()).not.toMatch(CJK)
  })
})
