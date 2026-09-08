import { describe, expect, it } from 'vitest'

import { looksLikeHeaderRow, parsePastedRoster } from '@/utils/excel'

describe('第 367 轮：粘贴导入表头关键词扩充', () => {
  it('会务名单「与会人员 / 头衔 / 公司」首行识别为表头，6 人得到 6 条而非 7 条', () => {
    const names = ['张伟', '王芳', '李娜', '刘洋', '陈静', '杨帆']
    const text = ['与会人员\t头衔\t公司', ...names.map((n, i) => `${n}\t总监${i}\t公司${i}`)].join('\n')
    const parsed = parsePastedRoster(text)
    expect(parsed.headerDetected).toBe(true)
    expect(parsed.headers).toEqual(['与会人员', '头衔', '公司'])
    expect(parsed.rows).toHaveLength(6)
    expect(parsed.rows.map((r) => r['与会人员'])).toEqual(names)
  })

  it.each([
    ['嘉宾\t职称\t科室', ['嘉宾', '职称', '科室']],
    ['代表\t系别\t专业\t年级', ['代表', '系别', '专业', '年级']],
    ['姓名\t桌次\t席位', ['姓名', '桌次', '席位']],
    ['Title\tCompany\tEmail', ['Title', 'Company', 'Email']],
    ['Name\tDept\tGrade\tSeat', ['Name', 'Dept', 'Grade', 'Seat']],
  ])('新关键词表头 %s 被识别', (header, expected) => {
    const parsed = parsePastedRoster(`${header}\n甲\t乙\t丙\t丁`)
    expect(parsed.headerDetected).toBe(true)
    expect(parsed.headers.slice(0, expected.length)).toEqual(expected)
  })

  it('「张三 / 李四」两列人名不被误判为表头', () => {
    const parsed = parsePastedRoster('张三\t李四\n王五\t赵六')
    expect(parsed.headerDetected).toBe(false)
    expect(parsed.headers).toEqual(['姓名', '列2'])
    expect(parsed.rows).toHaveLength(2)
  })

  it('含数字的单元格即使命中关键词也不算列名（「桌次3 / 席位12」是数据）', () => {
    const parsed = parsePastedRoster('桌次3\t席位12\n桌次3\t席位13')
    expect(parsed.headerDetected).toBe(false)
  })
})

describe('第 367 轮：looksLikeHeaderRow 提醒启发式', () => {
  it.each([
    [['与会人员', '头衔', '公司']],
    [['来宾', '身份', '备注']],
    [['Guest', 'Role', 'Org']],
    [['名单', '分组']],
  ])('正例：多列短词且不含数字 %j → true', (row) => {
    expect(looksLikeHeaderRow(row)).toBe(true)
  })

  it.each([
    [['姓名']],
    [['张伟', '高三（1）班', '01']],
    [['来宾', '身份证号码后六位', '备注']],
    [['与会人员', '', '公司']],
    [[]],
  ])('反例：单列 / 含数字 / 过长 / 空格 %j → false', (row) => {
    expect(looksLikeHeaderRow(row)).toBe(false)
  })
})
