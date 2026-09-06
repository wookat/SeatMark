<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { t as tr } from '@/i18n'

export type NextStep = 'import' | 'arrange' | 'export'

const props = withDefaults(
  defineProps<{
    /** 当前所处步骤：决定主按钮文案 */
    step: NextStep
    /** 「arrange」步骤的动作名（教室页：随机排座；宴会页：自动分配） */
    arrangeLabel: string
    /** 当前进度短文本（如「12 人 / 48 座」） */
    progress?: string
    /** 目标区块：不在视口内时显示操作条，点击后滚动并聚焦到它 */
    target: HTMLElement | null
  }>(),
  { progress: '' },
)

const label = computed(() => {
  switch (props.step) {
    case 'import':
      return tr('下一步：导入名单')
    case 'arrange':
      return `${tr('下一步：')}${props.arrangeLabel}`
    case 'export':
      return tr('下一步：检查并导出')
  }
})

/** 目标区块不在视口内才显示；环境不支持 IntersectionObserver 时保持显示 */
const targetOffscreen = ref(true)
let observer: IntersectionObserver | null = null

function observe(el: HTMLElement | null) {
  observer?.disconnect()
  observer = null
  if (!el || typeof IntersectionObserver === 'undefined') {
    targetOffscreen.value = true
    return
  }
  observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[entries.length - 1]
      if (entry) targetOffscreen.value = !entry.isIntersecting
    },
    { threshold: 0.2 },
  )
  observer.observe(el)
}

watch(() => props.target, observe, { immediate: true })
onBeforeUnmount(() => observer?.disconnect())

const visible = computed(() => !!props.target && targetOffscreen.value)

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function go() {
  const el = props.target
  if (!el) return
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
  el.focus({ preventScroll: true })
}
</script>

<template>
  <div
    v-if="visible"
    class="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white shadow-[0_-1px_3px_rgba(15,23,42,0.05)]"
    data-testid="next-step-bar"
  >
    <div class="mx-auto flex h-12 w-full max-w-[1480px] items-center justify-between gap-3 px-4">
      <p class="min-w-0 truncate text-xs text-slate-500" data-testid="next-step-progress">{{ progress }}</p>
      <button type="button" class="btn btn-primary btn-sm shrink-0" data-testid="next-step-action" @click="go">
        {{ label }}
      </button>
    </div>
  </div>
</template>
