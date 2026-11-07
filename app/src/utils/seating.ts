import type { DataRow } from '@/types/template'
import { parsePastedRoster } from '@/utils/excel'
import { matchesChineseQuery } from '@/utils/pinyin'
import { sanitizeFileNamePart } from '@/utils/pngExport'

export type SeatingGender = '男' | '女'

export interface SeatingEntry {
  name: string
  gender?: SeatingGender
  /** 名单「考场」列的值（列模式识别到考场列时才有），用于按考场筛选 */
  room?: string
  /** 名单「考号/准考证号/学号/序号/座号」列原值（考试排位用） */
  orderNo?: string
  /** 名单「成绩/分数」列的数值（按成绩排座用；非数字留空） */
  score?: number
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

/**
 * 列模式下识别姓名 / 性别列的表头关键词。英文关键词整格锚定：
 * 「Student1」「Gender1」这类单列序号名单不是表头，不能被跳过。
 */
const NAME_HEADER = /姓名|名字$|^(?:student[ _-]?)?name$|^students?$/i
const GENDER_HEADER = /性别|^gender$|^sex$/i
/** 列模式下的考场列表头（仅在识别到表头行时生效，无表头不猜测） */
const ROOM_HEADER = /考场|考场号|试室|^room$|^exam ?room$/i
/** 列模式下的考号/序号列表头：考试排位「按序号列」排序的来源 */
const ORDER_HEADER = /考号|准考证|学号|序号|座号|^no\.?$|^id$|exam|seat ?no|student ?no/i
/** 列模式下的成绩列表头：「按成绩」排序的来源 */
const SCORE_HEADER = /成绩|分数|总分|^score$|^marks?$/i
/** 考场原始值本身已带「考场/试室/room」字样（如「考场01」「Room 1」），展示时不应再加前缀 */
export function roomIdHasLabel(id: string): boolean {
  return /考场|试室|room/i.test(id)
}
/** 首行命中这些关键词时视为表头（Excel 复制常见列名） */
const ROSTER_HEADER = /姓名|名字|性别|学号|班级|座位|序号|^name$|^students?$|^gender$|^sex$|^no\.?$|^id$/i
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
  /** 识别到考场列时按出现顺序去重的考场号及人数；无考场列为空数组 */
  rooms: SeatingRoomCount[]
  /** 是否识别到考号/序号列（考试排位「按序号列排序」可用） */
  orderColumn: boolean
  /** 是否识别到成绩列（「按成绩排序」可用） */
  scoreColumn: boolean
}

export interface SeatingRoomCount {
  id: string
  count: number
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
    rooms: [],
    orderColumn: false,
    scoreColumn: false,
  }
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (!lines.length) return plain

  const tabLines = lines.filter((l) => l.includes('\t')).length
  const firstCells = lines[0]!
    .split(/[\t,，、]+|\s{2,}|\s+/)
    .map((c) => c.trim())
    .filter(Boolean)
  // 带数字的单元格（考场01 / 座位12 / 宿舍302）是数据不是列名，不计入表头命中
  const headerHit =
    firstCells.length >= 2
      ? firstCells.some((c) => !/\d/.test(c) && ROSTER_HEADER.test(c))
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

  const roomIdx = headerDetected
    ? headers.findIndex((h, i) => i !== nameIdx && i !== genderIdx && ROOM_HEADER.test(h))
    : -1
  const orderIdx = headerDetected
    ? headers.findIndex(
        (h, i) => i !== nameIdx && i !== genderIdx && i !== roomIdx && ORDER_HEADER.test(h),
      )
    : -1
  const scoreIdx = headerDetected
    ? headers.findIndex(
        (h, i) =>
          i !== nameIdx && i !== genderIdx && i !== roomIdx && i !== orderIdx && SCORE_HEADER.test(h),
      )
    : -1
  const extraIdx = headers
    .map((_, i) => i)
    .filter((i) => i !== nameIdx && i !== genderIdx && i !== roomIdx && i !== orderIdx && i !== scoreIdx)
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
    rooms: [],
    orderColumn: orderIdx >= 0,
    scoreColumn: scoreIdx >= 0,
  }
  const roomCounts = new Map<string, number>()
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
    const room = roomIdx >= 0 ? (cells[roomIdx] ?? '') : ''
    const entry: SeatingEntry = { name }
    if (gender) entry.gender = gender
    if (room) {
      entry.room = room
      roomCounts.set(room, (roomCounts.get(room) ?? 0) + 1)
    }
    if (orderIdx >= 0) {
      const orderNo = cells[orderIdx] ?? ''
      if (orderNo) entry.orderNo = orderNo
    }
    if (scoreIdx >= 0) {
      const score = Number(cells[scoreIdx] ?? '')
      if (Number.isFinite(score)) entry.score = score
    }
    out.entries.push(entry)
  }
  out.rooms = [...roomCounts].map(([id, count]) => ({ id, count }))
  return out
}

