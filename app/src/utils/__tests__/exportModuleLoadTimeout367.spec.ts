/**
 * 第 367 轮：导出依赖（html2canvas-pro / jspdf）按需加载永不落定时，
 * 导出链路必须在 20 s 内以「导出组件加载超时」reject，而不是让「正在准备页面…」无限停留。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

/** 永不落定的动态 import 替身 */
const neverSettle = () => new Promise<never>(() => {})

afterEach(() => {
  vi.doUnmock('html2canvas-pro')
  vi.doUnmock('jspdf')
  vi.resetModules()
  vi.useRealTimers()
})

describe('第 367 轮：导出组件加载超时兜底', () => {
  it('常量：超时 20 s，文案为「导出组件加载超时，请检查网络后重试」', async () => {
    const { MODULE_LOAD_TIMEOUT_MS, MODULE_LOAD_TIMEOUT_MESSAGE } = await import('@/utils/pdfExport')
    expect(MODULE_LOAD_TIMEOUT_MS).toBe(20_000)
    expect(MODULE_LOAD_TIMEOUT_MESSAGE).toBe('导出组件加载超时，请检查网络后重试')
  })

  it('PNG 整页导出：html2canvas-pro 永不落定 → 20 s 内 reject 且错误文案匹配', async () => {
    vi.useFakeTimers()
    vi.doMock('html2canvas-pro', neverSettle)
    vi.resetModules()
    const { exportPagedPng } = await import('@/utils/pngExport')
    const getPage = vi.fn(() => document.createElement('div'))
    const result = exportPagedPng({ pageCount: 2, getPage, pageWidth: 210, pageHeight: 297 })
    let settled = false
    const expectation = expect(result).rejects.toThrow('导出组件加载超时，请检查网络后重试')
    void result.catch(() => {
      settled = true
    })
    await vi.advanceTimersByTimeAsync(19_999)
    // 未到 20 s 不应误报
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await expectation
    expect(settled).toBe(true)
    expect(getPage).not.toHaveBeenCalled()
  })

  it('PNG 逐标签导出：同样受 20 s 加载超时保护', async () => {
    vi.useFakeTimers()
    vi.doMock('html2canvas-pro', neverSettle)
    vi.resetModules()
    const { exportPagedPng } = await import('@/utils/pngExport')
    const getPage = vi.fn(() => document.createElement('div'))
    const result = exportPagedPng({
      pageCount: 1,
      getPage,
      pageWidth: 210,
      pageHeight: 297,
      labelsByPage: [[{ rect: { x: 0, y: 0, width: 90, height: 54 } }]],
    })
    const expectation = expect(result).rejects.toThrow('导出组件加载超时，请检查网络后重试')
    await vi.advanceTimersByTimeAsync(20_000)
    await expectation
    expect(getPage).not.toHaveBeenCalled()
  })

  it('图片版 PDF 导出：jspdf 永不落定 → 20 s 内 reject 且错误文案匹配', async () => {
    vi.useFakeTimers()
    vi.doMock('jspdf', neverSettle)
    vi.resetModules()
    const { exportPagedPdf } = await import('@/utils/pdfExport')
    const getPage = vi.fn(() => document.createElement('div'))
    const result = exportPagedPdf({ pageCount: 1, getPage })
    const expectation = expect(result).rejects.toThrow('导出组件加载超时，请检查网络后重试')
    await vi.advanceTimersByTimeAsync(20_000)
    await expectation
    expect(getPage).not.toHaveBeenCalled()
  })

  it('依赖按时加载：不触发超时（真实 html2canvas 分包在 jsdom 下可加载）', async () => {
    const { MODULE_LOAD_TIMEOUT_MS, withTimeout } = await import('@/utils/pdfExport')
    await expect(
      withTimeout(import('html2canvas-pro'), MODULE_LOAD_TIMEOUT_MS, 'x'),
    ).resolves.toHaveProperty('default')
  })
})
