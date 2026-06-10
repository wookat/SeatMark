import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

/** 通过 ResizeObserver 跟踪元素内容尺寸 */
export function useElementSize(target: Ref<HTMLElement | null>) {
  const width = ref(0)
  const height = ref(0)
  let observer: ResizeObserver | null = null

  const observe = (el: HTMLElement | null) => {
    observer?.disconnect()
    if (!el) return
    observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) {
        width.value = rect.width
        height.value = rect.height
      }
    })
    observer.observe(el)
  }

  onMounted(() => observe(target.value))
  watch(target, (el) => observe(el))
  onBeforeUnmount(() => observer?.disconnect())

  return { width, height }
}
