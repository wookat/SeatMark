import { describe, expect, it } from 'vitest'

import {
  buildDisplayGrid,
  buildSeatGrid,
  buildSeats,
  dedupeSeatingEntries,
  duplicateSuffix,
  interleaveByGender,
  isSeatBlocked,
  isSeatingSpacing,
  parseSeatingRoster,
  parseSeatingRosterDetailed,
  roomsFitIndividually,
  SEATING_SPACINGS,
  seatCapacity,
  seatingExportFileName,
  type SeatingFillOrder,
  type SeatingSpacing,
  seatingRosterTextFromTable,
  shuffleEntries,
  unseatedEntries,
  unseatedSummary,
} from '../seating'

const NAME_LABELS = { fallback: '教室座位表', teacher: '教师视角', student: '学生视角' }

describe('seatingExportFileName', () => {
  it('标题清洗非法字符并追加视角后缀', () => {
    expect(seatingExportFileName('高三（2）班 期末考试', 'teacher', NAME_LABELS)).toBe(
      '高三（2）班 期末考试-教师视角',
    )
    expect(seatingExportFileName('考场/01: A*室?', 'student', NAME_LABELS)).toBe('考场01 A室-学生视角')
  })

  it('空标题 / 纯非法字符回退默认名', () => {
    expect(seatingExportFileName('', 'teacher', NAME_LABELS)).toBe('教室座位表-教师视角')
    expect(seatingExportFileName('  ::??  ', 'student', NAME_LABELS)).toBe('教室座位表-学生视角')
  })

  it('超长标题截断后仍带视角后缀', () => {
    const name = seatingExportFileName('班'.repeat(200), 'teacher', NAME_LABELS)
    expect(name.endsWith('-教师视角')).toBe(true)
    expect(name.length).toBeLessThanOrEqual(80 + '-教师视角'.length)
  })
})

describe('buildSeats / buildDisplayGrid 视角镜像', () => {
  const entries = [
    { name: 'A', gender: '男' as const },
    { name: 'B', gender: '女' as const },
    { name: 'C' },
    { name: 'D' },
    { name: 'E' },
  ]
  const rows = 2
  const cols = 3
  const names = (grid: ReturnType<typeof buildDisplayGrid>) =>
    grid.map((row) => row.map((c) => c.seat?.name ?? ''))
  const aisleFlags = (grid: ReturnType<typeof buildDisplayGrid>) =>
    grid.map((row) => row.map((c) => c.aisleAfter))

  it('教师视角：按行填充保持名单顺序，空位名为空串，过道在第 1 列之后', () => {
    const seats = buildSeats(entries, rows, cols, 'rows')
    expect(seats.map((s) => s.seatNo)).toEqual([1, 2, 3, 4, 5, 6])
    expect(seats[0]).toMatchObject({ row: 1, col: 1, name: 'A', gender: '男' })
    expect(seats[5]).toMatchObject({ row: 2, col: 3, name: '' })
    const grid = buildDisplayGrid(buildSeatGrid(seats, rows, cols), cols, new Set([1]), 'teacher')
    expect(names(grid)).toEqual([
      ['A', 'B', 'C'],
      ['D', 'E', ''],
    ])
    expect(aisleFlags(grid)).toEqual([
      [true, false, false],
      [true, false, false],
    ])
  })

  it('学生视角：每排左右镜像，座位号与姓名绑定不变，过道随镜像翻到对侧', () => {
    const seats = buildSeats(entries, rows, cols, 'rows')
    const seatGrid = buildSeatGrid(seats, rows, cols)
    const grid = buildDisplayGrid(seatGrid, cols, new Set([1]), 'student')
    expect(names(grid)).toEqual([
      ['C', 'B', 'A'],
      ['', 'E', 'D'],
    ])
    expect(grid[0]!.map((c) => c.seat?.seatNo)).toEqual([3, 2, 1])
    // 物理第 1 列之后的过道，镜像后位于展示序倒数第 2 格之后（最后一格不带过道）
    expect(aisleFlags(grid)).toEqual([
      [false, true, false],
      [false, true, false],
    ])
    // 镜像不改变底层座位数据
    expect(seatGrid[0]!.map((s) => s?.name)).toEqual(['A', 'B', 'C'])
  })

  it('蛇形填充：偶数排从右向左，学生视角镜像后回到名单顺序', () => {
    const seats = buildSeats(entries, rows, cols, 'serpentine')
    const seatGrid = buildSeatGrid(seats, rows, cols)
    expect(names(buildDisplayGrid(seatGrid, cols, new Set(), 'teacher'))).toEqual([
      ['A', 'B', 'C'],
      ['', 'E', 'D'],
    ])
    expect(names(buildDisplayGrid(seatGrid, cols, new Set(), 'student'))).toEqual([
      ['C', 'B', 'A'],
      ['D', 'E', ''],
    ])
  })
})

