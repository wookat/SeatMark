import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import AnnouncementBar from '@/components/ui/AnnouncementBar.vue'
import {
  ANNOUNCEMENT_CACHE_KEY,
  ANNOUNCEMENT_CACHE_TTL_MS,
  readAnnouncementCache,
} from '@/utils/announcementCache'

function stubFetch(text = '公告') {
  const fetchMock = vi.fn(
    async () =>
      new Response(
        JSON.stringify({ announcement: { text, enabled: true, updatedAt: 'v1' } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('AnnouncementBar sessionStorage 会话缓存', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
    localStorage.removeItem('seatmark.announcement-dismissed.v1')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('首次 mount 请求一次并写入缓存（key 含 fetchedAt）；同会话第二次 mount 不再发请求', async () => {
    const fetchMock = stubFetch()
    const first = mount(AnnouncementBar)
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(first.text()).toContain('公告')
    first.unmount()

    const raw = sessionStorage.getItem(ANNOUNCEMENT_CACHE_KEY)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!) as { fetchedAt: number; announcement: { text: string } }
    expect(typeof parsed.fetchedAt).toBe('number')
    expect(parsed.announcement.text).toBe('公告')

    const second = mount(AnnouncementBar)
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(second.text()).toContain('公告')
  })

  it('缓存超过 10 分钟后重新请求', async () => {
    const fetchMock = stubFetch('新公告')
    sessionStorage.setItem(
      ANNOUNCEMENT_CACHE_KEY,
      JSON.stringify({
        announcement: { text: '旧公告', enabled: true, updatedAt: 'v0' },
        fetchedAt: Date.now() - ANNOUNCEMENT_CACHE_TTL_MS - 1,
      }),
    )
    expect(readAnnouncementCache()).toBeNull()
    const wrapper = mount(AnnouncementBar)
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('新公告')
    expect(wrapper.text()).not.toContain('旧公告')
  })

  it('sessionStorage 不可用（隐私模式抛错）时退化为直接请求且不报错', async () => {
    const fetchMock = stubFetch()
    const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    try {
      const wrapper = mount(AnnouncementBar)
      await flushPromises()
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(wrapper.text()).toContain('公告')
    } finally {
      getSpy.mockRestore()
      setSpy.mockRestore()
    }
  })

  it('损坏的缓存内容视为未命中', () => {
    sessionStorage.setItem(ANNOUNCEMENT_CACHE_KEY, '{not json')
    expect(readAnnouncementCache()).toBeNull()
    sessionStorage.setItem(ANNOUNCEMENT_CACHE_KEY, JSON.stringify({ announcement: null }))
    expect(readAnnouncementCache()).toBeNull()
  })
})
