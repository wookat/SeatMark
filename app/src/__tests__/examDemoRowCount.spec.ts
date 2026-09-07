// @vitest-environment jsdom
/**
 * 第 353 轮：教程「用演示数据先试试」的条数口径与工坊实际一致——
 * 考场默认模板下 useDemoData() 载入的行数 = EXAM_DEMO_ROW_COUNT，且教程正文不再写死「30 条」。
 */
import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { defaultTemplates } from '@/data/defaultTemplates'
import { demoExcelFor, EXAM_DEMO_ROW_COUNT } from '@/data/demoDatasets'
import { findGuide, guides } from '@/data/guides'
import { useWorkspaceStore } from '@/stores/workspace'

describe('第 353 轮：考场演示数据条数口径', () => {
  it('工坊默认模板（考场）→ demoExcelFor 与 useDemoData 实际行数均等于 EXAM_DEMO_ROW_COUNT', () => {
    localStorage.clear()
    setActivePinia(createPinia())
    const workspace = useWorkspaceStore()
    expect(workspace.template.category).toBe('exam')
    expect(defaultTemplates[0]!.category).toBe('exam')
    expect(demoExcelFor(workspace.template).rows.length).toBe(EXAM_DEMO_ROW_COUNT)

    workspace.useDemoData()
    expect(workspace.excel.rows.length).toBe(EXAM_DEMO_ROW_COUNT)
    expect(workspace.isDemoData).toBe(true)
  })

  it('考场教程正文写的是 EXAM_DEMO_ROW_COUNT 条，全部教程无「30 条示例数据」字面量', () => {
    const guide = findGuide('exam-seat-label-batch-print')
    expect(guide).toBeDefined()
    expect(guide!.body).toContain(`${EXAM_DEMO_ROW_COUNT} 条示例数据`)
    for (const g of guides) {
      expect(g.body).not.toMatch(/30\s*条示例数据/)
    }
  })
})
