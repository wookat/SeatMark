import { currentLocale, t } from '@/i18n'
import { uid } from '@/utils/id'
import { comparePinyin, matchesChineseQuery } from '@/utils/pinyin'

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
  /** 钉住到某桌：自动分配 / 重新分配 / 整组移桌时保持在该桌并计入容量；缺省或 null 表示未钉住 */
  pinnedTableId?: string | null
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
  /** 已锁定：自动分配不动这桌及其已就座宾客 */
  locked?: boolean
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

/** 宾客名单表头单元格（整格匹配：姓名/分组/桌号/类别/关系…；「主桌」这类桌名不是表头） */
const GUEST_HEADER =
  /^(姓名|名字|宾客|分组|桌|桌号|桌名|桌次|类别|关系|name|guest|group|table|table\s*no\.?|category)$/i
const GUEST_NAME_HEADER = /姓名|名字|^name$/i
const GUEST_GROUP_HEADER = /分组|桌|类别|关系|group|table|category/i
const GENDER_WORDS = new Set(['男', '女', 'm', 'f', 'male', 'female'])
/** 第二列的桌名/组名特征：桌、组、席、家、方结尾，Table/Group 开头，T1 与纯数字 */
const GROUP_WORD = /(桌|组|席|家|方)$|^(table|group)\b|^t\d+$|^\d+$/i
/** “像人名”：2-4 个汉字（可带间隔点）或英文名 */
const NAME_LIKE = /^[\u4e00-\u9fff·•]{2,4}$|^[A-Za-z][A-Za-z.'\-]*(\s[A-Za-z][A-Za-z.'\-]*){0,3}$/

function cleanLine(line: string): string {
  return line.replace(/[\u200b\ufeff]/g, '').replace(/[\u00a0\u3000]/g, ' ')
}

function splitRow(line: string): string[] {
  return line
    .split(/[,，、;；\t]+/)
    .map((c) => c.trim())
    .filter(Boolean)
}

/** 粘贴文本的布局判定：列模式 / 逐 token 拆分 / 无信号但各行列数一致（需用户确认） */
export interface BanquetPasteLayout {
  mode: 'column' | 'tokens' | 'ambiguous'
  /** 列模式的判定信号（调试/测试用） */
  signals: Array<'header' | 'groupWord' | 'duplicateGroup' | 'twoColumnNames'>
  /** ambiguous 时各行一致的列数 */
  columnCount: number
}

/**
 * 多信号判定两列「姓名，分组」模式：首行表头 / 第二列出现桌名词 / 第二列有重复值 /
 * 所有行恰好两列且第一列像人名；第二列命中性别词时否决自动列模式。
 * 完全无信号但各行列数一致（≥ 2 列、≥ 2 行）时不再静默拆 token，交由调用方弹解析预览确认。
 */
export function detectBanquetPasteLayout(text: string): BanquetPasteLayout {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(cleanLine)
    .filter((l) => l.trim() !== '')
  const table = lines.map(splitRow)
  const firstRow = table[0] ?? []
  const signals: BanquetPasteLayout['signals'] = []
  if (firstRow.length >= 2 && firstRow.some((c) => GUEST_HEADER.test(c))) signals.push('header')
  const multiRows = table.filter((r) => r.length >= 2)
  if (multiRows.length >= 2) {
    const second = multiRows.map((r) => r[1]!)
    const genderish = second.some((v) => GENDER_WORDS.has(v.toLowerCase()))
    if (!genderish) {
      if (second.some((v) => GROUP_WORD.test(v))) signals.push('groupWord')
      if (new Set(second).size < second.length) signals.push('duplicateGroup')
      // 两列且第一列像人名、第二列不全像人名（第二列也全像人名时可能是「每行两位宾客」，交预览确认）
      if (
        multiRows.length === table.length &&
        table.every((r) => r.length === 2) &&
        table.every((r) => NAME_LIKE.test(r[0]!)) &&
        !second.every((v) => NAME_LIKE.test(v))
      ) {
        signals.push('twoColumnNames')
      }
    }
  }
  if (signals.length) return { mode: 'column', signals, columnCount: firstRow.length }
  const columnCount = firstRow.length
  const consistent =
    table.length >= 2 && columnCount >= 2 && table.every((r) => r.length === columnCount)
  return { mode: consistent ? 'ambiguous' : 'tokens', signals, columnCount }
}

