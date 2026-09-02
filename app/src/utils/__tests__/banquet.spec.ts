import { describe, expect, it } from 'vitest'

import {
  autoAssignGuests,
  buildDemoGuestNames,
  buildVenuePreset,
  countAssignedGuests,
  findDuplicateGuestNames,
  findOverlaps,
  parseBanquetGuests,
  snapshotTables,
  summarizeAssignments,
  validateBanquet,
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
    expect(issues.duplicateNames).toEqual([])
  })

  it('同名但不同 id 的宾客计入 duplicateNames', () => {
    const guests: BanquetGuest[] = [
      { id: 'a', name: '张伟', groupId: null },
      { id: 'b', name: '张伟 ', groupId: null },
      { id: 'c', name: '李娜', groupId: null },
    ]
    expect(findDuplicateGuestNames(guests)).toEqual(['张伟'])
    expect(validateBanquet(guests, []).duplicateNames).toEqual(['张伟'])
  })
})

describe('buildDemoGuestNames', () => {
  it('48 个演示姓名互不重复且确定', () => {
    const names = buildDemoGuestNames(48)
    expect(names).toHaveLength(48)
    expect(new Set(names).size).toBe(48)
    expect(buildDemoGuestNames(48)).toEqual(names)
    for (const n of names) expect(n).toMatch(/^[\u4e00-\u9fa5]{3}$/)
  })

  it('更大数量仍不重复', () => {
    const names = buildDemoGuestNames(300)
    expect(new Set(names).size).toBe(names.length)
    expect(names.length).toBe(300)
  })
})

describe('安排统计与快照', () => {
  it('countAssignedGuests / summarizeAssignments 统计已安排、未安排与空桌', () => {
    const t1 = table('A', 4)
    const t2 = table('B', 4)
    t1.guestIds = ['g1', 'g2', 'stale']
    const guests = ['g1', 'g2', 'g3'].map((id) => guest(id))
    expect(countAssignedGuests([t1, t2])).toBe(3)
    expect(summarizeAssignments(guests, [t1, t2])).toEqual({
      assigned: 2,
      unassigned: 1,
      emptyTables: 1,
    })
  })

  it('snapshotTables 快照不受后续清空影响，恢复后 guestIds 一致', () => {
    const tables = [table('A', 4), table('B', 4)]
    tables[0]!.guestIds = ['g1', 'g2']
    tables[1]!.guestIds = ['g3']
    const snapshot = snapshotTables(tables)
    for (const t of tables) t.guestIds = []
    expect(countAssignedGuests(tables)).toBe(0)
    const restored = snapshotTables(snapshot)
    expect(restored.map((t) => t.guestIds)).toEqual([['g1', 'g2'], ['g3']])
    expect(restored[0]!.guestIds).not.toBe(snapshot[0]!.guestIds)
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
