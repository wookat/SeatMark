import type { DataRow } from '@/types/template'
import { parsePastedRoster } from '@/utils/excel'
import { sanitizeFileNamePart } from '@/utils/pngExport'

export type SeatingGender = '男' | '女'

export interface SeatingEntry {
  name: string
  gender?: SeatingGender
}

const GENDER_TOKENS: Record<string, SeatingGender> = {
  男: '男',
  女: '女',
  m: '男',
  f: '女',
  male: '男',
  female: '女',
}

/** 逐行解析（旧格式）：行内可用空格/逗号/制表符附带性别列，否则一行内多个片段视为多个姓名 */
function parseRosterLine(line: string, out: SeatingEntry[]) {
  const tokens = line
    .split(/[\s,，、;；\t]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (!tokens.length) return
  const last = tokens[tokens.length - 1]!
  const gender = GENDER_TOKENS[last.toLowerCase()]
  if (tokens.length >= 2 && gender) {
    // 「姓名 性别」两列：性别前的片段并入姓名（容忍复姓中间空格；拉丁字母姓名保留空格）
    const nameTokens = tokens.slice(0, -1)
    const latin = nameTokens.some((tok) => /[A-Za-z]/.test(tok))
    out.push({ name: nameTokens.join(latin ? ' ' : ''), gender })
  } else {
    for (const t of tokens) out.push({ name: t })
  }
}

/** 列模式下识别姓名 / 性别列的表头关键词 */
const NAME_HEADER = /姓名|名字|^name$|student/i
const GENDER_HEADER = /性别|^gender$|^sex$/i
/** 首行命中这些关键词时视为表头（Excel 复制常见列名） */
const ROSTER_HEADER = /姓名|名字|性别|学号|班级|座位|序号|^name$|gender|^no\.?$|^id$/i
/** 无表头时，列内任一值带数字或班级词则视为学号/班级类附属列 */
const ID_LIKE = /\d|班|级|组|年/

export interface ParsedSeatingRoster {
  entries: SeatingEntry[]
  /** 识别并跳过的表头列名；未检测到表头时为空 */
  headerSkipped: string[]
  /** 不当作姓名也不当作性别的列（学号/班级等）；无表头时为自动列名「列N」 */
  ignoredColumns: string[]
  /** 是否识别到性别列（列模式） */
  genderColumn: boolean
  /** 是否走了列模式（Excel 多列粘贴） */
  columnMode: boolean
}

/**
 * 解析名单文本，返回条目与识别信息。
 * 列模式（≥ 2 行含制表符，或首行命中表头关键词）：姓名列 = 表头「姓名/名字」或首列，
 * 性别列 = 表头「性别」或整列命中性别词的列，学号/班级等附属列忽略；
 * 无表头且附属列全为姓名状文本（无数字/班级词）时仍当多列姓名网格展开；单列行回退逐行解析。
 * 非列模式保持旧行为：每行「张伟 男」或一行多名。
 */
export function parseSeatingRosterDetailed(text: string): ParsedSeatingRoster {
  const plain: ParsedSeatingRoster = {
    entries: [],
    headerSkipped: [],
    ignoredColumns: [],
    genderColumn: false,
    columnMode: false,
  }
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (!lines.length) return plain

  const tabLines = lines.filter((l) => l.includes('\t')).length
  const firstCells = lines[0]!
    .split(/[\t,，、]+|\s{2,}|\s+/)
    .map((c) => c.trim())
    .filter(Boolean)
  const headerHit =
    firstCells.length >= 2
      ? firstCells.some((c) => ROSTER_HEADER.test(c))
      : NAME_HEADER.test(firstCells[0] ?? '') && lines.length > 1
  if (tabLines < 2 && !headerHit) {
    for (const line of lines) parseRosterLine(line, plain.entries)
    return plain
  }

  const { headers, rows, headerDetected } = parsePastedRoster(text, headerHit || undefined)
  if (!headers.length) return plain
  const nameIdx = Math.max(
    0,
    headerDetected ? headers.findIndex((h) => NAME_HEADER.test(h)) : 0,
  )
  const colValues = (i: number) =>
    rows.map((r) => String(r[headers[i]!] ?? '').trim()).filter((v) => v !== '')
  const isGenderCol = (i: number) => {
    if (i === nameIdx) return false
    if (headerDetected && GENDER_HEADER.test(headers[i]!)) return true
    const values = colValues(i)
    return values.length > 0 && values.every((v) => GENDER_TOKENS[v.toLowerCase()] !== undefined)
  }
  let genderIdx = headers.findIndex((_, i) => isGenderCol(i))
  if (headerDetected && genderIdx >= 0 && !GENDER_HEADER.test(headers[genderIdx]!)) {
    const byHeader = headers.findIndex((h) => GENDER_HEADER.test(h))
    if (byHeader >= 0) genderIdx = byHeader
  }

  const extraIdx = headers.map((_, i) => i).filter((i) => i !== nameIdx && i !== genderIdx)
  // 无表头且所有附属列都像姓名（无数字/班级词）：视为从 Excel 复制的多列姓名网格，全部展开
  const nameGrid =
    !headerDetected &&
    genderIdx < 0 &&
    extraIdx.length > 0 &&
    extraIdx.every((i) => colValues(i).every((v) => !ID_LIKE.test(v)))

  const out: ParsedSeatingRoster = {
    entries: [],
    headerSkipped: headerDetected ? headers.filter((h) => !/^列\d+$/.test(h)) : [],
    ignoredColumns: nameGrid ? [] : extraIdx.map((i) => headers[i]!),
    genderColumn: genderIdx >= 0,
    columnMode: true,
  }
  for (const row of rows) {
    const cells = headers.map((h) => String(row[h] ?? '').trim())
    const filled = cells.filter((c) => c !== '')
    if (!filled.length) continue
    if (filled.length === 1 && cells[nameIdx] === filled[0]) {
      // 单列行（未从 Excel 复制的补充行）：回退逐行解析，容纳「欧阳明 男」一类写法
      parseRosterLine(filled[0]!, out.entries)
      continue
    }
    if (nameGrid) {
      for (const c of filled) out.entries.push({ name: c })
      continue
    }
    const name = cells[nameIdx] ?? ''
    if (!name) continue
    const gender = genderIdx >= 0 ? GENDER_TOKENS[(cells[genderIdx] ?? '').toLowerCase()] : undefined
    out.entries.push(gender ? { name, gender } : { name })
  }
  return out
}

/**
 * 解析名单文本：每行一人，行内可用空格/逗号/制表符附带性别列（如「张伟 男」）；
 * Excel 多列粘贴（含表头/学号/班级）按列模式取姓名与性别，见 parseSeatingRosterDetailed。
 */
export function parseSeatingRoster(text: string): SeatingEntry[] {
  return parseSeatingRosterDetailed(text).entries
}

/** Fisher–Yates 洗牌（返回新数组，不改原数组） */
export function shuffleEntries<T>(list: readonly T[], rand: () => number = Math.random): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/**
 * 男女混排：先分组各自洗牌，再从人数多的一组开始交替入座，
 * 无性别的成员洗牌后补在末尾。
 */
export function interleaveByGender(
  entries: readonly SeatingEntry[],
  rand: () => number = Math.random,
): SeatingEntry[] {
  const boys = shuffleEntries(
    entries.filter((e) => e.gender === '男'),
    rand,
  )
  const girls = shuffleEntries(
    entries.filter((e) => e.gender === '女'),
    rand,
  )
  const rest = shuffleEntries(
    entries.filter((e) => !e.gender),
    rand,
  )
  let a = boys
  let b = girls
  if (girls.length > boys.length) [a, b] = [girls, boys]
  const out: SeatingEntry[] = []
  for (let i = 0; i < a.length; i++) {
    out.push(a[i]!)
    if (i < b.length) out.push(b[i]!)
  }
  out.push(...rest)
  return out
}

// ---------- 座位网格与视角镜像 ----------

export type SeatingFillOrder = 'rows' | 'serpentine'
export type SeatingViewMode = 'teacher' | 'student'

export interface Seat {
  row: number
  col: number
  seatNo: number
  name: string
  gender?: SeatingGender
}

export interface SeatingDisplayCell {
  seat: Seat | null
  /** 展示序中该座位之后是否跟随过道 */
  aisleAfter: boolean
}

/** 按填充顺序把名单铺进 rows×cols 的座位（座位号为名单序，蛇形时偶数排从右向左） */
export function buildSeats(
  entries: readonly SeatingEntry[],
  rows: number,
  cols: number,
  fillOrder: SeatingFillOrder,
): Seat[] {
  const out: Seat[] = []
  let idx = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const col = fillOrder === 'serpentine' && r % 2 === 1 ? cols - 1 - c : c
      const entry = entries[idx]
      out.push({
        row: r + 1,
        col: col + 1,
        seatNo: idx + 1,
        name: entry?.name ?? '',
        gender: entry?.gender,
      })
      idx++
    }
  }
  return out
}

