import { describe, expect, it } from 'vitest'

import { demoGenderOf } from '@/data/demoDatasets'
import { dedupeDataRows, makeDemoRows, parseExcelFile, parsePastedRoster } from '@/utils/excel'
import { IMPORT_MAX_ROWS, IMPORT_TOO_MANY_ROWS_MESSAGE } from '@/utils/importLimits'

describe('dedupeDataRows', () => {
  it('去除完全重复的行并保留首次出现顺序', () => {
    const headers = ['姓名', '班级']
    const rows = [
      { 姓名: '张伟', 班级: '一班' },
      { 姓名: '李娜', 班级: '一班' },
      { 姓名: '张伟', 班级: '一班' },
      { 姓名: '张伟', 班级: '二班' },
    ]
    const out = dedupeDataRows(rows, headers)
    expect(out.removed).toBe(1)
    expect(out.rows.map((r) => `${r['姓名']}-${r['班级']}`)).toEqual([
      '张伟-一班',
      '李娜-一班',
      '张伟-二班',
    ])
  })
})

describe('parsePastedRoster', () => {
  it('Excel 复制的 TSV：首行含列名关键词时作为表头', () => {
    const parsed = parsePastedRoster('姓名\t班级\t座位号\n张伟\t高三（1）班\t01\n王芳\t高三（1）班\t02\n')
    expect(parsed.headerDetected).toBe(true)
    expect(parsed.headers).toEqual(['姓名', '班级', '座位号'])
    expect(parsed.rows).toEqual([
      { 姓名: '张伟', 班级: '高三（1）班', 座位号: '01' },
      { 姓名: '王芳', 班级: '高三（1）班', 座位号: '02' },
    ])
  })

  it('纯姓名列表：无表头时首列自动命名「姓名」，空行忽略', () => {
    const parsed = parsePastedRoster('张伟\n\n王芳\n李娜\n')
    expect(parsed.headerDetected).toBe(false)
    expect(parsed.headers).toEqual(['姓名'])
    expect(parsed.rows.map((r) => r['姓名'])).toEqual(['张伟', '王芳', '李娜'])
  })

  it('逗号/顿号分隔与 CRLF：整段统一分列，缺列补空', () => {
    const parsed = parsePastedRoster('张伟，男\r\n王芳、女\r\n李娜\r\n')
    expect(parsed.headers).toEqual(['姓名', '列2'])
    expect(parsed.rows).toEqual([
      { 姓名: '张伟', 列2: '男' },
      { 姓名: '王芳', 列2: '女' },
      { 姓名: '李娜', 列2: '' },
    ])
  })

  it('空格分隔与全角空格归一化；重名表头加序号', () => {
    const spaced = parsePastedRoster('张伟　男\n王芳 女\n')
    expect(spaced.headers).toEqual(['姓名', '列2'])
    expect(spaced.rows[0]).toEqual({ 姓名: '张伟', 列2: '男' })

    const dup = parsePastedRoster('姓名\t姓名\n张伟\t备用\n')
    expect(dup.headers).toEqual(['姓名', '姓名2'])
  })

  it('firstRowHeader 显式指定时覆盖关键词启发式', () => {
    // 单列首行含「手机」子串：r360 起单列仅首格恰为姓名类列名才当表头，自动判定不再误判；显式指定仍以用户为准
    const auto = parsePastedRoster('张伟手机甲\n张伟手机乙\n')
    expect(auto.headerDetected).toBe(false)
    expect(auto.rows).toHaveLength(2)

    const fixed = parsePastedRoster('张伟手机甲\n张伟手机乙\n', false)
    expect(fixed.headerDetected).toBe(false)
    expect(fixed.headers).toEqual(['姓名'])
    expect(fixed.rows.map((r) => r['姓名'])).toEqual(['张伟手机甲', '张伟手机乙'])

    const forced = parsePastedRoster('张伟\t男\n王芳\t女\n', true)
    expect(forced.headerDetected).toBe(true)
    expect(forced.headers).toEqual(['张伟', '男'])
    expect(forced.rows).toHaveLength(1)
  })

  it('零宽空格与 BOM 剥离；emoji ZWJ 序列保留', () => {
    const parsed = parsePastedRoster('\ufeff姓名\n\u200b张伟\u200b\n👨‍👩‍👧‍👦\n')
    expect(parsed.headerDetected).toBe(true)
    expect(parsed.headers).toEqual(['姓名'])
    expect(parsed.rows.map((r) => r['姓名'])).toEqual(['张伟', '👨‍👩‍👧‍👦'])
  })

  it('空文本返回空结果', () => {
    expect(parsePastedRoster('  \n \n')).toEqual({ headers: [], rows: [], headerDetected: false })
  })
})

