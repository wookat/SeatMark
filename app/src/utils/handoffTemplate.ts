/**
 * /studio?from=seating 带入名单后的模板挑选：当前模板仍有字段对不上列时，
 * 在候选模板里找「全部字段都能对上、且不丢已对上的列」的模板，优先字段最多的一个。
 */
import type { LabelTemplate, TemplateField } from '@/types/template'

import { autoMapFieldsDetailed } from './autoMap'
import { isMappableField } from './fieldType'

export interface HandoffMapStat {
  template: LabelTemplate
  /** 参与映射的文本字段数（排除固定文本与镜像字段） */
  mappable: number
  mapped: number
  unmapped: number
}

function mappableFields(template: LabelTemplate): TemplateField[] {
  return template.fields.filter(isMappableField)
}

export function handoffMapStat(template: LabelTemplate, headers: readonly string[]): HandoffMapStat {
  const fields = mappableFields(template)
  const { mapping } = autoMapFieldsDetailed(template.fields, [...headers])
  const mapped = fields.filter((f) => !!mapping[f.id]).length
  return { template, mappable: fields.length, mapped, unmapped: fields.length - mapped }
}

/**
 * candidates[0] 为当前模板。返回应切换到的模板；当前模板已全映射、或没有更合适的候选时返回 null。
 * 候选须满足：全部字段可映射、字段数 > 0、对上的列数不少于当前模板（不丢信息，如带考场列时不退到座位号贴）；
 * 多个满足时取 mappable 最多者，并列取靠前者。
 */
export function pickHandoffTemplate(
  candidates: readonly LabelTemplate[],
  headers: readonly string[],
): HandoffMapStat | null {
  const current = candidates[0]
  if (!current) return null
  const currentStat = handoffMapStat(current, headers)
  if (currentStat.mappable === 0 || currentStat.unmapped === 0) return null
  let best: HandoffMapStat | null = null
  for (const template of candidates.slice(1)) {
    if (template.id === current.id) continue
    const stat = handoffMapStat(template, headers)
    if (stat.mappable === 0 || stat.unmapped > 0 || stat.mapped < currentStat.mapped) continue
    if (!best || stat.mappable > best.mappable) best = stat
  }
  return best
}

/** 命中率 = 已映射 / 可映射文本字段；没有可映射字段记 0 */
export function mapHitRate(stat: HandoffMapStat): number {
  return stat.mappable ? stat.mapped / stat.mappable : 0
}

/** 低命中阈值：当前模板命中率低于此值才推荐别的模板；推荐的模板命中率也须不低于此值 */
export const LOW_HIT_RATE = 0.5

/**
 * 用户自行粘贴 / 上传名单后的模板推荐（不自动切换，只给出建议）。
 * candidates[0] 为当前模板；当前命中率 ≥ 50% 时不推荐。候选须比当前多对上至少一列、
 * 且自身命中率 ≥ 50%；多个满足时取命中率最高者，并列取对上列更多者，再并列取靠前者。
 */
export function pickBetterTemplate(
  candidates: readonly LabelTemplate[],
  headers: readonly string[],
): HandoffMapStat | null {
  const current = candidates[0]
  if (!current || !headers.length) return null
  const currentStat = handoffMapStat(current, headers)
  if (currentStat.mappable === 0 || mapHitRate(currentStat) >= LOW_HIT_RATE) return null
  let best: HandoffMapStat | null = null
  for (const template of candidates.slice(1)) {
    if (template.id === current.id) continue
    const stat = handoffMapStat(template, headers)
    if (stat.mappable === 0 || stat.mapped <= currentStat.mapped) continue
    const rate = mapHitRate(stat)
    if (rate < LOW_HIT_RATE) continue
    if (!best || rate > mapHitRate(best) || (rate === mapHitRate(best) && stat.mapped > best.mapped)) {
      best = stat
    }
  }
  return best
}