/** 按物理行列索引摆放座位（渲染网格用） */
export function buildSeatGrid(seats: readonly Seat[], rows: number, cols: number): (Seat | null)[][] {
  const grid: (Seat | null)[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null),
  )
  for (const seat of seats) grid[seat.row - 1]![seat.col - 1] = seat
  return grid
}

/**
 * 展示网格：学生视角对每排做左右镜像，过道位置随之翻转；
 * aisles 为「第 n 列之后有过道」的物理列号集合（1 起）
 */
export function buildDisplayGrid(
  seatGrid: readonly (readonly (Seat | null)[])[],
  cols: number,
  aisles: ReadonlySet<number>,
  viewMode: SeatingViewMode,
): SeatingDisplayCell[][] {
  const mirrored = viewMode === 'student'
  return seatGrid.map((rowSeats) => {
    const ordered = mirrored ? [...rowSeats].reverse() : [...rowSeats]
    return ordered.map((seat, i) => {
      if (i === ordered.length - 1) return { seat, aisleAfter: false }
      // 物理列号：展示序第 i 格与第 i+1 格之间是否有过道
      const physCol = mirrored ? cols - 1 - i : i + 1
      return { seat, aisleAfter: aisles.has(physCol) }
    })
  })
}

/** 导出 PNG 的文件名（不含扩展名）：标题清洗非法字符 + 视角后缀，空标题回退默认名 */
export function seatingExportFileName(
  title: string,
  viewMode: SeatingViewMode,
  labels: { fallback: string; teacher: string; student: string },
): string {
  const base = sanitizeFileNamePart(title) || labels.fallback
  return `${base}-${viewMode === 'student' ? labels.student : labels.teacher}`
}

/** 座位表 → 标签工坊 一键带入名单的 localStorage 暂存键 */
export const SEATING_HANDOFF_KEY = 'seatmark.seating-handoff.v1'

export interface SeatingHandoff {
  title: string
  rows: DataRow[]
}

/** 读取并清除座位表带入的名单（仅消费一次） */
export function takeSeatingHandoff(): SeatingHandoff | null {
  try {
    const raw = localStorage.getItem(SEATING_HANDOFF_KEY)
    if (!raw) return null
    localStorage.removeItem(SEATING_HANDOFF_KEY)
    const parsed = JSON.parse(raw) as SeatingHandoff
    if (!parsed || !Array.isArray(parsed.rows) || !parsed.rows.length) return null
    return parsed
  } catch {
    return null
  }
}
