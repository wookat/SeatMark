<script setup lang="ts">
import { storeToRefs } from 'pinia'

import { useToastStore, type ToastType } from '@/stores/toast'

const toastStore = useToastStore()
const { toasts } = storeToRefs(toastStore)

/** 图标底色与描边：白底卡片上仅用色块标示语义，正文保持中性灰以便阅读 */
const TONE_ICON: Record<ToastType, string> = {
  info: 'bg-brand-50 text-brand-600 ring-brand-100',
  success: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  warning: 'bg-amber-50 text-amber-600 ring-amber-100',
  danger: 'bg-red-50 text-red-600 ring-red-100',
}

const TONE_BAR: Record<ToastType, string> = {
  info: 'bg-brand-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
}

const TONE_PATH: Record<ToastType, string> = {
  info: 'M12 8h.01M11 12h1v4h1',
  success: 'm8 12.5 2.5 2.5L16 9',
  warning: 'M12 9v4m0 3h.01',
  danger: 'm9 9 6 6m0-6-6 6',
}
</script>

<template>
  <!-- 小屏下移：避开工坊吸顶的「设置 / 预览」分段切换 -->
  <div
    class="no-print pointer-events-none fixed top-30 right-3 z-[70] flex w-[calc(100vw-1.5rem)] max-w-80 flex-col gap-2 sm:right-4 lg:top-16"
  >
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-x-4 scale-95 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="translate-x-2 opacity-0"
      move-class="transition duration-200"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto relative flex items-start gap-2.5 overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3 pl-4 shadow-pop"
      >
        <span class="absolute inset-y-0 left-0 w-1" :class="TONE_BAR[toast.type]"></span>
        <span
          class="mt-px flex size-6 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset"
          :class="TONE_ICON[toast.type]"
        >
          <svg
            class="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path :d="TONE_PATH[toast.type]" />
          </svg>
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm leading-5 font-bold text-slate-900">{{ toast.title }}</p>
          <p v-if="toast.text" class="mt-0.5 text-xs leading-4.5 text-slate-500">
            {{ toast.text }}
          </p>
        </div>
        <button
          type="button"
          class="-mt-0.5 -mr-0.5 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label="关闭提示"
          @click="toastStore.dismiss(toast.id)"
        >
          <svg
            class="size-3.5"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          >
            <path d="m4 4 8 8m0-8-8 8" />
          </svg>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
