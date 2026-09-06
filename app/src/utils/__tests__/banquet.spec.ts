import { describe, expect, it } from 'vitest'

import {
  assignGroupToGuests,
  autoAssignGuests,
  buildDemoGuestNames,
  buildVenuePreset,
  countAssignedGuests,
  findDuplicateGuestNames,
  findOverlaps,
  parseBanquetGuests,
  parseBanquetGuestsFromTable,
  snapshotTables,
  summarizeAssignments,
  removeEmptyTables,
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

  it('单列旧格式不返回分组映射且 headerSkipped=false', () => {
    const out = parseBanquetGuests('张伟\n李娜\n王芳')
    expect(out.groups).toBeUndefined()
    expect(out.headerSkipped).toBe(false)
  })

  it('「姓名,分组」10 行：第二列重复出现视为分组，不展开为宾客', () => {
    const rows = [
      '张伟,男方亲友',
      '李娜,女方亲友',
      '王芳,同事',
      '赵强,男方亲友',
      '钱进,女方亲友',
      '孙丽,同事',
      '周杰,男方亲友',
      '吴敏,女方亲友',
      '郑洋,同事',
      '冯勇,男方亲友',
    ]
    const out = parseBanquetGuests(rows.join('\n'))
    expect(out.names).toHaveLength(10)
    expect(out.headerSkipped).toBe(false)
    expect(out.groups).toEqual({
      张伟: '男方亲友',
      李娜: '女方亲友',
      王芳: '同事',
      赵强: '男方亲友',
      钱进: '女方亲友',
      孙丽: '同事',
      周杰: '男方亲友',
      吴敏: '女方亲友',
      郑洋: '同事',
      冯勇: '男方亲友',
    })
  })

  it('Tab 分隔两列（Excel 复制）同样识别分组', () => {
    const out = parseBanquetGuests('张伟\t男方亲友\n李娜\t男方亲友\n王芳\t同事\n赵强\t同事')
    expect(out.names).toEqual(['张伟', '李娜', '王芳', '赵强'])
    expect(out.groups?.['王芳']).toBe('同事')
  })

  it('首行表头「姓名,分组」被跳过并按表头定位列', () => {
    const out = parseBanquetGuests('分组,姓名\n男方亲友,张伟\n女方亲友,李娜')
    expect(out.headerSkipped).toBe(true)
    expect(out.names).toEqual(['张伟', '李娜'])
    expect(out.groups).toEqual({ 张伟: '男方亲友', 李娜: '女方亲友' })
  })

  it('第二列全是不同人名（一行多名）保持旧行为展开', () => {
    const out = parseBanquetGuests('张伟,李娜\n王芳,赵强\n钱进,孙丽')
    expect(out.names).toEqual(['张伟', '李娜', '王芳', '赵强', '钱进', '孙丽'])
    expect(out.groups).toBeUndefined()
  })

  it('第二列为性别词时不视为分组', () => {
    const out = parseBanquetGuests('张伟,男\n李娜,女\n王芳,女\n赵强,男')
    expect(out.groups).toBeUndefined()
    expect(out.names).toContain('男')
  })
})

describe('parseBanquetGuestsFromTable', () => {
  async function buildXlsx(aoa: unknown[][]): Promise<File> {
    const XLSX = await import('xlsx')
    const sheet = XLSX.utils.aoa_to_sheet(aoa)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1')
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    return new File([buffer], 'guests.xlsx')
  }

  it('xlsx 两列文件：按「姓名 / 分组」表头取列，人数与分组正确', async () => {
    const { parseExcelFile } = await import('../excel')
    const file = await buildXlsx([
      ['序号', '姓名', '分组'],
      [1, '张伟', '男方亲友'],
      [2, '李娜', '女方亲友'],
      [3, '王芳', '同事'],
      [4, '赵强', '男方亲友'],
    ])
    const { headers, rows } = await parseExcelFile(file)
    const out = parseBanquetGuestsFromTable(headers, rows)
    expect(out.headerSkipped).toBe(true)
    expect(out.names).toEqual(['张伟', '李娜', '王芳', '赵强'])
    expect(out.groups).toEqual({ 张伟: '男方亲友', 李娜: '女方亲友', 王芳: '同事', 赵强: '男方亲友' })
  })

  it('无表头的两列表：首行也是宾客，前两列作姓名/分组', async () => {
    const { parseExcelFile } = await import('../excel')
    const file = await buildXlsx([
      ['张伟', '男方亲友'],
      ['李娜', '女方亲友'],
      ['王芳', ''],
    ])
    const { headers, rows } = await parseExcelFile(file)
    const out = parseBanquetGuestsFromTable(headers, rows)
    expect(out.headerSkipped).toBe(false)
    expect(out.names).toEqual(['张伟', '李娜', '王芳'])
    expect(out.groups).toEqual({ 张伟: '男方亲友', 李娜: '女方亲友' })
  })
})

