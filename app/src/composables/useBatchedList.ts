import { computed, ref, watch, type Ref, type WatchSource } from 'vue'

export const BATCH_SIZE = 24

/**
 * 长列表客户端分批显示：
 * - 预渲染（SSR）时输出全部条目，保证爬虫拿到完整链接；
 * - 客户端首屏只渲染 BATCH_SIZE 条，「加载更多」逐批追加；
 * - 任一筛选源变化时回到第一批。
 */
export function useBatchedList<T>(
  source: Ref<T[]>,
  resetOn: WatchSource<unknown>[],
  batchSize = BATCH_SIZE,
) {
  const visibleCount = ref(import.meta.env.SSR ? Number.POSITIVE_INFINITY : batchSize)
  const visible = computed(() => source.value.slice(0, visibleCount.value))
  const remaining = computed(() => Math.max(0, source.value.length - visibleCount.value))
  const hasMore = computed(() => remaining.value > 0)

  function showMore() {
    visibleCount.value += batchSize
  }

  watch(resetOn, () => {
    if (!import.meta.env.SSR) visibleCount.value = batchSize
  })

  return { visibleCount, visible, remaining, hasMore, showMore }
}
