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

  it('合并表头留下的空洞列不再丢失数据（表头补「列N」）', async () => {
    const file = await buildFile([
      ['姓名', '部门职务'],
      ['张三', '教务处', '主任'],
      ['李四', '招生办', '科员'],
    ])
    const parsed = await parseExcelFile(file)
    expect(parsed.headers).toEqual(['姓名', '部门职务', '列3'])
    expect(parsed.rows[0]).toEqual({ 姓名: '张三', 部门职务: '教务处', 列3: '主任' })
  })

  it('自动跳过前置大标题行与空行定位真实表头', async () => {
    const file = await buildFile([
      ['2026 年监考安排表'],
      [],
      ['姓名', '考场'],
      ['张三', '第1考场'],
    ])
    const parsed = await parseExcelFile(file)
    expect(parsed.headers).toEqual(['姓名', '考场'])
    expect(parsed.rows).toEqual([{ 姓名: '张三', 考场: '第1考场' }])
  })

  it('单列名单不误跳表头（含长表头名）', async () => {
    const file = await buildFile([['参会人员姓名列表'], ['张三'], ['李四']])
    const parsed = await parseExcelFile(file)
    expect(parsed.headers).toEqual(['参会人员姓名列表'])
    expect(parsed.rows).toHaveLength(2)
  })

  it('csv 文件可正常解析', async () => {
    const csv = '姓名,座位号\n张三,1\n李四,2\n'
    const file = new File(['\ufeff' + csv], 'roster.csv')
    const parsed = await parseExcelFile(file)
    expect(parsed.headers).toEqual(['姓名', '座位号'])
    expect(parsed.rows).toHaveLength(2)
  })

  it('多 sheet 文件返回全部工作表名，并可解析指定工作表', async () => {
    const XLSX = await import('xlsx')
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['姓名'],
        ['张三'],
      ]),
      '甲',
    )
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['姓名', '部门'],
        ['李四', '教务处'],
        ['王五', '招生办'],
      ]),
      '乙',
    )
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const file = new File([buffer], 'multi.xlsx')

    const first = await parseExcelFile(file)
    expect(first.sheetName).toBe('甲')
    expect(first.sheetNames).toEqual(['甲', '乙'])
    expect(first.rows).toHaveLength(1)

    const second = await parseExcelFile(file, '乙')
    expect(second.sheetName).toBe('乙')
    expect(second.headers).toEqual(['姓名', '部门'])
    expect(second.rows).toHaveLength(2)
  })

  it('只有表头时报错', async () => {
    const file = await buildFile([['姓名', '座位号']])
    await expect(parseExcelFile(file)).rejects.toThrow('至少需要包含表头行和一行数据')
  })
})
