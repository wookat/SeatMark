/**
 * 名单的会话级持久化（P2：经 URL ?template= 整页跳转不丢名单）：
 * 导入名单写入 sessionStorage，工作区重建（整页跳转/刷新）时自动恢复，
 * 行为与侧栏卡片切换模板保持一致。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useWorkspaceStore } from '@/stores/workspace'

const ROSTER_KEY = 'seatmark.workspace-roster.v1'

describe('workspace 名单会话持久化', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  it('导入名单后（防抖 400ms）写入 sessionStorage', async () => {
    vi.useFakeTimers()
    try {
      const workspace = useWorkspaceStore()
      workspace.applyDataset('名单.xlsx', ['姓名', '考场'], [{ 姓名: '张三', 考场: '01' }])
      await vi.advanceTimersByTimeAsync(500)
      const raw = sessionStorage.getItem(ROSTER_KEY)
      expect(raw).toBeTruthy()
      const saved = JSON.parse(raw!) as { rows: unknown[]; headers: string[] }
      expect(saved.rows).toHaveLength(1)
      expect(saved.headers).toEqual(['姓名', '考场'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('工作区重建（整页跳转/刷新）时从 sessionStorage 恢复名单与映射', () => {
    sessionStorage.setItem(
      ROSTER_KEY,
      JSON.stringify({
        fileName: '名单.xlsx',
        sheetName: 'Sheet1',
        headers: ['姓名'],
        rows: [{ 姓名: '李四' }],
        mapping: { name: '姓名' },
        isDemoData: false,
      }),
    )
    const workspace = useWorkspaceStore()
    expect(workspace.excel.rows).toHaveLength(1)
    expect(workspace.excel.headers).toEqual(['姓名'])
    expect(workspace.mapping['name']).toBe('姓名')
    expect(workspace.isDemoData).toBe(false)
  })

  it('损坏的持久化数据回落为空名单', () => {
    sessionStorage.setItem(ROSTER_KEY, '{not json')
    const workspace = useWorkspaceStore()
    expect(workspace.excel.rows).toHaveLength(0)
  })
})
