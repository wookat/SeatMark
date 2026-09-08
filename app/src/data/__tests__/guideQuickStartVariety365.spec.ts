/**
 * 第 365 轮：quickStart 尾注去逐字重复。
 * 原 52 处同一句尾注按类目改为变体：不同文本 ≥ 4 种，任一种 ≤ 总数 40%，
 * 旧尾注逐字串 0 命中，且每条都保留「名单在浏览器本地」的事实锚点。
 */
import { describe, expect, it } from 'vitest'

import { guides } from '@/data/guides'

const LEGACY_NOTE = '先看成品效果，再换成自己的名单；免费、无需注册，名单不出浏览器'

describe('第 365 轮：教程 quickStart 尾注变体分布', () => {
  const notes = guides.map((g) => g.quickStart?.note).filter((n): n is string => !!n)

  it('旧尾注逐字串 0 命中', () => {
    expect(notes.filter((n) => n === LEGACY_NOTE)).toHaveLength(0)
  })

  it('不同尾注 ≥ 4 种，且任一种不超过总数的 40%', () => {
    const counts = new Map<string, number>()
    for (const n of notes) counts.set(n, (counts.get(n) ?? 0) + 1)
    expect(counts.size).toBeGreaterThanOrEqual(4)
    const max = Math.max(...counts.values())
    expect(max / notes.length).toBeLessThanOrEqual(0.4)
  })

  it('第 368 轮：同一句尾注复用 ≤ 4 篇', () => {
    const counts = new Map<string, number>()
    for (const n of notes) counts.set(n, (counts.get(n) ?? 0) + 1)
    const overused = [...counts.entries()].filter(([, c]) => c > 4)
    expect(overused).toEqual([])
  })

  it('本轮替换的变体保留本地处理事实锚点；全部尾注无感叹号与禁词', () => {
    const replaced = notes.filter((n) => /先看|先用|演示名单/.test(n) && /名单/.test(n))
    expect(replaced.length).toBeGreaterThanOrEqual(52)
    for (const n of replaced) expect(n).toMatch(/浏览器/)
    for (const n of notes) {
      expect(n).not.toMatch(/[!！]/)
      expect(n).not.toMatch(/赋能|极致|颠覆|一站式/)
    }
  })
})
