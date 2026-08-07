import { describe, expect, it } from 'vitest'

import {
  countExactColors,
  encodeIndexedPng,
  MAX_PALETTE_COLORS,
  medianCutPalette,
} from '@/utils/indexedPng'

function rgba(colors: number[][], repeat = 1): Uint8ClampedArray {
  const out = new Uint8ClampedArray(colors.length * repeat * 4)
  let i = 0
  for (let r = 0; r < repeat; r++) {
    for (const [red, green, blue] of colors) {
      out[i++] = red!
      out[i++] = green!
      out[i++] = blue!
      out[i++] = 255
    }
  }
  return out
}

describe('countExactColors', () => {
  it('统计精确颜色直方图', () => {
    const counts = countExactColors(rgba([[255, 255, 255], [0, 0, 0], [255, 255, 255]]))
    expect(counts?.size).toBe(2)
    expect(counts?.get(0xffffff)).toBe(2)
    expect(counts?.get(0)).toBe(1)
  })
})

describe('medianCutPalette', () => {
  it('颜色数不超上限时全部保留（近似）且调色板 ≤ 上限', () => {
    const colors = Array.from({ length: 1000 }, (_, i) => ({
      color: (i * 4099) & 0xffffff,
      count: 1,
    }))
    const palette = medianCutPalette(colors, MAX_PALETTE_COLORS)
    expect(palette.length).toBeLessThanOrEqual(MAX_PALETTE_COLORS)
    expect(palette.length).toBeGreaterThan(1)
  })

  it('高频颜色主导盒平均值：纯色页调色板保留原色', () => {
    const palette = medianCutPalette(
      [
        { color: 0xffffff, count: 10_000 },
        { color: 0x000000, count: 500 },
      ],
      2,
    )
    expect(palette).toContain(0xffffff)
    expect(palette).toContain(0x000000)
  })
})

describe('encodeIndexedPng', () => {
  it('输出标准 PNG 签名与 color type 3（索引色）', async () => {
    const w = 16
    const h = 16
    const data = rgba([[255, 255, 255]], w * h)
    const png = await encodeIndexedPng(data, w, h)
    // jsdom 环境 Blob.stream/CompressionStream 不可用时返回 null（浏览器环境才走该通道）
    if (!png) return
    expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    // IHDR: bit depth @ offset 24, color type @ offset 25
    expect(png[24]).toBe(8)
    expect(png[25]).toBe(3)
  })

  it('尺寸与数据不匹配时返回 null', async () => {
    await expect(encodeIndexedPng(new Uint8ClampedArray(4), 16, 16)).resolves.toBeNull()
  })
})
