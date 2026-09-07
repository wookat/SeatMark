/**
 * 宴会座位图「张贴版（远距可读）」导出布局：纯计算，不碰 DOM。
 *
 * 屏幕编辑视图按场地 mm 坐标所见即所得；张贴版则把非空桌重新排成网格铺满页面安全区，
 * 姓名字号按桌块宽度自适应，保证远距可读。所有尺寸单位 mm。
 */

/** 300dpi 下 1mm 的像素数（与 pngExport PNG_BASE_SCALE 一致：96 × 3.125 / 25.4） */
export const POSTER_PX_PER_MM = (96 * 3.125) / 25.4

/** 姓名字号下限：A4 横版 3508px 宽下 ≥ 60px（约 5.1mm，打印字高约 5mm） */
export const POSTER_MIN_NAME_FONT_MM = 60 / POSTER_PX_PER_MM
/** 姓名字号上限：避免 1-2 桌时字大到失衡 */
export const POSTER_MAX_NAME_FONT_MM = 14

/** 桌块之间的间距 */
export const POSTER_GAP_MM = 5
/** 桌块内边距 */
export const POSTER_BLOCK_PADDING_MM = 3
/** 姓名胶囊左右内边距（单侧） */
export const CHIP_PAD_X_MM = 1.2
/** 姓名胶囊之间的间距 */
export const CHIP_GAP_MM = 1.2
/** 姓名胶囊行高倍率（含上下内边距与边框） */
export const CHIP_LINE_HEIGHT = 1.55
/** 桌名字号相对姓名字号的倍率 */
export const TABLE_NAME_RATIO = 1.25
/** 中文姓名按 3 字估宽；字符宽近似等于字号 */
const NAME_CHARS_ESTIMATE = 3

/** 按已用桌数决定网格列数：≤3 桌 1-3 列、4-6 桌 3 列、7-12 桌 4 列、13-20 桌 5 列、21-30 桌 6 列，再多按近似正方形扩列 */
export function posterColumns(tableCount: number): number {
  if (tableCount <= 0) return 0
  if (tableCount <= 3) return tableCount
  if (tableCount <= 6) return 3
  if (tableCount <= 12) return 4
  if (tableCount <= 20) return 5
  if (tableCount <= 30) return 6
  return Math.ceil(Math.sqrt(tableCount * 1.4))
}

export interface PosterLayoutInput {
  /** 非空桌数（空桌不参与布局） */
  tableCount: number
  /** 各桌人数最大值 */
  maxGuests: number
  /** 最长姓名字数（用于估算胶囊宽度，默认 3） */
  maxNameChars?: number
  /** 页面安全区宽（mm） */
  safeWidth: number
  /** 页面安全区高（mm） */
  safeHeight: number
}

export interface PosterLayout {
  columns: number
  rows: number
  /** 桌块宽（mm） */
  blockWidth: number
  /** 桌块高（mm） */
  blockHeight: number
  /** 姓名字号（mm） */
  nameFontMm: number
  /** 桌名字号（mm） */
  tableNameFontMm: number
  /** 每行胶囊数（按估宽） */
  chipsPerRow: number
}

/** 单个姓名胶囊估算宽度（mm） */
export function chipWidthMm(nameFontMm: number, nameChars: number): number {
  return nameFontMm * nameChars + CHIP_PAD_X_MM * 2
}

/**
 * 在给定桌块尺寸下能容下 maxGuests 个姓名胶囊的最大字号（未做上下限裁剪）。
 * 遍历「每行 c 个胶囊」的所有取法，取能得到的最大字号。
 */
export function fitNameFont(
  blockWidth: number,
  blockHeight: number,
  maxGuests: number,
  nameChars: number,
): { fontMm: number; chipsPerRow: number } {
  const innerW = blockWidth - POSTER_BLOCK_PADDING_MM * 2
  const innerH = blockHeight - POSTER_BLOCK_PADDING_MM * 2
  if (innerW <= 0 || innerH <= 0) return { fontMm: 0, chipsPerRow: 1 }
  const guests = Math.max(1, maxGuests)
  let best = { fontMm: 0, chipsPerRow: 1 }
  for (let c = 1; c <= guests; c++) {
    const lines = Math.ceil(guests / c)
    // 宽度约束：c 个胶囊 + (c-1) 个间距 ≤ innerW
    const byWidth = (innerW - CHIP_GAP_MM * (c - 1) - CHIP_PAD_X_MM * 2 * c) / (c * nameChars)
    // 高度约束：桌名行（TABLE_NAME_RATIO × 1.3 行高 + 下方留白）+ lines 行胶囊 + 行间距 ≤ innerH
    const titleUnits = TABLE_NAME_RATIO * 1.3 + 0.4
    const byHeight = (innerH - CHIP_GAP_MM * (lines - 1)) / (titleUnits + lines * CHIP_LINE_HEIGHT)
    const f = Math.min(byWidth, byHeight)
    if (f > best.fontMm) best = { fontMm: f, chipsPerRow: c }
  }
  return best
}

/** 计算张贴版网格与字号 */
export function computePosterLayout(input: PosterLayoutInput): PosterLayout {
  const columns = posterColumns(input.tableCount)
  if (columns === 0) {
    return {
      columns: 0,
      rows: 0,
      blockWidth: 0,
      blockHeight: 0,
      nameFontMm: POSTER_MIN_NAME_FONT_MM,
      tableNameFontMm: POSTER_MIN_NAME_FONT_MM * TABLE_NAME_RATIO,
      chipsPerRow: 1,
    }
  }
  const rows = Math.ceil(input.tableCount / columns)
  const blockWidth = (input.safeWidth - POSTER_GAP_MM * (columns - 1)) / columns
  const blockHeight = (input.safeHeight - POSTER_GAP_MM * (rows - 1)) / rows
  const nameChars = Math.max(2, input.maxNameChars ?? NAME_CHARS_ESTIMATE)
  const fit = fitNameFont(blockWidth, blockHeight, input.maxGuests, nameChars)
  const nameFontMm = Math.min(
    POSTER_MAX_NAME_FONT_MM,
    Math.max(POSTER_MIN_NAME_FONT_MM, fit.fontMm),
  )
  // 字号被下限抬高后按实际字号重算每行胶囊数，避免胶囊横向溢出
  const innerW = blockWidth - POSTER_BLOCK_PADDING_MM * 2
  const chipsPerRow = Math.max(
    1,
    Math.floor((innerW + CHIP_GAP_MM) / (chipWidthMm(nameFontMm, nameChars) + CHIP_GAP_MM)),
  )
  return {
    columns,
    rows,
    blockWidth,
    blockHeight,
    nameFontMm,
    tableNameFontMm: nameFontMm * TABLE_NAME_RATIO,
    chipsPerRow,
  }
}

/** 网格实际占用面积 / 安全区面积（0-1），用于验收「桌块覆盖安全区 ≥ 70%」 */
export function posterCoverage(layout: PosterLayout, tableCount: number, safeWidth: number, safeHeight: number): number {
  if (!layout.columns || safeWidth <= 0 || safeHeight <= 0) return 0
  return (layout.blockWidth * layout.blockHeight * tableCount) / (safeWidth * safeHeight)
}
