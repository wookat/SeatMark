import { onBeforeUnmount, watch, type Ref } from 'vue'

/** 底部固定操作条的实际高度，写在 <html> 上供反馈气泡 / 页面底部留白等其他固定层引用 */
export const NEXT_STEP_BAR_HEIGHT_VAR = '--sm-nextstep-h'

export function writeNextStepBarHeight(px: number) {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty(NEXT_STEP_BAR_HEIGHT_VAR, `${Math.max(0, Math.round(px))}px`)
}

export function clearNextStepBarHeight() {
  writeNextStepBarHeight(0)
}

function measure(el: HTMLElement) {
  const rect = el.getBoundingClientRect()
  return rect.height || el.offsetHeight
}

/**
 * 用 ResizeObserver 跟踪底部固定条（v-if 渲染的元素 ref）的实际高度并写入 CSS 变量；
 * 元素消失时清零，组件卸载时清零。环境不支持 ResizeObserver 时只写一次初始高度。
 */
export function useNextStepBarHeight(el: Ref<HTMLElement | null>) {
  let observer: ResizeObserver | null = null

  watch(
    el,
    (node) => {
      observer?.disconnect()
      observer = null
      if (!node) {
        clearNextStepBarHeight()
        return
      }
      writeNextStepBarHeight(measure(node))
      if (typeof ResizeObserver === 'undefined') return
      observer = new ResizeObserver((entries) => {
        const entry = entries[entries.length - 1]
        if (!entry) return
        const box = entry.borderBoxSize?.[0]
        writeNextStepBarHeight(box ? box.blockSize : measure(entry.target as HTMLElement))
      })
      observer.observe(node)
    },
    { immediate: true, flush: 'post' },
  )

  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = null
    clearNextStepBarHeight()
  })
}
