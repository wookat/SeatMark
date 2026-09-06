import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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
    pro: { active: false, until: null },
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
      JSON.stringify({ date: localToday(), used: -5 }),
    )
    const quota = useQuotaStore()
    expect(quota.anonRemaining).toBe(QUOTA_ANON_DAILY)

    localStorage.setItem(
      'seatmark.clean-export-usage.v1',
      JSON.stringify({ date: localToday(), used: NaN }),
    )
    setActivePinia(createPinia())
    const fresh = useQuotaStore()
    expect(fresh.anonRemaining).toBe(QUOTA_ANON_DAILY)
  })

  it('未登录：其他页签已消耗的次数不被覆写——消耗前重读本地计数取较大值', async () => {
    const quota = useQuotaStore()
    expect(quota.anonRemaining).toBe(QUOTA_ANON_DAILY)

    // 模拟另一页签已消耗完当日配额（本页签内存计数仍为 0）
    localStorage.setItem(
      'seatmark.clean-export-usage.v1',
      JSON.stringify({ date: localToday(), used: QUOTA_ANON_DAILY }),
    )

    const result = await quota.tryConsume()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('anon-limit')
    expect(quota.limitDialogOpen).toBe(true)
    // 本地计数不被覆写回退
    const raw = localStorage.getItem('seatmark.clean-export-usage.v1')
    expect(JSON.parse(raw!).used).toBe(QUOTA_ANON_DAILY)
  })

  it('未登录：storage 事件同步其他页签的消耗到本页签剩余次数', () => {
    const quota = useQuotaStore()
    expect(quota.anonRemaining).toBe(QUOTA_ANON_DAILY)

    localStorage.setItem(
      'seatmark.clean-export-usage.v1',
      JSON.stringify({ date: localToday(), used: QUOTA_ANON_DAILY }),
    )
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'seatmark.clean-export-usage.v1' }),
    )
    expect(quota.anonRemaining).toBe(0)
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

  it('已登录：/api/quota/consume 返回 503 时回落本地计数——前 N 次放行且 localStorage 递增，第 N+1 次拒绝', async () => {
    const auth = useAuthStore()
    const limit = 3
    auth.user = mockUser({ limit, remaining: limit })
    const quota = useQuotaStore()

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ error: 'gateway' }), { status: 503 }))

    for (let i = 1; i <= limit; i++) {
      const result = await quota.tryConsume()
      expect(result.ok).toBe(true)
      const raw = localStorage.getItem('seatmark.clean-export-usage.v1')
      expect(JSON.parse(raw!).used).toBe(i)
    }

    const result = await quota.tryConsume()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('user-limit')
    expect(quota.limitDialogOpen).toBe(true)
    expect(JSON.parse(localStorage.getItem('seatmark.clean-export-usage.v1')!).used).toBe(limit)
    // 每次都先尝试服务端，仅失败后才回落
    expect(fetchMock).toHaveBeenCalledTimes(limit + 1)
    // 会话仍保留（非 401）
    expect(auth.user).not.toBeNull()
  })

  it('已登录：consume 网络异常且账号 limit 缺失时按匿名上限回落', async () => {
    const auth = useAuthStore()
    auth.user = mockUser({ limit: 0, remaining: 0 })
    const quota = useQuotaStore()
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    for (let i = 0; i < QUOTA_ANON_DAILY; i++) {
      expect((await quota.tryConsume()).ok).toBe(true)
    }
    const result = await quota.tryConsume()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('user-limit')
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
