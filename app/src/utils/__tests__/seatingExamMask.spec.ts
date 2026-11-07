import { describe, expect, it } from 'vitest'

import {
  applyManualOrder,
  autoAisles,
  buildSeats,
  EXAM_LAYOUT_PRESETS,
  fillCells,
  maskKey,
  parseSeatingRosterDetailed,
  podiumSeatsOf,
  seatCapacity,
  sortExamEntries,
  unseatedEntries,
  type SeatingEntry,
} from '../seating'

const names = (n: number): SeatingEntry[] =>
  Array.from({ length: n }, (_, i) => ({ name: `学生${i + 1}` }))

describe('fillCells：四种填充顺序的物理格展开', () => {
  it('rows：按排从左到右', () => {
    expect(fillCells(2, 3, 'rows').slice(0, 4)).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
    ])
  })
  it('serpentine：偶数排从右向左', () => {
    expect(fillCells(2, 3, 'serpentine').slice(3)).toEqual([
      [1, 2],
      [1, 1],
      [1, 0],
    ])
  })
  it('cols：逐列从上到下', () => {
    expect(fillCells(3, 2, 'cols')).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ])
  })
  it('colSnake：偶数列从下到上（考场主流走位）', () => {
    expect(fillCells(3, 2, 'colSnake')).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
      [1, 1],
      [0, 1],
    ])
  })
})

describe('buildSeats：列序与列蛇形填充', () => {
  it('colSnake 30 人 5×6：第 1 列 1-6 自上而下，第 2 列 7-12 自下而上', () => {
    const seats = buildSeats(names(30), 6, 5, 'colSnake')
    const at = (r: number, c: number) => seats.find((s) => s.row === r && s.col === c)
    expect(at(1, 1)?.seatNo).toBe(1)
    expect(at(6, 1)?.seatNo).toBe(6)
    expect(at(6, 2)?.seatNo).toBe(7)
    expect(at(1, 2)?.seatNo).toBe(12)
    expect(at(1, 3)?.seatNo).toBe(13)
  })
  it('cols：第 1 列排满再第 2 列', () => {
    const seats = buildSeats(names(6), 3, 2, 'cols')
    const at = (r: number, c: number) => seats.find((s) => s.row === r && s.col === c)
    expect(at(3, 1)?.seatNo).toBe(3)
    expect(at(1, 2)?.seatNo).toBe(4)
  })
})

describe('座位形状：禁用格（不规则形状）', () => {
  it('禁用格不产生座位，座位号连续跳过', () => {
    const shape = { disabled: new Set([maskKey(1, 2)]) }
    const seats = buildSeats(names(5), 2, 3, 'rows', 'none', 5, shape)
    expect(seats.length).toBe(5)
    expect(seats.find((s) => s.row === 1 && s.col === 2)).toBeUndefined()
    expect(seats.map((s) => s.seatNo)).toEqual([1, 2, 3, 4, 5])
  })
  it('7788：4 列 8 排末排只坐两列，容量 30', () => {
    const shape = { disabled: new Set(['8,1', '8,2']) }
    expect(seatCapacity(8, 4, 'none', 0, shape)).toBe(30)
    const seats = buildSeats(names(30), 8, 4, 'colSnake', 'none', 30, shape)
    expect(seats.filter((s) => s.row === 8).map((s) => s.col)).toEqual([3, 4])
  })
  it('禁用格与间隔正交：隔位在可用格上计算', () => {
    const shape = { disabled: new Set([maskKey(1, 1)]) }
    expect(seatCapacity(2, 3, 'skipCol', 0, shape)).toBe(
      // 可坐格：列 2、4 位（0 起奇数列）；8 格外框禁 1 格后列 2 可坐 2 格
      2,
    )
  })
  it('溢出按自定义容量计算', () => {
    const shape = { disabled: new Set([maskKey(1, 1), maskKey(1, 2), maskKey(1, 3)]) }
    expect(unseatedEntries(names(5), 2, 3, 'none', 5, shape).length).toBe(2)
  })
})

describe('座位形状：讲台排（护法位）', () => {
  it('讲台排座位接在座位号末尾，按列升序', () => {
    const shape = { podium: new Set([1, 3]) }
    const seats = buildSeats(names(8), 2, 3, 'rows', 'none', 8, shape)
    expect(seats.length).toBe(8)
    const podium = podiumSeatsOf(seats)
    expect(podium.map((s) => [s.row, s.col])).toEqual([
      [0, 1],
      [0, 3],
    ])
    expect(podium.map((s) => s.seatNo)).toEqual([7, 8])
  })
  it('讲台排计入容量，越界列忽略', () => {
    // cols=3：列 6、99 越界不计，仅列 1 生效
    expect(seatCapacity(2, 3, 'none', 0, { podium: new Set([1, 6, 99]) })).toBe(6 + 1)
  })
})

