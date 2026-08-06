/**
 * 工坊首访三步引导的记忆开关：
 * 手动关闭或完成一次导出/打印后不再展示，避免打扰老用户。
 * 以模块级响应式状态承载，任何入口关闭后引导卡片当场消失。
 */
import { ref, type Ref } from 'vue'

const KEY = 'seatmark.studio-first-guide-dismissed.v1'

function readDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return true
  }
}

export const studioGuideDismissed: Ref<boolean> = ref(readDismissed())

export function isStudioGuideDismissed(): boolean {
  return studioGuideDismissed.value
}

export function dismissStudioGuide(): void {
  studioGuideDismissed.value = true
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // 隐私模式等存储不可用时静默忽略
  }
}
