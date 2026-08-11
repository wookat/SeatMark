import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useAuthStore } from '@/stores/auth'
import { apiFetch, ApiError } from '@/utils/api'

/** 与 edge-functions/api/[[default]].js 保持一致（计数对象：无水印导出/打印） */
export const QUOTA_ANON_DAILY = 1
export const QUOTA_USER_DAILY = 3

const STORAGE_KEY = 'seatmark.clean-export-usage.v1'

interface LocalUsage {
  date: string
  used: number
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function loadLocalUsage(): LocalUsage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalUsage>
      if (parsed.date === todayStr() && Number.isFinite(parsed.used)) {
        // 非法负值/NaN 按 0 计，防止篡改后配额溢出
        return { date: parsed.date, used: Math.max(0, Number(parsed.used)) }
      }
    }
  } catch {
    // 解析失败按当日 0 次处理
  }
  return { date: todayStr(), used: 0 }
}

export type ConsumeResult =
  | { ok: true }
  | { ok: false; reason: 'anon-limit' | 'user-limit' }

/**
 * 每日无水印导出配额（带水印导出 / 打印不限次数，不计数）：
 * - 未登录：浏览器本地计数，每日 QUOTA_ANON_DAILY 次；
 * - 已登录：服务端计数，每日 QUOTA_USER_DAILY 次 + 分享赠送次数。
 */
export const useQuotaStore = defineStore('quota', () => {
  const auth = useAuthStore()
  const localUsage = ref<LocalUsage>(loadLocalUsage())
  /** 达到限额时打开的引导弹窗 */
  const limitDialogOpen = ref(false)

  const anonRemaining = computed(() => {
    const usage =
      localUsage.value.date === todayStr() ? localUsage.value : { date: todayStr(), used: 0 }
    return Math.max(0, QUOTA_ANON_DAILY - usage.used)
  })

  const remaining = computed(() =>
    auth.user ? auth.user.quota.remaining : anonRemaining.value,
  )
  const limit = computed(() => (auth.user ? auth.user.quota.limit : QUOTA_ANON_DAILY))

  function persistLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localUsage.value))
    } catch {
      // 隐私模式下静默失败
    }
  }

  /** 消耗一次无水印导出配额；失败时返回原因并打开引导弹窗 */
  async function tryConsume(): Promise<ConsumeResult> {
    if (auth.user) {
      try {
        const data = await apiFetch<{ used: number; limit: number; remaining: number }>(
          '/api/quota/consume',
          { method: 'POST' },
        )
        auth.user.quota.used = data.used
        auth.user.quota.limit = data.limit
        auth.user.quota.remaining = data.remaining
        return { ok: true }
      } catch (err) {
        if (err instanceof ApiError && err.status === 429) {
          await auth.refresh()
          limitDialogOpen.value = true
          return { ok: false, reason: 'user-limit' }
        }
        if (err instanceof ApiError && err.status === 401) {
          auth.user = null
          // 会话失效则退回未登录本地计数
        } else {
          // 接口异常（如离线）不阻塞导出：离线可用是产品承诺
          return { ok: true }
        }
      }
    }

    if (localUsage.value.date !== todayStr()) {
      localUsage.value = { date: todayStr(), used: 0 }
    }
    if (localUsage.value.used >= QUOTA_ANON_DAILY) {
      limitDialogOpen.value = true
      return { ok: false, reason: 'anon-limit' }
    }
    localUsage.value = { date: localUsage.value.date, used: localUsage.value.used + 1 }
    persistLocal()
    return { ok: true }
  }

  return {
    localUsage,
    limitDialogOpen,
    remaining,
    limit,
    anonRemaining,
    tryConsume,
  }
})
