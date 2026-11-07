import { labelPapers, sheetOf, type LabelPaperSpec } from '@/data/labelPapers'
import type { LabelTemplate, PageSpec } from '@/types/template'
import { round1 } from '@/utils/layout'

export interface LabelPaperGeometry {
  /** 标签阵列总宽/高（mm） */
  contentWidth: number
  contentHeight: number
  /** 居中排版推导出的左右/上下边距（mm）；显式边距纸型为规格值 */
  marginX: number
  marginY: number
  /** 每页枚数 */
  perPage: number
}

/**
 * 由纸型规格推导整页几何：
 * 阵列尺寸 = 枚数 × 标签尺寸 + 间距之和；
 * 边距优先取规格显式值（Avery 等不对称模切），否则 (纸面 - 阵列) / 2（居中）。
 * 数值按 0.1mm 取整，与排版引擎的毫米精度一致。
 */
export function labelPaperGeometry(spec: LabelPaperSpec): LabelPaperGeometry {
  const sheet = sheetOf(spec)
  const contentWidth = round1(spec.cols * spec.labelWidth + (spec.cols - 1) * spec.gapX)
  const contentHeight = round1(spec.rows * spec.labelHeight + (spec.rows - 1) * spec.gapY)
  return {
    contentWidth,
    contentHeight,
    marginX: spec.marginLeft ?? round1(Math.max((sheet.width - contentWidth) / 2, 0)),
    marginY: spec.marginTop ?? round1(Math.max((sheet.height - contentHeight) / 2, 0)),
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

/**
 * 同一SKU的旋转90°进纸等价规格：纸没有方向，
 * 竖放是 rows×cols 的格阵，横过来就是 cols×rows、
 * 单格宽高互换的另一种合法排版。边距按顺时针旋转映射
 * （新上=旧左、新右=旧上、新下=旧右、新左=旧下），
 * 对称居中纸型旋转后数值不变。
 * 对折纸型旋转后折线方向语义改变（横折变竖折是另一种产品），返回 null。
 */
export function rotatedPaperSpec(spec: LabelPaperSpec): LabelPaperSpec | null {
  if (spec.fold != null) return null
  const sheet = sheetOf(spec)
  const geo = labelPaperGeometry(spec)
  const marginLeft = spec.marginLeft ?? geo.marginX
  const marginRight = spec.marginRight ?? geo.marginX
  const marginTop = spec.marginTop ?? geo.marginY
  const marginBottom = spec.marginBottom ?? geo.marginY
  return {
    ...spec,
    sheetWidth: sheet.height,
    sheetHeight: sheet.width,
    cols: spec.rows,
    rows: spec.cols,
    labelWidth: spec.labelHeight,
    labelHeight: spec.labelWidth,
    gapX: spec.gapY,
    gapY: spec.gapX,
    marginLeft: marginBottom,
    marginTop: marginLeft,
    marginRight: marginTop,
    marginBottom: marginRight,
  }
}

/** 当前页面/标签几何是否与指定纸型完全一致（0.15mm 容差） */
function geometryMatchesSpec(
  page: PageSpec,
  label: { width: number; height: number },
  spec: LabelPaperSpec,
): boolean {
  const eq = (a: number, b: number) => Math.abs(a - b) <= 0.15
  const sheet = sheetOf(spec)
  const geo = labelPaperGeometry(spec)
  return (
    eq(page.paperWidth, sheet.width) &&
    eq(page.paperHeight, sheet.height) &&
    page.cols === spec.cols &&
    page.rows === spec.rows &&
    eq(page.gapX, spec.gapX) &&
    eq(page.gapY, spec.gapY) &&
    eq(page.marginLeft, geo.marginX) &&
    eq(page.marginTop, geo.marginY) &&
    eq(label.width, spec.labelWidth) &&
    eq(label.height, spec.labelHeight)
  )
}

/** 纸型进纸方向：按规格书竖放 / 旋转 90° 横放 */
export type PaperOrientation = 'normal' | 'rotated'

/** 当前页面/标签几何与纸型匹配的进纸方向；两个方向都不匹配返回 null */
export function paperOrientationOf(
  page: PageSpec,
  label: { width: number; height: number },
  spec: LabelPaperSpec,
): PaperOrientation | null {
  if (geometryMatchesSpec(page, label, spec)) return 'normal'
  const rotated = rotatedPaperSpec(spec)
  if (rotated && geometryMatchesSpec(page, label, rotated)) return 'rotated'
  return null
}

/** 模板与纸型是否兼容：整页/折叠模板只允许每页 1 枚的整版纸型、
 * 带折线语义的对折纸型（每格自身是一整枚折叠卡，镜像字段在格内生效），
 * 或与该纸型几何完全一致的模板（纸型专用模板按其模切格设计，天然兼容） */
export function isPaperCompatible(template: LabelTemplate, spec: LabelPaperSpec): boolean {
  if (!isFullPageTemplate(template)) return true
  if (spec.cols * spec.rows === 1 || spec.fold != null) return true
  return paperOrientationOf(template.page, template.label, spec) != null
}

/**
 * 对折纸型的压痕坐标（mm）：fold='horizontal' 返回各折线 y 坐标，
 * 'vertical' 返回各折线 x 坐标（每格中线）；非对折纸型返回空数组。
 */
export function foldOffsets(spec: LabelPaperSpec): number[] {
  const g = labelPaperGeometry(spec)
  if (spec.fold === 'horizontal') {
    return Array.from({ length: spec.rows }, (_, r) =>
      round1(g.marginY + r * (spec.labelHeight + spec.gapY) + spec.labelHeight / 2),
    )
  }
  if (spec.fold === 'vertical') {
    return Array.from({ length: spec.cols }, (_, c) =>
      round1(g.marginX + c * (spec.labelWidth + spec.gapX) + spec.labelWidth / 2),
    )
  }
  return []
}

/**
 * 模板应使用的进纸方向规格：几何已匹配某方向时保持该方向；
 * 否则按模板单格宽高比与两个方向单格的接近度自动选取
 * （竖版设计配竖放格、横版设计配横放格），对折纸型恒为竖放。
 */
function preferredSpecFor(template: LabelTemplate, spec: LabelPaperSpec): LabelPaperSpec {
  const rotated = rotatedPaperSpec(spec)
  if (!rotated) return spec
  const orientation = paperOrientationOf(template.page, template.label, spec)
  if (orientation === 'rotated') return rotated
  if (orientation === 'normal') return spec
  const closeness = (s: LabelPaperSpec) => {
    const ta = template.label.width / template.label.height
    const pa = s.labelWidth / s.labelHeight
    return ta > 0 && pa > 0 ? Math.min(ta, pa) / Math.max(ta, pa) : 0
  }
  return closeness(rotated) > closeness(spec) ? rotated : spec
}

/**
 * 应用纸型到模板：按模板方向自动选择竖放/横向进纸，行列数、
 * 标签尺寸、间距与边距全部按纸型几何设置；圆角规格同步标签圆角。
 * 字段坐标/尺寸/字号按新旧标签尺寸等比缩放，保证换纸型后
 * 内容仍落在标签内（字号超框时由 LabelCard 自适应兜底）。
 */
export function applyLabelPaper(template: LabelTemplate, spec: LabelPaperSpec): void {
  const target = preferredSpecFor(template, spec)
  const sheet = sheetOf(target)
  const geo = labelPaperGeometry(target)
  const page = template.page
  scaleTemplateFields(template, target.labelWidth, target.labelHeight)
  page.paperWidth = sheet.width
  page.paperHeight = sheet.height
  page.cols = target.cols
  page.rows = target.rows
  page.gapX = target.gapX
  page.gapY = target.gapY
  page.marginLeft = geo.marginX
  page.marginRight = target.marginRight ?? geo.marginX
  page.marginTop = geo.marginY
  page.marginBottom = target.marginBottom ?? geo.marginY
  template.label.width = target.labelWidth
  template.label.height = target.labelHeight
  template.label.radius = target.corner === 'rounded' ? (target.cornerRadius ?? 2) : 0
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

/**
 * 由纸型规格生成模板的页面排版（与 applyLabelPaper 写出的几何一致）：
 * 供「纸型专用模板」数据直接绑定纸型模切参数，规格更新时随纸型库一起生效。
 * rotated=true 生成横向进纸（旋转 90°）的页面排版。
 */
export function paperPageForTemplate(spec: LabelPaperSpec, rotated = false): PageSpec {
  const s = rotated ? (rotatedPaperSpec(spec) ?? spec) : spec
  const sheet = sheetOf(s)
  const geo = labelPaperGeometry(s)
  return {
    paperWidth: sheet.width,
    paperHeight: sheet.height,
    rows: s.rows,
    cols: s.cols,
    marginTop: geo.marginY,
    marginBottom: s.marginBottom ?? geo.marginY,
    marginLeft: geo.marginX,
    marginRight: s.marginRight ?? geo.marginX,
    gapX: s.gapX,
    gapY: s.gapY,
  }
}

/** 由纸型规格生成模板的单枚标签规格（宽高与圆角，与 applyLabelPaper 一致） */
export function paperLabelForTemplate(
  spec: LabelPaperSpec,
  rotated = false,
): {
  width: number
  height: number
  radius: number
} {
  const s = rotated ? (rotatedPaperSpec(spec) ?? spec) : spec
  return {
    width: s.labelWidth,
    height: s.labelHeight,
    radius: s.corner === 'rounded' ? (s.cornerRadius ?? 2) : 0,
  }
}

export interface LabelPaperMatch {
  spec: LabelPaperSpec
  /** 命中的进纸方向：规格书竖放 / 旋转 90° 横放 */
  orientation: PaperOrientation
}

/** 判断当前页面/标签几何与哪个纸型一致（0.15mm 容差），并给出进纸方向 */
export function matchLabelPaperEx(
  page: PageSpec,
  label: { width: number; height: number },
): LabelPaperMatch | null {
  for (const spec of labelPapers) {
    const orientation = paperOrientationOf(page, label, spec)
    if (orientation) return { spec, orientation }
  }
  return null
}

/** 判断当前页面/标签几何是否与某纸型一致（0.15mm 容差，两个进纸方向都算） */
export function matchLabelPaper(
  page: PageSpec,
  label: { width: number; height: number },
): LabelPaperSpec | null {
  return matchLabelPaperEx(page, label)?.spec ?? null
}
