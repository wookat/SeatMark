/**
 * 空位散布（emptyLast）：指定格移到填充序末尾——容量不变、座号连续，
 * 人数不足时这些格成为散布的空位；超员时仍按末位入座，不留洞。
 */
import { describe, expect, it } from 'vitest'

import { buildSeats, seatCapacity, type SeatShape } from '@/utils/seating'

const names = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `S${i + 1}` }))

describe('seatShape.emptyLast（空位散布）', () => {
  it('不减少容量：emptyLast 格仍计入可坐数', () => {
    const shape: SeatShape = { emptyLast: new Set(['1,1', '3,3']) }
    expect(seatCapacity(3, 3, 'none', 0, shape)).toBe(9)
    expect(seatCapacity(3, 3, 'none', 9, shape)).toBe(9)
  })

  it('人数不足时指定格空出，其余格照常顺序坐', () => {
    const shape: SeatShape = { emptyLast: new Set(['1,1', '2,2']) }
    const seats = buildSeats(names(7), 3, 3, 'rows', 'none', 7, shape)
    // 9 格 - 2 散布空位 = 7 人入座；空位格的座号排在填充序末尾
    expect(seats.filter((s) => s.name)).toHaveLength(7)
    const c11 = seats.find((s) => s.row === 1 && s.col === 1)!
    const c22 = seats.find((s) => s.row === 2 && s.col === 2)!
    expect(c11.name).toBe('')
    expect(c22.name).toBe('')
    expect(c11.seatNo).toBeGreaterThan(7)
    expect(c22.seatNo).toBeGreaterThan(7)
  })

  it('超员时 emptyLast 格仍按末位入座（容量不缩水）', () => {
    const shape: SeatShape = { emptyLast: new Set(['1,1']) }
    const seats = buildSeats(names(9), 3, 3, 'rows', 'none', 9, shape)
    const corner = seats.find((s) => s.row === 1 && s.col === 1)
    expect(corner?.name).toBe('S9')
  })

  it('与禁用格正交：禁用格不算容量，emptyLast 格算', () => {
    const shape: SeatShape = { disabled: new Set(['1,1']), emptyLast: new Set(['2,2']) }
    expect(seatCapacity(3, 3, 'none', 0, shape)).toBe(8)
    const seats = buildSeats(names(7), 3, 3, 'rows', 'none', 7, shape)
    expect(seats.find((s) => s.row === 2 && s.col === 2)?.name).toBe('')
  })

  it('列蛇形填充序下 emptyLast 排到该走位末尾', () => {
    const shape: SeatShape = { emptyLast: new Set(['1,1']) }
    const seats = buildSeats(names(3), 2, 2, 'colSnake', 'none', 3, shape)
    // colSnake: (0,0)→(1,0)→(0,1)→(1,1)；(1,1) 位被推到末尾 → 前 3 个坐其余格
    const s11 = seats.find((s) => s.row === 1 && s.col === 1)
    expect(s11?.name).toBe('')
    expect(seats.filter((s) => s.name)).toHaveLength(3)
  })
})
