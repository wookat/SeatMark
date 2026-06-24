import { onBeforeUnmount, onMounted, ref } from 'vue'

/** 响应式媒体查询：返回一个在断点变化时自动更新的 ref */
export function useMediaQuery(query: string) {
  const matches = ref(false)
  let mql: MediaQueryList | null = null

  function update(e: MediaQueryListEvent | MediaQueryList) {
    matches.value = e.matches
  }

  onMounted(() => {
    mql = window.matchMedia(query)
    matches.value = mql.matches
    mql.addEventListener('change', update)
  })

  onBeforeUnmount(() => {
    mql?.removeEventListener('change', update)
  })

  return matches
}

/** 是否为移动端（< 1024px，对应 Tailwind lg 断点） */
export function useIsMobile() {
  return useMediaQuery('(max-width: 1023px)')
}
