<script setup lang="ts">
import { computed } from 'vue'

import ModalDialog from '@/components/ui/ModalDialog.vue'
import { localePath, t } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { QUOTA_USER_DAILY, useQuotaStore } from '@/stores/quota'
import { useToastStore } from '@/stores/toast'
import { copyToClipboard } from '@/utils/share'

const auth = useAuthStore()
const quota = useQuotaStore()
const toast = useToastStore()

const isLoggedIn = computed(() => auth.isLoggedIn)
/** 账号服务不可用（如 503）：隐藏注册/登录利益点与 CTA，只保留带水印导出的中性说明 */
const serviceUnavailable = computed(() => auth.serviceUnavailable)

const shareDailyCap = computed(() => auth.user?.share.bonusDailyCap ?? 10)

const shareLink = computed(() =>
  auth.user ? `https://www.seatmark.cn/?ref=${auth.user.share.code}` : '',
)

/** 价值阶梯：配额规则的完整展示，让用户一眼看清「怎么获得更多」 */
const valueLadder = computed(() => [
  ...(serviceUnavailable.value
    ? []
    : [
        {
          key: 'login',
          label: t('登录后每天 {n} 次无水印导出').replace('{n}', String(QUOTA_USER_DAILY)),
          detail: t('注册即送 7 天专业版试用（无水印导出不限次），自定义模板可同步云端'),
          active: !isLoggedIn.value,
        },
        {
          key: 'share',
          label: t('分享被点开 1 次再 +1 次（每日最多 {n} 次）').replace('{n}', String(shareDailyCap.value)),
          detail: t('专属链接发给同事或群聊，服务端去重防刷'),
          active: true,
        },
      ]),
  {
    key: 'watermark',
    label: t('带水印导出永远免费、不限次数'),
    detail: t('水印为页脚浅色角标，不遮挡姓名与座位号'),
    active: true,
  },
])

async function copyShareLink() {
  if (!shareLink.value) return
  if (await copyToClipboard(shareLink.value)) {
    toast.success(t('分享链接已复制'), t('发给同事或群聊，每被点开 1 次即得 1 次无水印导出'))
    close()
  } else {
    toast.warning(t('复制失败'), t('可到个人中心手动复制专属分享链接'))
  }
}

function close() {
  quota.limitDialogOpen = false
}
</script>

<template>
  <ModalDialog :open="quota.limitDialogOpen" :title="t('今日无水印导出次数已用完')" size="md" @close="close">
    <p class="leading-6">
      {{ t('无水印导出配额明天 0 点自动恢复，也可以立即获得更多次数：') }}
    </p>

    <ul class="mt-4 grid gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
      <li v-for="item in valueLadder" :key="item.key" class="flex items-start gap-2.5">
        <span
          class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full"
          :class="item.active ? 'bg-brand-600 text-white' : 'bg-slate-300 text-white'"
        >
          <svg class="size-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m3.5 8.5 3 3 6-7" />
          </svg>
        </span>
        <span class="min-w-0">
          <span class="block text-sm font-semibold text-slate-900">{{ item.label }}</span>
          <span class="mt-0.5 block text-xs leading-5 text-slate-600">{{ item.detail }}</span>
        </span>
      </li>
    </ul>

    <p
      v-if="serviceUnavailable"
      data-testid="quota-service-unavailable"
      class="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900"
    >
      {{ t('账号服务维护中，带水印导出不限次') }}
    </p>

    <div v-else class="mt-4 grid gap-2">
      <RouterLink
        v-if="!isLoggedIn"
        :to="localePath('/account')"
        class="btn btn-primary btn-md w-full"
        @click="close"
      >
        {{ t('免费登录，每天 {n} 次无水印导出').replace('{n}', String(QUOTA_USER_DAILY)) }}
      </RouterLink>

      <component
        :is="isLoggedIn ? 'button' : 'RouterLink'"
        v-bind="isLoggedIn ? { type: 'button' } : { to: localePath('/account') }"
        :class="isLoggedIn ? 'btn btn-primary btn-md w-full' : 'btn btn-secondary btn-md w-full'"
        @click="isLoggedIn ? copyShareLink() : close()"
      >
        {{ isLoggedIn ? t('复制专属分享链接，被点开就 +1 次') : t('登录后可分享送次数') }}
      </component>
    </div>

    <p class="mt-4 text-xs leading-5 text-slate-600">
      {{ t('也可以直接选择带水印导出继续使用，不受次数限制。名单与照片始终只在你的浏览器本地处理，登录只用于配额与模板同步，不会上传任何标签数据。') }}
    </p>
  </ModalDialog>
</template>
