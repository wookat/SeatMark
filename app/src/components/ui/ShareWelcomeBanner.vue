<script setup lang="ts">
import { localePath, t } from '@/i18n'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div
    v-if="open"
    class="border-b border-brand-100 bg-brand-50/80"
    role="region"
    :aria-label="t('同事推荐欢迎信息')"
  >
    <div class="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
      <span class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
        <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7m0 0s-2-4-5-4a2.5 2.5 0 0 0 0 5h5zm0 0s2-4 5-4a2.5 2.5 0 0 1 0 5h-5z" />
        </svg>
      </span>
      <p class="min-w-0 flex-1 text-xs leading-5 text-slate-600">
        <strong class="text-slate-800">{{ t('同事向你推荐了 SeatMark 座签') }}</strong>
        {{ t('— 上传 Excel 名单，三步批量生成考场座位标签 / 桌牌席卡，排版精确到毫米，名单数据全程只在你的浏览器本地处理。') }}
      </p>
      <div class="flex shrink-0 items-center gap-1.5 max-sm:basis-full max-sm:justify-end">
        <RouterLink :to="localePath('/studio?demo=1')" class="btn btn-primary btn-sm" @click="emit('close')">
          {{ t('一键开始（含演示数据）') }}
        </RouterLink>
        <button
          type="button"
          class="grid size-6 place-items-center rounded text-slate-600 hover:text-slate-600"
          :aria-label="t('关闭欢迎提示')"
          @click="emit('close')"
        >
          <svg class="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <path d="m4 4 8 8m0-8-8 8" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
