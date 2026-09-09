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
    /** 进度的极短形式（如「12/48」）：窄屏上 progress 被挤压时改显示它，完整文本保留在 title / aria-label */
    progressCompact?: string
    /** 目标区块：不在视口内时显示操作条，点击后滚动并聚焦到它 */
    target: HTMLElement | null
    /** 「export」步骤时在主按钮上展示的无水印额度角标 */
    quotaBadge?: QuotaBadge | null
    quotaBadgeTitle?: string
  }>(),
  { progress: '', progressCompact: '', quotaBadge: null, quotaBadgeTitle: '' },
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
/**
 * 进度文案被挤压（宽度不足 PROGRESS_MIN_PX 或已被截断）时切到 progressCompact；
 * 没有 compact 文案时退化为两行换行显示，不再截成省略号
 */
const compactProgress = ref(false)
const progressText = computed(() =>
  compactProgress.value && props.progressCompact ? props.progressCompact : props.progress,
)
const progressWraps = computed(() => compactProgress.value && !props.progressCompact)

async function measureBadgeFit() {
  if (!isNarrow.value) {
    compactBadge.value = false
    compactProgress.value = false
    return
  }
  compactBadge.value = false
  compactProgress.value = false
  await nextTick()
  const el = actionEl.value
  if (!el || typeof window === 'undefined') return
  const limit = (barEl.value?.getBoundingClientRect().right || window.innerWidth) - 16
  const truncated = Array.from(groupEl.value?.children ?? []).some(
    (child) => child !== el && child.scrollWidth > child.clientWidth + 1,
  )
  const progress = progressEl.value
  const progressSqueezed =
    !!progress &&
    !!props.progress &&
    progress.clientWidth > 0 &&
    (progress.clientWidth < PROGRESS_MIN_PX || progress.scrollWidth > progress.clientWidth + 1)
  if (truncated || progressSqueezed || el.getBoundingClientRect().right > limit) compactBadge.value = true
  if (progressSqueezed) compactProgress.value = true
}

/** 文案只描述真实动作（滚动并聚焦到目标区块的主按钮），不暗示点下去会直接执行排座 / 导出 */
const label = computed(() => {
  switch (props.step) {
    case 'import':
      return tr('跳到：导入名单')
    case 'arrange':
      return `${tr('跳到：')}${props.arrangeLabel}`
    case 'export':
      // 窄屏上角标与次按钮同行，主按钮文案收短以免角标溢出视口
      return showQuotaBadge.value && isNarrow.value
        ? tr('跳到：导出')
        : tr('跳到：检查并导出')
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
  () =>
    [visible.value, isNarrow.value, showQuotaBadge.value, props.quotaBadge?.text, label.value, props.progress, props.progressCompact] as const,
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

/** 一次性高亮：动画结束即移除，避免残留样式；不支持 animationend 的环境用定时器兑底 */
const ATTN_CLASS = 'sm-attn'
const ATTN_FALLBACK_MS = 1500
function flashAttention(btn: HTMLElement) {
  btn.classList.remove(ATTN_CLASS)
  const clear = () => {
    btn.classList.remove(ATTN_CLASS)
    btn.removeEventListener('animationend', clear)
    window.clearTimeout(timer)
  }
  btn.addEventListener('animationend', clear)
  const timer = window.setTimeout(clear, ATTN_FALLBACK_MS)
  btn.classList.add(ATTN_CLASS)
}

/** 优先聚焦目标区块内标记为主按钮的元素（不可用 / 不可见的跳过），没有时回退聚焦整个区块 */
function primaryIn(section: HTMLElement): HTMLElement | null {
  const candidates = section.querySelectorAll<HTMLElement>('[data-next-step-primary]')
  for (const c of candidates) {
    if (c instanceof HTMLButtonElement && c.disabled) continue
    if (c.hidden || c.getAttribute('aria-hidden') === 'true') continue
    return c
  }
  return null
}

function go() {
  const el = props.target
  if (!el) return
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'instant' : 'smooth', block: 'start' })
  const primary = primaryIn(el)
  if (primary) {
    primary.focus({ preventScroll: true })
    if (document.activeElement === primary) {
      flashAttention(primary)
      return
    }
  }
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
      <p
        ref="progressEl"
        class="min-w-[3.5rem] text-xs text-slate-500"
        :class="progressWraps ? 'line-clamp-2 leading-4 whitespace-normal' : 'truncate'"
        :title="progressText !== progress ? progress : undefined"
        :aria-label="progressText !== progress ? progress : undefined"
        :data-compact="compactProgress && progressCompact ? 'true' : undefined"
        data-testid="next-step-progress"
      >{{ progressText }}</p>
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
