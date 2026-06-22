<script setup lang="ts">
import { storeToRefs } from 'pinia'

import { useToastStore, type ToastType } from '@/stores/toast'

const toastStore = useToastStore()
const { toasts } = storeToRefs(toastStore)

const TONE_CLASSES: Record<ToastType, string> = {
  info: 'border-brand-200 bg-brand-50 text-brand-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  danger: 'border-red-200 bg-red-50 text-red-900',
}
</script>

<template>
  <div class="no-print pointer-events-none fixed top-16 right-4 z-[70] flex w-80 flex-col gap-2">
    <TransitionGroup
      enter-active-class="transition duration-200"
      enter-from-class="translate-x-4 opacity-0"
      leave-active-class="transition duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-start gap-2 rounded-xl border p-3 shadow-lg"
        :class="TONE_CLASSES[toast.type]"
      >
        <div class="min-w-0 flex-1">
          <p class="text-sm leading-5 font-bold">{{ toast.title }}</p>
          <p v-if="toast.text" class="mt-0.5 text-xs leading-4 opacity-80">{{ toast.text }}</p>
        </div>
        <button
          type="button"
          class="cursor-pointer text-lg leading-none opacity-50 hover:opacity-100"
          aria-label="关闭提示"
          @click="toastStore.dismiss(toast.id)"
        >
          ×
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
