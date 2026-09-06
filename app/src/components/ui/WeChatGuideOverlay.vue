<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { t } from '@/i18n'
import { isWeChatBrowser, WECHAT_GUIDE_SEEN_KEY } from '@/utils/wechat'

/**
 * 微信内置浏览器适配引导：
 * 微信内下载 PDF 受限，首次进入时浮层引导用户点右上角菜单「在浏览器打开」。
 * 每个会话只提示一次，可手动关闭继续浏览。
 */
const visible = ref(false)

onMounted(() => {
  if (!isWeChatBrowser()) return
  try {
    if (sessionStorage.getItem(WECHAT_GUIDE_SEEN_KEY)) return
  } catch {
    // 隐私模式下 sessionStorage 不可用：仍展示引导
  }
  visible.value = true
})

function dismiss() {
  visible.value = false
  try {
    sessionStorage.setItem(WECHAT_GUIDE_SEEN_KEY, '1')
  } catch {
    // 忽略存储失败
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="no-print fixed inset-0 z-[90] bg-slate-900/70 backdrop-blur-[2px]"
      role="dialog"
      :aria-label="t('微信内浏览提示')"
      @click.self="dismiss"
    >
      <!-- 指向右上角「···」菜单的箭头 -->
      <svg
        class="absolute top-2 right-4 h-24 w-16 text-white"
        viewBox="0 0 64 96"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M14 88 Q44 66 48 18" />
        <path d="M36 26 L48 12 L56 28" />
      </svg>
      <div class="absolute top-28 right-4 left-4 mx-auto max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <div class="flex items-start gap-3">
          <svg
            class="mt-0.5 size-6 flex-none text-brand-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <div class="min-w-0">
            <h2 class="text-sm font-bold text-slate-900">{{ t('你正在微信中打开 SeatMark') }}</h2>
            <p class="mt-1.5 text-sm leading-6 text-slate-600">
              {{ t('微信内置浏览器') }}<strong class="text-slate-800">{{ t('无法下载 PDF 文件') }}</strong>{{ t('。建议点击右上角「···」菜单，选择') }}
              <strong class="text-brand-600">{{ t('「在浏览器打开」') }}</strong>{{ t('，即可正常导出 PDF 与打印。') }}
            </p>
            <p class="mt-1.5 text-xs leading-5 text-slate-600">
              {{ t('仅浏览模板、预览排版不受影响，可关闭此提示继续使用。') }}
            </p>
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-md mt-4 w-full" @click="dismiss">
          {{ t('我知道了，继续浏览') }}
        </button>
      </div>
    </div>
  </Teleport>
</template>
