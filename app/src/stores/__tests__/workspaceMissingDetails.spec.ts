// @vitest-environment jsdom
/**
 * 第 347 轮：dataQuality.missingDetails —— 逐行定位「已映射字段为空」的行号与字段。
 */
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useWorkspaceStore } from '@/stores/workspace'

function fieldByLabel(ws: ReturnType<typeof useWorkspaceStore>, label: string) {
  const field = ws.mappableFields.find((f) => f.label === label)
  if (!field) throw new Error(`no field ${label}`)
  return field
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

describe('第 347 轮：dataQuality.missingDetails', () => {
  it('3 行数据 1 行姓名空 1 行考场空 → 精确到行号与字段名', () => {
    const ws = useWorkspaceStore()
    ws.excel.headers = ['姓名', '考场']
    ws.excel.rows = [
      { 姓名: '甲', 考场: '3' },
      { 姓名: '', 考场: '3' },
      { 姓名: '丙', 考场: '  ' },
    ]
    const name = fieldByLabel(ws, '姓名')
    const room = fieldByLabel(ws, '考场')
    ws.setMappingValue(name.id, '姓名')
    ws.setMappingValue(room.id, '考场')
    for (const f of ws.mappableFields) {
      if (f.id !== name.id && f.id !== room.id) ws.setMappingValue(f.id, '')
    }

    expect(ws.dataQuality.missingRows).toBe(2)
    expect(ws.dataQuality.missingMore).toBe(0)
    expect(ws.dataQuality.missingDetails).toEqual([
      { rowIndex: 2, fields: ['姓名'] },
      { rowIndex: 3, fields: ['考场'] },
    ])
  })

  it('明细最多 20 条，超出部分计入 missingMore', () => {
    const ws = useWorkspaceStore()
    ws.excel.headers = ['姓名']
    ws.excel.rows = Array.from({ length: 25 }, () => ({ 姓名: '' }))
    const name = fieldByLabel(ws, '姓名')
    for (const f of ws.mappableFields) ws.setMappingValue(f.id, f.id === name.id ? '姓名' : '')

    expect(ws.dataQuality.missingRows).toBe(25)
    expect(ws.dataQuality.missingDetails).toHaveLength(20)
    expect(ws.dataQuality.missingDetails[0]).toEqual({ rowIndex: 1, fields: ['姓名'] })
    expect(ws.dataQuality.missingDetails[19]!.rowIndex).toBe(20)
    expect(ws.dataQuality.missingMore).toBe(5)
  })

  it('无空字段时 missingDetails 为空数组', () => {
    const ws = useWorkspaceStore()
    ws.excel.headers = ['姓名', '考场']
    ws.excel.rows = [{ 姓名: '甲', 考场: '3' }]
    const name = fieldByLabel(ws, '姓名')
    const room = fieldByLabel(ws, '考场')
    for (const f of ws.mappableFields) {
      ws.setMappingValue(f.id, f.id === name.id ? '姓名' : f.id === room.id ? '考场' : '')
    }
    expect(ws.dataQuality.missingRows).toBe(0)
    expect(ws.dataQuality.missingDetails).toEqual([])
  })
})
