import { describe, expect, it } from 'vitest'

import { backgroundLuminance, extractColors, watermarkToneFor } from '@/utils/watermark'

describe('watermark tone', () => {
  it('提取 hex 与 rgb 颜色', () => {
    expect(extractColors('#fff')).toEqual([{ r: 255, g: 255, b: 255 }])
    expect(extractColors('linear-gradient(#0f172a, rgb(255, 0, 0))')).toEqual([
      { r: 15, g: 23, b: 42 },
      { r: 255, g: 0, b: 0 },
    ])
  })

  it('浅色底用深灰水印', () => {
    expect(watermarkToneFor({ background: '#ffffff' })).toBe('dark')
    expect(watermarkToneFor({ background: '#fdf2f8' })).toBe('dark')
    expect(watermarkToneFor({})).toBe('dark')
  })

  it('深色底用浅色水印', () => {
    expect(watermarkToneFor({ background: '#0f172a' })).toBe('light')
    expect(watermarkToneFor({ background: '#9f1239' })).toBe('light')
  })

  it('decorSvg 底色矩形优先于 background', () => {
    expect(
      watermarkToneFor({
        background: '#ffffff',
        decorSvg: '<svg><rect x="0" y="0" width="90" height="55" fill="#9f1239"/></svg>',
      }),
    ).toBe('light')
  })

  it('渐变取色标平均亮度', () => {
    expect(
      backgroundLuminance({ background: 'linear-gradient(135deg, #ffffff, #ffffff)' }),
    ).toBeCloseTo(1)
    expect(
      watermarkToneFor({ background: 'linear-gradient(135deg, #1e293b, #0f172a)' }),
    ).toBe('light')
  })
})