describe('assignGroupToGuests', () => {
  const base: BanquetGuest[] = [guest('a'), guest('b', 'g1'), guest('c', 'g1'), guest('d', 'g2')]

  it('新建归组：未分组宾客指向新分组，其余不变', () => {
    const out = assignGroupToGuests(base, ['a'], 'g3')
    expect(out.map((g) => g.groupId)).toEqual(['g3', 'g1', 'g1', 'g2'])
    expect(out[1]).toBe(base[1])
    expect(base[0]!.groupId).toBeNull()
  })

  it('切换：已分组宾客改到另一组', () => {
    const out = assignGroupToGuests(base, new Set(['b', 'd']), 'g2')
    expect(out.map((g) => g.groupId)).toEqual([null, 'g2', 'g1', 'g2'])
    expect(out[3]).toBe(base[3])
  })

  it('清除：groupId=null', () => {
    const out = assignGroupToGuests(base, ['b', 'c'], null)
    expect(out.map((g) => g.groupId)).toEqual([null, null, null, 'g2'])
  })

  it('ids 为空或不存在时原样返回', () => {
    expect(assignGroupToGuests(base, [], 'g1')).toEqual(base)
    expect(assignGroupToGuests(base, ['zzz'], 'g1')).toEqual(base)
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

describe('removeEmptyTables', () => {
  it('删除空桌，保留有人桌，默认桌名序号重新连续', () => {
    const tables = [1, 2, 3, 4].map((n) => table(`t${n}`, 8, { name: `${n}号桌`, x: n * 100 }))
    tables[0]!.guestIds = ['g1']
    tables[2]!.guestIds = ['g2', 'g3']
    const out = removeEmptyTables(tables)
    expect(out.map((t) => t.id)).toEqual(['t1', 't3'])
    expect(out.map((t) => t.name)).toEqual(['1号桌', '2号桌'])
    expect(out[1]!.x).toBe(300)
    expect(out[1]!.guestIds).toEqual(['g2', 'g3'])
  })

  it('自定义桌名不参与重排', () => {
    const tables = [
      table('a', 8, { name: '1号桌' }),
      table('b', 8, { name: '主桌' }),
      table('c', 8, { name: '3号桌', guestIds: ['g1'] }),
    ]
    tables[1]!.guestIds = ['g0']
    const out = removeEmptyTables(tables)
    expect(out.map((t) => t.name)).toEqual(['主桌', '2号桌'])
  })

  it('不修改入参；无空桌时桌对象按引用复用', () => {
    const tables = [
      table('a', 8, { name: '1号桌', guestIds: ['g1'] }),
      table('b', 8, { name: '2号桌' }),
      table('c', 8, { name: '3号桌', guestIds: ['g2'] }),
    ]
    const before = JSON.stringify(tables)
    const out = removeEmptyTables(tables)
    expect(JSON.stringify(tables)).toBe(before)
    expect(out[0]).toBe(tables[0])
    expect(out[1]).not.toBe(tables[2])
    expect(out[1]!.name).toBe('2号桌')

    const full = [
      table('a', 8, { name: '1号桌', guestIds: ['g1'] }),
      table('b', 8, { name: '2号桌', guestIds: ['g2'] }),
    ]
    const same = removeEmptyTables(full)
    expect(same[0]).toBe(full[0])
    expect(same[1]).toBe(full[1])
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

  it('给出每桌的分组人数（按桌位顺序）', () => {
    const t1 = table('A', 6)
    const t2 = table('B', 6)
    const t3 = table('C', 6)
    t1.guestIds = ['g1', 'g2', 'g3']
    t2.guestIds = ['g4']
    t3.guestIds = ['g5', 'g6']
    const guests = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].map((id) => guest(id, 'gA'))
    const split = splitGroups(guests, [t1, t2, t3], groups)
    expect(split).toHaveLength(1)
    expect(split[0]!.tables).toEqual([
      { name: 'A', count: 3 },
      { name: 'B', count: 1 },
      { name: 'C', count: 2 },
    ])
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
