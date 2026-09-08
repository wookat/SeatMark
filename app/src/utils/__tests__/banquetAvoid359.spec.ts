import { describe, expect, it } from 'vitest'

import {
  autoAssignGuests,
  findAvoidConflicts,
  normalizeAvoidPairs,
  summarizeAssignments,
  validateBanquet,
  type AvoidPair,
  type BanquetGuest,
  type BanquetTable,
} from '../banquet'

function table(id: string, seats: number, extra?: Partial<BanquetTable>): BanquetTable {
  return { id, name: id, shape: 'round', x: 0, y: 0, width: 60, height: 60, seats, guestIds: [], ...extra }
}

function guest(id: string, groupId: string | null = null, extra?: Partial<BanquetGuest>): BanquetGuest {
  return { id, name: id, groupId, ...extra }
}

function tableOf(result: Map<string, string[]>, guestId: string): string | undefined {
  for (const [tid, ids] of result) if (ids.includes(guestId)) return tid
  return undefined
}

describe('第 359 轮 P3：banquet 「不同桌」排斥对', () => {
  it('normalizeAvoidPairs 去掉自反 / 未知宾客 / 无序重复', () => {
    const guests = [guest('a'), guest('b'), guest('c')]
    const pairs: AvoidPair[] = [
      ['a', 'b'],
      ['b', 'a'],
      ['a', 'a'],
      ['a', 'zz'],
      ['c', 'a'],
    ]
    expect(normalizeAvoidPairs(pairs, guests)).toEqual([
      ['a', 'b'],
      ['c', 'a'],
    ])
  })

  it('有替代桌时排斥对被分到不同桌（散客 + 顺序填桌）', () => {
    const guests = [guest('a'), guest('b'), guest('c'), guest('d')]
    const tables = [table('t1', 2), table('t2', 2)]
    const without = autoAssignGuests(guests, tables, 'fill-tables')
    expect(without.get('t1')).toEqual(['a', 'b'])

    const result = autoAssignGuests(guests, tables, 'fill-tables', { avoidPairs: [['a', 'b']] })
    expect(tableOf(result, 'a')).not.toBe(tableOf(result, 'b'))
    const seated = [...result.values()].flat().sort()
    expect(seated).toEqual(['a', 'b', 'c', 'd'])
    for (const t of tables) expect((result.get(t.id) ?? []).length).toBeLessThanOrEqual(t.seats)
  })

  it('有替代桌时排斥对被分到不同桌（散客 + 保持分组 best-fit）', () => {
    const guests = [guest('a'), guest('b'), guest('c'), guest('d'), guest('e'), guest('f')]
    const tables = [table('t1', 3), table('t2', 3), table('t3', 3)]
    const result = autoAssignGuests(guests, tables, 'keep-groups', { avoidPairs: [['a', 'b'], ['c', 'd']] })
    expect(tableOf(result, 'a')).not.toBe(tableOf(result, 'b'))
    expect(tableOf(result, 'c')).not.toBe(tableOf(result, 'd'))
    expect(findAvoidConflicts([['a', 'b'], ['c', 'd']], tables.map((t) => ({ ...t, guestIds: result.get(t.id) ?? [] })))).toEqual([])
  })

  it('分组整桌：排斥对所在两组不同桌', () => {
    const guests = [
      guest('a1', 'gA'),
      guest('a2', 'gA'),
      guest('b1', 'gB'),
      guest('b2', 'gB'),
      guest('c1', 'gC'),
      guest('c2', 'gC'),
    ]
    const tables = [table('t1', 4), table('t2', 4)]
    const plain = autoAssignGuests(guests, tables, 'keep-groups')
    expect(tableOf(plain, 'a1')).toBe(tableOf(plain, 'b1'))

    const result = autoAssignGuests(guests, tables, 'keep-groups', { avoidPairs: [['a1', 'b2']] })
    expect(tableOf(result, 'a1')).not.toBe(tableOf(result, 'b2'))
    expect(tableOf(result, 'a1')).toBe(tableOf(result, 'a2'))
    expect(tableOf(result, 'b1')).toBe(tableOf(result, 'b2'))
    expect([...result.values()].flat().sort()).toEqual(['a1', 'a2', 'b1', 'b2', 'c1', 'c2'])
  })

  it('同组内的排斥对：有空桌时后者拆出组单独落座，组内其余成员仍同桌，无冲突', () => {
    const guests = [guest('a1', 'gA'), guest('a2', 'gA'), guest('a3', 'gA'), guest('b1', 'gB'), guest('b2', 'gB')]
    const tables = [table('t1', 4), table('t2', 4), table('t3', 4)]
    for (const strategy of ['keep-groups', 'fill-tables'] as const) {
      const result = autoAssignGuests(guests, tables, strategy, { avoidPairs: [['a1', 'a3']] })
      expect(tableOf(result, 'a1')).not.toBe(tableOf(result, 'a3'))
      expect(tableOf(result, 'a1')).toBe(tableOf(result, 'a2'))
      expect(tableOf(result, 'b1')).toBe(tableOf(result, 'b2'))
      expect([...result.values()].flat().sort()).toEqual(['a1', 'a2', 'a3', 'b1', 'b2'])
      const seated = tables.map((t) => ({ ...t, guestIds: result.get(t.id)! }))
      expect(findAvoidConflicts([['a1', 'a3']], seated)).toEqual([])
    }
  })

  it('无替代桌时仍落座（软约束），validateBanquet 报冲突、summarizeAssignments 计数', () => {
    const guests = [guest('a'), guest('b')]
    const tables = [table('t1', 2)]
    const result = autoAssignGuests(guests, tables, 'fill-tables', { avoidPairs: [['a', 'b']] })
    expect(result.get('t1')?.sort()).toEqual(['a', 'b'])

    const seatedTables = tables.map((t) => ({ ...t, guestIds: result.get(t.id) ?? [] }))
    const issues = validateBanquet(guests, seatedTables, [['a', 'b']])
    expect(issues.avoidConflicts).toEqual([{ a: 'a', b: 'b', tableId: 't1' }])
    expect(issues.unassigned).toEqual([])
    expect(summarizeAssignments(guests, seatedTables, [['a', 'b']]).avoidConflicts).toBe(1)
    expect(summarizeAssignments(guests, seatedTables).avoidConflicts).toBe(0)
    expect(validateBanquet(guests, seatedTables).avoidConflicts).toEqual([])
  })

  it('与钉住 / 锁定共存：钉住优先级不变，排斥对象绕开钉住的桌', () => {
    const guests = [guest('p', null, { pinnedTableId: 't1' }), guest('q'), guest('r')]
    const tables = [table('t1', 2), table('t2', 2)]
    const result = autoAssignGuests(guests, tables, 'fill-tables', { avoidPairs: [['p', 'q']] })
    expect(result.get('t1')).toContain('p')
    expect(tableOf(result, 'q')).toBe('t2')
    expect(tableOf(result, 'r')).toBe('t1')

    const locked = [table('t1', 2, { locked: true, guestIds: ['p'] }), table('t2', 2)]
    const lockedResult = autoAssignGuests([guest('p'), guest('q'), guest('r')], locked, 'fill-tables', {
      respectLocked: true,
      avoidPairs: [['p', 'q']],
    })
    expect(lockedResult.get('t1')).toEqual(['p'])
    expect(tableOf(lockedResult, 'q')).toBe('t2')
    expect(tableOf(lockedResult, 'r')).toBe('t2')
  })

  it('无排斥对时结果与旧逻辑完全一致', () => {
    const guests = [guest('a', 'g1'), guest('b', 'g1'), guest('c'), guest('d'), guest('e')]
    const tables = [table('t1', 2), table('t2', 2), table('t3', 2)]
    for (const strategy of ['keep-groups', 'fill-tables'] as const) {
      const before = autoAssignGuests(guests, tables, strategy)
      const after = autoAssignGuests(guests, tables, strategy, { avoidPairs: [] })
      expect([...after.entries()]).toEqual([...before.entries()])
    }
  })
})
