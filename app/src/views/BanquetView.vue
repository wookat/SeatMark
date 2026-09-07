<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import MobilePreviewJump from '@/components/MobilePreviewJump.vue'
import NextStepBar, { type NextStep } from '@/components/NextStepBar.vue'
import { useNextStepBarHeight } from '@/composables/useNextStepBarHeight'
import CheckboxField from '@/components/ui/CheckboxField.vue'
import ColorField from '@/components/ui/ColorField.vue'
import ModalDialog from '@/components/ui/ModalDialog.vue'
import NumberField from '@/components/ui/NumberField.vue'
import SelectField, { type SelectOption } from '@/components/ui/SelectField.vue'
import { useElementSize } from '@/composables/useElementSize'
import { GUEST_FILE_ACCEPT, useGuestFileImport } from '@/composables/useGuestFileImport'
import { useQuotaBadge } from '@/composables/useQuotaBadge'
import { useCanvasSafeArea, useStickyActions } from '@/composables/useStickyActions'
import { demoPersonNames } from '@/data/demoDatasets'
import { currentLocale, localePath, t as tr } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useQuotaStore } from '@/stores/quota'
import { useToastStore } from '@/stores/toast'
import {
  assignGroupToGuests,
  autoAssignGuests,
  type AssignStrategy,
  searchGuests,
  type GuestSearchHit,
  BANQUET_STATE_KEY,
  explainSplit,
  type SplitExplanation,
  buildBanquetHandoffRows,
  buildGuestQuickReference,
  buildVenuePreset,
  countAssignedGuests,
  defaultTableName,
  detectBanquetPasteLayout,
  MARKER_PRESETS,
  nextGroupColor,
  parseBanquetGuests,
  parseBanquetGuestsFromTable,
  type BanquetParseMode,
  type ParsedBanquetGuests,
  quickReferenceCsv,
  snapshotTables,
  summarizeAssignments,
  removeEmptyTables,
  summarizeBanquet,
  validateBanquet,
  VENUE_HEIGHT,
  VENUE_PRESETS,
  VENUE_WIDTH,
  type BanquetGroup,
  type BanquetGuest,
  type BanquetIssues,
  type BanquetMarker,
  type BanquetTable,
  type GuestQuickReference,
  type MarkerKind,
  type VenuePresetId,
} from '@/utils/banquet'
import { POSTER_GAP_MM, computePosterLayout } from '@/utils/banquetExportLayout'
import { uid } from '@/utils/id'
import { fitScale, MM_TO_PX } from '@/utils/layout'
import { listJoin } from '@/utils/listJoin'
import { setPrintPageSize } from '@/utils/paper'
import { downloadBlob, exportPagedPng, sanitizeFileNamePart } from '@/utils/pngExport'
import { printAndWaitUntilDone } from '@/utils/printing'
import { defaultPdfFileName, exportPagedPdf } from '@/utils/pdfExport'
import { SEATING_HANDOFF_KEY, type SeatingHandoff } from '@/utils/seating'

const router = useRouter()
const toast = useToastStore()
useStickyActions()
useCanvasSafeArea()
const quota = useQuotaStore()
const auth = useAuthStore()
const { badge: exportBadge, title: exportBadgeTitle } = useQuotaBadge(quota, auth, tr)

// ---------- 状态（持久化到 localStorage，口径同 SeatingView） ----------

interface BanquetPersistedState {
  title: string
  pasteText: string
  guests: BanquetGuest[]
  groups: BanquetGroup[]
  tables: BanquetTable[]
  markers: BanquetMarker[]
  paper: 'a4' | 'a3'
  orientation: 'landscape' | 'portrait'
  exportColors: boolean
  posterLayout?: boolean
}

