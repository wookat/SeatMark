/**
 * 首访三步引导的响应式记忆开关：
 * 任何入口（关闭按钮 / 成功导出）调用 dismissStudioGuide 后，
 * 依赖该状态的组件应当场收到更新，无需刷新页面。
 */
import { computed } from 'vue'
import { describe, expect, it } from 'vitest'

import {
  dismissStudioGuide,
  isStudioGuideDismissed,
  studioGuideDismissed,
} from '@/utils/firstVisit'

describe('firstVisit 响应式记忆开关', () => {
  it('dismissStudioGuide 后响应式状态与 localStorage 同步更新', () => {
    studioGuideDismissed.value = false
    const visible = computed(() => !studioGuideDismissed.value)
    expect(visible.value).toBe(true)

    dismissStudioGuide()

    expect(isStudioGuideDismissed()).toBe(true)
    expect(visible.value).toBe(false)
    expect(localStorage.getItem('seatmark.studio-first-guide-dismissed.v1')).toBe('1')
  })
})
