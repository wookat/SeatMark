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
 * 整页/折叠类模板判定：含镜像（对折双联）字段，或单枚标签
 * 占据纸面一半以上（如整页名牌、门贴）。这类模板的字段坐标
 * 与折线语义依赖整页尺寸，套用多格小纸型会导致内容被裁空。
 */
export function isFullPageTemplate(template: LabelTemplate): boolean {
  if (template.fields.some((f) => f.mirrorOf != null)) return true
  const labelArea = template.label.width * template.label.height
  const paperArea = template.page.paperWidth * template.page.paperHeight
  return paperArea > 0 && labelArea >= paperArea * 0.5
}

/** 模板与纸型是否兼容：整页/折叠模板只允许每页 1 枚的整版纸型 */
export function isPaperCompatible(template: LabelTemplate, spec: LabelPaperSpec): boolean {
  if (!isFullPageTemplate(template)) return true
  return spec.cols * spec.rows === 1
}

/**
 * 应用纸型到模板：锁定纸张为 A4 纵向，行列数、标签尺寸、
 * 间距与边距全部按纸型几何设置；圆角规格同步标签圆角。
 * 字段坐标/尺寸/字号按新旧标签尺寸等比缩放，保证换纸型后
 * 内容仍落在标签内（字号超框时由 LabelCard 自适应兜底）。
 */
export function applyLabelPaper(template: LabelTemplate, spec: LabelPaperSpec): void {
  const geo = labelPaperGeometry(spec)
  const page = template.page
  scaleTemplateFields(template, spec.labelWidth, spec.labelHeight)
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

/**
 * 解除纸型锁定：恢复为模板设计稿的页面与标签几何，
 * 字段按新旧标签尺寸等比缩回，保留用户对字段的相对调整。
 */
export function releaseLabelPaper(template: LabelTemplate, design: LabelTemplate): void {
  scaleTemplateFields(template, design.label.width, design.label.height)
  Object.assign(template.page, design.page)
  template.label.width = design.label.width
  template.label.height = design.label.height
  template.label.radius = design.label.radius
}

/** 字段几何按标签尺寸变化等比缩放（x/宽随宽比，y/高随高比，字号取较小比） */
function scaleTemplateFields(template: LabelTemplate, newWidth: number, newHeight: number): void {
  const oldW = template.label.width
  const oldH = template.label.height
  if (oldW <= 0 || oldH <= 0) return
  const wr = newWidth / oldW
  const hr = newHeight / oldH
  if (Math.abs(wr - 1) < 0.02 && Math.abs(hr - 1) < 0.02) return
  const fontRatio = Math.min(wr, hr)
  for (const field of template.fields) {
    field.x = round1(field.x * wr)
    field.y = round1(field.y * hr)
    field.width = round1(field.width * wr)
    field.height = round1(field.height * hr)
    if (field.fontSize != null) {
      field.fontSize = Math.max(4, Math.round(field.fontSize * fontRatio * 10) / 10)
    }
    if (field.radius != null) field.radius = round1(field.radius * fontRatio)
  }
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
