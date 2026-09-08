import { describe, expect, it } from 'vitest'

import { parseLabelRange } from '../labelRange'

describe('第 365 轮：parseLabelRange（PNG 逐张导出范围）', () => {
  it('空白 = 全部（indices 为 null）', () => {
    expect(parseLabelRange('', 26)).toEqual({ ok: true, indices: null })
    expect(parseLabelRange('   ', 26)).toEqual({ ok: true, indices: null })
  })

  it('单张「5」→ [4]；「1-3,10」→ [0,1,2,9]；「3-」→ 3 到末尾', () => {
    expect(parseLabelRange('5', 26)).toEqual({ ok: true, indices: [4] })
    expect(parseLabelRange('1-3,10', 26)).toEqual({ ok: true, indices: [0, 1, 2, 9] })
    expect(parseLabelRange('3-', 5)).toEqual({ ok: true, indices: [2, 3, 4] })
    expect(parseLabelRange('26', 26)).toEqual({ ok: true, indices: [25] })
  })

  it('有序去重：「10,1-3,2,3」→ [0,1,2,9]；中文逗号 / 顿号 / 空格 / ～ 均可作分隔或范围符', () => {
    expect(parseLabelRange('10,1-3,2,3', 26)).toEqual({ ok: true, indices: [0, 1, 2, 9] })
    expect(parseLabelRange('1，3、5 7', 26)).toEqual({ ok: true, indices: [0, 2, 4, 6] })
    expect(parseLabelRange('2～4', 26)).toEqual({ ok: true, indices: [1, 2, 3] })
  })

  it('超界：「30」「0」「20-30」（总数 26）→ out-of-range', () => {
    expect(parseLabelRange('30', 26)).toEqual({ ok: false, error: 'out-of-range' })
    expect(parseLabelRange('0', 26)).toEqual({ ok: false, error: 'out-of-range' })
    expect(parseLabelRange('20-30', 26)).toEqual({ ok: false, error: 'out-of-range' })
    expect(parseLabelRange('1,27', 26)).toEqual({ ok: false, error: 'out-of-range' })
  })

  it('非法：「abc」「1-2-3」「-」「5-3」「1.5」→ invalid；总数 0 → empty-total', () => {
    expect(parseLabelRange('abc', 26)).toEqual({ ok: false, error: 'invalid' })
    expect(parseLabelRange('1-2-3', 26)).toEqual({ ok: false, error: 'invalid' })
    expect(parseLabelRange('-', 26)).toEqual({ ok: false, error: 'invalid' })
    expect(parseLabelRange('5-3', 26)).toEqual({ ok: false, error: 'invalid' })
    expect(parseLabelRange('1.5', 26)).toEqual({ ok: false, error: 'invalid' })
    expect(parseLabelRange('3,abc', 26)).toEqual({ ok: false, error: 'invalid' })
    expect(parseLabelRange('1', 0)).toEqual({ ok: false, error: 'empty-total' })
  })
})
