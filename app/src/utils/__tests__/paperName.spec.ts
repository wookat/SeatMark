import { describe, expect, it } from 'vitest'

import { paperName } from '../paperName'

describe('第 362 轮：paperName 纸张规格简名', () => {
  it('A4 竖向与横向均识别为 A4', () => {
    expect(paperName({ paperWidth: 210, paperHeight: 297 })).toBe('A4')
    expect(paperName({ paperWidth: 297, paperHeight: 210 })).toBe('A4')
  })

  it('A5 / A3 / A6 / B5', () => {
    expect(paperName({ paperWidth: 148, paperHeight: 210 })).toBe('A5')
    expect(paperName({ paperWidth: 420, paperHeight: 297 })).toBe('A3')
    expect(paperName({ paperWidth: 105, paperHeight: 148 })).toBe('A6')
    expect(paperName({ paperWidth: 176, paperHeight: 250 })).toBe('B5')
  })

  it('Letter（216 × 279）含 ±1 mm 容差', () => {
    expect(paperName({ paperWidth: 216, paperHeight: 279 })).toBe('Letter')
    expect(paperName({ paperWidth: 215.9, paperHeight: 279.4 })).toBe('Letter')
    expect(paperName({ paperWidth: 279, paperHeight: 215 })).toBe('Letter')
  })

  it('非标尺寸回退为「W × H mm」，超出容差不误判', () => {
    expect(paperName({ paperWidth: 100, paperHeight: 150 })).toBe('100 × 150 mm')
    expect(paperName({ paperWidth: 210, paperHeight: 299 })).toBe('210 × 299 mm')
  })
})
