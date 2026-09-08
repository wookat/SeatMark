/**
 * PNG 逐张导出的「导出范围」解析：按全局标签序号（1 起）补打单张或若干张。
 *
 * 支持「5」「1-3,10」「3-」（到末尾）；中文逗号/顿号与「～」也接受。
 * 空白输入 = 全部，返回 { ok: true, indices: null }。
 */
export type LabelRangeResult =
  | { ok: true; indices: number[] | null }
  | { ok: false; error: 'empty-total' | 'invalid' | 'out-of-range' }

const SEPARATOR = /[,，、;；\s]+/
const TOKEN = /^(\d+)?(?:-(\d+)?)?$/

/**
 * 解析导出范围为有序去重的 0-based 索引数组；total 为标签总数。
 * 非法 token（如 abc、1-2-3、单独的 -）→ invalid；序号为 0 或超过 total → out-of-range。
 */
export function parseLabelRange(input: string, total: number): LabelRangeResult {
  const text = input.replace(/[～~]/g, '-').trim()
  if (!text) return { ok: true, indices: null }
  if (total <= 0) return { ok: false, error: 'empty-total' }

  const picked = new Set<number>()
  for (const raw of text.split(SEPARATOR)) {
    const token = raw.trim()
    if (!token) continue
    const m = TOKEN.exec(token)
    if (!m || (m[1] === undefined && m[2] === undefined) || token === '-') {
      return { ok: false, error: 'invalid' }
    }
    const isRange = token.includes('-')
    const start = m[1] === undefined ? 1 : Number(m[1])
    const end = isRange ? (m[2] === undefined ? total : Number(m[2])) : start
    if (start < 1 || end > total || start > total) return { ok: false, error: 'out-of-range' }
    if (end < start) return { ok: false, error: 'invalid' }
    for (let n = start; n <= end; n++) picked.add(n - 1)
  }
  if (!picked.size) return { ok: false, error: 'invalid' }
  return { ok: true, indices: [...picked].sort((a, b) => a - b) }
}
