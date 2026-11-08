/**
 * 品牌水印配色：按模板底色明暗自动取协调色调 ——
 * 深色模板用浅色半透明水印、浅色模板用低饱和深灰水印，
 * 保证品牌可辨认的同时不抢标签内容的视觉焦点。
 */

export type WatermarkTone = 'dark' | 'light'

interface Rgb {
  r: number
  g: number
  b: number
}

/** 从任意 CSS/SVG 片段中提取颜色（#rgb/#rrggbb 与 rgb()/rgba()） */
export function extractColors(source: string): Rgb[] {
  const colors: Rgb[] = []
  for (const m of source.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
    const hex = m[1]!
    const full =
      hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
    colors.push({
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
    })
  }
  for (const m of source.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
    colors.push({ r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) })
  }
  return colors
}

/** 感知亮度（0–1），Rec.601 加权 */
export function luminanceOf(color: Rgb): number {
  return (0.299 * color.r + 0.587 * color.g + 0.114 * color.b) / 255
}

/**
 * 底色代表色的取样来源（优先级递减）：
 * 1. decorSvg 里的第一个 fill 颜色 —— 满幅底色矩形按惯例写在装饰层最前；
 * 2. label.background（纯色或渐变，渐变取全部色标的平均亮度）；
 * 3. 找不到任何颜色时视为白底。
 */
export function backgroundLuminance(options: {
  background?: string
  decorSvg?: string
}): number {
  if (options.decorSvg) {
    const fill = options.decorSvg.match(/fill="(#[0-9a-fA-F]{3,6}|rgba?\([^)]*\))"/)
    if (fill) {
      const colors = extractColors(fill[1]!)
      if (colors.length) return luminanceOf(colors[0]!)
    }
  }
  if (options.background) {
    const colors = extractColors(options.background)
    if (colors.length) {
      return colors.reduce((sum, c) => sum + luminanceOf(c), 0) / colors.length
    }
  }
  return 1
}

/** 深色底（亮度 < 0.55）用浅色水印，浅色底用深灰水印 */
export function watermarkToneFor(options: {
  background?: string
  decorSvg?: string
}): WatermarkTone {
  return backgroundLuminance(options) < 0.55 ? 'light' : 'dark'
}

// ---------- 水印落位（多形态自适应） ----------

export const WATERMARK_BRAND_EN = 'SeatMark'
export const WATERMARK_BRAND_ZH = '座签'
export const WATERMARK_DOMAIN = 'seatmark.cn'
export const WATERMARK_BRAND_NAME = `${WATERMARK_BRAND_EN} ${WATERMARK_BRAND_ZH}`
export const WATERMARK_FULL_TEXT = `${WATERMARK_BRAND_NAME} · ${WATERMARK_DOMAIN}`
export const WATERMARK_SHORT_TEXT = WATERMARK_DOMAIN

/**
 * 水印内容形态（多样化，不只是「名称+域名」一种）：
 * - icon：纯品牌图形标（印刷厂角标记式，窄带兜底也能放下）
 * - line：单行文字
 * - iconLine：图标 + 单行文字（名称 / 域名 / 中文 / 英文）
 * - stacked：名称上下两行排列（仅斜向兜底，单线带放不下）
 * - iconStacked：图标在上 + 文字在下（仅斜向兜底）
 */
export type WatermarkContent =
  | { kind: 'icon' }
  | { kind: 'line'; text: string }
  | { kind: 'iconLine'; text: string }
  | { kind: 'stacked'; line1: string; line2: string }
  | { kind: 'iconStacked'; text: string }

/** 水印落位形态：四条边签名带 或 斜向浅水印兜底 */
export type WatermarkVariant = 'bottom' | 'top' | 'right' | 'left' | 'diagonal'

export interface WatermarkRect {
  x: number
  y: number
  w: number
  h: number
}

export interface WatermarkPlacement {
  variant: WatermarkVariant
  content: WatermarkContent
  /** 水印带定位（mm，旋转前 DOM 盒）；diagonal 形态下为全幅居中容器 */
  leftMm: number
  topMm: number
  widthMm: number
  heightMm: number
  fontSizeMm: number
  /**
   * 旋转角（度）：diagonal 为内层文本沿对角线的逆时针角；
   * right/left 为整条签名带绕左上原点（0 0）的顺时针角
   */
  rotateDeg: number
}

