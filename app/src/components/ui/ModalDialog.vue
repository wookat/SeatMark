<script lang="ts">
import type { Router } from 'vue-router'

/** 全局打开栈（模块级共享）：多层弹窗叠加时 Esc 只关最顶层 */
const openStack: symbol[] = []
/** 各弹窗实例的关闭回调：供返回键拦截关闭顶层弹窗 */
const closeHandlers = new Map<symbol, () => void>()

/** 最近一次 popstate 时间戳：用于区分返回键导航与站内链接导航 */
let lastPopstateAt = 0
let guardInstalled = false

/**
 * 返回键拦截：弹窗打开时按浏览器返回（popstate 驱动的路由离开）
 * 只关闭顶层弹窗、取消本次导航，而不是整页跳走。
 * 站内链接/编程式导航不受影响。
 */
function installBackGuard(router: Router) {
  if (guardInstalled || typeof window === 'undefined') return
  guardInstalled = true
  window.addEventListener('popstate', () => {
    lastPopstateAt = Date.now()
  })
  router.beforeEach(() => {
    if (!openStack.length) return true
    if (Date.now() - lastPopstateAt > 300) return true
    const top = openStack[openStack.length - 1]
    if (!top) return true
    closeHandlers.get(top)?.()
    return false
  })
}
</script>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    /** 对话框宽度：md 表单确认 / lg 内容浏览 / xl 数据表格 */
    size?: 'md' | 'lg' | 'xl'
  }>(),
  { size: 'md' },
)

const emit = defineEmits<{ close: [] }>()

const SIZE_CLASSES: Record<string, string> = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-5xl',
}

const instanceId = Symbol('modal')

const router = useRouter()
if (router) installBackGuard(router)

const panelRef = ref<HTMLElement | null>(null)
/** 打开前的焦点元素：关闭后归还焦点 */
let previouslyFocused: HTMLElement | null = null

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusables(): HTMLElement[] {
  if (!panelRef.value) return []
  return Array.from(panelRef.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
}

function onKeydown(event: KeyboardEvent) {
  if (!props.open) return
  if (event.key === 'Escape') {
    // 只有位于打开栈顶层的弹窗响应 Esc，避免叠层弹窗被一次性全部关闭
    if (openStack[openStack.length - 1] === instanceId) {
      event.stopPropagation()
      emit('close')
    }
    return
  }
  if (event.key === 'Tab' && openStack[openStack.length - 1] === instanceId) {
    // 焦点困陷：Tab 循环限定在弹窗内部
    const items = focusables()
    if (!items.length) {
      event.preventDefault()
      panelRef.value?.focus()
      return
    }
    const first = items[0]!
    const last = items[items.length - 1]!
    const active = document.activeElement as HTMLElement | null
    if (event.shiftKey) {
      if (active === first || !panelRef.value?.contains(active)) {
        event.preventDefault()
        last.focus()
      }
    } else if (active === last || !panelRef.value?.contains(active)) {
      event.preventDefault()
      first.focus()
    }
  }
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      openStack.push(instanceId)
      closeHandlers.set(instanceId, () => emit('close'))
      previouslyFocused = document.activeElement as HTMLElement | null
      await nextTick()
      panelRef.value?.focus()
    } else {
      const idx = openStack.indexOf(instanceId)
      if (idx >= 0) openStack.splice(idx, 1)
      closeHandlers.delete(instanceId)
      previouslyFocused?.focus?.()
      previouslyFocused = null
    }
  },
  { immediate: true },
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  const idx = openStack.indexOf(instanceId)
  if (idx >= 0) openStack.splice(idx, 1)
  closeHandlers.delete(instanceId)
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="no-print fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 p-4"
        @click.self="emit('close')"
      >
        <div
          class="flex max-h-[88vh] w-full flex-col rounded-lg bg-white p-5 shadow-pop ring-1 ring-slate-900/5 outline-none supports-[height:100dvh]:max-h-[calc(100dvh-2rem)] sm:p-6 sm:supports-[height:100dvh]:max-h-[88vh]"
          :class="SIZE_CLASSES[size]"
          ref="panelRef"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          tabindex="-1"
        >
          <div class="flex items-start justify-between gap-3">
            <h3 class="text-base font-bold text-slate-900">{{ title }}</h3>
            <button
              type="button"
              class="-mt-1 -mr-1 flex size-7 cursor-pointer items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="关闭"
              @click="emit('close')"
            >
              <svg
                class="size-4"
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
          <div class="mt-3 min-h-0 flex-1 overflow-y-auto text-sm text-slate-600">
            <slot />
          </div>
          <div class="mt-5 flex justify-end gap-2 empty:hidden">
            <slot name="actions" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
