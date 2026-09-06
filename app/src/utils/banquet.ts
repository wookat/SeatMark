import { currentLocale, t } from '@/i18n'
import { uid } from '@/utils/id'

/** 宴会座位表本地持久化 key（口径同 SeatingView 的 seatmark.seating-state.v1） */
export const BANQUET_STATE_KEY = 'seatmark.banquet-state.v1'

/** 宾客分组（男方亲友/女方亲友/同事等，名称与颜色可自定义） */
export interface BanquetGroup {
  id: string
  name: string
  color: string
}

export interface BanquetGuest {
  id: string
  name: string
  /** 所属分组；null 表示未分组 */
  groupId: string | null
}

export type TableShape = 'round' | 'rect'

/** 餐桌：画布单位为 mm（虚拟场地坐标，导出时整体缩放适配纸张） */
export interface BanquetTable {
  id: string
  name: string
  shape: TableShape
  x: number
  y: number
  width: number
  height: number
  seats: number
  guestIds: string[]
}

export type MarkerKind = 'entrance' | 'stage' | 'dance'

/** 场地标记元素（入口/舞台/舞池） */
export interface BanquetMarker {
  id: string
  kind: MarkerKind
  label: string
  x: number
  y: number
  width: number
  height: number
}

export const MARKER_PRESETS: Record<MarkerKind, { label: string; width: number; height: number }> =
  {
    entrance: { label: '入口', width: 60, height: 24 },
    stage: { label: '舞台', width: 120, height: 40 },
    dance: { label: '舞池', width: 100, height: 80 },
  }

/** 虚拟场地尺寸（mm），比例接近 A4/A3 横向，导出时等比缩放到纸面 */
export const VENUE_WIDTH = 420
export const VENUE_HEIGHT = 297

// ---------- 名单解析与去重 ----------

export interface ParsedBanquetGuests {
  names: string[]
  duplicates: string[]
  /** 两列模式下的 姓名 → 分组名 映射；单列旧格式时不存在 */
  groups?: Record<string, string>
  /** 首行被识别为表头并跳过 */
  headerSkipped: boolean
}

/** 宾客名单表头关键词（姓名/分组/桌/类别/关系） */
const GUEST_HEADER = /姓名|名字|分组|桌|类别|关系|^name$|group|table|category/i
const GUEST_NAME_HEADER = /姓名|名字|^name$/i
const GUEST_GROUP_HEADER = /分组|桌|类别|关系|group|table|category/i
const GENDER_WORDS = new Set(['男', '女', 'm', 'f', 'male', 'female'])

function cleanLine(line: string): string {
  return line.replace(/[\u200b\ufeff]/g, '').replace(/[\u00a0\u3000]/g, ' ')
}

/**
 * 解析宾客名单文本（逐行粘贴或 TXT/CSV 内容）。
 * 单列旧格式：每行一位宾客；同一行内也允许用逗号/顿号/分号/制表符分隔多位；
 * 空格仅在不含拉丁字母的片段内视为分隔符，避免拆散 "Alice Wang" 这类西文姓名。
 * 两列「姓名，分组」模式：首行命中表头关键词，或 ≥ 2 行含两列且第二列去重值数 ≤ 行数/2
 * （分组名重复出现是分组列特征）且不命中性别词时，第二列视为分组，不再展开为宾客。
 * 自动去除空白行、全角空格与重复姓名（保留首次出现顺序）。
 */
export function parseBanquetGuests(text: string): ParsedBanquetGuests {
  const names: string[] = []
  const seen = new Set<string>()
  const duplicates: string[] = []
  const push = (t: string) => {
    if (seen.has(t)) {
      duplicates.push(t)
      return
    }
    seen.add(t)
    names.push(t)
  }

  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(cleanLine)
    .filter((l) => l.trim() !== '')
  const table = lines.map((line) =>
    line
      .split(/[,，、;；\t]+/)
      .map((c) => c.trim())
      .filter(Boolean),
  )
  const firstRow = table[0] ?? []
  const headerHit = firstRow.length >= 2 && firstRow.some((c) => GUEST_HEADER.test(c))
  const multiRows = table.filter((r) => r.length >= 2)
  let columnMode = headerHit
  if (!columnMode && multiRows.length >= 2) {
    const second = multiRows.map((r) => r[1]!)
    const distinct = new Set(second).size
    const genderish = second.some((v) => GENDER_WORDS.has(v.toLowerCase()))
    columnMode = distinct <= multiRows.length / 2 && !genderish
  }

  if (!columnMode) {
    for (const line of lines) {
      const tokens = line
        .split(/[,，、;；\t]+/)
        .flatMap((part) => (/[A-Za-z]/.test(part) ? [part] : part.split(/\s+/)))
        .map((s) => s.trim())
        .filter(Boolean)
      for (const t of tokens) push(t)
    }
    return { names, duplicates, headerSkipped: false }
  }

  let nameIdx = 0
  let groupIdx = 1
  if (headerHit) {
    const n = firstRow.findIndex((c) => GUEST_NAME_HEADER.test(c))
    const g = firstRow.findIndex((c, i) => i !== n && GUEST_GROUP_HEADER.test(c))
    if (n >= 0) nameIdx = n
    if (g >= 0) groupIdx = g
    else if (nameIdx === 1) groupIdx = 0
  }
  const groups: Record<string, string> = {}
  for (const row of table.slice(headerHit ? 1 : 0)) {
    const name = row.length === 1 ? row[0]! : (row[nameIdx] ?? '')
    if (!name) continue
    const group = row.length > 1 ? (row[groupIdx] ?? '') : ''
    push(name)
    if (group && !(name in groups)) groups[name] = group
  }
  return { names, duplicates, groups, headerSkipped: headerHit }
}