/** 解析方式：自动判定 / 按列分组 / 仅第一列为姓名（其余列忽略）/ 全部按姓名拆分 */
export type BanquetParseMode = 'auto' | 'column' | 'nameOnly' | 'tokens'

/**
 * 解析宾客名单文本（逐行粘贴或 TXT/CSV 内容）。
 * 单列旧格式：每行一位宾客；同一行内也允许用逗号/顿号/分号/制表符分隔多位；
 * 空格仅在不含拉丁字母的片段内视为分隔符，避免拆散 "Alice Wang" 这类西文姓名。
 * 两列「姓名，分组」模式由 detectBanquetPasteLayout 多信号判定（表头 / 桌名词 / 第二列重复 /
 * 两列且第一列像人名），第二列视为分组，不再展开为宾客；mode 可强制指定解析方式
 * （解析预览确认后使用）。auto 下无信号（含 ambiguous）时回退拆 token。
 * 自动去除空白行、全角空格与重复姓名（保留首次出现顺序）。
 */
export function parseBanquetGuests(text: string, mode: BanquetParseMode = 'auto'): ParsedBanquetGuests {
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
  const table = lines.map(splitRow)
  const firstRow = table[0] ?? []
  const headerHit = firstRow.length >= 2 && firstRow.some((c) => GUEST_HEADER.test(c))
  const columnMode =
    mode === 'column' ||
    mode === 'nameOnly' ||
    (mode === 'auto' && detectBanquetPasteLayout(text).mode === 'column')

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
    const group = row.length > 1 && mode !== 'nameOnly' ? (row[groupIdx] ?? '') : ''
    push(name)
    if (group && !(name in groups)) groups[name] = group
  }
  return {
    names,
    duplicates,
    groups: mode === 'nameOnly' ? undefined : groups,
    headerSkipped: headerHit,
  }
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

// ---------- 自动分配（同组尽量同桌 / 优先坐满） ----------

/**
 * 自动分配策略：
 * - keep-groups（默认）：尽量不拆组，每组 best-fit 整组放桌，放不下时才拆；
 * - fill-tables：按桌顺序依次坐满，组内成员连续排，空桌最少但可能更多组被拆。
 */
export type AssignStrategy = 'keep-groups' | 'fill-tables'

/** 「A 与 B 不同桌」：两位宾客 id，无序 */
export type AvoidPair = [string, string]

export interface AutoAssignOptions {
  /** 默认 true：锁定桌保持原样，其已就座宾客不进待分配集合 */
  respectLocked?: boolean
  /** 软约束：挑桌时先跳过已含排斥对象的桌，只在没有其它可容纳桌时才落座 */
  avoidPairs?: AvoidPair[]
}

/** guestId → 其排斥对象 id 集合（忽略自排斥与空 id） */
export function avoidMap(pairs: readonly AvoidPair[] | undefined): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const [a, b] of pairs ?? []) {
    if (!a || !b || a === b) continue
    if (!map.has(a)) map.set(a, new Set())
    if (!map.has(b)) map.set(b, new Set())
    map.get(a)!.add(b)
    map.get(b)!.add(a)
  }
  return map
}

/** 去重后的排斥对（无序，去掉自排斥与不在名单中的 id） */
export function normalizeAvoidPairs(pairs: readonly AvoidPair[], guests: readonly BanquetGuest[]): AvoidPair[] {
  const known = new Set(guests.map((g) => g.id))
  const seen = new Set<string>()
  const out: AvoidPair[] = []
  for (const [a, b] of pairs) {
    if (!a || !b || a === b || !known.has(a) || !known.has(b)) continue
    const key = a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push([a, b])
  }
  return out
}

/** 命中搜索的宾客及所在桌（tableId 为 null = 未安排） */
export interface GuestSearchHit {
  guest: BanquetGuest
  tableId: string | null
}

/** 按姓名 / 拼音首字母检索宾客（query 为空返回空），保持名单顺序 */
export function searchGuests(
  guests: BanquetGuest[],
  tables: BanquetTable[],
  query: string,
): GuestSearchHit[] {
  if (!query.trim()) return []
  const tableOf = new Map<string, string>()
  for (const t of tables) for (const id of t.guestIds) tableOf.set(id, t.id)
  return guests
    .filter((g) => matchesChineseQuery(g.name, query))
    .map((g) => ({ guest: g, tableId: tableOf.get(g.id) ?? null }))
}

