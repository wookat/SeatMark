import { describe, expect, it } from 'vitest'

import {
  buildDisplayGrid,
  buildSeatGrid,
  buildSeats,
  interleaveByGender,
  parseSeatingRoster,
  parseSeatingRosterDetailed,
  seatingExportFileName,
  shuffleEntries,
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
