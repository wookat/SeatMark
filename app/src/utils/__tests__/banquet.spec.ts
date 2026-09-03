import { describe, expect, it } from 'vitest'

import {
  autoAssignGuests,
  buildVenuePreset,
  findOverlaps,
  parseBanquetGuests,
  splitGroups,
  summarizeBanquet,
  validateBanquet,
  type BanquetGroup,
  type BanquetGuest,
  type BanquetTable,
} from '../banquet'

function table(id: string, seats: number, pos?: Partial<BanquetTable>): BanquetTable {
  return {
    id,
    name: id,
    shape: 'round',
    x: 0,
    y: 0,
    width: 60,
    height: 60,
    seats,
    guestIds: [],
    ...pos,
  }
}

function guest(id: string, groupId: string | null = null): BanquetGuest {
  return { id, name: id, groupId }
}

describe('parseBanquetGuests', () => {
  it('逐行解析并保序', () => {
    expect(parseBanquetGuests('张伟\n李娜\n王芳').names).toEqual(['张伟', '李娜', '王芳'])
  })

  it('同一行支持逗号/顿号/分号/制表符分隔', () => {
    expect(parseBanquetGuests('张伟,李娜、王芳；赵强\t钱进').names).toEqual([
      '张伟',
      '李娜',
      '王芳',
      '赵强',
      '钱进',
    ])
  })

  it('自动去重并报告重复项', () => {
    const { names, duplicates } = parseBanquetGuests('张伟\n李娜\n张伟\n张伟\n王芳')
    expect(names).toEqual(['张伟', '李娜', '王芳'])
    expect(duplicates).toEqual(['张伟', '张伟'])
  })

  it('西文全名不按空格拆分', () => {
    expect(parseBanquetGuests('Alice Wang\nBob Smith, Carol Lee\n张伟 李娜').names).toEqual([
      'Alice Wang',
      'Bob Smith',
      'Carol Lee',
      '张伟',
      '李娜',
    ])
  })

  it('忽略空行、全角空格与不可见字符', () => {
    expect(parseBanquetGuests('\n　张伟 \u200b\n\n 李娜\u00a0\n').names).toEqual(['张伟', '李娜'])
  })
})

describe('autoAssignGuests', () => {
  it('同组整组放入剩余座位最合适的桌（best-fit）', () => {
    const tables = [table('A', 10), table('B', 4)]
    const guests = [guest('g1', 'x'), guest('g2', 'x'), guest('g3', 'x')]
    const out = autoAssignGuests(guests, tables)
    expect(out.get('B')).toEqual(['g1', 'g2', 'g3'])
    expect(out.get('A')).toEqual([])
  })

  it('大组优先分配，未分组宾客排最后', () => {
    const tables = [table('A', 4), table('B', 4)]
    const guests = [
      guest('solo', null),
      guest('b1', 'b'),
      guest('a1', 'a'),
      guest('a2', 'a'),
      guest('a3', 'a'),
      guest('b2', 'b'),
    ]
    const out = autoAssignGuests(guests, tables)
    // a 组 3 人最大，best-fit 进 A；b 组 2 人进 B；solo 补进 A 剩位
    expect(out.get('A')).toEqual(['a1', 'a2', 'a3', 'solo'])
    expect(out.get('B')).toEqual(['b1', 'b2'])
  })

  it('整组放不下时按剩余座位从多到少拆分', () => {
    const tables = [table('A', 3), table('B', 2)]
    const guests = ['g1', 'g2', 'g3', 'g4'].map((id) => guest(id, 'x'))
    const out = autoAssignGuests(guests, tables)
    expect(out.get('A')).toEqual(['g1', 'g2', 'g3'])
    expect(out.get('B')).toEqual(['g4'])
  })

  it('所有桌满后剩余宾客保持未安排', () => {
    const tables = [table('A', 2)]
    const guests = ['g1', 'g2', 'g3'].map((id) => guest(id))
    const out = autoAssignGuests(guests, tables)
    expect(out.get('A')).toEqual(['g1', 'g2'])
  })
})

