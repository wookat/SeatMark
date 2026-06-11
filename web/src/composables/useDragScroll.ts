import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue'

/** 进入拖拽前的移动阈值（px），避免普通点击 / 文本选择被误判为拖拽 */
const ACTIVATE_DISTANCE = 4

const INTERACTIVE_SELECTOR = 'button, a, input, select, textarea, label, [role="button"]'

/**
 * 鼠标按住拖拽平移滚动容器（查看溢出的表格列等）。
 * - 仅响应鼠标左键，触屏沿用浏览器原生滑动；
 * - 落点在按钮 / 输入框等交互元素上时不接管，点击行为不受影响；
 * - 移动超过阈值才进入拖拽，期间禁用文本选择并显示抓取光标。
 */
export function useDragScroll(target: Ref<HTMLElement | null>) {
  let el: HTMLElement | null = null
  let pointerId = -1
  let active = false
  let startX = 0
  let startY = 0
  let startLeft = 0
  let startTop = 0

  function onPointerDown(event: PointerEvent) {
    if (!el || event.pointerType !== 'mouse' || event.button !== 0) return
    if ((event.target as HTMLElement | null)?.closest(INTERACTIVE_SELECTOR)) return
    if (el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight) return
    pointerId = event.pointerId
    active = false
    startX = event.clientX
    startY = event.clientY
    startLeft = el.scrollLeft
    startTop = el.scrollTop
  }

  function onPointerMove(event: PointerEvent) {
    if (!el || event.pointerId !== pointerId) return
    const dx = event.clientX - startX
    const dy = event.clientY - startY
    if (!active) {
      if (Math.abs(dx) < ACTIVATE_DISTANCE && Math.abs(dy) < ACTIVATE_DISTANCE) return
      active = true
      el.setPointerCapture(pointerId)
      el.style.cursor = 'grabbing'
      el.style.userSelect = 'none'
    }
    event.preventDefault()
    el.scrollLeft = startLeft - dx
    el.scrollTop = startTop - dy
  }

  function onPointerEnd(event: PointerEvent) {
    if (event.pointerId !== pointerId) return
    pointerId = -1
    if (!el) return
    if (active && el.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId)
    }
    active = false
    el.style.cursor = ''
    el.style.userSelect = ''
  }

  function detach() {
    if (!el) return
    el.removeEventListener('pointerdown', onPointerDown)
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerup', onPointerEnd)
    el.removeEventListener('pointercancel', onPointerEnd)
    el = null
  }

  function attach(next: HTMLElement | null) {
    detach()
    el = next
    if (!el) return
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerEnd)
    el.addEventListener('pointercancel', onPointerEnd)
  }

  onMounted(() => attach(target.value))
  watch(target, (next) => attach(next))
  onBeforeUnmount(detach)
}