describe('parseSeatingRoster', () => {
  it('每行一个姓名（旧行为兼容）', () => {
    expect(parseSeatingRoster('张伟\n李娜')).toEqual([{ name: '张伟' }, { name: '李娜' }])
  })

  it('一行多个姓名以分隔符拆开（旧行为兼容）', () => {
    expect(parseSeatingRoster('张伟,李娜、王芳')).toEqual([
      { name: '张伟' },
      { name: '李娜' },
      { name: '王芳' },
    ])
  })

  it('识别「姓名 性别」两列', () => {
    expect(parseSeatingRoster('张伟 男\n李娜\t女\n王芳,F')).toEqual([
      { name: '张伟', gender: '男' },
      { name: '李娜', gender: '女' },
      { name: '王芳', gender: '女' },
    ])
  })

  it('英文姓名带性别列：保留姓名中的空格，复姓中文仍紧贴', () => {
    expect(parseSeatingRoster('ZHANG Wei\tM\nWANG Fang 2\tF\n欧阳 明 男')).toEqual([
      { name: 'ZHANG Wei', gender: '男' },
      { name: 'WANG Fang 2', gender: '女' },
      { name: '欧阳明', gender: '男' },
    ])
  })

  it('忽略空行与多余空白', () => {
    expect(parseSeatingRoster('\n 张伟 \n\n')).toEqual([{ name: '张伟' }])
  })
})

describe('parseSeatingRosterDetailed（Excel 多列粘贴）', () => {
  it('「姓名\t性别\t学号」表头 + 3 行 → 3 人且性别正确，学号列被忽略', () => {
    const r = parseSeatingRosterDetailed('姓名\t性别\t学号\n张伟\t男\t2021001\n王芳\t女\t2021002\n李娜\t女\t2021003')
    expect(r.entries).toEqual([
      { name: '张伟', gender: '男' },
      { name: '王芳', gender: '女' },
      { name: '李娜', gender: '女' },
    ])
    expect(r.columnMode).toBe(true)
    expect(r.headerSkipped).toEqual(['姓名', '性别', '学号'])
    expect(r.ignoredColumns).toEqual(['学号'])
    expect(r.genderColumn).toBe(true)
  })

  it('无表头 3 列 3 行（张伟\t男\t2021001）→ 3 人，学号不当人名', () => {
    const r = parseSeatingRosterDetailed('张伟\t男\t2021001\n王芳\t女\t2021002\n李娜\t女\t2021003')
    expect(r.entries.map((e) => e.name)).toEqual(['张伟', '王芳', '李娜'])
    expect(r.entries.map((e) => e.gender)).toEqual(['男', '女', '女'])
    expect(r.headerSkipped).toEqual([])
    expect(r.ignoredColumns).toHaveLength(1)
    expect(r.genderColumn).toBe(true)
  })

  it('两列「姓名\t性别」表头不成为学生', () => {
    const r = parseSeatingRosterDetailed('姓名\t性别\n张伟\t男\n王芳\t女')
    expect(r.entries).toEqual([
      { name: '张伟', gender: '男' },
      { name: '王芳', gender: '女' },
    ])
    expect(r.entries.some((e) => e.name === '姓名')).toBe(false)
  })

  it('表头列序不固定：姓名列不在首列也能识别，班级/学号忽略', () => {
    const r = parseSeatingRosterDetailed('学号\t姓名\t班级\t性别\n1\t张伟\t高一(1)班\t男\n2\t王芳\t高一(1)班\t女')
    expect(r.entries).toEqual([
      { name: '张伟', gender: '男' },
      { name: '王芳', gender: '女' },
    ])
    expect(r.ignoredColumns).toEqual(['学号', '班级'])
  })

  it('无表头多列姓名网格（无数字/班级词）仍全部展开', () => {
    const r = parseSeatingRosterDetailed('张伟\t王芳\n李娜\t赵六')
    expect(r.entries.map((e) => e.name)).toEqual(['张伟', '王芳', '李娜', '赵六'])
    expect(r.ignoredColumns).toEqual([])
  })

  it('旧格式「张伟 男」「张伟 王芳 李娜」结果与现在一致且不进入列模式', () => {
    const a = parseSeatingRosterDetailed('张伟 男\n王芳 女')
    expect(a.columnMode).toBe(false)
    expect(a.entries).toEqual([
      { name: '张伟', gender: '男' },
      { name: '王芳', gender: '女' },
    ])
    const b = parseSeatingRosterDetailed('张伟 王芳 李娜')
    expect(b.columnMode).toBe(false)
    expect(b.entries).toEqual([{ name: '张伟' }, { name: '王芳' }, { name: '李娜' }])
    expect(parseSeatingRoster('张伟 男\n王芳 女')).toEqual(a.entries)
  })
})