/**
 * 从表格（parseExcelFile 的 headers/rows）解析宾客：取「姓名」列与「分组/桌/类别/关系」列；
 * 表头都不命中时按前两列取值，且首行本身也算一位宾客（parseExcelFile 总把首行当表头）。
 */
export function parseBanquetGuestsFromTable(
  headers: string[],
  rows: Record<string, string>[],
): ParsedBanquetGuests {
  const nameHeader = headers.find((h) => GUEST_NAME_HEADER.test(h))
  const groupHeader = headers.find((h) => h !== nameHeader && GUEST_GROUP_HEADER.test(h))
  const headerDetected = Boolean(nameHeader || groupHeader)
  const nameKey = nameHeader ?? headers[0]
  if (!nameKey) return { names: [], duplicates: [], headerSkipped: false }
  const groupKey = groupHeader ?? headers.find((h) => h !== nameKey)

  const names: string[] = []
  const seen = new Set<string>()
  const duplicates: string[] = []
  const groups: Record<string, string> = {}
  const add = (rawName: string, rawGroup: string) => {
    const name = cleanLine(rawName).trim()
    if (!name) return
    if (seen.has(name)) {
      duplicates.push(name)
      return
    }
    seen.add(name)
    names.push(name)
    const group = cleanLine(rawGroup).trim()
    if (group) groups[name] = group
  }
  // 空表头单元格被 parseExcelFile 命名为「列N」，不是宾客
  if (!headerDetected && !/^列\d+$/.test(nameKey)) {
    add(nameKey, groupKey && !/^列\d+$/.test(groupKey) ? groupKey : '')
  }
  for (const row of rows) add(row[nameKey] ?? '', groupKey ? (row[groupKey] ?? '') : '')
  return { names, duplicates, groups, headerSkipped: headerDetected }
}

/**
 * 批量归组（纯函数）：把 ids 中的宾客 groupId 设为 groupId（null = 清除分组），
 * 其余宾客原样保留；返回新数组，未命中的对象引用不变。
 */
export function assignGroupToGuests(
  guests: BanquetGuest[],
  ids: Iterable<string>,
  groupId: string | null,
): BanquetGuest[] {
  const target = new Set(ids)
  return guests.map((g) => (target.has(g.id) && g.groupId !== groupId ? { ...g, groupId } : g))
}

const DEMO_SURNAMES = '王李张刘陈杨赵黄周吴徐孙马朱胡郭何高林罗'
const DEMO_GIVEN = '伟芳娜敏静丽强磊军洋勇艳杰娟涛明超霞平刚'

/**
 * 生成演示宾客姓名（确定性、互不重复）：姓氏 × 两字名的笛卡尔组合按固定顺序取前 count 个。
 * 名字两字不重复；组合数（20 × 20 × 19）远大于演示人数，超出时截断。
 */
export function buildDemoGuestNames(count: number): string[] {
  const names: string[] = []
  const seen = new Set<string>()
  for (let gi = 0; gi < DEMO_GIVEN.length && names.length < count; gi++) {
    for (let si = 0; si < DEMO_SURNAMES.length && names.length < count; si++) {
      const second = DEMO_GIVEN[(gi + si + 1) % DEMO_GIVEN.length]!
      if (second === DEMO_GIVEN[gi]) continue
      const name = `${DEMO_SURNAMES[si]}${DEMO_GIVEN[gi]}${second}`
      if (seen.has(name)) continue
      seen.add(name)
      names.push(name)
    }
  }
  return names
}

