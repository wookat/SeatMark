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
  {
    path: '/account',
    name: 'account',
    component: () => import('@/views/AccountView.vue'),
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/views/AdminView.vue'),
  },
  {
    path: '/papers',
    name: 'papers',
    component: () => import('@/views/PapersView.vue'),
  },
  {
    path: '/papers/:slug',
    name: 'paper-detail',
    component: () => import('@/views/PaperDetailView.vue'),
  },
  {
    path: '/seating',
    name: 'seating',
    component: () => import('@/views/SeatingView.vue'),
  },
  {
    path: '/terms',
    name: 'terms',
    component: () => import('@/views/TermsView.vue'),
  },
  {
    path: '/privacy',
    name: 'privacy',
    component: () => import('@/views/PrivacyView.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
  },
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
        scheduleAnchorCorrection(to.hash)
        return { el: to.hash, top: 72, behavior: 'smooth' }
      }
      if (savedPosition) {
        // 等目标页渲染出内容后再恢复滚动位，否则页面高度不够会被截断
        return new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(savedPosition)))
        })
      }
      return { top: 0 }
    },
  })
}

/**
 * 跨页锚点校正：首页模板橱窗等懒加载内容会在滚动后撑高上方布局，
 * 导致锚点落点偏移；延时复查并重新对齐，用户一旦主动滚动则取消
 */
function scheduleAnchorCorrection(hash: string) {
  if (typeof window === 'undefined') return
  let cancelled = false
  const cancel = () => {
    cancelled = true
    window.removeEventListener('wheel', cancel)
    window.removeEventListener('touchmove', cancel)
    window.removeEventListener('keydown', cancel)
  }
  window.addEventListener('wheel', cancel, { passive: true })
  window.addEventListener('touchmove', cancel, { passive: true })
  window.addEventListener('keydown', cancel)
  for (const delay of [700, 1500]) {
    setTimeout(() => {
      if (cancelled) return
      const el = document.querySelector(hash)
      if (!el) return
      const top = el.getBoundingClientRect().top
      if (Math.abs(top - 72) > 24) {
        window.scrollTo({ top: window.scrollY + top - 72, behavior: 'auto' })
      }
      if (delay === 1500) cancel()
    }, delay)
  }
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
