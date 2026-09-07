<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { t as tr } from '@/i18n'

const props = defineProps<{
  /** 画布/预览区块：进入视口后按钮切换为「回到设置 ↑」 */
  preview: HTMLElement | null
  /** 第 1 个设置区块：「回到设置 ↑」的滚动目标 */
  settings: HTMLElement | null
  /** 名单输入区（textarea 等）：滚入视口时胶囊自动隐藏，不压住输入控件 */
  avoid?: HTMLElement | null
}>()

/** 回到页面顶部的判定阈值（px）：低于此值恢复显示胶囊 */
const TOP_RESTORE_PX = 80
/** 滚动方向判定的最小位移（px），过滤惯性抖动 */
const SCROLL_DELTA_PX = 2
/** visualViewport 比窗口矮超过该比例视为软键盘弹出 */
const KEYBOARD_RATIO = 0.75

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

const avoidVisible = ref(false)
let avoidObserver: IntersectionObserver | null = null

function observeAvoid(el: HTMLElement | null | undefined) {
  avoidObserver?.disconnect()
  avoidObserver = null
  avoidVisible.value = false
  if (!el || typeof IntersectionObserver === 'undefined') return
  avoidObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[entries.length - 1]
      if (entry) avoidVisible.value = entry.isIntersecting
    },
    { threshold: 0.2 },
  )
  avoidObserver.observe(el)
}

watch(() => props.avoid, observeAvoid, { immediate: true })

/**
 * 窄屏让位逻辑：输入框聚焦 / 软键盘弹出时隐藏（避免压住输入区）；
 * 向下滚动时收起且不自动恢复（不常驻遮挡表单控件），仅在回到页顶、
 * 或预览区已离开视口且用户向上滚动时恢复显示。
 */
const inputFocused = ref(false)
const keyboardOpen = ref(false)
const collapsed = ref(false)
let lastScrollY = 0

function isTextInput(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName
  return tag === 'TEXTAREA' || tag === 'INPUT' || (el instanceof HTMLElement && el.isContentEditable)
}

function syncFocus() {
  inputFocused.value = isTextInput(document.activeElement)
}

function syncKeyboard() {
  const vv = window.visualViewport
  keyboardOpen.value = !!vv && vv.height < window.innerHeight * KEYBOARD_RATIO
}

function onScroll() {
  const y = window.scrollY
  if (y < TOP_RESTORE_PX) collapsed.value = false
  else if (y > lastScrollY + SCROLL_DELTA_PX) collapsed.value = true
  else if (y < lastScrollY - SCROLL_DELTA_PX && !previewVisible.value) collapsed.value = false
  lastScrollY = y
}

onMounted(() => {
  lastScrollY = window.scrollY
  syncFocus()
  syncKeyboard()
  document.addEventListener('focusin', syncFocus)
  document.addEventListener('focusout', syncFocus)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.visualViewport?.addEventListener('resize', syncKeyboard)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  avoidObserver?.disconnect()
  document.removeEventListener('focusin', syncFocus)
  document.removeEventListener('focusout', syncFocus)
  window.removeEventListener('scroll', onScroll)
  window.visualViewport?.removeEventListener('resize', syncKeyboard)
})

const hidden = computed(
  () => inputFocused.value || keyboardOpen.value || collapsed.value || avoidVisible.value,
)

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
    class="no-print fixed right-14 bottom-4 z-30 inline-flex min-h-11 items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-4 text-xs font-semibold text-slate-700 shadow-pop backdrop-blur transition-[opacity,transform,color,border-color] duration-200 hover:border-brand-400 hover:text-brand-600 md:hidden [.has-next-step-bar_&]:bottom-[4.25rem] [.has-sticky-actions_&]:bottom-[4.25rem]"
    :class="hidden ? 'pointer-events-none translate-y-2 opacity-0' : 'translate-y-0 opacity-100'"
    :aria-hidden="hidden ? 'true' : undefined"
    :tabindex="hidden ? -1 : undefined"
    data-testid="mobile-preview-jump"
    :data-state="previewVisible ? 'at-preview' : 'at-settings'"
    :data-hidden="hidden ? 'true' : 'false'"
    :data-avoid-visible="avoidVisible ? 'true' : 'false'"
    @click="go"
  >
    {{ label }}
  </button>
</template>