/**
 * 把 Excel 表格（parseExcelFile 的 headers/rows）转成名单框可解析的制表符文本：
 * 表头行保留（parseExcelFile 总把首行当表头；若首行其实是数据，表头关键词不命中，
 * parseSeatingRosterDetailed 会按无表头列模式把它当成一行数据），自动列名「列N」的表头整行省略；
 * 全空行跳过。结果可直接追加到名单文本框，再由 parseSeatingRosterDetailed 取姓名/性别列。
 * 追加到已有内容后面时传 includeHeader=false，避免表头行落在名单中间被当成一位学生。
 */
export function seatingRosterTextFromTable(
  headers: string[],
  rows: readonly DataRow[],
  includeHeader = true,
): string {
  if (!headers.length) return ''
  const lines: string[] = []
  const cell = (v: string) => v.replace(/[\t\r\n]+/g, ' ').trim()
  const autoOnly = headers.every((h) => /^列\d+$/.test(h))
  const realHeader = headers.some((h) => ROSTER_HEADER.test(h))
  if (!autoOnly && (includeHeader || !realHeader)) {
    lines.push(headers.map((h) => (/^列\d+$/.test(h) ? '' : cell(h))).join('\t'))
  }
  for (const row of rows) {
    const cells = headers.map((h) => cell(String(row[h] ?? '')))
    if (cells.every((c) => c === '')) continue
    lines.push(cells.join('\t'))
  }
  return lines.join('\n')
}

/**
 * 解析名单文本：每行一人，行内可用空格/逗号/制表符附带性别列（如「张伟 男」）；
 * Excel 多列粘贴（含表头/学号/班级）按列模式取姓名与性别，见 parseSeatingRosterDetailed。
 */
export function parseSeatingRoster(text: string): SeatingEntry[] {
  return parseSeatingRosterDetailed(text).entries
}

export type SeatingDuplicatePolicy = 'merge' | 'suffix'

export interface DedupedSeatingRoster {
  entries: SeatingEntry[]
  /** 被合并或加了后缀的重名（每个重复出现记一次，保留出现顺序） */
  duplicates: string[]
}

const CIRCLED_DIGITS = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'

/** 同名第 n 位（n 从 1 起）的区分后缀：①②…⑳，超出用 (n) */
export function duplicateSuffix(n: number): string {
  return n >= 1 && n <= CIRCLED_DIGITS.length ? CIRCLED_DIGITS[n - 1]! : `(${n})`
}

/**
 * 名单重名处理（与 /banquet、/studio 的去重口径对齐）：
 * merge——完全重名只保留首次出现（首条缺性别时补用后续条目的性别），避免同名学生占两座；
 * suffix——保留所有同名条目，按出现顺序加 ①②… 后缀区分（同名的每一位都带后缀）。
 * 姓名为空的占位条目不参与去重。
 */
