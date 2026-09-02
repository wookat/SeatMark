import {
  createMemoryHistory,
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from 'vue-router'

import { localeFromPath, setLocale, stripLocalePrefix } from '@/i18n'

/** 仅有中文正文的内容站详情路由：/en 镜像直接回到中文路径，避免英文外壳包中文正文 */
const EN_ZH_ONLY_DETAIL_RE = /^\/en\/(guides|templates|papers|vs)\/[^/]+/

/** /en 下仅有中文正文的详情页 →对应中文路径；其余返回 null */
export function zhOnlyRedirectTarget(path: string): string | null {
  return EN_ZH_ONLY_DETAIL_RE.test(path) ? stripLocalePrefix(path) : null
}

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
    path: '/vs',
    name: 'vs-index',
    component: () => import('@/views/VsIndexView.vue'),
  },
  {
    path: '/vs/:slug',
    name: 'vs-detail',
    component: () => import('@/views/VsDetailView.vue'),
  },
  {
    path: '/desk-card-generator',
    name: 'topic-desk-card-generator',
    component: () => import('@/views/TopicLandingView.vue'),
  },
  {
    path: '/name-card-batch',
    name: 'topic-name-card-batch',
    component: () => import('@/views/TopicLandingView.vue'),
  },
  {
    path: '/seating',
    name: 'seating',
    component: () => import('@/views/SeatingView.vue'),
  },
  {
    path: '/banquet',
    name: 'banquet',
    component: () => import('@/views/BanquetView.vue'),
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
]

/** /en 前缀英文路由：同一份组件镜像生成，meta.locale 标记语言 */
const enRoutes: RouteRecordRaw[] = routes.map((route) => ({
  ...route,
  path: route.path === '/' ? '/en' : `/en${route.path}`,
  name: `en-${String(route.name)}`,
  meta: { ...route.meta, locale: 'en' },
}))

const allRoutes: RouteRecordRaw[] = [
  ...routes,
  ...enRoutes,
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
  },
]

/** SSR/预渲染环境无 window，使用内存路由 */
export function createAppRouter() {
  const router = createRouter({
    history:
      typeof window === 'undefined'
        ? createMemoryHistory(import.meta.env.BASE_URL)
        : createWebHistory(import.meta.env.BASE_URL),
    routes: allRoutes,
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

  // 进入目标路由前按 /en 前缀切换 locale（英文字典首次进入时懒加载；预渲染同样生效）
  router.beforeEach(async (to) => {
    const zhPath = zhOnlyRedirectTarget(to.path)
    if (zhPath) {
      return { path: zhPath, query: to.query, hash: to.hash, replace: true }
    }
    await setLocale(localeFromPath(to.path))
  })

  return router
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

/** 分析上报前剥离搜索词等用户输入参数，搜索内容不随页面路径外发到第三方 */
export function telemetryPath(fullPath: string): string {
  const qs = fullPath.indexOf('?')
  if (qs === -1) return fullPath
  const hashIdx = fullPath.indexOf('#', qs)
  const query = fullPath.slice(qs + 1, hashIdx === -1 ? undefined : hashIdx)
  const params = new URLSearchParams(query)
  params.delete('q')
  const rest = params.toString()
  return (
    fullPath.slice(0, qs) +
    (rest ? `?${rest}` : '') +
    (hashIdx === -1 ? '' : fullPath.slice(hashIdx))
  )
}

export const router = createAppRouter()

/**
 * 懒加载路由分包一旦网络失败会被浏览器按 URL 缓存为永久 reject，
 * 之后 SPA 内重试导航静默失败；整页跳转到目标地址即可恢复。
 * sessionStorage 防重入：同一路径连续失败（真离线）不做刷新循环。
 */
router.onError((error, to) => {
  if (typeof window === 'undefined') return
  if (!/Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(String(error?.message ?? error))) {
    return
  }
  const key = `chunk-reload:${to.fullPath}`
  if (sessionStorage.getItem(key)) return
  sessionStorage.setItem(key, '1')
  window.location.assign(to.fullPath)
})

router.afterEach(async (to) => {
  if (typeof window === 'undefined') return

  // SPA 内导航成功即清除该路径的分包刷新防重入标记，之后再失败仍可自动恢复
  sessionStorage.removeItem(`chunk-reload:${to.fullPath}`)

  // 离线等网络异常时 SEO 模块加载失败不应产生裸 pageerror，跳过本次更新即可
  try {
    const { applySeo } = await import('@/utils/seo')
    applySeo(to.path)
  } catch {
    // ignore: 下次导航会重试
  }

  const path = telemetryPath(to.fullPath)

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
