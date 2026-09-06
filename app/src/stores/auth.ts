import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { ApiError, apiFetch } from '@/utils/api'

export interface QuotaStatus {
  date: string
  used: number
  limit: number
  bonus: number
  remaining: number
  /** 会员有效期内为 true，无水印导出不限次 */
  pro?: boolean
}

export interface ProStatus {
  active: boolean
  until: string | null
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
  pro: ProStatus
  isAdmin: boolean
  quota: QuotaStatus
  share: ShareStats
}

/** 邀请码（?ref= 落地时写入）：注册时携带，双方各赠专业版天数 */
export const INVITE_REF_KEY = 'sm-invite-ref'

export function pendingInviteCode(): string {
  try {
    const code = localStorage.getItem(INVITE_REF_KEY) || ''
    return /^[0-9a-f]{8}$/.test(code) ? code : ''
  } catch {
    return ''
  }
}

/**
 * 「本浏览器曾登录过」标记：无标记的匿名访客首屏不再请求 /api/auth/me（省一次边缘调用）。
 * 登录/注册成功或 /api/auth/me 返回 user 时置 1；登出或返回 user:null 时清除。
 */
export const HAS_ACCOUNT_KEY = 'seatmark:has-account'

export function hasAccountMarker(): boolean {
  try {
    return localStorage.getItem(HAS_ACCOUNT_KEY) === '1'
  } catch {
    return false
  }
}

function writeAccountMarker(present: boolean): void {
  try {
    if (present) localStorage.setItem(HAS_ACCOUNT_KEY, '1')
    else localStorage.removeItem(HAS_ACCOUNT_KEY)
  } catch {
    // 隐私模式等存储异常：下次仍会走 /api/auth/me 兜底
  }
}

export interface Captcha {
  /** 验证码图片（data:image/svg+xml;base64,...） */
  image: string
  token: string
}

/** 表单验证码作答（随注册/登录/重置密码请求携带） */
export interface CaptchaInput {
  captchaToken: string
  captchaAnswer: string
}

