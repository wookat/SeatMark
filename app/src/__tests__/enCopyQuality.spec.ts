/**
 * 第 348 轮：英文词典病句护栏。
 * - 译文不得出现嵌套括号 '((' / ') ('（如 '(signing up (free) raises it to'）；
 * - 分号后不得紧跟大写开头的普通词（拼接后会渲染成 '; Once restored'），专有名词/产品名除外；
 * - 教室座位表排把手 tooltip 使用带占位符的完整句词条，不再由 '第' / '排：' 碎片拼接。
 */
import { describe, expect, it } from 'vitest'

import { en } from '@/i18n/locales/en'

/** 分号后允许大写的专有名词 / 缩写 */
const PROPER_NOUNS = new Set([
  'Pro',
  'Team',
  'SeatMark',
  'Excel',
  'PDF',
  'PNG',
  'ZIP',
  'CSV',
  'TXT',
  'A3',
  'A4',
  'A5',
  'WeChat',
  'Studio',
  'Chrome',
  'Safari',
  'Firefox',
  'Edge',
  'Windows',
  'Mac',
  'iOS',
  'Android',
  'Word',
  'WPS',
  'ID',
  'QR',
  'URL',
  'ICP',
])

describe('第 348 轮：en.ts 译文病句护栏', () => {
  const entries = Object.entries(en)

  it('任一译文不含嵌套括号 "((" 或 ") ("', () => {
    const bad = entries.filter(([, v]) => /\(\(|\) \(/.test(v))
    expect(bad.map(([k]) => k)).toEqual([])
  })

  it('任一译文分号后不紧跟大写普通词（专有名词除外）', () => {
    const bad: string[] = []
    for (const [k, v] of entries) {
      for (const m of v.matchAll(/; ([A-Z][A-Za-z0-9]*)/g)) {
        if (!PROPER_NOUNS.has(m[1]!)) bad.push(`${k} → ${v}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('定价页与维护提示译文已修正', () => {
    expect(en['次（免费登录即升为每日']).toBe('(free sign-in raises it to')
    expect(en['恢复后可注册领取专业版试用。']).toMatch(/^once restored/)
    expect(en['账号服务维护中，恢复后可领取']).toBeTruthy()
  })

  it('排把手 tooltip 为带占位符的完整句，不再有 "第" / "排：" 碎片', () => {
    expect(en['第 {n} 排：点击或拖拽与另一排交换']).toBe('Row {n}: click or drag to swap with another row')
    expect(en).not.toHaveProperty('第')
    expect(en).not.toHaveProperty('排：')
    // 以「：」结尾且译文为 ': ' 的碎片词条只剩通用的「：」本身
    const fragments = entries.filter(([k, v]) => k.endsWith('：') && k !== '：' && v === ': ')
    expect(fragments.map(([k]) => k)).toEqual([])
  })
})
