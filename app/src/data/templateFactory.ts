import type { PageSpec, TemplateField } from '@/types/template'

/**
 * 模板批量扩充的排版工具集：
 * - gridPage：按纸张与行列数计算居中边距的整页排版（保证不超界）；
 * - text / fixed / bar / hairline：常用字段的简写构造器。
 * 所有尺寸单位均为 mm，与模板体系一致。
 */

export const INK = '#0f172a'
export const INK_SOFT = '#475569'
export const INK_MUTED = '#64748b'
export const INK_FAINT = '#94a3b8'
export const LINE = '#cbd5e1'

export type PaperId = 'A4' | 'A4L' | 'A5' | 'A5L' | 'A3' | 'A3L'

const PAPER: Record<PaperId, [number, number]> = {
  A4: [210, 297],
  A4L: [297, 210],
  A5: [148, 210],
  A5L: [210, 148],
  A3: [297, 420],
  A3L: [420, 297],
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** 按标签尺寸与行列数生成四周居中的整页排版（内容不超出纸面） */
export function gridPage(
  paper: PaperId,
  cols: number,
  rows: number,
  labelW: number,
  labelH: number,
  gapX = 4,
  gapY = 4,
): PageSpec {
  const [paperWidth, paperHeight] = PAPER[paper]
  const contentW = cols * labelW + (cols - 1) * gapX
  const contentH = rows * labelH + (rows - 1) * gapY
  const mx = round2((paperWidth - contentW) / 2)
  const my = round2((paperHeight - contentH) / 2)
  if (mx < 5 || my < 5) {
    throw new Error(`gridPage: 边距不足（${paper} ${cols}x${rows} ${labelW}x${labelH}）`)
  }
  return {
    paperWidth,
    paperHeight,
    rows,
    cols,
    marginTop: my,
    marginBottom: my,
    marginLeft: mx,
    marginRight: mx,
    gapX,
    gapY,
  }
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

type FieldOpts = Partial<Omit<TemplateField, 'id' | 'label' | 'type' | keyof Rect>>

/** 数据字段（参与 Excel 映射） */
export function text(
  id: string,
  label: string,
  rect: Rect,
  sample: string,
  opts: FieldOpts = {},
): TemplateField {
  return {
    id,
    label,
    type: 'text',
    ...rect,
    align: 'center',
    verticalAlign: 'middle',
    color: INK,
    padding: 0.5,
    lineHeight: 1.15,
    maxLines: 1,
    sample,
    ...opts,
  }
}

/** 固定文本字段（不参与 Excel 映射，每枚标签内容相同） */
export function fixed(
  id: string,
  label: string,
  rect: Rect,
  content: string,
  opts: FieldOpts = {},
): TemplateField {
  return {
    id,
    label,
    type: 'text',
    ...rect,
    align: 'center',
    verticalAlign: 'middle',
    color: INK_MUTED,
    padding: 0.5,
    lineHeight: 1.1,
    maxLines: 1,
    fixedText: content,
    ...opts,
  }
}

/** 装饰色块（空固定文本，不参与映射） */
export function bar(id: string, rect: Rect, color: string, opts: FieldOpts = {}): TemplateField {
  return {
    id,
    label: '色块',
    type: 'text',
    ...rect,
    fixedText: '',
    background: color,
    padding: 0,
    maxLines: 1,
    ...opts,
  }
}

/** 细分隔线 */
export function hairline(id: string, rect: Rect, color = LINE): TemplateField {
  return bar(id, rect, color)
}
