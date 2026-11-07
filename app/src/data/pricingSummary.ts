import { QUOTA_ANON_DAILY, QUOTA_USER_DAILY } from '@/stores/quota'

/** 专业版 / 团队版在售价格与原价（支付宝在线支付；与后端 PAY_PLANS 保持一致） */
export const PRO_PRICE = '¥5.9'
export const TEAM_PRICE = '¥19.9'
export const PRO_ORIGINAL_PRICE = '¥19'
export const TEAM_ORIGINAL_PRICE = '¥49'
/** 年度会员（含 1 款纸型模板定制服务） */
export const ANNUAL_PRICE = '¥199'

/**
 * 配额与定价一句话摘要（llms.txt / llms-full.txt 等运营文案的单一来源）：
 * 次数来自 stores/quota.ts，避免文案与实际配额漂移。
 */
export const PRICING_SUMMARY = `带水印导出与打印不限次；无水印导出未登录每天 ${QUOTA_ANON_DAILY} 次、登录后每天 ${QUOTA_USER_DAILY} 次；专业版 ${PRO_PRICE}/30 天（原价 ${PRO_ORIGINAL_PRICE}）、团队版 ${TEAM_PRICE}/30 天（原价 ${TEAM_ORIGINAL_PRICE}），支持支付宝在线支付；年度会员 ${ANNUAL_PRICE}/365 天（含 1 款纸型模板定制），另有纸型售卖与定制服务`
