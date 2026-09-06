<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import NextStepBar, { type NextStep } from '@/components/NextStepBar.vue'
import CheckboxField from '@/components/ui/CheckboxField.vue'
import ColorField from '@/components/ui/ColorField.vue'
import ModalDialog from '@/components/ui/ModalDialog.vue'
import NumberField from '@/components/ui/NumberField.vue'
import SelectField, { type SelectOption } from '@/components/ui/SelectField.vue'
import { useElementSize } from '@/composables/useElementSize'
import { demoPersonNames } from '@/data/demoDatasets'
import { currentLocale, localePath, t as tr } from '@/i18n'
import { useQuotaStore } from '@/stores/quota'
import { useToastStore } from '@/stores/toast'
import {
  autoAssignGuests,
  BANQUET_STATE_KEY,
  buildVenuePreset,
  countAssignedGuests,
  defaultTableName,
  MARKER_PRESETS,
  nextGroupColor,
  parseBanquetGuests,
  snapshotTables,
  splitGroups,
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
  type MarkerKind,
  type VenuePresetId,
} from '@/utils/banquet'
import { uid } from '@/utils/id'
import { fitScale, MM_TO_PX } from '@/utils/layout'
import { exportPagedPng, sanitizeFileNamePart } from '@/utils/pngExport'
import { defaultPdfFileName, exportPagedPdf } from '@/utils/pdfExport'

const toast = useToastStore()
const quota = useQuotaStore()

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

watch(
  [title, pasteText, guests, groups, tables, markers, paper, orientation, exportColors],
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
      }
      localStorage.setItem(BANQUET_STATE_KEY, JSON.stringify(state))
    } catch {
      /* 隐私模式等存储不可用：不持久化 */
    }
  },
  { deep: true },
)

// ---------- 第 1 步：宾客名单 ----------

const txtInput = ref<HTMLInputElement | null>(null)
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
  const sample = list.slice(0, 5).join('、')
  return list.length > 5 ? `${sample}…` : sample
})

function importPasted() {
  const { names, duplicates } = parseBanquetGuests(pasteText.value)
  if (!names.length) {
    toast.warning(tr('名单为空'), tr('请粘贴宾客名单，每行一位'))
    return
  }
  const existing = new Set(guests.value.map((g) => g.name))
  const fresh = names.filter((n) => !existing.has(n))
  guests.value = [...guests.value, ...fresh.map((name) => ({ id: uid('gst'), name, groupId: null }))]
  const merged = [...new Set([...duplicates, ...names.filter((n) => existing.has(n))])]
  mergedDuplicates.value = merged
  toast.success(
    `${tr('已添加宾客')}: ${fresh.length}`,
    merged.length ? `${tr('自动去重重复姓名')}: ${merged.length}` : tr('可在下方列表继续编辑、分组'),
  )
  pasteText.value = ''
}

function onTxtChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const text = typeof reader.result === 'string' ? reader.result : ''
    pasteText.value = pasteText.value.trim() ? `${pasteText.value}\n${text}` : text
    toast.info(tr('TXT 已读取到输入框'), tr('确认内容后点「添加到名单」'))
  }
  reader.readAsText(file)
}

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

function autoAssign() {
  if (!guests.value.length) {
    toast.warning(tr('名单为空'), tr('请先在第 1 步添加宾客'))
    return
  }
  if (!tables.value.length) {
    toast.warning(tr('还没有餐桌'), tr('请先在第 2 步选择场地预设或添加餐桌'))
    return
  }
  const result = autoAssignGuests(guests.value, tables.value)
  for (const t of tables.value) {
    t.guestIds = result.get(t.id) ?? []
  }
  const s = summary.value
  const detail = `${tr('已安排')} ${s.assigned}/${s.total} · ${tr('空桌')} ${s.emptyTables} · ${tr('拆分分组')} ${s.splitGroups} · ${tr('未安排')} ${s.unassigned}`
  if (s.unassigned) {
    toast.warning(
      `${tr('座位不够：未安排宾客')}: ${s.unassigned}`,
      `${detail}。${tr('可增加餐桌或提高每桌座位数后重新分配')}`,
    )
  } else {
    const hint = s.splitGroups
      ? tr('被拆开的分组已列在画布上方摘要中，可拖拽宾客微调')
      : tr('同组宾客已安排同桌，可拖拽宾客微调')
    toast.success(tr('已自动分配座位'), `${detail}。${hint}`)
  }
}

/** 画布上方的结果摘要（随安排实时变化，不仅限于自动排座后） */
const summary = computed(() => summarizeBanquet(guests.value, tables.value, groups.value))

/** 被拆到多桌的分组明细（摘要中「拆分分组」可展开查看） */
const splitGroupDetails = computed(() => splitGroups(guests.value, tables.value, groups.value))
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
  if (target.guestIds.length > target.seats) {
    toast.warning(`「${target.name}」${tr('已超员')}`, `${target.guestIds.length} / ${target.seats}`)
  }
}

