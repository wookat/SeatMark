/**
 * 中文拼音匹配：首字母零依赖（Intl.Collator），全拼懒加载 pinyin-pro。
 * 利用 Intl.Collator 的 zh 拼音排序，对每个汉字与各声母的「边界字」比较，
 * 二分/线性定位其拼音首字母。多音字按主排序读音处理，作为搜索建议足够。
 */
import { ref } from 'vue'

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

// ---------- 全拼匹配（懒加载 pinyin-pro，仅在用户输入较长字母串时才加载词典） ----------

/** 全拼库就绪信号：computed 中经 matchesChineseQuery 读取，加载完成后自动触发重算 */
const fullPinyinReady = ref(false)
let fullPinyinOf: ((text: string) => string) | null = null
let fullPinyinLoading: Promise<void> | null = null

/** 预加载全拼词典；重复调用只加载一次 */
export function preloadFullPinyin(): Promise<void> {
  if (fullPinyinOf) return Promise.resolve()
  fullPinyinLoading ??= import('pinyin-pro')
    .then(({ pinyin }) => {
      fullPinyinOf = (text: string) =>
        pinyin(text, { toneType: 'none', nonZh: 'consecutive' }).replace(/\s+/g, '').toLowerCase()
      fullPinyinReady.value = true
    })
    .catch(() => {
      fullPinyinLoading = null
    })
  return fullPinyinLoading
}

const fullPinyinCache = new Map<string, string>()

function fullPinyinOfCached(text: string): string | null {
  if (!fullPinyinOf) return null
  let v = fullPinyinCache.get(text)
  if (v === undefined) {
    v = fullPinyinOf(text)
    fullPinyinCache.set(text, v)
  }
  return v
}

/**
 * 站内搜索匹配：原文包含 query，或纯字母 query 命中拼音首字母串 / 全拼串。
 * 全拼词典按需懒加载，加载完成后使用方的 computed 会经 fullPinyinReady 自动重算。
 * query 为空时视为全部匹配。
 */
export function matchesChineseQuery(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (haystack.toLowerCase().includes(q)) return true
  if (!/^[a-z]+$/.test(q)) return false
  if (pinyinInitials(haystack).includes(q)) return true
  if (q.length >= 2) {
    if (fullPinyinReady.value && fullPinyinOf) {
      const fp = fullPinyinOfCached(haystack)
      if (fp?.includes(q)) return true
    } else {
      void preloadFullPinyin()
    }
  }
  return false
}
