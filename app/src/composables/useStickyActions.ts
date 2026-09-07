import { onBeforeUnmount, onMounted } from 'vue'

/** 页面带吸顶/吸底操作栏（工坊导出栏、排座/宴会下一步栏）时在 <html> 打的标记，ToastHost 等浮层据此让位 */
export const STICKY_ACTIONS_CLASS = 'has-sticky-actions'

/**
 * 工坊预览工具栏的自然底边（px，相对未滚动时的视口），由 PreviewArea 写在 <html> 的 style 上；
 * ToastHost 在 ≥lg 的 .has-sticky-actions 页面据此把 toast 落到工具栏下方（未设置时回退到右上 top-20）。
 */
export const STUDIO_TOOLBAR_BOTTOM_VAR = '--studio-toolbar-bottom'

/**
 * 页面右下角有画布/座位图（排座、宴会）时在 <html> 打的标记：
 * 反馈气泡据此在 ≥md 缩小并贴边，画布列外层同时预留右下空区，两者互不遮挡。
 */
export const CANVAS_SAFE_AREA_CLASS = 'has-canvas-safe-area'

function useHtmlClass(className: string): void {
  onMounted(() => {
    if (typeof document === 'undefined') return
    document.documentElement.classList.add(className)
  })
  onBeforeUnmount(() => {
    if (typeof document === 'undefined') return
    document.documentElement.classList.remove(className)
  })
}

/** 在页面挂载期间标记 html.has-sticky-actions，卸载时移除 */
export function useStickyActions(): void {
  useHtmlClass(STICKY_ACTIONS_CLASS)
}

/** 在页面挂载期间标记 html.has-canvas-safe-area，卸载时移除 */
export function useCanvasSafeArea(): void {
  useHtmlClass(CANVAS_SAFE_AREA_CLASS)
}
