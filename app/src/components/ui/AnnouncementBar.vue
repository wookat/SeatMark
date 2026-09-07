<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { t } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import {
  type AnnouncementCacheEntry,
  type AnnouncementPayload as Announcement,
  type AnnouncementResponse,
  readAnnouncementCache,
  writeAnnouncementCache,
} from '@/utils/announcementCache'
import { apiFetch } from '@/utils/api'

const auth = useAuthStore()
const announcement = ref<Announcement | null>(null)
const dismissed = ref(false)

const DISMISS_KEY = 'seatmark.announcement-dismissed.v1'

async function loadAnnouncement(): Promise<AnnouncementCacheEntry> {
  const now = Date.now()
  const cached = readAnnouncementCache(now)
  if (cached) return cached
  const data = await apiFetch<AnnouncementResponse>('/api/announcement')
  const entry: AnnouncementCacheEntry = {
    announcement: data.announcement ?? null,
    fetchedAt: now,
    ...(data.authService ? { authService: data.authService } : {}),
  }
  writeAnnouncementCache(entry)
  return entry
}

/**
 * 复用公告请求随附的账号服务状态：缺失 AUTH_SECRET 时站内「注册送 7 天」利益点统一换成维护文案，
 * 不额外探测 /api/auth/me。只置不可用，恢复由真实账号请求成功（auth.refresh）或公告缓存过期后的 ok 回应清除。
 */
function applyAuthService(state: AnnouncementCacheEntry['authService']): void {
  if (state === 'auth_secret_missing') auth.serviceUnavailable = true
  else if (state === 'ok' && !auth.probed) auth.serviceUnavailable = false
}

onMounted(async () => {
  try {
    const entry = await loadAnnouncement()
    applyAuthService(entry.authService)
    const current = entry.announcement
    if (current?.enabled && current.text) {
      announcement.value = current
      try {
        dismissed.value = localStorage.getItem(DISMISS_KEY) === current.updatedAt
      } catch {
        dismissed.value = false
      }
    }
  } catch {
    // 公告拉取失败静默忽略
  }
})

function dismiss() {
  dismissed.value = true
  if (announcement.value) {
    try {
      localStorage.setItem(DISMISS_KEY, announcement.value.updatedAt)
    } catch {
      // 隐私模式下静默失败
    }
  }
}
</script>

<template>
  <div
    v-if="announcement && !dismissed"
    class="no-print flex items-center justify-center gap-2 bg-brand-600 px-4 py-2 text-center text-xs font-medium text-white sm:text-sm"
  >
    <span class="min-w-0">{{ announcement.text }}</span>
    <button
      type="button"
      class="group/close -my-3 -mr-3 flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center"
      :aria-label="t('关闭公告')"
      @click="dismiss"
    >
      <span class="flex size-5 items-center justify-center rounded group-hover/close:bg-white/15">
        <svg
          class="size-3.5"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        >
          <path d="m4 4 8 8m0-8-8 8" />
        </svg>
      </span>
    </button>
  </div>
</template>
