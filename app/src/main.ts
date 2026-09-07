import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from '@/App.vue'
import { router } from '@/router'
import { createPreInitErrorQueue, installSentry, SENTRY_DSN } from '@/utils/sentry'

import '@/assets/main.css'
import '@/assets/fonts-plangothic.css'

// Sentry 初始化前（含挂载过程）的错误先入队，init 后回放
const preInitErrors = SENTRY_DSN ? createPreInitErrorQueue(window) : undefined

const app = createApp(App)

app.use(createPinia()).use(router)

// 等首个路由的异步组件就绪后再挂载：弱网下预渲染的静态 HTML 会一直可见，
// 不会出现「挂载清空 DOM → 路由 chunk 到达前正文空白」的窗口
router.isReady().then(() => {
  app.mount('#app')
  // @sentry/vue 在挂载后才动态加载，首屏主包不再携带 SDK；传入的正是上面已挂载的同一 app
  if (preInitErrors) {
    void installSentry(app, router, { queue: preInitErrors })
  }
})

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
      console.warn('SW registration failed:', err)
    })
  })
}