/** 估算水印文本宽度（mm）：CJK 记 1em、西文/符号记 0.64em */
export function estimateWatermarkWidth(text: string, fontSizeMm: number): number {
  let em = 0
  for (const ch of text)
    em += /[\u2E80-\u9FFF\uF900-\uFAFF]/.test(ch) ? 1 : 0.64
  return em * fontSizeMm * 1.06
}

/** 估算内容形态总宽（mm）：图标占 1.05em，图标与文字间另留 0.5em 间隙 */
export function estimateContentWidth(content: WatermarkContent, fontSizeMm: number): number {
  switch (content.kind) {
    case 'icon':
      return fontSizeMm * 1.05
    case 'line':
      return estimateWatermarkWidth(content.text, fontSizeMm)
    case 'iconLine':
      return fontSizeMm * 1.55 + estimateWatermarkWidth(content.text, fontSizeMm)
    case 'stacked':
      return Math.max(
        estimateWatermarkWidth(content.line1, fontSizeMm),
        estimateWatermarkWidth(content.line2, fontSizeMm),
      )
    case 'iconStacked':
      return Math.max(fontSizeMm * 1.6, estimateWatermarkWidth(content.text, fontSizeMm))
  }
}

/** 边线签名带候选内容（丰富→精简），能放下的池子由 seed 轮换其一 */
const BAND_CONTENTS: WatermarkContent[] = [
  { kind: 'iconLine', text: WATERMARK_FULL_TEXT },
  { kind: 'line', text: WATERMARK_FULL_TEXT },
  { kind: 'iconLine', text: WATERMARK_BRAND_NAME },
  { kind: 'iconLine', text: WATERMARK_DOMAIN },
  { kind: 'line', text: WATERMARK_BRAND_NAME },
  { kind: 'iconLine', text: WATERMARK_BRAND_EN },
  { kind: 'iconLine', text: WATERMARK_BRAND_ZH },
  { kind: 'line', text: WATERMARK_DOMAIN },
  { kind: 'icon' },
]

/** 斜向浅水印候选：空间充裕时可上下排列，纯图标可做大幅幽灵印 */
const DIAGONAL_CONTENTS: WatermarkContent[] = [
  { kind: 'iconStacked', text: WATERMARK_FULL_TEXT },
  { kind: 'stacked', line1: WATERMARK_BRAND_NAME, line2: WATERMARK_DOMAIN },
  { kind: 'iconLine', text: WATERMARK_FULL_TEXT },
  { kind: 'line', text: WATERMARK_FULL_TEXT },
  { kind: 'iconLine', text: WATERMARK_BRAND_NAME },
  { kind: 'stacked', line1: WATERMARK_BRAND_EN, line2: WATERMARK_BRAND_ZH },
  { kind: 'icon' },
  { kind: 'line', text: WATERMARK_DOMAIN },
  { kind: 'iconLine', text: WATERMARK_DOMAIN },
]