/** 按分组聚合宾客：大组优先（稳定），未分组永远最后，组内保持名单顺序 */
function groupGuestsForAssign(guests: BanquetGuest[]): Array<[string, BanquetGuest[]]> {
  const byGroup = new Map<string, BanquetGuest[]>()
  for (const g of guests) {
    const key = g.groupId ?? ''
    const list = byGroup.get(key)
    if (list) list.push(g)
    else byGroup.set(key, [g])
  }
  return [...byGroup.entries()].sort((a, b) => {
    if (a[0] === '') return 1
    if (b[0] === '') return -1
    return b[1].length - a[1].length
  })
}

/**
 * 有排斥对时，散客（未分组）桶内互斥的后者拆成独立单元追加到最后，
 * 保证单元内部无冲突；已分组的宾客仍整组同桌（组内排斥只报冲突，不拆组）。
 */
function splitAvoidUnits(
  units: Array<[string, BanquetGuest[]]>,
  avoid: Map<string, Set<string>>,
): Array<[string, BanquetGuest[]]> {
  const out: Array<[string, BanquetGuest[]]> = []
  const extras: Array<[string, BanquetGuest[]]> = []
  for (const [key, members] of units) {
    if (key !== '') {
      out.push([key, members])
      continue
    }
    const kept: BanquetGuest[] = []
    for (const m of members) {
      const foes = avoid.get(m.id)
      if (foes && kept.some((k) => foes.has(k.id))) extras.push(['', [m]])
      else kept.push(m)
    }
    if (kept.length) out.push(['', kept])
  }
  return [...out, ...extras]
}

/**
 * 一键自动分配：
 * 1. 按分组聚合宾客（未分组的排最后），组内保持名单顺序；
 * 2. keep-groups：大组优先；每组先找「剩余座位刚好放得下整组」的最小桌（best-fit），
 *    放不下整组时按剩余座位从多到少拆分到多张桌；
 *    fill-tables：按桌顺序依次坐满，组内成员连续，一桌满了接下一桌；
 * 3. 返回每桌新的 guestIds（不修改入参）。
 */
