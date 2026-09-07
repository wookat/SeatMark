import { onBeforeUnmount, onMounted } from 'vue'

/** 页面带吸顶/吸底操作栏（工坊导出栏、排座/宴会下一步栏）时在 <html> 打的标记，ToastHost 等浮层据此让位 */
export const STICKY_ACTIONS_CLASS = 'has-sticky-actions'

/** 在页面挂载期间标记 html.has-sticky-actions，卸载时移除 */
export function useStickyActions(): void {
  onMounted(() => {
    if (typeof document === 'undefined') return
    document.documentElement.classList.add(STICKY_ACTIONS_CLASS)
  })
  onBeforeUnmount(() => {
    if (typeof document === 'undefined') return
    document.documentElement.classList.remove(STICKY_ACTIONS_CLASS)
  })
}
