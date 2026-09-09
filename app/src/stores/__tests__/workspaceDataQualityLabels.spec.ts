// @vitest-environment jsdom
/**
 * 第 372 轮：数据质量重复提示按当前模板的字段 label 措辞——
 * 考场模板仍是「考场 + 座位号」/「准考证号」，会议签到模板显示「会场 + 座位号」，英文下显示英文字段名。
 */
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import MappingPanel from '@/components/studio/MappingPanel.vue'
import { defaultTemplates } from '@/data/defaultTemplates'
import { setLocale } from '@/i18n'
import { createAppRouter } from '@/router'
import { useWorkspaceStore } from '@/stores/workspace'

function templateById(id: string) {
  const template = defaultTemplates.find((x) => x.id === id)
  if (!template) throw new Error(`no template ${id}`)
  return template
}

/** 两行「房间 + 座位号」相同、两行准考证号相同的名单 */
function seedDuplicates(ws: ReturnType<typeof useWorkspaceStore>) {
  ws.excel.headers = ['姓名', '房间', '座位', '编号']
  ws.excel.rows = [
    { 姓名: '甲', 房间: 'A', 座位: '1', 编号: 'X1' },
    { 姓名: '乙', 房间: 'A', 座位: '1', 编号: 'X1' },
    { 姓名: '丙', 房间: 'B', 座位: '2', 编号: 'X3' },
  ]
  for (const f of ws.mappableFields) {
    const column =
      f.id === 'name' ? '姓名' : f.id === 'room' ? '房间' : f.id === 'seatNo' ? '座位' : f.id === 'examId' ? '编号' : ''
    ws.setMappingValue(f.id, column)
  }
}

function mountPanel() {
  return mount(MappingPanel, {
    global: { plugins: [createAppRouter()], stubs: { RouterLink: true } },
  })
}

describe('第 372 轮：dataQuality 重复提示字段 label', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(async () => {
    await setLocale('zh')
  })

  it('考场模板：label 为考场 / 座位号 / 准考证号，MappingPanel 文案与旧口径一致', async () => {
    const ws = useWorkspaceStore()
    seedDuplicates(ws)
    expect(ws.dataQuality.duplicateSeatKeys).toBe(1)
    expect(ws.dataQuality.duplicateExamIds).toBe(1)
    expect(ws.dataQuality.duplicateSeatKeyLabels).toEqual({ room: '考场', seat: '座位号' })
    expect(ws.dataQuality.duplicateExamIdLabel).toBe('准考证号')

    const wrapper = mountPanel()
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="duplicate-seat-keys"]').text()).toBe('1 个「考场 + 座位号」组合重复')
    expect(wrapper.get('[data-testid="duplicate-exam-ids"]').text()).toBe('1 个准考证号重复')
    wrapper.unmount()
  })

  it('会议签到桌牌模板（room label 为「会场」）：提示写「会场 + 座位号」而非「考场」', async () => {
    const ws = useWorkspaceStore()
    const signage = templateById('signage')
    expect(signage.fields.find((f) => f.id === 'room')?.label).toBe('会场')
    ws.selectTemplate(signage)
    seedDuplicates(ws)
    expect(ws.dataQuality.duplicateSeatKeyLabels).toEqual({ room: '会场', seat: '座位号' })
    expect(ws.dataQuality.duplicateExamIdLabel).toBe('签到号')

    const wrapper = mountPanel()
    await wrapper.vm.$nextTick()
    const text = wrapper.get('[data-testid="duplicate-seat-keys"]').text()
    expect(text).toBe('1 个「会场 + 座位号」组合重复')
    expect(text).not.toContain('考场')
    expect(wrapper.get('[data-testid="duplicate-exam-ids"]').text()).toBe('1 个签到号重复')
    wrapper.unmount()
  })

  it('英文：字段名走既有字段翻译，无 CJK', async () => {
    await setLocale('en')
    const ws = useWorkspaceStore()
    ws.selectTemplate(templateById('signage'))
    seedDuplicates(ws)
    const wrapper = mountPanel()
    await wrapper.vm.$nextTick()
    const seatText = wrapper.get('[data-testid="duplicate-seat-keys"]').text()
    const examText = wrapper.get('[data-testid="duplicate-exam-ids"]').text()
    expect(seatText).toBe('1 duplicate Venue + Seat No. combinations')
    expect(examText).toBe('1 duplicate Check-in No. values')
    expect(seatText + examText).not.toMatch(/[\u4e00-\u9fff]/)
    wrapper.unmount()
  })
})
