// @vitest-environment jsdom
/**
 * 第 366 轮：名单会话持久化失败不再静默。
 * sessionStorage 配额抛错 / JSON 超预算（≈4 MB）→ rosterPersistFailed=true，
 * MappingPanel 渲染 data-testid="roster-persist-notice"；正常写入或清空后复位且不渲染。
 * 仍不引入任何上传或压缩上云，照片处理不变。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import MappingPanel from '@/components/studio/MappingPanel.vue'
import { createAppRouter } from '@/router'
import { useWorkspaceStore } from '@/stores/workspace'
import type { DataRow } from '@/types/template'

const ROSTER_KEY = 'seatmark.workspace-roster.v1'

function roster(n: number, cellLen = 4): { headers: string[]; rows: DataRow[] } {
  const headers = ['姓名', '学号', '考场', '座位号']
  const rows: DataRow[] = []
  for (let i = 0; i < n; i++) {
    const row: DataRow = {}
    for (const h of headers) row[h] = `${h}${i}`.padEnd(cellLen, 'x')
    rows.push(row)
  }
  return { headers, rows }
}

function quotaError(): Error {
  const e = new Error('The quota has been exceeded.')
  e.name = 'QuotaExceededError'
  return e
}

function mountPanel() {
  return mount(MappingPanel, {
    global: { plugins: [createAppRouter()], stubs: { RouterLink: true } },
  })
}

describe('第 366 轮：persistRoster 失败可见', () => {
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

  it('sessionStorage.setItem 抛 QuotaExceededError → rosterPersistFailed=true，提示渲染', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw quotaError()
    })
    const ws = useWorkspaceStore()
    expect(ws.rosterPersistFailed).toBe(false)
    const { headers, rows } = roster(50)
    ws.applyDataset('名单.xlsx', headers, rows)
    await vi.advanceTimersByTimeAsync(500)
    expect(ws.rosterPersistFailed).toBe(true)

    const w = mountPanel()
    await w.vm.$nextTick()
    const notice = w.find('[data-testid="roster-persist-notice"]')
    expect(notice.exists()).toBe(true)
    expect(notice.text()).toContain('名单较大，仅保存在当前页面内存')
    expect(notice.text()).toContain('数据仍不会离开浏览器')
    w.unmount()
  })

  it('正常写入 → rosterPersistFailed=false，不渲染提示；先失败后成功写入会复位', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const ws = useWorkspaceStore()
    const { headers, rows } = roster(26)
    ws.applyDataset('演示.xlsx', headers, rows)
    await vi.advanceTimersByTimeAsync(500)
    expect(setItem.mock.calls.some((c) => c[0] === ROSTER_KEY)).toBe(true)
    expect(ws.rosterPersistFailed).toBe(false)

    const w = mountPanel()
    await w.vm.$nextTick()
    expect(w.find('[data-testid="roster-persist-notice"]').exists()).toBe(false)
    w.unmount()

    setItem.mockImplementationOnce(() => {
      throw quotaError()
    })
    ws.applyDataset('名单 2.xlsx', headers, roster(30).rows)
    await vi.advanceTimersByTimeAsync(500)
    expect(ws.rosterPersistFailed).toBe(true)

    ws.applyDataset('名单 3.xlsx', headers, roster(20).rows)
    await vi.advanceTimersByTimeAsync(500)
    expect(ws.rosterPersistFailed).toBe(false)
  })

  it('JSON 超过约 4 MB 预算 → 跳过 setItem（不写 sessionStorage）且 rosterPersistFailed=true；清空名单后复位', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const ws = useWorkspaceStore()
    // 4 列 × 1200 字符 × 1000 行 ≈ 4.8 M 字符 > 4 MiB 预算
    const { headers, rows } = roster(1000, 1200)
    ws.applyDataset('超大名单.xlsx', headers, rows)
    await vi.advanceTimersByTimeAsync(500)
    expect(setItem.mock.calls.filter((c) => c[0] === ROSTER_KEY)).toHaveLength(0)
    expect(sessionStorage.getItem(ROSTER_KEY)).toBeNull()
    expect(ws.rosterPersistFailed).toBe(true)

    const w = mountPanel()
    await w.vm.$nextTick()
    expect(w.find('[data-testid="roster-persist-notice"]').exists()).toBe(true)
    w.unmount()

    ws.clearData()
    await vi.advanceTimersByTimeAsync(500)
    expect(ws.rosterPersistFailed).toBe(false)
  })
})
