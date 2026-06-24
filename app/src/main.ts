import { createPinia } from 'pinia'
import { createApp } from 'vue'
import * as Sentry from '@sentry/vue'

import App from '@/App.vue'
import { router } from '@/router'

import '@/assets/main.css'

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

app.use(createPinia()).use(router).mount('#app')

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
      console.warn('SW registration failed:', err)
    })
  })
}