describe('第 357 轮：单列「Student1…」序号名单首行不再被误判为表头', () => {
  it('单列 48 行 Student1…Student48 → 48 人、headerSkipped 为空', () => {
    const text = Array.from({ length: 48 }, (_, i) => `Student${i + 1}`).join('\n')
    const r = parseSeatingRosterDetailed(text)
    expect(r.entries).toHaveLength(48)
    expect(r.entries[0]!.name).toBe('Student1')
    expect(r.entries[47]!.name).toBe('Student48')
    expect(r.headerSkipped).toEqual([])
    expect(r.columnMode).toBe(false)
    expect(parseSeatingRoster(text)).toHaveLength(48)
  })

  it('「名字叫X」这类首行不是表头', () => {
    const r = parseSeatingRosterDetailed('名字叫张三\n李四\n王五')
    expect(r.entries.map((e) => e.name)).toEqual(['名字叫张三', '李四', '王五'])
    expect(r.headerSkipped).toEqual([])
  })

  it.each(['Student', 'Students', 'Name', 'NAME', '姓名', '学生姓名', '名字'])(
    '单列首行「%s」仍识别为表头并跳过',
    (header) => {
      const r = parseSeatingRosterDetailed(`${header}\n张伟\n王芳`)
      expect(r.entries.map((e) => e.name)).toEqual(['张伟', '王芳'])
      expect(r.headerSkipped).toEqual([header])
    },
  )

  it('双列「姓名\\t性别」与「Name\\tGender」表头路径不回归', () => {
    const zh = parseSeatingRosterDetailed('姓名\t性别\n张伟\t男\n王芳\t女')
    expect(zh.entries).toEqual([
      { name: '张伟', gender: '男' },
      { name: '王芳', gender: '女' },
    ])
    expect(zh.headerSkipped).toEqual(['姓名', '性别'])
    const en = parseSeatingRosterDetailed('Name\tGender\nTom\tM\nAmy\tF')
    expect(en.entries).toEqual([
      { name: 'Tom', gender: '男' },
      { name: 'Amy', gender: '女' },
    ])
    expect(en.headerSkipped).toEqual(['Name', 'Gender'])
    expect(en.genderColumn).toBe(true)
  })

  it('双列「Student1\\tGender1」首行是数据不是表头（gender 已锚定）', () => {
    const r = parseSeatingRosterDetailed('Student1\tGender1\nStudent2\tGender2')
    expect(r.headerSkipped).toEqual([])
    expect(r.entries.map((e) => e.name)).toContain('Student1')
  })

  it('多列表头「Student Name」列仍被识别为姓名列（不在首列）', () => {
    const r = parseSeatingRosterDetailed('ID\tStudent Name\tGender\n1\tTom\tM\n2\tAmy\tF')
    expect(r.entries).toEqual([
      { name: 'Tom', gender: '男' },
      { name: 'Amy', gender: '女' },
    ])
    expect(r.ignoredColumns).toEqual(['ID'])
  })
})