export function autoAssignGuests(
  guests: BanquetGuest[],
  allTables: BanquetTable[],
  strategy: AssignStrategy = 'keep-groups',
  opts: AutoAssignOptions = {},
): Map<string, string[]> {
  const respectLocked = opts.respectLocked ?? true
  const avoid = avoidMap(opts.avoidPairs)
  const assigned = new Map<string, string[]>()
  const lockedGuestIds = new Set<string>()
  const tables: BanquetTable[] = []
  for (const t of allTables) {
    if (respectLocked && t.locked) {
      assigned.set(t.id, [...t.guestIds])
      for (const id of t.guestIds) lockedGuestIds.add(id)
    } else {
      assigned.set(t.id, [])
      tables.push(t)
    }
  }
  const free = new Map<string, number>(tables.map((t) => [t.id, t.seats]))
  const order = tables.map((t) => t.id)
  // 钉住的宾客先落座到所钉桌（桌需存在且未锁定），占用该桌容量，不再参与分组分配
  const pinnedGuestIds = new Set<string>()
  for (const g of guests) {
    if (lockedGuestIds.has(g.id) || !g.pinnedTableId || !free.has(g.pinnedTableId)) continue
    pinnedGuestIds.add(g.id)
    assigned.get(g.pinnedTableId)!.push(g.id)
    free.set(g.pinnedTableId, free.get(g.pinnedTableId)! - 1)
  }
  const grouped = groupGuestsForAssign(
    guests.filter((g) => !lockedGuestIds.has(g.id) && !pinnedGuestIds.has(g.id)),
  )
  const groupsSorted = avoid.size ? splitAvoidUnits(grouped, avoid) : grouped

  const put = (tableId: string, members: BanquetGuest[]) => {
    assigned.get(tableId)!.push(...members.map((m) => m.id))
    free.set(tableId, free.get(tableId)! - members.length)
  }
  /** 该桌上（含锁定/钉住/已分配）是否已有 members 中任一人的排斥对象 */
  const conflicts = (tableId: string, members: readonly BanquetGuest[]): boolean => {
    if (!avoid.size) return false
    const seated = assigned.get(tableId)!
    if (!seated.length) return false
    for (const m of members) {
      const foes = avoid.get(m.id)
      if (foes && seated.some((id) => foes.has(id))) return true
    }
    return false
  }
  /** 先在无冲突的桌中挑，挑不到再退回全部桌（软约束） */
  const pick = (members: readonly BanquetGuest[], choose: (ids: readonly string[]) => string | null): string | null => {
    if (avoid.size) {
      const clean = order.filter((id) => !conflicts(id, members))
      const hit = choose(clean)
      if (hit) return hit
    }
    return choose(order)
  }

  if (strategy === 'fill-tables') {
    let cursor = 0
    for (const [, members] of groupsSorted) {
      let rest = [...members]
      while (rest.length && cursor < order.length) {
        const id = order[cursor]!
        const f = free.get(id)!
        if (f <= 0) {
          cursor++
          continue
        }
        // 排斥：与当前桌冲突的成员先换到后面的无冲突桌；没有就照常坐下
        if (avoid.size) {
          const clash = rest.filter((m) => conflicts(id, [m]))
          if (clash.length) {
            const alt = order.slice(cursor + 1).find((tid) => free.get(tid)! > 0 && !conflicts(tid, clash))
            if (alt) {
              const take = Math.min(free.get(alt)!, clash.length)
              const moved = clash.slice(0, take)
              put(alt, moved)
              rest = rest.filter((m) => !moved.includes(m))
              continue
            }
          }
        }
        const take = Math.min(f, rest.length)
        put(id, rest.slice(0, take))
        rest = rest.slice(take)
      }
      if (cursor >= order.length) break // 所有桌已满，剩余宾客保持未安排
    }
    return assigned
  }

  for (const [, members] of groupsSorted) {
    let rest = [...members]
    while (rest.length) {
      // best-fit：能整组放下的桌里剩余座位最少的一张
      const need = rest.length
      const best = pick(rest, (ids) => {
        let hit: string | null = null
        for (const id of ids) {
          const f = free.get(id)!
          if (f >= need && (hit === null || f < free.get(hit)!)) hit = id
        }
        return hit
      })
      if (best) {
        put(best, rest)
        rest = []
        break
      }
      // 放不下整组：填进剩余座位最多的桌，剩下的继续
      const widest = pick(rest, (ids) => {
        let hit: string | null = null
        for (const id of ids) {
          const f = free.get(id)!
          if (f > 0 && (hit === null || f > free.get(hit)!)) hit = id
        }
        return hit
      })
      if (!widest) break // 所有桌已满，剩余宾客保持未安排
      const take = Math.min(free.get(widest)!, rest.length)
      put(widest, rest.slice(0, take))
      rest = rest.slice(take)
    }
  }
  return assigned
}

/** 已坐在同一桌的排斥对（按 pairs 顺序，tableId 为所在桌） */
export function findAvoidConflicts(
  pairs: readonly AvoidPair[] | undefined,
  tables: readonly BanquetTable[],
): Array<{ a: string; b: string; tableId: string }> {
  if (!pairs?.length) return []
  const tableOf = new Map<string, string>()
  for (const t of tables) for (const id of t.guestIds) tableOf.set(id, t.id)
  const out: Array<{ a: string; b: string; tableId: string }> = []
  for (const [a, b] of pairs) {
    if (!a || !b || a === b) continue
    const ta = tableOf.get(a)
    if (ta && ta === tableOf.get(b)) out.push({ a, b, tableId: ta })
  }
  return out
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
  /** 「不同桌」排斥对却坐在同一桌（a/b 为 guestId） */
  avoidConflicts: Array<{ a: string; b: string; tableId: string }>
}

