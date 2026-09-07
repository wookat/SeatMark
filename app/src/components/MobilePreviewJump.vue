<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { t as tr } from '@/i18n'

const props = defineProps<{
  /** 画布/预览区块：进入视口后按钮切换为「回到设置 ↑」 */
  preview: HTMLElement | null
  /** 第 1 个设置区块：「回到设置 ↑」的滚动目标 */
  settings: HTMLElement | null
}>()

/** 停止滚动多久后重新显示胶囊 */
const SCROLL_IDLE_MS = 300
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

/**
 * 窄屏让位逻辑：输入框聚焦 / 软键盘弹出时隐藏（避免压住输入区）；
 * 向下滚动时收起，停止滚动 SCROLL_IDLE_MS 后恢复。
 */
const inputFocused = ref(false)
const keyboardOpen = ref(false)
const scrolling = ref(false)
let lastScrollY = 0
let idleTimer: ReturnType<typeof setTimeout> | null = null

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
  if (y > lastScrollY + 2) scrolling.value = true
  lastScrollY = y
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    scrolling.value = false
    idleTimer = null
  }, SCROLL_IDLE_MS)
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
  document.removeEventListener('focusin', syncFocus)
  document.removeEventListener('focusout', syncFocus)
  window.removeEventListener('scroll', onScroll)
  window.visualViewport?.removeEventListener('resize', syncKeyboard)
  if (idleTimer) clearTimeout(idleTimer)
})

const hidden = computed(() => inputFocused.value || keyboardOpen.value || scrolling.value)

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
    class="no-print fixed bottom-4 left-4 z-30 inline-flex min-h-11 items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-4 text-xs font-semibold text-slate-700 shadow-pop backdrop-blur transition-[opacity,transform,color,border-color] duration-200 hover:border-brand-400 hover:text-brand-600 md:hidden [.has-next-step-bar_&]:bottom-[4.25rem]"
    :class="hidden ? 'pointer-events-none translate-y-2 opacity-0' : 'translate-y-0 opacity-100'"
    :aria-hidden="hidden ? 'true' : undefined"
    :tabindex="hidden ? -1 : undefined"
    data-testid="mobile-preview-jump"
    :data-state="previewVisible ? 'at-preview' : 'at-settings'"
    :data-hidden="hidden ? 'true' : 'false'"
    @click="go"
  >
    {{ label }}
  </button>
</template>
