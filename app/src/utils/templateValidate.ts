import type { LabelTemplate } from '@/types/template'

/**
 * 模板结构校验（轻量独立模块）。
 * App 壳层的分享链路等场景直接使用，避免引入模板库 store 及其内置模板数据。
 */
export function isValidTemplate(value: unknown): value is LabelTemplate {
  if (!value || typeof value !== 'object') return false
  const t = value as Partial<LabelTemplate>
  return Boolean(t.label && t.page && Array.isArray(t.fields))
}
