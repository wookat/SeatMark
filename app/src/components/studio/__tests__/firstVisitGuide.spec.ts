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

  it('zh：标题「四步拿到成品」，四步与左侧 1-4 编号一一对应', () => {
    const wrapper = mount(FirstVisitGuide)
    expect(wrapper.text()).toContain('四步拿到成品')
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
    expect(steps[2]!.text()).toContain('导入后自动匹配，一般无需改动')
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
    expect(wrapper.text()).toContain('Four steps to a finished print')
    const steps = wrapper.findAll('li')
    expect(steps).toHaveLength(4)
    for (const li of steps) expect(li.text(), li.text()).not.toMatch(CJK)
    expect(steps[2]!.text()).toContain('Check field mapping & layout')
  })
})
