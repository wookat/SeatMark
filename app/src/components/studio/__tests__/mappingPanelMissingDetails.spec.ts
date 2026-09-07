// @vitest-environment jsdom
/**
 * 第 347 轮：MappingPanel 数据质量提醒 —— 「N 行存在已映射字段为空」可展开为逐行清单（中英文）。
 */
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import MappingPanel from '@/components/studio/MappingPanel.vue'
import { setLocale } from '@/i18n'
import { createAppRouter } from '@/router'
import { useWorkspaceStore } from '@/stores/workspace'

function seedMissing() {
  const ws = useWorkspaceStore()
  ws.excel.headers = ['姓名', '考场']
  ws.excel.rows = [
    { 姓名: '甲', 考场: '3' },
    { 姓名: '', 考场: '3' },
    { 姓名: '丙', 考场: '' },
    { 姓名: '', 考场: '' },
  ]
  const name = ws.mappableFields.find((f) => f.label === '姓名')!
  const room = ws.mappableFields.find((f) => f.label === '考场')!
  for (const f of ws.mappableFields) {
    ws.setMappingValue(f.id, f.id === name.id ? '姓名' : f.id === room.id ? '考场' : '')
  }
  return ws
}

function mountPanel() {
  return mount(MappingPanel, {
    global: { plugins: [createAppRouter()], stubs: { RouterLink: true } },
  })
}

describe('第 347 轮：MappingPanel 空字段清单', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(async () => {
    await setLocale('zh')
  })

  it('中文：可展开 details 列出「第 X 行：字段 为空」', async () => {
    seedMissing()
    const wrapper = mountPanel()
    await wrapper.vm.$nextTick()
    const details = wrapper.get('[data-testid="missing-details"]')
    expect(details.element.tagName).toBe('DETAILS')
    expect(details.attributes('open')).toBeUndefined()
    expect(details.get('summary').text()).toContain('3 行存在已映射字段为空')
    const rows = details.findAll('[data-testid="missing-detail-row"]').map((r) => r.text())
    expect(rows).toEqual(['第 2 行：姓名 为空', '第 3 行：考场 为空', '第 4 行：姓名、考场 为空'])
    expect(details.text()).not.toContain('另有')
    wrapper.unmount()
  })

  it('英文：行号与字段名均为英文，无 CJK', async () => {
    await setLocale('en')
    seedMissing()
    const wrapper = mountPanel()
    await wrapper.vm.$nextTick()
    const details = wrapper.get('[data-testid="missing-details"]')
    const rows = details.findAll('[data-testid="missing-detail-row"]').map((r) => r.text())
    expect(rows).toEqual(['Row 2: Name empty', 'Row 3: Exam room empty', 'Row 4: Name, Exam room empty'])
    expect(details.text()).not.toMatch(/[\u4e00-\u9fff]/)
    wrapper.unmount()
  })

  it('超过 20 行时显示「另有 N 行」', async () => {
    const ws = seedMissing()
    ws.excel.rows = Array.from({ length: 23 }, () => ({ 姓名: '', 考场: '3' }))
    const wrapper = mountPanel()
    await wrapper.vm.$nextTick()
    const details = wrapper.get('[data-testid="missing-details"]')
    expect(details.findAll('[data-testid="missing-detail-row"]')).toHaveLength(20)
    expect(details.text()).toContain('另有 3 行')
    wrapper.unmount()
  })
})
