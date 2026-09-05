import type { Locale } from '@/i18n'
import type { LabelTemplate } from '@/types/template'

/** 模板内固定文案 / 小注的 zh → en 映射；未命中原样保留 */
export const TEMPLATE_FIXED_TEXT_EN: Record<string, string> = {
  '座位号 SEAT': 'SEAT NO.',
  '座位号 SEAT NO.': 'SEAT NO.',
  姓名: 'NAME',
  考场: 'ROOM',
  准考证号: 'EXAM ID',
  请对号入座: 'Please sit in your assigned seat',
}

function localizeText(text: string): string {
  return TEMPLATE_FIXED_TEXT_EN[text.trim()] ?? text
}

const ROOM_SAMPLE_RE = /^(?:考场-(\d+)|第(\d+)考场)$/
const CJK_RE = /[\u4e00-\u9fff]/
/** 英文预览的占位姓名：仅用于模板橱窗示例，与用户名单无关 */
export const SAMPLE_NAME_EN = 'Alex Chen'

/** 示例值（sample / sampleData）本地化：考场编号→Room N，中文姓名→英文占位名，其余原样保留 */
function localizeSample(fieldId: string, value: string): string {
  const room = ROOM_SAMPLE_RE.exec(value.trim())
  if (room) return `Room ${room[1] ?? room[2]}`
  if (fieldId === 'name' && CJK_RE.test(value)) return SAMPLE_NAME_EN
  return value
}

function localizeSampleData(
  sampleData: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!sampleData) return sampleData
  let changed = false
  const next: Record<string, string> = {}
  for (const [id, value] of Object.entries(sampleData)) {
    const localized = localizeSample(id, value)
    if (localized !== value) changed = true
    next[id] = localized
  }
  return changed ? next : sampleData
}

/**
 * 按 locale 本地化模板中随每枚标签重复渲染的固定文案（fixedText）、字段小注（caption）
 * 以及橱窗预览的示例值（sample / sampleData）。
 * 纯函数：zh 或无命中时返回原对象；有命中时返回浅拷贝，不修改入参。
 */
export function localizeTemplateForLocale(template: LabelTemplate, locale: Locale): LabelTemplate {
  if (locale !== 'en') return template
  let changed = false
  const fields = template.fields.map((field) => {
    const fixedText = field.fixedText != null ? localizeText(field.fixedText) : field.fixedText
    const caption = field.caption != null ? localizeText(field.caption) : field.caption
    const sample = field.sample != null ? localizeSample(field.id, field.sample) : field.sample
    if (fixedText === field.fixedText && caption === field.caption && sample === field.sample) {
      return field
    }
    changed = true
    return { ...field, fixedText, caption, sample }
  })
  const sampleData = localizeSampleData(template.sampleData)
  if (sampleData !== template.sampleData) changed = true
  return changed ? { ...template, fields, sampleData } : template
}
