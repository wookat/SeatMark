import { defineStore } from 'pinia'
import { reactive } from 'vue'

/**
 * 全局加载遮罩状态。
 * 独立成轻量 store，供 App 壳层（LoadingOverlay）直接使用，
 * 避免壳层引入 workspace store 及其模板数据依赖。
 */
export const useLoadingStore = defineStore('loading', () => {
  const loading = reactive<{ active: boolean; text: string; onCancel: (() => void) | null }>({
    active: false,
    text: '',
    onCancel: null,
  })

  function setLoading(active: boolean, text = '', onCancel: (() => void) | null = null) {
    loading.active = active
    loading.text = text
    loading.onCancel = active ? onCancel : null
  }

  return { loading, setLoading }
})
