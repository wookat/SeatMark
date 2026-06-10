import type { DataRow, ParsedExcel } from '@/types/template'

/** 解析 Excel 文件首个工作表：第一行为表头，其余为数据行 */
export async function parseExcelFile(file: File): Promise<ParsedExcel> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()

  let workbook: ReturnType<typeof XLSX.read>
  try {
    workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  } catch (err) {
    throw new Error(`Excel 文件解析失败：${err instanceof Error ? err.message : String(err)}`)
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('Excel 文件中没有可用的工作表')

  const sheet = workbook.Sheets[sheetName]!
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })
  if (matrix.length < 2) {
    throw new Error('Excel 至少需要包含表头行和一行数据')
  }

  const headers = (matrix[0] ?? []).map((h, i) => {
    const text = String(h ?? '').trim()
    return text || `列${i + 1}`
  })

  const rows: DataRow[] = matrix
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

const SAMPLE_HEADERS = ['姓名', '考场', '准考证号', '座位号']

/** 生成并下载示例 Excel 模板 */
export async function downloadSampleExcel(): Promise<void> {
  const XLSX = await import('xlsx')
  const sheetData = [
    SAMPLE_HEADERS,
    ['张同学', '第一考场', '2026061001', '01'],
    ['李同学', '第一考场', '2026061002', '02'],
    ['王同学', '第二考场', '2026061003', '03'],
  ]
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '座位标签示例')
  XLSX.writeFile(workbook, '考场座位标签示例.xlsx')
}

const DEMO_NAMES = [
  '张伟', '王芳', '李娜', '刘洋', '陈静', '杨帆', '赵磊', '黄敏',
  '周杰', '吴霞', '徐强', '孙丽', '马超', '朱琳', '胡军', '郭颖',
  '何平', '高翔', '林芳', '罗斌', '郑爽', '梁波', '谢宇', '宋健',
  '唐瑶', '许辉', '韩雪', '冯刚', '曹阳', '彭飞',
]

/** 生成一批演示数据，便于用户上传前先体验完整流程 */
export function makeDemoRows(count = 30): { headers: string[]; rows: DataRow[] } {
  const rows: DataRow[] = []
  const perRoom = 15
  for (let i = 0; i < count; i++) {
    const room = Math.floor(i / perRoom) + 1
    const seat = (i % perRoom) + 1
    rows.push({
      姓名: DEMO_NAMES[i % DEMO_NAMES.length]!,
      考场: `第${room}考场`,
      准考证号: String(2026061000 + i + 1),
      座位号: String(seat).padStart(2, '0'),
    })
  }
  return { headers: SAMPLE_HEADERS, rows }
}
