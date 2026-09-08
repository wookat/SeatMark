<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { useNextStepBarHeight } from '@/composables/useNextStepBarHeight'
import type { QuotaBadge } from '@/composables/useQuotaBadge'
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
    /** 「export」步骤时在主按钮上展示的无水印额度角标 */
    quotaBadge?: QuotaBadge | null
    quotaBadgeTitle?: string
  }>(),
  { progress: '', quotaBadge: null, quotaBadgeTitle: '' },
)

const showQuotaBadge = computed(() => props.step === 'export' && !!props.quotaBadge)

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

/** 键盘焦点在操作条内时保持显示，避免 Tab 到达后因目标区块恢入视口而丢焦 */
const barFocused = ref(false)

const visible = computed(() => !!props.target && (targetOffscreen.value || barFocused.value))

/** 操作条可见时在 <html> 上标记，让其他底部浮层（反馈按钮等）让出高度 */
const BAR_CLASS = 'has-next-step-bar'
watch(
  visible,
  (on) => {
    if (typeof document === 'undefined') return
    document.documentElement.classList.toggle(BAR_CLASS, on)
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  if (typeof document !== 'undefined') document.documentElement.classList.remove(BAR_CLASS)
})

/** 操作条实际高度写入 --sm-nextstep-h：反馈气泡 / 页面底部留白按真实高度让位，不再假定 3rem */
const barEl = ref<HTMLElement | null>(null)
useNextStepBarHeight(barEl)

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function go() {
  const el = props.target
  if (!el) return
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'instant' : 'smooth', block: 'start' })
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
  el.focus({ preventScroll: true })
}
</script>

<template>
  <div
    v-if="visible"
    ref="barEl"
    class="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white shadow-[0_-1px_3px_rgba(15,23,42,0.05)]"
    data-testid="next-step-bar"
    @focusin="barFocused = true"
    @focusout="barFocused = false"
  >
    <div class="mx-auto flex h-12 w-full max-w-[1480px] items-center justify-between gap-3 px-4">
      <p class="min-w-0 truncate text-xs text-slate-500" data-testid="next-step-progress">{{ progress }}</p>
      <div class="flex shrink-0 items-center gap-2">
        <!-- 次按钮位（如 <md 的「查看座位预览」），并入条内而不再独立悬浮 -->
        <slot name="secondary" />
        <button
          type="button"
          class="btn btn-primary btn-sm relative shrink-0"
          :title="showQuotaBadge ? quotaBadgeTitle : undefined"
          data-testid="next-step-action"
          @click="go"
        >
          {{ label }}
          <span
            v-if="showQuotaBadge && quotaBadge"
            class="ml-1 whitespace-nowrap rounded-full px-1.5 py-px text-[11px] font-semibold"
            :class="quotaBadge.cls"
            data-testid="next-step-quota-badge"
          >{{ quotaBadge.text }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
