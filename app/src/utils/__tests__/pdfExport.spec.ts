import { describe, expect, it } from 'vitest'

import {
  defaultImageFormat,
  defaultPdfFileName,
  defaultRasterScale,
  estimatePdfBytes,
  exportPagedPdf,
  formatBytes,
  rasterDpi,
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
