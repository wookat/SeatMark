<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { t as tr } from '@/i18n'

const props = defineProps<{
  /** 画布/预览区块：进入视口后按钮切换为「回到设置 ↑」 */
  preview: HTMLElement | null
  /** 第 1 个设置区块：「回到设置 ↑」的滚动目标 */
  settings: HTMLElement | null
}>()

const previewVisible = ref(false)
let observer: IntersectionObserver | null = null

function observe(el: HTMLElement | null) {
  observer?.disconnect()
  observer = null
  previewVisible.value = false
  if (!el || typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[entries.length - 1]
      if (entry) previewVisible.value = entry.isIntersecting
    },
    { threshold: 0.15 },
  )
  observer.observe(el)
}

watch(() => props.preview, observe, { immediate: true })
onBeforeUnmount(() => observer?.disconnect())

const label = computed(() => (previewVisible.value ? tr('回到设置 ↑') : tr('查看座位预览 ↓')))

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function go() {
  const el = previewVisible.value ? props.settings : props.preview
  if (!el) return
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'instant' : 'smooth', block: 'start' })
}
</script>

<template>
  <button
    v-if="preview"
    type="button"
    class="no-print fixed bottom-4 left-4 z-30 inline-flex min-h-11 items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-4 text-xs font-semibold text-slate-700 shadow-pop backdrop-blur transition-colors hover:border-brand-400 hover:text-brand-600 md:hidden [.has-next-step-bar_&]:bottom-[4.25rem]"
    data-testid="mobile-preview-jump"
    :data-state="previewVisible ? 'at-preview' : 'at-settings'"
    @click="go"
  >
    {{ label }}
  </button>
</template>
