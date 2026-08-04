import { LABEL_PAPER_SHEET, labelPapers, type LabelPaperSpec } from '@/data/labelPapers'
import type { LabelTemplate, PageSpec } from '@/types/template'
import { round1 } from '@/utils/layout'

export interface LabelPaperGeometry {
  /** 标签阵列总宽/高（mm） */
  contentWidth: number
  contentHeight: number
  /** 居中排版推导出的左右/上下边距（mm） */
  marginX: number
  marginY: number
  /** 每页枚数 */
  perPage: number
}

/**
 * 由纸型规格推导整页几何：
 * 阵列尺寸 = 枚数 × 标签尺寸 + 间距之和；边距 = (纸面 - 阵列) / 2（居中）。
 * 数值按 0.1mm 取整，与排版引擎的毫米精度一致。
 */
export function labelPaperGeometry(spec: LabelPaperSpec): LabelPaperGeometry {
  const contentWidth = round1(spec.cols * spec.labelWidth + (spec.cols - 1) * spec.gapX)
  const contentHeight = round1(spec.rows * spec.labelHeight + (spec.rows - 1) * spec.gapY)
  return {
    contentWidth,
    contentHeight,
    marginX: round1(Math.max((LABEL_PAPER_SHEET.width - contentWidth) / 2, 0)),
    marginY: round1(Math.max((LABEL_PAPER_SHEET.height - contentHeight) / 2, 0)),
    perPage: spec.cols * spec.rows,
  }
}

/**
 * 应用纸型到模板：锁定纸张为 A4 纵向，行列数、标签尺寸、
 * 间距与边距全部按纸型几何设置；圆角规格同步标签圆角。
 */
export function applyLabelPaper(template: LabelTemplate, spec: LabelPaperSpec): void {
  const geo = labelPaperGeometry(spec)
  const page = template.page
  page.paperWidth = LABEL_PAPER_SHEET.width
  page.paperHeight = LABEL_PAPER_SHEET.height
  page.cols = spec.cols
  page.rows = spec.rows
  page.gapX = spec.gapX
  page.gapY = spec.gapY
  page.marginLeft = geo.marginX
  page.marginRight = geo.marginX
  page.marginTop = geo.marginY
  page.marginBottom = geo.marginY
  template.label.width = spec.labelWidth
  template.label.height = spec.labelHeight
  template.label.radius = spec.corner === 'rounded' ? (spec.cornerRadius ?? 2) : 0
}

/** 判断当前页面/标签几何是否与某纸型一致（0.15mm 容差） */
export function matchLabelPaper(
  page: PageSpec,
  label: { width: number; height: number },
): LabelPaperSpec | null {
  const eq = (a: number, b: number) => Math.abs(a - b) <= 0.15
  return (
    labelPapers.find((spec) => {
      const geo = labelPaperGeometry(spec)
      return (
        eq(page.paperWidth, LABEL_PAPER_SHEET.width) &&
        eq(page.paperHeight, LABEL_PAPER_SHEET.height) &&
        page.cols === spec.cols &&
        page.rows === spec.rows &&
        eq(page.gapX, spec.gapX) &&
        eq(page.gapY, spec.gapY) &&
        eq(page.marginLeft, geo.marginX) &&
        eq(page.marginTop, geo.marginY) &&
        eq(label.width, spec.labelWidth) &&
        eq(label.height, spec.labelHeight)
      )
    }) ?? null
  )
}
