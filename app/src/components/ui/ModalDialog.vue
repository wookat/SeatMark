<script lang="ts">
/** 全局打开栈（模块级共享）：多层弹窗叠加时 Esc 只关最顶层 */
const openStack: symbol[] = []
/** 各弹窗实例的关闭回调：供返回键关闭顶层弹窗 */
const closeHandlers = new Map<symbol, () => void>()
/** 各弹窗实例哨兵条目的唯一号：用于判断关闭时是否需要回收哨兵 */
const sentinelIds = new Map<symbol, number>()
/** 各哨兵推入时的页面地址：回收前校验路由未变，避免与导航竞态 */
const sentinelHrefs = new Map<number, string>()

const SENTINEL_KEY = 'seatmarkModalSentinel'
let popListenerInstalled = false
let sentinelSerial = 0

function stateSentinelId(state: unknown): number | null {
  const value = (state as Record<string, unknown> | null)?.[SENTINEL_KEY]
  return typeof value === 'number' ? value : null
}

/**
 * 返回键拦截（哨兵方案）：弹窗打开时 pushState 一条同 URL 哨兵历史条目；
 * 按返回时 popstate 离开顶层哨兵条目，只关顶层弹窗而不离开页面。
 * 哨兵复制当前路由 state（含 position），vue-router 视为原地不动，不触发导航。
 * 落到孤儿哨兵条目（对应弹窗已不存在）时自动再退一步，避免死条目占用一次返回。
 */
function installPopListener() {
  if (popListenerInstalled || typeof window === 'undefined') return
  popListenerInstalled = true
  window.addEventListener('popstate', (event) => {
    const landedId = stateSentinelId(event.state)
    if (openStack.length) {
      const top = openStack[openStack.length - 1]
      const topId = top ? sentinelIds.get(top) : undefined
      if (top && topId !== undefined && landedId !== topId) {
        closeHandlers.get(top)?.()
      }
    }
    if (landedId !== null && ![...sentinelIds.values()].includes(landedId)) {
      // 孤儿哨兵（对应弹窗已关闭/导航离开后遗留）：透明跳过
      window.history.back()
    }
  })
}

function pushSentinel(id: symbol) {
  if (typeof window === 'undefined') return
  installPopListener()
  const serial = ++sentinelSerial
  sentinelIds.set(id, serial)
  sentinelHrefs.set(serial, window.location.href)
  const base = (window.history.state as Record<string, unknown> | null) ?? {}
  window.history.pushState({ ...base, [SENTINEL_KEY]: serial }, '', window.location.href)
}

/**
 * 弹窗以非返回键方式关闭（Esc/遮罩/程序）时回收未消耗的哨兵条目。
 * 延迟执行并二次校验：若期间发生了路由导航或又有新弹窗推入哨兵，
 * 则放弃回收（避免 history.back() 取消进行中的 router.push）。
 */
function consumeSentinel(id: symbol) {
  const serial = sentinelIds.get(id)
  sentinelIds.delete(id)
  if (typeof window === 'undefined' || serial === undefined) return
  const href = sentinelHrefs.get(serial)
  sentinelHrefs.delete(serial)
  window.setTimeout(() => {
    if (stateSentinelId(window.history.state) !== serial) return
    if (href !== undefined && window.location.href !== href) return
    window.history.back()
  }, 50)
}
</script>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

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
      pushSentinel(instanceId)
      previouslyFocused = document.activeElement as HTMLElement | null
      await nextTick()
      panelRef.value?.focus()
    } else {
      const idx = openStack.indexOf(instanceId)
      if (idx >= 0) openStack.splice(idx, 1)
      closeHandlers.delete(instanceId)
      consumeSentinel(instanceId)
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
  sentinelIds.delete(instanceId)
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
