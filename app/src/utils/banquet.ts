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

/**
 * 解析宾客名单文本（逐行粘贴或 TXT 内容）：
 * 每行一位宾客；同一行内也允许用逗号/顿号/分号/制表符分隔多位。
 * 空格仅在不含拉丁字母的片段内视为分隔符，避免拆散 "Alice Wang" 这类西文姓名。
 * 自动去除空白行、全角空格与重复姓名（保留首次出现顺序）。
 */
export function parseBanquetGuests(text: string): { names: string[]; duplicates: string[] } {
  const names: string[] = []
  const seen = new Set<string>()
  const duplicates: string[] = []
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const tokens = line
      .replace(/[\u200b\ufeff]/g, '')
      .replace(/[\u00a0\u3000]/g, ' ')
      .split(/[,，、;；\t]+/)
      .flatMap((part) => (/[A-Za-z]/.test(part) ? [part] : part.split(/\s+/)))
      .map((s) => s.trim())
      .filter(Boolean)
    for (const t of tokens) {
      if (seen.has(t)) {
        duplicates.push(t)
        continue
      }
      seen.add(t)
      names.push(t)
    }
  }
  return { names, duplicates }
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
  }
}

export interface SplitGroup {
  groupId: string
  groupName: string
  /** 该分组被拆到的桌数 */
  tableCount: number
  tableNames: string[]
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
  const groupTables = new Map<string, Set<string>>()
  for (const table of tables) {
    for (const guestId of table.guestIds) {
      const groupId = guestGroup.get(guestId)
      if (!groupId) continue
      let set = groupTables.get(groupId)
      if (!set) {
        set = new Set()
        groupTables.set(groupId, set)
      }
      set.add(table.id)
    }
  }
  const tableName = new Map(tables.map((t) => [t.id, t.name]))
  const out: SplitGroup[] = []
  for (const group of groups) {
    const set = groupTables.get(group.id)
    if (!set || set.size < 2) continue
    out.push({
      groupId: group.id,
      groupName: group.name,
      tableCount: set.size,
      tableNames: [...set].map((id) => tableName.get(id) ?? id),
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
