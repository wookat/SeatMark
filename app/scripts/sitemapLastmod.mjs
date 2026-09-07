/**
 * sitemap <lastmod> 取值：按 URL 类型回到内容数据源的日期字段，
 * 只有工具页/首页等无内容日期的路由才用构建日。
 *
 * - /guides/:slug      → guide.dateModified（其次 datePublished）
 * - /templates/:slug   → detail.dateModified / datePublished / updatedAt（数据目前无日期字段 → 构建日）
 * - /vs/:slug          → vs.dateModified / datePublished / updatedAt / researchDate
 *                        （researchDate 当前为 YYYY-MM 精度，校验不通过时回退构建日）
 * - /topics/*          → topic.dateModified / datePublished / updatedAt（数据目前无日期字段 → 构建日）
 * - 其余               → 构建日
 *
 * 所有候选值都要通过 YYYY-MM-DD 且可被 Date 解析的校验，非法值一律回退构建日。
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isValidIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false
  const time = Date.parse(`${value}T00:00:00Z`)
  if (Number.isNaN(time)) return false
  // 反向格式化确认没有 2026-02-31 这类被 Date 自动进位的值
  return new Date(time).toISOString().slice(0, 10) === value
}

function firstValidDate(record, keys) {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (isValidIsoDate(value)) return value
  }
  return null
}

const DATE_KEYS = ['dateModified', 'datePublished', 'updatedAt']

/**
 * @param {string} path 站内路径（如 /guides/excel-import）
 * @param {{ guides?: Array<{slug:string}>, templateDetails?: Array<{slug:string}>, vsPages?: Array<{slug:string}>, topicPages?: Array<{path:string}>, today: string }} sources
 * @returns {string} YYYY-MM-DD
 */
export function resolveLastmod(path, sources) {
  const { guides = [], templateDetails = [], vsPages = [], topicPages = [], today } = sources
  if (!isValidIsoDate(today)) throw new Error(`resolveLastmod: today 必须为 YYYY-MM-DD，得到 ${String(today)}`)

  const guideMatch = /^\/guides\/([^/]+)$/.exec(path)
  if (guideMatch) {
    const guide = guides.find((g) => g.slug === guideMatch[1])
    return firstValidDate(guide, DATE_KEYS) ?? today
  }

  const templateMatch = /^\/templates\/([^/]+)$/.exec(path)
  if (templateMatch) {
    const detail = templateDetails.find((t) => t.slug === templateMatch[1])
    return firstValidDate(detail, DATE_KEYS) ?? today
  }

  const vsMatch = /^\/vs\/([^/]+)$/.exec(path)
  if (vsMatch) {
    const page = vsPages.find((v) => v.slug === vsMatch[1])
    return firstValidDate(page, [...DATE_KEYS, 'researchDate']) ?? today
  }

  if (path.startsWith('/topics/')) {
    const topic = topicPages.find((t) => t.path === path)
    return firstValidDate(topic, DATE_KEYS) ?? today
  }

  return today
}
