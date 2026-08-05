import { describe, expect, it } from 'vitest'

import {
  defaultImageFormat,
  defaultPdfFileName,
  defaultRasterScale,
  exportPagedPdf,
  rasterDpi,
} from '@/utils/pdfExport'

describe('pdfExport 参数选取', () => {
  it('渲染倍率随页数递减：大页数任务控制内存与画布尺寸', () => {
    expect(defaultRasterScale(1)).toBe(5)
    expect(defaultRasterScale(6)).toBe(4)
    expect(defaultRasterScale(12)).toBe(3)
    expect(defaultRasterScale(30)).toBe(2.5)
    expect(defaultRasterScale(60)).toBe(2)
    expect(defaultRasterScale(200)).toBe(2)
  })

  it('倍率单调不增', () => {
    let prev = Infinity
    for (const n of [1, 2, 3, 6, 7, 12, 13, 30, 31, 100]) {
      const s = defaultRasterScale(n)
      expect(s).toBeLessThanOrEqual(prev)
      prev = s
    }
  })

  it('页少用 PNG 无损，页多用 JPEG 控制体积', () => {
    expect(defaultImageFormat(1)).toBe('png')
    expect(defaultImageFormat(6)).toBe('png')
    expect(defaultImageFormat(7)).toBe('jpeg')
    expect(defaultImageFormat(60)).toBe('jpeg')
  })

  it('rasterDpi 按 96dpi × 倍率换算', () => {
    expect(rasterDpi(2)).toBe(192)
    expect(rasterDpi(2.5)).toBe(240)
    expect(rasterDpi(5)).toBe(480)
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
