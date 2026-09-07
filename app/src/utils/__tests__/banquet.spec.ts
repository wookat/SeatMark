import { describe, expect, it } from 'vitest'

import {
  assignGroupToGuests,
  autoAssignGuests,
  buildDemoGuestNames,
  buildGuestQuickReference,
  buildVenuePreset,
  countAssignedGuests,
  explainSplit,
  findDuplicateGuestNames,
  findOverlaps,
  detectBanquetPasteLayout,
  parseBanquetGuests,
  parseBanquetGuestsFromTable,
  quickReferenceCsv,
  snapshotTables,
  summarizeAssignments,
  removeEmptyTables,
  searchGuests,
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

  describe('第 349 轮：两列粘贴多信号判定与解析预览模式', () => {
    const FOUR_ROWS = '张三,主桌\n李四,主桌\n王五,亲友桌\n赵六,同事桌'

    it('4 行 × 3 桌名（第二列去重 3 > 行数/2）：桌名词 + 重复值信号 → 4 位宾客 3 桌、无假宾客、无重名', () => {
      expect(detectBanquetPasteLayout(FOUR_ROWS)).toMatchObject({
        mode: 'column',
        signals: expect.arrayContaining(['groupWord', 'duplicateGroup']),
      })
      const out = parseBanquetGuests(FOUR_ROWS)
      expect(out.names).toEqual(['张三', '李四', '王五', '赵六'])
      expect(out.duplicates).toEqual([])
      expect(new Set(Object.values(out.groups ?? {}))).toEqual(new Set(['主桌', '亲友桌', '同事桌']))
    })

    it('桌名词单独成立：Table/Group/T1/纯数字/…席/…家/…方 均视为分组列（无重复也算）', () => {
      for (const text of [
        '张三,Table A\n李四,Table B\n王五,Table C',
        '张三,Group 1\n李四,Group 2\n王五,Group 3',
        '张三,T1\n李四,T2\n王五,T3',
        '张三,1\n李四,2\n王五,3',
        '张三,主席\n李四,贵宾席\n王五,新郎方',
      ]) {
        expect(detectBanquetPasteLayout(text).mode, text).toBe('column')
        expect(parseBanquetGuests(text).names, text).toEqual(['张三', '李四', '王五'])
      }
    })

    it('两列且第一列像人名、第二列不像人名（如带编号）→ 列模式', () => {
      const text = '张三,主桌-1\n李四,亲友-2\n王五,同事-3'
      expect(detectBanquetPasteLayout(text).signals).toContain('twoColumnNames')
      expect(parseBanquetGuests(text).names).toEqual(['张三', '李四', '王五'])
    })

    it('完全无信号但各行列数一致（第二列也全像人名）→ ambiguous，auto 下仍按旧行为拆 token', () => {
      const text = '张伟,李娜\n王芳,赵强\n钱进,孙丽'
      expect(detectBanquetPasteLayout(text)).toEqual({ mode: 'ambiguous', signals: [], columnCount: 2 })
      expect(parseBanquetGuests(text).names).toHaveLength(6)
    })

    it('性别词否决自动列模式 → ambiguous（交预览确认），指定 nameOnly 只取第一列且不产生分组', () => {
      const text = '张伟,男\n李娜,女\n王芳,女\n赵强,男'
      expect(detectBanquetPasteLayout(text).mode).toBe('ambiguous')
      const out = parseBanquetGuests(text, 'nameOnly')
      expect(out.names).toEqual(['张伟', '李娜', '王芳', '赵强'])
      expect(out.groups).toBeUndefined()
      expect(out.duplicates).toEqual([])
    })

    it('强制 column / tokens 模式覆盖自动判定', () => {
      const text = '张伟,李娜\n王芳,赵强'
      expect(parseBanquetGuests(text, 'column')).toMatchObject({
        names: ['张伟', '王芳'],
        groups: { 张伟: '李娜', 王芳: '赵强' },
      })
      expect(parseBanquetGuests(FOUR_ROWS, 'tokens').names).toEqual([
        '张三',
        '主桌',
        '李四',
        '王五',
        '亲友桌',
        '赵六',
        '同事桌',
      ])
    })

    it('单列 / 行列数不一致 / 单行多名 → tokens（不弹预览）', () => {
      expect(detectBanquetPasteLayout('张伟\n李娜\n王芳').mode).toBe('tokens')
      expect(detectBanquetPasteLayout('张伟,李娜\n王芳\n赵强,钱进,孙丽').mode).toBe('tokens')
      expect(detectBanquetPasteLayout('张伟,李娜、王芳；赵强').mode).toBe('tokens')
    })
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

describe('第 354 轮：autoAssignGuests respectLocked 锁定桌', () => {
  it('锁定桌及其宾客重排后保持不变，其余宾客只进未锁桌', () => {
    const locked = table('L', 4, { locked: true, guestIds: ['v1', 'v2'] })
    const tables = [locked, table('A', 4), table('B', 4)]
    const guests = [
      guest('v1', 'x'),
      guest('v2', 'y'),
      guest('x1', 'x'),
      guest('x2', 'x'),
      guest('y1', 'y'),
      guest('s', null),
    ]
    const out = autoAssignGuests(guests, tables)
    expect(out.get('L')).toEqual(['v1', 'v2'])
    const rest = [...out.get('A')!, ...out.get('B')!]
    expect(rest).not.toContain('v1')
    expect(rest).not.toContain('v2')
    expect(rest.sort()).toEqual(['s', 'x1', 'x2', 'y1'])
  })

  it('fill-tables 策略同样跳过锁定桌', () => {
    const tables = [table('L', 4, { locked: true, guestIds: ['v1'] }), table('A', 4)]
    const guests = [guest('v1'), guest('g1'), guest('g2')]
    const out = autoAssignGuests(guests, tables, 'fill-tables')
    expect(out.get('L')).toEqual(['v1'])
    expect(out.get('A')).toEqual(['g1', 'g2'])
  })

  it('未锁桌（含此前已就座宾客）照常参与重排', () => {
    const tables = [table('A', 4, { guestIds: ['g2'] }), table('B', 4)]
    const guests = [guest('g1', 'x'), guest('g2', 'x'), guest('g3', 'x')]
    const out = autoAssignGuests(guests, tables)
    expect(out.get('A')).toEqual(['g1', 'g2', 'g3'])
    expect(out.get('B')).toEqual([])
  })

  it('respectLocked=false 时锁定桌视同普通桌', () => {
    const tables = [table('L', 4, { locked: true, guestIds: ['v1'] }), table('A', 4)]
    const guests = [guest('g1', 'x'), guest('g2', 'x'), guest('g3', 'x'), guest('v1', 'x')]
    const out = autoAssignGuests(guests, tables, 'keep-groups', { respectLocked: false })
    expect(out.get('L')).toEqual(['g1', 'g2', 'g3', 'v1'])
    expect(out.get('A')).toEqual([])
  })
})

describe('第 354 轮：searchGuests 姓名 / 拼音首字母', () => {
  const guests: BanquetGuest[] = [
    { id: 'a', name: '张伟', groupId: null },
    { id: 'b', name: '李娜', groupId: null },
    { id: 'c', name: '王芳', groupId: null },
  ]
  const tables = [table('T1', 4, { guestIds: ['a'] }), table('T2', 4, { guestIds: ['c'] })]

  it('按姓名子串命中并带回所在桌', () => {
    expect(searchGuests(guests, tables, '张')).toEqual([{ guest: guests[0], tableId: 'T1' }])
  })

  it('按拼音首字母命中，未安排的宾客 tableId 为 null', () => {
    const hits = searchGuests(guests, tables, 'ln')
    expect(hits).toEqual([{ guest: guests[1], tableId: null }])
    expect(searchGuests(guests, tables, 'WF')[0]?.tableId).toBe('T2')
  })

  it('未命中返回空数组；空查询不视为全部命中', () => {
    expect(searchGuests(guests, tables, '赵')).toEqual([])
    expect(searchGuests(guests, tables, '   ')).toEqual([])
  })
})

describe('第 346 轮：autoAssignGuests fill-tables 策略 + explainSplit', () => {
  it('fill-tables：48 人 / 5 桌 × 10 座 → 前 4 桌满、第 5 桌 8 人，组内成员连续', () => {
    const tables = ['T1', 'T2', 'T3', 'T4', 'T5'].map((id) => table(id, 10))
    const guests: BanquetGuest[] = []
    // 3 组：groom 20 / bride 16 / friends 12
    for (let i = 0; i < 20; i++) guests.push(guest(`g${i}`, 'groom'))
    for (let i = 0; i < 16; i++) guests.push(guest(`b${i}`, 'bride'))
    for (let i = 0; i < 12; i++) guests.push(guest(`f${i}`, 'friends'))
    const out = autoAssignGuests(guests, tables, 'fill-tables')
    expect(['T1', 'T2', 'T3', 'T4'].map((id) => out.get(id)!.length)).toEqual([10, 10, 10, 10])
    expect(out.get('T5')!.length).toBe(8)
    // 大组优先 + 组内连续：groom 20 人占满 T1、T2；bride 16 人 T3 满 + T4 前 6；friends T4 后 4 + T5 前 8
    expect(out.get('T1')).toEqual(guests.slice(0, 10).map((g) => g.id))
    expect(out.get('T2')).toEqual(guests.slice(10, 20).map((g) => g.id))
    expect(out.get('T3')).toEqual(guests.slice(20, 30).map((g) => g.id))
    expect(out.get('T4')).toEqual(guests.slice(30, 40).map((g) => g.id))
    expect(out.get('T5')).toEqual(guests.slice(40, 48).map((g) => g.id))
  })

  it('fill-tables：所有桌满后剩余宾客保持未安排', () => {
    const tables = [table('A', 2), table('B', 2)]
    const guests = ['g1', 'g2', 'g3', 'g4', 'g5'].map((id) => guest(id, 'x'))
    const out = autoAssignGuests(guests, tables, 'fill-tables')
    expect(out.get('A')).toEqual(['g1', 'g2'])
    expect(out.get('B')).toEqual(['g3', 'g4'])
  })

  it('keep-groups（默认）结果与不传 strategy 完全一致', () => {
    const tables = [table('A', 10), table('B', 4), table('C', 6)]
    const guests = [
      ...['x1', 'x2', 'x3'].map((id) => guest(id, 'x')),
      ...['y1', 'y2', 'y3', 'y4', 'y5'].map((id) => guest(id, 'y')),
      guest('solo'),
    ]
    const legacy = autoAssignGuests(guests, tables)
    const explicit = autoAssignGuests(guests, tables, 'keep-groups')
    expect([...explicit]).toEqual([...legacy])
    expect(legacy.get('C')).toEqual(['y1', 'y2', 'y3', 'y4', 'y5'])
    expect(legacy.get('B')).toEqual(['x1', 'x2', 'x3', 'solo'])
    expect(legacy.get('A')).toEqual([])
    // 与 fill-tables 结果不同（策略确实生效）
    const filled = autoAssignGuests(guests, tables, 'fill-tables')
    expect([...filled]).not.toEqual([...legacy])
  })

  it('explainSplit：组人数 > 任一桌最大座位 → group-larger-than-any-table，并列出所在桌', () => {
    const tables = [table('T1', 10), table('T2', 10)]
    const guests = Array.from({ length: 12 }, (_, i) => guest(`c${i}`, 'classmates'))
    const groups: BanquetGroup[] = [{ id: 'classmates', name: '同学', color: '#000' }]
    const result = autoAssignGuests(guests, tables)
    const assigned = tables.map((t) => ({ ...t, guestIds: result.get(t.id)! }))
    const out = explainSplit(guests, assigned, groups)
    expect(out).toHaveLength(1)
    expect(out[0]!.reason).toBe('group-larger-than-any-table')
    expect(out[0]!.groupSize).toBe(12)
    expect(out[0]!.maxTableSeats).toBe(10)
    expect(out[0]!.tableNames.sort()).toEqual(['T1', 'T2'])
  })

  it('explainSplit：有桌容得下整组但轮到时剩余不够 → no-table-had-enough-free-seats', () => {
    // fill-tables：a 组 6 人先占 T1 前 6 座，b 组 6 人只能 T1 剩 4 + T2 2
    const tables = [table('T1', 10), table('T2', 10)]
    const guests = [
      ...Array.from({ length: 6 }, (_, i) => guest(`a${i}`, 'a')),
      ...Array.from({ length: 6 }, (_, i) => guest(`b${i}`, 'b')),
    ]
    const groups: BanquetGroup[] = [
      { id: 'a', name: '亲友', color: '#000' },
      { id: 'b', name: '同事', color: '#111' },
    ]
    const result = autoAssignGuests(guests, tables, 'fill-tables')
    const assigned = tables.map((t) => ({ ...t, guestIds: result.get(t.id)! }))
    const out = explainSplit(guests, assigned, groups)
    expect(out).toHaveLength(1)
    expect(out[0]!.groupName).toBe('同事')
    expect(out[0]!.reason).toBe('no-table-had-enough-free-seats')
    expect(out[0]!.tableNames).toEqual(['T1', 'T2'])
    expect(out[0]!.tables).toEqual([
      { name: 'T1', count: 4 },
      { name: 'T2', count: 2 },
    ])
    // 未拆分时为空
    expect(explainSplit(guests, tables.map((t) => ({ ...t, guestIds: [] })), groups)).toEqual([])
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

describe('buildGuestQuickReference / quickReferenceCsv', () => {
  const groups: BanquetGroup[] = [
    { id: 'g1', name: '男方亲友', color: '#000' },
    { id: 'g2', name: '同事', color: '#111' },
  ]
  const guests: BanquetGuest[] = [
    { id: 'a', name: '张伟', groupId: 'g1' },
    { id: 'b', name: '李娜', groupId: 'g2' },
    { id: 'c', name: '王芳', groupId: 'g1' },
    { id: 'd', name: '陈静', groupId: null },
    { id: 'e', name: '安琪', groupId: 'g2' },
  ]
  const tables: BanquetTable[] = [
    table('1号桌', 10, { guestIds: ['a', 'c'] }),
    table('空桌', 10),
    table('2号桌', 10, { guestIds: ['b', 'zombie'] }),
  ]

  it('索引按拼音序，空桌不出现，未落座宾客单列「待安排」放最后', () => {
    const ref = buildGuestQuickReference(guests, tables, groups)
    expect(ref.index.map((e) => e.name)).toEqual(['安琪', '陈静', '李娜', '王芳', '张伟'])
    expect(ref.index.find((e) => e.name === '张伟')?.tableName).toBe('1号桌')
    expect(ref.index.find((e) => e.name === '陈静')?.tableName).toBe('待安排')
    expect(ref.tables.map((t) => t.tableName)).toEqual(['1号桌', '2号桌', '待安排'])
    expect(ref.tables[0]!.rows).toEqual([
      { tableName: '1号桌', seatNo: '1', name: '张伟', groupName: '男方亲友' },
      { tableName: '1号桌', seatNo: '2', name: '王芳', groupName: '男方亲友' },
    ])
    // 桌上残留的已删除 id 跳过，座次连续
    expect(ref.tables[1]!.rows).toEqual([
      { tableName: '2号桌', seatNo: '1', name: '李娜', groupName: '同事' },
    ])
    expect(ref.tables[2]!.rows.map((r) => [r.name, r.seatNo, r.groupName])).toEqual([
      ['陈静', '', ''],
      ['安琪', '', '同事'],
    ])
  })

  it('同名宾客按名单顺序稳定排列，多次生成结果一致', () => {
    const dup: BanquetGuest[] = [
      { id: 'x1', name: '李明', groupId: null },
      { id: 'x2', name: '李明', groupId: null },
    ]
    const t = [table('A', 4, { guestIds: ['x2'] }), table('B', 4, { guestIds: ['x1'] })]
    const first = buildGuestQuickReference(dup, t, [])
    const second = buildGuestQuickReference(dup, t, [])
    expect(first.index.map((e) => e.tableName)).toEqual(['A', 'B'])
    expect(second).toEqual(first)
  })

  it('全员未安排时只有「待安排」一组；名单为空时两部分都为空', () => {
    const ref = buildGuestQuickReference(guests, [table('1号桌', 10)], groups)
    expect(ref.tables.map((t) => t.tableName)).toEqual(['待安排'])
    expect(ref.index).toHaveLength(5)
    const empty = buildGuestQuickReference([], tables, groups)
    expect(empty).toEqual({ index: [], tables: [] })
  })

  it('CSV 带 UTF-8 BOM、表头 桌名/座次/姓名/分组，每位宾客一行，特殊字符转义', () => {
    const ref = buildGuestQuickReference(
      [...guests, { id: 'f', name: 'Wang, "Lily"', groupId: null }],
      tables,
      groups,
    )
    const csv = quickReferenceCsv(ref.tables)
    expect(csv.startsWith('\ufeff')).toBe(true)
    const lines = csv.replace(/^\ufeff/, '').trimEnd().split('\r\n')
    expect(lines[0]).toBe('桌名,座次,姓名,分组')
    expect(lines).toHaveLength(1 + 6)
    expect(lines[1]).toBe('1号桌,1,张伟,男方亲友')
    expect(lines).toContain('待安排,,陈静,')
    expect(lines).toContain('待安排,,"Wang, ""Lily""",')
  })
})