export function validateBanquet(
  guests: BanquetGuest[],
  tables: BanquetTable[],
  avoidPairs: readonly AvoidPair[] = [],
): BanquetIssues {
  const seated = new Set<string>()
  for (const t of tables) for (const id of t.guestIds) seated.add(id)
  const tableName = new Map(tables.map((t) => [t.id, t.name]))
  return {
    unassigned: guests.filter((g) => !seated.has(g.id)).map((g) => g.name),
    emptyTables: tables.filter((t) => !t.guestIds.length).map((t) => t.name),
    overlaps: findOverlaps(tables).map(([a, b]) => [tableName.get(a)!, tableName.get(b)!]),
    overCapacity: tables.filter((t) => t.guestIds.length > t.seats).map((t) => t.name),
    duplicateNames: findDuplicateGuestNames(guests),
    avoidConflicts: findAvoidConflicts(avoidPairs, tables),
  }
}

/** 安排概览（步骤标题旁状态条）：已安排 / 未安排 / 空桌 */
export interface AssignmentSummary {
  assigned: number
  unassigned: number
  emptyTables: number
  /** 「不同桌」排斥对中坐在同一桌的对数（仅 >0 时展示） */
  avoidConflicts: number
}

/** 已安排人数只统计仍在名单中的宾客（桌上残留的已删除 id 不计） */
export function summarizeAssignments(
  guests: BanquetGuest[],
  tables: BanquetTable[],
  avoidPairs: readonly AvoidPair[] = [],
): AssignmentSummary {
  const known = new Set(guests.map((g) => g.id))
  const seated = new Set<string>()
  for (const t of tables) for (const id of t.guestIds) if (known.has(id)) seated.add(id)
  return {
    assigned: seated.size,
    unassigned: guests.length - seated.size,
    emptyTables: tables.filter((t) => !t.guestIds.length).length,
    avoidConflicts: findAvoidConflicts(avoidPairs, tables).length,
  }
}

/** 桌上已安排的宾客总数（不去重、不校验名单，用于“是否需要二次确认”判定与文案计数） */
export function countAssignedGuests(tables: BanquetTable[]): number {
  return tables.reduce((sum, t) => sum + t.guestIds.length, 0)
}

/** 排桌 → 标签工坊席位卡的名单表头（顺序即列顺序） */
export const BANQUET_HANDOFF_HEADERS = ['姓名', '桌号', '分组', '座位号'] as const

/**
 * 已安排宾客 → 席位卡名单行：按桌顺序、桌内座次展开，桌号 = 桌名，座位号 = 桌内座次（1 起）。
 * 未安排的宾客与找不到名单记录的 guestId 不出现；无人安排返回空数组（调用方据此禁用按钮）。
 */