describe('findOverlaps', () => {
  it('检测包围盒相交', () => {
    const items = [
      { id: 'a', x: 0, y: 0, width: 60, height: 60 },
      { id: 'b', x: 50, y: 50, width: 60, height: 60 },
      { id: 'c', x: 200, y: 0, width: 60, height: 60 },
    ]
    expect(findOverlaps(items)).toEqual([['a', 'b']])
  })

  it('恰好相邻（边界相切）不算重叠', () => {
    const items = [
      { id: 'a', x: 0, y: 0, width: 60, height: 60 },
      { id: 'b', x: 60, y: 0, width: 60, height: 60 },
    ]
    expect(findOverlaps(items)).toEqual([])
  })
})

describe('validateBanquet', () => {
  it('汇总未安排宾客、空桌、重叠与超员', () => {
    const t1 = table('A', 2, { x: 0, y: 0 })
    const t2 = table('B', 4, { x: 30, y: 30 })
    const t3 = table('C', 4, { x: 300, y: 0 })
    t1.guestIds = ['g1', 'g2', 'g3']
    const guests = ['g1', 'g2', 'g3', 'g4'].map((id) => guest(id))
    const issues = validateBanquet(guests, [t1, t2, t3])
    expect(issues.unassigned).toEqual(['g4'])
    expect(issues.emptyTables).toEqual(['B', 'C'])
    expect(issues.overlaps).toEqual([['A', 'B']])
    expect(issues.overCapacity).toEqual(['A'])
  })
})

describe('splitGroups', () => {
  const groups: BanquetGroup[] = [
    { id: 'gA', name: '男方亲友', color: '#000' },
    { id: 'gB', name: '同事', color: '#111' },
  ]

  it('同组全部同桌 → 0', () => {
    const t1 = table('A', 4)
    const t2 = table('B', 4)
    t1.guestIds = ['g1', 'g2']
    t2.guestIds = ['g3', 'g4']
    const guests = [guest('g1', 'gA'), guest('g2', 'gA'), guest('g3', 'gB'), guest('g4', 'gB')]
    expect(splitGroups(guests, [t1, t2], groups)).toEqual([])
  })

  it('同组跨两桌 → 1，并给出桌数与桌名', () => {
    const t1 = table('A', 4)
    const t2 = table('B', 4)
    t1.guestIds = ['g1', 'g3']
    t2.guestIds = ['g2', 'g4']
    const guests = [guest('g1', 'gA'), guest('g2', 'gA'), guest('g3', 'gB'), guest('g4', null)]
    const split = splitGroups(guests, [t1, t2], groups)
    expect(split).toHaveLength(1)
    expect(split[0]).toMatchObject({ groupId: 'gA', groupName: '男方亲友', tableCount: 2 })
    expect(split[0]!.tableNames.sort()).toEqual(['A', 'B'])
  })

  it('未分组宾客与未安排宾客不计入拆分', () => {
    const t1 = table('A', 4)
    const t2 = table('B', 4)
    t1.guestIds = ['g1']
    t2.guestIds = ['g2']
    const guests = [guest('g1', null), guest('g2', null), guest('g3', 'gA'), guest('g4', 'gA')]
    expect(splitGroups(guests, [t1, t2], groups)).toEqual([])
  })
})

describe('summarizeBanquet', () => {
  it('给出已安排/总数、空桌、拆分分组、未安排四个数字', () => {
    const groups: BanquetGroup[] = [{ id: 'gA', name: 'A', color: '#000' }]
    const t1 = table('A', 2)
    const t2 = table('B', 2)
    const t3 = table('C', 2)
    t1.guestIds = ['g1']
    t2.guestIds = ['g2']
    const guests = [guest('g1', 'gA'), guest('g2', 'gA'), guest('g3', null)]
    expect(summarizeBanquet(guests, [t1, t2, t3], groups)).toEqual({
      assigned: 2,
      total: 3,
      emptyTables: 1,
      splitGroups: 1,
      unassigned: 1,
    })
  })
})

describe('buildVenuePreset', () => {
  it('每种预设都生成桌位且不重叠', () => {
    for (const preset of ['round', 'long', 'head', 'ushape', 'classroom'] as const) {
      const tables = buildVenuePreset(preset)
      expect(tables.length).toBeGreaterThan(0)
      expect(findOverlaps(tables)).toEqual([])
    }
  })
})
