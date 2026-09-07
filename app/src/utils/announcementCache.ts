/**
 * 顶部公告的会话级缓存：AnnouncementBar 是路由级壳组件，每次 mount 都拉 /api/announcement
 * 会白打边缘函数；10 分钟内直接复用 sessionStorage 中的副本。隐私模式/存储不可用时静默退化为直接请求。
 */

export interface AnnouncementPayload {
  text: string
  enabled: boolean
  updatedAt: string
}

export interface AnnouncementCacheEntry {
  announcement: AnnouncementPayload | null
  fetchedAt: number
}

export const ANNOUNCEMENT_CACHE_KEY = 'seatmark.announcement-cache.v1'
export const ANNOUNCEMENT_CACHE_TTL_MS = 10 * 60 * 1000

export function readAnnouncementCache(now: number = Date.now()): AnnouncementCacheEntry | null {
  try {
    const raw = sessionStorage.getItem(ANNOUNCEMENT_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AnnouncementCacheEntry>
    if (typeof parsed.fetchedAt !== 'number' || !Number.isFinite(parsed.fetchedAt)) return null
    if (now - parsed.fetchedAt >= ANNOUNCEMENT_CACHE_TTL_MS) return null
    return { announcement: parsed.announcement ?? null, fetchedAt: parsed.fetchedAt }
  } catch {
    return null
  }
}

export function writeAnnouncementCache(entry: AnnouncementCacheEntry): void {
  try {
    sessionStorage.setItem(ANNOUNCEMENT_CACHE_KEY, JSON.stringify(entry))
  } catch {
    // 隐私模式下静默失败
  }
}