export function buildBanquetHandoffRows(
  guests: readonly BanquetGuest[],
  tables: readonly BanquetTable[],
  groups: readonly BanquetGroup[],
): Record<(typeof BANQUET_HANDOFF_HEADERS)[number], string>[] {
  const guestById = new Map(guests.map((g) => [g.id, g]))
  const groupById = new Map(groups.map((g) => [g.id, g]))
  const rows: Record<(typeof BANQUET_HANDOFF_HEADERS)[number], string>[] = []
  for (const table of tables) {
    let seat = 0
    for (const id of table.guestIds) {
      const guest = guestById.get(id)
      if (!guest || !guest.name.trim()) continue
      seat += 1
      rows.push({
        姓名: guest.name.trim(),
        桌号: table.name,
        分组: (guest.groupId && groupById.get(guest.groupId)?.name) || '',
        座位号: String(seat),
      })
    }
  }
  return rows
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

/** 分组被拆开的原因 */
export type SplitReason = 'group-larger-than-any-table' | 'no-table-had-enough-free-seats'

export interface SplitExplanation extends SplitGroup {
  reason: SplitReason
  /** 该分组人数 */
  groupSize: number
  /** 场地中最大一桌的座位数 */
  maxTableSeats: number
}

/**
 * 解释每个被拆分组的原因（纯函数，基于当前分配结果）：
 * - 组人数 > 任一桌座位数 → 'group-larger-than-any-table'（无论怎么排都必拆）；
 * - 否则 → 'no-table-had-enough-free-seats'（有桌容得下整组，但轮到它时没有一桌剩余座位够坐）。
 */
export function explainSplit(
  guests: BanquetGuest[],
  tables: BanquetTable[],
  groups: BanquetGroup[],
): SplitExplanation[] {
  const maxTableSeats = tables.reduce((max, t) => Math.max(max, t.seats), 0)
  const sizeByGroup = new Map<string, number>()
  for (const g of guests) {
    if (!g.groupId) continue
    sizeByGroup.set(g.groupId, (sizeByGroup.get(g.groupId) ?? 0) + 1)
  }
  return splitGroups(guests, tables, groups).map((split) => {
    const groupSize = sizeByGroup.get(split.groupId) ?? 0
    return {
      ...split,
      groupSize,
      maxTableSeats,
      reason:
        groupSize > maxTableSeats ? 'group-larger-than-any-table' : 'no-table-had-enough-free-seats',
    }
  })
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

// ---------- 宾客速查表（迎宾台索引 + 按桌名单） ----------

export interface GuestIndexEntry {
  name: string
  tableName: string
}

export interface TableRosterRow {
  tableName: string
  /** 桌内座次（从 1 起）；未安排宾客为空串 */
  seatNo: string
  name: string
  groupName: string
  /** 宾客是否钉住在本桌（仅按桌名单 CSV 输出，速查表不显示） */
  pinned: boolean
}

export interface TableRoster {
  tableName: string
  rows: TableRosterRow[]
}

export interface GuestQuickReference {
  /** 按姓名拼音序的「姓名 → 桌名」索引（未安排宾客桌名为「待安排」） */
  index: GuestIndexEntry[]
  /** 按桌顺序的名单；空桌不出现；未安排宾客单列一组「待安排」放最后 */
  tables: TableRoster[]
}

/** 未安排宾客在速查表中的分组名 */
export function unassignedTableName(): string {
  return t('待安排')
}

/**
 * 生成宾客速查表数据（纯函数）：
 * - 索引按姓名拼音序（Intl.Collator zh 拼音），同名按名单顺序稳定排列；
 * - 按桌名单沿桌位顺序、桌内按 guestIds 顺序给座次；不在名单中的残留 id 跳过；
 * - 没有宾客的桌不出现；未安排宾客汇总到「待安排」一组（座次留空）。
 */
export function buildGuestQuickReference(
  guests: BanquetGuest[],
  tables: BanquetTable[],
  groups: BanquetGroup[],
): GuestQuickReference {
  const guestById = new Map(guests.map((g) => [g.id, g]))
  const groupName = new Map(groups.map((g) => [g.id, g.name]))
  const seated = new Set<string>()
  const rosters: TableRoster[] = []
  for (const table of tables) {
    const rows: TableRosterRow[] = []
    for (const id of table.guestIds) {
      const guest = guestById.get(id)
      if (!guest || seated.has(id)) continue
      seated.add(id)
      rows.push({
        tableName: table.name,
        seatNo: String(rows.length + 1),
        name: guest.name,
        groupName: (guest.groupId && groupName.get(guest.groupId)) || '',
        pinned: guest.pinnedTableId === table.id,
      })
    }
    if (rows.length) rosters.push({ tableName: table.name, rows })
  }
  const pending = guests.filter((g) => !seated.has(g.id) && g.name.trim())
  if (pending.length) {
    const tableName = unassignedTableName()
    rosters.push({
      tableName,
      rows: pending.map((g) => ({
        tableName,
        seatNo: '',
        name: g.name,
        groupName: (g.groupId && groupName.get(g.groupId)) || '',
        pinned: false,
      })),
    })
  }
  const index = rosters
    .flatMap((r) => r.rows.map((row) => ({ name: row.name, tableName: r.tableName })))
    .map((entry, order) => ({ ...entry, order }))
    .sort((a, b) => comparePinyin(a.name, b.name) || a.order - b.order)
    .map(({ name, tableName }) => ({ name, tableName }))
  return { index, tables: rosters }
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** 按桌名单 CSV（UTF-8 BOM，列：桌名/座次/姓名/分组/钉住），Excel 双击即可正确显示中文 */
export function quickReferenceCsv(tables: TableRoster[]): string {
  const header = [t('桌名'), t('座次'), t('姓名'), t('分组'), t('钉住')]
  const pinnedMark = t('是')
  const lines = [header.join(',')]
  for (const table of tables) {
    for (const row of table.rows) {
      lines.push(
        [row.tableName, row.seatNo, row.name, row.groupName, row.pinned ? pinnedMark : '']
          .map(csvCell)
          .join(','),
      )
    }
  }
  return '\ufeff' + lines.join('\r\n') + '\r\n'
}
