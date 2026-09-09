/**
 * /en 下有独立英文正文的内容站详情页（不重定向回中文、可索引、进 sitemap）。
 * 单独成文件是为了让路由守卫不必引入完整内容数据；与 vsPages 中 lang === 'en' 的条目一一对应
 * （由 vsPages.spec 断言两者一致）。
 */
export const EN_CONTENT_DETAIL_PATHS = ['/en/vs/prismm-alternative'] as const

export function isEnContentDetailPath(path: string): boolean {
  const clean = path !== '/' && path.endsWith('/') ? path.slice(0, -1) : path
  return (EN_CONTENT_DETAIL_PATHS as readonly string[]).includes(clean)
}
