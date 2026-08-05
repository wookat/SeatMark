import { labelPapers, type LabelPaperSpec } from '@/data/labelPapers'
import type { LabelTemplate } from '@/types/template'
import { isFullPageTemplate, isPaperCompatible } from '@/utils/labelPaper'

/**
 * 模板 × 纸型适配度评估（纯函数）：
 * 以模板设计尺寸与纸型单格尺寸的匹配程度打 0–100 分，
 * 供模板选择器 / 纸型选择器双向排序推荐使用。
 * isPaperCompatible 作硬门槛：整页/折叠模板配多格纸型直接判不适配。
 */

export type FitLevel = 'recommended' | 'usable' | 'marginal' | 'incompatible'

export const FIT_LEVEL_LABELS: Record<FitLevel, string> = {
  recommended: '推荐',
  usable: '可用',
  marginal: '勉强',
  incompatible: '不适配',
}

export interface PaperFit {
  /** 适配度 0–100 */
  score: number
  level: FitLevel
  /** 一句话理由（推荐依据或不适配原因） */
  reason: string
}

/** 宽高比接近度权重 / 缩放幅度权重 */
const ASPECT_WEIGHT = 55
const SCALE_WEIGHT = 45
/** 缩放评分归零的幅度上限：|log2(缩放系数)| ≥ 2.5（约 5.7 倍）记 0 分 */
const SCALE_LOG_LIMIT = 2.5

const LEVEL_RECOMMENDED = 75
const LEVEL_USABLE = 55
const LEVEL_MARGINAL = 30

function formatSize(w: number, h: number): string {
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
  return `${fmt(w)}×${fmt(h)}mm`
}

/** 宽高比接近度 0–1：两者比例的 min/max */
function aspectCloseness(template: LabelTemplate, spec: LabelPaperSpec): number {
  const ta = template.label.width / template.label.height
  const pa = spec.labelWidth / spec.labelHeight
  if (!Number.isFinite(ta) || !Number.isFinite(pa) || ta <= 0 || pa <= 0) return 0
  return Math.min(ta, pa) / Math.max(ta, pa)
}

/** 几何平均缩放系数：>1 放大，<1 缩小 */
function meanScale(template: LabelTemplate, spec: LabelPaperSpec): number {
  const templateArea = template.label.width * template.label.height
  const paperArea = spec.labelWidth * spec.labelHeight
  if (templateArea <= 0 || paperArea <= 0) return 0
  return Math.sqrt(paperArea / templateArea)
}

/** 缩放评分 0–1：不缩放为 1，缩放幅度越大越低 */
function scaleCloseness(scale: number): number {
  if (scale <= 0) return 0
  const d = Math.abs(Math.log2(scale))
  return Math.max(0, 1 - d / SCALE_LOG_LIMIT)
}

/** 适配度评分 0–100（不含硬门槛，供排序细分） */
export function paperFitScore(template: LabelTemplate, spec: LabelPaperSpec): number {
  const aspect = aspectCloseness(template, spec)
  const scale = scaleCloseness(meanScale(template, spec))
  return Math.round(ASPECT_WEIGHT * aspect + SCALE_WEIGHT * scale)
}

function levelOf(score: number): FitLevel {
  if (score >= LEVEL_RECOMMENDED) return 'recommended'
  if (score >= LEVEL_USABLE) return 'usable'
  if (score >= LEVEL_MARGINAL) return 'marginal'
  return 'incompatible'
}

function reasonOf(template: LabelTemplate, spec: LabelPaperSpec, level: FitLevel): string {
  const size = formatSize(spec.labelWidth, spec.labelHeight)
  const designSize = formatSize(template.label.width, template.label.height)
  if (level === 'recommended') {
    return `单格 ${size}（${spec.cols} 列 × ${spec.rows} 行）与本模板设计尺寸 ${designSize} 最接近`
  }
  if (level === 'usable') {
    return `单格 ${size} 与模板设计尺寸 ${designSize} 相近，等比微调后可用`
  }
  const scale = meanScale(template, spec)
  if (scale > 0 && scale < 1) {
    const shrink = (1 / scale).toFixed(1)
    return `单格仅 ${size}，模板需整体缩小约 ${shrink} 倍，文字可能过小难以辨认`
  }
  if (scale > 1) {
    const grow = scale.toFixed(1)
    return `单格 ${size} 远大于模板设计尺寸 ${designSize}（约放大 ${grow} 倍），版面会明显松散失真`
  }
  return `单格 ${size} 与模板设计尺寸 ${designSize} 差异过大`
}

/** 评估模板与纸型的适配度：硬门槛（整页/折叠 × 多格）直接判不适配 */
export function evaluatePaperFit(template: LabelTemplate, spec: LabelPaperSpec): PaperFit {
  if (!isPaperCompatible(template, spec)) {
    return {
      score: 0,
      level: 'incompatible',
      reason: `该模板为整页/折叠设计，不适合 ${spec.cols * spec.rows} 格小标签纸型`,
    }
  }
  if (isFullPageTemplate(template) && spec.cols * spec.rows === 1) {
    return {
      score: 100,
      level: 'recommended',
      reason: '整版纸型与整页/折叠模板天然匹配',
    }
  }
  const score = paperFitScore(template, spec)
  const level = levelOf(score)
  return { score, level, reason: reasonOf(template, spec, level) }
}

export interface RankedPaper {
  spec: LabelPaperSpec
  fit: PaperFit
}

/** 纸型按适配度降序排序（同分保持原顺序），供纸型选择器置顶推荐 */
export function rankPapersForTemplate(
  template: LabelTemplate,
  papers: LabelPaperSpec[] = labelPapers,
): RankedPaper[] {
  return papers
    .map((spec, index) => ({ spec, fit: evaluatePaperFit(template, spec), index }))
    .sort((a, b) => b.fit.score - a.fit.score || a.index - b.index)
    .map(({ spec, fit }) => ({ spec, fit }))
}

/** 最适合当前模板的纸型（全部不适配时返回 null） */
export function bestPaperForTemplate(
  template: LabelTemplate,
  papers: LabelPaperSpec[] = labelPapers,
): RankedPaper | null {
  const ranked = rankPapersForTemplate(template, papers)
  const best = ranked[0]
  return best && best.fit.level !== 'incompatible' ? best : null
}

export interface RankedTemplate {
  template: LabelTemplate
  fit: PaperFit
}

/** 模板按适配度降序排序（同分保持原顺序），供模板选择器推荐排序 */
export function rankTemplatesForPaper(
  templates: LabelTemplate[],
  spec: LabelPaperSpec,
): RankedTemplate[] {
  return templates
    .map((template, index) => ({ template, fit: evaluatePaperFit(template, spec), index }))
    .sort((a, b) => b.fit.score - a.fit.score || a.index - b.index)
    .map(({ template, fit }) => ({ template, fit }))
}