export function dedupeSeatingEntries(
  entries: readonly SeatingEntry[],
  policy: SeatingDuplicatePolicy = 'merge',
): DedupedSeatingRoster {
  const counts = new Map<string, number>()
  for (const e of entries) if (e.name) counts.set(e.name, (counts.get(e.name) ?? 0) + 1)
  const firstOf = new Map<string, SeatingEntry>()
  const seq = new Map<string, number>()
  const duplicates: string[] = []
  const out: SeatingEntry[] = []
  for (const e of entries) {
    if (!e.name || (counts.get(e.name) ?? 0) < 2) {
      out.push(e)
      continue
    }
    const n = (seq.get(e.name) ?? 0) + 1
    seq.set(e.name, n)
    if (n > 1) duplicates.push(e.name)
    if (policy === 'merge') {
      const first = firstOf.get(e.name)
      if (!first) {
        const copy: SeatingEntry = { ...e }
        firstOf.set(e.name, copy)
        out.push(copy)
      } else if (!first.gender && e.gender) {
        first.gender = e.gender
      }
      continue
    }
    out.push({ ...e, name: `${e.name}${duplicateSuffix(n)}` })
  }
  return { entries: out, duplicates }
}

export interface ReconciledArrangement {
  /** 对齐后的座次：仍在名单中的人保持原位，删掉的人留空位，新人追加到末尾 */
  entries: SeatingEntry[]
  /** 保住手工座位的人数 */
  kept: number
  /** 新增（追加到末尾）的人数 */
  added: number
  /** 名单里已删掉、从座位移除的人数 */
  removed: number
}

const DUPLICATE_SUFFIX_RE = /(?:[\u2460-\u2473]|\((\d+)\))$/

/**
 * 重名对齐锚点：「姓名 + 同名第几位」。带 ①②/(n) 后缀的条目按后缀取序号，
 * 不带后缀的按在列表中的出现次序取序号（同名者去重合并后只有第 1 位）。
 */
function reconcileKeys(list: readonly SeatingEntry[]): (string | null)[] {
  const seq = new Map<string, number>()
  const used = new Set<string>()
  return list.map((e) => {
    if (!e.name) return null
    const m = DUPLICATE_SUFFIX_RE.exec(e.name)
    const base = m ? e.name.slice(0, -m[0].length) : e.name
    let idx: number
    if (m) idx = m[1] ? Number(m[1]) : e.name.codePointAt(e.name.length - 1)! - 0x245f
    else {
      idx = (seq.get(base) ?? 0) + 1
      seq.set(base, idx)
    }
    let key = `${base}\u0000${idx}`
    while (used.has(key)) key = `${base}\u0000${++idx}`
    used.add(key)
    return key
  })
}

/**
 * 名单修改后对齐已有的手工座次（随机 / 拖拽结果），不再整份丢弃：
 * 以「姓名(+同名序号)」为锚点对齐，仍在名单中的人保持 arranged 中的位置
 * （条目取 next 中的新值，性别、考场等随名单更新），名单里删掉的人原位留空
 * （其他人的座位号不变），新增的人按名单顺序追加到末尾；末尾多余的空位先裁掉，
 * 避免新人落到座位数之外。
 */
