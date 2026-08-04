import {
  createMemoryHistory,
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from 'vue-router'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
  },
  {
    path: '/studio',
    name: 'studio',
    component: () => import('@/views/StudioView.vue'),
  },
  {
    path: '/pricing',
    name: 'pricing',
    component: () => import('@/views/PricingView.vue'),
  },
  {
    path: '/guides',
    name: 'guides',
    component: () => import('@/views/GuidesView.vue'),
  },
  {
    path: '/guides/:slug',
    name: 'guide-article',
    component: () => import('@/views/GuideArticleView.vue'),
  },
  {
    path: '/templates',
    name: 'templates',
    component: () => import('@/views/TemplatesView.vue'),
  },
  {
    path: '/templates/:slug',
    name: 'template-detail',
    component: () => import('@/views/TemplateDetailView.vue'),
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

/** SSR/预渲染环境无 window，使用内存路由 */
export function createAppRouter() {
  return createRouter({
    history:
      typeof window === 'undefined'
        ? createMemoryHistory(import.meta.env.BASE_URL)
        : createWebHistory(import.meta.env.BASE_URL),
    routes,
    scrollBehavior(to, _from, savedPosition) {
      // 仅落地页锚点走定位滚动；工坊的分享 hash（#t=...）不是选择器，必须排除
      if (/^#[a-z][\w-]*$/.test(to.hash)) {
        return { el: to.hash, top: 72, behavior: 'smooth' }
      }
      return savedPosition ?? { top: 0 }
    },
  })
}

export const router = createAppRouter()

router.afterEach(async (to) => {
  if (typeof window === 'undefined') return

  const { applySeo } = await import('@/utils/seo')
  applySeo(to.path)

  const path = to.fullPath

  // GA4 pageview
  const w = window as any
  if (typeof w.gtag === 'function') {
    w.gtag('event', 'page_view', {
      page_path: path,
      page_title: document.title,
    })
  }

  // 百度统计 pageview
  if (Array.isArray(w._hmt)) {
    w._hmt.push(['_trackPageview', path])
  }
})