describe('第 360 轮：多列首行带数字的关键词格（考场01 / 座位12 / 宿舍302）不当表头', () => {
  const sample30 = Array.from({ length: 30 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0')
    const room = i < 15 ? '考场01' : '考场02'
    const seat = String((i % 15) + 1).padStart(2, '0')
    return `学生${n}\t${room}\t座位${seat}\t宿舍${300 + i}`
  }).join('\n')

  it('30 行无表头样本 → 30 人，首人「学生01」保留，headerSkipped 为空', () => {
    const r = parseSeatingRosterDetailed(sample30)
    expect(r.entries).toHaveLength(30)
    expect(r.entries[0]!.name).toBe('学生01')
    expect(r.entries[29]!.name).toBe('学生30')
    expect(r.headerSkipped).toEqual([])
    expect(r.columnMode).toBe(true)
    expect(parseSeatingRoster(sample30)).toHaveLength(30)
  })

  it('无表头时不猜考场列：rooms 为空；加上「姓名\\t考场\\t座位\\t宿舍」表头后 rooms 含 考场01/02 且仍 30 人', () => {
    expect(parseSeatingRosterDetailed(sample30).rooms).toEqual([])
    const withHeader = parseSeatingRosterDetailed(`姓名\t考场\t座位\t宿舍\n${sample30}`)
    expect(withHeader.entries).toHaveLength(30)
    expect(withHeader.headerSkipped).toEqual(['姓名', '考场', '座位', '宿舍'])
    expect(withHeader.rooms).toEqual([
      { id: '考场01', count: 15 },
      { id: '考场02', count: 15 },
    ])
    expect(withHeader.entries[0]).toEqual({ name: '学生01', room: '考场01' })
  })
})

describe('第 365 轮：roomsFitIndividually（「全部」视图假溢出判定）', () => {
  const roster59 = `姓名\t考场\n${Array.from({ length: 59 }, (_, i) => {
    const room = i < 20 ? '考场01' : i < 40 ? '考场02' : '考场03'
    return `学生${String(i + 1).padStart(2, '0')}\t${room}`
  }).join('\n')}`

  it('59 人 × 3 考场（20/20/19）vs 6×8=48 座：合排超 11 人但各考场单独都坐得下 → true', () => {
    const r = parseSeatingRosterDetailed(roster59)
    expect(r.entries).toHaveLength(59)
    expect(r.rooms).toEqual([
      { id: '考场01', count: 20 },
      { id: '考场02', count: 20 },
      { id: '考场03', count: 19 },
    ])
    expect(unseatedEntries(r.entries, 6, 8)).toHaveLength(11)
    expect(roomsFitIndividually(r.rooms, 48)).toBe(true)
  })

  it('任一考场单独也排不下（60 人单考场 / 某考场 50 人）→ false，保留真实溢出提示', () => {
    expect(roomsFitIndividually([{ id: '考场01', count: 60 }], 48)).toBe(false)
    expect(
      roomsFitIndividually(
        [
          { id: '考场01', count: 50 },
          { id: '考场02', count: 9 },
        ],
        48,
      ),
    ).toBe(false)
  })

  it('无考场列或只有 1 个考场 → false（不启用引导）', () => {
    expect(roomsFitIndividually([], 48)).toBe(false)
    expect(roomsFitIndividually([{ id: '考场01', count: 10 }], 48)).toBe(false)
  })
})

