/**
 * 第 348 轮：宴会座位图张贴版导出布局的纯函数（网格列数 / 桌块尺寸 / 姓名字号）。
 */
import { describe, expect, it } from 'vitest'

import { demoPersonNames } from '@/data/demoDatasets'
import {
  CHIP_BORDER_MM,
  CHIP_GAP_MM,
  CHIP_LINE_HEIGHT,
  NAME_WIDTH_UNITS_MAX,
  POSTER_BLOCK_PADDING_MM,
  POSTER_HARD_MIN_NAME_FONT_MM,
  POSTER_MAX_NAME_FONT_MM,
  POSTER_MIN_NAME_FONT_MM,
  POSTER_PX_PER_MM,
  TABLE_NAME_RATIO,
  chipWidthMm,
  computePosterLayout,
  fitNameFont,
  nameWidthUnits,
  posterColumns,
  posterCoverage,
} from '@/utils/banquetExportLayout'

/** A4 横版（297×210mm）扣除 10mm 页边距与 14mm 标题高后的安全区 */
const A4_SAFE = { safeWidth: 297 - 20, safeHeight: 210 - 20 - 14 }

describe('posterColumns：按已用桌数分档', () => {
  it('≤3 桌 1-3 列、4-6 桌 3 列、7-12 桌 4 列、13-20 桌 5 列、21-30 桌 6 列', () => {
    expect(posterColumns(0)).toBe(0)
    expect(posterColumns(1)).toBe(1)
    expect(posterColumns(2)).toBe(2)
    expect(posterColumns(3)).toBe(3)
    expect(posterColumns(4)).toBe(3)
    expect(posterColumns(6)).toBe(3)
    expect(posterColumns(7)).toBe(4)
    expect(posterColumns(12)).toBe(4)
    expect(posterColumns(13)).toBe(5)
    expect(posterColumns(20)).toBe(5)
    expect(posterColumns(21)).toBe(6)
    expect(posterColumns(30)).toBe(6)
  })

  it('超过 30 桌按近似正方形扩列且列数递增', () => {
    expect(posterColumns(31)).toBeGreaterThanOrEqual(6)
    expect(posterColumns(60)).toBeGreaterThan(posterColumns(31))
  })
})

describe('computePosterLayout：桌块铺满安全区', () => {
  it('6 桌 × 8 人（演示数据）A4 横版：3 列 2 行，覆盖率 ≥ 70%，姓名字号 ≥ 60px', () => {
    const layout = computePosterLayout({ tableCount: 6, maxGuests: 8, ...A4_SAFE })
    expect(layout.columns).toBe(3)
    expect(layout.rows).toBe(2)
    expect(posterCoverage(layout, 6, A4_SAFE.safeWidth, A4_SAFE.safeHeight)).toBeGreaterThanOrEqual(0.7)
    expect(layout.nameFontMm * POSTER_PX_PER_MM).toBeGreaterThanOrEqual(60)
    // 网格总宽/总高不超过安全区
    expect(layout.blockWidth * 3 + 5 * 2).toBeLessThanOrEqual(A4_SAFE.safeWidth + 1e-9)
    expect(layout.blockHeight * 2 + 5).toBeLessThanOrEqual(A4_SAFE.safeHeight + 1e-9)
  })

  it('桌越少字越大，但不超过上限；桌很多、人很多时宁可低于可读下限也要放下所有姓名，但不低于硬下限', () => {
    const two = computePosterLayout({ tableCount: 2, maxGuests: 10, ...A4_SAFE })
    const six = computePosterLayout({ tableCount: 6, maxGuests: 10, ...A4_SAFE })
    expect(two.nameFontMm).toBeGreaterThanOrEqual(six.nameFontMm)
    expect(two.nameFontMm).toBeLessThanOrEqual(POSTER_MAX_NAME_FONT_MM)

    const dense = computePosterLayout({ tableCount: 30, maxGuests: 12, ...A4_SAFE })
    expect(dense.nameFontMm).toBeLessThan(POSTER_MIN_NAME_FONT_MM)
    expect(dense.nameFontMm).toBeGreaterThanOrEqual(POSTER_HARD_MIN_NAME_FONT_MM)
    expect(dense.chipsPerRow).toBeGreaterThanOrEqual(1)

    const extreme = computePosterLayout({ tableCount: 60, maxGuests: 20, ...A4_SAFE })
    expect(extreme.nameFontMm).toBeCloseTo(POSTER_HARD_MIN_NAME_FONT_MM, 6)
  })

  it('桌名字号大于姓名字号；0 桌返回空网格', () => {
    const layout = computePosterLayout({ tableCount: 4, maxGuests: 6, ...A4_SAFE })
    expect(layout.tableNameFontMm).toBeGreaterThan(layout.nameFontMm)
    const empty = computePosterLayout({ tableCount: 0, maxGuests: 0, ...A4_SAFE })
    expect(empty.columns).toBe(0)
    expect(empty.rows).toBe(0)
    expect(posterCoverage(empty, 0, A4_SAFE.safeWidth, A4_SAFE.safeHeight)).toBe(0)
  })

  it('A3 横版安全区更大时字号不小于 A4', () => {
    const a4 = computePosterLayout({ tableCount: 6, maxGuests: 8, ...A4_SAFE })
    const a3 = computePosterLayout({
      tableCount: 6,
      maxGuests: 8,
      safeWidth: 420 - 20,
      safeHeight: 297 - 20 - 14,
    })
    expect(a3.nameFontMm).toBeGreaterThanOrEqual(a4.nameFontMm)
  })
})

