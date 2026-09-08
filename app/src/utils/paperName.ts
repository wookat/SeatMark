import type { PageSpec } from '@/types/template'

/** 常见纸张的竖向尺寸（mm，短边 × 长边） */
const PAPER_SIZES: ReadonlyArray<readonly [name: string, short: number, long: number]> = [
  ['A3', 297, 420],
  ['A4', 210, 297],
  ['A5', 148, 210],
  ['A6', 105, 148],
  ['B5', 176, 250],
  ['Letter', 216, 279],
]

const TOLERANCE_MM = 1

/**
 * 纸张规格简名（横竖两向均可，容差 ±1 mm），如「A4」「Letter」；
 * 无匹配时回退为「W × H mm」。名称均为拉丁字母，无需翻译。
 */
export function paperName(page: Pick<PageSpec, 'paperWidth' | 'paperHeight'>): string {
  const w = page.paperWidth
  const h = page.paperHeight
  const short = Math.min(w, h)
  const long = Math.max(w, h)
  for (const [name, s, l] of PAPER_SIZES) {
    if (Math.abs(short - s) <= TOLERANCE_MM && Math.abs(long - l) <= TOLERANCE_MM) return name
  }
  return `${w} × ${h} mm`
}