export function reconcileArranged(
  arranged: readonly SeatingEntry[],
  next: readonly SeatingEntry[],
): ReconciledArrangement {
  const nextKeys = reconcileKeys(next)
  const pending = new Map<string, SeatingEntry>()
  next.forEach((e, i) => {
    const key = nextKeys[i]
    if (key && !pending.has(key)) pending.set(key, e)
  })
  const entries: SeatingEntry[] = []
  let kept = 0
  let removed = 0
  const arrangedKeys = reconcileKeys(arranged)
  arranged.forEach((_e, i) => {
    const key = arrangedKeys[i]
    if (!key) {
      entries.push({ name: '' })
      return
    }
    const match = pending.get(key)
    if (match) {
      pending.delete(key)
      entries.push(match)
      kept++
    } else {
      entries.push({ name: '' })
      removed++
    }
  })
  while (entries.length && !entries[entries.length - 1]!.name) entries.pop()
  let added = 0
  next.forEach((e, i) => {
    const key = nextKeys[i]
    if (!key || pending.get(key) !== e) return
    pending.delete(key)
    entries.push(e)
    added++
  })
  return { entries, kept, added, removed }
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

export interface GenderMixSummary {
  boys: number
  girls: number
  /** 未识别性别的人数（混排后均排在末尾） */
  unknown: number
  /** 人数多的一方多出的人数（交替用尽后连续排在末尾） */
  surplus: number
  /** 线性顺序中相邻同性（均有性别）的座位对数 */
  adjacentSamePairs: number
  /** 处在相邻同性对中的全部座位线性下标（0 起，升序去重），供预览标记“建议人工复核” */
  adjacentSameSeats: number[]
}

/** 统计一份排座结果的男女构成与相邻同性对数，供混排后的提示文案使用 */
export function summarizeGenderMix(arranged: readonly SeatingEntry[]): GenderMixSummary {
  let boys = 0
  let girls = 0
  let unknown = 0
  for (const e of arranged) {
    if (e.gender === '男') boys++
    else if (e.gender === '女') girls++
    else unknown++
  }
  let adjacentSamePairs = 0
  const marked = new Set<number>()
  for (let i = 1; i < arranged.length; i++) {
    const prev = arranged[i - 1]!.gender
    const cur = arranged[i]!.gender
    if (prev && cur && prev === cur) {
      adjacentSamePairs++
      marked.add(i - 1)
      marked.add(i)
    }
  }
  return {
    boys,
    girls,
    unknown,
    surplus: Math.abs(boys - girls),
    adjacentSamePairs,
    adjacentSameSeats: [...marked],
  }
}

// ---------- 座位网格与视角镜像 ----------

/**
 * 填充顺序：rows 按排从左到右；serpentine 按排蛇形（偶数排从右向左）；
 * cols 按列从上到下逐列；colSnake 按列蛇形（偶数列从下到上，考试考场主流走位）。
 */
export type SeatingFillOrder = 'rows' | 'serpentine' | 'cols' | 'colSnake'

/**
 * 自定义座位形状：disabled 为主区（rows×cols 外框）里被禁用格的键「排,列」（1 起）——
 * 用于每排座位数不等（如 7788）、删角等不规则形状；podium 为讲台排（第 0 排）启用的
 * 物理列号集（1 起）——讲台左右「护法位」、监考位等。两者与填充顺序、间隔正交：
 * 主区座位按填充序铺完后，讲台排座位按列号升序接在座位号末尾。
 */
export interface SeatShape {
  disabled?: ReadonlySet<string>
  podium?: ReadonlySet<number>
  /** 「空位散布」：这些可坐格排到填充序末尾，人数不满时成为随机散布的空位（仍计容量） */
  emptyLast?: ReadonlySet<string>
}

/** 主区禁用格的键（排、列均 1 起） */
export function maskKey(row: number, col: number): string {
  return `${row},${col}`
}

/**
 * 按填充顺序展开主区全部物理格（0 起的 [排,列]）：
 * rows/serpentine 为排主序，cols/colSnake 为列主序（蛇形在偶数排/列反向）。
 */
export function fillCells(
  rows: number,
  cols: number,
  fillOrder: SeatingFillOrder,
): [number, number][] {
  const out: [number, number][] = []
  if (fillOrder === 'cols' || fillOrder === 'colSnake') {
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        out.push([fillOrder === 'colSnake' && c % 2 === 1 ? rows - 1 - r : r, c])
      }
    }
    return out
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push([r, fillOrder === 'serpentine' && r % 2 === 1 ? cols - 1 - c : c])
    }
  }
  return out
}
/**
 * 座位间隔：none 全坐；skipCol 隔位（每排 1 起的奇数列留空）；skipRow 隔排（1 起的偶数排留空，
 * 首排靠讲台照常坐）；checker 棋盘错位（相邻排的空位互相错开）；spread 尽量散开（按人数自动拉开
 * 间距：坐得下时等价棋盘 / 隔位，坐不下时在全部座位上均匀留空，保证全员入座）。与填充顺序正交。
 */
export type SeatingSpacing = 'none' | 'skipCol' | 'skipRow' | 'checker' | 'spread'
export type SeatingViewMode = 'teacher' | 'student'

export const SEATING_SPACINGS: readonly SeatingSpacing[] = ['none', 'skipCol', 'skipRow', 'checker', 'spread']

