<script setup lang="ts">
import { onMounted } from 'vue'

import AnnouncementBar from '@/components/ui/AnnouncementBar.vue'
import AppFooter from '@/components/ui/AppFooter.vue'
import AppHeader from '@/components/ui/AppHeader.vue'
import FeedbackButton from '@/components/ui/FeedbackButton.vue'
import LoadingOverlay from '@/components/ui/LoadingOverlay.vue'
import QuotaLimitDialog from '@/components/ui/QuotaLimitDialog.vue'
import ToastHost from '@/components/ui/ToastHost.vue'
import { useAuthStore } from '@/stores/auth'
import { apiFetch } from '@/utils/api'

const auth = useAuthStore()

onMounted(() => {
  void auth.refresh()

  // 分享链接访问上报（?ref=分享码）：服务端 IP+日去重后为分享者赠送 1 次无水印导出
  const params = new URLSearchParams(window.location.search)
  const ref = params.get('ref')
  if (ref && /^[0-9a-f]{8}$/.test(ref)) {
    void apiFetch('/api/share/visit', { method: 'POST', body: { code: ref } }).catch(() => {})
    params.delete('ref')
    const query = params.toString()
    const clean = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    window.history.replaceState(null, '', clean)
  }
})
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <AnnouncementBar />
    <AppHeader />
    <main class="flex-1">
      <RouterView />
    </main>
    <AppFooter />
    <ToastHost />
    <LoadingOverlay />
    <FeedbackButton />
    <QuotaLimitDialog />
  </div>
</template>
