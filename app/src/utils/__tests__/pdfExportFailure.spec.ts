/**
 * 导出失败/取消路径回归：
 * - 开发注入开关可强制指定页渲染失败（回归验收「导出失败不扣配额」的可测试手段）
 * - 取消信号中断导出并抛 ExportCancelledError
 * - 两种路径都不生成 PDF、不消费配额（配额只在导出成功后消费）
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { QUOTA_ANON_DAILY, useQuotaStore } from '@/stores/quota'
import {
  DEV_FORCE_EXPORT_FAIL_KEY,
  devForcedExportFailure,
  ExportCancelledError,
  exportPagedPdf,
} from '@/utils/pdfExport'

const saveMock = vi.hoisted(() => vi.fn())
const html2canvasMock = vi.hoisted(() => vi.fn())

vi.mock('jspdf', () => ({
  jsPDF: class {
    addPage() {}
    addImage() {}
    save = saveMock
  },
}))

vi.mock('html2canvas-pro', () => ({ default: html2canvasMock }))

describe('开发注入强制导出失败（localStorage 开关，仅 DEV 生效）', () => {
  beforeEach(() => {
    localStorage.clear()
    saveMock.mockClear()
    html2canvasMock.mockClear()
  })

  it('未设置开关时不注入', () => {
    expect(devForcedExportFailure(0)).toBeNull()
  })

  it('开关值为页码（1 起），仅对应页注入失败', () => {
    localStorage.setItem(DEV_FORCE_EXPORT_FAIL_KEY, '2')
    expect(devForcedExportFailure(0)).toBeNull()
    expect(devForcedExportFailure(1)).toBeInstanceOf(Error)
    localStorage.setItem(DEV_FORCE_EXPORT_FAIL_KEY, 'on')
    expect(devForcedExportFailure(0)).toBeInstanceOf(Error)
  })

  it('注入后 exportPagedPdf 带页码报错，且不写入 PDF', async () => {
    localStorage.setItem(DEV_FORCE_EXPORT_FAIL_KEY, '1')
    await expect(
      exportPagedPdf({ pageCount: 3, getPage: () => document.createElement('div') }),
    ).rejects.toThrow('第 1/3 页渲染失败：开发注入：强制页面渲染失败')
    expect(html2canvasMock).not.toHaveBeenCalled()
    expect(saveMock).not.toHaveBeenCalled()
  })

  it('取消信号中断导出：抛 ExportCancelledError 且不写入 PDF', async () => {
    const aborter = new AbortController()
    aborter.abort()
    await expect(
      exportPagedPdf({
        pageCount: 2,
        getPage: () => document.createElement('div'),
        signal: aborter.signal,
      }),
    ).rejects.toBeInstanceOf(ExportCancelledError)
    expect(saveMock).not.toHaveBeenCalled()
  })
})

describe('导出失败路径不消费配额（配额只在成功后消费）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    saveMock.mockClear()
  })

  it('注入失败的导出流程结束后，匿名配额剩余次数不变', async () => {
    const quota = useQuotaStore()
    expect(quota.remaining).toBe(QUOTA_ANON_DAILY)

    localStorage.setItem(DEV_FORCE_EXPORT_FAIL_KEY, '1')
    // 与 PreviewArea.doExportPdf 一致的顺序：先导出，成功后才 tryConsume
    let consumed = false
    try {
      await exportPagedPdf({ pageCount: 1, getPage: () => document.createElement('div') })
      await quota.tryConsume()
      consumed = true
    } catch {
      // 失败路径：不调用 tryConsume
    }
    expect(consumed).toBe(false)
    expect(quota.remaining).toBe(QUOTA_ANON_DAILY)
    expect(localStorage.getItem('seatmark.clean-export-usage.v1')).toBeNull()
  })

  it('用户取消导出后，匿名配额剩余次数不变', async () => {
    const quota = useQuotaStore()
    const aborter = new AbortController()
    aborter.abort()
    let cancelled = false
    try {
      await exportPagedPdf({
        pageCount: 1,
        getPage: () => document.createElement('div'),
        signal: aborter.signal,
      })
      await quota.tryConsume()
    } catch (err) {
      cancelled = err instanceof ExportCancelledError
    }
    expect(cancelled).toBe(true)
    expect(quota.remaining).toBe(QUOTA_ANON_DAILY)
  })
})
