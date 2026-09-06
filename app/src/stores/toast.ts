import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastType = 'info' | 'success' | 'warning' | 'danger'

/** 可选操作按钮（如“撤销”）：点击后执行并关闭该条提示 */
export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastItem {
  id: number
  type: ToastType
  title: string
  text?: string
  action?: ToastAction
}

let seed = 0

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<ToastItem[]>([])

  function push(
    type: ToastType,
    title: string,
    text?: string,
    timeout = 3600,
    action?: ToastAction,
  ) {
    const id = ++seed
    toasts.value.push({ id, type, title, text, action })
    if (timeout > 0) {
      window.setTimeout(() => dismiss(id), timeout)
    }
    return id
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function runAction(id: number) {
    const item = toasts.value.find((t) => t.id === id)
    dismiss(id)
    item?.action?.onClick()
  }

  return {
    toasts,
    push,
    dismiss,
    runAction,
    info: (title: string, text?: string) => push('info', title, text),
    success: (title: string, text?: string) => push('success', title, text),
    warning: (title: string, text?: string) => push('warning', title, text),
    danger: (title: string, text?: string) => push('danger', title, text),
  }
})
