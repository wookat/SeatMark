import { describe, expect, it } from 'vitest'

import { interleaveByGender, parseSeatingRoster, shuffleEntries } from '../seating'

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
