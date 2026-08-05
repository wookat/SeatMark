import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useWorkspaceStore } from '@/stores/workspace'

function seed(ws: ReturnType<typeof useWorkspaceStore>) {
  ws.excel.headers = ['姓名', '座位号', '考场']
  ws.excel.rows = [
    { 姓名: '甲', 座位号: '12', 考场: '3' },
    { 姓名: '乙', 座位号: '5', 考场: '3' },
  ]
}

/** 找到当前模板中一个可映射文本字段的 id */
function firstFieldId(ws: ReturnType<typeof useWorkspaceStore>): string {
  return ws.mappableFields[0]!.id
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

describe('组合字段（模板串）取值', () => {
  it('映射为模板串时按 {列名} 求值', () => {
    const ws = useWorkspaceStore()
    seed(ws)
    const fieldId = firstFieldId(ws)
    ws.setMappingValue(fieldId, '第{考场}考场-{座位号}号')
    expect(ws.fieldText(ws.excel.rows[0]!, fieldId)).toBe('第3考场-12号')
    expect(ws.fieldText(ws.excel.rows[1]!, fieldId)).toBe('第3考场-5号')
  })

  it('普通单列映射不受影响', () => {
    const ws = useWorkspaceStore()
    seed(ws)
    const fieldId = firstFieldId(ws)
    ws.setMappingValue(fieldId, '姓名')
    expect(ws.fieldText(ws.excel.rows[0]!, fieldId)).toBe('甲')
  })
})

describe('单张覆写（Edit One）', () => {
  it('覆写只影响对应行，baseFieldText 不受影响', () => {
    const ws = useWorkspaceStore()
    seed(ws)
    const fieldId = firstFieldId(ws)
    ws.setMappingValue(fieldId, '姓名')
    const row = ws.excel.rows[0]!
    ws.setRowOverride(row, { [fieldId]: '手改名' })
    expect(ws.fieldText(row, fieldId)).toBe('手改名')
    expect(ws.baseFieldText(row, fieldId)).toBe('甲')
    expect(ws.fieldText(ws.excel.rows[1]!, fieldId)).toBe('乙')
    expect(ws.overrideCount).toBe(1)
  })

  it('传空对象等价于清除该行覆写', () => {
    const ws = useWorkspaceStore()
    seed(ws)
    const fieldId = firstFieldId(ws)
    const row = ws.excel.rows[0]!
    ws.setRowOverride(row, { [fieldId]: 'X' })
    ws.setRowOverride(row, {})
    expect(ws.overrideCount).toBe(0)
    expect(ws.overridesFor(row)).toBeUndefined()
  })

  it('clearRowOverride 只清指定行', () => {
    const ws = useWorkspaceStore()
    seed(ws)
    const fieldId = firstFieldId(ws)
    ws.setRowOverride(ws.excel.rows[0]!, { [fieldId]: 'A' })
    ws.setRowOverride(ws.excel.rows[1]!, { [fieldId]: 'B' })
    ws.clearRowOverride(ws.excel.rows[0]!)
    expect(ws.overrideCount).toBe(1)
    expect(ws.fieldText(ws.excel.rows[1]!, fieldId)).toBe('B')
  })

  it('重新导入名单时覆写全部清除', () => {
    const ws = useWorkspaceStore()
    seed(ws)
    const fieldId = firstFieldId(ws)
    ws.setRowOverride(ws.excel.rows[0]!, { [fieldId]: 'X' })
    ws.applyDataset('新名单', ['姓名'], [{ 姓名: '新人' }])
    expect(ws.overrideCount).toBe(0)
  })
})
