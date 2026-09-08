<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useIsNarrow } from '@/composables/useMediaQuery'
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

defineSlots<{
  /** 次按钮位；compact 为 true 时操作条空间不足，插槽内容应改用短文案 */
  secondary?: (props: { compact: boolean }) => unknown
}>()

const showQuotaBadge = computed(() => props.step === 'export' && !!props.quotaBadge)
const isNarrow = useIsNarrow()

/**
 * 窄屏上操作条放不下时退到紧凑模式：角标改短文案，并通过 secondary 作用域插槽让次按钮同步用短文案；
 * 不限步骤、按真实渲染宽度判定而不依赖语言：主按钮越出操作条右缘，或次按钮已被截断（scrollWidth > clientWidth），
 * 或进度文案被挤到无法辨认（clientWidth < PROGRESS_MIN_PX）
 */
const PROGRESS_MIN_PX = 56
const actionEl = ref<HTMLElement | null>(null)
const groupEl = ref<HTMLElement | null>(null)
const progressEl = ref<HTMLElement | null>(null)
const compactBadge = ref(false)
const badgeText = computed(() =>
  compactBadge.value ? (props.quotaBadge?.compactText ?? props.quotaBadge?.text) : props.quotaBadge?.text,
)

async function measureBadgeFit() {
  if (!isNarrow.value) {
    compactBadge.value = false
    return
  }
  compactBadge.value = false
  await nextTick()
  const el = actionEl.value
  if (!el || typeof window === 'undefined') return
  const limit = (barEl.value?.getBoundingClientRect().right || window.innerWidth) - 16
  const truncated = Array.from(groupEl.value?.children ?? []).some(
    (child) => child !== el && child.scrollWidth > child.clientWidth + 1,
  )
  const progress = progressEl.value
  const progressSqueezed =
    !!progress && !!props.progress && progress.clientWidth > 0 && progress.clientWidth < PROGRESS_MIN_PX
  if (truncated || progressSqueezed || el.getBoundingClientRect().right > limit) compactBadge.value = true
}

const label = computed(() => {
  switch (props.step) {
    case 'import':
      return tr('下一步：导入名单')
    case 'arrange':
      return `${tr('下一步：')}${props.arrangeLabel}`
    case 'export':
      // 窄屏上角标与次按钮同行，主按钮文案收短以免角标溢出视口
      return showQuotaBadge.value && isNarrow.value
        ? tr('下一步：导出')
        : tr('下一步：检查并导出')
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

watch(
  () => [visible.value, isNarrow.value, showQuotaBadge.value, props.quotaBadge?.text, label.value, props.progress] as const,
  () => void measureBadgeFit(),
  { flush: 'post' },
)
const onResize = () => void measureBadgeFit()
onMounted(() => {
  window.addEventListener('resize', onResize)
  void measureBadgeFit()
})
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

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
      <p ref="progressEl" class="min-w-[3.5rem] truncate text-xs text-slate-500" data-testid="next-step-progress">{{ progress }}</p>
      <!-- 进度文本先让位；按钮组仅在自身超过整条宽度时才被限宽、次按钮截断 -->
      <div ref="groupEl" class="flex min-w-0 max-w-full shrink-0 items-center gap-2">
        <!-- 次按钮位（如 <md 的「查看座位预览」），并入条内而不再独立悬浮；空间不足时次按钮先换短文案再截断，主按钮不收缩 -->
        <slot name="secondary" :compact="compactBadge" />
        <button
          ref="actionEl"
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
            :data-compact="compactBadge ? 'true' : undefined"
          >{{ badgeText }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
