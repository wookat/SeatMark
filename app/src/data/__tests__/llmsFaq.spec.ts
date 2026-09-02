import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { quotaFaqAnswer } from '@/data/llmsFaq'
import { QUOTA_ANON_DAILY, QUOTA_USER_DAILY } from '@/stores/quota'

const here = dirname(fileURLToPath(import.meta.url))

describe('llms-full 配额文案与 quota store 单一来源', () => {
  it('quotaFaqAnswer 包含当前配额常量', () => {
    const text = quotaFaqAnswer('https://www.seatmark.cn')
    expect(text).toContain(`未登录每天 ${QUOTA_ANON_DAILY} 次`)
    expect(text).toContain(`登录后每天 ${QUOTA_USER_DAILY} 次`)
    expect(text).toContain('https://www.seatmark.cn/pricing')
    expect(text).not.toMatch(/每天 10 次/)
  })

  it('prerender 脚本通过 quotaFaqAnswer 生成配额 FAQ，不再硬编码数字', () => {
    const script = readFileSync(join(here, '../../../scripts/prerender.mjs'), 'utf8')
    expect(script).toContain('quotaFaqAnswer(SITE_ORIGIN)')
    expect(script).not.toMatch(/每天 \d+ 次生成/)
  })
})