export function isSeatingSpacing(value: unknown): value is SeatingSpacing {
  return typeof value === 'string' && (SEATING_SPACINGS as readonly string[]).includes(value)
}

/** spread 档的上下文：教室尺寸、要入座的人数与填充顺序（其他四档不需要） */
export interface SpreadContext {
  rows: number
  cols: number
  count: number
  fillOrder?: SeatingFillOrder
}

/** spread 人数坐得下时退化到的固定档：先棋盘，再隔位；都坐不下返回 null（按人数均匀留空） */
function spreadFallback(rows: number, cols: number, count: number): 'checker' | 'skipCol' | null {
  if (count <= seatCapacity(rows, cols, 'checker')) return 'checker'
  if (count <= seatCapacity(rows, cols, 'skipCol')) return 'skipCol'
  return null
}

/**
 * 「尽量散开」留空的物理位置集（键为 r*cols+c，0 起）：count ≤ 棋盘容量时等价 checker，
 * ≤ 隔位容量时等价 skipCol，否则在全部座位的填充线性序上按 floor(k*total/count) 均匀取 count 个可坐位，
 * 其余留空（空位均匀分布，同排空位数相差 ≤ 1）；count ≥ 座位总数时不留空。
 */
export function spreadBlockedSet(
  rows: number,
  cols: number,
  count: number,
  fillOrder: SeatingFillOrder = 'rows',
): Set<number> {
  const blocked = new Set<number>()
  if (rows <= 0 || cols <= 0) return blocked
  const total = rows * cols
  const fallback = spreadFallback(rows, cols, count)
  if (fallback) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) if (isSeatBlocked(r, c, fallback)) blocked.add(r * cols + c)
    }
    return blocked
  }
  if (count >= total) return blocked
  const open = new Set<number>()
  for (let k = 0; k < count; k++) {
    const linear = Math.floor((k * total) / count)
    const r = Math.floor(linear / cols)
    const c = linear % cols
    const col = fillOrder === 'serpentine' && r % 2 === 1 ? cols - 1 - c : c
    open.add(r * cols + col)
  }
  for (let i = 0; i < total; i++) if (!open.has(i)) blocked.add(i)
  return blocked
}

/**
 * 物理位置（0 起的排、列）在给定间隔下是否留空（不可坐）。
 * spread 档需要 spread 上下文（教室尺寸 + 人数），缺省时视为不留空；批量判定请直接用 spreadBlockedSet。
 */
export function isSeatBlocked(
  r: number,
  c: number,
  spacing: SeatingSpacing,
  spread?: SpreadContext,
): boolean {
  switch (spacing) {
    case 'skipCol':
      return c % 2 === 0
    case 'skipRow':
      return r % 2 === 1
    case 'checker':
      return (r + c) % 2 === 1
    case 'spread':
      return spread
        ? spreadBlockedSet(spread.rows, spread.cols, spread.count, spread.fillOrder).has(r * spread.cols + c)
        : false
    default:
      return false
  }
}

/**
 * 主区可坐格数：外框减去禁用格，再按间隔扣留空。spread 档在「可坐格」上按填充序
 * 均匀取 count 个（禁用格不参与），等价无掩码时的 spreadBlockedSet 口径。
 */
function openCells(
  rows: number,
  cols: number,
  fillOrder: SeatingFillOrder,
  spacing: SeatingSpacing,
  count: number,
  shape?: SeatShape,
): [number, number][] {
  const cells = fillCells(rows, cols, fillOrder).filter(
    ([r, c]) => !shape?.disabled?.has(maskKey(r + 1, c + 1)),
  )
  // 「空位散布」：指定格移到填充序末尾——人数不足时这些格成为散布的空位，超员时仍按末位入座
  if (shape?.emptyLast?.size) {
    const last: [number, number][] = []
    const keep: [number, number][] = []
    for (const cell of cells) {
      if (shape.emptyLast.has(maskKey(cell[0] + 1, cell[1] + 1))) last.push(cell)
      else keep.push(cell)
    }
    cells.length = 0
    cells.push(...keep, ...last)
  }
  if (spacing === 'spread') {
    const checker = cells.filter(([r, c]) => !isSeatBlocked(r, c, 'checker'))
    if (count <= checker.length) return checker
    const skipCol = cells.filter(([r, c]) => !isSeatBlocked(r, c, 'skipCol'))
    if (count <= skipCol.length) return skipCol
    if (count >= cells.length) return cells
    const open = new Set<number>()
    for (let k = 0; k < count; k++) open.add(Math.floor((k * cells.length) / count))
    return cells.filter((_, i) => open.has(i))
  }
  return cells.filter(([r, c]) => !isSeatBlocked(r, c, spacing))
}