/** 名单中被当作不同宾客的同名（去空白后完全一致），返回姓名去重列表（保序） */
export function findDuplicateGuestNames(guests: BanquetGuest[]): string[] {
  const count = new Map<string, number>()
  for (const g of guests) {
    const name = g.name.trim()
    if (!name) continue
    count.set(name, (count.get(name) ?? 0) + 1)
  }
  return [...count.entries()].filter(([, n]) => n > 1).map(([name]) => name)
}

// ---------- 场地布局预设 ----------

export type VenuePresetId = 'round' | 'long' | 'head' | 'ushape' | 'classroom'

export const VENUE_PRESETS: Array<{ id: VenuePresetId; name: string; hint: string }> = [
  { id: 'round', name: '圆桌宴会', hint: '8 张圆桌，每桌 10 座' },
  { id: 'long', name: '长桌宴会', hint: '4 排长桌，每桌 12 座' },
  { id: 'head', name: '主桌 + 圆桌', hint: '顶部主桌，下方 6 张圆桌' },
  { id: 'ushape', name: 'U 形会议', hint: '三边长桌围合' },
  { id: 'classroom', name: '教室课桌', hint: '4 排 × 4 列小桌，每桌 2 座' },
]

const ROUND_SIZE = 64
const LONG_W = 130
const LONG_H = 36

function makeTable(partial: Omit<BanquetTable, 'id' | 'guestIds'>): BanquetTable {
  return { id: uid('tbl'), guestIds: [], ...partial }
}

/** 默认桌名随当前语言：中文「n号桌」，英文「Table n」 */
export function defaultTableName(n: number): string {
  return currentLocale() === 'en' ? `Table ${n}` : `${n}号桌`
}

/** 按预设生成一批桌位（纯函数，不含标记元素） */
export function buildVenuePreset(preset: VenuePresetId): BanquetTable[] {
  const tables: BanquetTable[] = []
  if (preset === 'round') {
    for (let i = 0; i < 8; i++) {
      const col = i % 4
      const row = Math.floor(i / 4)
      tables.push(
        makeTable({
          name: defaultTableName(i + 1),
          shape: 'round',
          x: 30 + col * 96,
          y: 46 + row * 120,
          width: ROUND_SIZE,
          height: ROUND_SIZE,
          seats: 10,
        }),
      )
    }
  } else if (preset === 'long') {
    for (let i = 0; i < 4; i++) {
      tables.push(
        makeTable({
          name: defaultTableName(i + 1),
          shape: 'rect',
          x: (VENUE_WIDTH - LONG_W) / 2,
          y: 34 + i * 64,
          width: LONG_W,
          height: LONG_H,
          seats: 12,
        }),
      )
    }
  } else if (preset === 'head') {
    tables.push(
      makeTable({
        name: t('主桌'),
        shape: 'rect',
        x: (VENUE_WIDTH - 160) / 2,
        y: 24,
        width: 160,
        height: LONG_H,
        seats: 8,
      }),
    )
    for (let i = 0; i < 6; i++) {
      const col = i % 3
      const row = Math.floor(i / 3)
      tables.push(
        makeTable({
          name: defaultTableName(i + 1),
          shape: 'round',
          x: 66 + col * 110,
          y: 96 + row * 104,
          width: ROUND_SIZE,
          height: ROUND_SIZE,
          seats: 10,
        }),
      )
    }
  } else if (preset === 'ushape') {
    tables.push(
      makeTable({
        name: t('主位桌'),
        shape: 'rect',
        x: (VENUE_WIDTH - 200) / 2,
        y: 40,
        width: 200,
        height: LONG_H,
        seats: 10,
      }),
    )
    tables.push(
      makeTable({
        name: t('左侧桌'),
        shape: 'rect',
        x: (VENUE_WIDTH - 200) / 2,
        y: 96,
        width: LONG_H,
        height: 140,
        seats: 8,
      }),
    )
    tables.push(
      makeTable({
        name: t('右侧桌'),
        shape: 'rect',
        x: (VENUE_WIDTH + 200) / 2 - LONG_H,
        y: 96,
        width: LONG_H,
        height: 140,
        seats: 8,
      }),
    )
  } else {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        tables.push(
          makeTable({
            name: `${r + 1}-${c + 1}`,
            shape: 'rect',
            x: 52 + c * 84,
            y: 46 + r * 62,
            width: 56,
            height: 30,
            seats: 2,
          }),
        )
      }
    }
  }
  return tables
}

// ---------- 自动分配（同组尽量同桌） ----------

