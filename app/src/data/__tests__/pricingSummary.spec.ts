import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { PRICING_SUMMARY, PRO_ORIGINAL_PRICE, TEAM_ORIGINAL_PRICE } from '@/data/pricingSummary'
import { QUOTA_ANON_DAILY, QUOTA_USER_DAILY } from '@/stores/quota'

const STALE_BETA_COPY = /Beta 期间|3 次生成|每天 10 次/

describe('pricingSummary：配额与定价文案单一来源', () => {
  it('摘要含 quota.ts 的两个配额常量与既定定价', () => {
    expect(PRICING_SUMMARY).toContain(`未登录每天 ${QUOTA_ANON_DAILY} 次`)
    expect(PRICING_SUMMARY).toContain(`登录后每天 ${QUOTA_USER_DAILY} 次`)
    expect(PRO_ORIGINAL_PRICE).toBe('¥19')
    expect(TEAM_ORIGINAL_PRICE).toBe('¥49')
    expect(PRICING_SUMMARY).toContain('专业版原价 ¥19、团队版 ¥49，限时 0 折免费')
    expect(PRICING_SUMMARY).not.toMatch(STALE_BETA_COPY)
  })

  it('已构建的 llms.txt / llms-full.txt（若存在）次数与常量一致且无旧 Beta 文案', () => {
    const distDir = join(__dirname, '..', '..', '..', 'dist')
    for (const name of ['llms.txt', 'llms-full.txt']) {
      const file = join(distDir, name)
      if (!existsSync(file)) continue
      const text = readFileSync(file, 'utf-8')
      expect(text, name).toContain(`未登录每天 ${QUOTA_ANON_DAILY} 次`)
      expect(text, name).toContain(`登录后每天 ${QUOTA_USER_DAILY} 次`)
      expect(text, name).not.toMatch(STALE_BETA_COPY)
    }
  })
})