/**
 * rows×cols 教室在给定间隔下的可坐座位数（溢出、进度、演示名单都按这个口径）；
 * spread 档按 count（要入座的人数）计：坐得下时为退化档的容量，否则为 min(count, 座位总数)。
 * shape 提供自定义座位形状：主区禁用格不计，讲台排启用格列号去重后计入。
 */
export function seatCapacity(
  rows: number,
  cols: number,
  spacing: SeatingSpacing = 'none',
  count = 0,
  shape?: SeatShape,
): number {
  if (rows <= 0 || cols <= 0) return 0
  const podium = shape?.podium ? [...shape.podium].filter((c) => c >= 1 && c <= cols).length : 0
  return openCells(rows, cols, 'rows', spacing, count, shape).length + podium
}

export interface Seat {
  /** 物理排号（1 起）；0 为讲台排（讲台两侧护法位等附加座位） */
  row: number
  col: number
  seatNo: number
  name: string
  gender?: SeatingGender
  /** 座位副标（考号/序号列原值，考试排位显示用） */
  sub?: string
}

export interface SeatingDisplayCell {
  seat: Seat | null
  /** 展示序中该座位之后是否跟随过道 */
  aisleAfter: boolean
}

/**
 * 按填充顺序把名单铺进 rows×cols 的座位（座位号为名单序，蛇形时偶数排从右向左）；
 * spacing 留空的位置不产生座位（座位号连续只数可坐座位），网格里对应格为 null。
 * spread 档按 count（缺省为名单长度）拉开间距。
 */
export function buildSeats(
  entries: readonly SeatingEntry[],
  rows: number,
  cols: number,
  fillOrder: SeatingFillOrder,
  spacing: SeatingSpacing = 'none',
  count = entries.length,
  shape?: SeatShape,
): Seat[] {
  const out: Seat[] = []
  let idx = 0
  const put = (r: number, c: number) => {
    const entry = entries[idx]
    out.push({
      row: r + 1,
      col: c + 1,
      seatNo: idx + 1,
      name: entry?.name ?? '',
      gender: entry?.gender,
      sub: entry?.orderNo,
    })
    idx++
  }
  for (const [r, c] of openCells(rows, cols, fillOrder, spacing, count, shape)) put(r, c)
  if (shape?.podium) {
    for (const c of [...shape.podium].sort((a, b) => a - b)) {
      if (c >= 1 && c <= cols) put(-1, c - 1)
    }
  }
  return out
}

/**
 * 人数超过座位数时排不进座位的名单条目：按填充顺序取可坐座位数之后的非空姓名，
 * 与 buildSeats 的截断口径一致（座位内的空位不计入；间隔留空的位置不算座位）。
 */
export function unseatedEntries(
  entries: readonly SeatingEntry[],
  rows: number,
  cols: number,
  spacing: SeatingSpacing = 'none',
  count = entries.length,
  shape?: SeatShape,
): SeatingEntry[] {
  return entries.slice(seatCapacity(rows, cols, spacing, count, shape)).filter((e) => e.name)
}

/**
 * 名单含 ≥ 2 个考场且当前为「全部」视图时，各考场是否单独都坐得下：
 * 为真时「全部」视图的溢出只是合排造成的假溢出，应引导先选考场而非提示增加行列数。
 */
