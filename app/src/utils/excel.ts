import type { SampleExcel } from '@/data/demoDatasets'
import { sampleExcelFor } from '@/data/demoDatasets'
import type { DataRow, LabelTemplate, ParsedExcel } from '@/types/template'

/** 表头行探测时最多跳过的前置标题/空行数 */
export const MAX_TITLE_ROWS = 3

/** 单单元格行被视为大标题（而非单列表头）的最短文本长度 */
export const MIN_TITLE_TEXT_LENGTH = 6

/** 解析 Excel 文件首个工作表：自动跳过前置大标题/空行定位表头行，其余为数据行 */
export async function parseExcelFile(file: File): Promise<ParsedExcel> {
  const XLSX = await import('xlsx')

  let buffer: ArrayBuffer
  try {
    buffer = await file.arrayBuffer()
  } catch {
    throw new Error('无法读取文件：文件可能已被移动、重命名或删除，请重新选择文件')
  }

  let workbook: ReturnType<typeof XLSX.read>
  try {
    workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  } catch {
    throw new Error('文件解析失败：文件可能已损坏或格式不受支持，请重新选择 .xlsx / .xls / .csv 文件')
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('Excel 文件中没有可用的工作表')

  const sheet = workbook.Sheets[sheetName]!
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })

  const cellTexts = (row: unknown[] | undefined) =>
    (row ?? [])
      .map((cell) => String(cell ?? '').trim())
      .filter((text) => text !== '')

  const isTitleRow = (row: unknown[] | undefined) => {
    const texts = cellTexts(row)
    if (texts.length === 0) return true
    return texts.length === 1 && texts[0]!.length >= MIN_TITLE_TEXT_LENGTH
  }

  const multiColumn = matrix
    .slice(0, MAX_TITLE_ROWS + 2)
    .some((row) => cellTexts(row).length >= 2)

  let headerRowIdx = 0
  while (
    multiColumn &&
    headerRowIdx < Math.min(matrix.length - 1, MAX_TITLE_ROWS + 1) &&
    isTitleRow(matrix[headerRowIdx])
  ) {
    headerRowIdx++
  }
  if (matrix.length - headerRowIdx < 2) {
    throw new Error('Excel 至少需要包含表头行和一行数据')
  }

  const body = matrix.slice(headerRowIdx)
  const columnCount = body.reduce((max, row) => Math.max(max, row.length), 0)
  const headerRow = body[0] ?? []
  const headers = Array.from({ length: columnCount }, (_, i) => {
    const text = String(headerRow[i] ?? '').trim()
    return text || `列${i + 1}`
  })

  const rows: DataRow[] = body
    .slice(1)
    .filter((row) => row.some((cell) => cell !== undefined && cell !== null && cell !== ''))
    .map((row) => {
      const record: DataRow = {}
      headers.forEach((header, i) => {
        const cell = row[i]
        record[header] = cell !== undefined && cell !== null ? String(cell) : ''
      })
      return record
    })

  return { fileName: file.name, sheetName, headers, rows }
}

/**
 * Excel 风格的单元格排序比较：两边都是数值时按数值大小，
 * 数值排在文本前，文本按中文区域（拼音）排序。
 */
export function compareCellText(a: string, b: string): number {
  const na = Number(a)
  const nb = Number(b)
  const aIsNum = a.trim() !== '' && !Number.isNaN(na)
  const bIsNum = b.trim() !== '' && !Number.isNaN(nb)
  if (aIsNum && bIsNum) return na - nb
  if (aIsNum) return -1
  if (bIsNum) return 1
  return a.localeCompare(b, 'zh-Hans-CN')
}

/** 按当前模板场景生成并下载样例 Excel（本地生成，不经过服务器） */
export async function downloadSampleExcel(template: LabelTemplate): Promise<SampleExcel> {
  const sample = sampleExcelFor(template)
  const XLSX = await import('xlsx')
  const sheetData = [
    sample.headers,
    ...sample.rows.map((row) => sample.headers.map((h) => row[h] ?? '')),
  ]
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sample.sheetName)
  XLSX.writeFile(workbook, sample.fileName)
  return sample
}

const DEMO_NAMES = [
  '张伟', '王芳', '李娜', '刘洋', '陈静', '杨帆', '赵磊', '黄敏',
  '周杰', '吴霞', '徐强', '孙丽', '马超', '朱琳', '胡军', '郭颖',
  '何平', '高翔', '林芳', '罗斌', '郑爽', '梁波', '谢宇', '宋健',
  '唐瑶', '许辉', '韩雪', '冯刚', '曹阳', '彭飞',
]

/** 演示数据覆盖全部内置模板字段（含学生证 / 工作证），任何模板都能直接预览 */
const DEMO_HEADERS = [
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
]

const DEMO_SCHOOL = '市第一中学'
const DEMO_DEPARTMENTS = ['教务处', '招生办', '信息中心', '后勤保障部']

/** 生成一批演示数据，便于用户上传前先体验完整流程 */
export function makeDemoRows(count = 30): { headers: string[]; rows: DataRow[] } {
  const rows: DataRow[] = []
  const perRoom = 15
  for (let i = 0; i < count; i++) {
    const room = Math.floor(i / perRoom) + 1
    const seat = (i % perRoom) + 1
    const birthMonth = String((i % 12) + 1).padStart(2, '0')
    const birthDay = String((i % 28) + 1).padStart(2, '0')
    rows.push({
      姓名: DEMO_NAMES[i % DEMO_NAMES.length]!,
      性别: i % 2 === 0 ? '男' : '女',
      考场: `第${room}考场`,
      座位号: String(seat).padStart(2, '0'),
      准考证号: String(2026061000 + i + 1),
      班级: `高三（${(i % 6) + 1}）班`,
      学号: String(2023010100 + i + 1),
      学校: DEMO_SCHOOL,
      身份证号: `1101012008${birthMonth}${birthDay}${String(17 + i * 2).padStart(4, '0')}`,
      部门: DEMO_DEPARTMENTS[i % DEMO_DEPARTMENTS.length]!,
      职务: i % 5 === 0 ? '巡考员' : '监考员',
      工号: `JW${2300 + i + 1}`,
      单位: DEMO_SCHOOL,
    })
  }
  return { headers: DEMO_HEADERS, rows }
}
