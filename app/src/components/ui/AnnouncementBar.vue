<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { apiFetch } from '@/utils/api'

interface Announcement {
  text: string
  enabled: boolean
  updatedAt: string
}

const announcement = ref<Announcement | null>(null)
const dismissed = ref(false)

const DISMISS_KEY = 'seatmark.announcement-dismissed.v1'

onMounted(async () => {
  try {
    const data = await apiFetch<{ announcement: Announcement | null }>('/api/announcement')
    if (data.announcement?.enabled && data.announcement.text) {
      announcement.value = data.announcement
      try {
        dismissed.value = localStorage.getItem(DISMISS_KEY) === data.announcement.updatedAt
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
      aria-label="关闭公告"
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
