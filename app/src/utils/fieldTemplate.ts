import type { DataRow } from '@/types/template'

/** 组合字段模板串中的占位符：{Excel 列名}，如「第{考场}考场-{座位号}号」 */
const PLACEHOLDER_RE = /\{([^{}]+)\}/g

/**
 * 映射值是否为「组合字段」模板串：包含 {列名} 占位符且本身不是一个真实表头
 * （表头恰好带花括号时按普通列处理，避免误判）。
 */
export function isCompositeMapping(value: string, headers: string[]): boolean {
  if (!value || headers.includes(value)) return false
  return /\{[^{}]+\}/.test(value)
}

/** 提取模板串引用的列名（去重，保持出现顺序） */
export function templateColumns(templateStr: string): string[] {
  const seen = new Set<string>()
  for (const match of templateStr.matchAll(PLACEHOLDER_RE)) {
    const column = match[1]!.trim()
    if (column) seen.add(column)
  }
  return [...seen]
}

/** 模板串求值：{列名} 替换为该行对应单元格文本，缺失列按空串处理 */
export function evaluateFieldTemplate(templateStr: string, row: DataRow): string {
  return templateStr.replace(PLACEHOLDER_RE, (_whole, column: string) =>
    String(row[column.trim()] ?? ''),
  )
}

/** 模板串引用的列是否全部存在于表头中（用于映射面板校验提示） */
export function templateColumnsValid(templateStr: string, headers: string[]): boolean {
  const set = new Set(headers)
  return templateColumns(templateStr).every((c) => set.has(c))
}
