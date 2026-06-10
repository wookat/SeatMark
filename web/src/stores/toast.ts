import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastType = 'info' | 'success' | 'warning' | 'danger'

export interface ToastItem {
  id: number
  type: ToastType
  title: string
  text?: string
}

let seed = 0

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<ToastItem[]>([])

  function push(type: ToastType, title: string, text?: string, timeout = 3600) {
    const id = ++seed
    toasts.value.push({ id, type, title, text })
    if (timeout > 0) {
      window.setTimeout(() => dismiss(id), timeout)
    }
    return id
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return {
    toasts,
    push,
    dismiss,
    info: (title: string, text?: string) => push('info', title, text),
    success: (title: string, text?: string) => push('success', title, text),
    warning: (title: string, text?: string) => push('warning', title, text),
    danger: (title: string, text?: string) => push('danger', title, text),
  }
})
