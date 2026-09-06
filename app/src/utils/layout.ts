import type { LabelTemplate } from '@/types/template'

/** 1mm 对应的 CSS 像素（96dpi） */
export const MM_TO_PX = 96 / 25.4

export function round1(value: number): number {
  return Math.round(value * 10) / 10
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export const FIT_SCALE_MIN = 0.2

/** 画布「适配屏宽」缩放比：内容宽度铺满容器，不放大（≤1），下限 0.2 防止窄屏缩到不可辨 */
export function fitScale(containerW: number, contentW: number): number {
  if (!(containerW > 0) || !(contentW > 0)) return 1
  return clamp(containerW / contentW, FIT_SCALE_MIN, 1)
}

/**
 * 深克隆模板。模板可能是 Vue 响应式代理（Proxy），
 * structuredClone 无法克隆 Proxy（DataCloneError），
 * 模板数据均为 JSON 安全类型，故使用 JSON 往返克隆。
 */
export function cloneTemplate(template: LabelTemplate): LabelTemplate {
  return JSON.parse(JSON.stringify(template)) as LabelTemplate
}

export function labelsPerPage(template: LabelTemplate): number {
  return template.page.rows * template.page.cols
}

/** 第 idx 枚标签在页面上的位置（mm） */
export function labelPosition(template: LabelTemplate, idx: number): { left: number; top: number } {
  const { page, label } = template
  const row = Math.floor(idx / page.cols)
  const col = idx % page.cols
  return {
    left: page.marginLeft + col * (label.width + page.gapX),
    top: page.marginTop + row * (label.height + page.gapY),
  }
}

export interface CutLine {
  key: string
  orientation: 'v' | 'h'
  left: number
  top: number
  length: number
}

/** 与旧版逻辑一致的整页裁切线（mm） */
export function cutLines(template: LabelTemplate): CutLine[] {
  const { page, label } = template
  const lines: CutLine[] = []

  for (let col = 0; col <= page.cols; col++) {
    let left: number
    if (col === 0) left = page.marginLeft
    else if (col === page.cols)
      left = page.marginLeft + page.cols * label.width + (page.cols - 1) * page.gapX
    else left = page.marginLeft + col * (label.width + page.gapX) - page.gapX / 2
    lines.push({ key: `v-${col}`, orientation: 'v', left, top: 0, length: page.paperHeight })
  }

  for (let row = 0; row <= page.rows; row++) {
    let top: number
    if (row === 0) top = page.marginTop
    else if (row === page.rows)
      top = page.marginTop + page.rows * label.height + (page.rows - 1) * page.gapY
    else top = page.marginTop + row * (label.height + page.gapY) - page.gapY / 2
    lines.push({ key: `h-${row}`, orientation: 'h', left: 0, top, length: page.paperWidth })
  }

  return lines
}

export function chunkRows<T>(rows: T[], size: number): T[][] {
  if (size <= 0) return []
  const pages: T[][] = []
  for (let i = 0; i < rows.length; i += size) {
    pages.push(rows.slice(i, i + size))
  }
  return pages
}

/**
 * 当前排版横/纵向超出物理纸面的毫米数（<=0 表示未超出）。
 * 以最后一枚标签的右/下边缘对比纸张尺寸，trailing 边距不作硬约束
 * （兼容旧版内置模板：声明的下边距大于实际剩余空间）。
 */
export function layoutOverflow(template: LabelTemplate): { x: number; y: number } {
  const { page, label } = template
  const rightEdge = page.marginLeft + page.cols * label.width + (page.cols - 1) * page.gapX
  const bottomEdge = page.marginTop + page.rows * label.height + (page.rows - 1) * page.gapY
  return { x: round1(rightEdge - page.paperWidth), y: round1(bottomEdge - page.paperHeight) }
}

/**
 * 切换纸张（A3 / A4 / A5、横竖向）后的自动适配：
 * 保持标签物理尺寸与间距不变，按新纸面重算每页行列数，再把阵列居中（边距均分）。
 * minMargin 为四周保留的最小打印安全边距（mm）。
 */
export function fitToPaper(template: LabelTemplate, minMargin = 5): void {
  const { page, label } = template
  const availW = page.paperWidth - minMargin * 2
  const availH = page.paperHeight - minMargin * 2
  page.cols = Math.max(1, Math.floor((availW + page.gapX) / (label.width + page.gapX)))
  page.rows = Math.max(1, Math.floor((availH + page.gapY) / (label.height + page.gapY)))
  centerLayout(template)
}

/** 保持间距不变，把标签阵列在纸面上水平垂直居中（边距均分） */
export function centerLayout(template: LabelTemplate): void {
  const { page, label } = template
  const contentW = page.cols * label.width + (page.cols - 1) * page.gapX
  const contentH = page.rows * label.height + (page.rows - 1) * page.gapY
  const mx = round1(Math.max((page.paperWidth - contentW) / 2, 0))
  const my = round1(Math.max((page.paperHeight - contentH) / 2, 0))
  page.marginLeft = mx
  page.marginRight = mx
  page.marginTop = my
  page.marginBottom = my
}
