<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { t } from '@/i18n'
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
  <!-- 堆叠位置：
       · 窄屏（<sm）右下，避开右下角反馈按钮；底部操作条可见（html.has-next-step-bar）或页面带吸底按钮栏（.has-sticky-actions）时
         抬到 8rem + 底部安全区（env(safe-area-inset-bottom)），高于操作条（3rem）+ 反馈按钮（4.25rem 起），不遮导出 / 下一步按钮；
       · ≥sm 右上（top-20 right-4，位于 3.5rem 吸顶头部下方），不覆盖页面中部的预览内容；
       · 带 .has-sticky-actions 的页面（工坊 / 排座 / 宴会）：sm–lg 仍走右下车道避开导出按钮，≥lg 改走右上，
         且 top 落在工坊预览工具栏下方：calc(var(--studio-toolbar-bottom) + 0.5rem)，变量由 PreviewArea 按工具栏实际高度写入，
         排座 / 宴会页无该变量时回退 4.5rem + 0.5rem = top-20，与非工坊页面一致；
       · 弹窗打开期间（html.has-modal，ModalDialog 维护）窄屏改落顶部 top-16 并正向堆叠，不压弹窗底部的选项卡 / 操作按钮；≥sm 不变。
         选择器写作 html.has-modal，特异性高于同为两级 class 的 .has-sticky-actions / .has-next-step-bar 车道，确保 bottom-auto 生效。 -->
  <div
    role="status"
    aria-live="polite"
    :aria-label="t('操作提示')"
    class="no-print pointer-events-none fixed right-3 bottom-20 z-[70] flex w-[calc(100vw-1.5rem)] max-w-80 flex-col-reverse gap-2 sm:top-20 sm:right-4 sm:bottom-auto sm:flex-col [.has-next-step-bar_&]:bottom-[calc(8rem_+_env(safe-area-inset-bottom,0px))] [.has-sticky-actions_&]:bottom-[calc(8rem_+_env(safe-area-inset-bottom,0px))] [.has-sticky-actions_&]:sm:top-auto [.has-sticky-actions_&]:sm:flex-col-reverse [.has-sticky-actions_&]:lg:top-[calc(var(--studio-toolbar-bottom,4.5rem)_+_0.5rem)] [.has-sticky-actions_&]:lg:bottom-auto [.has-sticky-actions_&]:lg:flex-col [html.has-modal_&]:max-sm:top-16 [html.has-modal_&]:max-sm:bottom-auto [html.has-modal_&]:max-sm:flex-col"
    data-testid="toast-host"
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
        class="pointer-events-auto relative flex items-start gap-2.5 overflow-hidden rounded-lg border border-slate-200/80 bg-white p-3 pl-4 shadow-pop"
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
          <p v-if="toast.text" class="mt-0.5 text-xs leading-4.5 text-slate-600">
            {{ toast.text }}
          </p>
          <button
            v-if="toast.action"
            type="button"
            class="mt-1.5 inline-flex min-h-8 cursor-pointer items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-bold text-brand-600 transition-colors hover:border-brand-300 hover:bg-brand-50"
            @click="toastStore.runAction(toast.id)"
          >
            {{ toast.action.label }}
          </button>
        </div>
        <button
          type="button"
          class="-mt-0.5 -mr-0.5 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-600"
          :aria-label="t('关闭提示')"
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
