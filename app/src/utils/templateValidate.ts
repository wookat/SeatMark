import type { LabelTemplate, TemplateField } from '@/types/template'

/**
 * 模板结构校验（轻量独立模块）。
 * App 壳层的分享链路等场景直接使用，避免引入模板库 store 及其内置模板数据。
 */
export function isValidTemplate(value: unknown): value is LabelTemplate {
  if (!value || typeof value !== 'object') return false
  const t = value as Partial<LabelTemplate>
  return Boolean(t.label && t.page && Array.isArray(t.fields))
}

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const FUNC_COLOR_RE = /^(?:rgba?|hsla?)\([^()]*\)$/i
const NAMED_COLOR_RE = /^[a-z]{3,24}$/i
const GRADIENT_RE = /^(?:repeating-)?(?:linear|radial)-gradient\(.*\)$/is
/** 任何可能触发外部请求 / 脚本执行 / 转义混淆的片段一律拒绝 */
const FORBIDDEN_RE =
  /url\s*\(|image(?:-set)?\s*\(|src\s*\(|element\s*\(|cross-fade\s*\(|paint\s*\(|expression|javascript:|[\\<>;{}]|[\u0000-\u001f\u007f]/i

const IMAGE_DATA_URL_RE = /^data:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml);base64,[a-z0-9+/=\s]*$/i

/** 是否为可放行的颜色字面量：#hex / rgb() / hsl() / 颜色名 / 不含外链的渐变 */
export function isSafeCssColor(value: string): boolean {
  const v = value.trim()
  if (!v || v.length > 2000 || FORBIDDEN_RE.test(v)) return false
  if (HEX_COLOR_RE.test(v) || FUNC_COLOR_RE.test(v) || NAMED_COLOR_RE.test(v)) return true
  return GRADIENT_RE.test(v)
}

/** 是否为可放行的固定图片来源：仅 data:image/*;base64 与 blob: */
export function isSafeImageSrc(value: string): boolean {
  const v = value.trim()
  if (!v) return false
  if (v.startsWith('blob:')) return !FORBIDDEN_RE.test(v)
  return IMAGE_DATA_URL_RE.test(v)
}

function stripUnsafe<K extends string>(
  target: Partial<Record<K, string>>,
  key: K,
  accept: (value: string) => boolean,
) {
  const value: unknown = target[key]
  if (value === undefined) return
  if (typeof value !== 'string' || !accept(value)) delete target[key]
}

/**
 * 导入来源（分享链接 / JSON 文件 / 云端找回）的模板净化：
 * 颜色类字段只放行颜色字面量，固定图片只放行内嵌 data:image 与 blob:，
 * 其余（url(...)、http(s) 外链、脚本伪协议等）剥离，避免渲染时向第三方发请求。
 * 不改变结构校验（isValidTemplate），正常内置模板经净化后与自身深等。
 */
export function sanitizeTemplateForImport(template: LabelTemplate): LabelTemplate {
  const label = { ...template.label }
  stripUnsafe(label, 'background', isSafeCssColor)
  stripUnsafe(label, 'borderColor', isSafeCssColor)

  const fields: TemplateField[] = template.fields.map((field) => {
    const next = { ...field }
    stripUnsafe(next, 'background', isSafeCssColor)
    stripUnsafe(next, 'color', isSafeCssColor)
    stripUnsafe(next, 'borderColor', isSafeCssColor)
    stripUnsafe(next, 'imageSrc', isSafeImageSrc)
    return next
  })

  const result: LabelTemplate = { ...template, label, fields }
  stripUnsafe(result, 'accent', isSafeCssColor)
  return result
}