export function roomsFitIndividually(
  rooms: readonly SeatingRoomCount[],
  seatCount: number,
): boolean {
  return rooms.length >= 2 && rooms.every((r) => r.count <= seatCount)
}

/**
 * PNG / 打印页脚的未排座提示：「另有 N 人未排座：甲、乙、丙…」，超过 max 位截断加「等」；
 * 无未排座返回空串。
 */
export function unseatedSummary(
  unseated: readonly SeatingEntry[],
  labels: { template: string; etc: string; join: (items: readonly string[]) => string },
  max = 10,
): string {
  if (!unseated.length) return ''
  const names = unseated.slice(0, max).map((e) => e.name)
  const list = labels.join(names) + (unseated.length > max ? labels.etc : '')
  return labels.template.replace('{n}', String(unseated.length)).replace('{names}', list)
}

/** 按物理行列索引摆放座位（渲染网格用）；讲台排（row=0）不进主网格，用 podiumSeatsOf 单独取 */
export function buildSeatGrid(seats: readonly Seat[], rows: number, cols: number): (Seat | null)[][] {
  const grid: (Seat | null)[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null),
  )
  for (const seat of seats) {
    if (seat.row < 1 || seat.row > rows) continue
    grid[seat.row - 1]![seat.col - 1] = seat
  }
  return grid
}