/** 服务端账号服务不可用（AUTH_SECRET 缺失 / 存储降级）：503 或 body.code === 'auth_secret_missing' */
export function isServiceUnavailableError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false
  return (
    err.status === 503 ||
    err.data.code === 'auth_secret_missing' ||
    err.data.error === 'auth_secret_missing'
  )
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<SessionUser | null>(null)
  /** 首次 /api/auth/me 是否已返回（避免登录态闪烁） */
  const ready = ref(false)
  /** 账号服务暂时不可用（服务端 503）：登录/注册/找回表单禁用提交并显示服务提示 */
  const serviceUnavailable = ref(false)

  const isLoggedIn = computed(() => user.value !== null)

  function setUser(next: SessionUser | null): void {
    user.value = next
    writeAccountMarker(next !== null)
  }

  async function refresh(): Promise<void> {
    try {
      const data = await apiFetch<{ user: SessionUser | null }>('/api/auth/me')
      // 接口异常返回 200 非 JSON 时 data.user 为 undefined，需归一为 null（isLoggedIn 以 !== null 判定）
      setUser(data.user ?? null)
      serviceUnavailable.value = false
    } catch (err) {
      // 网络/网关异常不清标记（下次仍会再查）；只有服务端明确返回 user:null 才清
      user.value = null
      // 503 是已知的服务端配置缺口，不是前端异常：只记状态，不抛出
      if (isServiceUnavailableError(err)) serviceUnavailable.value = true
    } finally {
      ready.value = true
    }
  }

  /**
   * 应用启动时的登录态引导：本浏览器从未登录过则直接判定匿名，不发请求；
   * 需要准确登录态的入口（/account、?ref= 落地）应直接调用 refresh()。
   */
  async function bootstrap(): Promise<void> {
    if (hasAccountMarker()) {
      await refresh()
      return
    }
    user.value = null
    ready.value = true
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
    setUser(data.user)
    return data.user
  }

  async function fetchCaptcha(): Promise<Captcha> {
    try {
      const data = await apiFetch<Captcha>('/api/auth/captcha')
      serviceUnavailable.value = false
      return data
    } catch (err) {
      if (isServiceUnavailableError(err)) serviceUnavailable.value = true
      throw err
    }
  }

  async function register(
    email: string,
    password: string,
    captcha: CaptchaInput,
  ): Promise<SessionUser> {
    try {
      const inviteCode = pendingInviteCode()
      const data = await apiFetch<{ user: SessionUser }>('/api/auth/register', {
        method: 'POST',
        body: inviteCode ? { email, password, inviteCode, ...captcha } : { email, password, ...captcha },
      })
      setUser(data.user)
      try {
        localStorage.removeItem(INVITE_REF_KEY)
      } catch {
        // 忽略存储异常
      }
      return data.user
    } catch (err) {
      // 边缘网关 5xx 时服务端注册可能已完成（账号已建），自动改走登录收尾
      if (err instanceof ApiError && err.status >= 500) {
        try {
          return await login(email, password, captcha)
        } catch (loginErr) {
          // 登录侧凭据类 4xx 说明注册确实未落库，回抛原始注册错误（可重试提示）
          throw loginErr instanceof ApiError && loginErr.status < 500 ? err : loginErr
        }
      }
      throw err
    }
  }

  async function login(
    email: string,
    password: string,
    captcha: CaptchaInput,
  ): Promise<SessionUser> {
    let lastError: unknown
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 600 * attempt))
      try {
        const data = await apiFetch<{ user: SessionUser }>('/api/auth/login', {
          method: 'POST',
          body: { email, password, ...captcha },
        })
        setUser(data.user)
        return data.user
      } catch (err) {
        lastError = err
        // 服务端配置缺口（503）重试无意义：记状态后立即抛出
        if (isServiceUnavailableError(err)) {
          serviceUnavailable.value = true
          throw err
        }
        // 仅边缘网关 5xx 重试（凭据类 4xx 立即抛出，不重复计失败次数）
        if (!(err instanceof ApiError) || err.status < 500) throw err
      }
    }
    throw lastError
  }

  async function sendResetCode(
    email: string,
    captcha: CaptchaInput,
  ): Promise<{ delivery: string; devCode?: string }> {
    return apiFetch<{ delivery: string; devCode?: string }>('/api/auth/reset-code', {
      method: 'POST',
      body: { email, ...captcha },
    })
  }

  async function resetPassword(email: string, code: string, password: string): Promise<SessionUser> {
    let lastError: unknown
    let sawGatewayError = false
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 600 * attempt))
      try {
        const data = await apiFetch<{ user: SessionUser }>('/api/auth/reset-password', {
          method: 'POST',
          body: { email, code, password },
        })
        setUser(data.user)
        return data.user
      } catch (err) {
        lastError = err
        if (!(err instanceof ApiError) || err.status < 500) {
          // 网关 5xx 时服务端可能已完成重置并消费了重置码，重试会得到 400；此时引导直接用新密码登录
          if (sawGatewayError && err instanceof ApiError && err.status === 400) {
            throw new ApiError(400, '重置可能已生效，请直接用新密码登录', err.data)
          }
          throw err
        }
        sawGatewayError = true
      }
    }
    throw lastError
  }

  async function redeem(code: string): Promise<{ days?: number; already?: boolean; pro: ProStatus }> {
    const data = await apiFetch<{ days?: number; already?: boolean; pro: ProStatus }>(
      '/api/redeem',
      { method: 'POST', body: { code } },
    )
    await refresh()
    return data
  }

  async function logout(): Promise<void> {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
    }
  }

  return {
    user,
    ready,
    serviceUnavailable,
    isLoggedIn,
    refresh,
    bootstrap,
    sendCode,
    verify,
    fetchCaptcha,
    register,
    login,
    sendResetCode,
    resetPassword,
    logout,
    redeem,
  }
})
