import type { SampleExcel } from '@/data/demoDatasets'
import { demoGenderOf, demoPersonNames, sampleExcelFor } from '@/data/demoDatasets'
import type { DataRow, LabelTemplate, ParsedExcel } from '@/types/template'
import {
  assertImportFileSize,
  assertImportRowCount,
  IMPORT_MAX_ROWS,
  IMPORT_TOO_MANY_ROWS_MESSAGE,
} from '@/utils/importLimits'

type XlsxModule = typeof import('xlsx')
type WorkSheet = import('xlsx').WorkSheet
type CellRange = import('xlsx').Range
type CellObject = import('xlsx').CellObject

/** 表头行探测时最多跳过的前置标题/空行数 */
export const MAX_TITLE_ROWS = 3

/** 单单元格行被视为大标题（而非单列表头）的最短文本长度 */
export const MIN_TITLE_TEXT_LENGTH = 6

/**
 * 加载 xlsx 解析分包。动态 import 一旦网络失败会被浏览器按 URL 缓存为永久 reject，
 * 此时给出明确的刷新引导，而不是透出模块加载的技术性错误。
 */
async function loadXlsx() {
  try {
    return await import('xlsx')
  } catch {
    throw new Error('表格组件加载失败（可能是网络异常），请刷新页面后重试')
  }
}

/** 转矩阵时最多读取的行数：数据行上限 + 可跳过的前置标题行 + 表头行 + 1 行冗余（用于判定真实超限） */
export const SHEET_SCAN_MAX_ROWS = IMPORT_MAX_ROWS + MAX_TITLE_ROWS + 2

/** 把工作表 !ref 收窄到 SHEET_SCAN_MAX_ROWS 行内；无 !ref 或本就在范围内时返回 null（按默认整表转矩阵） */
function boundedRange(XLSX: XlsxModule, sheet: WorkSheet): CellRange | null {
  const ref = sheet['!ref']
  if (typeof ref !== 'string' || !ref) return null
  const full = XLSX.utils.decode_range(ref)
  const lastAllowed = full.s.r + SHEET_SCAN_MAX_ROWS - 1
  if (full.e.r <= lastAllowed) return null
  return { s: full.s, e: { c: full.e.c, r: lastAllowed } }
}

function isPopulated(cell: CellObject | undefined): boolean {
  if (!cell) return false
  if (cell.v !== undefined && cell.v !== null && cell.v !== '') return true
  return typeof cell.w === 'string' && cell.w.trim() !== ''
}

/** 行号（0 基）大于 lastRow 的单元格中是否存在非空内容；兼容稀疏（A1 键）与 dense（!data）两种存储 */
function hasPopulatedCellsBeyond(sheet: WorkSheet, lastRow: number): boolean {
  const dense = sheet['!data']
  if (Array.isArray(dense)) {
    for (let r = lastRow + 1; r < dense.length; r++) {
      if (dense[r]?.some(isPopulated)) return true
    }
    return false
  }
  for (const key of Object.keys(sheet)) {
    if (key.startsWith('!')) continue
    const match = /\d+$/.exec(key)
    if (!match) continue
    const row = Number(match[0]) - 1
    if (row > lastRow && isPopulated(sheet[key] as CellObject | undefined)) return true
  }
  return false
}

/** CSV 文本解码：UTF-8（含 BOM）优先，非法字节序列时回退 GB18030 */
export function decodeCsvText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\ufeff/, '')
  } catch {
    return new TextDecoder('gb18030').decode(bytes)
  }
}

