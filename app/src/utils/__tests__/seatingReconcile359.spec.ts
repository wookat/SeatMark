/**
 * 第 359 轮 P1/P2：名单修改后对齐手工座次（reconcileArranged）+ 名单「考场」列识别与筛选。
 */
import { describe, expect, it } from 'vitest'

import {
  dedupeSeatingEntries,
  parseSeatingRosterDetailed,
  reconcileArranged,
  seatingExportFileName,
  type SeatingEntry,
} from '../seating'

const n = (name: string, gender?: '男' | '女'): SeatingEntry => (gender ? { name, gender } : { name })

describe('reconcileArranged（第 359 轮 P1）', () => {
  const arranged = [n('王芳'), n('张伟'), n('李娜'), n('赵六')]

  it('末尾追加 1 人：原 4 人座位不变，新人追加到末尾', () => {
    const r = reconcileArranged(arranged, [n('张伟'), n('王芳'), n('李娜'), n('赵六'), n('周七')])
    expect(r.entries.map((e) => e.name)).toEqual(['王芳', '张伟', '李娜', '赵六', '周七'])
    expect(r).toMatchObject({ kept: 4, added: 1, removed: 0 })
  })

  it('删除中间 1 人：原座位留空，其他人座位号不变', () => {
    const r = reconcileArranged(arranged, [n('王芳'), n('李娜'), n('赵六')])
    expect(r.entries.map((e) => e.name)).toEqual(['王芳', '', '李娜', '赵六'])
    expect(r).toMatchObject({ kept: 3, added: 0, removed: 1 })
  })

  it('改名 1 人：旧名移除留空、新名追加到末尾', () => {
    const r = reconcileArranged(arranged, [n('张伟伟'), n('王芳'), n('李娜'), n('赵六')])
    expect(r.entries.map((e) => e.name)).toEqual(['王芳', '', '李娜', '赵六', '张伟伟'])
    expect(r).toMatchObject({ kept: 3, added: 1, removed: 1 })
  })

  it('末尾的人改名：末尾空位先裁掉，新名落在原座位数内', () => {
    const r = reconcileArranged(arranged, [n('张伟'), n('王芳'), n('李娜'), n('赵六六')])
    expect(r.entries.map((e) => e.name)).toEqual(['王芳', '张伟', '李娜', '赵六六'])
    expect(r).toMatchObject({ kept: 3, added: 1, removed: 1 })
  })

  it('保留同名下新增一位同名：原「张伟」对齐「张伟①」，「张伟②」追加', () => {
    const next = dedupeSeatingEntries([n('张伟'), n('王芳'), n('张伟')], 'suffix').entries
    const r = reconcileArranged([n('王芳'), n('张伟')], next)
    expect(r.entries.map((e) => e.name)).toEqual(['王芳', '张伟①', '张伟②'])
    expect(r).toMatchObject({ kept: 2, added: 1, removed: 0 })
  })

  it('重名两位（保留同名 ①②）删其一：只移除对应后缀的那位', () => {
    const roster = dedupeSeatingEntries([n('宇文成都'), n('张伟'), n('宇文成都')], 'suffix').entries
    const shuffled = [roster[2]!, roster[0]!, roster[1]!] // 宇文成都② 宇文成都① 张伟
    const next = dedupeSeatingEntries([n('宇文成都'), n('张伟')], 'suffix').entries
    const r = reconcileArranged(shuffled, next)
    expect(r.entries.map((e) => e.name)).toEqual(['', '宇文成都', '张伟'])
    expect(r).toMatchObject({ kept: 2, added: 0, removed: 1 })
  })

  it('整份替换：kept 为 0，由视图层还原为名单顺序', () => {
    const r = reconcileArranged(arranged, [n('甲'), n('乙')])
    expect(r.kept).toBe(0)
    expect(r.removed).toBe(4)
    expect(r.added).toBe(2)
  })

  it('保留的人取名单新值（补上性别），拖拽后的末尾空位裁掉后再追加新人', () => {
    const padded = [n('王芳'), n('张伟'), { name: '' }, { name: '' }]
    const r = reconcileArranged(padded, [n('张伟', '男'), n('王芳', '女'), n('周七')])
    expect(r.entries).toEqual([n('王芳', '女'), n('张伟', '男'), n('周七')])
  })
})

describe('名单「考场」列（第 359 轮 P2）', () => {
  const text = [
    '姓名\t考场\t性别',
    '张伟\t01\t男',
    '王芳\t01\t女',
    '李娜\t02\t女',
    '赵六\t02\t男',
    '周七\t02\t男',
  ].join('\n')

  it('中文表头「考场」识别为考场列：不进 ignoredColumns，rooms 按出现顺序统计', () => {
    const r = parseSeatingRosterDetailed(text)
    expect(r.ignoredColumns).toEqual([])
    expect(r.rooms).toEqual([
      { id: '01', count: 2 },
      { id: '02', count: 3 },
    ])
    expect(r.entries[0]).toEqual({ name: '张伟', gender: '男', room: '01' })
    expect(r.entries.filter((e) => e.room === '02').map((e) => e.name)).toEqual(['李娜', '赵六', '周七'])
  })

  it('英文表头 Room / Exam Room 同样识别', () => {
    const en = parseSeatingRosterDetailed('Name\tRoom\tGender\nTom\tA\tM\nAmy\tB\tF')
    expect(en.rooms).toEqual([
      { id: 'A', count: 1 },
      { id: 'B', count: 1 },
    ])
    const en2 = parseSeatingRosterDetailed('Name\tExam Room\nTom\tA\nAmy\tA')
    expect(en2.rooms).toEqual([{ id: 'A', count: 2 }])
    expect(en2.ignoredColumns).toEqual([])
  })

  it('无表头时不猜测考场列：数字列仍按附属列忽略，rooms 为空', () => {
    const r = parseSeatingRosterDetailed('张伟\t01\t男\n王芳\t02\t女\n李娜\t02\t女')
    expect(r.rooms).toEqual([])
    expect(r.entries.every((e) => e.room === undefined)).toBe(true)
    expect(r.ignoredColumns).toHaveLength(1)
  })

  it('纯姓名 / 「姓名 性别」名单 rooms 为空', () => {
    expect(parseSeatingRosterDetailed('张三\n李四').rooms).toEqual([])
    expect(parseSeatingRosterDetailed('姓名\t性别\n张伟\t男\n王芳\t女').rooms).toEqual([])
  })

  it('去重后 room 保留，可按考场过滤', () => {
    const deduped = dedupeSeatingEntries(parseSeatingRosterDetailed(text).entries, 'merge').entries
    expect(deduped.filter((e) => e.room === '01').map((e) => e.name)).toEqual(['张伟', '王芳'])
  })

  it('导出文件名附「-考场X」，无筛选时保持原样', () => {
    const labels = { fallback: '教室座位表', teacher: '教师视角', student: '学生视角', room: '考场' }
    expect(seatingExportFileName('期末考试', 'teacher', labels, '02')).toBe('期末考试-考场02-教师视角')
    expect(seatingExportFileName('期末考试', 'student', labels)).toBe('期末考试-学生视角')
    expect(seatingExportFileName('期末考试', 'teacher', labels, 'A/1')).toBe('期末考试-考场A1-教师视角')
  })
})
