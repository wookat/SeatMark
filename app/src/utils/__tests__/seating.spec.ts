import { describe, expect, it } from 'vitest'

import {
  interleaveByGender,
  parseSeatingRoster,
  parseSeatingRosterDetailed,
  shuffleEntries,
} from '../seating'

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
