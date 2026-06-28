import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { title: '座签·桌牌席卡·门贴证卡批量生成 - SeatMark 座签' },
    },
    {
      path: '/studio',
      name: 'studio',
      component: () => import('@/views/StudioView.vue'),
      meta: { title: '标签工坊 - SeatMark 座签' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

router.afterEach((to) => {
  const title = to.meta.title
  if (typeof title === 'string') document.title = title

  const path = to.fullPath

  // GA4 pageview
  const w = window as any
  if (typeof w.gtag === 'function') {
    w.gtag('event', 'page_view', {
      page_path: path,
      page_title: title ?? document.title,
    })
  }

  // 百度统计 pageview
  if (Array.isArray(w._hmt)) {
    w._hmt.push(['_trackPageview', path])
  }
})
