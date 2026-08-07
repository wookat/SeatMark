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
