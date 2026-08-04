import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { apiFetch } from '@/utils/api'

export interface QuotaStatus {
  date: string
  used: number
  limit: number
  bonus: number
  remaining: number
}

export interface ShareStats {
  code: string
  totalVisits: number
  totalBonus: number
  bonusToday: number
  bonusDailyCap: number
  bonusPerVisit: number
}

export interface SessionUser {
  email: string
  createdAt: string
  lastLoginAt: string
  loginCount: number
  templateCount: number
  templateUpdatedAt: string | null
  betaMember: boolean
  isAdmin: boolean
  quota: QuotaStatus
  share: ShareStats
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<SessionUser | null>(null)
  /** 首次 /api/auth/me 是否已返回（避免登录态闪烁） */
  const ready = ref(false)

  const isLoggedIn = computed(() => user.value !== null)

  async function refresh(): Promise<void> {
    try {
      const data = await apiFetch<{ user: SessionUser | null }>('/api/auth/me')
      user.value = data.user
    } catch {
      user.value = null
    } finally {
      ready.value = true
    }
  }

  async function sendCode(email: string): Promise<{ delivery: string; devCode?: string }> {
    return apiFetch<{ delivery: string; devCode?: string }>('/api/auth/code', {
      method: 'POST',
      body: { email },
    })
  }

  async function verify(email: string, code: string): Promise<SessionUser> {
    const data = await apiFetch<{ user: SessionUser }>('/api/auth/verify', {
      method: 'POST',
      body: { email, code },
    })
    user.value = data.user
    return data.user
  }

  async function logout(): Promise<void> {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } finally {
      user.value = null
    }
  }

  return { user, ready, isLoggedIn, refresh, sendCode, verify, logout }
})