function moveGuestToPool(guestId: string) {
  for (const t of tables.value) {
    t.guestIds = t.guestIds.filter((id) => id !== guestId)
  }
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
</script>

<template>
  <div class="mx-auto w-full max-w-[1480px] px-4 py-6 pb-20 sm:py-8 sm:pb-20">
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
            :placeholder="tr('每行一位宾客姓名，粘贴后点「添加到名单」')"
          ></textarea>
          <div class="mt-2 flex flex-wrap gap-2">
            <button type="button" class="btn btn-primary btn-sm" @click="importPasted">
              {{ tr('添加到名单（自动去重）') }}
            </button>
            <button type="button" class="btn btn-secondary btn-sm" @click="txtInput?.click()">
              {{ tr('上传 TXT 名单') }}
            </button>
            <input
              ref="txtInput"
              type="file"
              accept=".txt,text/plain"
              class="hidden"
              :aria-label="tr('上传 TXT 名单文件')"
              @change="onTxtChange"
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
            <div class="flex items-center justify-between">
              <label class="field-label !mb-0">
                {{ tr('名单') }}{{ tr('（') }}{{ guestCount }} {{ tr('人') }} / {{ seatCount }} {{ tr('座') }}{{ tr('）') }}
              </label>
              <button type="button" class="btn btn-ghost btn-sm" @click="addGuestRow">
                + {{ tr('加一行') }}
              </button>
            </div>
            <p
              v-if="mergedDuplicates.length"
              class="mt-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs leading-5 text-amber-800"
              role="status"
              aria-live="polite"
            >
              {{ tr('已合并') }} {{ mergedDuplicates.length }} {{ tr('个重复姓名') }}：{{ mergedDuplicatesText }}
            </p>
            <div
              v-if="guests.length"
              class="mt-1.5 flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1"
            >
              <div v-for="g in guests" :key="g.id" class="flex items-center gap-1.5">
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
            <p v-else class="mt-1 text-xs text-slate-500">
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
              <span class="block text-[10px] leading-4 text-slate-500">{{ tr(p.hint) }}</span>
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
          <div class="mt-3 flex flex-wrap gap-2">
            <button type="button" class="btn btn-primary btn-sm" @click="autoAssign">
              {{ tr('一键自动分配（同组同桌）') }}
            </button>
            <button type="button" class="btn btn-ghost btn-sm" @click="clearAssignments">
              {{ tr('清空安排') }}
            </button>
          </div>
          <p class="mt-2 text-xs leading-5 text-slate-600">
            {{ tr('分配后可直接拖拽宾客姓名在桌之间移动微调；拖到画布下方「未安排」区可撤下宾客。') }}
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
          </div>
          <div class="mt-3 flex flex-col gap-2">
            <button
              type="button"
              class="btn btn-primary btn-md"
              :disabled="exporting"
              @click="startExport('png')"
            >
              {{ exporting ? tr('导出中…') : tr('导出高清 PNG') }}
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
          </div>
        </section>
      </aside>

      <!-- 画布 -->
      <div class="min-w-0">
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
              :class="summary.emptyTables ? 'font-bold text-amber-600 hover:bg-amber-50' : 'cursor-default'"
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
              @click="removeEmptyTablesFromSummary"
            >
              {{ tr('删除空桌') }}
            </button>
            <span aria-hidden="true">·</span>
            <button
              v-if="summary.splitGroups"
              type="button"
              class="rounded px-0.5 font-bold text-amber-600 transition-colors hover:bg-amber-50"
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
              :class="summary.unassigned ? 'font-bold text-amber-600 hover:bg-amber-50' : 'cursor-default'"
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
          class="mb-2 space-y-1 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs leading-5 text-slate-700"
          data-testid="split-groups-details"
        >
          <li v-for="g in splitGroupDetails" :key="g.groupId" class="flex flex-wrap items-baseline gap-x-1.5">
            <span class="font-semibold text-slate-800">{{ g.groupName }}</span>
            <span aria-hidden="true" class="text-slate-400">→</span>
            <span>
              {{ g.tables.map((x) => `${x.name}（${x.count} ${tr('人')}）`).join('、') }}
            </span>
          </li>
        </ul>
        <div class="mb-1 flex items-center justify-between gap-2 text-[11px] leading-5 text-slate-400 sm:hidden">
          <p>{{ fitToWidth ? tr('已缩放至屏幕宽度，可切回原尺寸查看细节') : `← ${tr('画布超宽时可左右滑动查看')} →` }}</p>
          <button
            type="button"
            class="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
            :aria-pressed="fitToWidth"
            data-testid="canvas-fit-toggle"
            @click="fitToWidth = !fitToWidth"
          >
            {{ fitToWidth ? tr('原尺寸') : tr('适配屏宽') }}
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
                    }"
                    :style="{
                      left: `${t.x}mm`,
                      top: `${t.y}mm`,
                      width: `${t.width}mm`,
                      height: `${t.height}mm`,
                    }"
                    :data-table-id="t.id"
                    @pointerdown="onElementPointerDown('table', t.id, $event)"
                  >
                    <span class="banquet-table-name">{{ t.name }}</span>
                    <span class="banquet-table-count">{{ t.guestIds.length }}/{{ t.seats }}</span>
                    <span class="banquet-table-guests">
                      <span
                        v-for="g in tableGuests(t)"
                        :key="g.id"
                        class="banquet-guest"
                        :class="{ 'banquet-guest--dragging': guestDragging && guestDragId === g.id }"
                        :style="
                          guestColor(g, true)
                            ? { borderColor: guestColor(g, true)!, color: guestColor(g, true)! }
                            : undefined
                        "
                        @pointerdown="onGuestPointerDown(g.id, $event)"
                      >
                        {{ g.name }}
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
          <p class="text-xs font-bold text-slate-600">
            {{ tr('未安排宾客') }}{{ tr('（') }}{{ unassignedGuests.length }}{{ tr('）') }}
            <span class="ml-1 font-normal text-slate-400">{{ tr('拖到餐桌上即可安排；从桌上拖回这里撤下') }}</span>
          </p>
          <div v-if="unassignedGuests.length" class="mt-1.5 flex flex-wrap gap-1.5">
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
          </div>
          <div v-else-if="!guests.length" class="mt-2 flex flex-wrap gap-2" data-testid="banquet-empty-cta">
            <button type="button" class="btn btn-primary btn-sm" @click="focusPasteInput">
              {{ tr('粘贴名单') }}
            </button>
            <button type="button" class="btn btn-secondary btn-sm" @click="loadDemoGuests(24)">
              {{ tr('载入示例') }}
            </button>
          </div>
          <p v-else class="mt-1 text-xs text-slate-400">{{ tr('全部宾客都已安排上桌。') }}</p>
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
          <p class="font-bold text-amber-600">{{ tr('未安排的宾客') }}（{{ issues.unassigned.length }}）</p>
          <p class="mt-0.5 text-xs leading-5 text-slate-600">{{ issues.unassigned.join('、') }}</p>
        </div>
        <div v-if="issues.emptyTables.length">
          <p class="font-bold text-amber-600">
            {{ tr('空桌') }} {{ issues.emptyTables.length }} {{ tr('桌') }}：{{ issues.emptyTables.join('、') }}
          </p>
          <p class="mt-0.5 text-xs leading-5 text-slate-600">
            {{ tr('继续导出时这些桌会以空白桌保留在座位图和桌卡中；不需要请删除空桌或减少桌数。') }}
          </p>
        </div>
        <div v-if="issues.overCapacity.length">
          <p class="font-bold text-red-600">{{ tr('超员的桌') }}（{{ issues.overCapacity.length }}）</p>
          <p class="mt-0.5 text-xs leading-5 text-slate-600">{{ issues.overCapacity.join('、') }}</p>
        </div>
        <div v-if="issues.overlaps.length">
          <p class="font-bold text-red-600">{{ tr('位置重叠的餐桌') }}</p>
          <p class="mt-0.5 text-xs leading-5 text-slate-600">
            {{ issues.overlaps.map(([a, b]) => `${a} ↔ ${b}`).join('；') }}
          </p>
        </div>
        <div v-if="issues.duplicateNames.length">
          <p class="font-bold text-amber-600">{{ tr('同名宾客') }}（{{ issues.duplicateNames.length }}）</p>
          <p class="mt-0.5 text-xs leading-5 text-slate-600">
            {{ issues.duplicateNames.join('、') }}。{{ tr('同名会被当作不同宾客各占一座；如为同一人请删除多余行，如为不同人建议在姓名后加备注区分。') }}
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
        <button type="button" class="btn btn-primary btn-md" @click="confirmIssuesAndExport">
          {{ onlyEmptyTableIssues ? tr('保留空桌，继续导出') : tr('忽略问题，继续导出') }}
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

    <!-- 导出方式选择：带水印免费不限次 / 无水印计配额（口径同 /studio） -->
    <ModalDialog
      :open="exportChoiceOpen"
      :title="pendingFormat === 'pdf' ? tr('导出 PDF') : tr('导出 PNG')"
      size="md"
      @close="exportChoiceOpen = false"
    >
      <p class="text-sm text-slate-600">
        {{ tr('带水印导出永远免费、不限次数（页脚一行 seatmark.cn 细线签名）；无水印导出今日剩余') }} {{ quota.remaining }}。
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
            <!-- 外层盒取缩放后的实际尺寸，flex 居中才不会按未缩放的布局盒溢出页面；
                 data-export-ink 声明场地图横贯页面，右侧纯白即判渲染不完整 -->
            <div
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
    <NextStepBar
      :step="nextStep"
      :arrange-label="tr('自动分配')"
      :progress="nextStepProgress"
      :target="nextStepTarget"
    />
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
  color: #94a3b8;
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
</style>