describe('第 348 轮：seatingRosterTextFromTable（Excel 文件 → 名单文本 → 座位名单）', () => {
  it('有表头（姓名/性别/学号）：表头保留，解析后取姓名与性别列、忽略学号列', () => {
    const headers = ['学号', '姓名', '性别']
    const rows = [
      { 学号: '2024001', 姓名: '张三', 性别: '男' },
      { 学号: '2024002', 姓名: '李四', 性别: '女' },
      { 学号: '', 姓名: '', 性别: '' },
      { 学号: '2024003', 姓名: '王五', 性别: '男' },
    ]
    const text = seatingRosterTextFromTable(headers, rows)
    expect(text.split('\n')).toEqual([
      '学号\t姓名\t性别',
      '2024001\t张三\t男',
      '2024002\t李四\t女',
      '2024003\t王五\t男',
    ])
    const parsed = parseSeatingRosterDetailed(text)
    expect(parsed.columnMode).toBe(true)
    expect(parsed.headerSkipped).toEqual(['学号', '姓名', '性别'])
    expect(parsed.ignoredColumns).toEqual(['学号'])
    expect(parsed.genderColumn).toBe(true)
    expect(parsed.entries).toEqual([
      { name: '张三', gender: '男' },
      { name: '李四', gender: '女' },
      { name: '王五', gender: '男' },
    ])
  })

  it('无表头（parseExcelFile 把首行数据当表头）：首行不丢，全部映射为学生', () => {
    const headers = ['张三', '男']
    const rows = [
      { 张三: '李四', 男: '女' },
      { 张三: '王五', 男: '男' },
    ]
    const text = seatingRosterTextFromTable(headers, rows)
    expect(text).toBe('张三\t男\n李四\t女\n王五\t男')
    const parsed = parseSeatingRosterDetailed(text)
    expect(parsed.headerSkipped).toEqual([])
    expect(parsed.entries).toEqual([
      { name: '张三', gender: '男' },
      { name: '李四', gender: '女' },
      { name: '王五', gender: '男' },
    ])
  })

  it('单列无表头：首行姓名不丢，逐行一人', () => {
    const text = seatingRosterTextFromTable(['张三'], [{ 张三: '李四' }, { 张三: '王五' }])
    expect(parseSeatingRosterDetailed(text).entries.map((e) => e.name)).toEqual(['张三', '李四', '王五'])
  })

  it('自动列名「列N」的表头行整行省略；追加到已有内容时真表头不再输出', () => {
    expect(seatingRosterTextFromTable(['列1', '列2'], [{ 列1: '张三', 列2: '男' }])).toBe('张三\t男')
    expect(
      seatingRosterTextFromTable(['姓名', '性别'], [{ 姓名: '张三', 性别: '男' }], false),
    ).toBe('张三\t男')
    // 首行实为数据时，includeHeader=false 也不能丢人
    expect(seatingRosterTextFromTable(['张三', '男'], [{ 张三: '李四', 男: '女' }], false)).toBe(
      '张三\t男\n李四\t女',
    )
  })

  it('30 行带表头的工作表映射为 30 位学生', () => {
    const headers = ['序号', '姓名', '班级']
    const rows = Array.from({ length: 30 }, (_, i) => ({
      序号: String(i + 1),
      姓名: `学生${i + 1}`,
      班级: '高三（2）班',
    }))
    const parsed = parseSeatingRosterDetailed(seatingRosterTextFromTable(headers, rows))
    expect(parsed.entries).toHaveLength(30)
    expect(parsed.entries[0]!.name).toBe('学生1')
    expect(parsed.entries[29]!.name).toBe('学生30')
  })
})

describe('shuffleEntries', () => {
  it('保留全部成员且不改原数组', () => {
    const src = [1, 2, 3, 4, 5]
    const out = shuffleEntries(src, () => 0.42)
    expect(out).toHaveLength(5)
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5])
    expect(src).toEqual([1, 2, 3, 4, 5])
  })
})

describe('interleaveByGender', () => {
  it('相邻座位男女交替', () => {
    const entries = parseSeatingRoster('甲 男\n乙 男\n丙 女\n丁 女')
    const out = interleaveByGender(entries, () => 0.3)
    expect(out).toHaveLength(4)
    for (let i = 1; i < out.length; i++) {
      expect(out[i]!.gender).not.toBe(out[i - 1]!.gender)
    }
  })

  it('人数不均时多的一方在前，无性别成员补末尾', () => {
    const entries = parseSeatingRoster('甲 男\n乙 女\n丙 女\n丁 女\n戊')
    const out = interleaveByGender(entries, () => 0.6)
    expect(out[0]!.gender).toBe('女')
    expect(new Set(out.map((e) => e.name))).toEqual(new Set(['甲', '乙', '丙', '丁', '戊']))
    expect(out[out.length - 1]!.name).toBe('戊')
  })
})

describe('第 349 轮：名单重名合并 / 保留后缀', () => {
  const roster = '宇文成都 男\n张伟\n宇文成都 男\n李娜 女\n张伟 男'

  it('默认合并完全重名：同名只占一座，性别由后续条目补齐，返回被合并的重名', () => {
    const { entries, duplicates } = dedupeSeatingEntries(parseSeatingRoster(roster))
    expect(entries.map((e) => e.name)).toEqual(['宇文成都', '张伟', '李娜'])
    expect(entries[1]!.gender).toBe('男')
    expect(duplicates).toEqual(['宇文成都', '张伟'])
    // 排座后 38/39 不会出现同一人两座
    const seats = buildSeats(entries, 2, 2, 'rows')
    expect(seats.filter((s) => s.name === '宇文成都')).toHaveLength(1)
  })

  it('保留同名时按出现顺序加 ①② 后缀区分，不合并任何条目', () => {
    const { entries, duplicates } = dedupeSeatingEntries(parseSeatingRoster(roster), 'suffix')
    expect(entries.map((e) => e.name)).toEqual(['宇文成都①', '张伟①', '宇文成都②', '李娜', '张伟②'])
    expect(entries[2]!.gender).toBe('男')
    expect(duplicates).toEqual(['宇文成都', '张伟'])
  })

  it('无重名 / 空占位不受影响；后缀超过 ⑳ 回退 (n)', () => {
    const plain = [{ name: '甲' }, { name: '' }, { name: '乙' }]
    expect(dedupeSeatingEntries(plain)).toEqual({ entries: plain, duplicates: [] })
    expect(dedupeSeatingEntries([{ name: '' }, { name: '' }], 'suffix').entries).toEqual([
      { name: '' },
      { name: '' },
    ])
    expect(duplicateSuffix(1)).toBe('①')
    expect(duplicateSuffix(20)).toBe('⑳')
    expect(duplicateSuffix(21)).toBe('(21)')
  })
})

