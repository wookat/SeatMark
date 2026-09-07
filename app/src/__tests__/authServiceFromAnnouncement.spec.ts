// @vitest-environment jsdom
/**
 * 第 354 轮：生产 AUTH_SECRET 缺失期间，匿名首页不额外探测 /api/auth/me，
 * 而是复用公告请求随附的 authService 与已有配额请求结果收起「注册送 7 天」利益点；恢复后原文案照常。
 */
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AnnouncementBar from '@/components/ui/AnnouncementBar.vue'
import AppFooter from '@/components/ui/AppFooter.vue'
import { useAuthStore } from '@/stores/auth'
import { useQuotaStore } from '@/stores/quota'
import { ANNOUNCEMENT_CACHE_KEY } from '@/utils/announcementCache'

const GIFT = '注册送 7 天专业版'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function stubAnnouncement(authService: 'ok' | 'auth_secret_missing' | undefined) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/api/announcement')) {
      return jsonResponse({ announcement: null, ...(authService ? { authService } : {}) })
    }
    return jsonResponse({}, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const footerStubs = { RouterLink: RouterLinkStub }

describe('第 354 轮：公告随附 authService 驱动利益点降级', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('authService=auth_secret_missing → 只有公告这 1 个请求，页脚「注册送 7 天」收起为「定价」', async () => {
    const fetchMock = stubAnnouncement('auth_secret_missing')
    const auth = useAuthStore()
    mount(AnnouncementBar)
    const footer = mount(AppFooter, { global: { stubs: footerStubs } })
    expect(footer.text()).toContain(GIFT)
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/announcement')
    expect(auth.serviceUnavailable).toBe(true)
    expect(footer.text()).not.toContain(GIFT)
    expect(footer.text()).toContain('定价')
  })

  it('authService=ok → 页脚照常显示「注册送 7 天」', async () => {
    stubAnnouncement('ok')
    const auth = useAuthStore()
    mount(AnnouncementBar)
    const footer = mount(AppFooter, { global: { stubs: footerStubs } })
    await flushPromises()
    expect(auth.serviceUnavailable).toBe(false)
    expect(footer.text()).toContain(GIFT)
  })

  it('旧版边缘函数未返回 authService → 不改变状态（兼容灰度期）', async () => {
    stubAnnouncement(undefined)
    const auth = useAuthStore()
    mount(AnnouncementBar)
    await flushPromises()
    expect(auth.serviceUnavailable).toBe(false)
  })

  it('sessionStorage 缓存里带 auth_secret_missing → 不发请求也收起利益点', async () => {
    const fetchMock = stubAnnouncement('ok')
    sessionStorage.setItem(
      ANNOUNCEMENT_CACHE_KEY,
      JSON.stringify({ announcement: null, fetchedAt: Date.now(), authService: 'auth_secret_missing' }),
    )
    const auth = useAuthStore()
    mount(AnnouncementBar)
    await flushPromises()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(auth.serviceUnavailable).toBe(true)
  })

  it('/api/auth/me 已探测为不可用时，CDN 残留的 ok 公告不会把状态翻回可用', async () => {
    stubAnnouncement('ok')
    const auth = useAuthStore()
    auth.probed = true
    auth.serviceUnavailable = true
    mount(AnnouncementBar)
    await flushPromises()
    expect(auth.serviceUnavailable).toBe(true)
  })

  it('账号服务恢复：auth.refresh 成功后自动恢复原文案', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.endsWith('/api/announcement')) {
          return jsonResponse({ announcement: null, authService: 'auth_secret_missing' })
        }
        if (url.endsWith('/api/auth/me')) return jsonResponse({ user: null })
        return jsonResponse({}, 404)
      }),
    )
    const auth = useAuthStore()
    mount(AnnouncementBar)
    const footer = mount(AppFooter, { global: { stubs: footerStubs } })
    await flushPromises()
    expect(footer.text()).not.toContain(GIFT)

    await auth.refresh()
    await flushPromises()
    expect(auth.serviceUnavailable).toBe(false)
    expect(footer.text()).toContain(GIFT)
  })
})

describe('第 354 轮：复用配额请求结果', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('登录态 POST /api/quota/consume 返回 503 auth_secret_missing → 标记账号服务不可用且按本地额度判定', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'auth_secret_missing' }, 503)),
    )
    const auth = useAuthStore()
    auth.user = {
      email: 'a@example.com',
      quota: { used: 0, limit: 3, remaining: 3 },
    } as unknown as NonNullable<typeof auth.user>
    const quota = useQuotaStore()
    const result = await quota.tryConsume()
    expect(result.ok).toBe(true)
    expect(auth.serviceUnavailable).toBe(true)
  })
})