describe('nameWidthUnits：英文姓名按字形估宽（第 371 轮生产复测：英文演示名单张贴版第 10 人被裁掉）', () => {
  it('中文按字数计；大写拉丁字母接近 0.8 字宽，"ZHANG Wei" 明显宽于 3 个中文字', () => {
    expect(nameWidthUnits('张伟')).toBe(2)
    expect(nameWidthUnits(' 欧阳娜娜 ')).toBe(4)
    expect(nameWidthUnits('ZHANG Wei')).toBeGreaterThan(6)
    expect(nameWidthUnits('ZHANG Wei')).toBeLessThan(nameWidthUnits('ZHENG Shuang'))
    expect(nameWidthUnits('ZHENG Shuang')).toBeLessThanOrEqual(NAME_WIDTH_UNITS_MAX)
  })

  it('6 桌 × 10 人英文演示名单 A4 横版：按估宽排出的胶囊行数能放进桌块高度', () => {
    const names = demoPersonNames(60, 'en')
    const maxUnits = Math.min(Math.max(...names.map(nameWidthUnits), 2), NAME_WIDTH_UNITS_MAX)
    const layout = computePosterLayout({ tableCount: 6, maxGuests: 10, maxNameChars: maxUnits, ...A4_SAFE })
    const innerW = layout.blockWidth - POSTER_BLOCK_PADDING_MM * 2
    const innerH = layout.blockHeight - POSTER_BLOCK_PADDING_MM * 2
    const chipW = chipWidthMm(layout.nameFontMm, maxUnits)
    const perRow = Math.max(1, Math.floor((innerW + CHIP_GAP_MM) / (chipW + CHIP_GAP_MM)))
    const rows = Math.ceil(10 / perRow)
    const titleH = layout.nameFontMm * (TABLE_NAME_RATIO * 1.3 + 0.4)
    const usedH =
      titleH +
      rows * (layout.nameFontMm * CHIP_LINE_HEIGHT + CHIP_BORDER_MM * 2) +
      CHIP_GAP_MM * (rows - 1)
    expect(perRow).toBe(layout.chipsPerRow)
    expect(usedH).toBeLessThanOrEqual(innerH + 1e-9)
    // 旧算法按「字数上限 6」估宽会把字号定得过大，导致英文名每行只能放 1 个胶囊而溢出
    const legacy = computePosterLayout({ tableCount: 6, maxGuests: 10, maxNameChars: 6, ...A4_SAFE })
    expect(layout.nameFontMm).toBeLessThan(legacy.nameFontMm)
  })

  it('中文 3 字姓名的估宽与旧口径一致，不改变中文演示名单的字号', () => {
    const zhUnits = Math.max(...demoPersonNames(60, 'zh').map(nameWidthUnits))
    const byChars = Math.max(...demoPersonNames(60, 'zh').map((n) => Array.from(n.trim()).length))
    expect(zhUnits).toBe(byChars)
  })
})

describe('fitNameFont：胶囊排布约束', () => {
  it('在桌块内放下所有胶囊且字号随人数减少而增大', () => {
    const few = fitNameFont(80, 60, 4, 3)
    const many = fitNameFont(80, 60, 12, 3)
    expect(few.fontMm).toBeGreaterThan(many.fontMm)
    expect(many.chipsPerRow).toBeGreaterThanOrEqual(1)
    expect(fitNameFont(2, 2, 8, 3).fontMm).toBe(0)
  })
})

describe('像素换算', () => {
  it('300dpi 下 A4 横版 297mm ≈ 3508px', () => {
    expect(Math.round(297 * POSTER_PX_PER_MM)).toBeGreaterThanOrEqual(3507)
    expect(Math.round(297 * POSTER_PX_PER_MM)).toBeLessThanOrEqual(3509)
  })
})
