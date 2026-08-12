import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { ApiError, apiFetch } from '@/utils/api'

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
      // 接口异常返回 200 非 JSON 时 data.user 为 undefined，需归一为 null（isLoggedIn 以 !== null 判定）
      user.value = data.user ?? null
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

  async function register(email: string, password: string): Promise<SessionUser> {
    try {
      const data = await apiFetch<{ user: SessionUser }>('/api/auth/register', {
        method: 'POST',
        body: { email, password },
      })
      user.value = data.user
      return data.user
    } catch (err) {
      // 边缘网关 5xx 时服务端注册可能已完成（账号已建），自动改走登录收尾
      if (err instanceof ApiError && err.status >= 500) {
        try {
          return await login(email, password)
        } catch (loginErr) {
          // 登录侧凭据类 4xx 说明注册确实未落库，回抛原始注册错误（可重试提示）
          throw loginErr instanceof ApiError && loginErr.status < 500 ? err : loginErr
        }
      }
      throw err
    }
  }

  async function login(email: string, password: string): Promise<SessionUser> {
    let lastError: unknown
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 600 * attempt))
      try {
        const data = await apiFetch<{ user: SessionUser }>('/api/auth/login', {
          method: 'POST',
          body: { email, password },
        })
        user.value = data.user
        return data.user
      } catch (err) {
        lastError = err
        // 仅边缘网关 5xx 重试（凭据类 4xx 立即抛出，不重复计失败次数）
        if (!(err instanceof ApiError) || err.status < 500) throw err
      }
    }
    throw lastError
  }

  async function logout(): Promise<void> {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } finally {
      user.value = null
    }
  }

  return { user, ready, isLoggedIn, refresh, sendCode, verify, register, login, logout }
})
