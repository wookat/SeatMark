import { describe, expect, it, vi } from 'vitest'

import {
  defaultImageFormat,
  defaultPdfFileName,
  defaultRasterScale,
  estimatePdfBytes,
  EXPORT_CANCELLED_MESSAGE,
  exportPagedPdf,
  formatBytes,
  isCanvasBlank,
  isPixelDataBlank,
  rasterDpi,
  waitForElementReady,
  withTimeout,
} from '@/utils/pdfExport'

describe('pdfExport 参数选取', () => {
  it('渲染倍率随页数递减：≤2 页 300dpi，页多降到 150–200dpi', () => {
    expect(rasterDpi(defaultRasterScale(1))).toBe(300)
    expect(rasterDpi(defaultRasterScale(2))).toBe(300)
    expect(rasterDpi(defaultRasterScale(6))).toBe(240)
    expect(rasterDpi(defaultRasterScale(12))).toBeLessThanOrEqual(240)
    for (const n of [13, 30, 31, 60, 200]) {
      const dpi = rasterDpi(defaultRasterScale(n))
      expect(dpi).toBeGreaterThanOrEqual(150)
      expect(dpi).toBeLessThanOrEqual(200)
    }
  })

  it('倍率单调不增', () => {
    let prev = Infinity
    for (const n of [1, 2, 3, 6, 7, 12, 13, 30, 31, 100]) {
      const s = defaultRasterScale(n)
      expect(s).toBeLessThanOrEqual(prev)
      prev = s
    }
  })

  it('栅格格式统一 JPEG：避免 PNG 无损嵌入导致体积失控', () => {
    expect(defaultImageFormat(1)).toBe('jpeg')
    expect(defaultImageFormat(60)).toBe('jpeg')
  })

  it('体积预估：60 页 A4 默认参数应低于 50MB', () => {
    const bytes = estimatePdfBytes({
      pageCount: 60,
      scale: defaultRasterScale(60),
      pageWidth: 210,
      pageHeight: 297,
    })
    expect(bytes).toBeGreaterThan(1024 * 1024)
    expect(bytes).toBeLessThan(50 * 1024 * 1024)
  })

  it('体积预估随页数线性增长', () => {
    const one = estimatePdfBytes({ pageCount: 1, scale: 2, pageWidth: 210, pageHeight: 297 })
    const ten = estimatePdfBytes({ pageCount: 10, scale: 2, pageWidth: 210, pageHeight: 297 })
    expect(ten).toBeCloseTo(one * 10, -1)
  })

  it('formatBytes 输出人类可读体积', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(200 * 1024)).toBe('200 KB')
    expect(formatBytes(12.3 * 1024 * 1024)).toBe('12.3 MB')
  })

  it('rasterDpi 按 96dpi × 倍率换算', () => {
    expect(rasterDpi(2)).toBe(192)
    expect(rasterDpi(2.5)).toBe(240)
    expect(rasterDpi(3.125)).toBe(300)
  })

  it('文件名含日期戳与前缀', () => {
    expect(defaultPdfFileName()).toMatch(/^考场座位标签-\d{8}-\d{4}\.pdf$/)
    expect(defaultPdfFileName('桌牌')).toMatch(/^桌牌-/)
  })

  it('页数为 0 时报「没有可导出的页面」', async () => {
    await expect(
      exportPagedPdf({ pageCount: 0, getPage: () => document.createElement('div') }),
    ).rejects.toThrow('没有可导出的页面')
  })
})

describe('导出稳定性防线', () => {
  it('withTimeout：超时以指定文案 reject', async () => {
    const never = new Promise<void>(() => {})
    await expect(withTimeout(never, 10, '渲染超时')).rejects.toThrow('渲染超时')
  })

  it('withTimeout：按时完成则透传结果', async () => {
    await expect(withTimeout(Promise.resolve(42), 1000, 'x')).resolves.toBe(42)
  })

  it('withTimeout：按时失败则透传原错误', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000, 'x')).rejects.toThrow('boom')
  })

  it('isPixelDataBlank：全白/全透明视为空白', () => {
    expect(isPixelDataBlank([255, 255, 255, 255, 255, 255, 255, 255])).toBe(true)
    expect(isPixelDataBlank([0, 0, 0, 0])).toBe(true)
    expect(isPixelDataBlank([])).toBe(true)
  })

  it('isPixelDataBlank：存在可见非白像素即非空', () => {
    expect(isPixelDataBlank([255, 255, 255, 255, 30, 30, 30, 255])).toBe(false)
    expect(isPixelDataBlank([200, 200, 200, 255])).toBe(false)
  })

  it('isPixelDataBlank：接近白色的浅灰在阈值内仍算空白', () => {
    expect(isPixelDataBlank([252, 253, 251, 255])).toBe(true)
  })

  it('isCanvasBlank：零尺寸画布视为空白', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 0
    canvas.height = 0
    expect(isCanvasBlank(canvas)).toBe(true)
  })

  it('waitForElementReady：无图片节点也能正常完成', async () => {
    const el = document.createElement('div')
    await expect(waitForElementReady(el)).resolves.toBeUndefined()
  })

  it('取消信号已中止时立即以「已取消导出」失败，不调用 getPage', async () => {
    const getPage = vi.fn(() => document.createElement('div'))
    const abort = new AbortController()
    abort.abort()
    await expect(
      exportPagedPdf({ pageCount: 3, getPage, signal: abort.signal }),
    ).rejects.toThrow(EXPORT_CANCELLED_MESSAGE)
    expect(getPage).not.toHaveBeenCalled()
  })
})

describe('空白页自动重渲', () => {
  it('渲染结果持续空白：重试一次后报「第 N 页渲染失败」，绝不静默输出空白页', async () => {
    vi.doMock('html2canvas-pro', () => ({
      // 返回零尺寸画布 → isCanvasBlank 判空白
      default: vi.fn(async () => {
        const canvas = document.createElement('canvas')
        canvas.width = 0
        canvas.height = 0
        return canvas
      }),
    }))
    vi.resetModules()
    const { exportPagedPdf: exportWithMock } = await import('@/utils/pdfExport')
    const html2canvas = (await import('html2canvas-pro')).default

    const getPage = vi.fn(() => document.createElement('div'))
    await expect(
      exportWithMock({ pageCount: 2, getPage }),
    ).rejects.toThrow('第 1/2 页渲染失败：页面渲染为空白')
    // 首次空白后自动重渲一次（共 2 次），仍空白才失败
    expect(html2canvas).toHaveBeenCalledTimes(2)
    expect(getPage).toHaveBeenCalledTimes(2)

    vi.doUnmock('html2canvas-pro')
    vi.resetModules()
  })
})
