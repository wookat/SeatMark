/**
 * 中文拼音首字母匹配（零依赖）：
 * 利用 Intl.Collator 的 zh 拼音排序，对每个汉字与各声母的「边界字」比较，
 * 二分/线性定位其拼音首字母。多音字按主排序读音处理，作为搜索建议足够。
 */

/** 各拼音首字母的边界字（按拼音序排列；无 i/u/v 声母） */
const BOUNDARIES: readonly (readonly [string, string])[] = [
  ['a', '阿'],
  ['b', '芭'],
  ['c', '擦'],
  ['d', '搭'],
  ['e', '蛾'],
  ['f', '发'],
  ['g', '噶'],
  ['h', '哈'],
  ['j', '击'],
  ['k', '喀'],
  ['l', '垃'],
  ['m', '妈'],
  ['n', '拿'],
  ['o', '哦'],
  ['p', '啪'],
  ['q', '期'],
  ['r', '然'],
  ['s', '撒'],
  ['t', '塌'],
  ['w', '挖'],
  ['x', '昔'],
  ['y', '压'],
  ['z', '匝'],
]

const collator =
  typeof Intl !== 'undefined' && typeof Intl.Collator === 'function'
    ? new Intl.Collator('zh-Hans-CN-u-co-pinyin')
    : null

const HAN_RE = /[\u4e00-\u9fff]/
const initialCache = new Map<string, string>()

/** 单个字符的拼音首字母；英文/数字返回其小写本身，其他字符返回空串 */
export function pinyinInitial(char: string): string {
  if (/[a-zA-Z0-9]/.test(char)) return char.toLowerCase()
  if (!collator || !HAN_RE.test(char)) return ''
  const cached = initialCache.get(char)
  if (cached !== undefined) return cached
  let result = ''
  for (const [letter, boundary] of BOUNDARIES) {
    if (collator.compare(char, boundary) >= 0) result = letter
    else break
  }
  initialCache.set(char, result)
  return result
}

/** 整段文本的拼音首字母串，如「监考证」→ "jkz" */
export function pinyinInitials(text: string): string {
  let out = ''
  for (const char of text) out += pinyinInitial(char)
  return out
}

/**
 * 站内搜索匹配：原文包含 query，或纯字母 query 命中拼音首字母串。
 * query 为空时视为全部匹配。
 */
export function matchesChineseQuery(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (haystack.toLowerCase().includes(q)) return true
  return /^[a-z]+$/.test(q) && pinyinInitials(haystack).includes(q)
}
