<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AnnouncementBar from '@/components/ui/AnnouncementBar.vue'
import AppFooter from '@/components/ui/AppFooter.vue'
import AppHeader from '@/components/ui/AppHeader.vue'
import FeedbackButton from '@/components/ui/FeedbackButton.vue'
import LoadingOverlay from '@/components/ui/LoadingOverlay.vue'
import QuotaLimitDialog from '@/components/ui/QuotaLimitDialog.vue'
import ShareWelcomeBanner from '@/components/ui/ShareWelcomeBanner.vue'
import ToastHost from '@/components/ui/ToastHost.vue'
import WeChatGuideOverlay from '@/components/ui/WeChatGuideOverlay.vue'
import { useI18n } from '@/i18n'
import { INVITE_REF_KEY, useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { apiFetch } from '@/utils/api'
import { clearLandingQuery } from '@/utils/landing'
import { fetchSharedPayload, SHARE_HASH_PREFIX, SHARE_SHORT_PARAM } from '@/utils/share'

const auth = useAuthStore()
const toast = useToastStore()
const router = useRouter()
const { t } = useI18n()

/** 跳过头部直达主内容（键盘用户 skip-link） */
function focusMain() {
  document.getElementById('main-content')?.focus()
}

/** 被分享者落地欢迎横幅（?ref= 进入）：介绍这是什么工具 + 一键开始 */
const shareWelcomeOpen = ref(false)

onMounted(() => {
  void auth.refresh()

  const params = new URLSearchParams(window.location.search)

  // 分享链接访问上报（?ref=分享码）：服务端 IP+日去重后为分享者赠送 1 次无水印导出
  const refCode = params.get('ref')
  if (refCode && /^[0-9a-f]{8}$/.test(refCode)) {
    void apiFetch('/api/share/visit', { method: 'POST', body: { code: refCode } }).catch(() => {})
    shareWelcomeOpen.value = true
    // 邀请归属：留存邀请码，新用户注册时双方各赠专业版天数
    try {
      localStorage.setItem(INVITE_REF_KEY, refCode)
    } catch {
      // 忽略存储异常
    }
  }

  // 模板短码（?s=短码，微信扫码短链）：取回负载后走既有 #tpl= 导入流程
  const short = params.get(SHARE_SHORT_PARAM)

  if (refCode != null || short != null) {
    void clearLandingQuery(router)
  }

  if (short) {
    void fetchSharedPayload(short).then((payload) => {
      if (payload) {
        void router.replace({ path: '/studio', hash: `${SHARE_HASH_PREFIX}${payload}` })
      } else {
        toast.warning(
          t('分享模板暂时无法打开'),
          t('链接可能已过期或网络波动，请让对方重新生成；你仍可直接使用全部内置模板'),
        )
      }
    })
  }
})
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <a
      href="#main-content"
      class="sr-only rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
      @click.prevent="focusMain"
    >
      {{ t('跳到主内容') }}
    </a>
    <AnnouncementBar />
    <AppHeader />
    <ShareWelcomeBanner :open="shareWelcomeOpen" @close="shareWelcomeOpen = false" />
    <!-- min-h 让 footer 首帧位于视口之外，异步路由内容撑开时不产生可见位移（CLS） -->
    <main id="main-content" tabindex="-1" class="min-h-svh flex-1 outline-none print:min-h-0">
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
