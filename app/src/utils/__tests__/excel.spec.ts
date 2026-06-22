import { describe, expect, it } from 'vitest'

import { makeDemoRows, parseExcelFile } from '@/utils/excel'

describe('makeDemoRows', () => {
  it('生成指定数量的演示数据，座位号补零', () => {
    const { headers, rows } = makeDemoRows(30)
    expect(headers).toEqual([
      '姓名',
      '性别',
      '考场',
      '座位号',
      '准考证号',
      '班级',
      '学号',
      '学校',
      '身份证号',
      '部门',
      '职务',
      '工号',
      '单位',
    ])
    expect(rows).toHaveLength(30)
    expect(rows[0]!['座位号']).toBe('01')
    expect(rows[0]!['考场']).toBe('第1考场')
    expect(rows[15]!['考场']).toBe('第2考场')
  })

  it('准考证号唯一', () => {
    const { rows } = makeDemoRows(30)
    const ids = new Set(rows.map((r) => r['准考证号']))
    expect(ids.size).toBe(30)
  })
})

describe('parseExcelFile', () => {
  async function buildFile(aoa: unknown[][]): Promise<File> {
    const XLSX = await import('xlsx')
    const sheet = XLSX.utils.aoa_to_sheet(aoa)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1')
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    return new File([buffer], 'test.xlsx')
  }

  it('解析表头与数据行，数字转为字符串', async () => {
    const file = await buildFile([
      ['姓名', '座位号'],
      ['张三', 1],
      ['李四', 2],
    ])
    const parsed = await parseExcelFile(file)
    expect(parsed.sheetName).toBe('Sheet1')
    expect(parsed.headers).toEqual(['姓名', '座位号'])
    expect(parsed.rows).toEqual([
      { 姓名: '张三', 座位号: '1' },
      { 姓名: '李四', 座位号: '2' },
    ])
  })

  it('空表头列自动命名为「列N」，整行为空的数据被过滤', async () => {
    const file = await buildFile([
      ['姓名', ''],
      ['张三', 'A'],
      ['', ''],
      ['李四', 'B'],
    ])
    const parsed = await parseExcelFile(file)
    expect(parsed.headers).toEqual(['姓名', '列2'])
    expect(parsed.rows).toHaveLength(2)
  })

  it('只有表头时报错', async () => {
    const file = await buildFile([['姓名', '座位号']])
    await expect(parseExcelFile(file)).rejects.toThrow('至少需要包含表头行和一行数据')
  })
})
