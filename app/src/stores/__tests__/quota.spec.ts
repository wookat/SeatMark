import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useAuthStore, type SessionUser } from '@/stores/auth'
import { QUOTA_ANON_DAILY, useQuotaStore } from '@/stores/quota'

function mockUser(overrides: Partial<SessionUser['quota']> = {}): SessionUser {
  return {
    email: 'a@b.com',
    createdAt: '2026-01-01T00:00:00Z',
    lastLoginAt: '2026-01-01T00:00:00Z',
    loginCount: 1,
    templateCount: 0,
    templateUpdatedAt: null,
    betaMember: true,
    isAdmin: false,
    quota: { date: '2026-01-01', used: 0, limit: 3, bonus: 0, remaining: 3, ...overrides },
    share: {
      code: 'abcd1234',
      totalVisits: 0,
      totalBonus: 0,
      bonusToday: 0,
      bonusDailyCap: 10,
      bonusPerVisit: 1,
    },
  }
}

describe('quota store（每日无水印导出配额）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('未登录：本地计数，达到每日上限后拒绝并打开引导弹窗', async () => {
    const quota = useQuotaStore()
    expect(quota.remaining).toBe(QUOTA_ANON_DAILY)

    for (let i = 0; i < QUOTA_ANON_DAILY; i++) {
      expect((await quota.tryConsume()).ok).toBe(true)
    }
    expect(quota.remaining).toBe(0)

    const result = await quota.tryConsume()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('anon-limit')
    expect(quota.limitDialogOpen).toBe(true)
  })

  it('未登录：本地计数持久化到 localStorage 且跨日重置', async () => {
    const quota = useQuotaStore()
    await quota.tryConsume()
    const raw = localStorage.getItem('seatmark.clean-export-usage.v1')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!).used).toBe(1)

    // 模拟昨日残留数据：应重置为今日 0 次
    localStorage.setItem(
      'seatmark.clean-export-usage.v1',
      JSON.stringify({ date: '2000-01-01', used: 99 }),
    )
    setActivePinia(createPinia())
    const fresh = useQuotaStore()
    expect(fresh.anonRemaining).toBe(QUOTA_ANON_DAILY)
  })

  it('未登录：篡改为负数/NaN 的 used 按 0 计，剩余不超过每日上限', () => {
    localStorage.setItem(
      'seatmark.clean-export-usage.v1',
      JSON.stringify({ date: new Date().toISOString().slice(0, 10), used: -5 }),
    )
    const quota = useQuotaStore()
    expect(quota.anonRemaining).toBe(QUOTA_ANON_DAILY)

    localStorage.setItem(
      'seatmark.clean-export-usage.v1',
      JSON.stringify({ date: new Date().toISOString().slice(0, 10), used: NaN }),
    )
    setActivePinia(createPinia())
    const fresh = useQuotaStore()
    expect(fresh.anonRemaining).toBe(QUOTA_ANON_DAILY)
  })

  it('已登录：走服务端计数，429 时打开引导弹窗', async () => {
    const auth = useAuthStore()
    auth.user = mockUser({ used: 3, remaining: 0 })
    const quota = useQuotaStore()

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: '今日无水印导出次数已用完' }), { status: 429 }),
    )
    // refresh() 也会被调用，返回同一个用户
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: '今日无水印导出次数已用完' }), { status: 429 }),
    )
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ user: mockUser({ used: 3, remaining: 0 }) }), {
        status: 200,
      }),
    )

    const result = await quota.tryConsume()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('user-limit')
    expect(quota.limitDialogOpen).toBe(true)
  })

  it('已登录：consume 成功后同步剩余次数', async () => {
    const auth = useAuthStore()
    auth.user = mockUser()
    const quota = useQuotaStore()

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, used: 1, limit: 3, remaining: 2 }), {
        status: 200,
      }),
    )

    const result = await quota.tryConsume()
    expect(result.ok).toBe(true)
    expect(auth.user.quota.remaining).toBe(2)
  })
})
