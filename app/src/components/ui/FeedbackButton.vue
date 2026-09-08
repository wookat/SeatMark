<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { t } from '@/i18n'
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()

const open = ref(false)
const submitting = ref(false)
const type = ref<'bug' | 'suggestion' | 'other'>('suggestion')
const content = ref('')
const contact = ref('')

const TYPE_OPTIONS = computed(() => [
  {
    value: 'suggestion' as const,
    label: t('功能建议'),
    icon: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z',
  },
  {
    value: 'bug' as const,
    label: t('问题反馈'),
    icon: 'M12 20a6 6 0 0 0 6-6v-2a6 6 0 1 0-12 0v2a6 6 0 0 0 6 6zM12 20v-8M6 13H3M21 13h-3M6.5 8 4 6M17.5 8 20 6M9 6a3 3 0 0 1 6 0',
  },
  {
    value: 'other' as const,
    label: t('其他'),
    icon: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-5.1A8 8 0 1 1 21 12z',
  },
])

function reset() {
  type.value = 'suggestion'
  content.value = ''
  contact.value = ''
}

function close() {
  open.value = false
  reset()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) close()
}

/** 回到页面顶部的判定阈值（px）：低于此值恢复显示气泡 */
const TOP_RESTORE_PX = 80
/** 滚动方向判定的最小位移（px），过滤惯性抖动 */
const SCROLL_DELTA_PX = 2

/**
 * 窄屏让位：向下滚动（阅读 / 填表）时收起气泡，不常驻压住右对齐的行内按钮；
 * 回到页顶或用户向上滚动时恢复。仅 <md（<768px，含平板竖屏以下）生效（class 用 max-md: 前缀），桌面 ≥md 常驻。
 */
const collapsed = ref(false)
let lastScrollY = 0

/** 窄屏文本输入中（textarea / 文本 input 聚焦）同样收起，不压住输入控件右下角 */
const inputFocused = ref(false)

function isTextInput(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName
  return tag === 'TEXTAREA' || tag === 'INPUT' || (el instanceof HTMLElement && el.isContentEditable)
}

function syncFocus() {
  inputFocused.value = isTextInput(document.activeElement)
}

function onScroll() {
  const y = window.scrollY
  if (y < TOP_RESTORE_PX) collapsed.value = false
  else if (y > lastScrollY + SCROLL_DELTA_PX) collapsed.value = true
  else if (y < lastScrollY - SCROLL_DELTA_PX) collapsed.value = false
  lastScrollY = y
}

/**
 * 页脚进入视口时淡出，不压住页脚链接/版权行；仅在页面可滚动（用户主动滚到底）时生效，
 * 短页面页脚常驻可见时保留气泡，否则反馈入口会消失
 */
const footerVisible = ref(false)
let footerObserver: IntersectionObserver | null = null

function pageScrollable() {
  return document.documentElement.scrollHeight > window.innerHeight + 8
}

function observeFooter() {
  const footer = document.querySelector('footer')
  if (!footer || typeof IntersectionObserver === 'undefined') return
  footerObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[entries.length - 1]
      if (entry) footerVisible.value = entry.isIntersecting && pageScrollable()
    },
    { threshold: 0 },
  )
  footerObserver.observe(footer)
}

onMounted(() => {
  lastScrollY = window.scrollY
  syncFocus()
  observeFooter()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('scroll', onScroll, { passive: true })
  document.addEventListener('focusin', syncFocus)
  document.addEventListener('focusout', syncFocus)
})
onBeforeUnmount(() => {
  footerObserver?.disconnect()
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('scroll', onScroll)
  document.removeEventListener('focusin', syncFocus)
  document.removeEventListener('focusout', syncFocus)
})

const hiddenOnNarrow = computed(() => collapsed.value || (inputFocused.value && !open.value))
const hiddenForFooter = computed(() => footerVisible.value && !open.value)