/** 模板 id → 稳定整数种子：同一模板每次导出形态一致，不同模板形态错开 */
function seedHash(seed: string): number {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

function rectsIntersect(a: WatermarkRect, b: WatermarkRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/** 斜向兜底中各内容形态的字号（mm）：宽度按对角线 72%，厚度不超过短边一半 */
function diagonalFontFor(content: WatermarkContent, width: number, height: number): number {
  const diagonal = Math.hypot(width, height)
  const minSide = Math.min(width, height)
  const byWidth = (diagonal * 0.72) / estimateContentWidth(content, 1)
  switch (content.kind) {
    case 'line':
    case 'iconLine':
      return Math.min(byWidth, minSide * 0.24)
    case 'stacked':
      return Math.min(byWidth, (minSide * 0.5) / 2.7)
    case 'iconStacked':
      return Math.min(byWidth, (minSide * 0.5) / 3.4)
    // 纯图标幽灵印：fontSizeMm 即图标边长
    case 'icon':
      return minSide * 0.34
  }
}

/** 斜向形态的可读性下限：文字类字号 ≥2.2mm，纯图标边长 ≥3mm */
function diagonalMinFont(content: WatermarkContent): number {
  return content.kind === 'icon' ? 3 : 2.2
}

/**
 * 标签内水印落位：优先底边签名带（印刷厂版权脚注式），依次退到顶边、
 * 右边、左边竖排签名带；四条边都被字段占用时改用斜向浅水印兜底，
 * 低透明度压在字段层之上但不遮挡辨识，任何模板都不再出现文字级重叠。
 * 内容由候选池按 seed（模板 id）确定性轮换——纯图标、图标+名称、
 * 图标+域名、名称上下排列、图标+中文/英文 等形态在不同模板间错开呈现。
 */
export function watermarkPlacement(options: {
  width: number
  height: number
  fields: { x: number; y: number; width: number; height: number }[]
  /** 形态轮换种子（传模板 id），缺省时恒取候选池首个（最丰富） */
  seed?: string
}): WatermarkPlacement {
  const { width, height, fields } = options
  const seed = seedHash(options.seed ?? '')
  // 字号约为标签宽度的 3.2%，下限 2mm（黑白打印可读），上限 3.2mm——签名式水印刻意小
  const size = Math.min(Math.max(Math.min(width, height * 2.4) * 0.032, 2), 3.2)
  const bandHeight = size * 1.4
  const inset = Math.max(1.0, size * 0.3 + 0.4)
  // 字段外扩一小圈避让间隙：水印紧贴字段也会显得视觉重叠
  const clearance = Math.max(0.6, size * 0.25)
  const fieldRects: WatermarkRect[] = fields.map((f) => ({
    x: f.x - clearance,
    y: f.y - clearance,
    w: f.width + clearance * 2,
    h: f.height + clearance * 2,
  }))

  const edges: {
    variant: Exclude<WatermarkVariant, 'diagonal'>
    rect: WatermarkRect
    rotateDeg: number
    /** 旋转后的落位矩形（mm）：碰撞检测与 DOM 盒换算共用 */
    laid: WatermarkRect
  }[] = [
    { variant: 'bottom', rect: { x: 0, y: height - inset - bandHeight, w: width, h: bandHeight }, rotateDeg: 0, laid: { x: 0, y: height - inset - bandHeight, w: width, h: bandHeight } },
    { variant: 'top', rect: { x: 0, y: inset, w: width, h: bandHeight }, rotateDeg: 0, laid: { x: 0, y: inset, w: width, h: bandHeight } },
    // 竖排签名带用旋转而非 writing-mode：html2canvas 栅格化对 writing-mode 支持不可靠，
    // 而 rotate 走矩阵变换，导出/打印与屏幕预览完全一致。
    // right：DOM 盒 (width-inset, 0, height, bandHeight) 绕原点顺时针 90° → 屏幕贴右边整高
    { variant: 'right', rect: { x: width - inset - bandHeight, y: 0, w: bandHeight, h: height }, rotateDeg: 90, laid: { x: width - inset, y: 0, w: height, h: bandHeight } },
    // left：DOM 盒 (inset, height, height, bandHeight) 绕原点逆时针 90° → 屏幕贴左边整高
    { variant: 'left', rect: { x: inset, y: 0, w: bandHeight, h: height }, rotateDeg: -90, laid: { x: inset, y: height, w: height, h: bandHeight } },
  ]
  for (const { variant, rect, rotateDeg, laid } of edges) {
    if (fieldRects.some((f) => rectsIntersect(rect, f))) continue
    // 竖排带沿高度方向排文字；横排带沿宽度方向排文字，取 70% 估算全长
    const span = variant === 'left' || variant === 'right' ? rect.h : rect.w
    const pool = BAND_CONTENTS.filter((c) => estimateContentWidth(c, size) <= span * 0.7)
    // icon 恒能放入，pool 永不为空
    const content = pool[seed % pool.length]!
    return {
      variant,
      content,
      leftMm: laid.x,
      topMm: laid.y,
      widthMm: laid.w,
      heightMm: laid.h,
      fontSizeMm: size,
      rotateDeg,
    }
  }

  // 斜向浅水印兜底：沿标签对角线方向居中，宽度按对角线 72% 自适应
  const rotateDeg = (Math.atan2(height, width) * 180) / Math.PI
  const pool = DIAGONAL_CONTENTS.map((c) => ({
    c,
    fontSizeMm: diagonalFontFor(c, width, height),
  })).filter((x) => x.fontSizeMm >= diagonalMinFont(x.c))
  const pick = pool[seed % pool.length] ?? {
    c: { kind: 'line', text: WATERMARK_DOMAIN } as WatermarkContent,
    fontSizeMm: 2.2,
  }
  return {
    variant: 'diagonal',
    content: pick.c,
    leftMm: 0,
    topMm: 0,
    widthMm: width,
    heightMm: height,
    fontSizeMm: pick.fontSizeMm,
    rotateDeg,
  }
}