describe('unseatedEntries（第 364 轮）：超出座位数的名单条目', () => {
  it('52 人 48 座 → 返回座位数之后的 4 人，保持填充顺序', () => {
    const entries = Array.from({ length: 52 }, (_, i) => ({ name: `学生${i + 1}` }))
    const out = unseatedEntries(entries, 6, 8)
    expect(out.map((e) => e.name)).toEqual(['学生49', '学生50', '学生51', '学生52'])
  })

  it('不超员 / 恰好坐满 → 空数组；尾部空姓名条目被过滤', () => {
    const entries = Array.from({ length: 48 }, (_, i) => ({ name: `学生${i + 1}` }))
    expect(unseatedEntries(entries, 6, 8)).toEqual([])
    expect(unseatedEntries(entries.slice(0, 10), 6, 8)).toEqual([])
    expect(unseatedEntries([...entries, { name: '' }, { name: '甲' }, { name: '' }], 6, 8)).toEqual([{ name: '甲' }])
    expect(unseatedEntries([{ name: 'A' }], 0, 8)).toEqual([{ name: 'A' }])
  })
})

describe('第 368 轮：buildSeats 座位间隔 spacing（4 档 × 2 种填充顺序）', () => {
  const names = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `S${i + 1}` }))
  const FILLS: SeatingFillOrder[] = ['rows', 'serpentine']

  it('isSeatingSpacing 守卫：只接受 4 个已知值，旧状态的 undefined / 乱串不成立', () => {
    for (const s of SEATING_SPACINGS) expect(isSeatingSpacing(s)).toBe(true)
    expect(isSeatingSpacing(undefined)).toBe(false)
    expect(isSeatingSpacing('skip')).toBe(false)
    expect(isSeatingSpacing(1)).toBe(false)
  })

  it('seatCapacity：6×8 教室 none=48 / skipCol=24 / skipRow=24 / checker=24；5×5 奇数尺寸按实际可坐数', () => {
    expect(seatCapacity(6, 8, 'none')).toBe(48)
    expect(seatCapacity(6, 8, 'skipCol')).toBe(24)
    expect(seatCapacity(6, 8, 'skipRow')).toBe(24)
    expect(seatCapacity(6, 8, 'checker')).toBe(24)
    expect(seatCapacity(5, 5, 'skipCol')).toBe(10) // 每排第 2、4 列可坐
    expect(seatCapacity(5, 5, 'skipRow')).toBe(15) // 第 1、3、5 排可坐
    expect(seatCapacity(5, 5, 'checker')).toBe(13)
    expect(seatCapacity(0, 8, 'checker')).toBe(0)
  })

  it('验收场景：20 人进 6×8 选隔位 → 名单分布到 5 排而非堆在前 3 排，每排坐 4 人且左右不相邻', () => {
    const seats = buildSeats(names(20), 6, 8, 'rows', 'skipCol')
    expect(seats).toHaveLength(24)
    const filled = seats.filter((s) => s.name)
    expect(new Set(filled.map((s) => s.row))).toEqual(new Set([1, 2, 3, 4, 5]))
    for (let r = 1; r <= 5; r++) expect(filled.filter((s) => s.row === r)).toHaveLength(4)
    expect(filled.filter((s) => s.row === 1).map((s) => s.col)).toEqual([2, 4, 6, 8])
    for (const s of seats) expect(isSeatBlocked(s.row - 1, s.col - 1, 'skipCol')).toBe(false)
  })

  it.each(FILLS)('%s × skipCol：奇数列留空，座号连续，反序排仍守同一留空列', (fill) => {
    const seats = buildSeats(names(6), 3, 4, fill, 'skipCol')
    expect(seats).toHaveLength(6)
    expect(seats.map((s) => s.seatNo)).toEqual([1, 2, 3, 4, 5, 6])
    expect(seats.every((s) => s.col % 2 === 0)).toBe(true)
    expect(seats.slice(0, 2).map((s) => [s.row, s.col])).toEqual([[1, 2], [1, 4]])
    // 第 2 排：按行从左到右；S 形从右到左（列 4 → 列 2）
    expect(seats.slice(2, 4).map((s) => s.col)).toEqual(fill === 'rows' ? [2, 4] : [4, 2])
  })

  it.each(FILLS)('%s × skipRow：首排靠讲台照常坐，偶数排留空', (fill) => {
    const seats = buildSeats(names(8), 4, 3, fill, 'skipRow')
    expect(seats).toHaveLength(6)
    expect(new Set(seats.map((s) => s.row))).toEqual(new Set([1, 3]))
    expect(seats.map((s) => s.seatNo)).toEqual([1, 2, 3, 4, 5, 6])
    // 第 3 排（0 起为偶数排）在两种填充顺序下都是从左到右
    expect(seats.filter((s) => s.row === 3).map((s) => s.col)).toEqual([1, 2, 3])
  })

  it.each(FILLS)('%s × checker：相邻排错开，任两个座位前后左右都不相邻', (fill) => {
    const seats = buildSeats(names(8), 4, 4, fill, 'checker')
    expect(seats).toHaveLength(8)
    for (const s of seats) expect((s.row + s.col) % 2).toBe(0)
    for (const a of seats) {
      for (const b of seats) {
        if (a === b) continue
        const adjacent = Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1
        expect(adjacent).toBe(false)
      }
    }
    expect(seats.filter((s) => s.row === 2).map((s) => s.col)).toEqual(fill === 'rows' ? [2, 4] : [4, 2])
  })

  it.each(FILLS)('%s × none：与不传 spacing 完全一致（向后兼容）', (fill) => {
    expect(buildSeats(names(10), 3, 4, fill, 'none')).toEqual(buildSeats(names(10), 3, 4, fill))
  })

  it('溢出只数可坐座位：30 人进 6×8 隔位（24 座）→ 6 人未排座；不隔时 0 人', () => {
    const entries = names(30)
    expect(unseatedEntries(entries, 6, 8, 'skipCol').map((e) => e.name)).toEqual(['S25', 'S26', 'S27', 'S28', 'S29', 'S30'])
    expect(unseatedEntries(entries, 6, 8, 'checker')).toHaveLength(6)
    expect(unseatedEntries(entries, 6, 8, 'skipRow')).toHaveLength(6)
    expect(unseatedEntries(entries, 6, 8, 'none')).toEqual([])
    expect(unseatedEntries(entries, 6, 8)).toEqual([])
  })

  it('留空位置在座位网格中为 null，学生视角镜像后仍保持留空列', () => {
    const spacing: SeatingSpacing = 'skipCol'
    const seats = buildSeats(names(4), 2, 4, 'rows', spacing)
    const grid = buildSeatGrid(seats, 2, 4)
    expect(grid[0]!.map((s) => s?.name ?? null)).toEqual([null, 'S1', null, 'S2'])
    const student = buildDisplayGrid(grid, 4, new Set(), 'student')
    expect(student[0]!.map((c) => c.seat?.name ?? null)).toEqual(['S2', null, 'S1', null])
  })
})

describe('unseatedSummary（第 364 轮）：PNG 页脚未排座摘要', () => {
  const labels = { template: '另有 {n} 人未排座：{names}', etc: '等', join: (items: readonly string[]) => items.join('、') }

  it('无未排座返回空串；有则填入人数与姓名', () => {
    expect(unseatedSummary([], labels)).toBe('')
    expect(unseatedSummary([{ name: '甲' }, { name: '乙' }], labels)).toBe('另有 2 人未排座：甲、乙')
  })

  it('超过 10 人只列前 10 个并加「等」', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ name: `生${i + 1}` }))
    const out = unseatedSummary(many, labels)
    expect(out).toBe('另有 12 人未排座：生1、生2、生3、生4、生5、生6、生7、生8、生9、生10等')
    expect(unseatedSummary(many.slice(0, 10), labels).endsWith('等')).toBe(false)
  })
})
