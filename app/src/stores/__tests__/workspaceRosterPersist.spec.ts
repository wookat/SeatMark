/**
 * 第 362 轮：名单会话持久化不再对 excel.rows / photos 做深度 watch。
 * rows / headers 只整体替换，照片只影响 hadPhotos 布尔，因此逐张追加照片不应反复触发
 * 整份名单的 JSON.stringify 与 sessionStorage 写入；写出的 JSON 结构与键名不变，恢复结果一致。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useWorkspaceStore } from '@/stores/workspace'
import type { DataRow } from '@/types/template'

const ROSTER_KEY = 'seatmark.workspace-roster.v1'

function bigRoster(n: number): { headers: string[]; rows: DataRow[] } {
  const headers = ['姓名', '学号', '考场', '座位号', '班级', '性别', '备注', '电话', '邮箱', '地址', '年级', '组别']
  const rows: DataRow[] = []
  for (let i = 0; i < n; i++) {
    const row: DataRow = {}
    for (const h of headers) row[h] = `${h}${i}`
    rows.push(row)
  }
  return { headers, rows }
}

describe('第 362 轮：workspace 名单持久化去全量深度 watch', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('5000 行名单后追加 200 张照片：sessionStorage.setItem ≤ 2 次，恢复后 rows/mapping/photoColumn 一致', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const workspace = useWorkspaceStore()
    const { headers, rows } = bigRoster(5000)
    workspace.applyDataset('大名单.xlsx', headers, rows)
    await vi.advanceTimersByTimeAsync(500)
    const rosterWrites = () => setItem.mock.calls.filter((c) => c[0] === ROSTER_KEY).length
    expect(rosterWrites()).toBe(1)

    workspace.setPhotoColumn('学号')
    // 每张之间隔开超过防抖窗口：若仍深度监听 photos，每张都会触发一次整份名单写入
    for (let i = 0; i < 200; i++) {
      workspace.photos.set(`学号${i}`, `blob:photo-${i}`)
      await vi.advanceTimersByTimeAsync(450)
    }
    await vi.advanceTimersByTimeAsync(500)
    // hadPhotos 只在 size 0→1 翻转一次；与 photoColumn 变更合并进同一次防抖写入
    expect(rosterWrites()).toBeLessThanOrEqual(2)

    const saved = JSON.parse(sessionStorage.getItem(ROSTER_KEY)!) as Record<string, unknown>
    expect(Object.keys(saved).sort()).toEqual(
      ['fileName', 'hadPhotos', 'headers', 'isDemoData', 'mapping', 'photoColumn', 'rows', 'sheetName'].sort(),
    )
    expect(saved['hadPhotos']).toBe(true)
    expect(saved['photoColumn']).toBe('学号')

    const mappingBefore = { ...workspace.mapping }
    setActivePinia(createPinia())
    const restored = useWorkspaceStore()
    expect(restored.excel.rows).toEqual(rows)
    expect(restored.excel.headers).toEqual(headers)
    expect({ ...restored.mapping }).toEqual(mappingBefore)
    expect(restored.photoColumn).toBe('学号')
    expect(restored.excel.fileName).toBe('大名单.xlsx')
  })

  it('mapping 单键改动仍触发持久化（小对象保留 deep watch）', async () => {
    const workspace = useWorkspaceStore()
    workspace.applyDataset('名单.xlsx', ['姓名', '考场'], [{ 姓名: '张三', 考场: '01' }])
    await vi.advanceTimersByTimeAsync(500)
    workspace.setMappingValue('name', '考场')
    await vi.advanceTimersByTimeAsync(500)
    const saved = JSON.parse(sessionStorage.getItem(ROSTER_KEY)!) as { mapping: Record<string, string> }
    expect(saved.mapping['name']).toBe('考场')
  })

  it('清空数据后移除 sessionStorage 记录', async () => {
    const workspace = useWorkspaceStore()
    workspace.applyDataset('名单.xlsx', ['姓名'], [{ 姓名: '张三' }])
    await vi.advanceTimersByTimeAsync(500)
    expect(sessionStorage.getItem(ROSTER_KEY)).toBeTruthy()
    workspace.clearData()
    await vi.advanceTimersByTimeAsync(500)
    expect(sessionStorage.getItem(ROSTER_KEY)).toBeNull()
  })
})
