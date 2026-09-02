import { QUOTA_ANON_DAILY, QUOTA_USER_DAILY } from '@/stores/quota'

/**
 * llms-full.txt 的「收费吗」问答：配额数字从 stores/quota.ts 单一来源拼接，
 * 避免预渲染脚本里的硬编码与实际配额漂移。
 */
export function quotaFaqAnswer(siteOrigin: string): string {
  return (
    `限时 0 折免费（专业版原价 ¥19、团队版 ¥49）。带水印导出与打印不限次数；` +
    `无水印导出未登录每天 ${QUOTA_ANON_DAILY} 次、登录后每天 ${QUOTA_USER_DAILY} 次，分享链接被点开可再得次数。` +
    `详见 ${siteOrigin}/pricing`
  )
}
