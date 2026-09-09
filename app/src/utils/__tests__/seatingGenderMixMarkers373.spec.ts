/**
 * 第 373 轮：summarizeGenderMix 返回同性相邻座位下标（adjacentSameSeats），供预览虚线标记。
 * 原字段（boys / girls / unknown / surplus / adjacentSamePairs）保持兼容。
 */
import { describe, expect, it } from 'vitest'

import { interleaveByGender, summarizeGenderMix, type SeatingEntry } from '../seating'

function make(boys: number, girls: number, unknown = 0): SeatingEntry[] {
  const out: SeatingEntry[] = []
  for (let i = 0; i < boys; i++) out.push({ name: `男${i}`, gender: '男' })
  for (let i = 0; i < girls; i++) out.push({ name: `女${i}`, gender: '女' })
  for (let i = 0; i < unknown; i++) out.push({ name: `无${i}` })
  return out
}
const keepOrder = () => 0

describe('第 373 轮：summarizeGenderMix.adjacentSameSeats', () => {
  it('男 26 / 女 22 混排：末尾 4 座（下标 44–47）同性相邻，对数 3', () => {
    const arranged = interleaveByGender(make(26, 22), keepOrder)
    const s = summarizeGenderMix(arranged)
    expect(s).toMatchObject({ boys: 26, girls: 22, surplus: 4, adjacentSamePairs: 3 })
    expect(s.adjacentSameSeats).toEqual([44, 45, 46, 47])
    expect(arranged.slice(44).every((e) => e.gender === '男')).toBe(true)
  })

  it('完全交替 → 空数组；空名单 → 空数组', () => {
    expect(summarizeGenderMix(interleaveByGender(make(10, 10), keepOrder)).adjacentSameSeats).toEqual([])
    expect(summarizeGenderMix([]).adjacentSameSeats).toEqual([])
  })

  it('中段同性相邻只标记涉及的两座；未识别性别不参与；下标升序去重', () => {
    const list: SeatingEntry[] = [
      { name: 'a', gender: '男' },
      { name: 'b', gender: '女' },
      { name: 'c', gender: '女' },
      { name: 'd', gender: '男' },
      { name: 'e' },
      { name: 'f' },
      { name: 'g', gender: '男' },
      { name: 'h', gender: '男' },
      { name: 'i', gender: '男' },
    ]
    const s = summarizeGenderMix(list)
    expect(s.adjacentSamePairs).toBe(3)
    expect(s.adjacentSameSeats).toEqual([1, 2, 6, 7, 8])
    expect(s.unknown).toBe(2)
  })

  it('点选互换后重算：把末尾多出的男生换到前排女生位置，相邻同性座位随之变化', () => {
    const arranged = interleaveByGender(make(26, 22), keepOrder)
    const work = [...arranged]
    // 座位 1（女）与座位 48（男）互换 → 开头变成 男男，末尾变成 男男男女
    ;[work[1], work[47]] = [work[47]!, work[1]!]
    const s = summarizeGenderMix(work)
    expect(s.adjacentSameSeats).toEqual([0, 1, 2, 44, 45, 46])
    expect(s.adjacentSamePairs).toBe(4)
  })
})
