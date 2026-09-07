/**
 * 未映射字段提示文案：PreviewArea 的提示条 / 导出弹窗与 StudioView 的带入 toast 共用，
 * 最多列 3 个字段名作例，超出加省略号。
 */

export interface UnmappedNotice {
  count: number
  examples: string
}

export function buildUnmappedNotice(
  fields: readonly { label: string }[],
  joiner: string,
): UnmappedNotice | null {
  if (!fields.length) return null
  const examples = fields.slice(0, 3).map((f) => f.label).join(joiner)
  return { count: fields.length, examples: fields.length > 3 ? `${examples}…` : examples }
}