/** 解析 Excel 文件指定（默认首个）工作表：自动跳过前置大标题/空行定位表头行，其余为数据行 */
export async function parseExcelFile(file: File, targetSheet?: string): Promise<ParsedExcel> {
  assertImportFileSize(file)
  const XLSX = await loadXlsx()

  let buffer: ArrayBuffer
  try {
    buffer = await file.arrayBuffer()
  } catch {
    throw new Error('无法读取文件：文件可能已被移动、重命名或删除，请重新选择文件')
  }

  const bytes = new Uint8Array(buffer)
  // .xlsx 必为 ZIP 容器（PK 魔数）；否则 SheetJS 会回退成 CSV/文本解析，把改名的非表格文件误报为导入成功
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b
  // 密码保护的 Office 文件是 CFB 复合文档容器（D0 CF 11 E0）
  const isCfb =
    bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0
  if (/\.xlsx$/i.test(file.name) && !isZip) {
    if (isCfb) {
      throw new Error('文件可能被密码保护（加密），请在 Excel/WPS 中解除密码后另存为 .xlsx 再导入')
    }
    throw new Error(
      '文件内容不是有效的 .xlsx 工作簿（可能是改名或损坏的文件）；若是 CSV 名单请将扩展名改回 .csv 后重试',
    )
  }

  let workbook: ReturnType<typeof XLSX.read>
  try {
    // CSV：SheetJS 对无 BOM 内容默认按单字节码页解码，中文会乱码；
    // 先按 UTF-8 严格解码，失败则按 GB18030（Excel 中文版另存 CSV 的常见编码）
    if (/\.csv$/i.test(file.name) && !isZip) {
      workbook = XLSX.read(decodeCsvText(bytes), { type: 'string' })
    } else {
      workbook = XLSX.read(bytes, { type: 'array' })
    }
  } catch {
    throw new Error('文件解析失败：文件可能已损坏或格式不受支持，请重新选择 .xlsx / .xls / .csv 文件')
  }

  const sheetNames = workbook.SheetNames
  const sheetName =
    targetSheet && sheetNames.includes(targetSheet) ? targetSheet : sheetNames[0]
  if (!sheetName) throw new Error('Excel 文件中没有可用的工作表')

  const sheet = workbook.Sheets[sheetName]!
  // 只把行数上限内的范围转成矩阵（表头探测最多再跳过 MAX_TITLE_ROWS 行 + 表头行 + 1 行冗余），
  // 超出范围的行若有任何非空单元格即按行数超限拒绝；仅有格式而无内容的超长 !ref 不误拒
  const range = boundedRange(XLSX, sheet)
  if (range && hasPopulatedCellsBeyond(sheet, range.e.r)) {
    throw new Error(IMPORT_TOO_MANY_ROWS_MESSAGE)
  }
  // raw:false 读取格式化文本（cell.w），日期/时间/前导零/百分比等按 Excel 中所见呈现
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    ...(range ? { range } : {}),
  })

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
  // 重名列自动加序号后缀（如「姓名2」），避免同名列互相覆盖丢数据
  const used = new Set<string>()
  const headers = Array.from({ length: columnCount }, (_, i) => {
    const text = String(headerRow[i] ?? '').trim() || `列${i + 1}`
    let name = text
    for (let n = 2; used.has(name); n++) name = `${text}${n}`
    used.add(name)
    return name
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
  assertImportRowCount(rows.length)

  return { fileName: file.name, sheetName, sheetNames, headers, rows }
}

/** 模块级复用的中文排序器（含数字串自然序）；运行时无 Intl 时为 null，回退 localeCompare */
const ZH_COLLATOR: Intl.Collator | null = (() => {
  try {
    return typeof Intl !== 'undefined' && typeof Intl.Collator === 'function'
      ? new Intl.Collator('zh-Hans-CN', { numeric: true })
      : null
  } catch {
    return null
  }
})()

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
  return ZH_COLLATOR ? ZH_COLLATOR.compare(a, b) : a.localeCompare(b, 'zh-Hans-CN')
}