/**
 * 一键自动分配：
 * 1. 按分组聚合宾客（未分组的排最后），组内保持名单顺序；
 * 2. 大组优先；每组先找「剩余座位刚好放得下整组」的最小桌（best-fit），
 *    放不下整组时按剩余座位从多到少拆分到多张桌；
 * 3. 返回每桌新的 guestIds（不修改入参）。
 */
export function autoAssignGuests(
  guests: BanquetGuest[],
  tables: BanquetTable[],
): Map<string, string[]> {
  const byGroup = new Map<string, BanquetGuest[]>()
  for (const g of guests) {
    const key = g.groupId ?? ''
    const list = byGroup.get(key)
    if (list) list.push(g)
    else byGroup.set(key, [g])
  }
  const groupsSorted = [...byGroup.entries()].sort((a, b) => {
    // 未分组永远最后；其余按人数从多到少，稳定
    if (a[0] === '') return 1
    if (b[0] === '') return -1
    return b[1].length - a[1].length
  })

  const assigned = new Map<string, string[]>(tables.map((t) => [t.id, []]))
  const free = new Map<string, number>(tables.map((t) => [t.id, t.seats]))
  const order = tables.map((t) => t.id)

  const put = (tableId: string, members: BanquetGuest[]) => {
    assigned.get(tableId)!.push(...members.map((m) => m.id))
    free.set(tableId, free.get(tableId)! - members.length)
  }

  for (const [, members] of groupsSorted) {
    let rest = [...members]
    while (rest.length) {
      // best-fit：能整组放下的桌里剩余座位最少的一张
      let best: string | null = null
      for (const id of order) {
        const f = free.get(id)!
        if (f >= rest.length && (best === null || f < free.get(best)!)) best = id
      }
      if (best) {
        put(best, rest)
        rest = []
        break
      }
      // 放不下整组：填进剩余座位最多的桌，剩下的继续
      let widest: string | null = null
      for (const id of order) {
        const f = free.get(id)!
        if (f > 0 && (widest === null || f > free.get(widest)!)) widest = id
      }
      if (!widest) break // 所有桌已满，剩余宾客保持未安排
      const take = Math.min(free.get(widest)!, rest.length)
      put(widest, rest.slice(0, take))
      rest = rest.slice(take)
    }
  }
  return assigned
}

// ---------- 重叠检测 ----------

export interface VenueRect {
  id: string
  x: number
  y: number
  width: number
  height: number
}

/** 轴对齐包围盒相交检测（圆桌按外接矩形），返回重叠的元素 id 对 */
export function findOverlaps(items: VenueRect[]): Array<[string, string]> {
  const out: Array<[string, string]> = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!
      const b = items[j]!
      if (
        a.x < b.x + b.width &&
        b.x < a.x + a.width &&
        a.y < b.y + b.height &&
        b.y < a.y + a.height
      ) {
        out.push([a.id, b.id])
      }
    }
  }
  return out
}

/** 默认桌名（「n号桌」/「Table n」）；自定义桌名不参与重排 */
const DEFAULT_TABLE_NAME_RE = /^(?:\d+号桌|Table \d+)$/

/**
 * 移除没有任何宾客的桌，并把剩余仍使用默认桌名的桌按新顺序重新编号（纯函数，不修改入参）。
 * 自定义桌名与桌位坐标保持不变。
 */
export function removeEmptyTables(tables: BanquetTable[]): BanquetTable[] {
  return tables
    .filter((t) => t.guestIds.length > 0)
    .map((t, i) => {
      if (!DEFAULT_TABLE_NAME_RE.test(t.name)) return t
      const name = defaultTableName(i + 1)
      return name === t.name ? t : { ...t, name }
    })
}

// ---------- 导出前检查 ----------

export interface BanquetIssues {
  /** 未安排上桌的宾客姓名 */
  unassigned: string[]
  /** 没有任何宾客的空桌名 */
  emptyTables: string[]
  /** 位置重叠的桌名对 */
  overlaps: Array<[string, string]>
  /** 超员的桌（宾客数 > 座位数） */
  overCapacity: string[]
  /** 名单中同名但被当作不同人的姓名 */
  duplicateNames: string[]
}

export function validateBanquet(guests: BanquetGuest[], tables: BanquetTable[]): BanquetIssues {
  const seated = new Set<string>()
  for (const t of tables) for (const id of t.guestIds) seated.add(id)
  const tableName = new Map(tables.map((t) => [t.id, t.name]))
  return {
    unassigned: guests.filter((g) => !seated.has(g.id)).map((g) => g.name),
    emptyTables: tables.filter((t) => !t.guestIds.length).map((t) => t.name),
    overlaps: findOverlaps(tables).map(([a, b]) => [tableName.get(a)!, tableName.get(b)!]),
    overCapacity: tables.filter((t) => t.guestIds.length > t.seats).map((t) => t.name),
    duplicateNames: findDuplicateGuestNames(guests),
  }
}