describe('第 360 轮：表头判定只统计不含数字的单元格', () => {
  const sample30 = Array.from({ length: 30 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0')
    const room = i < 15 ? '考场01' : '考场02'
    const seat = String((i % 15) + 1).padStart(2, '0')
    return `学生${n}\t${room}\t座位${seat}\t宿舍${300 + i}`
  }).join('\n')

  it('首行「学生01\\t考场01\\t座位12\\t宿舍302」是数据：30 行进 30 行出，首人保留', () => {
    const parsed = parsePastedRoster(sample30)
    expect(parsed.headerDetected).toBe(false)
    expect(parsed.rows).toHaveLength(30)
    expect(parsed.headers).toEqual(['姓名', '列2', '列3', '列4'])
    expect(parsed.rows[0]).toEqual({ 姓名: '学生01', 列2: '考场01', 列3: '座位01', 列4: '宿舍300' })
  })

  it('「姓名\\t考场\\t座位号」真表头仍识别', () => {
    const parsed = parsePastedRoster('姓名\t考场\t座位号\n学生01\t考场01\t12\n')
    expect(parsed.headerDetected).toBe(true)
    expect(parsed.headers).toEqual(['姓名', '考场', '座位号'])
    expect(parsed.rows).toEqual([{ 姓名: '学生01', 考场: '考场01', 座位号: '12' }])
  })

  it('「Name\\tRoom」英文表头仍识别', () => {
    const parsed = parsePastedRoster('Name\tRoom\nTom\tRoom 1\n')
    expect(parsed.headerDetected).toBe(true)
    expect(parsed.headers).toEqual(['Name', 'Room'])
    expect(parsed.rows).toEqual([{ Name: 'Tom', Room: 'Room 1' }])
  })

  it('多列首行只有带数字的关键词格（班级2 / 学号2021）不当表头；混有一格纯列名则当表头', () => {
    expect(parsePastedRoster('张伟\t班级2\t学号2021\n王芳\t班级3\t学号2022\n').headerDetected).toBe(false)
    expect(parsePastedRoster('姓名\t班级2\n张伟\t班级3\n').headerDetected).toBe(true)
  })

  it('单列仅首格恰为姓名 / 名字 / name 才当表头', () => {
    for (const header of ['姓名', '名字', 'name', 'Name']) {
      const parsed = parsePastedRoster(`${header}\n张伟\n`)
      expect(parsed.headerDetected, header).toBe(true)
      expect(parsed.rows.map((r) => r[header])).toEqual(['张伟'])
    }
    for (const first of ['学生姓名张伟', '考场01', 'Student1', '张伟手机']) {
      const parsed = parsePastedRoster(`${first}\n王芳\n`)
      expect(parsed.headerDetected, first).toBe(false)
      expect(parsed.rows.map((r) => r['姓名'])).toEqual([first, '王芳'])
    }
  })

  it('显式 firstRowHeader 仍覆盖启发式', () => {
    expect(parsePastedRoster(sample30, true).rows).toHaveLength(29)
    expect(parsePastedRoster('姓名\t考场\n张伟\t考场01\n', false).rows).toHaveLength(2)
  })
})

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

  it('第 369 轮：性别列与 demoGenderOf(姓名) 一致，姓名不重复，无「李娜 男」错配', () => {
    const { rows } = makeDemoRows(30)
    expect(new Set(rows.map((r) => r['姓名'])).size).toBe(30)
    for (const row of rows) {
      const name = row['姓名']!
      expect(demoGenderOf(name), name).toBeDefined()
      expect(row['性别'], name).toBe(demoGenderOf(name))
    }
    const byName = new Map(rows.map((r) => [r['姓名'], r['性别']]))
    expect(byName.get('李娜')).toBe('女')
    expect(byName.get('陈静')).toBe('女')
    expect(byName.get('张伟')).toBe('男')
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

  it('重名列自动加序号后缀，两列数据都保留', async () => {
    const file = await buildFile([
      ['姓名', '姓名', '姓名2'],
      ['甲一', '乙一', '丙一'],
    ])
    const parsed = await parseExcelFile(file)
    expect(parsed.headers).toEqual(['姓名', '姓名2', '姓名22'])
    expect(parsed.rows[0]).toEqual({ 姓名: '甲一', 姓名2: '乙一', 姓名22: '丙一' })
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

  it('改名为 .xlsx 的非 ZIP 内容被拒绝，不走 CSV 回退', async () => {
    const file = new File(['姓名,座位号\n张三,1\n'], 'fake.xlsx')
    await expect(parseExcelFile(file)).rejects.toThrow('不是有效的 .xlsx 工作簿')
  })

  it('CFB 容器（密码保护的 Office 文件）给出解除密码的专门提示', async () => {
    const cfb = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    const file = new File([cfb], 'protected.xlsx')
    await expect(parseExcelFile(file)).rejects.toThrow('可能被密码保护')
  })

  it('无 BOM 的 UTF-8 CSV 中文表头正常解析（不乱码）', async () => {
    const csv = '姓名,座位号\n张三,1\n李四,2\n'
    const file = new File([new TextEncoder().encode(csv)], 'roster.csv')
    const parsed = await parseExcelFile(file)
    expect(parsed.headers).toEqual(['姓名', '座位号'])
    expect(parsed.rows[0]!['姓名']).toBe('张三')
  })

  it('带 BOM 的 UTF-8 CSV 正常解析且表头不带 BOM 字符', async () => {
    const csv = '\ufeff姓名,座位号\n张三,1\n'
    const file = new File([new TextEncoder().encode(csv)], 'roster.csv')
    const parsed = await parseExcelFile(file)
    expect(parsed.headers).toEqual(['姓名', '座位号'])
  })

  it('GB18030 编码的 CSV 中文表头正常解析', async () => {
    // 「姓名,座位号\n张三,1\n」的 GBK/GB18030 字节
    const gbk = new Uint8Array([
      0xd0, 0xd5, 0xc3, 0xfb, 0x2c, 0xd7, 0xf9, 0xce, 0xbb, 0xba, 0xc5, 0x0a,
      0xd5, 0xc5, 0xc8, 0xfd, 0x2c, 0x31, 0x0a,
    ])
    const file = new File([gbk], 'roster.csv')
    const parsed = await parseExcelFile(file)
    expect(parsed.headers).toEqual(['姓名', '座位号'])
    expect(parsed.rows[0]!['姓名']).toBe('张三')
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

  it('数字格式单元格按 Excel 所见格式化文本读取（日期/时间/前导零/百分比/小数位）', async () => {
    const XLSX = await import('xlsx')
    const sheet = XLSX.utils.aoa_to_sheet([
      ['姓名', '考试日期', '入场时间', '工号', '出勤率', '分数'],
      ['张伟', 0, 0, 0, 0, 0],
    ])
    sheet['B2'] = { t: 'n', v: 46249, z: 'yyyy/m/d' }
    sheet['C2'] = { t: 'n', v: 0.5625, z: 'h:mm' }
    sheet['D2'] = { t: 'n', v: 7, z: '000' }
    sheet['E2'] = { t: 'n', v: 0.985, z: '0.0%' }
    sheet['F2'] = { t: 'n', v: 12345.678, z: '0.00' }
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1')
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const file = new File([buffer], 'fmt.xlsx')

    const parsed = await parseExcelFile(file)
    expect(parsed.rows[0]).toEqual({
      姓名: '张伟',
      考试日期: '2026/8/15',
      入场时间: '13:30',
      工号: '007',
      出勤率: '98.5%',
      分数: '12345.68',
    })
  })

  it('只有表头时报错', async () => {
    const file = await buildFile([['姓名', '座位号']])
    await expect(parseExcelFile(file)).rejects.toThrow('至少需要包含表头行和一行数据')
  })

  describe('第 372 轮：行数预算护栏', () => {
    it('!ref 声明到第 50000 行但只有 100 行真实数据（其余仅格式）仍成功导入', async () => {
      const XLSX = await import('xlsx')
      const aoa: unknown[][] = [['姓名', '座位号']]
      for (let i = 1; i <= 100; i++) aoa.push([`学生${i}`, i])
      const sheet = XLSX.utils.aoa_to_sheet(aoa)
      sheet['!ref'] = 'A1:B50000'
      // 模拟仅设置了单元格格式而无内容的尾部单元格（SheetJS 读取带格式的空格时也会留下 t:'z' 单元格）
      sheet['A49999'] = { t: 'z' }
      sheet['B50000'] = { t: 's', v: '' }
      expect(sheet['!ref']).toBe('A1:B50000')
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1')
      const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
      const file = new File([buffer], 'wide-ref.xlsx')

      const result = await parseExcelFile(file)
      expect(result.headers).toEqual(['姓名', '座位号'])
      expect(result.rows).toHaveLength(100)
      expect(result.rows[99]).toEqual({ 姓名: '学生100', 座位号: '100' })
    })

    it(`${IMPORT_MAX_ROWS + 1} 行真实数据被拒（错误文案与行数上限一致）`, async () => {
      const aoa: unknown[][] = [['姓名', '座位号']]
      for (let i = 1; i <= IMPORT_MAX_ROWS + 1; i++) aoa.push([`学生${i}`, i])
      const file = await buildFile(aoa)
      await expect(parseExcelFile(file)).rejects.toThrow(IMPORT_TOO_MANY_ROWS_MESSAGE)
    })

    it('恰好 IMPORT_MAX_ROWS 行数据（带前置标题行）仍在范围内，正常导入', async () => {
      const aoa: unknown[][] = [['2026 年春季学期期末考试考场安排表'], [], ['姓名', '座位号']]
      for (let i = 1; i <= IMPORT_MAX_ROWS; i++) aoa.push([`学生${i}`, i])
      const file = await buildFile(aoa)
      const result = await parseExcelFile(file)
      expect(result.rows).toHaveLength(IMPORT_MAX_ROWS)
    })

    it('数据行本身在范围内、但范围之外还有一行非空内容 → 按行数超限拒绝', async () => {
      const XLSX = await import('xlsx')
      const aoa: unknown[][] = [['姓名', '座位号']]
      for (let i = 1; i <= 10; i++) aoa.push([`学生${i}`, i])
      const sheet = XLSX.utils.aoa_to_sheet(aoa)
      sheet['!ref'] = 'A1:B20000'
      sheet['A20000'] = { t: 's', v: '漏网之鱼' }
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1')
      const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
      const file = new File([buffer], 'tail-row.xlsx')
      await expect(parseExcelFile(file)).rejects.toThrow(IMPORT_TOO_MANY_ROWS_MESSAGE)
    })
  })
})
