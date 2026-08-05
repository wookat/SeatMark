<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

import AnnouncementBar from '@/components/ui/AnnouncementBar.vue'
import AppFooter from '@/components/ui/AppFooter.vue'
import AppHeader from '@/components/ui/AppHeader.vue'
import FeedbackButton from '@/components/ui/FeedbackButton.vue'
import LoadingOverlay from '@/components/ui/LoadingOverlay.vue'
import QuotaLimitDialog from '@/components/ui/QuotaLimitDialog.vue'
import ToastHost from '@/components/ui/ToastHost.vue'
import WeChatGuideOverlay from '@/components/ui/WeChatGuideOverlay.vue'
import { useAuthStore } from '@/stores/auth'
import { apiFetch } from '@/utils/api'
import { fetchSharedPayload, SHARE_HASH_PREFIX, SHARE_SHORT_PARAM } from '@/utils/share'

const auth = useAuthStore()
const router = useRouter()

onMounted(() => {
  void auth.refresh()

  const params = new URLSearchParams(window.location.search)
  let dirty = false

  // 分享链接访问上报（?ref=分享码）：服务端 IP+日去重后为分享者赠送 1 次无水印导出
  const ref = params.get('ref')
  if (ref && /^[0-9a-f]{8}$/.test(ref)) {
    void apiFetch('/api/share/visit', { method: 'POST', body: { code: ref } }).catch(() => {})
    params.delete('ref')
    dirty = true
  }

  // 模板短码（?s=短码，微信扫码短链）：取回负载后走既有 #tpl= 导入流程
  const short = params.get(SHARE_SHORT_PARAM)
  if (short) {
    params.delete(SHARE_SHORT_PARAM)
    dirty = true
  }

  if (dirty) {
    const query = params.toString()
    const clean = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    window.history.replaceState(null, '', clean)
  }

  if (short) {
    void fetchSharedPayload(short).then((payload) => {
      if (payload) {
        void router.replace({ path: '/studio', hash: `${SHARE_HASH_PREFIX}${payload}` })
      }
    })
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
    <WeChatGuideOverlay />
  </div>
</template>
