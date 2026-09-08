import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'

import { useQuotaBadge } from '@/composables/useQuotaBadge'
import { QUOTA_USER_DAILY } from '@/stores/quota'

const t = (key: string) => key

describe('useQuotaBadge', () => {
  it('remaining > 0：正向展示「无水印 今日剩余 n 次」（绿色），title 带不限次说明、n/limit 与登录提示', () => {
    const quota = reactive({ remaining: 1, limit: 1 })
    const auth = reactive({ isLoggedIn: false })
    const { badge, title } = useQuotaBadge(quota, auth, t)
    expect(badge.value).toEqual({
      text: '无水印 今日剩余 1 次',
      cls: 'bg-emerald-100 text-emerald-700',
    })
    expect(title.value).toContain('打印、带水印导出、CSV、速查表 PDF 均不限次')
    expect(title.value).toContain('无水印今日剩余 1/1 次')
    expect(title.value).toContain(`，免费登录后每天 ${QUOTA_USER_DAILY} 次`)
  })

  it('remaining = 0：改为「带水印免费」（蓝色），不展示刺眼的 0', () => {
    const quota = reactive({ remaining: 0, limit: 1 })
    const auth = reactive({ isLoggedIn: false })
    const { badge, title } = useQuotaBadge(quota, auth, t)
    expect(badge.value).toEqual({ text: '带水印免费', cls: 'bg-sky-100 text-sky-700' })
    expect(title.value).toContain('无水印今日剩余 0/1 次')
  })

  it('已登录时 title 不再追加「免费登录后每天」；额度变化时角标响应式更新', () => {
    const quota = reactive({ remaining: 3, limit: 3 })
    const auth = reactive({ isLoggedIn: true })
    const { badge, title } = useQuotaBadge(quota, auth, t)
    expect(title.value).not.toContain('免费登录后每天')
    expect(badge.value.text).toBe('无水印 今日剩余 3 次')
    quota.remaining = 0
    expect(badge.value.text).toBe('带水印免费')
  })
})