function loadPersistedState(): BanquetPersistedState | null {
  try {
    const raw = localStorage.getItem(BANQUET_STATE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as BanquetPersistedState
  } catch {
    return null
  }
}

const persisted = loadPersistedState()

const title = ref(persisted?.title ?? tr('婚宴座位表'))
const pasteText = ref(persisted?.pasteText ?? '')
const guests = ref<BanquetGuest[]>(persisted?.guests ?? [])
const groups = ref<BanquetGroup[]>(persisted?.groups ?? [])
const tables = ref<BanquetTable[]>(persisted?.tables ?? buildVenuePreset('round'))
const markers = ref<BanquetMarker[]>(persisted?.markers ?? [])
const paper = ref<'a4' | 'a3'>(persisted?.paper ?? 'a4')
const orientation = ref<'landscape' | 'portrait'>(persisted?.orientation ?? 'landscape')
/** 导出是否带分组颜色：默认不带（成品贴给宾客看） */
const exportColors = ref(persisted?.exportColors ?? false)
/** 张贴版（远距可读）：导出时把非空桌重排为网格铺满页面、姓名字号自适应；关闭则按屏幕场地图原样输出（紧凑版） */
const posterLayout = ref(persisted?.posterLayout ?? true)

watch(
  [title, pasteText, guests, groups, tables, markers, paper, orientation, exportColors, posterLayout],
  () => {
    try {
      const state: BanquetPersistedState = {
        title: title.value,
        pasteText: pasteText.value,
        guests: guests.value,
        groups: groups.value,
        tables: tables.value,
        markers: markers.value,
        paper: paper.value,
        orientation: orientation.value,
        exportColors: exportColors.value,
        posterLayout: posterLayout.value,
      }
      localStorage.setItem(BANQUET_STATE_KEY, JSON.stringify(state))
    } catch {
      /* 隐私模式等存储不可用：不持久化 */
    }
  },
  { deep: true },
)

// ---------- 第 1 步：宾客名单 ----------

const pasteInput = ref<HTMLTextAreaElement | null>(null)

function focusPasteInput() {
  const el = pasteInput.value
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.focus()
}

const guestById = computed(() => new Map(guests.value.map((g) => [g.id, g])))
const groupById = computed(() => new Map(groups.value.map((g) => [g.id, g])))

/** 最近一次导入被合并的重复姓名（包括与现有名单重复的），在名单区常驻提示 */
const mergedDuplicates = ref<string[]>([])
const mergedDuplicatesText = computed(() => {
  const list = mergedDuplicates.value
  if (!list.length) return ''
  const sample = listJoin(list.slice(0, 5))
  return list.length > 5 ? `${sample}…` : sample
})

/**
 * 将解析结果并入名单：新分组名自动建组（nextGroupColor），已存在的同名分组直接复用；
 * toast 汇总宾客数 / 新建分组数 / 跳过表头 / 重复人数。
 */
function applyParsedGuests(parsed: ParsedBanquetGuests): boolean {
  const { names, duplicates, groups: groupMap, headerSkipped } = parsed
  if (!names.length) {
    toast.warning(tr('名单为空'), tr('请粘贴宾客名单，每行一位'))
    return false
  }
  const existing = new Set(guests.value.map((g) => g.name))
  const fresh = names.filter((n) => !existing.has(n))
  const groupIdByName = new Map(groups.value.map((g) => [g.name, g.id]))
  const created: BanquetGroup[] = []
  const resolveGroup = (name: string): string | null => {
    const groupName = groupMap?.[name]
    if (!groupName) return null
    const known = groupIdByName.get(groupName)
    if (known) return known
    const group: BanquetGroup = {
      id: uid('grp'),
      name: groupName,
      color: nextGroupColor([...groups.value, ...created]),
    }
    created.push(group)
    groupIdByName.set(groupName, group.id)
    return group.id
  }
  const added: BanquetGuest[] = fresh.map((name) => ({ id: uid('gst'), name, groupId: resolveGroup(name) }))
  if (created.length) groups.value = [...groups.value, ...created]
  guests.value = [...guests.value, ...added]
  const merged = [...new Set([...duplicates, ...names.filter((n) => existing.has(n))])]
  mergedDuplicates.value = merged
  const details = [
    created.length ? `${tr('新建')} ${created.length} ${tr('个分组')}` : '',
    headerSkipped ? tr('跳过表头 1 行') : '',
    merged.length ? `${merged.length} ${tr('人重复')}` : '',
  ].filter(Boolean)
  toast.success(
    `${tr('已导入')} ${fresh.length} ${tr('位宾客')}`,
    details.length ? listJoin(details) : tr('可在下方列表继续编辑、分组'),
  )
  return true
}

/**
 * 粘贴解析预览：各行列数一致但无清晰分组信号时不再静默拆 token，
 * 先展示识别结果（分组与各组人数），由用户选择解析方式后再导入。
 */
type PreviewParseMode = Exclude<BanquetParseMode, 'auto'>
const parsePreview = ref<{ text: string; columnCount: number } | null>(null)
const parsePreviewMode = ref<PreviewParseMode>('column')
const parsePreviewModes = computed<Array<{ value: PreviewParseMode; label: string; hint: string }>>(() => [
  { value: 'column', label: tr('按列分组'), hint: tr('第一列为姓名，第二列为分组/桌名') },
  { value: 'nameOnly', label: tr('仅第一列为姓名'), hint: tr('其余列忽略，不建分组') },
  { value: 'tokens', label: tr('全部按姓名拆分'), hint: tr('每一格都是一位宾客') },
])
const parsePreviewResult = computed<ParsedBanquetGuests | null>(() =>
  parsePreview.value ? parseBanquetGuests(parsePreview.value.text, parsePreviewMode.value) : null,
)
const parsePreviewGroups = computed<Array<{ name: string; count: number }>>(() => {
  const groupMap = parsePreviewResult.value?.groups
  if (!groupMap) return []
  const counts = new Map<string, number>()
  for (const name of parsePreviewResult.value?.names ?? []) {
    const group = groupMap[name]
    if (group) counts.set(group, (counts.get(group) ?? 0) + 1)
  }
  return [...counts].map(([name, count]) => ({ name, count }))
})
const parsePreviewNames = computed(() => {
  const names = parsePreviewResult.value?.names ?? []
  return names.length > 8 ? `${names.slice(0, 8).join(tr('、'))}…` : names.join(tr('、'))
})

function importPasted() {
  const text = pasteText.value
  const layout = detectBanquetPasteLayout(text)
  if (layout.mode === 'ambiguous') {
    parsePreviewMode.value = 'column'
    parsePreview.value = { text, columnCount: layout.columnCount }
    return
  }
  if (applyParsedGuests(parseBanquetGuests(text))) pasteText.value = ''
}

function confirmParsePreview() {
  const preview = parsePreview.value
  if (!preview) return
  const parsed = parseBanquetGuests(preview.text, parsePreviewMode.value)
  parsePreview.value = null
  if (applyParsedGuests(parsed)) pasteText.value = ''
}

/** TXT/CSV/Excel 名单文件入口：Excel 取「姓名」与「分组」列（无表头则取前两列），文本追加到粘贴框 */
const guestFile = useGuestFileImport({
  onTable: (headers, rows) => {
    applyParsedGuests(parseBanquetGuestsFromTable(headers, rows))
  },
  onText: (text) => {
    pasteText.value = pasteText.value.trim() ? `${pasteText.value}\n${text}` : text
    toast.info(tr('文件已读取到输入框'), tr('确认内容后点「添加到名单」'))
  },
  onError: (message) => {
    toast.danger(tr('Excel 导入失败'), tr(message))
  },
})

function addGuestRow() {
  guests.value = [...guests.value, { id: uid('gst'), name: '', groupId: null }]
}

function removeGuest(id: string) {
  guests.value = guests.value.filter((g) => g.id !== id)
  for (const t of tables.value) {
    t.guestIds = t.guestIds.filter((gid) => gid !== id)
  }
}

function addGroup() {
  groups.value = [
    ...groups.value,
    { id: uid('grp'), name: `${tr('分组')} ${groups.value.length + 1}`, color: nextGroupColor(groups.value) },
  ]
}

function removeGroup(id: string) {
  groups.value = groups.value.filter((g) => g.id !== id)
  for (const g of guests.value) {
    if (g.groupId === id) g.groupId = null
  }
}

const groupOptions = computed<SelectOption[]>(() => [
  { value: '', label: tr('未分组') },
  ...groups.value.map((g) => ({ value: g.id, label: g.name })),
])

function loadDemoGuests(count = 48) {
  const demoGroups: BanquetGroup[] = [
    { id: uid('grp'), name: tr('男方亲友'), color: '#4f46e5' },
    { id: uid('grp'), name: tr('女方亲友'), color: '#e11d48' },
    { id: uid('grp'), name: tr('同事'), color: '#0891b2' },
  ]
  const list: BanquetGuest[] = demoPersonNames(count, currentLocale()).map((name, i) => ({
    id: uid('gst'),
    name,
    groupId: demoGroups[i % 3]!.id,
  }))
  groups.value = demoGroups
  guests.value = list
  mergedDuplicates.value = []
  for (const t of tables.value) t.guestIds = []
  toast.info(tr('已生成演示名单'), `${list.length} ${tr('位宾客、3 个分组')}`)
}

/** 常驻状态条：已安排 / 未安排 / 空桌（与导出前检查、未安排列表同一口径） */
const assignmentSummary = computed(() => summarizeAssignments(guests.value, tables.value))

// ---------- 底部「下一步」操作条（只做导航，不碰数据） ----------
const rosterSection = ref<HTMLElement | null>(null)
const assignSection = ref<HTMLElement | null>(null)
const exportSection = ref<HTMLElement | null>(null)
const nextStep = computed<NextStep>(() => {
  if (!guests.value.length) return 'import'
  if (!assignmentSummary.value.assigned) return 'arrange'
  return 'export'
})
const nextStepTarget = computed(() => {
  switch (nextStep.value) {
    case 'import':
      return rosterSection.value
    case 'arrange':
      return assignSection.value
    case 'export':
      return exportSection.value
  }
})
const nextStepProgress = computed(
  () => `${tr('已安排')} ${assignmentSummary.value.assigned}/${guests.value.length}`,
)

// ---------- 第 2 步：场地布局 ----------

const selectedId = ref<string | null>(null)

const selectedTable = computed(() => tables.value.find((t) => t.id === selectedId.value) ?? null)
const selectedMarker = computed(() => markers.value.find((m) => m.id === selectedId.value) ?? null)

/** 二次确认：已有安排时切预设 / 清空安排前先弹窗，确认后可在 toast 中 10 秒内撤销 */
const UNDO_WINDOW_MS = 10_000
const pendingDestructive = ref<{ kind: 'preset'; preset: VenuePresetId } | { kind: 'clear' } | null>(
  null,
)
const confirmAssignedCount = computed(() => countAssignedGuests(tables.value))

function restoreTables(snapshot: BanquetTable[]) {
  tables.value = snapshotTables(snapshot)
  selectedId.value = null
  toast.info(tr('已撤销'), `${tr('已恢复桌位安排')}: ${countAssignedGuests(tables.value)}`)
}

function applyPreset(preset: VenuePresetId) {
  if (countAssignedGuests(tables.value) > 0) {
    pendingDestructive.value = { kind: 'preset', preset }
    return
  }
  doApplyPreset(preset)
}

function doApplyPreset(preset: VenuePresetId) {
  const snapshot = snapshotTables(tables.value)
  const hadAssignments = countAssignedGuests(snapshot) > 0
  tables.value = buildVenuePreset(preset)
  selectedId.value = null
  if (hadAssignments) {
    toast.push(
      'success',
      tr('已应用场地预设'),
      tr('桌上原有的宾客安排已清空，可重新一键分配'),
      UNDO_WINDOW_MS,
      { label: tr('撤销'), onClick: () => restoreTables(snapshot) },
    )
  } else {
    toast.success(tr('已应用场地预设'), tr('可在第 3 步一键自动分配座位'))
  }
}

function confirmDestructive() {
  const pending = pendingDestructive.value
  pendingDestructive.value = null
  if (!pending) return
  if (pending.kind === 'preset') doApplyPreset(pending.preset)
  else doClearAssignments()
}

function addTable(shape: 'round' | 'rect') {
  const t: BanquetTable = {
    id: uid('tbl'),
    name: defaultTableName(tables.value.length + 1),
    shape,
    x: VENUE_WIDTH / 2 - 32,
    y: VENUE_HEIGHT / 2 - 32,
    width: shape === 'round' ? 64 : 110,
    height: shape === 'round' ? 64 : 36,
    seats: shape === 'round' ? 10 : 8,
    guestIds: [],
  }
  tables.value = [...tables.value, t]
  selectedId.value = t.id
}

function removeTable(id: string) {
  tables.value = tables.value.filter((t) => t.id !== id)
  if (selectedId.value === id) selectedId.value = null
}

function addMarker(kind: MarkerKind) {
  const preset = MARKER_PRESETS[kind]
  const m: BanquetMarker = {
    id: uid('mrk'),
    kind,
    label: tr(preset.label),
    x: VENUE_WIDTH / 2 - preset.width / 2,
    y: kind === 'entrance' ? VENUE_HEIGHT - preset.height - 8 : 8,
    width: preset.width,
    height: preset.height,
  }
  markers.value = [...markers.value, m]
  selectedId.value = m.id
}

function removeMarker(id: string) {
  markers.value = markers.value.filter((m) => m.id !== id)
  if (selectedId.value === id) selectedId.value = null
}

// ---------- 画布缩放与拖拽（Pointer Events，scale 容器内原生 DnD 不可靠） ----------

const canvasContainer = ref<HTMLElement | null>(null)
const { width: containerWidth } = useElementSize(canvasContainer)
const zoom = ref(1)
/** 「原尺寸」模式的缩放下限：桌子拖拽目标不至于过小，超出部分靠容器横向滚动查看 */
const MIN_FIT_SCALE = 0.45
/** <sm 视口默认「适配屏宽」：整个场地缩到容器宽度内 */
const fitToWidth = ref(typeof window !== 'undefined' && window.innerWidth < 640)
const scale = computed(() => {
  const innerWidth = containerWidth.value - 16
  const contentWidth = VENUE_WIDTH * MM_TO_PX
  let base = 0.6
  if (containerWidth.value) {
    base = fitToWidth.value
      ? fitScale(innerWidth, contentWidth)
      : Math.min(Math.max(innerWidth / contentWidth, MIN_FIT_SCALE), 1)
  }
  return base * zoom.value
})

/** 屏幕像素 → 场地 mm */
const pxToUnit = (px: number) => px / (MM_TO_PX * scale.value)

interface DragState {
  kind: 'table' | 'marker'
  id: string
  startX: number
  startY: number
  originX: number
  originY: number
  moved: boolean
}
let elementDrag: DragState | null = null

function onElementPointerDown(kind: 'table' | 'marker', id: string, event: PointerEvent) {
  if (event.button !== 0 && event.pointerType === 'mouse') return
  event.preventDefault()
  const item =
    kind === 'table'
      ? tables.value.find((t) => t.id === id)
      : markers.value.find((m) => m.id === id)
  if (!item) return
  selectedId.value = id
  elementDrag = {
    kind,
    id,
    startX: event.clientX,
    startY: event.clientY,
    originX: item.x,
    originY: item.y,
    moved: false,
  }
  window.addEventListener('pointermove', onElementPointerMove)
  window.addEventListener('pointerup', onElementPointerUp)
}

function onElementPointerMove(event: PointerEvent) {
  const drag = elementDrag
  if (!drag) return
  const dx = pxToUnit(event.clientX - drag.startX)
  const dy = pxToUnit(event.clientY - drag.startY)
  if (Math.abs(dx) + Math.abs(dy) > 1) drag.moved = true
  const item =
    drag.kind === 'table'
      ? tables.value.find((t) => t.id === drag.id)
      : markers.value.find((m) => m.id === drag.id)
  if (!item) return
  item.x = Math.min(Math.max(drag.originX + dx, 0), VENUE_WIDTH - item.width)
  item.y = Math.min(Math.max(drag.originY + dy, 0), VENUE_HEIGHT - item.height)
}

function onElementPointerUp() {
  window.removeEventListener('pointermove', onElementPointerMove)
  window.removeEventListener('pointerup', onElementPointerUp)
  elementDrag = null
}

// ---------- 第 3 步：自动分配 + 宾客拖拽微调 ----------

/** 分配策略：默认尽量不拆组；「优先坐满」按桌顺序依次坐满 */
const assignStrategy = ref<AssignStrategy>('keep-groups')
const STRATEGY_OPTIONS = computed<SelectOption[]>(() => [
  { value: 'keep-groups', label: tr('尽量不拆组（默认）'), hint: tr('同组尽量同桌，可能留空位') },
  { value: 'fill-tables', label: tr('优先坐满'), hint: tr('按桌顺序依次坐满，空桌最少') },
])

function autoAssign() {
  if (!guests.value.length) {
    toast.warning(tr('名单为空'), tr('请先在第 1 步添加宾客'))
    return
  }
  if (!tables.value.length) {
    toast.warning(tr('还没有餐桌'), tr('请先在第 2 步选择场地预设或添加餐桌'))
    return
  }
  const result = autoAssignGuests(guests.value, tables.value, assignStrategy.value, { respectLocked: true })
  for (const t of tables.value) {
    t.guestIds = result.get(t.id) ?? []
  }
  const s = summary.value
  const lockedNote = lockedTableCount.value
    ? ` · ${tr('锁定桌')} ${lockedTableCount.value}${tr('（未动）')}`
    : ''
  const pinnedNote = pinnedGuests.value.length
    ? ` · ${tr('钉住')} ${pinnedGuests.value.length}${tr('（保持原桌）')}`
    : ''
  const detail = `${tr('已安排')} ${s.assigned}/${s.total} · ${tr('空桌')} ${s.emptyTables} · ${tr('拆分分组')} ${s.splitGroups} · ${tr('未安排')} ${s.unassigned}${lockedNote}${pinnedNote}`
  if (s.splitGroups) splitDetailsOpen.value = true
  if (s.unassigned) {
    toast.warning(
      `${tr('座位不够：未安排宾客')}: ${s.unassigned}`,
      `${detail}。${tr('可增加餐桌或提高每桌座位数后重新分配')}`,
    )
  } else {
    const hints: string[] = []
    if (s.splitGroups) {
      hints.push(tr('拆分明细已在画布上方展开：可指定整组到某桌，或换策略重新分配'))
    } else {
      hints.push(tr('同组宾客已安排同桌，可拖拽宾客微调'))
    }
    if (s.emptyTables) {
      hints.push(tr('空桌可在摘要栏一键删除，也可保留备用'))
    }
    toast.success(tr('已自动分配座位'), `${detail}。${hints.join(tr('；'))}`)
  }
}

/** 用指定策略重新一键分配（拆分明细里的快捷按钮，复用 autoAssign，不新增算法） */
function reassignWith(strategy: AssignStrategy) {
  assignStrategy.value = strategy
  autoAssign()
}

/** 钉住的宾客（所钉桌仍存在） */
const pinnedGuests = computed(() => {
  const tableIds = new Set(tables.value.map((t) => t.id))
  return guests.value.filter((g) => !!g.pinnedTableId && tableIds.has(g.pinnedTableId))
})

function isPinnedTo(guest: BanquetGuest, tableId: string): boolean {
  return guest.pinnedTableId === tableId
}

/** 钉住 / 取消钉住：钉住的宾客在自动分配、重新分配、整组移桌时保持原桌（仅浏览器本地状态） */
function togglePin(guestId: string, tableId: string) {
  const guest = guests.value.find((g) => g.id === guestId)
  if (!guest) return
  guest.pinnedTableId = guest.pinnedTableId === tableId ? null : tableId
}

/** 整组移桌时可移动的成员：钉住在其他桌的成员保持原桌不动 */
function movableGroupMembers(groupId: string, tableId: string): string[] {
  return guests.value
    .filter((g) => g.groupId === groupId && (!g.pinnedTableId || g.pinnedTableId === tableId))
    .map((g) => g.id)
}

/** 可容纳整组的桌：除去该组已在此桌的成员后，剩余座位 ≥ 可移动的组人数 */
function tablesFittingGroup(groupId: string): BanquetTable[] {
  return tables.value.filter((t) => {
    const members = new Set(movableGroupMembers(groupId, t.id))
    const others = t.guestIds.filter((id) => !members.has(id)).length
    return t.seats - others >= members.size
  })
}

function moveGroupOptions(groupId: string): SelectOption[] {
  const fitting = tablesFittingGroup(groupId)
  if (!fitting.length) return [{ value: '', label: tr('没有一桌剩余座位够整组坐下') }]
  return [
    { value: '', label: tr('指定整组到某桌…') },
    ...fitting.map((t) => ({
      value: t.id,
      label: `${t.name}${tr('（')}${tr('剩余')} ${t.seats - t.guestIds.filter((id) => guests.value.find((g) => g.id === id)?.groupId !== groupId).length} ${tr('座')}${tr('）')}`,
    })),
  ]
}

/** 把整组移到一桌：从其他桌撤下该组成员，目标桌补齐；容量不足时不动并提示 */
function moveGroupToTable(groupId: string, tableId: string) {
  if (!tableId) return
  const target = tables.value.find((t) => t.id === tableId)
  if (!target) return
  if (!tablesFittingGroup(groupId).some((t) => t.id === tableId)) {
    toast.warning(tr('该桌剩余座位不够'), tr('请选择剩余座位 ≥ 组人数的桌'))
    return
  }
  const members = movableGroupMembers(groupId, tableId)
  const memberSet = new Set(members)
  for (const t of tables.value) {
    if (t.id !== tableId) t.guestIds = t.guestIds.filter((id) => !memberSet.has(id))
  }
  const kept = target.guestIds.filter((id) => !memberSet.has(id))
  target.guestIds = [...kept, ...members]
  const groupName = groupById.value.get(groupId)?.name ?? ''
  toast.success(
    tr('已将 {group} 整组移到 {table}').replace('{group}', groupName).replace('{table}', target.name),
    `${tr('已安排')} ${summary.value.assigned}/${summary.value.total} · ${tr('拆分分组')} ${summary.value.splitGroups}`,
  )
}

/** 画布上方的结果摘要（随安排实时变化，不仅限于自动排座后） */
const summary = computed(() => summarizeBanquet(guests.value, tables.value, groups.value))

/** 被拆到多桌的分组明细（摘要中「拆分分组」可展开查看）：含拆分原因与所在桌号 */
const splitGroupDetails = computed(() => explainSplit(guests.value, tables.value, groups.value))

/** 拆分原因文案：「同学 12 人 > 任一桌最大 10 座」/「同学 6 人：轮到时没有一桌剩余座位够整组坐下」 */
function splitReasonText(g: SplitExplanation): string {
  if (g.reason === 'group-larger-than-any-table') {
    return tr('{group} {n} 人 > 任一桌最大 {seats} 座')
      .replace('{group}', g.groupName)
      .replace('{n}', String(g.groupSize))
      .replace('{seats}', String(g.maxTableSeats))
  }
  return tr('{group} {n} 人：轮到时没有一桌剩余座位够整组坐下')
    .replace('{group}', g.groupName)
    .replace('{n}', String(g.groupSize))
}
const splitDetailsOpen = ref(false)
watch(
  () => splitGroupDetails.value.length,
  (n) => {
    if (!n) splitDetailsOpen.value = false
  },
)

/** 摘要旁的「删除空桌」：与导出检查弹窗里的同一纯函数，默认桌名重新编号 */
function removeEmptyTablesFromSummary() {
  const before = tables.value.length
  const kept = removeEmptyTables(tables.value)
  const removed = before - kept.length
  if (!removed) return
  if (selectedId.value && !kept.some((t) => t.id === selectedId.value)) selectedId.value = null
  tables.value = kept
  toast.success(`${tr('已删除空桌')} ${removed} ${tr('桌')}`, tr('默认桌名已重新编号'))
}

/** 点击摘要中的空桌数：短暂高亮空桌并滚到首个空桌 */
const highlightEmptyTables = ref(false)
let highlightTimer: ReturnType<typeof setTimeout> | null = null
function focusEmptyTables() {
  const first = tables.value.find((t) => !t.guestIds.length)
  if (!first) return
  highlightEmptyTables.value = true
  if (highlightTimer) clearTimeout(highlightTimer)
  highlightTimer = setTimeout(() => {
    highlightEmptyTables.value = false
  }, 2400)
  canvasContainer.value
    ?.querySelector(`[data-table-id="${first.id}"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
}

/** 点击摘要中的未安排数：滚到未安排宾客池 */
function focusUnassignedPool() {
  document.querySelector('[data-guest-pool]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function clearAssignments() {
  if (countAssignedGuests(tables.value) > 0) {
    pendingDestructive.value = { kind: 'clear' }
    return
  }
  toast.info(tr('当前没有座位安排'))
}

function doClearAssignments() {
  const snapshot = snapshotTables(tables.value)
  for (const t of tables.value) t.guestIds = []
  toast.push('info', tr('已清空全部座位安排'), undefined, UNDO_WINDOW_MS, {
    label: tr('撤销'),
    onClick: () => restoreTables(snapshot),
  })
}

const seatedIds = computed(() => {
  const set = new Set<string>()
  for (const t of tables.value) for (const id of t.guestIds) set.add(id)
  return set
})
const unassignedGuests = computed(() => guests.value.filter((g) => !seatedIds.value.has(g.id)))

// ---------- 宾客搜索定位（姓名 / 拼音首字母） ----------
const guestQuery = ref('')
const searchHits = computed(() => searchGuests(guests.value, tables.value, guestQuery.value))
const hitGuestIds = computed(() => new Set(searchHits.value.map((h) => h.guest.id)))
/** 名单区按搜索词过滤；未搜索时显示全部 */
const rosterGuests = computed(() =>
  guestQuery.value.trim() ? guests.value.filter((g) => hitGuestIds.value.has(g.id)) : guests.value,
)
const flashTableId = ref<string | null>(null)
let flashTimer: ReturnType<typeof setTimeout> | null = null

/** 滚到命中宾客所在桌并闪烁；未安排的滚到宾客池 */
function focusSearchHit(hit: GuestSearchHit) {
  if (!hit.tableId) {
    focusUnassignedPool()
    return
  }
  flashTableId.value = hit.tableId
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => {
    flashTableId.value = null
  }, 1800)
  canvasContainer.value
    ?.querySelector(`[data-table-id="${hit.tableId}"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
}

watch(searchHits, (hits) => {
  const first = hits[0]
  if (first && first.tableId) focusSearchHit(first)
})

function clearGuestQuery() {
  guestQuery.value = ''
}

function tableNameById(id: string): string {
  return tables.value.find((t) => t.id === id)?.name ?? ''
}

// ---------- 锁定桌：自动分配不改动 ----------
const lockedTableCount = computed(() => tables.value.filter((t) => t.locked).length)

function toggleTableLock(id: string) {
  const t = tables.value.find((x) => x.id === id)
  if (!t) return
  t.locked = !t.locked
  toast.info(
    t.locked ? `${t.name}${tr('：')}${tr('已锁定')}` : `${t.name}${tr('：')}${tr('已解锁')}`,
    t.locked ? tr('重新自动分配时这桌及桌上宾客保持不变') : tr('重新自动分配时这桌会参与重排'),
  )
}

// ---------- 未安排池多选 + 批量归组（不碰画布交互、不改逐人下拉） ----------
const multiSelect = ref(false)
const selectedGuestIds = ref<Set<string>>(new Set())
const batchGroupId = ref('')
/** 批量分组下拉中「新建分组…」的哨兵值 */
const NEW_GROUP_VALUE = '__new__'

const selectedCount = computed(() => selectedGuestIds.value.size)
const batchGroupOptions = computed<SelectOption[]>(() => [
  { value: '', label: tr('选择分组…') },
  ...groups.value.map((g) => ({ value: g.id, label: g.name })),
  { value: NEW_GROUP_VALUE, label: tr('新建分组…') },
])

function toggleMultiSelect() {
  multiSelect.value = !multiSelect.value
  if (!multiSelect.value) selectedGuestIds.value = new Set()
}

function toggleGuestSelected(id: string) {
  const next = new Set(selectedGuestIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedGuestIds.value = next
}

function selectAllUngrouped() {
  selectedGuestIds.value = new Set(unassignedGuests.value.filter((g) => !g.groupId).map((g) => g.id))
}

/** 选中「新建分组…」时即建一组并选中它，名称可在分组面板改 */
watch(batchGroupId, (v) => {
  if (v !== NEW_GROUP_VALUE) return
  addGroup()
  batchGroupId.value = groups.value[groups.value.length - 1]?.id ?? ''
})

function applyBatchGroup(groupId: string | null) {
  const ids = [...selectedGuestIds.value]
  if (!ids.length) return
  guests.value = assignGroupToGuests(guests.value, ids, groupId)
  const groupName = groupId ? (groupById.value.get(groupId)?.name ?? '') : ''
  toast.success(
    groupId
      ? `${tr('已归组')} ${ids.length} ${tr('人')} → ${groupName}`
      : `${tr('已清除分组')} ${ids.length} ${tr('人')}`,
  )
  selectedGuestIds.value = new Set()
}

/** 宾客被删除/上桌后从选中集移除，避免幽灵选中 */
watch(unassignedGuests, (list) => {
  if (!selectedGuestIds.value.size) return
  const alive = new Set(list.map((g) => g.id))
  const next = new Set([...selectedGuestIds.value].filter((id) => alive.has(id)))
  if (next.size !== selectedGuestIds.value.size) selectedGuestIds.value = next
})

/**
 * 批量操作条可见时复用 NextStepBar 的 has-next-step-bar 标记，让反馈按钮/Toast 让位；
 * 同时卸载下一步条（v-if）避免两条底栏重叠，卸载时它会自行移除标记，所以这里在下一帧再补上。
 */
const batchBarVisible = computed(() => multiSelect.value && unassignedGuests.value.length > 0)
watch(batchBarVisible, async (on) => {
  if (typeof document === 'undefined') return
  if (!on) return
  await nextTick()
  document.documentElement.classList.add('has-next-step-bar')
})
/** 批量操作条同样把实际高度写入 --sm-nextstep-h（与 NextStepBar 互斥渲染，共用同一变量） */
const batchBarEl = ref<HTMLElement | null>(null)
useNextStepBarHeight(batchBarEl)
onBeforeUnmount(() => {
  if (batchBarVisible.value && typeof document !== 'undefined') {
    document.documentElement.classList.remove('has-next-step-bar')
  }
})

/** 宾客拖拽（桌间移动 / 拖回未安排区），同样基于 Pointer 事件 */
const guestDragId = ref<string | null>(null)
const guestDragging = ref(false)
const dropTableId = ref<string | null>(null)
const dropToPool = ref(false)
let guestDragStartX = 0
let guestDragStartY = 0

function onGuestPointerDown(guestId: string, event: PointerEvent) {
  if (event.button !== 0 && event.pointerType === 'mouse') return
  event.preventDefault()
  event.stopPropagation()
  guestDragId.value = guestId
  guestDragging.value = false
  guestDragStartX = event.clientX
  guestDragStartY = event.clientY
  window.addEventListener('pointermove', onGuestPointerMove)
  window.addEventListener('pointerup', onGuestPointerUp)
}

function onGuestPointerMove(event: PointerEvent) {
  if (!guestDragging.value) {
    if (
      Math.abs(event.clientX - guestDragStartX) < 5 &&
      Math.abs(event.clientY - guestDragStartY) < 5
    ) {
      return
    }
    guestDragging.value = true
  }
  const el = document.elementFromPoint(event.clientX, event.clientY)
  const tableEl = el?.closest<HTMLElement>('[data-table-id]')
  dropTableId.value = tableEl?.dataset.tableId ?? null
  dropToPool.value = !tableEl && !!el?.closest('[data-guest-pool]')
}

function onGuestPointerUp() {
  window.removeEventListener('pointermove', onGuestPointerMove)
  window.removeEventListener('pointerup', onGuestPointerUp)
  const guestId = guestDragId.value
  if (guestDragging.value && guestId) {
    if (dropTableId.value) moveGuestToTable(guestId, dropTableId.value)
    else if (dropToPool.value) moveGuestToPool(guestId)
  }
  guestDragId.value = null
  guestDragging.value = false
  dropTableId.value = null
  dropToPool.value = false
}

function moveGuestToTable(guestId: string, tableId: string) {
  const target = tables.value.find((t) => t.id === tableId)
  if (!target) return
  if (target.guestIds.includes(guestId)) return
  for (const t of tables.value) {
    t.guestIds = t.guestIds.filter((id) => id !== guestId)
  }
  target.guestIds = [...target.guestIds, guestId]
  // 手动拖到另一桌：钉住跟随新桌（用户直接操作即新的约束）
  const guest = guests.value.find((g) => g.id === guestId)
  if (guest?.pinnedTableId) guest.pinnedTableId = tableId
  if (target.guestIds.length > target.seats) {
    toast.warning(`「${target.name}」${tr('已超员')}`, `${target.guestIds.length} / ${target.seats}`)
  }
}

function moveGuestToPool(guestId: string) {
  for (const t of tables.value) {
    t.guestIds = t.guestIds.filter((id) => id !== guestId)
  }
  const guest = guests.value.find((g) => g.id === guestId)
  if (guest?.pinnedTableId) guest.pinnedTableId = null
}

// ---------- 第 4 步：检查与导出 ----------

const PAPER_OPTIONS: SelectOption[] = [
  { value: 'a4', label: 'A4', hint: '210 × 297 mm' },
  { value: 'a3', label: 'A3', hint: '297 × 420 mm' },
]
const ORIENTATION_OPTIONS = computed<SelectOption[]>(() => [
  { value: 'landscape', label: tr('横向') },
  { value: 'portrait', label: tr('纵向') },
])

const pageSize = computed(() => {
  const [short, long] = paper.value === 'a4' ? [210, 297] : [297, 420]
  return orientation.value === 'landscape'
    ? { width: long!, height: short! }
    : { width: short!, height: long! }
})

/** 导出页内场地缩放：留出页边距与标题高度后等比适配 */
const PAGE_MARGIN = 10
const PAGE_TITLE_H = 14
const exportScale = computed(() => {
  const availW = pageSize.value.width - PAGE_MARGIN * 2
  const availH = pageSize.value.height - PAGE_MARGIN * 2 - PAGE_TITLE_H
  return Math.min(availW / VENUE_WIDTH, availH / VENUE_HEIGHT)
})

/** 张贴版参与布局的桌：保持桌序（1 桌、2 桌…），空桌不参与 */
const posterTables = computed(() => tables.value.filter((t) => tableGuests(t).length > 0))

/** 分组图例占用的高度（mm），仅在带颜色导出且有分组时扣除 */
const POSTER_LEGEND_H = 8
const posterLayoutMetrics = computed(() => {
  const list = posterTables.value
  const maxGuests = list.reduce((m, t) => Math.max(m, tableGuests(t).length), 0)
  const maxNameChars = list.reduce(
    (m, t) => tableGuests(t).reduce((mm, g) => Math.max(mm, Array.from(g.name.trim()).length), m),
    0,
  )
  const legendH = exportColors.value && groups.value.length ? POSTER_LEGEND_H : 0
  return computePosterLayout({
    tableCount: list.length,
    maxGuests,
    maxNameChars: Math.min(Math.max(maxNameChars, 2), 6),
    safeWidth: pageSize.value.width - PAGE_MARGIN * 2,
    safeHeight: pageSize.value.height - PAGE_MARGIN * 2 - PAGE_TITLE_H - legendH,
  })
})

const posterGridStyle = computed(() => {
  const m = posterLayoutMetrics.value
  return {
    gridTemplateColumns: `repeat(${Math.max(1, m.columns)}, ${m.blockWidth}mm)`,
    gridAutoRows: `${m.blockHeight}mm`,
    gap: `${POSTER_GAP_MM}mm`,
    '--poster-name-font': `${m.nameFontMm}mm`,
    '--poster-table-font': `${m.tableNameFontMm}mm`,
  }
})

const issues = ref<BanquetIssues | null>(null)
const issuesOpen = ref(false)
const exportChoiceOpen = ref(false)
const exporting = ref(false)
const renderExportHost = ref(false)
/** 本次导出是否叠加细线水印（带水印不限次，无水印计入每日配额，口径同 /studio） */
const withWatermark = ref(false)
const exportHost = ref<HTMLElement | null>(null)
const pendingFormat = ref<'png' | 'pdf'>('png')

function startExport(format: 'png' | 'pdf') {
  pendingFormat.value = format
  const found = validateBanquet(guests.value, tables.value)
  issues.value = found
  if (
    found.unassigned.length ||
    found.emptyTables.length ||
    found.overlaps.length ||
    found.overCapacity.length ||
    found.duplicateNames.length
  ) {
    issuesOpen.value = true
    return
  }
  exportChoiceOpen.value = true
}

/** 检查结果里除空桌外没有其他问题：此时「继续导出」只是保留空桌 */
const onlyEmptyTableIssues = computed(() => {
  const found = issues.value
  return (
    !!found &&
    found.emptyTables.length > 0 &&
    !found.unassigned.length &&
    !found.overlaps.length &&
    !found.overCapacity.length
  )
})

function confirmIssuesAndExport() {
  issuesOpen.value = false
  exportChoiceOpen.value = true
}

/** 删除空桌（默认桌名重新编号）后直接进入导出方式选择 */
function removeEmptyTablesAndExport() {
  const kept = removeEmptyTables(tables.value)
  if (selectedId.value && !kept.some((t) => t.id === selectedId.value)) selectedId.value = null
  tables.value = kept
  issues.value = validateBanquet(guests.value, kept)
  confirmIssuesAndExport()
}

async function chooseWatermarked() {
  exportChoiceOpen.value = false
  withWatermark.value = true
  await runExport()
}

async function chooseClean() {
  if (quota.remaining <= 0) {
    exportChoiceOpen.value = false
    quota.limitDialogOpen = true
    return
  }
  exportChoiceOpen.value = false
  withWatermark.value = false
  await runExport()
}

/** 重建离屏导出宿主：渲染异常（首次挂载竞态等）时卸掉重挂再重渲 */
async function rebuildExportHost() {
  renderExportHost.value = false
  await nextTick()
  renderExportHost.value = true
  await nextTick()
}

function getExportPage(): HTMLElement {
  const el = exportHost.value
  if (!el) throw new Error(tr('导出页渲染失败'))
  return el
}

async function runExport() {
  if (exporting.value) return
  exporting.value = true
  renderExportHost.value = true
  await nextTick()
  try {
    getExportPage()
    const baseName = sanitizeFileNamePart(title.value) || tr('宴会座位表')
    if (pendingFormat.value === 'pdf') {
      await exportPagedPdf({
        pageCount: 1,
        getPage: getExportPage,
        rebuildHost: rebuildExportHost,
        pageWidth: pageSize.value.width,
        pageHeight: pageSize.value.height,
        fileName: defaultPdfFileName(baseName),
      })
    } else {
      await exportPagedPng({
        pageCount: 1,
        getPage: getExportPage,
        rebuildHost: rebuildExportHost,
        pageWidth: pageSize.value.width,
        pageHeight: pageSize.value.height,
        fileName: baseName,
      })
    }
    if (!withWatermark.value) await quota.tryConsume()
    toast.success(
      pendingFormat.value === 'pdf' ? tr('PDF 已导出') : tr('PNG 已导出'),
      exportColors.value ? tr('本次带分组颜色输出') : tr('默认不带分组颜色，适合直接张贴'),
    )
  } catch (error) {
    toast.danger(tr('导出失败'), error instanceof Error ? error.message : String(error))
  } finally {
    renderExportHost.value = false
    exporting.value = false
  }
}

// ---------- 宾客速查表（迎宾台索引 + 按桌名单）：打印 / CSV，全部浏览器本地 ----------

const quickRef = ref<GuestQuickReference | null>(null)
const renderQuickRefHost = ref(false)
const quickRefPrinting = ref(false)
/** 速查表姓名索引的分栏数：人数多时分三栏，少时两栏更易读 */
const quickRefColumns = computed(() => ((quickRef.value?.index.length ?? 0) > 40 ? 3 : 2))

function ensureGuestsForQuickRef(): boolean {
  if (guestCount.value) return true
  toast.warning(tr('名单为空'), tr('请先粘贴宾客名单'))
  return false
}

async function printQuickReference() {
  if (quickRefPrinting.value || !ensureGuestsForQuickRef()) return
  quickRefPrinting.value = true
  quickRef.value = buildGuestQuickReference(guests.value, tables.value, groups.value)
  toast.info(tr('即将调起浏览器打印'), tr('速查表为 A4 纵向；也可在打印对话框「另存为 PDF」'))
  setPrintPageSize(210, 297)
  renderQuickRefHost.value = true
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 1200))
  try {
    await printAndWaitUntilDone()
  } finally {
    renderQuickRefHost.value = false
    quickRefPrinting.value = false
  }
}

function downloadTableRosterCsv() {
  if (!ensureGuestsForQuickRef()) return
  const data = buildGuestQuickReference(guests.value, tables.value, groups.value)
  const baseName = sanitizeFileNamePart(title.value) || tr('宴会座位表')
  const blob = new Blob([quickReferenceCsv(data.tables)], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, `${baseName}-${tr('按桌名单')}.csv`)
  toast.success(tr('CSV 已下载'), tr('列：桌名 / 座次 / 姓名 / 分组，可直接用 Excel 打开'))
}

// ---------- 渲染辅助 ----------

function guestColor(guest: BanquetGuest, colored: boolean): string | null {
  if (!colored || !guest.groupId) return null
  return groupById.value.get(guest.groupId)?.color ?? null
}

function tableGuests(t: BanquetTable): BanquetGuest[] {
  const map = guestById.value
  return t.guestIds.map((id) => map.get(id)).filter((g): g is BanquetGuest => !!g)
}

const guestCount = computed(() => guests.value.filter((g) => g.name.trim()).length)
const seatCount = computed(() => tables.value.reduce((sum, t) => sum + t.seats, 0))

// ---------- 一键生成席位卡 / 桌号牌（同一份名单带到 /studio，仍全部本地） ----------
const handoffRows = computed(() => buildBanquetHandoffRows(guests.value, tables.value, groups.value))
const canHandoff = computed(() => handoffRows.value.length > 0)

function toPlaceCards() {
  if (!canHandoff.value) {
    toast.warning(tr('还没有已安排的宾客'), tr('先在第 3 步一键自动分配或拖拽安排宾客，再生成席位卡'))
    return
  }
  const handoff: SeatingHandoff = {
    title: title.value,
    source: 'banquet',
    rows: handoffRows.value,
  }
  try {
    localStorage.setItem(SEATING_HANDOFF_KEY, JSON.stringify(handoff))
  } catch {
    toast.danger(tr('无法暂存名单'), tr('浏览器存储不可用，请改用 Excel 上传方式'))
    return
  }
  void router.push(localePath('/studio?from=banquet'))
}
</script>

<template>
  <div class="mx-auto w-full max-w-[1480px] px-4 py-6 pb-fixed-layers sm:py-8">
    <div class="text-center">
      <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Banquet Seating</p>
      <h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {{ tr('宴会座位表生成器') }}
      </h1>
      <p class="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
        {{ tr('婚宴、年会、答谢宴的桌位安排：粘贴宾客名单并分组，选圆桌/长桌/U 形等场地布局，一键自动分配（优先把同组宾客排在同桌），拖拽微调后导出 A4/A3 高清座位图直接打印。数据全程在浏览器本地处理。') }}
      </p>
      <p class="mt-2 text-xs text-slate-500">
        {{ tr('要排教室座位？用') }}
        <RouterLink :to="localePath('/seating')" class="font-semibold text-brand-600 hover:underline">
          {{ tr('教室座位表打印') }}
        </RouterLink>
      </p>
    </div>

    <div class="mt-6 grid items-start gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
      <!-- 设置面板 -->
      <aside class="flex min-w-0 flex-col gap-4">
        <!-- 第 1 步：宾客名单 -->
        <section ref="rosterSection" class="panel-card scroll-mt-4 outline-none">
          <div class="panel-head">
            <h2 class="section-title"><span class="step-chip">1</span>{{ tr('宾客名单与分组') }}</h2>
            <button type="button" class="btn btn-ghost btn-sm" @click="loadDemoGuests()">
              {{ tr('用演示名单') }}
            </button>
          </div>
          <div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <p class="text-xs leading-5 text-slate-500">
              {{ tr('流程：名单 → 场地 → 一键自动分配 → 拖拽微调 → 导出') }}
            </p>
            <p
              class="assign-status"
              data-testid="assign-status"
              :aria-label="tr('座位安排状态')"
            >
              <span>{{ tr('已安排') }} {{ assignmentSummary.assigned }}</span>
              <span aria-hidden="true">/</span>
              <span :class="assignmentSummary.unassigned ? 'text-amber-700' : ''">
                {{ tr('未安排') }} {{ assignmentSummary.unassigned }}
              </span>
              <span aria-hidden="true">/</span>
              <span>{{ tr('空桌') }} {{ assignmentSummary.emptyTables }}</span>
            </p>
          </div>
          <div class="mt-2">
            <label class="field-label" for="banquet-title">{{ tr('座位表标题') }}</label>
            <input
              id="banquet-title"
              v-model="title"
              type="text"
              class="input-field"
              :placeholder="tr('如：张王联姻 婚宴座位表')"
            />
          </div>
          <textarea
            ref="pasteInput"
            v-model="pasteText"
            rows="5"
            class="input-field mt-2 h-auto min-h-24 resize-y py-2 leading-6"
            :placeholder="`${tr('每行一位宾客姓名，粘贴后点「添加到名单」')}\n${tr('张伟')}\t${tr('男方亲友')}\n${tr('第二列可填分组，自动归组；支持从 Excel 直接复制「姓名、分组」两列')}`"
          ></textarea>
          <div class="mt-2 flex flex-wrap gap-2">
            <button type="button" class="btn btn-primary btn-sm" @click="importPasted">
              {{ tr('添加到名单（自动去重）') }}
            </button>
            <button type="button" class="btn btn-secondary btn-sm" @click="guestFile.open">
              {{ tr('上传 TXT / CSV / Excel 名单') }}
            </button>
            <input
              :ref="guestFile.fileInput"
              type="file"
              :accept="GUEST_FILE_ACCEPT"
              class="hidden"
              :aria-label="tr('上传 TXT / CSV / Excel 名单文件')"
              @change="guestFile.onFileChange"
            />
          </div>

          <div class="mt-3">
            <div class="flex items-center justify-between">
              <label class="field-label !mb-0">{{ tr('宾客分组（颜色可自定义）') }}</label>
              <button type="button" class="btn btn-ghost btn-sm" @click="addGroup">+ {{ tr('加分组') }}</button>
            </div>
            <div v-if="groups.length" class="mt-1.5 flex flex-col gap-1.5">
              <div v-for="g in groups" :key="g.id" class="flex items-center gap-1.5">
                <input
                  v-model="g.name"
                  type="text"
                  class="input-field min-w-0 flex-1"
                  :aria-label="tr('分组名称')"
                  :placeholder="tr('如：男方亲友')"
                />
                <ColorField v-model="g.color" class="w-28 shrink-0" />
                <button
                  type="button"
                  class="btn btn-ghost btn-sm shrink-0 !px-1.5 text-slate-400 hover:text-red-500"
                  :aria-label="`${tr('删除分组')} ${g.name}`"
                  @click="removeGroup(g.id)"
                >
                  ✕
                </button>
              </div>
            </div>
            <p v-else class="mt-1 text-xs text-slate-500">
              {{ tr('可选：加「男方亲友 / 女方亲友 / 同事」等分组。自动分配会优先把同组宾客排在同桌；座位不够时会在下方列出被拆开的分组。') }}
            </p>
          </div>

          <div class="mt-3">
            <!-- <sm：按钮通栏左对齐并在行右侧留出 pr-14 保留区，避开 fixed right-3 的反馈气泡（size-10） -->
            <div
              class="flex items-center justify-between max-sm:flex-wrap max-sm:pr-14"
              data-testid="banquet-roster-actions"
            >
              <label class="field-label !mb-0">
                {{ tr('名单') }}{{ tr('（') }}{{ guestCount }} {{ tr('人') }} / {{ seatCount }} {{ tr('座') }}{{ tr('）') }}
              </label>
              <button
                type="button"
                class="btn btn-ghost btn-sm max-sm:mt-1 max-sm:w-full max-sm:justify-start"
                data-testid="banquet-add-guest-row"
                @click="addGuestRow"
              >
                + {{ tr('加一行') }}
              </button>
            </div>
            <p
              v-if="mergedDuplicates.length"
              class="mt-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs leading-5 text-amber-800"
              role="status"
              aria-live="polite"
            >
              {{ tr('已合并') }} {{ mergedDuplicates.length }} {{ tr('个重复姓名') }}{{ tr('：') }}{{ mergedDuplicatesText }}
            </p>
            <div v-if="guests.length" class="mt-1.5 flex min-w-0 items-center gap-1.5">
              <input
                v-model="guestQuery"
                type="search"
                class="input-field min-w-0 flex-1"
                data-testid="banquet-guest-search"
                :aria-label="tr('搜索宾客')"
                :placeholder="tr('搜索宾客：姓名或拼音首字母，如 zw')"
              />
              <button
                v-if="guestQuery"
                type="button"
                class="btn btn-ghost btn-sm shrink-0"
                @click="clearGuestQuery"
              >
                {{ tr('清除') }}
              </button>
            </div>
            <p
              v-if="guestQuery.trim()"
              class="mt-1 text-xs text-slate-500"
              data-testid="banquet-guest-search-result"
              role="status"
              aria-live="polite"
            >
              <template v-if="searchHits.length">
                {{ tr('命中') }} {{ searchHits.length }} {{ tr('人') }}{{ tr('：') }}
                <button
                  v-for="h in searchHits.slice(0, 6)"
                  :key="h.guest.id"
                  type="button"
                  class="mr-1 rounded border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-brand-700 hover:bg-brand-100"
                  @click="focusSearchHit(h)"
                >
                  {{ h.guest.name }} · {{ h.tableId ? tableNameById(h.tableId) : tr('未安排') }}
                </button>
                <span v-if="searchHits.length > 6">…</span>
              </template>
              <template v-else>{{ tr('没有匹配的宾客') }}</template>
            </p>
            <div
              v-if="rosterGuests.length"
              class="mt-1.5 flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1"
            >
              <div v-for="g in rosterGuests" :key="g.id" class="flex items-center gap-1.5">
                <input
                  v-model="g.name"
                  type="text"
                  class="input-field min-w-0 flex-1"
                  :aria-label="tr('宾客姓名')"
                  :placeholder="tr('宾客姓名')"
                />
                <SelectField
                  :model-value="g.groupId ?? ''"
                  :options="groupOptions"
                  size="sm"
                  class="w-28 shrink-0"
                  @update:model-value="g.groupId = $event || null"
                />
                <button
                  type="button"
                  class="btn btn-ghost btn-sm shrink-0 !px-1.5 text-slate-400 hover:text-red-500"
                  :aria-label="`${tr('删除宾客')} ${g.name || tr('未命名')}`"
                  @click="removeGuest(g.id)"
                >
                  ✕
                </button>
              </div>
            </div>
            <p v-else-if="!guests.length" class="mt-1 text-xs text-slate-500">
              {{ tr('还没有宾客：粘贴名单、上传 TXT，或点「加一行」直接在线输入（无需 Excel）。') }}
            </p>
          </div>
        </section>

        <!-- 第 2 步：场地布局 -->
        <section class="panel-card">
          <div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <h2 class="section-title"><span class="step-chip">2</span>{{ tr('场地布局') }}</h2>
            <p class="assign-status" :aria-label="tr('座位安排状态')">
              <span>{{ tr('已安排') }} {{ assignmentSummary.assigned }}</span>
              <span aria-hidden="true">/</span>
              <span :class="assignmentSummary.unassigned ? 'text-amber-700' : ''">
                {{ tr('未安排') }} {{ assignmentSummary.unassigned }}
              </span>
              <span aria-hidden="true">/</span>
              <span>{{ tr('空桌') }} {{ assignmentSummary.emptyTables }}</span>
            </p>
          </div>
          <p class="mt-1 text-xs leading-5 text-slate-500">
            {{ tr('选预设或自建桌位；下一步一键自动分配，再拖拽微调。已有安排时切预设会先确认。') }}
          </p>
          <div class="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-2">
            <button
              v-for="p in VENUE_PRESETS"
              :key="p.id"
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left transition-colors hover:border-brand-400 hover:bg-brand-50/40"
              @click="applyPreset(p.id)"
            >
              <span class="block text-xs font-bold text-slate-700">{{ tr(p.name) }}</span>
              <span class="block text-[11px] leading-4 text-slate-500">{{ tr(p.hint) }}</span>
            </button>
          </div>
          <div class="mt-2.5 flex flex-wrap gap-2">
            <button type="button" class="btn btn-secondary btn-sm" @click="addTable('round')">
              + {{ tr('圆桌') }}
            </button>
            <button type="button" class="btn btn-secondary btn-sm" @click="addTable('rect')">
              + {{ tr('长桌') }}
            </button>
            <button type="button" class="btn btn-ghost btn-sm" @click="addMarker('entrance')">
              + {{ tr('入口') }}
            </button>
            <button type="button" class="btn btn-ghost btn-sm" @click="addMarker('stage')">
              + {{ tr('舞台') }}
            </button>
            <button type="button" class="btn btn-ghost btn-sm" @click="addMarker('dance')">
              + {{ tr('舞池') }}
            </button>
          </div>

          <div v-if="selectedTable" class="mt-3 rounded-lg border border-brand-100 bg-brand-50/50 p-2.5">
            <div class="grid grid-cols-2 gap-2">
              <div class="col-span-2">
                <label class="field-label">{{ tr('选中的餐桌名称') }}</label>
                <input
                  v-model="selectedTable.name"
                  type="text"
                  class="input-field"
                  :placeholder="tr('如：1号桌 / 主桌')"
                />
              </div>
              <div>
                <label class="field-label">{{ tr('每桌座位数') }}</label>
                <NumberField v-model="selectedTable.seats" :min="1" :max="30" :aria-label="tr('每桌座位数')" />
              </div>
              <div class="flex items-end">
                <button
                  type="button"
                  class="btn btn-danger btn-sm w-full"
                  @click="removeTable(selectedTable.id)"
                >
                  {{ tr('删除这张桌') }}
                </button>
              </div>
              <label class="col-span-2 flex cursor-pointer items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  class="size-3.5 accent-brand-600"
                  :checked="!!selectedTable.locked"
                  data-testid="banquet-table-lock"
                  @change="toggleTableLock(selectedTable.id)"
                />
                {{ tr('锁定这张桌：重新自动分配时桌上宾客保持不变') }}
              </label>
            </div>
          </div>
          <div
            v-else-if="selectedMarker"
            class="mt-3 rounded-lg border border-brand-100 bg-brand-50/50 p-2.5"
          >
            <div class="grid grid-cols-2 items-end gap-2">
              <div>
                <label class="field-label">{{ tr('标记名称') }}</label>
                <input v-model="selectedMarker.label" type="text" class="input-field" />
              </div>
              <button
                type="button"
                class="btn btn-danger btn-sm"
                @click="removeMarker(selectedMarker.id)"
              >
                {{ tr('删除标记') }}
              </button>
            </div>
          </div>
          <p v-else class="mt-2 text-xs leading-5 text-slate-600">
            {{ tr('在右侧画布上按住拖动餐桌与标记调整位置；点选餐桌后可改名、设座位数或删除。') }}
          </p>
        </section>

        <!-- 第 3 步：自动分配 -->
        <section ref="assignSection" class="panel-card scroll-mt-4 outline-none">
          <h2 class="section-title"><span class="step-chip">3</span>{{ tr('分配座位') }}</h2>
          <p class="mt-1 text-xs leading-5 text-slate-500">
            {{ tr('先一键自动分配，再拖拽微调，最后到第 4 步导出。') }}
          </p>
          <div class="mt-3">
            <label class="field-label">{{ tr('分配策略') }}</label>
            <SelectField
              v-model="assignStrategy"
              :options="STRATEGY_OPTIONS"
              data-testid="assign-strategy"
            />
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <button type="button" class="btn btn-primary btn-sm" data-testid="auto-assign" @click="autoAssign">
              {{ assignStrategy === 'fill-tables' ? tr('一键自动分配（优先坐满）') : tr('一键自动分配（同组同桌）') }}
            </button>
            <button type="button" class="btn btn-ghost btn-sm" @click="clearAssignments">
              {{ tr('清空安排') }}
            </button>
          </div>
          <p class="mt-2 text-xs leading-5 text-slate-600">
            {{ tr('分配后可直接拖拽宾客姓名在桌之间移动微调；拖到画布下方「未安排」区可撤下宾客。') }}
          </p>
          <p class="mt-1 text-xs leading-5 text-slate-600" data-testid="pin-hint">
            {{ tr('点桌上姓名旁的图钉可钉住宾客：重新自动分配或整组移桌时保持原桌并计入容量。') }}
            <span v-if="pinnedGuests.length" class="font-semibold" data-testid="pin-count">{{
              tr('已钉住 {n} 人').replace('{n}', String(pinnedGuests.length))
            }}</span>
          </p>
        </section>

        <!-- 第 4 步：检查与导出 -->
        <section ref="exportSection" class="panel-card scroll-mt-4 outline-none">
          <h2 class="section-title"><span class="step-chip">4</span>{{ tr('检查与导出') }}</h2>
          <div class="mt-3 grid grid-cols-2 gap-2.5">
            <div>
              <label class="field-label">{{ tr('纸张') }}</label>
              <SelectField v-model="paper" :options="PAPER_OPTIONS" />
            </div>
            <div>
              <label class="field-label">{{ tr('方向') }}</label>
              <SelectField v-model="orientation" :options="ORIENTATION_OPTIONS" />
            </div>
            <div class="col-span-2">
              <CheckboxField v-model="exportColors" class="text-xs font-semibold text-slate-600">
                {{ tr('导出带分组颜色（默认不带，适合张贴给宾客看）') }}
              </CheckboxField>
            </div>
            <div class="col-span-2">
              <CheckboxField
                v-model="posterLayout"
                class="text-xs font-semibold text-slate-600"
                data-testid="poster-layout-toggle"
              >
                {{ tr('张贴版（远距可读）：桌块铺满页面、姓名放大；关闭则按场地图原样输出') }}
              </CheckboxField>
            </div>
          </div>
          <div class="mt-3 flex flex-col gap-2">
            <button
              type="button"
              class="btn btn-primary btn-md"
              :disabled="exporting"
              :title="exportBadgeTitle"
              data-testid="banquet-export-png"
              @click="startExport('png')"
            >
              {{ exporting ? tr('导出中…') : tr('导出高清 PNG') }}
              <span
                class="ml-1 rounded-full px-1.5 py-px text-[11px] font-semibold"
                :class="exportBadge.cls"
                data-testid="export-quota-badge"
              >{{ exportBadge.text }}</span>
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-md"
              :disabled="exporting"
              @click="startExport('pdf')"
            >
              {{ tr('导出 PDF（可直接打印）') }}
            </button>
            <p class="text-xs leading-5 text-slate-600">
              {{ tr('导出前会自动检查未安排的宾客、空桌与餐桌重叠；名单全程不出浏览器。') }}
            </p>
            <div class="mt-1 border-t border-slate-100 pt-3">
              <p class="text-xs font-bold text-slate-700">{{ tr('迎宾台配套') }}</p>
              <div class="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  :disabled="quickRefPrinting"
                  data-testid="banquet-quickref-print"
                  @click="printQuickReference"
                >
                  {{ quickRefPrinting ? tr('准备打印…') : tr('宾客速查表') }}
                </button>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  data-testid="banquet-roster-csv"
                  @click="downloadTableRosterCsv"
                >
                  {{ tr('按桌名单 .csv') }}
                </button>
              </div>
              <p class="mt-1.5 text-xs leading-5 text-slate-500">
                {{ tr('速查表为 A4 纵向：前半按姓名拼音索引「姓名 → 桌名」，后半按桌列名单，方便签到台快速查桌。') }}
              </p>
            </div>
            <div class="mt-1 border-t border-slate-100 pt-3">
              <p class="text-xs font-bold text-slate-700">{{ tr('席位卡 / 桌号牌') }}</p>
              <button
                type="button"
                class="btn btn-secondary btn-sm mt-2 w-full"
                :disabled="!canHandoff"
                :title="canHandoff ? '' : tr('先在第 3 步安排宾客，再生成席位卡')"
                data-testid="banquet-place-cards"
                @click="toPlaceCards"
              >
                {{ tr('一键生成席位卡 / 桌号牌') }}
              </button>
              <p class="mt-1.5 text-xs leading-5 text-slate-500">
                {{
                  canHandoff
                    ? `${tr('已安排')} ${handoffRows.length} ${tr('位宾客的姓名与桌号会带到座签工坊，选席位卡模板即可批量导出；名单仍不出浏览器。')}`
                    : tr('安排宾客后可用：姓名与桌号直接带到座签工坊生成席位卡，不用二次录入。')
                }}
              </p>
            </div>
          </div>
        </section>
      </aside>

      <!-- 画布 -->
      <!-- ≥lg 画布列随左列滚动吸顶：顶栏 3.5rem + 1rem 间距；max-h 再扣除吸底下一步栏 3rem + 1rem 间距 -->
      <!-- ≥md 右下预留 ≈64×80px 空区给反馈气泡（html.has-canvas-safe-area 时气泡缩小贴边），不压座位图 -->
      <div
        class="min-w-0 md:pr-16 md:pb-fixed-layers lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100vh-8.5rem)] lg:self-start lg:overflow-auto"
        data-testid="banquet-canvas-column"
      >
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-bold">
            <button
              type="button"
              class="rounded-md px-2.5 py-1.5 text-slate-600 transition-colors hover:text-brand-600"
              :aria-label="tr('缩小画布')"
              @click="zoom = Math.max(0.5, Math.round((zoom - 0.25) * 100) / 100)"
            >
              −
            </button>
            <span class="min-w-10 text-center text-slate-600">{{ Math.round(zoom * 100) }}%</span>
            <button
              type="button"
              class="rounded-md px-2.5 py-1.5 text-slate-600 transition-colors hover:text-brand-600"
              :aria-label="tr('放大画布')"
              @click="zoom = Math.min(2, Math.round((zoom + 0.25) * 100) / 100)"
            >
              +
            </button>
          </div>
          <p class="flex flex-wrap items-center gap-x-1 text-xs text-slate-500" data-banquet-summary>
            <span>{{ tables.length }} {{ tr('桌') }}</span>
            <span aria-hidden="true">·</span>
            <span v-if="guests.length">{{ tr('已安排') }} {{ summary.assigned }}/{{ summary.total }}</span>
            <span v-else>{{ tr('尚未导入宾客') }}</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              class="rounded px-0.5 transition-colors"
              :class="summary.emptyTables ? 'font-bold text-amber-700 hover:bg-amber-50' : 'cursor-default'"
              :disabled="!summary.emptyTables"
              :title="summary.emptyTables ? tr('点击高亮空桌') : undefined"
              @click="focusEmptyTables"
            >
              {{ tr('空桌') }} {{ summary.emptyTables }}
            </button>
            <button
              v-if="summary.emptyTables"
              type="button"
              class="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 transition-colors hover:border-brand-400 hover:text-brand-600"
              data-testid="remove-empty-tables"
              :title="tr('删除全部空桌并重新编号；也可保留空桌备用，不影响导出')"
              @click="removeEmptyTablesFromSummary"
            >
              {{ tr('删除空桌') }}
            </button>
            <span aria-hidden="true">·</span>
            <button
              v-if="summary.splitGroups"
              type="button"
              class="rounded px-0.5 font-bold text-amber-700 transition-colors hover:bg-amber-50"
              data-testid="split-groups-toggle"
              :aria-expanded="splitDetailsOpen"
              aria-controls="banquet-split-details"
              :title="tr('点击查看被拆开的分组')"
              @click="splitDetailsOpen = !splitDetailsOpen"
            >
              {{ tr('拆分分组') }} {{ summary.splitGroups }}
              <span aria-hidden="true">{{ splitDetailsOpen ? '▴' : '▾' }}</span>
            </button>
            <span v-else>{{ tr('拆分分组') }} {{ summary.splitGroups }}</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              class="rounded px-0.5 transition-colors"
              :class="summary.unassigned ? 'font-bold text-amber-700 hover:bg-amber-50' : 'cursor-default'"
              :disabled="!summary.unassigned"
              :title="summary.unassigned ? tr('点击查看未安排宾客') : undefined"
              @click="focusUnassignedPool"
            >
              {{ tr('未安排') }} {{ summary.unassigned }}
            </button>
          </p>
        </div>
        <ul
          v-if="splitDetailsOpen && splitGroupDetails.length"
          id="banquet-split-details"
          class="space-y-1 rounded-t-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs leading-5 text-slate-700"
          data-testid="split-groups-details"
        >
          <li v-for="g in splitGroupDetails" :key="g.groupId" class="flex flex-wrap items-center gap-x-1.5 gap-y-1" :data-split-reason="g.reason">
            <span class="font-semibold text-slate-800">{{ splitReasonText(g) }}</span>
            <span aria-hidden="true" class="text-slate-400">→</span>
            <span>
              {{ tr('拆到') }}
              {{ listJoin(g.tables.map((x) => `${x.name}${tr('（')}${x.count} ${tr('人')}${tr('）')}`)) }}
            </span>
            <span class="ml-auto flex items-center gap-1.5" data-testid="split-group-actions">
              <SelectField
                v-if="tablesFittingGroup(g.groupId).length"
                class="w-44"
                size="sm"
                model-value=""
                :options="moveGroupOptions(g.groupId)"
                :data-testid="`move-group-${g.groupId}`"
                @update:model-value="moveGroupToTable(g.groupId, $event)"
              />
              <span
                v-else
                class="rounded-md border border-dashed border-slate-300 px-2 py-1 text-[11px] text-slate-500"
                :title="tr('没有一桌剩余座位够整组坐下')"
                :data-testid="`move-group-${g.groupId}-disabled`"
              >
                {{ tr('无桌可整组容纳') }}
              </span>
            </span>
          </li>
        </ul>
        <div
          v-if="splitDetailsOpen && splitGroupDetails.length"
          class="mb-2 flex flex-wrap items-center gap-1.5 rounded-b-lg border border-t-0 border-amber-200 bg-amber-50/60 px-3 py-1.5 text-xs leading-5 text-slate-700"
          data-testid="split-reassign-actions"
        >
          <span class="text-slate-600">{{ tr('换策略重新分配：') }}</span>
          <button
            v-if="assignStrategy !== 'keep-groups'"
            type="button"
            class="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 transition-colors hover:border-brand-400 hover:text-brand-600"
            data-testid="reassign-keep-groups"
            @click="reassignWith('keep-groups')"
          >
            {{ tr('换用「尽量不拆组」重新分配') }}
          </button>
          <button
            v-if="assignStrategy !== 'fill-tables'"
            type="button"
            class="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 transition-colors hover:border-brand-400 hover:text-brand-600"
            data-testid="reassign-fill-tables"
            @click="reassignWith('fill-tables')"
          >
            {{ tr('换用「优先坐满」重新分配') }}
          </button>
          <span v-if="summary.emptyTables" class="text-slate-500">
            {{ tr('空桌可删除，也可保留备用（临时加人时直接落座）') }}
          </span>
        </div>
        <div class="mb-1 flex items-center justify-between gap-2 text-[11px] leading-5 text-slate-600 md:hidden">
          <p>{{ fitToWidth ? tr('已缩放至屏幕宽度，放大后可左右滑动查看细节') : `← ${tr('画布超宽时可左右滑动查看')} →` }}</p>
          <button
            type="button"
            class="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
            :aria-pressed="!fitToWidth"
            data-testid="canvas-fit-toggle"
            @click="fitToWidth = !fitToWidth"
          >
            {{ fitToWidth ? tr('放大查看') : tr('适配屏宽') }}
          </button>
        </div>
        <div
          ref="canvasContainer"
          class="overflow-auto rounded-lg border border-slate-200/80 bg-[radial-gradient(circle,#cbd5e1_1px,transparent_1px)] bg-slate-100/70 bg-[size:16px_16px] p-3 shadow-[inset_0_1px_3px_rgba(15,23,42,0.05)]"
        >
          <div class="flex w-fit min-w-full justify-center">
            <div
              class="relative origin-top-left"
              :style="{
                width: `${VENUE_WIDTH * MM_TO_PX * scale}px`,
                height: `${VENUE_HEIGHT * MM_TO_PX * scale}px`,
              }"
            >
              <div
                class="absolute top-0 left-0 origin-top-left"
                :style="{ transform: `scale(${scale})` }"
              >
                <div class="banquet-venue" @pointerdown.self="selectedId = null">
                  <div
                    v-for="m in markers"
                    :key="m.id"
                    class="banquet-marker"
                    :class="{ 'banquet-selected': selectedId === m.id }"
                    :style="{
                      left: `${m.x}mm`,
                      top: `${m.y}mm`,
                      width: `${m.width}mm`,
                      height: `${m.height}mm`,
                    }"
                    @pointerdown="onElementPointerDown('marker', m.id, $event)"
                  >
                    {{ m.label }}
                  </div>
                  <div
                    v-for="t in tables"
                    :key="t.id"
                    class="banquet-table"
                    :class="{
                      'banquet-table--round': t.shape === 'round',
                      'banquet-selected': selectedId === t.id,
                      'banquet-table--drop': guestDragging && dropTableId === t.id,
                      'banquet-table--over': t.guestIds.length > t.seats,
                      'banquet-table--empty-hint': highlightEmptyTables && !t.guestIds.length,
                      'banquet-table--locked': t.locked,
                      'banquet-table--flash': flashTableId === t.id,
                    }"
                    :style="{
                      left: `${t.x}mm`,
                      top: `${t.y}mm`,
                      width: `${t.width}mm`,
                      height: `${t.height}mm`,
                    }"
                    :data-table-id="t.id"
                    :data-locked="t.locked ? 'true' : undefined"
                    @pointerdown="onElementPointerDown('table', t.id, $event)"
                  >
                    <button
                      type="button"
                      class="banquet-table-lock"
                      :class="{ 'banquet-table-lock--on': t.locked }"
                      :aria-pressed="!!t.locked"
                      :aria-label="`${t.locked ? tr('解锁') : tr('锁定')} ${t.name}`"
                      :title="t.locked ? tr('已锁定：自动分配不改动这桌') : tr('锁定这桌：自动分配不改动')"
                      data-testid="banquet-table-lock-toggle"
                      @pointerdown.stop
                      @click.stop="toggleTableLock(t.id)"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                        <rect x="5" y="11" width="14" height="10" rx="2" />
                        <path v-if="t.locked" d="M8 11V7a4 4 0 0 1 8 0v4" />
                        <path v-else d="M8 11V7a4 4 0 0 1 7.5-1.9" />
                      </svg>
                    </button>
                    <span class="banquet-table-name">{{ t.name }}</span>
                    <span class="banquet-table-count">{{ t.guestIds.length }}/{{ t.seats }}</span>
                    <span class="banquet-table-guests">
                      <span
                        v-for="g in tableGuests(t)"
                        :key="g.id"
                        class="banquet-guest"
                        :class="{
                          'banquet-guest--dragging': guestDragging && guestDragId === g.id,
                          'banquet-guest--hit': hitGuestIds.has(g.id),
                          'banquet-guest--pinned': isPinnedTo(g, t.id),
                        }"
                        :style="
                          guestColor(g, true)
                            ? { borderColor: guestColor(g, true)!, color: guestColor(g, true)! }
                            : undefined
                        "
                        :data-pinned="isPinnedTo(g, t.id) ? 'true' : undefined"
                        @pointerdown="onGuestPointerDown(g.id, $event)"
                      >
                        {{ g.name }}
                        <button
                          type="button"
                          class="banquet-guest-pin"
                          :class="{ 'banquet-guest-pin--on': isPinnedTo(g, t.id) }"
                          :aria-pressed="isPinnedTo(g, t.id)"
                          :aria-label="
                            (isPinnedTo(g, t.id) ? tr('取消钉住 {name}') : tr('钉住 {name} 到本桌')).replace('{name}', g.name)
                          "
                          :title="isPinnedTo(g, t.id) ? tr('取消钉住') : tr('钉住到本桌')"
                          data-testid="guest-pin-toggle"
                          @pointerdown.stop
                          @click.stop="togglePin(g.id, t.id)"
                        >
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M9.5 2.5l4 4-2.5.5-2.5 2.5.5 3-2-2-4 4 4-4-2-2 3 .5L10 6z" :fill="isPinnedTo(g, t.id) ? 'currentColor' : 'none'" />
                          </svg>
                        </button>
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 未安排宾客池：拖到桌上安排、从桌上拖回撤下 -->
        <div
          data-guest-pool
          class="mt-3 rounded-lg border border-dashed p-2.5 transition-colors"
          :class="
            guestDragging && dropToPool
              ? 'border-brand-500 bg-brand-50'
              : 'border-slate-300 bg-white'
          "
        >
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p class="min-w-0 flex-1 text-xs font-bold text-slate-600">
              {{ tr('未安排宾客') }}{{ tr('（') }}{{ unassignedGuests.length }}{{ tr('）') }}
              <span v-if="!multiSelect" class="ml-1 font-normal text-slate-600" data-testid="unassigned-pool-hint">{{
                tr('拖到餐桌上即可安排；从桌上拖回这里撤下')
              }}</span>
              <span v-else class="ml-1 font-normal text-slate-600" data-testid="unassigned-pool-hint">{{
                tr('点选宾客后在底部操作条批量归组')
              }}</span>
            </p>
            <div v-if="unassignedGuests.length" class="flex shrink-0 items-center gap-1.5">
              <button
                v-if="multiSelect"
                type="button"
                class="btn btn-ghost btn-sm"
                data-testid="select-all-ungrouped"
                @click="selectAllUngrouped"
              >
                {{ tr('全选未分组') }}
              </button>
              <button
                type="button"
                class="btn btn-sm"
                :class="multiSelect ? 'btn-primary' : 'btn-secondary'"
                :aria-pressed="multiSelect"
                data-testid="toggle-multi-select"
                @click="toggleMultiSelect"
              >
                {{ multiSelect ? tr('退出多选') : tr('多选') }}
              </button>
            </div>
          </div>
          <div v-if="unassignedGuests.length" class="mt-1.5 flex flex-wrap gap-1.5">
            <template v-if="multiSelect">
              <label
                v-for="g in unassignedGuests"
                :key="g.id"
                class="banquet-pool-guest inline-flex! cursor-pointer items-center gap-1 select-none"
                :class="{ 'ring-2 ring-brand-500/40': selectedGuestIds.has(g.id) }"
                :style="
                  guestColor(g, true)
                    ? { borderColor: guestColor(g, true)!, color: guestColor(g, true)! }
                    : undefined
                "
              >
                <input
                  type="checkbox"
                  class="size-3.5 accent-brand-600"
                  :checked="selectedGuestIds.has(g.id)"
                  :aria-label="g.name || tr('（未命名）')"
                  @change="toggleGuestSelected(g.id)"
                />
                {{ g.name || tr('（未命名）') }}
              </label>
            </template>
            <template v-else>
              <span
                v-for="g in unassignedGuests"
                :key="g.id"
                class="banquet-pool-guest"
                :class="{ 'opacity-40': guestDragging && guestDragId === g.id }"
                :style="
                  guestColor(g, true)
                    ? { borderColor: guestColor(g, true)!, color: guestColor(g, true)! }
                    : undefined
                "
                @pointerdown="onGuestPointerDown(g.id, $event)"
              >
                {{ g.name || tr('（未命名）') }}
              </span>
            </template>
          </div>
          <div v-else-if="!guests.length" class="mt-2 flex flex-wrap gap-2" data-testid="banquet-empty-cta">
            <button type="button" class="btn btn-primary btn-sm" @click="focusPasteInput">
              {{ tr('粘贴名单') }}
            </button>
            <button type="button" class="btn btn-secondary btn-sm" @click="loadDemoGuests(24)">
              {{ tr('载入示例') }}
            </button>
          </div>
          <p v-else class="mt-1 text-xs text-slate-500">{{ tr('全部宾客都已安排上桌。') }}</p>
        </div>

        <div v-if="groups.length" class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
          <span class="font-bold">{{ tr('分组图例：') }}</span>
          <span v-for="g in groups" :key="g.id" class="inline-flex items-center gap-1">
            <span
              class="inline-block size-2.5 rounded-full"
              :style="{ background: g.color }"
              aria-hidden="true"
            ></span>
            {{ g.name }}
          </span>
        </div>
      </div>
    </div>

    <!-- 导出前检查弹窗 -->
    <ModalDialog :open="issuesOpen" :title="tr('导出前检查发现问题')" size="md" @close="issuesOpen = false">
      <div v-if="issues" class="flex flex-col gap-3 text-sm text-slate-700">
        <div v-if="issues.unassigned.length">
          <p class="font-bold text-amber-700">
            {{ tr('未安排的宾客') }}{{ tr('（') }}{{ issues.unassigned.length }}{{ tr('）') }}
          </p>
          <p class="mt-0.5 text-xs leading-5 text-slate-600">{{ listJoin(issues.unassigned) }}</p>
        </div>
        <div v-if="issues.emptyTables.length">
          <p class="font-bold text-amber-700">
            {{ tr('空桌') }} {{ issues.emptyTables.length }} {{ tr('桌') }}{{ tr('：') }}{{ listJoin(issues.emptyTables) }}
          </p>
          <p class="mt-0.5 text-xs leading-5 text-slate-600">
            {{
              posterLayout
                ? tr('张贴版只排有宾客的桌，这些空桌不会出现在导出图中；需要保留空白桌请关闭「张贴版」。')
                : tr('继续导出时这些桌会以空白桌保留在座位图中；不需要请删除空桌或减少桌数。')
            }}
          </p>
        </div>
        <div v-if="issues.overCapacity.length">
          <p class="font-bold text-red-600">
            {{ tr('超员的桌') }}{{ tr('（') }}{{ issues.overCapacity.length }}{{ tr('）') }}
          </p>
          <p class="mt-0.5 text-xs leading-5 text-slate-600">{{ listJoin(issues.overCapacity) }}</p>
        </div>
        <div v-if="issues.overlaps.length">
          <p class="font-bold text-red-600">{{ tr('位置重叠的餐桌') }}</p>
          <p class="mt-0.5 text-xs leading-5 text-slate-600">
            {{ issues.overlaps.map(([a, b]) => `${a} ↔ ${b}`).join(tr('；')) }}
          </p>
        </div>
        <div v-if="issues.duplicateNames.length">
          <p class="font-bold text-amber-700">
            {{ tr('同名宾客') }}{{ tr('（') }}{{ issues.duplicateNames.length }}{{ tr('）') }}
          </p>
          <p class="mt-0.5 text-xs leading-5 text-slate-600">
            {{ listJoin(issues.duplicateNames) }}{{ tr('。') }}{{ tr('同名会被当作不同宾客各占一座；如为同一人请删除多余行，如为不同人建议在姓名后加备注区分。') }}
          </p>
        </div>
      </div>
      <template #actions>
        <button type="button" class="btn btn-secondary btn-md" @click="issuesOpen = false">
          {{ tr('返回修改') }}
        </button>
        <button
          v-if="issues?.emptyTables.length"
          type="button"
          class="btn btn-secondary btn-md"
          @click="removeEmptyTablesAndExport"
        >
          {{ tr('删除空桌后导出') }}
        </button>
        <button
          type="button"
          class="btn btn-primary btn-md"
          data-testid="banquet-issues-confirm"
          @click="confirmIssuesAndExport"
        >
          {{
            onlyEmptyTableIssues
              ? posterLayout
                ? tr('跳过空桌，继续导出')
                : tr('保留空桌，继续导出')
              : tr('忽略问题，继续导出')
          }}
        </button>
      </template>
    </ModalDialog>

    <!-- 切预设 / 清空安排二次确认（仅在已有安排时弹出） -->
    <ModalDialog
      :open="pendingDestructive !== null"
      :title="pendingDestructive?.kind === 'clear' ? tr('清空座位安排') : tr('切换场地预设')"
      size="md"
      @close="pendingDestructive = null"
    >
      <p class="text-sm leading-6 text-slate-700">
        <template v-if="pendingDestructive?.kind === 'clear'">
          {{ tr('将清空当前') }} {{ confirmAssignedCount }} {{ tr('位宾客的桌位安排，是否继续？') }}
        </template>
        <template v-else>
          {{ tr('切换预设会清空当前') }} {{ confirmAssignedCount }} {{ tr('位宾客的桌位安排，是否继续？') }}
        </template>
      </p>
      <p class="mt-1 text-xs leading-5 text-slate-500">{{ tr('确认后 10 秒内可在提示中点「撤销」恢复。') }}</p>
      <template #actions>
        <button type="button" class="btn btn-secondary btn-md" @click="pendingDestructive = null">
          {{ tr('取消') }}
        </button>
        <button type="button" class="btn btn-danger btn-md" @click="confirmDestructive">
          {{ pendingDestructive?.kind === 'clear' ? tr('清空安排') : tr('清空并切换') }}
        </button>
      </template>
    </ModalDialog>

    <!-- 粘贴解析预览：各行列数一致但无法确定第二列含义时，确认解析方式后再导入 -->
    <ModalDialog
      :open="parsePreview !== null"
      :title="tr('确认名单解析方式')"
      size="md"
      @close="parsePreview = null"
    >
      <p class="text-sm leading-6 text-slate-700">
        {{ tr('检测到每行') }} {{ parsePreview?.columnCount ?? 0 }} {{ tr('列，但无法确定第二列是分组还是另一位宾客，请选择解析方式：') }}
      </p>
      <fieldset class="mt-3 flex flex-col gap-2" data-testid="parse-preview-modes">
        <legend class="sr-only">{{ tr('解析方式') }}</legend>
        <label
          v-for="m in parsePreviewModes"
          :key="m.value"
          class="flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
          :class="parsePreviewMode === m.value ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'"
        >
          <input
            v-model="parsePreviewMode"
            type="radio"
            name="banquet-parse-mode"
            :value="m.value"
            class="mt-1 accent-brand-600"
          />
          <span class="min-w-0">
            <span class="block font-medium text-slate-800">{{ m.label }}</span>
            <span class="block text-xs text-slate-500">{{ m.hint }}</span>
          </span>
        </label>
      </fieldset>
      <div
        class="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600"
        data-testid="parse-preview-summary"
        aria-live="polite"
      >
        <p>
          {{ tr('将导入') }} {{ parsePreviewResult?.names.length ?? 0 }} {{ tr('位宾客') }}<template v-if="parsePreviewGroups.length">{{ tr('、') }}{{ parsePreviewGroups.length }} {{ tr('个分组') }}</template>{{ tr('：') }}{{ parsePreviewNames }}
        </p>
        <ul v-if="parsePreviewGroups.length" class="mt-1 flex flex-wrap gap-1.5">
          <li
            v-for="g in parsePreviewGroups"
            :key="g.name"
            class="rounded-md border border-slate-200 bg-white px-2 py-0.5"
          >
            {{ g.name }} · {{ g.count }} {{ tr('人') }}
          </li>
        </ul>
      </div>
      <template #actions>
        <button type="button" class="btn btn-secondary btn-md" @click="parsePreview = null">
          {{ tr('取消') }}
        </button>
        <button type="button" class="btn btn-primary btn-md" data-testid="parse-preview-confirm" @click="confirmParsePreview">
          {{ tr('确认导入') }}
        </button>
      </template>
    </ModalDialog>

    <!-- 导出方式选择：带水印免费不限次 / 无水印计配额（口径同 /studio） -->
    <ModalDialog
      :open="exportChoiceOpen"
      :title="pendingFormat === 'pdf' ? tr('导出 PDF') : tr('导出 PNG')"
      size="md"
      @close="exportChoiceOpen = false"
    >
      <p class="text-sm text-slate-600">
        {{ tr('带水印导出永远免费、不限次数（页脚一行 seatmark.cn 细线签名）；无水印导出今日剩余') }} {{ quota.remaining }}{{ tr('。') }}
      </p>
      <template #actions>
        <button type="button" class="btn btn-secondary btn-md" @click="chooseWatermarked">
          {{ tr('带水印导出（免费）') }}
        </button>
        <button type="button" class="btn btn-primary btn-md" @click="chooseClean">
          {{ tr('无水印导出') }}
        </button>
      </template>
    </ModalDialog>

    <!-- 宾客速查表打印宿主：A4 纵向，内容按浏览器分页自然流式排布 -->
    <Teleport to="body">
      <div v-if="renderQuickRefHost && quickRef" class="offscreen-host">
        <div class="sheet-page quickref-sheet" data-testid="banquet-quickref-sheet">
          <h2 class="quickref-title">{{ title || tr('宴会座位表') }} · {{ tr('宾客速查表') }}</h2>
          <p class="quickref-meta">
            {{ quickRef.index.length }} {{ tr('人') }} · {{ quickRef.tables.length }} {{ tr('桌') }}
          </p>
          <h3 class="quickref-section">{{ tr('姓名索引（拼音序）') }}</h3>
          <ol class="quickref-index" :style="{ columnCount: quickRefColumns }">
            <li v-for="(entry, i) in quickRef.index" :key="i" class="quickref-index-row">
              <span class="quickref-index-name">{{ entry.name }}</span>
              <span class="quickref-index-arrow" aria-hidden="true">→</span>
              <span class="quickref-index-table">{{ entry.tableName }}</span>
            </li>
          </ol>
          <h3 class="quickref-section">{{ tr('按桌名单') }}</h3>
          <div class="quickref-tables">
            <table v-for="table in quickRef.tables" :key="table.tableName" class="quickref-table">
              <caption class="quickref-table-name">
                {{ table.tableName }}
                <span class="quickref-table-count">{{ table.rows.length }} {{ tr('人') }}</span>
              </caption>
              <thead>
                <tr>
                  <th>{{ tr('座次') }}</th>
                  <th>{{ tr('姓名') }}</th>
                  <th>{{ tr('分组') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in table.rows" :key="i">
                  <td>{{ row.seatNo || '—' }}</td>
                  <td>{{ row.name }}</td>
                  <td>{{ row.groupName || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="quickref-footer" aria-hidden="true">
            <span class="quickref-footer-rule"></span>
            <span>SeatMark 座签 · seatmark.cn</span>
            <span class="quickref-footer-rule"></span>
          </p>
        </div>
      </div>
    </Teleport>

    <!-- 导出宿主：teleport 到 body 离屏渲染，html2canvas 截取 -->
    <Teleport to="body">
      <div v-if="renderExportHost" class="offscreen-host">
        <div
          ref="exportHost"
          class="sheet-page banquet-sheet"
          :style="{ width: `${pageSize.width}mm`, height: `${pageSize.height}mm` }"
        >
          <h2 class="banquet-sheet-title">{{ title || tr('宴会座位表') }}</h2>
          <div class="banquet-sheet-body">
            <!-- 张贴版：非空桌按网格铺满安全区，姓名字号随桌块自适应（与屏幕场地图无关） -->
            <div
              v-if="posterLayout && posterTables.length"
              data-export-ink
              data-testid="poster-grid"
              class="banquet-poster"
              :style="posterGridStyle"
            >
              <div
                v-for="t in posterTables"
                :key="t.id"
                class="banquet-poster-table"
                :class="{ 'banquet-poster-table--round': t.shape === 'round' }"
              >
                <span class="banquet-poster-table-name">{{ t.name }}</span>
                <span class="banquet-poster-guests">
                  <span
                    v-for="g in tableGuests(t)"
                    :key="g.id"
                    class="banquet-poster-guest"
                    :style="
                      guestColor(g, exportColors)
                        ? { borderColor: guestColor(g, exportColors)!, color: guestColor(g, exportColors)! }
                        : undefined
                    "
                  >
                    {{ g.name }}
                  </span>
                </span>
              </div>
            </div>
            <!-- 紧凑版：外层盒取缩放后的实际尺寸，flex 居中才不会按未缩放的布局盒溢出页面；
                 data-export-ink 声明场地图横贯页面，右侧纯白即判渲染不完整 -->
            <div
              v-else
              data-export-ink
              :style="{
                width: `${VENUE_WIDTH * exportScale}mm`,
                height: `${VENUE_HEIGHT * exportScale}mm`,
              }"
            >
            <div
              class="origin-top-left"
              :style="{
                transform: `scale(${exportScale})`,
                width: `${VENUE_WIDTH}mm`,
                height: `${VENUE_HEIGHT}mm`,
              }"
            >
              <div class="banquet-venue banquet-venue--export">
                <div
                  v-for="m in markers"
                  :key="m.id"
                  class="banquet-marker"
                  :style="{
                    left: `${m.x}mm`,
                    top: `${m.y}mm`,
                    width: `${m.width}mm`,
                    height: `${m.height}mm`,
                  }"
                >
                  {{ m.label }}
                </div>
                <div
                  v-for="t in tables"
                  :key="t.id"
                  class="banquet-table"
                  :class="{ 'banquet-table--round': t.shape === 'round' }"
                  :style="{
                    left: `${t.x}mm`,
                    top: `${t.y}mm`,
                    width: `${t.width}mm`,
                    height: `${t.height}mm`,
                  }"
                >
                  <span class="banquet-table-name">{{ t.name }}</span>
                  <span class="banquet-table-guests">
                    <span
                      v-for="g in tableGuests(t)"
                      :key="g.id"
                      class="banquet-guest"
                      :style="
                        guestColor(g, exportColors)
                          ? { borderColor: guestColor(g, exportColors)!, color: guestColor(g, exportColors)! }
                          : undefined
                      "
                    >
                      {{ g.name }}
                    </span>
                  </span>
                </div>
              </div>
            </div>
            </div>
          </div>
          <div v-if="exportColors && groups.length" class="banquet-sheet-legend">
            <span v-for="g in groups" :key="g.id" class="banquet-sheet-legend-item">
              <span class="banquet-sheet-legend-dot" :style="{ background: g.color }"></span>
              {{ g.name }}
            </span>
          </div>
          <div v-if="withWatermark" class="sheet-watermark" aria-hidden="true">
            SeatMark 座签 · seatmark.cn
          </div>
        </div>
      </div>
    </Teleport>
    <div
      v-if="batchBarVisible"
      ref="batchBarEl"
      class="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white shadow-[0_-1px_3px_rgba(15,23,42,0.05)]"
      data-testid="batch-group-bar"
      role="toolbar"
      :aria-label="tr('批量分组')"
    >
      <div class="mx-auto flex h-12 w-full max-w-[1480px] items-center gap-2 px-3 sm:px-4">
        <SelectField
          v-model="batchGroupId"
          :options="batchGroupOptions"
          size="sm"
          placement="up"
          class="min-w-0 flex-1 sm:max-w-64"
          data-testid="batch-group-select"
        />
        <button
          type="button"
          class="btn btn-primary btn-sm shrink-0"
          :disabled="!selectedCount || !batchGroupId || batchGroupId === NEW_GROUP_VALUE"
          data-testid="batch-group-apply"
          @click="applyBatchGroup(batchGroupId)"
        >
          {{ tr('应用到已选') }} {{ selectedCount }} {{ tr('人') }}
        </button>
        <button
          type="button"
          class="btn btn-secondary btn-sm shrink-0"
          :disabled="!selectedCount"
          data-testid="batch-group-clear"
          @click="applyBatchGroup(null)"
        >
          {{ tr('清除分组') }}
        </button>
      </div>
    </div>
    <NextStepBar
      v-else
      :step="nextStep"
      :arrange-label="tr('自动分配')"
      :progress="nextStepProgress"
      :target="nextStepTarget"
      :quota-badge="exportBadge"
      :quota-badge-title="exportBadgeTitle"
    >
      <template #secondary>
        <MobilePreviewJump :preview="canvasContainer" :settings="rosterSection" inline />
      </template>
    </NextStepBar>
    <MobilePreviewJump :preview="canvasContainer" :settings="rosterSection" :avoid="pasteInput" />
  </div>