/** 安排概览（步骤标题旁状态条）：已安排 / 未安排 / 空桌 */
export interface AssignmentSummary {
  assigned: number
  unassigned: number
  emptyTables: number
}

/** 已安排人数只统计仍在名单中的宾客（桌上残留的已删除 id 不计） */
export function summarizeAssignments(
  guests: BanquetGuest[],
  tables: BanquetTable[],
): AssignmentSummary {
  const known = new Set(guests.map((g) => g.id))
  const seated = new Set<string>()
  for (const t of tables) for (const id of t.guestIds) if (known.has(id)) seated.add(id)
  return {
    assigned: seated.size,
    unassigned: guests.length - seated.size,
    emptyTables: tables.filter((t) => !t.guestIds.length).length,
  }
}

/** 桌上已安排的宾客总数（不去重、不校验名单，用于“是否需要二次确认”判定与文案计数） */
export function countAssignedGuests(tables: BanquetTable[]): number {
  return tables.reduce((sum, t) => sum + t.guestIds.length, 0)
}

/** 深拷贝桌位快照（含 guestIds），供“清空/切预设”后撤销恢复 */
export function snapshotTables(tables: BanquetTable[]): BanquetTable[] {
  return tables.map((t) => ({ ...t, guestIds: [...t.guestIds] }))
}

export interface SplitGroup {
  groupId: string
  groupName: string
  /** 该分组被拆到的桌数 */
  tableCount: number
  tableNames: string[]
  /** 每桌的分组人数（按桌位顺序） */
  tables: Array<{ name: string; count: number }>
}

/**
 * 被拆到多桌的分组（同组宾客分散在 ≥2 桌）；未分组宾客不计。
 * 用于自动排座后的结果摘要，让「同组尽量同桌」的效果可解释。
 */
export function splitGroups(
  guests: BanquetGuest[],
  tables: BanquetTable[],
  groups: BanquetGroup[],
): SplitGroup[] {
  const guestGroup = new Map(guests.map((g) => [g.id, g.groupId]))
  const groupTables = new Map<string, Map<string, number>>()
  for (const table of tables) {
    for (const guestId of table.guestIds) {
      const groupId = guestGroup.get(guestId)
      if (!groupId) continue
      let counts = groupTables.get(groupId)
      if (!counts) {
        counts = new Map()
        groupTables.set(groupId, counts)
      }
      counts.set(table.id, (counts.get(table.id) ?? 0) + 1)
    }
  }
  const tableName = new Map(tables.map((t) => [t.id, t.name]))
  const out: SplitGroup[] = []
  for (const group of groups) {
    const counts = groupTables.get(group.id)
    if (!counts || counts.size < 2) continue
    out.push({
      groupId: group.id,
      groupName: group.name,
      tableCount: counts.size,
      tableNames: [...counts.keys()].map((id) => tableName.get(id) ?? id),
      tables: [...counts].map(([id, count]) => ({ name: tableName.get(id) ?? id, count })),
    })
  }
  return out
}

/** 自动排座结果摘要：已安排/总数、空桌、拆分分组、未安排 */
export interface BanquetSummary {
  assigned: number
  total: number
  emptyTables: number
  splitGroups: number
  unassigned: number
}

export function summarizeBanquet(
  guests: BanquetGuest[],
  tables: BanquetTable[],
  groups: BanquetGroup[],
): BanquetSummary {
  const issues = validateBanquet(guests, tables)
  return {
    assigned: guests.length - issues.unassigned.length,
    total: guests.length,
    emptyTables: issues.emptyTables.length,
    splitGroups: splitGroups(guests, tables, groups).length,
    unassigned: issues.unassigned.length,
  }
}

/** 默认分组配色（可自定义覆盖） */
export const GROUP_COLORS = [
  '#4f46e5',
  '#e11d48',
  '#0891b2',
  '#d97706',
  '#16a34a',
  '#9333ea',
  '#0f766e',
  '#c2410c',
] as const

export function nextGroupColor(existing: BanquetGroup[]): string {
  const used = new Set(existing.map((g) => g.color))
  return GROUP_COLORS.find((c) => !used.has(c)) ?? GROUP_COLORS[existing.length % GROUP_COLORS.length]!
}