async function submit() {
  if (!content.value.trim()) {
    toast.warning(t('请填写反馈内容'))
    return
  }
  if (content.value.length > 2000) {
    toast.warning(t('反馈内容不能超过 2000 字'))
    return
  }

  submitting.value = true
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: type.value,
        content: content.value.trim(),
        contact: contact.value.trim(),
        page: window.location.pathname,
      }),
    })
    if (!res.ok) throw new Error()
    toast.success(t('感谢反馈！'), t('已收到你的意见'))
    close()
  } catch {
    toast.danger(t('提交失败'), t('请稍后重试'))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <!-- 浮动按钮：画布页（html.has-canvas-safe-area）在 ≥md 缩为 size-10 并贴边 right-3，配合预览列的 md:pr-16 与底部固定层留白不压座位图；
       底部操作条在场时按实际条高 --sm-nextstep-h + 12px 抬高 -->
  <button
    class="no-print fixed right-5 bottom-5 z-50 flex size-12 items-center justify-center rounded-full bg-brand-600 text-white transition-all hover:bg-brand-700 max-md:right-3 max-md:size-10 md:[.has-canvas-safe-area_&]:right-3 md:[.has-canvas-safe-area_&]:size-10 [.has-next-step-bar_&]:bottom-[calc(var(--sm-nextstep-h,3rem)_+_0.75rem)] [.has-sticky-actions_&]:bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))]"
    :class="[
      hiddenOnNarrow && 'max-md:pointer-events-none max-md:translate-y-2 max-md:opacity-0',
      hiddenForFooter && 'pointer-events-none translate-y-2 opacity-0',
    ]"
    :data-collapsed="hiddenOnNarrow ? 'true' : 'false'"
    :data-input-focused="inputFocused ? 'true' : 'false'"
    :data-footer-visible="hiddenForFooter ? 'true' : 'false'"
    :aria-hidden="hiddenForFooter ? 'true' : undefined"
    :tabindex="hiddenForFooter ? -1 : undefined"
    :aria-label="t('反馈')"
    @click="open = true"
  >
    <svg class="size-5.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  </button>

  <!-- 遮罩 -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-[60] bg-slate-900/40"
        @click="close"
      ></div>
    </Transition>

    <!-- 弹窗 -->
    <Transition
      enter-active-class="transition duration-200"
      enter-from-class="translate-y-4 opacity-0"
      leave-active-class="transition duration-150"
      leave-to-class="translate-y-4 opacity-0"
    >
      <div
        v-if="open"
        class="fixed bottom-0 right-0 z-[61] w-full max-w-md p-4 sm:bottom-auto sm:right-1/2 sm:top-1/2 sm:translate-x-1/2 sm:-translate-y-1/2"
      >
        <div class="rounded-lg bg-white shadow-pop">
          <!-- 头部 -->
          <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 class="text-base font-bold text-slate-900">{{ t('意见反馈') }}</h3>
            <button
              type="button"
              class="cursor-pointer text-slate-600 transition-colors hover:text-slate-600"
              :aria-label="t('关闭')"
              @click="close"
            >
              <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- 表单 -->
          <div class="space-y-4 px-5 py-4">
            <!-- 类型选择 -->
            <div>
              <label class="mb-2 block text-sm font-medium text-slate-700">{{ t('反馈类型') }}</label>
              <div class="flex gap-2">
                <button
                  v-for="opt in TYPE_OPTIONS"
                  :key="opt.value"
                  type="button"
                  class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-all"
                  :class="type === opt.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'"
                  @click="type = opt.value"
                >
                  <svg
                    class="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path :d="opt.icon" />
                  </svg>
                  <span>{{ opt.label }}</span>
                </button>
              </div>
            </div>

            <!-- 内容 -->
            <div>
              <label class="mb-2 block text-sm font-medium text-slate-700">
                {{ t('反馈内容') }}
                <span class="ml-1 text-xs font-normal text-slate-600">({{ content.length }}/2000)</span>
              </label>
              <textarea
                v-model="content"
                rows="4"
                maxlength="2000"
                :placeholder="t('请描述你遇到的问题或建议...')"
                class="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              ></textarea>
            </div>

            <!-- 联系方式 -->
            <div>
              <label class="mb-2 block text-sm font-medium text-slate-700">
                {{ t('联系方式') }}
                <span class="ml-1 text-xs font-normal text-slate-600">{{ t('（选填）') }}</span>
              </label>
              <input
                v-model="contact"
                type="text"
                maxlength="200"
                :placeholder="t('邮箱或手机号，方便我们回复你')"
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <!-- 底部 -->
          <div class="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              @click="close"
            >
              {{ t('取消') }}
            </button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="submitting || !content.trim()"
              @click="submit"
            >
              {{ submitting ? t('提交中...') : t('提交反馈') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
