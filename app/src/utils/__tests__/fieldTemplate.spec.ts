import { describe, expect, it } from 'vitest'

import {
  evaluateFieldTemplate,
  isCompositeMapping,
  templateColumns,
  templateColumnsValid,
} from '@/utils/fieldTemplate'

const HEADERS = ['姓名', '考场', '座位号']
const ROW = { 姓名: '张伟', 考场: '3', 座位号: '01' }

describe('组合字段模板串', () => {
  it('识别组合映射：含 {列名} 且不是真实表头', () => {
    expect(isCompositeMapping('第{考场}考场-{座位号}号', HEADERS)).toBe(true)
    expect(isCompositeMapping('姓名', HEADERS)).toBe(false)
    expect(isCompositeMapping('', HEADERS)).toBe(false)
    expect(isCompositeMapping('没有占位符', HEADERS)).toBe(false)
  })

  it('表头本身带花括号时按普通列处理', () => {
    expect(isCompositeMapping('{奇怪列}', ['{奇怪列}'])).toBe(false)
  })

  it('提取模板串引用的列名（去重、去空白）', () => {
    expect(templateColumns('第{考场}考场-{座位号}号（{考场}）')).toEqual(['考场', '座位号'])
    expect(templateColumns('{ 姓名 }同学')).toEqual(['姓名'])
    expect(templateColumns('纯文本')).toEqual([])
  })

  it('模板串求值：占位符替换为单元格文本', () => {
    expect(evaluateFieldTemplate('第{考场}考场-{座位号}号', ROW)).toBe('第3考场-01号')
    expect(evaluateFieldTemplate('{姓名}（{考场}）', ROW)).toBe('张伟（3）')
  })

  it('缺失列按空串处理，不报错', () => {
    expect(evaluateFieldTemplate('{不存在}-{姓名}', ROW)).toBe('-张伟')
  })

  it('校验模板串引用的列是否都在表头中', () => {
    expect(templateColumnsValid('第{考场}考场-{座位号}号', HEADERS)).toBe(true)
    expect(templateColumnsValid('{不存在}{姓名}', HEADERS)).toBe(false)
  })
})