/** 讲台排座位（row=0），按物理列号升序；学生视角渲染时再左右翻转即可 */
export function podiumSeatsOf(seats: readonly Seat[]): Seat[] {
  return seats.filter((s) => s.row === 0).sort((a, b) => a.col - b.col)
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

/**
 * 导出 PNG 的文件名（不含扩展名）：标题清洗非法字符 + 视角后缀，空标题回退默认名；
 * 按考场筛选时在标题后附「-考场X」（labels.room 为「考场」前缀）。
 */
export function seatingExportFileName(
  title: string,
  viewMode: SeatingViewMode,
  labels: { fallback: string; teacher: string; student: string; room?: string },
  room = '',
): string {
  const base = sanitizeFileNamePart(title) || labels.fallback
  const roomPart = sanitizeFileNamePart(room)
  const roomSuffix = roomPart ? `-${labels.room ?? ''}${roomPart}` : ''
  return `${base}${roomSuffix}-${viewMode === 'student' ? labels.student : labels.teacher}`
}

/**
 * 查找学生：姓名包含 query（大小写不敏感）或纯字母 query 命中拼音（口径同 /banquet 宾客搜索），
 * 按座位号升序返回全部命中（重名多命中）；空 query 或仅空白返回空数组，空座位不参与匹配。
 */
export function findSeatsByName(seats: readonly Seat[], query: string): Seat[] {
  const q = query.trim()
  if (!q) return []
  return seats
    .filter((s) => s.name.trim() && matchesChineseQuery(s.name, q))
    .sort((a, b) => a.seatNo - b.seatNo)
}

/** 座位表 / 宴会排桌 → 标签工坊 一键带入名单的 localStorage 暂存键 */
export const SEATING_HANDOFF_KEY = 'seatmark.seating-handoff.v1'

export interface SeatingHandoff {
  title: string
  /** 名单来源：教室座位表（默认）/ 宴会排桌 */
  source?: 'seating' | 'banquet'
  /** 可选考场号：非空时每行带「考场」列（= 考场号）；为空则不带该列 */
  roomNo?: string
  rows: DataRow[]
}

// ---------- 考试排位：排序规则 / 联排过道 / 布局预设 ----------

/**
 * 考试排序规则：roster 名单原序；order 按考号/序号列升序；score 按成绩列高到低；
 * random 随机打乱；manual 按用户给的顺序名单（applyManualOrder）。
 */
export type ExamSortRule = 'roster' | 'order' | 'score' | 'random' | 'manual'

/** 数值感知的序号比较：「2」<「10」、A-2 < A-12；都非纯数字时按地区化字典序 */
function compareOrderNo(a: string, b: string): number {
  return a.localeCompare(b, 'zh-Hans-CN', { numeric: true })
}

/**
 * 按考试规则给名单排序（不改原数组）：
 * order——有考号的按考号升序在前，无考号的按原顺序沉底；
 * score——成绩高到低，无成绩沉底，同分按姓名稳定；
 * random——洗牌；roster/manual 原样返回副本。
 */
export function sortExamEntries(
  entries: readonly SeatingEntry[],
  rule: ExamSortRule,
  rand: () => number = Math.random,
): SeatingEntry[] {
  if (rule === 'random') return shuffleEntries([...entries], rand)
  if (rule === 'score') {
    return [...entries].sort(
      (a, b) =>
        (b.score ?? Number.NEGATIVE_INFINITY) - (a.score ?? Number.NEGATIVE_INFINITY) ||
        a.name.localeCompare(b.name, 'zh-Hans-CN'),
    )
  }
  if (rule === 'order') {
    return entries
      .map((entry, i) => ({ entry, i }))
      .sort((a, b) => {
        const oa = a.entry.orderNo
        const ob = b.entry.orderNo
        if (oa && ob) return compareOrderNo(oa, ob) || a.i - b.i
        if (oa) return -1
        if (ob) return 1
        return a.i - b.i
      })
      .map((x) => x.entry)
  }
  return [...entries]
}

/**
 * 按用户给的顺序名单重排：orderedKeys 每行一个姓名或考号（先匹配考号再匹配姓名，
 * 首个命中位置即排位）；未列出的学生按原顺序接在末尾。返回新数组。
 */
export function applyManualOrder(
  entries: readonly SeatingEntry[],
  orderedKeys: readonly string[],
): SeatingEntry[] {
  if (!orderedKeys.length) return [...entries]
  const rank = new Map<string, number>()
  orderedKeys.forEach((key, i) => {
    const k = key.trim()
    if (k && !rank.has(k)) rank.set(k, i)
  })
  if (!rank.size) return [...entries]
  const idxOf = (entry: SeatingEntry): number => {
    if (entry.orderNo && rank.has(entry.orderNo)) return rank.get(entry.orderNo)!
    if (rank.has(entry.name)) return rank.get(entry.name)!
    return Number.MAX_SAFE_INTEGER
  }
  return entries
    .map((entry, i) => ({ entry, i }))
    .sort((a, b) => idxOf(a.entry) - idxOf(b.entry) || a.i - b.i)
    .map((x) => x.entry)
}

/**
 * 联排过道：每 groupSize 列一条过道（如 2 人联排 → 第 2/4/6… 列后），
 * 返回「第 n 列之后有过道」的物理列号集（1 起）；groupSize < 1 视为手动模式返回空集。
 */
export function autoAisles(cols: number, groupSize: number): Set<number> {
  const out = new Set<number>()
  if (groupSize < 1) return out
  for (let n = groupSize; n < cols; n += groupSize) out.add(n)
  return out
}

/** 考场布局预设（国标/主流走法，均可再改）：行列、填充序、间隔、禁用格 */
export interface ExamLayoutPreset {
  id: 'exam30_5x6' | 'exam30_7788' | 'exam15_gap'
  rows: number
  cols: number
  fillOrder: SeatingFillOrder
  spacing: SeatingSpacing
  disabled: string[]
}

export const EXAM_LAYOUT_PRESETS: readonly ExamLayoutPreset[] = [
  // 30 人标准场：5 列 × 6 排，按列蛇形（第 1 列从上到下 1-6，第 2 列从下到上 7-12…）
  { id: 'exam30_5x6', rows: 6, cols: 5, fillOrder: 'colSnake', spacing: 'none', disabled: [] },
  // 30 人 7788：4 列 × 8 排，末排只坐第 3/4 列（各列 7/7/8/8 人），按列蛇形
  { id: 'exam30_7788', rows: 8, cols: 4, fillOrder: 'colSnake', spacing: 'none', disabled: ['8,1', '8,2'] },
  // 15 人隔位场：5 列 × 6 排棋盘坐（30 位坐 15，前后左右不相邻），按列蛇形
  { id: 'exam15_gap', rows: 6, cols: 5, fillOrder: 'colSnake', spacing: 'checker', disabled: [] },
]

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