describe('名单解析：考号 / 成绩列', () => {
  const text = '姓名\t考号\t成绩\n张三\t101\t88\n李四\t102\t95\n王五\t103\t76'
  it('识别考号与成绩列并填充 entry', () => {
    const r = parseSeatingRosterDetailed(text)
    expect(r.orderColumn).toBe(true)
    expect(r.scoreColumn).toBe(true)
    expect(r.entries[0]).toMatchObject({ name: '张三', orderNo: '101', score: 88 })
    expect(r.entries[2]?.score).toBe(76)
    expect(r.ignoredColumns).toEqual([])
  })
  it('无表头时仍按逐行/列模式姓名解析，不猜考号列', () => {
    const r = parseSeatingRosterDetailed('张三\n李四')
    expect(r.orderColumn).toBe(false)
    expect(r.scoreColumn).toBe(false)
  })
})

describe('sortExamEntries：考试排序规则', () => {
  const roster: SeatingEntry[] = [
    { name: '甲', orderNo: '103', score: 70 },
    { name: '乙', orderNo: '101', score: 95 },
    { name: '丙', score: 95 },
    { name: '丁', orderNo: '102' },
  ]
  it('order：有考号按考号升序，无考号按原序沉底', () => {
    expect(sortExamEntries(roster, 'order').map((e) => e.orderNo)).toEqual([
      '101',
      '102',
      '103',
      undefined,
    ])
  })
  it('score：成绩高到低，无成绩沉底', () => {
    const sorted = sortExamEntries(roster, 'score')
    expect(sorted[0]?.score).toBe(95)
    expect(sorted[1]?.score).toBe(95)
    expect(sorted[2]?.score).toBe(70)
    expect(sorted[3]?.score).toBeUndefined()
  })
  it('roster：原序；random：集合不变、顺序可注入随机源验证', () => {
    expect(sortExamEntries(roster, 'roster').map((e) => e.name)).toEqual(['甲', '乙', '丙', '丁'])
    const shuffled = sortExamEntries(roster, 'random', () => 0.5)
    expect(shuffled.map((e) => e.name).sort()).toEqual(['丁', '丙', '乙', '甲'])
  })
})

describe('applyManualOrder：手动顺序名单', () => {
  const roster: SeatingEntry[] = [
    { name: '甲', orderNo: '101' },
    { name: '乙', orderNo: '102' },
    { name: '丙', orderNo: '103' },
    { name: '丁' },
  ]
  it('按给定考号序重排，未列出按原序沉底', () => {
    const out = applyManualOrder(roster, ['103', '101'])
    expect(out.map((e) => e.orderNo)).toEqual(['103', '101', '102', undefined])
  })
  it('也支持姓名顺序名单', () => {
    const out = applyManualOrder(roster, ['丁', '乙'])
    expect(out.map((e) => e.name)).toEqual(['丁', '乙', '甲', '丙'])
  })
  it('空名单原样返回', () => {
    expect(applyManualOrder(roster, []).map((e) => e.name)).toEqual(['甲', '乙', '丙', '丁'])
  })
})

describe('autoAisles：联排分组自动过道', () => {
  it('2 人联排 8 列 → 第 2/4/6 列后', () => {
    expect([...autoAisles(8, 2)].sort((a, b) => a - b)).toEqual([2, 4, 6])
  })
  it('3 人联排 9 列 → 第 3/6 列后；末尾不留过道', () => {
    expect([...autoAisles(9, 3)].sort((a, b) => a - b)).toEqual([3, 6])
  })
  it('groupSize < 1 或 ≥ 列数 → 空集', () => {
    expect(autoAisles(8, 0).size).toBe(0)
    expect(autoAisles(3, 4).size).toBe(0)
  })
})

describe('EXAM_LAYOUT_PRESETS：考场布局预设可落地', () => {
  it.each(EXAM_LAYOUT_PRESETS.map((p) => [p.id, p] as const))('%s 容量正确', (_id, p) => {
    const shape = { disabled: new Set(p.disabled) }
    const cap = seatCapacity(p.rows, p.cols, p.spacing, 0, shape)
    const seats = buildSeats(names(cap), p.rows, p.cols, p.fillOrder, p.spacing, cap, shape)
    expect(seats.length).toBe(cap)
    expect(new Set(seats.map((s) => `${s.row},${s.col}`)).size).toBe(cap)
    if (_id === 'exam30_5x6') expect(cap).toBe(30)
    if (_id === 'exam30_7788') expect(cap).toBe(30)
    if (_id === 'exam15_gap') expect(cap).toBe(15)
  })
})
