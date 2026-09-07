import { computed, type ComputedRef } from 'vue'

import { QUOTA_USER_DAILY } from '@/stores/quota'

export interface QuotaBadge {
  text: string
  cls: string
}

export interface QuotaBadgeSource {
  /** 今日剩余无水印次数 */
  remaining: number
  /** 今日无水印上限 */
  limit: number
}

export interface QuotaBadgeAuth {
  isLoggedIn: boolean
}

export interface QuotaBadgeResult {
  badge: ComputedRef<QuotaBadge>
  title: ComputedRef<string>
}

/**
 * 导出按钮角标（工坊 / 排座 / 宴会共用同一口径）：
 * 额度 > 0 时正向展示「今日剩余 n 次」（与导出弹窗一致），用完后不展示刺眼的 0，
 * 改为强调「带水印导出永远免费、不限次数」；title 补充登录后的每日额度。
 */
export function useQuotaBadge(
  quota: QuotaBadgeSource,
  auth: QuotaBadgeAuth,
  t: (key: string) => string,
): QuotaBadgeResult {
  const badge = computed<QuotaBadge>(() =>
    quota.remaining > 0
      ? { text: `${t('今日剩余')} ${quota.remaining} ${t('次')}`, cls: 'bg-emerald-100 text-emerald-700' }
      : { text: t('带水印免费'), cls: 'bg-sky-100 text-sky-700' },
  )
  const title = computed(
    () =>
      `${t('带水印导出永远免费、不限次数；无水印今日剩余')} ${quota.remaining}/${quota.limit} ${t('次')}${
        auth.isLoggedIn ? '' : `${t('，免费登录后每天')} ${QUOTA_USER_DAILY} ${t('次')}`
      }`,
  )
  return { badge, title }
}
