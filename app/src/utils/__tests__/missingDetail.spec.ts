import { describe, expect, it } from 'vitest'

import { missingDetailText, missingExampleText } from '@/utils/missingDetail'

const zh = (k: string) => k
const EN: Record<string, string> = {
  '第 {n} 行': 'Row {n}',
  '为空': 'empty',
  '例：': 'e.g. ',
  '等 {n} 行': '({n} rows in total)',
  '姓名': 'Name',
  '座位号': 'Seat',
}
const en = (k: string) => EN[k] ?? k

describe('第 366 轮：missingDetail 共享口径', () => {
  it('missingDetailText 与 MappingPanel 既有格式一致（中 / 英）', () => {
    expect(missingDetailText({ rowIndex: 4, fields: ['姓名', '座位号'] }, 'zh', zh)).toBe('第 4 行：姓名、座位号 为空')
    expect(missingDetailText({ rowIndex: 4, fields: ['姓名', '座位号'] }, 'en', en)).toBe('Row 4: Name, Seat empty')
  })

  it('missingExampleText：首行行号 + 姓名 + 字段；多行加「等 N 行」；无姓名省略；无明细返回空串', () => {
    const details = [
      { rowIndex: 3, fields: ['座位号'], name: '张三' },
      { rowIndex: 7, fields: ['姓名'] },
    ]
    expect(missingExampleText(details, 2, 'zh', zh)).toBe('例：第 3 行 张三 · 座位号为空 等 2 行')
    expect(missingExampleText(details, 1, 'zh', zh)).toBe('例：第 3 行 张三 · 座位号为空')
    expect(missingExampleText(details, 2, 'en', en)).toBe('e.g. Row 3 张三 · Seat empty (2 rows in total)')
    expect(missingExampleText([{ rowIndex: 7, fields: ['姓名'] }], 1, 'zh', zh)).toBe('例：第 7 行 · 姓名为空')
    expect(missingExampleText([], 0, 'zh', zh)).toBe('')
  })
})
