/**
 * 工坊首访三步引导的记忆开关：
 * 手动关闭或完成一次导出/打印后不再展示，避免打扰老用户。
 */

const KEY = 'seatmark.studio-first-guide-dismissed.v1'

export function isStudioGuideDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return true
  }
}

export function dismissStudioGuide(): void {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // 隐私模式等存储不可用时静默忽略
  }
}
