<script setup lang="ts">
import { computed } from 'vue'

import ModalDialog from '@/components/ui/ModalDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { QUOTA_USER_DAILY, useQuotaStore } from '@/stores/quota'
import { useToastStore } from '@/stores/toast'
import { copyToClipboard } from '@/utils/share'

const auth = useAuthStore()
const quota = useQuotaStore()
const toast = useToastStore()

const isLoggedIn = computed(() => auth.isLoggedIn)

const shareLink = computed(() =>
  auth.user ? `https://www.seatmark.cn/?ref=${auth.user.share.code}` : '',
)

async function copyShareLink() {
  if (!shareLink.value) return
  if (await copyToClipboard(shareLink.value)) {
    toast.success('分享链接已复制', '发给同事或群聊，每被点开 1 次即得 1 次无水印导出')
    close()
  } else {
    toast.warning('复制失败', '可到个人中心手动复制专属分享链接')
  }
}

function close() {
  quota.limitDialogOpen = false
}
</script>

<template>
  <ModalDialog :open="quota.limitDialogOpen" title="今日无水印导出次数已用完" size="md" @close="close">
    <p class="leading-6">
      带水印导出与打印不限次数，可随时继续使用。无水印导出配额明天 0 点自动恢复，也可以通过以下方式立即获得更多次数：
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
          <span class="block text-sm font-bold text-slate-900">登录开启 Beta 免费试用</span>
          <span class="mt-0.5 block text-xs leading-5 text-slate-500">
            免费注册登录后每日 {{ QUOTA_USER_DAILY }} 次无水印导出，专业版功能 Beta 期间免费试用，自定义模板可同步云端
          </span>
        </span>
      </RouterLink>

      <component
        :is="isLoggedIn ? 'button' : 'RouterLink'"
        v-bind="isLoggedIn ? { type: 'button' } : { to: '/account' }"
        class="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-slate-300"
        @click="isLoggedIn ? copyShareLink() : close()"
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
          <span class="block text-sm font-bold text-slate-900">
            {{ isLoggedIn ? '分享给同事再得 1 次：点击复制专属链接' : '分享给同事，送无水印次数' }}
          </span>
          <span class="mt-0.5 block text-xs leading-5 text-slate-500">
            {{ isLoggedIn ? '每被点开 1 次即得 1 次无水印导出（每日上限 10 次），也可到个人中心查看分享统计' : '登录后可生成专属分享链接，每被点开 1 次即得 1 次无水印导出（每日上限 10 次）' }}
          </span>
        </span>
      </component>
    </div>

    <p class="mt-4 text-xs leading-5 text-slate-400">
      也可以直接选择带水印导出继续使用，不受次数限制。名单与照片始终只在你的浏览器本地处理，登录只用于配额与模板同步，不会上传任何标签数据。
    </p>
  </ModalDialog>
</template>
