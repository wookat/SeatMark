/**
 * 名单完全重复行统计：以「所有已映射字段的文本拼接」为键，同键出现 >1 次即为一组重复。
 * 纯提示用途（导出前提醒），不修改数据；O(n)。
 */
export interface DuplicateRowsSummary {
  /** 重复组数（同一内容出现 ≥2 次算 1 组） */
  groups: number
  /** 涉及的总行数（每组按出现次数计） */
  rows: number
  /** 第一组重复内容的示例，如「张三·3 考场·12 号」 */
  example: string | null
}

const EMPTY: DuplicateRowsSummary = { groups: 0, rows: 0, example: null }

/** 键分隔符：不可打印字符，避免「a|b」+「c」与「a」+「b|c」撞键 */
const KEY_SEP = '\u0000'

export function summarizeDuplicateRows<Row>(
  rows: readonly Row[],
  texts: (row: Row) => readonly string[],
): DuplicateRowsSummary {
  if (rows.length < 2) return EMPTY
  const counts = new Map<string, { count: number; values: readonly string[] }>()
  for (const row of rows) {
    const values = texts(row).map((v) => v.trim())
    if (values.every((v) => !v)) continue
    const key = values.join(KEY_SEP)
    const hit = counts.get(key)
    if (hit) hit.count += 1
    else counts.set(key, { count: 1, values })
  }
  let groups = 0
  let total = 0
  let example: string | null = null
  for (const { count, values } of counts.values()) {
    if (count < 2) continue
    groups += 1
    total += count
    if (example === null) example = values.filter(Boolean).join('·')
  }
  return groups ? { groups, rows: total, example } : EMPTY
}
