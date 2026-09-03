/**
 * 构建期预渲染专用入口（scripts/prerender.mjs 调用）：
 * 对每个内容路由 renderToString 输出完整正文 HTML，
 * 保证 EdgeOne 静态托管下搜索引擎 / AI 爬虫无需执行 JS 即可抓到全文。
 */
import { createPinia } from 'pinia'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'

import App from '@/App.vue'
import { createAppRouter } from '@/router'

export { defaultTemplates } from '@/data/defaultTemplates'
export { guides } from '@/data/guides'
export { PRICING_SUMMARY, PRO_ORIGINAL_PRICE, TEAM_ORIGINAL_PRICE } from '@/data/pricingSummary'
export { appShellPaths, isSitemapEligible, prerenderPaths, resolveSeo, SITE_ORIGIN } from '@/data/seo'
export { templateDetails } from '@/data/templateDetails'
export { QUOTA_ANON_DAILY, QUOTA_USER_DAILY } from '@/stores/quota'

export async function render(url: string): Promise<string> {
  const app = createSSRApp(App)
  const router = createAppRouter()
  app.use(createPinia()).use(router)
  await router.push(url)
  await router.isReady()
  return renderToString(app)
}
