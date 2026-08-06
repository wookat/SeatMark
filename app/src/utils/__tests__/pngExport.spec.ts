import { describe, expect, it, vi } from 'vitest'

import {
  binarizePixelData,
  CSS_PX_PER_MM,
  defaultPngExportName,
  exactPixelHeight,
  exactPixelScale,
  exportPagedPng,
  isValidExactPixelWidth,
  pngPageFileName,
} from '@/utils/pngExport'

describe('精确像素映射', () => {
  it('eink800：200mm 宽映射 800px 的倍率 × 页面 CSS 宽度 = 800', () => {
    const scale = exactPixelScale(800, 200)
    expect(scale * 200 * CSS_PX_PER_MM).toBeCloseTo(800, 6)
  })

  it('高度按模板宽高比推导：200×120mm + 800px 宽 → 480px 高', () => {
    expect(exactPixelHeight(800, 200, 120)).toBe(480)
    expect(exactPixelHeight(1280, 200, 112.5)).toBe(720)
  })

  it('像素宽度校验：仅接受 100–4096 的整数', () => {
    expect(isValidExactPixelWidth(800)).toBe(true)
    expect(isValidExactPixelWidth(100)).toBe(true)
    expect(isValidExactPixelWidth(4096)).toBe(true)
    expect(isValidExactPixelWidth(99)).toBe(false)
    expect(isValidExactPixelWidth(4097)).toBe(false)
    expect(isValidExactPixelWidth(800.5)).toBe(false)
    expect(isValidExactPixelWidth(NaN)).toBe(false)
  })
})

describe('纯黑白二值化', () => {
  it('按亮度阈值就地改为纯黑或纯白，且不透明', () => {
    const data = new Uint8ClampedArray([
      // 深灰 → 黑
      60, 60, 60, 255,
      // 浅灰 → 白
      220, 220, 220, 255,
      // 半透明像素也归一为不透明
      0, 0, 0, 128,
    ])
    binarizePixelData(data)
    expect(Array.from(data.slice(0, 4))).toEqual([0, 0, 0, 255])
    expect(Array.from(data.slice(4, 8))).toEqual([255, 255, 255, 255])
    expect(Array.from(data.slice(8, 12))).toEqual([0, 0, 0, 255])
  })

  it('输出仅含 0/255 两种通道值', () => {
    const data = new Uint8ClampedArray(64)
    for (let i = 0; i < data.length; i++) data[i] = (i * 37) % 256
    binarizePixelData(data)
    for (let i = 0; i < data.length; i++) {
      expect([0, 255]).toContain(data[i])
    }
  })
})

describe('文件命名', () => {
  it('多页 zip 内单页文件名三位页码', () => {
    expect(pngPageFileName('座签', 0)).toBe('座签-001.png')
    expect(pngPageFileName('座签', 99)).toBe('座签-100.png')
  })

  it('默认导出名含日期戳与前缀', () => {
    expect(defaultPngExportName()).toMatch(/^考场座位标签-\d{8}-\d{4}$/)
    expect(defaultPngExportName('桌牌')).toMatch(/^桌牌-/)
  })
})

describe('导出防线', () => {
  it('页数为 0 时报「没有可导出的页面」', async () => {
    await expect(
      exportPagedPng({
        pageCount: 0,
        getPage: () => document.createElement('div'),
        pageWidth: 200,
        pageHeight: 120,
      }),
    ).rejects.toThrow('没有可导出的页面')
  })

  it('取消信号已中止时立即以「已取消导出」失败，不调用 getPage', async () => {
    const getPage = vi.fn(() => document.createElement('div'))
    const abort = new AbortController()
    abort.abort()
    await expect(
      exportPagedPng({
        pageCount: 3,
        getPage,
        pageWidth: 210,
        pageHeight: 297,
        signal: abort.signal,
      }),
    ).rejects.toThrow('已取消导出')
    expect(getPage).not.toHaveBeenCalled()
  })
})
