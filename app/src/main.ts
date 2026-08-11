import { createPinia } from 'pinia'
import { createApp } from 'vue'
import * as Sentry from '@sentry/vue'

import App from '@/App.vue'
import { router, telemetryPath } from '@/router'

import '@/assets/main.css'
import '@/assets/fonts-plangothic.css'

const SENTRY_DSN = 'https://e07e934a609b9b8aab670cf18d669e42@o4511621503451136.ingest.us.sentry.io/4511621514592256'

if (SENTRY_DSN) {
  Sentry.init({
    app: createApp(App),
    dsn: SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration({ router }),
    ],
    tracesSampleRate: 0.2,
    // 性能事务的浏览器指标 span 取自 PerformanceNavigationTiming（初始文档 URL），
    // history.replaceState 改写不了它——上报前统一剥离搜索词等用户输入参数
    beforeSendTransaction(event) {
      if (event.request?.url) {
        event.request.url = telemetryPath(event.request.url)
      }
      if (event.transaction) {
        event.transaction = telemetryPath(event.transaction)
      }
      for (const span of event.spans ?? []) {
        if (span.description) {
          span.description = telemetryPath(span.description)
        }
      }
      return event
    },
    beforeBreadcrumb(breadcrumb) {
      const data = breadcrumb.data
      if (data) {
        for (const key of ['from', 'to', 'url'] as const) {
          if (typeof data[key] === 'string') {
            data[key] = telemetryPath(data[key])
          }
        }
      }
      return breadcrumb
    },
  })
}

const app = createApp(App)

if (SENTRY_DSN) {
  Sentry.attachErrorHandler(app)
}

app.use(createPinia()).use(router)

// 等首个路由的异步组件就绪后再挂载：弱网下预渲染的静态 HTML 会一直可见，
// 不会出现「挂载清空 DOM → 路由 chunk 到达前正文空白」的窗口
router.isReady().then(() => {
  app.mount('#app')
})

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
      console.warn('SW registration failed:', err)
    })
  })
}
