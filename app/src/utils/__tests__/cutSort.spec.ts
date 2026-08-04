import { describe, expect, it } from 'vitest'

import type { DataRow } from '@/types/template'
import { stackOrderIndices, stackSortRows } from '@/utils/cutSort'

/** 模拟裁切：把版面序列按版位分摞，摞内按页序叠放，返回每摞的原始下标序列 */
function cutIntoStacks(slots: (number | null)[], perPage: number): number[][] {
  const pageCount = slots.length / perPage
  const stacks: number[][] = Array.from({ length: perPage }, () => [])
  for (let p = 0; p < pageCount; p++) {
    for (let s = 0; s < perPage; s++) {
      const v = slots[p * perPage + s]
      if (v != null) stacks[s]!.push(v)
    }
  }
  return stacks.filter((st) => st.length > 0)
}

describe('stackOrderIndices 摞优先重排', () => {
  it('整除场景：24 枚/页 × 3 页，裁切后每摞恰为连续区段', () => {
    const perPage = 24
    const total = 72
    const slots = stackOrderIndices(total, perPage)
    expect(slots).toHaveLength(72)
    const stacks = cutIntoStacks(slots, perPage)
    expect(stacks).toHaveLength(24)
    let expected = 0
    for (const stack of stacks) {
      for (const idx of stack) expect(idx).toBe(expected++)
    }
    expect(expected).toBe(total)
  })

  it('非整除场景：25 条数据 24 枚/页，空位在尾部版位且各摞仍连续', () => {
    const perPage = 24
    const total = 25
    const slots = stackOrderIndices(total, perPage)
    expect(slots).toHaveLength(48) // 2 页
    expect(slots.filter((v) => v != null)).toHaveLength(25)
    const stacks = cutIntoStacks(slots, perPage)
    let expected = 0
    for (const stack of stacks) {
      for (const idx of stack) expect(idx).toBe(expected++)
    }
    expect(expected).toBe(total)
  })

  it('每个下标恰好出现一次（无丢失无重复）', () => {
    const slots = stackOrderIndices(100, 21)
    const seen = slots.filter((v): v is number => v != null).sort((a, b) => a - b)
    expect(seen).toEqual(Array.from({ length: 100 }, (_, i) => i))
  })

  it('边界：total 或 perPage 非正时返回空数组', () => {
    expect(stackOrderIndices(0, 24)).toEqual([])
    expect(stackOrderIndices(10, 0)).toEqual([])
  })
})

describe('stackSortRows', () => {
  const makeRows = (n: number): DataRow[] =>
    Array.from({ length: n }, (_, i) => ({ 座位号: String(i + 1) }))

  it('单页数据不重排，原样返回', () => {
    const rows = makeRows(10)
    expect(stackSortRows(rows, 24)).toBe(rows)
  })

  it('多页数据重排后首页版位依次为各摞首张', () => {
    const rows = makeRows(48)
    const sorted = stackSortRows(rows, 24)
    expect(sorted).toHaveLength(48)
    // 页数 = 2，摞 s 的首张 = 原始下标 s * 2 → 首页版位 s 应为座位号 s*2+1
    expect(sorted[0]?.['座位号']).toBe('1')
    expect(sorted[1]?.['座位号']).toBe('3')
    expect(sorted[23]?.['座位号']).toBe('47')
    // 第二页版位 0 是摞 0 的第二张 = 座位号 2
    expect(sorted[24]?.['座位号']).toBe('2')
  })
})
