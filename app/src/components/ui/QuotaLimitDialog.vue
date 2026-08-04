<script setup lang="ts">
import { computed } from 'vue'

import ModalDialog from '@/components/ui/ModalDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { QUOTA_USER_DAILY, useQuotaStore } from '@/stores/quota'

const auth = useAuthStore()
const quota = useQuotaStore()

const isLoggedIn = computed(() => auth.isLoggedIn)

function close() {
  quota.limitDialogOpen = false
}
</script>

<template>
  <ModalDialog :open="quota.limitDialogOpen" title="今日生成次数已用完" size="md" @close="close">
    <p class="leading-6">
      每次 PDF 导出或打印计一次生成。今日配额已用完，明天 0 点自动恢复；也可以通过以下方式立即获得更多次数：
    </p>

    <div class="mt-4 grid gap-3">
      <RouterLink
        v-if="!isLoggedIn"
        to="/account"
        class="flex items-start gap-3 rounded-lg border border-brand-200 bg-brand-50 p-4 transition-colors hover:border-brand-300"
        @click="close"
      >
        <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-3.9 3.6-7 8-7s8 3.1 8 7" />
          </svg>
        </span>
        <span>
          <span class="block text-sm font-bold text-slate-900">登录领取 Beta 会员</span>
          <span class="mt-0.5 block text-xs leading-5 text-slate-500">
            免费注册登录后每日 {{ QUOTA_USER_DAILY }} 次生成，自定义模板还能同步云端、跨设备找回
          </span>
        </span>
      </RouterLink>

      <RouterLink
        to="/account"
        class="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300"
        @click="close"
      >
        <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="18" cy="18" r="3" />
            <path d="m8.7 10.6 6.6-3.2m-6.6 6 6.6 3.2" />
          </svg>
        </span>
        <span>
          <span class="block text-sm font-bold text-slate-900">分享给同事，赠送生成次数</span>
          <span class="mt-0.5 block text-xs leading-5 text-slate-500">
            {{ isLoggedIn ? '在个人中心复制你的专属分享链接，每有 1 人访问当日 +2 次（每日上限 10 次）' : '登录后可生成专属分享链接，每有 1 人访问当日 +2 次（每日上限 10 次）' }}
          </span>
        </span>
      </RouterLink>
    </div>

    <p class="mt-4 text-xs leading-5 text-slate-400">
      名单与照片始终只在你的浏览器本地处理，登录只用于配额与模板同步，不会上传任何标签数据。
    </p>
  </ModalDialog>
</template>
