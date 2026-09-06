import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { HAS_ACCOUNT_KEY, useAuthStore, type SessionUser } from '@/stores/auth'

function mockUser(): SessionUser {
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
    quota: { date: '2026-01-01', used: 0, limit: 3, bonus: 0, remaining: 3 },
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('auth store：seatmark:has-account 标记与启动引导', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('无标记：bootstrap 不请求 /api/auth/me，直接 ready 且匿名', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const auth = useAuthStore()
    await auth.bootstrap()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(auth.ready).toBe(true)
    expect(auth.user).toBeNull()
  })

  it('有标记：bootstrap 请求 /api/auth/me 并恢复登录态', async () => {
    localStorage.setItem(HAS_ACCOUNT_KEY, '1')
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ user: mockUser() }))
    const auth = useAuthStore()
    await auth.bootstrap()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]![0])).toBe('/api/auth/me')
    expect(auth.user?.email).toBe('a@b.com')
    expect(localStorage.getItem(HAS_ACCOUNT_KEY)).toBe('1')
  })

  it('/api/auth/me 返回 user:null 时清除标记', async () => {
    localStorage.setItem(HAS_ACCOUNT_KEY, '1')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ user: null }))
    const auth = useAuthStore()
    await auth.refresh()
    expect(auth.user).toBeNull()
    expect(localStorage.getItem(HAS_ACCOUNT_KEY)).toBeNull()
  })

  it('登录成功置标记，登出清除标记', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ ok: true, user: mockUser() }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
    const auth = useAuthStore()
    await auth.login('a@b.com', 'password-123', { captchaToken: 't', captchaAnswer: 'abcd' })
    expect(localStorage.getItem(HAS_ACCOUNT_KEY)).toBe('1')
    await auth.logout()
    expect(localStorage.getItem(HAS_ACCOUNT_KEY)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('refresh 遇 503 / auth_secret_missing：不抛出、置 serviceUnavailable、保留标记待下次重查', async () => {
    localStorage.setItem(HAS_ACCOUNT_KEY, '1')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ error: '账号服务未配置', code: 'auth_secret_missing' }, 503),
    )
    const auth = useAuthStore()
    await expect(auth.bootstrap()).resolves.toBeUndefined()
    expect(auth.ready).toBe(true)
    expect(auth.user).toBeNull()
    expect(auth.serviceUnavailable).toBe(true)
    expect(localStorage.getItem(HAS_ACCOUNT_KEY)).toBe('1')
  })

  it('login 遇 503 立即抛出且不重试（区别于网关 5xx 的退避重试）', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ error: '账号服务未配置', code: 'auth_secret_missing' }, 503))
    const auth = useAuthStore()
    await expect(
      auth.login('a@b.com', 'password-123', { captchaToken: 't', captchaAnswer: 'abcd' }),
    ).rejects.toMatchObject({ status: 503 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(auth.serviceUnavailable).toBe(true)
  })
})
