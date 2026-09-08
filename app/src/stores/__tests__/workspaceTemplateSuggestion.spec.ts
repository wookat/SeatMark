/**
 * 第 368 轮：独立粘贴 / 文件导入低命中时推荐更匹配模板——
 * 默认考场模板遇「与会人员/头衔/公司/桌号」四列命中率 < 50% 时给出会议类模板推荐，
 * 一键切换后保留已导入名单且自动映射 ≥ 3；命中率足够时不推荐；站内带入链路不走推荐。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { defaultTemplates } from '@/data/defaultTemplates'
import { useWorkspaceStore } from '@/stores/workspace'
import {
  LOW_HIT_RATE,
  handoffMapStat,
  mapHitRate,
  pickBetterTemplate,
} from '@/utils/handoffTemplate'

const MEETING_HEADERS = ['与会人员', '头衔', '公司', '桌号']
const MEETING_ROWS = [
  { 与会人员: '张三', 头衔: '总经理', 公司: '甲公司', 桌号: '1' },
  { 与会人员: '李四', 头衔: '总监', 公司: '乙公司', 桌号: '2' },
]

describe('pickBetterTemplate', () => {
  const standard = defaultTemplates.find((t) => t.id === 'standard')!

  it('mapHitRate：mappable 为 0 时为 0', () => {
    expect(mapHitRate({ template: standard, mappable: 0, mapped: 0, unmapped: 0 })).toBe(0)
    expect(mapHitRate({ template: standard, mappable: 4, mapped: 3, unmapped: 1 })).toBe(0.75)
  })

  it('默认考场模板遇会议名单命中率 < 50%：推荐命中 ≥ 3 的会议类模板', () => {
    const current = handoffMapStat(standard, MEETING_HEADERS)
    expect(mapHitRate(current)).toBeLessThan(LOW_HIT_RATE)
    const picked = pickBetterTemplate([standard, ...defaultTemplates], MEETING_HEADERS)
    expect(picked).not.toBeNull()
    expect(picked!.template.id).not.toBe('standard')
    expect(picked!.mapped).toBeGreaterThanOrEqual(3)
    expect(mapHitRate(picked!)).toBeGreaterThanOrEqual(LOW_HIT_RATE)
  })

  it('命中率足够（考场四列全中）时不推荐', () => {
    expect(
      pickBetterTemplate([standard, ...defaultTemplates], ['姓名', '考场', '准考证号', '座位号']),
    ).toBeNull()
  })

  it('表头为空 / 无候选时不推荐', () => {
    expect(pickBetterTemplate([standard, ...defaultTemplates], [])).toBeNull()
    expect(pickBetterTemplate([], MEETING_HEADERS)).toBeNull()
  })
})

describe('workspace 模板推荐', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  it('粘贴会议四列到默认考场模板：出现推荐，切换后名单保留且自动映射 ≥ 3', () => {
    const workspace = useWorkspaceStore()
    expect(workspace.template.id).toBe('standard')
    workspace.applyDataset('粘贴的名单', MEETING_HEADERS, MEETING_ROWS, { suggestTemplate: true })

    // 词表补全后「与会人员」已能映射到 name，1/4 仍低于 50%
    expect(workspace.mappedCount).toBe(1)
    const suggestion = workspace.templateSuggestion
    expect(suggestion).not.toBeNull()
    expect(suggestion!.mapped).toBeGreaterThanOrEqual(3)
    const suggestedId = suggestion!.template.id
    const rowsBefore = workspace.excel.rows

    workspace.acceptTemplateSuggestion()
    expect(workspace.template.id).toBe(suggestedId)
    expect(workspace.templateSuggestion).toBeNull()
    // 切换模板不重新解析：仍是同一份名单
    expect(workspace.excel.rows).toBe(rowsBefore)
    expect(workspace.excel.rows).toEqual(MEETING_ROWS)
    expect(workspace.excel.headers).toEqual(MEETING_HEADERS)
    expect(workspace.mappedCount).toBeGreaterThanOrEqual(3)
    expect(workspace.mapping.name).toBe('与会人员')
  })

  it('保留当前：推荐消失，模板与名单不变', () => {
    const workspace = useWorkspaceStore()
    workspace.applyDataset('粘贴的名单', MEETING_HEADERS, MEETING_ROWS, { suggestTemplate: true })
    expect(workspace.templateSuggestion).not.toBeNull()
    workspace.dismissTemplateSuggestion()
    expect(workspace.templateSuggestion).toBeNull()
    expect(workspace.template.id).toBe('standard')
    expect(workspace.excel.rows).toHaveLength(2)
  })

  it('命中率足够时不推荐', () => {
    const workspace = useWorkspaceStore()
    workspace.applyDataset(
      '粘贴的名单',
      ['姓名', '考场', '准考证号', '座位号'],
      [{ 姓名: '张三', 考场: '01', 准考证号: '1001', 座位号: '1' }],
      { suggestTemplate: true },
    )
    expect(workspace.templateSuggestion).toBeNull()
  })

  it('站内带入链路（不传 suggestTemplate）不产生推荐', () => {
    const workspace = useWorkspaceStore()
    workspace.applyDataset('座位表.名单', MEETING_HEADERS, MEETING_ROWS)
    expect(workspace.templateSuggestion).toBeNull()
  })

  it('用户手动切换模板 / 清空名单后推荐消失', () => {
    const workspace = useWorkspaceStore()
    workspace.applyDataset('粘贴的名单', MEETING_HEADERS, MEETING_ROWS, { suggestTemplate: true })
    expect(workspace.templateSuggestion).not.toBeNull()
    workspace.selectTemplate(defaultTemplates.find((t) => t.id === 'deskName')!, { silent: true })
    expect(workspace.templateSuggestion).toBeNull()

    workspace.applyDataset('粘贴的名单', MEETING_HEADERS, MEETING_ROWS, { suggestTemplate: true })
    expect(workspace.templateSuggestion).not.toBeNull()
    workspace.clearData()
    expect(workspace.templateSuggestion).toBeNull()
  })
})