</template>

<style scoped>
/* 常驻安排状态条：可换行，字号与面板辅助文字一致 */
.assign-status {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0 0.375rem;
  min-width: 0;
  max-width: 100%;
  border-radius: 0.375rem;
  background: #f8fafc;
  padding: 0 0.5rem;
  font-size: 0.6875rem;
  line-height: 1.25rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #475569;
}

/* 场地画布：mm 物理单位排版，屏幕经 scale 适配，导出所见即所得 */
.banquet-venue {
  position: relative;
  width: 420mm;
  height: 297mm;
  background: #ffffff;
  border: 0.4mm solid #cbd5e1;
  border-radius: 2mm;
  overflow: hidden;
}

.banquet-venue--export {
  border-color: #94a3b8;
}

.banquet-marker {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0.4mm dashed #94a3b8;
  border-radius: 1.5mm;
  background: #f8fafc;
  font-size: 4mm;
  font-weight: 700;
  letter-spacing: 0.8mm;
  color: #64748b;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.banquet-table {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  border: 0.45mm solid #64748b;
  border-radius: 2mm;
  background: #ffffff;
  padding: 1.6mm 1.2mm;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.banquet-table--round {
  border-radius: 50%;
  justify-content: center;
}

.banquet-table-name {
  font-size: 3.6mm;
  line-height: 1.2;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.banquet-table-count {
  font-size: 2.4mm;
  line-height: 1.2;
  color: #475569;
  font-weight: 600;
}

.banquet-table-guests {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.6mm;
  margin-top: 0.8mm;
  max-width: 100%;
  overflow: hidden;
}

.banquet-guest {
  display: inline-block;
  border: 0.3mm solid #cbd5e1;
  border-radius: 1mm;
  padding: 0.2mm 0.8mm;
  font-size: 2.6mm;
  line-height: 1.35;
  font-weight: 600;
  color: #334155;
  background: #ffffff;
  white-space: nowrap;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.banquet-guest--dragging {
  opacity: 0.4;
}

.banquet-guest-pin {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.2mm;
  height: 3.2mm;
  margin-left: 0.4mm;
  vertical-align: -0.5mm;
  border-radius: 0.6mm;
  color: #94a3b8;
  opacity: 0.55;
  cursor: pointer;
  touch-action: manipulation;
}

.banquet-guest-pin svg {
  width: 2.6mm;
  height: 2.6mm;
}

.banquet-guest:hover .banquet-guest-pin,
.banquet-guest-pin:focus-visible,
.banquet-guest-pin--on {
  opacity: 1;
}

.banquet-guest-pin--on {
  color: #4f46e5;
}

.banquet-guest--pinned {
  border-style: solid;
  box-shadow: 0 0 0 0.3mm rgba(79, 70, 229, 0.25);
}

.banquet-selected {
  border-color: #4f46e5;
  box-shadow: 0 0 0 1mm rgba(79, 70, 229, 0.18);
}

.banquet-table--drop {
  border-color: #16a34a;
  box-shadow: 0 0 0 1mm rgba(22, 163, 74, 0.25);
  background: #f0fdf4;
}

.banquet-table--empty-hint {
  border-color: #d97706;
  box-shadow: 0 0 0 1mm rgba(217, 119, 6, 0.28);
}

.banquet-table--over {
  border-color: #dc2626;
}

.banquet-table--locked {
  border-style: dashed;
  background: #f8fafc;
}

.banquet-table-lock {
  position: absolute;
  top: 0.8mm;
  right: 0.8mm;
  display: inline-flex;
  width: 4.2mm;
  height: 4.2mm;
  align-items: center;
  justify-content: center;
  border-radius: 1mm;
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  touch-action: manipulation;
}

.banquet-table-lock svg {
  width: 3mm;
  height: 3mm;
}

.banquet-table-lock:hover {
  color: #475569;
}

.banquet-table-lock--on {
  color: #4f46e5;
}

.banquet-table--flash {
  animation: banquet-flash 0.6s ease-in-out 3;
}

@keyframes banquet-flash {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(79, 70, 229, 0);
  }
  50% {
    box-shadow: 0 0 0 1.4mm rgba(79, 70, 229, 0.45);
    border-color: #4f46e5;
  }
}

.banquet-guest--hit {
  background: #fef3c7;
  border-color: #d97706 !important;
  color: #92400e !important;
}

/* 屏幕上的未安排宾客池小胶囊 */
.banquet-pool-guest {
  display: inline-block;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  background: #ffffff;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

/* 张贴版导出网格：尺寸与字号由 banquetExportLayout 计算后经内联样式/CSS 变量注入 */
.banquet-poster {
  display: grid;
  justify-content: center;
  align-content: start;
}

.banquet-poster-table {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  box-sizing: border-box;
  border: 0.6mm solid #64748b;
  border-radius: 3mm;
  background: #ffffff;
  padding: 3mm;
  overflow: hidden;
}

.banquet-poster-table--round {
  border-radius: 6mm;
}

.banquet-poster-table-name {
  font-size: var(--poster-table-font, 6mm);
  line-height: 1.3;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: calc(var(--poster-name-font, 5mm) * 0.4);
}

.banquet-poster-guests {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-content: flex-start;
  gap: 1.2mm;
  max-width: 100%;
  overflow: hidden;
}

.banquet-poster-guest {
  display: inline-block;
  box-sizing: border-box;
  border: 0.4mm solid #cbd5e1;
  border-radius: 1.5mm;
  padding: 0 1.2mm;
  font-size: var(--poster-name-font, 5mm);
  line-height: 1.55;
  font-weight: 600;
  color: #334155;
  background: #ffffff;
  white-space: nowrap;
}

/* 导出页 */
.banquet-sheet {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 10mm;
  background: #ffffff;
}

.banquet-sheet-title {
  text-align: center;
  font-size: 7mm;
  line-height: 1.3;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 3mm;
}

.banquet-sheet-body {
  flex: 1;
  display: flex;
  justify-content: center;
  min-height: 0;
}

.banquet-sheet-legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4mm;
  font-size: 3mm;
  color: #475569;
  margin-top: 2mm;
}

.banquet-sheet-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 1.2mm;
}

.banquet-sheet-legend-dot {
  display: inline-block;
  width: 2.6mm;
  height: 2.6mm;
  border-radius: 50%;
}

/* 宾客速查表打印页：高度随内容流式增长，由浏览器按 A4 纵向自然分页 */
.quickref-sheet {
  width: 210mm;
  height: auto;
  min-height: 297mm;
  overflow: visible;
  box-sizing: border-box;
  padding: 12mm 14mm 10mm;
  font-size: 3.4mm;
  line-height: 1.5;
  color: #0f172a;
}

.quickref-title {
  text-align: center;
  font-size: 6mm;
  line-height: 1.3;
  font-weight: 700;
}

.quickref-meta {
  margin-top: 1.5mm;
  text-align: center;
  font-size: 3mm;
  color: #64748b;
}

.quickref-section {
  margin: 6mm 0 2.5mm;
  padding-bottom: 1mm;
  border-bottom: 0.3mm solid #cbd5e1;
  font-size: 4mm;
  font-weight: 700;
  break-after: avoid;
}

.quickref-index {
  column-gap: 8mm;
  list-style: none;
  margin: 0;
  padding: 0;
}

.quickref-index-row {
  display: flex;
  align-items: baseline;
  gap: 1.5mm;
  padding: 0.6mm 0;
  border-bottom: 0.15mm dashed #e2e8f0;
  break-inside: avoid;
}

.quickref-index-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.quickref-index-arrow {
  color: #94a3b8;
}

.quickref-index-table {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}

.quickref-tables {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4mm 8mm;
}

.quickref-table {
  width: 100%;
  border-collapse: collapse;
  break-inside: avoid;
}

.quickref-table-name {
  text-align: left;
  font-weight: 700;
  padding-bottom: 1mm;
  caption-side: top;
}

.quickref-table-count {
  margin-left: 1.5mm;
  font-weight: 500;
  font-size: 2.8mm;
  color: #64748b;
}

.quickref-table th,
.quickref-table td {
  padding: 0.7mm 1.2mm;
  border-bottom: 0.15mm solid #e2e8f0;
  text-align: left;
  font-size: 3mm;
  vertical-align: top;
}

.quickref-table th {
  color: #64748b;
  font-weight: 600;
  border-bottom-color: #94a3b8;
}

.quickref-table td:first-child,
.quickref-table th:first-child {
  width: 10mm;
  font-variant-numeric: tabular-nums;
}

/* 底边细线签名：与标签水印同一形态（两侧细线夹极小字距文字） */
.quickref-footer {
  display: flex;
  align-items: center;
  gap: 2mm;
  margin-top: 8mm;
  font-size: 2.6mm;
  line-height: 1;
  letter-spacing: 0.2mm;
  color: #94a3b8;
  break-inside: avoid;
}

.quickref-footer-rule {
  flex: 1;
  height: 0.12mm;
  min-height: 1px;
  background: currentColor;
  opacity: 0.55;
}
</style>
