/**
 * /en 下有独立英文正文的内容站详情页（不重定向回中文、可索引、进 sitemap）。
 * 单独成文件是为了让路由守卫不必引入完整内容数据；与 vsPages 中 lang === 'en' 的条目
 * 以及 guidesEn 的条目一一对应（由 vsPages.spec / enGuides 断言保持一致）。
 */
export const EN_CONTENT_DETAIL_PATHS = [
  '/en/vs/prismm-alternative',
  '/en/vs/canva',
  '/en/vs/placecard-us',
  '/en/vs/wps-mail-merge',
  '/en/vs/chuangkit',
  '/en/guides/wedding-seating-chart-from-excel',
  '/en/guides/print-place-cards-from-excel',
  '/en/guides/name-badges-from-spreadsheet',
  '/en/guides/place-cards-from-google-sheets',
  '/en/guides/double-sided-name-tents',
  '/en/guides/desk-name-tags-from-class-list',
  '/en/guides/wedding-table-numbers-printable',
  '/en/guides/escort-cards-vs-place-cards',
  '/en/guides/holiday-dinner-place-cards',
  '/en/guides/eventbrite-attendee-badges',
  '/en/guides/wedding-table-plan-uk',
  '/en/guides/print-avery-tent-cards',
  '/en/place-card-generator',
  '/en/name-badge-generator',
  '/en/tent-card-generator',
  '/en/table-plan-maker',
  '/en/seating-chart-maker',
  '/en/classroom-label-maker',
] as const

export function isEnContentDetailPath(path: string): boolean {
  const clean = path !== '/' && path.endsWith('/') ? path.slice(0, -1) : path
  return (EN_CONTENT_DETAIL_PATHS as readonly string[]).includes(clean)
}