/** 按当前模板场景生成并下载样例 Excel（本地生成，不经过服务器） */
export async function downloadSampleExcel(template: LabelTemplate): Promise<SampleExcel> {
  const sample = sampleExcelFor(template)
  const XLSX = await loadXlsx()
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

/**
 * 表头关键词中的「人名类」列名：除了用于识别表头，也必须能被 autoMap 映射到 name 字段
 *（单测断言两套词表不漂移）
 */
export const PERSON_NAME_HEADER_WORDS: readonly string[] = ['姓名', '名字', 'name', '与会人员', '人员', '嘉宾', '代表']
/** 判断粘贴首行是否为表头的常见列名关键词 */
const HEADER_KEYWORDS = new RegExp(
  `${PERSON_NAME_HEADER_WORDS.join('|')}|性别|班级|学号|座位|考场|准考证|部门|职务|工号|单位|学校|编号|号码|电话|手机|宿舍|桌号|组别|序号|头衔|职称|职位|公司|科室|系别|专业|年级|届|桌次|席位|邮箱|title|company|dept|department|class|grade|seat|table|email`,
  'i',
)
/** 单列名单只有首格恰为姓名类列名时才当表头 */
const SINGLE_COLUMN_HEADER = /^(?:姓名|名字|name)$/i

/**
 * 首行是否为表头：只统计不含数字的单元格命中关键词（「考场01 / 座位12 / 宿舍302」是数据不是列名）；
 * 多列时命中 ≥ 1 格即可，单列时仅首格恰为姓名类列名。
 */
function detectHeaderRow(firstRow: string[]): boolean {
  if (firstRow.length >= 2) {
    return firstRow.some((cell) => !/\d/.test(cell) && HEADER_KEYWORDS.test(cell))
  }
  return SINGLE_COLUMN_HEADER.test(firstRow[0] ?? '')
}

/**
 * 首行“长得像”列名但未被关键词识别时，用于提醒用户手动勾选表头：
 * 多列且每格都是不含数字、长度 ≤ 6 的短词（「与会人员 / 头衔 / 公司」）；
 * 两列人名（「张三 / 李四」）也会命中，所以它只做提醒，不参与自动判定。
 */
export function looksLikeHeaderRow(firstRow: readonly string[]): boolean {
  if (firstRow.length < 2) return false
  return firstRow.every((cell) => {
    const text = cell.trim()
    return text !== '' && text.length <= 6 && !/\d/.test(text)
  })
}

export interface PastedRoster {
  headers: string[]
  rows: DataRow[]
  /** 首行是否被识别为表头 */
  headerDetected: boolean
}

/**
 * 解析粘贴的名单文本（来自 Excel/WPS 复制、微信/文档整理的名单）。
 * 分列规则整段统一：优先制表符（表格软件复制即 TSV），其次中英文逗号/顿号，最后连续空白。
 * 首行含常见列名关键词时作为表头，否则自动生成表头（首列「姓名」，其余「列N」）；
 * firstRowHeader 显式传入时以其为准（用户手动指定），不再走关键词启发式。
 */
export function parsePastedRoster(text: string, firstRowHeader?: boolean): PastedRoster {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) =>
      line
        .replace(/[\u200b\ufeff]/g, '')
        .replace(/[\u00a0\u3000]/g, ' ')
        .trim(),
    )
    .filter((line) => line !== '')
  if (!lines.length) return { headers: [], rows: [], headerDetected: false }
  // 与文件导入同一行数上限同一文案；在分列前拦截，避免超大文本先全量分列再报错
  assertImportRowCount(lines.length)

  const splitter = lines.some((l) => l.includes('\t'))
    ? /\t/
    : lines.some((l) => /[,，、]/.test(l))
      ? /[,，、]/
      : /\s+/
  const table = lines.map((line) => line.split(splitter).map((cell) => cell.trim()))

  const columnCount = table.reduce((max, row) => Math.max(max, row.length), 0)
  const headerDetected = firstRowHeader ?? detectHeaderRow(table[0]!)

  const used = new Set<string>()
  const headers = Array.from({ length: columnCount }, (_, i) => {
    const text = headerDetected
      ? String(table[0]![i] ?? '').trim() || `列${i + 1}`
      : i === 0
        ? '姓名'
        : `列${i + 1}`
    let name = text
    for (let n = 2; used.has(name); n++) name = `${text}${n}`
    used.add(name)
    return name
  })

  const rows: DataRow[] = table
    .slice(headerDetected ? 1 : 0)
    .filter((row) => row.some((cell) => cell !== ''))
    .map((row) => {
      const record: DataRow = {}
      headers.forEach((header, i) => {
        record[header] = row[i] ?? ''
      })
      return record
    })

  return { headers, rows, headerDetected }
}

/** 按整行取值去重（保留首次出现顺序），返回去重后的行与移除条数 */
export function dedupeDataRows(
  rows: DataRow[],
  headers: string[],
): { rows: DataRow[]; removed: number } {
  const seen = new Set<string>()
  const out: DataRow[] = []
  for (const row of rows) {
    const key = headers.map((h) => String(row[h] ?? '')).join('\u0000')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return { rows: out, removed: rows.length - out.length }
}

/** 生成一批演示数据，便于用户上传前先体验完整流程 */
export function makeDemoRows(count = 30): { headers: string[]; rows: DataRow[] } {
  const rows: DataRow[] = []
  const perRoom = 15
  const names = demoPersonNames(count, 'zh')
  for (let i = 0; i < count; i++) {
    const name = names[i]!
    const room = Math.floor(i / perRoom) + 1
    const seat = (i % perRoom) + 1
    rows.push({
      姓名: name,
      性别: demoGenderOf(name) ?? '男',
      考场: `第${room}考场`,
      座位号: String(seat).padStart(2, '0'),
      准考证号: String(2026061000 + i + 1),
      班级: `高三（${(i % 6) + 1}）班`,
      学号: String(2023010100 + i + 1),
      学校: DEMO_SCHOOL,
      身份证号: `00000020000101${String(i + 1).padStart(4, '0')}`,
      部门: DEMO_DEPARTMENTS[i % DEMO_DEPARTMENTS.length]!,
      职务: i % 5 === 0 ? '巡考员' : '监考员',
      工号: `JW${2300 + i + 1}`,
      单位: DEMO_SCHOOL,
    })
  }
  return { headers: DEMO_HEADERS, rows }
}
