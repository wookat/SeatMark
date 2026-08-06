/**
 * 第 6 轮回归 P1 防线：长会话导出静默失败
 * - 看门狗覆盖整条单页链路（挂载/就绪等待挂起也会超时报错，杜绝静默挂死）
 * - 就绪等待（fonts.ready / 图片 decode）有时间上限
 * - 「重试仍失败」时重建离屏容器再做最后一次重渲
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { exportPagedPdf, settleWithin } from '@/utils/pdfExport'

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

function blankCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 0
  c.height = 0
  return c
}

function inkCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 10
  c.height = 10
  // jsdom 无 toBlob 实现：直接替换为返回非空 Blob 的实现
  c.toBlob = (cb: BlobCallback) => cb(new Blob([new Uint8Array([1, 2, 3])]))
  return c
}

beforeEach(() => {
  localStorage.clear()
  saveMock.mockClear()
  html2canvasMock.mockReset()
})

describe('settleWithin：就绪等待兜底', () => {
  it('永不落定的 Promise 到时放行（返回 undefined）', async () => {
    const never = new Promise<void>(() => {})
    await expect(settleWithin(never, 20)).resolves.toBeUndefined()
  })

  it('按时完成则透传结果，被拒绝也不抛错', async () => {
    await expect(settleWithin(Promise.resolve(7), 1000)).resolves.toBe(7)
    await expect(settleWithin(Promise.reject(new Error('x')), 1000)).resolves.toBeUndefined()
  })
})

describe('看门狗覆盖整条单页链路（P1 静默挂死回归）', () => {
  it('getPage 永不返回时按超时报错并带页码，而非静默挂起', async () => {
    const getPage = vi.fn(() => new Promise<HTMLElement>(() => {}))
    await expect(
      exportPagedPdf({ pageCount: 2, getPage, pageTimeoutMs: 30 }),
    ).rejects.toThrow('第 1/2 页渲染失败：渲染超时')
    // 超时后自动重试一次，仍超时才失败
    expect(getPage).toHaveBeenCalledTimes(2)
  })
})

describe('容器劣化兜底：重试仍失败时重建离屏容器再重渲', () => {
  it('重建后重渲成功：导出完成，rebuildHost 恰好调用一次', async () => {
    html2canvasMock
      .mockResolvedValueOnce(blankCanvas())
      .mockResolvedValueOnce(blankCanvas())
      .mockResolvedValueOnce(inkCanvas())
    const rebuildHost = vi.fn()
    await exportPagedPdf({
      pageCount: 1,
      getPage: () => document.createElement('div'),
      rebuildHost,
    })
    expect(rebuildHost).toHaveBeenCalledTimes(1)
    expect(html2canvasMock).toHaveBeenCalledTimes(3)
    expect(saveMock).toHaveBeenCalledTimes(1)
  })

  it('重建后仍空白：以页码明确报错，绝不静默', async () => {
    html2canvasMock.mockResolvedValue(blankCanvas())
    const rebuildHost = vi.fn()
    await expect(
      exportPagedPdf({
        pageCount: 1,
        getPage: () => document.createElement('div'),
        rebuildHost,
      }),
    ).rejects.toThrow('第 1/1 页渲染失败：页面渲染为空白')
    expect(rebuildHost).toHaveBeenCalledTimes(1)
    expect(html2canvasMock).toHaveBeenCalledTimes(3)
    expect(saveMock).not.toHaveBeenCalled()
  })

  it('未提供 rebuildHost 时保持原有「重试一次即失败」行为', async () => {
    html2canvasMock.mockResolvedValue(blankCanvas())
    await expect(
      exportPagedPdf({ pageCount: 1, getPage: () => document.createElement('div') }),
    ).rejects.toThrow('第 1/1 页渲染失败：页面渲染为空白')
    expect(html2canvasMock).toHaveBeenCalledTimes(2)
  })
})
