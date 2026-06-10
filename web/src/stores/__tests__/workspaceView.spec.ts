import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useWorkspaceStore } from '@/stores/workspace'

function seed(ws: ReturnType<typeof useWorkspaceStore>) {
  ws.excel.headers = ['姓名', '座位号', '考场']
  ws.excel.rows = [
    { 姓名: '甲', 座位号: '12', 考场: '第1考场' },
    { 姓名: '乙', 座位号: '3', 考场: '第2考场' },
    { 姓名: '丙', 座位号: '101', 考场: '第1考场' },
    { 姓名: '丁', 座位号: '', 考场: '第2考场' },
  ]
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('workspace 数据视图（筛选 / 排序决定排版顺序）', () => {
  it('默认按导入顺序展示', () => {
    const ws = useWorkspaceStore()
    seed(ws)
    expect(ws.displayRows.map((r) => r['姓名'])).toEqual(['甲', '乙', '丙', '丁'])
    expect(ws.isViewCustomized).toBe(false)
  })

  it('数字列按数值升序、空值排最后；再点降序，第三次还原', () => {
    const ws = useWorkspaceStore()
    seed(ws)
    ws.toggleSort('座位号')
    expect(ws.displayRows.map((r) => r['座位号'])).toEqual(['3', '12', '101', ''])
    ws.toggleSort('座位号')
    expect(ws.displayRows.map((r) => r['座位号'])).toEqual(['', '101', '12', '3'])
    ws.toggleSort('座位号')
    expect(ws.displayRows.map((r) => r['姓名'])).toEqual(['甲', '乙', '丙', '丁'])
    expect(ws.isViewCustomized).toBe(false)
  })

  it('列筛选只保留勾选取值，排版页面跟随视图顺序', () => {
    const ws = useWorkspaceStore()
    seed(ws)
    ws.setColumnFilter('考场', ['第1考场'])
    expect(ws.displayRows.map((r) => r['姓名'])).toEqual(['甲', '丙'])
    expect(ws.pages.flat()).toEqual(ws.displayRows)
    ws.setColumnFilter('考场', null)
    expect(ws.displayRows).toHaveLength(4)
    expect(ws.isViewCustomized).toBe(false)
  })

  it('筛选与排序可叠加，resetDataView 一键恢复原序', () => {
    const ws = useWorkspaceStore()
    seed(ws)
    ws.setColumnFilter('考场', ['第1考场'])
    ws.toggleSort('座位号')
    expect(ws.displayRows.map((r) => r['座位号'])).toEqual(['12', '101'])
    expect(ws.isViewCustomized).toBe(true)
    ws.resetDataView()
    expect(ws.isViewCustomized).toBe(false)
    expect(ws.displayRows.map((r) => r['姓名'])).toEqual(['甲', '乙', '丙', '丁'])
  })
})
