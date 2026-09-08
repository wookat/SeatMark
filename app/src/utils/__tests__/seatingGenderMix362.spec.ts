import { describe, expect, it } from 'vitest'

import { interleaveByGender, summarizeGenderMix, type SeatingEntry } from '../seating'

function make(boys: number, girls: number, unknown = 0): SeatingEntry[] {
  const out: SeatingEntry[] = []
  for (let i = 0; i < boys; i++) out.push({ name: `男${i + 1}`, gender: '男' })
  for (let i = 0; i < girls; i++) out.push({ name: `女${i + 1}`, gender: '女' })
  for (let i = 0; i < unknown; i++) out.push({ name: `未${i + 1}` })
  return out
}

/** 确定性 rand：保持原顺序 */
const keepOrder = () => 0

describe('第 362 轮：summarizeGenderMix 混排结果摘要', () => {
  it('男女平衡：无多出、无相邻同性', () => {
    const arranged = interleaveByGender(make(12, 12), keepOrder)
    expect(summarizeGenderMix(arranged)).toEqual({
      boys: 12,
      girls: 12,
      unknown: 0,
      surplus: 0,
      adjacentSamePairs: 0,
    })
  })

  it('男 18 / 女 12：男多 6 位，末尾 6 座连续同性 = 5 对相邻', () => {
    const arranged = interleaveByGender(make(18, 12), keepOrder)
    expect(summarizeGenderMix(arranged)).toEqual({
      boys: 18,
      girls: 12,
      unknown: 0,
      surplus: 6,
      adjacentSamePairs: 5,
    })
    // 多出的同性确实排在末尾
    expect(arranged.slice(-6).every((e) => e.gender === '男')).toBe(true)
    expect(arranged.at(-7)?.gender).toBe('女')
  })

  it('女多且含未识别性别：未识别不计入相邻同性对，排在最末', () => {
    const arranged = interleaveByGender(make(10, 13, 2), keepOrder)
    expect(summarizeGenderMix(arranged)).toEqual({
      boys: 10,
      girls: 13,
      unknown: 2,
      surplus: 3,
      adjacentSamePairs: 2,
    })
    expect(arranged.slice(-2).every((e) => !e.gender)).toBe(true)
  })

  it('空名单返回全 0', () => {
    expect(summarizeGenderMix([])).toEqual({
      boys: 0,
      girls: 0,
      unknown: 0,
      surplus: 0,
      adjacentSamePairs: 0,
    })
  })
})
