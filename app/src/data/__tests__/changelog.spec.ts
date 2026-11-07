import { describe, expect, it } from 'vitest'

import { CHANGELOG_ENTRY_COUNT, changelogDays } from '@/data/changelog'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const KINDS = new Set(['feature', 'fix', 'improve'])

describe('changelog（更新记录页数据）', () => {
  it('包含分组记录且按日期倒序排列', () => {
    expect(changelogDays.length).toBeGreaterThan(0)
    const dates = changelogDays.map((d) => d.date)
    expect(dates).toEqual([...dates].sort().reverse())
  })

  it('每条记录有合法类型、非空标题与提交短哈希', () => {
    for (const day of changelogDays) {
      expect(day.date).toMatch(ISO_DATE_RE)
      expect(day.entries.length).toBeGreaterThan(0)
      for (const entry of day.entries) {
        expect(KINDS.has(entry.kind)).toBe(true)
        expect(entry.text.length).toBeGreaterThan(0)
        expect(entry.hash).toMatch(/^[0-9a-f]{7,}$/)
      }
    }
  })

  it('计数常量与实际条数一致', () => {
    const total = changelogDays.reduce((n, d) => n + d.entries.length, 0)
    expect(CHANGELOG_ENTRY_COUNT).toBe(total)
  })
})
