import { QUOTA_ANON_DAILY, QUOTA_USER_DAILY } from '@/stores/quota'

/** 专业版 / 团队版原价（限时 0 折免费，不接入真实支付） */
export const PRO_ORIGINAL_PRICE = '¥19'
export const TEAM_ORIGINAL_PRICE = '¥49'

/**
 * 配额与定价一句话摘要（llms.txt / llms-full.txt 等运营文案的单一来源）：
 * 次数来自 stores/quota.ts，避免文案与实际配额漂移。
 */
export const PRICING_SUMMARY = `带水印导出与打印不限次；无水印导出未登录每天 ${QUOTA_ANON_DAILY} 次、登录后每天 ${QUOTA_USER_DAILY} 次；专业版原价 ${PRO_ORIGINAL_PRICE}、团队版 ${TEAM_ORIGINAL_PRICE}，限时 0 折免费`
