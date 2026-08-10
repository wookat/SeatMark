import { createPinia } from 'pinia'
import { createApp } from 'vue'
import * as Sentry from '@sentry/vue'

import App from '@/App.vue'
import { router } from '@/router'

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
