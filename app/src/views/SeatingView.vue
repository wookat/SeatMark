<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, ref, shallowRef, watch, watchEffect } from 'vue'
import { useRouter } from 'vue-router'

import MobilePreviewJump from '@/components/MobilePreviewJump.vue'
import NextStepBar, { type NextStep } from '@/components/NextStepBar.vue'
import CheckboxField from '@/components/ui/CheckboxField.vue'
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
import { useToastStore } from '@/stores/toast'
import { useQuotaStore } from '@/stores/quota'
import { fitScale, MM_TO_PX } from '@/utils/layout'
import { listJoin } from '@/utils/listJoin'
import { setPrintPageSize } from '@/utils/paper'
import { downloadBlob, exportPagedPng, sanitizeFileNamePart } from '@/utils/pngExport'
import { printAndWaitUntilDone } from '@/utils/printing'
import {
  buildDisplayGrid,
  buildSeatGrid,
  buildSeats,
  dedupeSeatingEntries,
  findSeatsByName,
  interleaveByGender,
  parseSeatingRosterDetailed,
  reconcileArranged,
  roomIdHasLabel,
  roomsFitIndividually,
  SEATING_HANDOFF_KEY,
  seatingExportFileName,
  seatingRosterTextFromTable,
  shuffleEntries,
  summarizeGenderMix,
  unseatedEntries,
  unseatedSummary,
  type Seat,
  type SeatingDuplicatePolicy,
  type SeatingEntry,
  type SeatingFillOrder,
  type SeatingHandoff,
  type SeatingViewMode,
} from '@/utils/seating'
import { seatingCsvHasGender, seatingRosterCsv } from '@/utils/seatingCsv'

const router = useRouter()
const toast = useToastStore()
useStickyActions()
useCanvasSafeArea()
const quota = useQuotaStore()
const auth = useAuthStore()
const { badge: exportBadge, title: exportBadgeTitle } = useQuotaBadge(quota, auth, tr)

// ---------- 输入（持久化到本地，避免跨页返回丢失排座成果） ----------
const SEATING_STATE_KEY = 'seatmark.seating-state.v1'

interface SeatingPersistedState {
  title: string
  /** 可选考场号：只用于 handoff 的「考场」列，不参与座位表标题 */
  roomNo?: string
  rows: number
  cols: number
  podium: 'top' | 'none'
  fillOrder: SeatingFillOrder
  aisles: number[]
  namesText: string
  arranged: SeatingEntry[] | null
  duplicatePolicy?: SeatingDuplicatePolicy
  /** 名单含考场列时选中的考场号；空 = 全部 */
  roomFilter?: string
  /** 非当前考场的手工排座缓存（key 为考场 id，全部视图为 ''）；当前考场的座次在 arranged */
  arrangedByRoom?: Record<string, SeatingEntry[]>
}

function sanitizeArrangedByRoom(raw: unknown): Record<string, SeatingEntry[]> {
  const out: Record<string, SeatingEntry[]> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(value)) out[key] = value as SeatingEntry[]
  }
  return out
}

function loadPersistedState(): SeatingPersistedState | null {
  try {
    const raw = localStorage.getItem(SEATING_STATE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as SeatingPersistedState
  } catch {
    return null
  }
}

const persisted = loadPersistedState()

const title = ref(persisted?.title ?? tr('高三（2）班 期末考试'))
const roomNo = ref(typeof persisted?.roomNo === 'string' ? persisted.roomNo : '')
const rows = ref(persisted?.rows ?? 6)
const cols = ref(persisted?.cols ?? 8)
const podium = ref<'top' | 'none'>(persisted?.podium ?? 'top')
const fillOrder = ref<SeatingFillOrder>(persisted?.fillOrder ?? 'rows')
/** 过道位置：第 n 列之后（1 起） */
const aisles = ref(new Set<number>(persisted?.aisles ?? []))
const namesText = ref(persisted?.namesText ?? '')

const FILL_OPTIONS = computed<SelectOption[]>(() => [
  { value: 'rows', label: tr('按行填充'), hint: tr('从讲台侧第一排，自左向右') },
  { value: 'serpentine', label: tr('S 形蛇形填充'), hint: tr('奇数排向右、偶数排向左') },
])

const parsedRoster = computed(() => parseSeatingRosterDetailed(namesText.value))
/** 重名处理：默认合并（同名学生不占两座）；开关后保留并加 ①② 后缀 */
const keepDuplicates = ref(persisted?.duplicatePolicy === 'suffix')
const duplicatePolicy = computed<SeatingDuplicatePolicy>(() =>
  keepDuplicates.value ? 'suffix' : 'merge',
)
const dedupedRoster = computed(() =>
  dedupeSeatingEntries(parsedRoster.value.entries, duplicatePolicy.value),
)
/** 名单含「考场」列时可按考场筛选；仅在 ≥ 2 个考场时展示下拉，无考场列时 UI 与现状一致 */
const roomFilter = ref(typeof persisted?.roomFilter === 'string' ? persisted.roomFilter : '')
const rooms = computed(() => parsedRoster.value.rooms)
const roomFilterVisible = computed(() => rooms.value.length >= 2)
/** 生效的考场筛选：名单中已没有该考场（或不再需要筛选）时回到全部 */
const activeRoom = computed(() =>
  roomFilterVisible.value && rooms.value.some((r) => r.id === roomFilter.value) ? roomFilter.value : '',
)
const ROOM_ALL = ''
const roomOptions = computed<SelectOption[]>(() => [
  {
    value: ROOM_ALL,
    label: `${tr('全部')} ${parsedRoster.value.entries.length} ${personUnit.value}`,
  },
  ...rooms.value.map((r) => ({
    value: r.id,
    label: roomLabel(r.id),
    hint: `${r.count} ${personUnit.value}`,
  })),
])
/** 考场下拉与提示用的考场名：原始单元格已带「考场/试室/room」时不再重复加前缀 */
function roomLabel(id: string): string {
  if (id === ROOM_ALL) return tr('全部')
  return roomIdHasLabel(id) ? id : `${tr('考场')} ${id}`
}
/** 指定考场（'' = 全部）当前名单中的成员 */
function entriesForRoom(room: string): SeatingEntry[] {
  const list = dedupedRoster.value.entries
  return room ? list.filter((e) => e.room === room) : list
}
const parsedEntries = computed<SeatingEntry[]>(() => entriesForRoom(activeRoom.value))
const duplicateNames = computed(() => dedupedRoster.value.duplicates)
const duplicateHint = computed(() => {
  const list = duplicateNames.value
  if (!list.length) return ''
  const sample = listJoin([...new Set(list)].slice(0, 5))
  const names = new Set(list).size > 5 ? `${sample}…` : sample
  return keepDuplicates.value
    ? `${tr('已保留')} ${list.length} ${tr('个重复姓名并加序号区分')}${tr('：')}${names}`
    : `${tr('已合并')} ${list.length} ${tr('个重复姓名')}${tr('：')}${names}`
})
// 粘贴/上传后新出现重名时提示一次（重名数减少或切换开关不重复提示）
watch(
  () => duplicateNames.value.length,
  (count, prev) => {
    if (count > (prev ?? 0) && !keepDuplicates.value) {
      toast.info(`${tr('已合并')} ${count} ${tr('个重复姓名')}`, tr('同名学生不会被排进两个座位；如确有同名同学，可勾选「保留同名」'))
    }
  },
)
/** 列模式识别提示（表头已跳过 / 忽略列 / 性别列） */
const rosterHints = computed(() => {
  const r = parsedRoster.value
  const hints: string[] = []
  if (!r.columnMode) return hints
  if (r.headerSkipped.length) hints.push(`${tr('已跳过表头行：')}${listJoin(r.headerSkipped)}`)
  if (r.ignoredColumns.length) {
    hints.push(
      `${tr('已忽略')} ${r.ignoredColumns.length} ${tr('列附属信息')}${tr('（')}${listJoin(r.ignoredColumns)}${tr('）')}`,
    )
  }
  if (r.genderColumn) hints.push(tr('识别到性别列，可用男女混排'))
  return hints
})

const namesInput = ref<HTMLTextAreaElement | null>(null)

function focusNamesInput() {
  const el = namesInput.value
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.focus()
}

/** 名单文件上传（TXT/CSV/Excel）：全部浏览器本地解析后追加到名单文本框，由现有解析器取姓名/性别列 */
function appendRosterText(text: string, fileName: string) {
  const chunk = text.trim()
  if (!chunk) {
    toast.warning(tr('文件内容为空'), fileName)
    return
  }
  const before = filledCount.value
  namesText.value = namesText.value.trim() ? `${namesText.value.trimEnd()}\n${chunk}` : chunk
  const added = filledCount.value - before
  toast.success(
    `${tr('已读取')} ${added} ${tr('名学生')}`,
    tr('名单已追加到输入框，请核对后继续排座'),
  )
}

let pendingRosterFileName = ''
const rosterFile = useGuestFileImport({
  onTable: (headers, rows) =>
    appendRosterText(
      seatingRosterTextFromTable(headers, rows, !namesText.value.trim()),
      pendingRosterFileName,
    ),
  onText: (text) => appendRosterText(text, pendingRosterFileName),
  onError: (message) => toast.danger(tr('名单文件读取失败'), tr(message)),
})

function onRosterFileChange(event: Event) {
  pendingRosterFileName = (event.target as HTMLInputElement).files?.[0]?.name ?? ''
  return rosterFile.onFileChange(event)
}

/**
 * 手工排座结果（随机 / 拖拽后生效）。名单文本变化时不再静默清空，而是按姓名对齐：
 * 仍在名单中的人保位，删掉的人移除，新人追加到末尾，并用 toast 明示；整份替换（无人保留）才还原为名单顺序。
 * 切换重名策略 / 考场筛选仍还原为名单顺序，但同样 toast 明示。
 */
const arranged = ref<SeatingEntry[] | null>(persisted?.arranged ?? null)
/** 其它考场的手工排座（当前考场不在其中）：切场时存入 / 取出，避免往返切换丢掉各场排座 */
const arrangedByRoom = ref<Record<string, SeatingEntry[]>>(sanitizeArrangedByRoom(persisted?.arrangedByRoom))

/** 破坏性操作（还原名单顺序 / 切换重名处理）前的快照，toast 上可在 UNDO_WINDOW_MS 内撤销 */
const UNDO_WINDOW_MS = 10_000
interface SeatingSnapshot {
  arranged: SeatingEntry[] | null
  arrangedByRoom: Record<string, SeatingEntry[]>
  selectedSeat: number | null
  keepDuplicates: boolean
}
function takeSnapshot(): SeatingSnapshot {
  return {
    arranged: arranged.value ? arranged.value.map((e) => ({ ...e })) : null,
    arrangedByRoom: Object.fromEntries(
      Object.entries(arrangedByRoom.value).map(([k, list]) => [k, list.map((e) => ({ ...e }))]),
    ),
    selectedSeat: selectedSeat.value,
    keepDuplicates: keepDuplicates.value,
  }
}
/** 撤销回写开关时让 keepDuplicates 监听器跳过一次，避免再次清空座次 / 弹第二次 toast */
let suppressNextDuplicateToggle = false
function restoreSnapshot(snapshot: SeatingSnapshot) {
  if (keepDuplicates.value !== snapshot.keepDuplicates) {
    suppressNextDuplicateToggle = true
    keepDuplicates.value = snapshot.keepDuplicates
  }
  arrangedByRoom.value = snapshot.arrangedByRoom
  arranged.value = snapshot.arranged
  selectedSeat.value = snapshot.selectedSeat
}
function toastUndoable(title: string, text: string, snapshot: SeatingSnapshot) {
  toast.push('info', title, text, UNDO_WINDOW_MS, {
    label: tr('撤销'),
    onClick: () => {
      restoreSnapshot(snapshot)
      if (lastUndo.value === snapshot) lastUndo.value = null
    },
  })
}
/** 换座 / 整排交换 / 随机排座的单层撤销快照（只保留最近一次），Ctrl/Cmd+Z 恢复；shallowRef 保证与 toast 内持有的快照同一引用 */
const lastUndo = shallowRef<SeatingSnapshot | null>(null)
function rememberUndo(): SeatingSnapshot {
  const snapshot: SeatingSnapshot = { ...takeSnapshot(), selectedSeat: null }
  lastUndo.value = snapshot
  return snapshot
}
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}
function onUndoKeydown(event: KeyboardEvent) {
  if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return
  if (event.key !== 'z' && event.key !== 'Z') return
  if (isEditableTarget(event.target)) return
  const snapshot = lastUndo.value
  if (!snapshot) return
  event.preventDefault()
  lastUndo.value = null
  restoreSnapshot(snapshot)
  toast.info(tr('已撤销上一步换座'))
}
onMounted(() => window.addEventListener('keydown', onUndoKeydown))
onUnmounted(() => window.removeEventListener('keydown', onUndoKeydown))
/** 逐字输入时只提示一次：以连续编辑开始前的座次为基线，停顿后汇总净变化 */
const RECONCILE_TOAST_DELAY_MS = 600
let reconcileBase: SeatingEntry[] | null = null
let reconcileToastTimer: ReturnType<typeof setTimeout> | undefined

function flushReconcileToast() {
  if (reconcileToastTimer !== undefined) {
    clearTimeout(reconcileToastTimer)
    reconcileToastTimer = undefined
  }
  const base = reconcileBase
  reconcileBase = null
  if (!base || !arranged.value) return
  const { kept, added, removed } = reconcileArranged(base, parsedEntries.value)
  if (!added && !removed) return
  const details: string[] = []
  if (added) details.push(tr('新增 {n} 人，已排到末尾空位').replace('{n}', String(added)))
  if (removed) details.push(tr('移除 {n} 人，原座位留空').replace('{n}', String(removed)))
  toast.info(
    tr('名单已更新，已保留 {kept} 人的手工座位').replace('{kept}', String(kept)),
    details.join(tr('；')),
  )
}

/** 名单变更后对其它考场的缓存逐场对齐；无人保留的考场删掉缓存 */
function reconcileOtherRooms() {
  const keys = Object.keys(arrangedByRoom.value)
  if (!keys.length) return
  const next: Record<string, SeatingEntry[]> = {}
  for (const key of keys) {
    const result = reconcileArranged(arrangedByRoom.value[key]!, entriesForRoom(key))
    if (result.kept > 0) next[key] = result.entries
  }
  arrangedByRoom.value = next
}

watch(namesText, () => {
  reconcileOtherRooms()
  if (!arranged.value) return
  const result = reconcileArranged(arranged.value, parsedEntries.value)
  if (result.kept === 0) {
    arranged.value = null
    reconcileBase = null
    if (reconcileToastTimer !== undefined) {
      clearTimeout(reconcileToastTimer)
      reconcileToastTimer = undefined
    }
    toast.info(tr('名单已整体更换，座位已按名单顺序重排'))
    return
  }
  if (!reconcileBase) reconcileBase = arranged.value
  arranged.value = result.entries
  if (reconcileToastTimer !== undefined) clearTimeout(reconcileToastTimer)
  reconcileToastTimer = setTimeout(flushReconcileToast, RECONCILE_TOAST_DELAY_MS)
})
onBeforeUnmount(() => {
  if (reconcileToastTimer !== undefined) clearTimeout(reconcileToastTimer)
})
watch(keepDuplicates, (_value, prev) => {
  if (suppressNextDuplicateToggle) {
    suppressNextDuplicateToggle = false
    return
  }
  const hadCache = Object.keys(arrangedByRoom.value).length > 0
  if (!arranged.value && !hadCache) return
  const snapshot = { ...takeSnapshot(), keepDuplicates: prev }
  arranged.value = null
  arrangedByRoom.value = {}
  selectedSeat.value = null
  toastUndoable(
    tr('重名处理已切换，座位已按名单顺序重排'),
    tr('10 秒内可撤销，恢复原开关与手工座次'),
    snapshot,
  )
})
/** 考场号输入框由筛选自动带入的值；用户手填过（与自动值不同）则不覆盖 */
let roomNoAutoValue = ''
watch(activeRoom, (room, prev) => {
  if (room === prev) return
  if (room && (roomNo.value.trim() === '' || roomNo.value === roomNoAutoValue)) {
    roomNo.value = room
    roomNoAutoValue = room
  } else if (!room && roomNo.value === roomNoAutoValue && roomNoAutoValue) {
    roomNo.value = ''
    roomNoAutoValue = ''
  }
  // 当前场的手工排座存入缓存，目标场有缓存则恢复，否则回到名单顺序
  const cache = { ...arrangedByRoom.value }
  const prevKey = prev ?? ROOM_ALL
  if (arranged.value) cache[prevKey] = arranged.value
  else delete cache[prevKey]
  const restored = cache[room]
  delete cache[room]
  arrangedByRoom.value = cache
  const hadArranged = arranged.value !== null
  arranged.value = restored ?? null
  selectedSeat.value = null
  if (restored) {
    toast.info(tr('已切换到 {room}，已恢复该场上次排座').replace('{room}', roomLabel(room)))
  } else if (hadArranged) {
    toast.info(tr('已切换考场，座位已按名单顺序重排'))
  }
})

watch(
  [title, roomNo, rows, cols, podium, fillOrder, aisles, namesText, arranged, keepDuplicates, roomFilter, arrangedByRoom],
  () => {
    try {
      const state: SeatingPersistedState = {
        title: title.value,
        roomNo: roomNo.value,
        rows: rows.value,
        cols: cols.value,
        podium: podium.value,
        fillOrder: fillOrder.value,
        aisles: [...aisles.value],
        namesText: namesText.value,
        arranged: arranged.value,
        duplicatePolicy: duplicatePolicy.value,
        roomFilter: roomFilter.value,
        arrangedByRoom: arrangedByRoom.value,
      }
      localStorage.setItem(SEATING_STATE_KEY, JSON.stringify(state))
    } catch {
      /* 隐私模式等存储不可用：不持久化 */
    }
  },
  { deep: true },
)
watch([rows, cols, fillOrder], () => {
  selectedSeat.value = null
})

const entries = computed<SeatingEntry[]>(() => arranged.value ?? parsedEntries.value)
const filledCount = computed(() => entries.value.filter((e) => e.name).length)
const hasGender = computed(() => parsedEntries.value.some((e) => e.gender))

function toggleAisle(afterCol: number) {
  const next = new Set(aisles.value)
  if (next.has(afterCol)) next.delete(afterCol)
  else next.add(afterCol)
  aisles.value = next
}

function loadDemoNames() {
  const locale = currentLocale()
  const genders = locale === 'en' ? ['M', 'F'] : ['男', '女']
  const list = demoPersonNames(rows.value * cols.value, locale).map(
    (name, i) => `${name}\t${genders[i % 2]}`,
  )
  namesText.value = list.join('\n')
  toast.info(tr('已生成演示名单'), `${list.length} ${tr('人（含性别列），与当前行列数一致')}`)
}

// ---------- 随机排座 ----------
function randomizeAll() {
  if (!entries.value.length) {
    toast.warning(tr('名单为空'), tr('请先在左侧粘贴学生名单'))
    return
  }
  const snapshot = rememberUndo()
  arranged.value = shuffleEntries(entries.value.filter((e) => e.name))
  selectedSeat.value = null
  toastUndoable(tr('已完全随机排座'), tr('再点一次可重新打乱；10 秒内可撤销（Ctrl/Cmd+Z）'), snapshot)
}

function genderMixMessage(list: readonly SeatingEntry[]): string {
  const s = summarizeGenderMix(list)
  const parts: string[] = []
  let head = tr('男 {b} / 女 {g}').replace('{b}', String(s.boys)).replace('{g}', String(s.girls))
  if (s.unknown) {
    head += tr('，未识别性别 {n} 位排末尾').replace('{n}', String(s.unknown))
  }
  parts.push(head)
  if (s.surplus) {
    const more = s.boys > s.girls ? tr('男多 {n} 位') : tr('女多 {n} 位')
    parts.push(
      `${more.replace('{n}', String(s.surplus))}${tr('，末尾 {n} 座同性相邻').replace('{n}', String(s.surplus))}`,
    )
  } else {
    parts.push(tr('相邻座位已男女交替'))
  }
  return parts.join(tr('；'))
}

function randomizeMixed() {
  if (!hasGender.value) return
  const snapshot = rememberUndo()
  const list = interleaveByGender(parsedEntries.value.filter((e) => e.name))
  arranged.value = list
  selectedSeat.value = null
  toastUndoable(tr('已按男女混排'), genderMixMessage(list), snapshot)
}

function restoreOrder() {
  const snapshot = takeSnapshot()
  arranged.value = null
  selectedSeat.value = null
  toastUndoable(tr('已还原为名单原始顺序'), tr('10 秒内可撤销，恢复刚才的手工座次'), snapshot)
}

// ---------- 座位计算 ----------
const seats = computed<Seat[]>(() =>
  buildSeats(entries.value, rows.value, cols.value, fillOrder.value),
)

/** 按物理行列索引取座位（渲染网格用） */
const seatGrid = computed(() => buildSeatGrid(seats.value, rows.value, cols.value))

// ---------- 视角切换（教师视角 / 学生视角左右镜像） ----------
const viewMode = ref<SeatingViewMode>('teacher')

/** 展示网格：学生视角对每排做左右镜像，过道位置随之翻转 */
const displayGrid = computed(() =>
  buildDisplayGrid(seatGrid.value, cols.value, aisles.value, viewMode.value),
)

// ---------- 座位交换（点选互换 + 拖拽互换，含整排交换） ----------
const selectedSeat = ref<number | null>(null)
const selectedRow = ref<number | null>(null)
const dragSeat = ref<number | null>(null)
const dragRow = ref<number | null>(null)

/** 以当前座位序生成可交换的工作数组（长度补齐到座位数；超员时保留座位数之后的未排座尾部） */
function workingEntries(): SeatingEntry[] {
  const out: SeatingEntry[] = []
  const len = Math.max(rows.value * cols.value, entries.value.length)
  for (let i = 0; i < len; i++) {
    out.push(entries.value[i] ?? { name: '' })
  }
  return out
}

function swapSeats(a: number, b: number): SeatingSnapshot | null {
  if (a === b) return null
  const snapshot = rememberUndo()
  const work = workingEntries()
  ;[work[a], work[b]] = [work[b]!, work[a]!]
  arranged.value = work
  return snapshot
}

/** 点选 / 拖拽两座互换后的可撤销提示：文案含两人姓名与座位号（空座显示为「空座」） */
function swapSeatsWithToast(a: number, b: number) {
  const nameA = entries.value[a]?.name || tr('空座')
  const nameB = entries.value[b]?.name || tr('空座')
  const snapshot = swapSeats(a, b)
  if (!snapshot) return
  toastUndoable(
    `${tr('已交换座位')} ${a + 1} ↔ ${b + 1}${tr('：')}${nameA} ⇄ ${nameB}`,
    tr('10 秒内可撤销（Ctrl/Cmd+Z）'),
    snapshot,
  )
}

function swapRows(a: number, b: number) {
  if (a === b) return
  const snapshot = rememberUndo()
  const work = workingEntries()
  const c = cols.value
  for (let i = 0; i < c; i++) {
    ;[work[a * c + i], work[b * c + i]] = [work[b * c + i]!, work[a * c + i]!]
  }
  arranged.value = work
  toastUndoable(`${tr('已交换排')}: ${a + 1} ⇄ ${b + 1}`, tr('10 秒内可撤销（Ctrl/Cmd+Z）'), snapshot)
}

function onSeatClick(seat: Seat | null) {
  if (!seat) return
  if (suppressClick) {
    suppressClick = false
    return
  }
  selectedRow.value = null
  const idx = seat.seatNo - 1
  if (selectedSeat.value == null) {
    selectedSeat.value = idx
    return
  }
  if (selectedSeat.value === idx) {
    selectedSeat.value = null
    return
  }
  swapSeatsWithToast(selectedSeat.value, idx)
  selectedSeat.value = null
}

function onRowHandleClick(r: number) {
  if (suppressClick) {
    suppressClick = false
    return
  }
  selectedSeat.value = null
  if (selectedRow.value == null) {
    selectedRow.value = r
    return
  }
  if (selectedRow.value === r) {
    selectedRow.value = null
    return
  }
  swapRows(selectedRow.value, r)
  selectedRow.value = null
}

/**
 * 拖拽交换（仅鼠标）：基于 Pointer 事件实现。预览处于 scale() 变换容器内，
 * 原生 HTML5 Drag&Drop 在变换容器中不可靠（拖拽无反应）；触屏保留点选互换，
 * 避免与页面滚动冲突。
 */
const dragging = ref(false)
const dropSeatTarget = ref<number | null>(null)
const dropRowTarget = ref<number | null>(null)
let dragStartX = 0
let dragStartY = 0
let suppressClick = false
const DRAG_THRESHOLD_PX = 5

function onSeatPointerDown(seat: Seat | null, event: PointerEvent) {
  if (!seat?.name || event.pointerType !== 'mouse' || event.button !== 0) return
  event.preventDefault()
  dragSeat.value = seat.seatNo - 1
  dragRow.value = null
  beginDrag(event)
}

function onRowPointerDown(r: number, event: PointerEvent) {
  if (event.pointerType !== 'mouse' || event.button !== 0) return
  event.preventDefault()
  dragRow.value = r
  dragSeat.value = null
  beginDrag(event)
}

function beginDrag(event: PointerEvent) {
  dragging.value = false
  dragStartX = event.clientX
  dragStartY = event.clientY
  window.addEventListener('pointermove', onDragPointerMove)
  window.addEventListener('pointerup', onDragPointerUp)
}

function onDragPointerMove(event: PointerEvent) {
  if (!dragging.value) {
    if (
      Math.abs(event.clientX - dragStartX) < DRAG_THRESHOLD_PX &&
      Math.abs(event.clientY - dragStartY) < DRAG_THRESHOLD_PX
    ) {
      return
    }
    dragging.value = true
  }
  const el = document.elementFromPoint(event.clientX, event.clientY)
  const seatEl = el?.closest<HTMLElement>('[data-seat-no]')
  const rowEl = el?.closest<HTMLElement>('[data-row-index]')
  dropSeatTarget.value = seatEl ? Number(seatEl.dataset.seatNo) - 1 : null
  dropRowTarget.value = rowEl ? Number(rowEl.dataset.rowIndex) : null
}

function onDragPointerUp() {
  window.removeEventListener('pointermove', onDragPointerMove)
  window.removeEventListener('pointerup', onDragPointerUp)
  if (dragging.value) {
    suppressClick = true
    if (dragSeat.value != null && dropSeatTarget.value != null) {
      swapSeatsWithToast(dragSeat.value, dropSeatTarget.value)
    } else if (dragRow.value != null) {
      if (dropRowTarget.value != null) swapRows(dragRow.value, dropRowTarget.value)
      else if (dropSeatTarget.value != null) {
        swapRows(dragRow.value, Math.floor(dropSeatTarget.value / cols.value))
      }
    }
  }
  dragging.value = false
  dragSeat.value = null
  dragRow.value = null
  dropSeatTarget.value = null
  dropRowTarget.value = null
}

const seatCount = computed(() => rows.value * cols.value)

// ---------- 底部「下一步」操作条（只做导航，不碰数据） ----------
const rosterSection = ref<HTMLElement | null>(null)
const arrangeSection = ref<HTMLElement | null>(null)
const exportSection = ref<HTMLElement | null>(null)
const nextStep = computed<NextStep>(() => {
  if (!filledCount.value) return 'import'
  if (!arranged.value) return 'arrange'
  return 'export'
})
const nextStepTarget = computed(() => {
  switch (nextStep.value) {
    case 'import':
      return rosterSection.value
    case 'arrange':
      return arrangeSection.value
    case 'export':
      return exportSection.value
  }
})
/** 考场语境的人数单位：共享键「人」在英文里是宴会语境的 guests，这里走考场专用键（en → students） */
const personUnit = computed(() => (currentLocale() === 'en' ? tr('名单人数单位') : tr('人')))
const nextStepProgress = computed(
  () => `${filledCount.value} ${personUnit.value} / ${seatCount.value} ${tr('座')}`,
)
/** 排不进座位的学生（按填充顺序座位数之后的非空姓名）及其在名单序中的位置，点姓名可与选中座位互换 */
const unseated = computed(() => unseatedEntries(entries.value, rows.value, cols.value))
const unseatedItems = computed(() => {
  const items: { entry: SeatingEntry; index: number }[] = []
  for (let i = seatCount.value; i < entries.value.length; i++) {
    const entry = entries.value[i]!
    if (entry.name) items.push({ entry, index: i })
  }
  return items
})
const overflowCount = computed(() => unseated.value.length)
/**
 * 名单含 ≥ 2 个考场且筛选为「全部」时，把各考场合排在一张图上会「假溢出」：
 * 每个考场单独都坐得下就不提示排不下，改为引导先选考场。
 */
const allRoomsFitIndividually = computed(
  () =>
    roomFilterVisible.value &&
    activeRoom.value === ROOM_ALL &&
    roomsFitIndividually(rooms.value, seatCount.value),
)
const roomsGuideText = computed(() =>
  tr('「全部」把 {roomCount} 个考场合排在一张图；各考场单独都坐得下，先选考场再排座').replace(
    '{roomCount}',
    String(rooms.value.length),
  ),
)
function selectFirstRoom() {
  const first = rooms.value[0]
  if (!first) return
  roomFilter.value = first.id
  toast.info(
    tr('已切到 {room}，可在下方下拉切换').replace('{room}', roomLabel(first.id)),
  )
}
const unseatedOpen = ref(false)
watch(overflowCount, (n) => {
  if (!n) unseatedOpen.value = false
})
const unseatedFootnote = computed(() =>
  unseatedSummary(unseated.value, {
    template: tr('另有 {n} 人未排座：{names}'),
    etc: tr('等'),
    join: listJoin,
  }),
)
/** 把未排座的学生放到当前选中的座位，原座位学生变为未排；未选中座位时提示先选 */
function placeUnseated(index: number) {
  const target = selectedSeat.value
  if (target == null) {
    toast.info(tr('先在预览中点选一个座位'), tr('再点未排座的姓名，就能把 TA 换到那个座位'))
    return
  }
  const name = entries.value[index]?.name ?? ''
  const displaced = entries.value[target]?.name ?? ''
  swapSeats(target, index)
  selectedSeat.value = null
  toast.success(
    tr('{name} 已排到座位 {no}').replace('{name}', name).replace('{no}', String(target + 1)),
    displaced ? tr('{name} 变为未排座；可用 Ctrl/Cmd+Z 撤销').replace('{name}', displaced) : tr('可用 Ctrl/Cmd+Z 撤销'),
  )
}

// ---------- A4 横向预览（mm 排版 + 缩放适配容器） ----------
const SHEET_W = 297
const SHEET_H = 210
const previewContainer = ref<HTMLElement | null>(null)
const basicSection = ref<HTMLElement | null>(null)
/** 过道「列间」按钮行：落到视口底部条带时让移动端预览胶囊让位 */
const aisleRow = ref<HTMLElement | null>(null)
const { width: containerWidth } = useElementSize(previewContainer)
/** 「原尺寸」模式的缩放下限：座位点选目标不至于过小，超出部分靠容器横向滚动查看 */
const MIN_SCALE = 0.45
/** <sm 视口默认「适配屏宽」：整页缩到容器宽度内，不再需要横向滚动 */
const fitToWidth = ref(typeof window !== 'undefined' && window.innerWidth < 640)
const scale = computed(() => {
  if (!containerWidth.value) return 0.5
  const innerWidth = containerWidth.value - 16
  if (fitToWidth.value) return fitScale(innerWidth, SHEET_W * MM_TO_PX)
  return Math.min(Math.max(innerWidth / (SHEET_W * MM_TO_PX), MIN_SCALE), 1)
})

watchEffect(() => {
  if (typeof document === 'undefined') return
  setPrintPageSize(SHEET_W, SHEET_H)
})

// ---------- 查找学生（口径同 /banquet 宾客搜索：≥ 1 字即时匹配，重名多命中） ----------
const findQuery = ref('')
const findInput = ref<HTMLInputElement | null>(null)
const findHits = computed(() => findSeatsByName(seats.value, findQuery.value))
const findHitSeatNos = computed(() => new Set(findHits.value.map((s) => s.seatNo)))
const FIND_HINT_MAX = 3

function seatPositionText(seat: Seat): string {
  return tr('第 {r} 排 第 {c} 列 · 座位号 {n}')
    .replace('{r}', String(seat.row))
    .replace('{c}', String(seat.col))
    .replace('{n}', String(seat.seatNo))
}

const findHint = computed(() => {
  if (!findQuery.value.trim()) return ''
  const hits = findHits.value
  if (!hits.length) return tr('未找到')
  const parts = hits.slice(0, FIND_HINT_MAX).map((s) => `${s.name}：${seatPositionText(s)}`)
  if (hits.length > FIND_HINT_MAX) parts.push('…')
  const prefix = hits.length > 1 ? `${tr('命中 {n} 个座位').replace('{n}', String(hits.length))}：` : ''
  return prefix + parts.join(tr('；'))
})

function clearFind() {
  findQuery.value = ''
}

/** 首个命中座位滚入视口（预览容器内横向 + 页面纵向） */
watch(
  () => findHits.value[0]?.seatNo,
  (seatNo) => {
    if (seatNo == null) return
    void nextTick(() => {
      const el = previewContainer.value?.querySelector<HTMLElement>(`[data-seat-no="${seatNo}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    })
  },
)

// ---------- 打印 ----------
const renderHost = ref(false)

const printPending = ref(false)

async function doPrint() {
  if (printPending.value) return
  printPending.value = true
  // 打印设置提示需让用户先看到再弹对话框：window.print 会阻塞渲染，
  // 同一任务内先 toast 再 print 不会渲染出 toast 帧，需留出展示间隔
  toast.info(tr('即将调起浏览器打印'), tr('请选 A4 横向、无边距、缩放 100%，并勾选「背景图形」；也可「另存为 PDF」'))
  renderHost.value = true
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 1200))
  // 等 afterprint 再卸载宿主：部分浏览器 window.print 立即返回，提前卸载会打印出空白
  await printAndWaitUntilDone()
  renderHost.value = false
  printPending.value = false
}

// ---------- 导出 PNG（发群 / 贴 PPT）：离屏宿主 + html2canvas，口径同 /banquet ----------
const exportChoiceOpen = ref(false)
const exporting = ref(false)
/** 本次导出是否叠加细线水印（带水印不限次，无水印计入每日配额） */
const withWatermark = ref(false)
const exportHost = ref<HTMLElement | null>(null)

function startPngExport() {
  if (printPending.value || exporting.value) return
  if (!filledCount.value) {
    toast.warning(tr('名单为空'), tr('请先在左侧粘贴学生名单，每行一个姓名'))
    return
  }
  exportChoiceOpen.value = true
}

async function chooseWatermarked() {
  exportChoiceOpen.value = false
  withWatermark.value = true
  await runPngExport()
}

async function chooseClean() {
  if (quota.remaining <= 0) {
    exportChoiceOpen.value = false
    quota.openLimitDialog(() => void chooseWatermarked())
    return
  }
  exportChoiceOpen.value = false
  withWatermark.value = false
  await runPngExport()
}

/** 重建离屏导出宿主：渲染异常（首次挂载竞态等）时卸掉重挂再重渲 */
async function rebuildExportHost() {
  renderHost.value = false
  await nextTick()
  renderHost.value = true
  await nextTick()
}

function getExportPage(): HTMLElement {
  const el = exportHost.value
  if (!el) throw new Error(tr('导出页渲染失败'))
  return el
}

async function runPngExport() {
  if (exporting.value) return
  exporting.value = true
  renderHost.value = true
  await nextTick()
  try {
    getExportPage()
    await exportPagedPng({
      pageCount: 1,
      getPage: getExportPage,
      rebuildHost: rebuildExportHost,
      pageWidth: SHEET_W,
      pageHeight: SHEET_H,
      // 座位表整页满版（网格撑满宽度 + 底部页脚）：右侧/下部无墨迹即为丢样式的坏图
      fullPageInk: true,
      fileName: seatingExportFileName(
        title.value,
        viewMode.value,
        {
          fallback: tr('教室座位表'),
          teacher: tr('教师视角'),
          student: tr('学生视角'),
          room: tr('考场'),
        },
        activeRoom.value,
      ),
    })
    if (!withWatermark.value) await quota.tryConsume()
    toast.success(
      tr('PNG 已导出'),
      viewMode.value === 'student' ? tr('当前为学生视角（镜像），与屏幕预览一致') : tr('当前为教师视角，与屏幕预览一致'),
    )
  } catch (error) {
    toast.danger(tr('导出失败'), error instanceof Error ? error.message : String(error))
  } finally {
    renderHost.value = false
    withWatermark.value = false
    exporting.value = false
  }
}

// ---------- 座位清单 CSV（排/列/座位号/姓名[/性别]）：全部浏览器本地生成 ----------
function downloadRosterCsv() {
  const filled = seats.value.filter((s) => s.name)
  if (!filled.length) {
    toast.warning(tr('名单为空'), tr('请先在左侧粘贴学生名单，每行一个姓名'))
    return
  }
  const baseName = sanitizeFileNamePart(title.value) || tr('教室座位表')
  const blob = new Blob([seatingRosterCsv(seats.value, unseated.value)], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, `${baseName}-${tr('座位清单')}.csv`)
  toast.success(
    tr('CSV 已下载'),
    seatingCsvHasGender(seats.value)
      ? tr('列：排 / 列 / 座位号 / 姓名 / 性别，可直接用 Excel 打开')
      : tr('列：排 / 列 / 座位号 / 姓名，可直接用 Excel 打开'),
  )
}

// ---------- 一键生成对应桌贴 ----------
function toDeskLabels() {
  const filled = seats.value.filter((s) => s.name)
  if (!filled.length) {
    toast.warning(tr('名单为空'), tr('请先在左侧粘贴学生名单，每行一个姓名'))
    return
  }
  const room = roomNo.value.trim()
  const handoff: SeatingHandoff = {
    title: title.value,
    roomNo: room || undefined,
    // 「考场」列只在填了考场号时存在：标准考场版的考场位显示考场号或留空，不再填整句标题
    rows: filled.map((s) => ({
      姓名: s.name,
      座位号: String(s.seatNo),
      排: String(s.row),
      列: String(s.col),
      班级: title.value,
      ...(room ? { 考场: room } : {}),
    })),
  }
  try {
    localStorage.setItem(SEATING_HANDOFF_KEY, JSON.stringify(handoff))
  } catch {
    toast.danger(tr('无法暂存名单'), tr('浏览器存储不可用，请改用 Excel 上传方式'))
    return
  }
  void router.push(localePath('/studio?from=seating'))
}
</script>

<template>
  <div class="mx-auto w-full max-w-[1480px] px-4 py-6 pb-fixed-layers sm:py-8">
    <div class="text-center">
      <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Seating Chart</p>
      <h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {{ tr('教室座位表打印') }}
      </h1>
      <p class="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
        {{ tr('粘贴名单、设置行列与过道，支持随机排座（男女混排）、点选或拖拽换位、整排交换与双视角切换，生成 A4 教室平面座位表直接打印张贴。数据全程在浏览器本地处理。') }}
      </p>
      <p class="mt-2 text-xs text-slate-500">
        {{ tr('要排婚宴、年会圆桌？用') }}
        <RouterLink :to="localePath('/banquet')" class="font-semibold text-brand-600 hover:underline">
          {{ tr('宴会座位表生成器') }}
        </RouterLink>
      </p>
    </div>

    <div class="mt-6 grid items-start gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
      <!-- 设置面板 -->
      <aside class="no-print flex min-w-0 flex-col gap-4">
        <section ref="basicSection" class="panel-card scroll-mt-4">
          <h2 class="section-title"><span class="step-chip">1</span>{{ tr('基本信息') }}</h2>
          <div class="mt-3 grid grid-cols-2 gap-2.5">
            <div class="col-span-2 grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2.5">
              <div class="min-w-0">
                <label class="field-label" for="seating-title">{{ tr('班级 / 考场标题') }}</label>
                <input
                  id="seating-title"
                  v-model="title"
                  type="text"
                  class="input-field"
                  :placeholder="tr('如：高三（2）班 期末考试')"
                />
              </div>
              <div>
                <label class="field-label" for="seating-room-no">{{ tr('考场号') }}</label>
                <input
                  id="seating-room-no"
                  v-model="roomNo"
                  type="text"
                  class="input-field"
                  data-testid="seating-room-no"
                  :placeholder="tr('选填')"
                  :title="tr('选填：一键生成桌贴时填入模板的「考场」位，如 03')"
                />
              </div>
            </div>
            <div>
              <label class="field-label">{{ tr('排数（前后）') }}</label>
              <NumberField
                :aria-label="tr('排数（前后）')" v-model="rows" :min="1" :max="20" />
            </div>
            <div>
              <label class="field-label">{{ tr('列数（左右）') }}</label>
              <NumberField
                :aria-label="tr('列数（左右）')" v-model="cols" :min="1" :max="16" />
            </div>
            <div class="col-span-2">
              <label class="field-label">{{ tr('座位填充顺序') }}</label>
              <SelectField v-model="fillOrder" :options="FILL_OPTIONS" />
            </div>
            <div class="col-span-2">
              <CheckboxField
                :model-value="podium === 'top'"
                class="text-xs font-semibold text-slate-600"
                :label="tr('顶部标注讲台位置')"
                @update:model-value="podium = $event ? 'top' : 'none'"
              />
            </div>
          </div>
          <div class="mt-3">
            <label class="field-label">{{ tr('过道位置（点击列间隙切换）') }}</label>
            <div ref="aisleRow" class="flex flex-wrap gap-1.5" data-testid="aisle-row">
              <button
                v-for="n in Math.max(cols - 1, 0)"
                :key="n"
                type="button"
                class="rounded-md border px-2.5 py-1 text-[11px] font-bold transition-colors"
                :class="
                  aisles.has(n)
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-600'
                "
                @click="toggleAisle(n)"
              >
                {{ tr('列间') }} {{ n }}-{{ n + 1 }}
              </button>
            </div>
          </div>
        </section>

        <section ref="rosterSection" class="panel-card scroll-mt-4 outline-none">
          <div class="panel-head">
            <h2 class="section-title"><span class="step-chip">2</span>{{ tr('学生名单') }}</h2>
            <div class="flex flex-wrap items-center justify-end gap-1">
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                data-testid="seating-upload-roster"
                @click="rosterFile.open"
              >
                {{ tr('上传名单文件') }}
              </button>
              <input
                :ref="rosterFile.fileInput"
                type="file"
                :accept="GUEST_FILE_ACCEPT"
                class="hidden"
                data-testid="seating-roster-file"
                :aria-label="tr('上传 TXT / CSV / Excel 名单文件')"
                @change="onRosterFileChange"
              />
              <button type="button" class="btn btn-ghost btn-sm" @click="loadDemoNames">
                {{ tr('用演示名单') }}
              </button>
            </div>
          </div>
          <textarea
            ref="namesInput"
            v-model="namesText"
            rows="10"
            class="input-field mt-2 h-auto min-h-40 resize-y py-2 leading-6"
            :placeholder="tr('每行一个姓名，可附性别列（空格/逗号分隔）；可直接从 Excel 复制含表头的多列粘贴')"
          ></textarea>
          <p class="mt-2 text-xs leading-5 text-slate-600">
            {{ tr('已输入') }} <strong class="text-slate-700">{{ filledCount }}</strong> {{ tr('名学生') }} /
            <strong class="text-slate-700">{{ seatCount }}</strong> {{ tr('座') }}{{ tr('。') }}
            <button
              v-if="overflowCount && allRoomsFitIndividually"
              type="button"
              class="inline-flex max-w-full items-center gap-1 rounded-md text-left font-bold text-brand-700 underline decoration-brand-300 decoration-dotted underline-offset-2 hover:text-brand-800"
              data-testid="seating-rooms-guide"
              @click="selectFirstRoom"
            >
              {{ roomsGuideText }}
            </button>
            <button
              v-else-if="overflowCount"
              type="button"
              class="inline-flex max-w-full items-center gap-1 rounded-md font-bold text-amber-600 underline decoration-amber-300 decoration-dotted underline-offset-2 hover:text-amber-700"
              :aria-expanded="unseatedOpen"
              aria-controls="seating-unseated-list"
              data-testid="seating-unseated-toggle"
              @click="unseatedOpen = !unseatedOpen"
            >
              <span>{{ tr('超出') }} {{ overflowCount }} {{ tr('人排不下，请增加行列数。') }}</span>
              <svg
                class="size-3 shrink-0 transition-transform"
                :class="{ 'rotate-180': unseatedOpen }"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </p>
          <div
            v-if="overflowCount && unseatedOpen"
            id="seating-unseated-list"
            class="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900"
            data-testid="seating-unseated-list"
          >
            <p>
              {{ selectedSeat != null
                ? tr('点姓名把 TA 排到已选中的座位，原座位学生变为未排座')
                : tr('未排座的学生。先在预览中点选一个座位，再点姓名即可互换') }}
            </p>
            <div class="mt-1.5 flex flex-wrap gap-1.5">
              <button
                v-for="item in unseatedItems"
                :key="item.index"
                type="button"
                class="max-w-full truncate rounded-full border border-amber-300 bg-white px-2.5 py-0.5 font-semibold text-amber-900 hover:border-amber-500 hover:bg-amber-100"
                data-testid="seating-unseated-chip"
                :title="selectedSeat != null ? tr('排到座位 {no}').replace('{no}', String(selectedSeat + 1)) : tr('先在预览中点选一个座位')"
                @click="placeUnseated(item.index)"
              >
                {{ item.entry.name }}
              </button>
            </div>
          </div>
          <p v-if="rosterHints.length" class="mt-1 text-xs leading-5 text-slate-500" data-testid="roster-hints">
            <span v-for="hint in rosterHints" :key="hint" class="mr-2 inline-block">{{ hint }}</span>
          </p>
          <div v-if="roomFilterVisible" class="mt-2" data-testid="seating-room-filter">
            <label class="field-label">{{ tr('考场') }}</label>
            <SelectField
              :model-value="activeRoom"
              :options="roomOptions"
              size="sm"
              @update:model-value="roomFilter = $event"
            />
            <p class="mt-1 text-xs leading-5 text-slate-500">
              {{ tr('名单含考场列：选中后只排该考场的学生，导出文件名附考场号') }}
            </p>
          </div>
          <div
            v-if="duplicateHint"
            class="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900"
            data-testid="roster-duplicates"
          >
            <span data-testid="roster-duplicates-text">{{ duplicateHint }}</span>
            <CheckboxField
              v-model="keepDuplicates"
              tone="amber"
              class="text-xs font-semibold"
              data-testid="roster-keep-duplicates"
            >
              {{ tr('保留同名（自动加 ①② 后缀区分）') }}
            </CheckboxField>
          </div>
        </section>

        <section ref="arrangeSection" class="panel-card scroll-mt-4 outline-none">
          <h2 class="section-title">
            <span class="step-chip">3</span>{{ tr('随机排座') }}
            <span class="ml-1 text-xs font-normal text-slate-500">{{ tr('（可选）') }}</span>
          </h2>
          <div class="mt-3 flex flex-wrap gap-2">
            <button type="button" class="btn btn-secondary btn-sm" @click="randomizeAll">
              <svg
                class="size-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
              </svg>
              {{ tr('完全随机') }}
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              :disabled="!hasGender"
              :title="hasGender ? tr('相邻座位尽量男女交替') : tr('名单需包含性别列（如：张伟 男）')"
              @click="randomizeMixed"
            >
              <svg
                class="size-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="8" cy="8" r="4" />
                <circle cx="16" cy="16" r="4" />
              </svg>
              {{ tr('男女混排') }}
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              :disabled="!arranged"
              @click="restoreOrder"
            >
              {{ tr('还原名单顺序') }}
            </button>
          </div>
          <p class="mt-2 text-xs leading-5 text-slate-600">
            {{ tr('男女混排需名单包含性别列（每行「姓名 性别」）。预览中可点选两个座位互换，桌面鼠标还可直接按住座位拖拽交换；触屏设备请用点选方式。点击（桌面也可拖拽）行首「排」把手可整排交换。') }}
            {{ tr('人数不均、座位数不整齐或有过道时，尾部与过道两侧可能出现同性相邻，可点选互换微调。') }}
          </p>
        </section>

        <section ref="exportSection" class="panel-card scroll-mt-4 outline-none">
          <h2 class="section-title"><span class="step-chip">4</span>{{ tr('输出') }}</h2>
          <div class="mt-3 flex flex-col gap-2">
            <button type="button" class="btn btn-primary btn-md" @click="doPrint">
              <svg
                class="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M7 8V3h10v5M7 17H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3m-10-3h10v7H7v-7z" />
              </svg>
              {{ tr('打印座位表（A4 横向）') }}
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-md"
              :disabled="exporting"
              :title="`${tr('当前视角的座位表存为一张 PNG 图片，方便发班群、贴进 PPT')}。${exportBadgeTitle}`"
              data-testid="seating-export-png"
              @click="startPngExport"
            >
              <svg
                class="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 4v12m0 0 5-5m-5 5-5-5M4 20h16" />
              </svg>
              {{ exporting ? tr('导出中…') : tr('导出 PNG') }}
              <span
                class="ml-1 whitespace-nowrap rounded-full px-1.5 py-px text-[11px] font-semibold"
                :class="exportBadge.cls"
                data-testid="export-quota-badge"
              >{{ exportBadge.text }}</span>
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-md"
              :title="tr('列：排 / 列 / 座位号 / 姓名（有性别时加性别列），空座位不输出；浏览器本地生成，不上传')"
              data-testid="seating-roster-csv"
              @click="downloadRosterCsv"
            >
              <svg
                class="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M4 4h10l6 6v10H4zM14 4v6h6M8 14h8M8 18h8" />
              </svg>
              {{ tr('导出座位清单 .csv') }}
            </button>
            <button type="button" class="btn btn-secondary btn-md" @click="toDeskLabels">
              <svg
                class="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M4 5h16v6H4zM4 13h7v6H4zM13 13h7v6h-7z" />
              </svg>
              {{ tr('一键生成对应桌贴') }}
            </button>
            <p class="text-xs leading-5 text-slate-600">
              {{ tr('「生成桌贴」会把这份名单（含座位号、排、列）带入标签工坊，选模板即可批量输出课桌贴。') }}
            </p>
          </div>
        </section>
      </aside>

      <!-- 预览：≥md 右下预留空区给反馈气泡（html.has-canvas-safe-area 时气泡缩小贴边），底部留白跟随操作条实际高度，不压座位图 -->
      <div class="no-print min-w-0 md:pr-16 md:pb-fixed-layers" data-testid="seating-preview-column">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div
            class="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-bold"
            role="group"
            :aria-label="tr('视角切换')"
          >
            <button
              type="button"
              class="rounded-md px-3 py-1.5 transition-colors"
              :class="viewMode === 'teacher' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:text-brand-600'"
              @click="viewMode = 'teacher'"
            >
              {{ tr('教师视角') }}
            </button>
            <button
              type="button"
              class="rounded-md px-3 py-1.5 transition-colors"
              :class="viewMode === 'student' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:text-brand-600'"
              @click="viewMode = 'student'"
            >
              {{ tr('学生视角（镜像）') }}
            </button>
          </div>
          <p v-if="selectedSeat != null || selectedRow != null" class="text-xs font-semibold text-brand-600">
            {{ selectedRow != null ? `${tr('已选中排')} ${selectedRow + 1}，${tr('点另一排把手交换')}` : tr('已选中座位，点另一个座位交换') }}
          </p>
        </div>
        <div v-if="filledCount" class="mb-2 flex flex-wrap items-center gap-2" data-testid="seating-find">
          <label class="sr-only" for="seating-find-input">{{ tr('查找学生') }}</label>
          <div class="relative w-full sm:w-56">
            <input
              id="seating-find-input"
              ref="findInput"
              v-model="findQuery"
              type="search"
              class="input-field w-full py-1.5 pr-8 text-xs"
              :placeholder="tr('查找学生：输姓名或拼音')"
              autocomplete="off"
              enterkeyhint="search"
              data-testid="seating-find-input"
              @keydown.esc.prevent="clearFind"
            />
            <button
              v-if="findQuery"
              type="button"
              class="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
              :aria-label="tr('清除查找')"
              data-testid="seating-find-clear"
              @click="clearFind(); findInput?.focus()"
            >
              <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <p
            v-if="findHint"
            class="min-w-0 flex-1 text-xs leading-5"
            :class="findHits.length ? 'font-semibold text-amber-700' : 'text-slate-500'"
            role="status"
            data-testid="seating-find-hint"
          >
            {{ findHint }}
          </p>
        </div>
        <div
          v-if="!filledCount"
          class="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500"
          data-testid="seating-empty-cta"
        >
          <span>{{ rows }} {{ tr('排') }} × {{ cols }} {{ tr('列') }} · 0 {{ personUnit }}</span>
          <span aria-hidden="true">·</span>
          <button type="button" class="btn btn-primary btn-sm" @click="focusNamesInput">
            {{ tr('粘贴名单') }}
          </button>
          <button type="button" class="btn btn-secondary btn-sm" @click="loadDemoNames">
            {{ tr('载入示例') }}
          </button>
        </div>
        <p class="mb-1 text-[11px] leading-5 text-slate-500 md:hidden" data-testid="touch-swap-hint">
          {{ tr('触屏：先点一个座位再点另一个即可互换（拖拽仅支持鼠标）') }}
        </p>
        <div class="mb-1 flex items-center justify-between gap-2 text-[11px] leading-5 text-slate-600 md:hidden">
          <p>{{ fitToWidth ? tr('已缩放至屏幕宽度，放大后可左右滑动查看细节') : `← ${tr('座位表超宽时可左右滑动查看')} →` }}</p>
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
          ref="previewContainer"
          class="overflow-auto rounded-lg border border-slate-200/80 bg-[radial-gradient(circle,#cbd5e1_1px,transparent_1px)] bg-slate-100/70 bg-[size:16px_16px] p-3 shadow-[inset_0_1px_3px_rgba(15,23,42,0.05)]"
        >
          <!-- w-fit + min-w-full：内容超宽时可横向滚动到最左（纯 justify-center 会裁掉左侧） -->
          <div class="flex w-fit min-w-full justify-center">
            <div
              class="relative origin-top-left"
              :style="{
                width: `${SHEET_W * MM_TO_PX * scale}px`,
                height: `${SHEET_H * MM_TO_PX * scale}px`,
              }"
            >
              <div
                class="absolute top-0 left-0 origin-top-left"
                :style="{ transform: `scale(${scale})` }"
              >
                <div class="sheet-page seating-sheet">
                  <h2 class="seating-title">{{ title || tr('教室座位表') }}</h2>
                  <div v-if="podium === 'top'" class="seating-podium">{{ tr('讲　台') }}</div>
                  <div class="seating-grid">
                    <div v-for="(rowCells, r) in displayGrid" :key="r" class="seating-row">
                      <button
                        type="button"
                        class="seating-row-handle"
                        :class="{
                          'seating-row-handle--active': selectedRow === r,
                          'seating-seat--drop-target': dragging && dropRowTarget === r,
                        }"
                        :title="tr('第 {n} 排：点击或拖拽与另一排交换').replace('{n}', String(r + 1))"
                        :data-row-index="r"
                        @click="onRowHandleClick(r)"
                        @pointerdown="onRowPointerDown(r, $event)"
                      >
                        {{ r + 1 }}
                      </button>
                      <template v-for="(cell, i) in rowCells" :key="`${r}-${i}`">
                        <div
                          class="seating-seat"
                          :class="{
                            'seating-seat--empty': !cell.seat?.name,
                            'seating-seat--selected':
                              cell.seat && selectedSeat === cell.seat.seatNo - 1,
                            'seating-seat--boy': cell.seat?.gender === '男',
                            'seating-seat--girl': cell.seat?.gender === '女',
                            'seating-seat--drop-target':
                              dragging && cell.seat && dropSeatTarget === cell.seat.seatNo - 1,
                            'seating-seat--found': cell.seat && findHitSeatNos.has(cell.seat.seatNo),
                          }"
                          role="button"
                          tabindex="0"
                          :data-seat-no="cell.seat?.seatNo"
                          @click="onSeatClick(cell.seat)"
                          @keydown.enter.prevent="onSeatClick(cell.seat)"
                          @pointerdown="onSeatPointerDown(cell.seat, $event)"
                        >
                          <span class="seating-seat-no">{{ cell.seat?.seatNo }}</span>
                          <span class="seating-seat-name">{{ cell.seat?.name || '—' }}</span>
                        </div>
                        <div v-if="cell.aisleAfter" class="seating-aisle" aria-hidden="true"></div>
                      </template>
                    </div>
                  </div>
                  <p
                    v-if="unseatedFootnote"
                    class="seating-footnote seating-footnote--unseated"
                    data-testid="seating-preview-unseated"
                  >{{ unseatedFootnote }}</p>
                  <p class="seating-footnote">
                    {{ rows }} {{ tr('排') }} × {{ cols }} {{ tr('列') }} · {{ filledCount }} {{ personUnit }} ·
                    {{ viewMode === 'teacher' ? tr('教师视角') : tr('学生视角') }} · {{ tr('seatmark.cn 生成') }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 导出方式选择：带水印免费不限次 / 无水印计配额（口径同 /studio 与 /banquet） -->
    <ModalDialog
      :open="exportChoiceOpen"
      :title="tr('导出 PNG')"
      size="md"
      @close="exportChoiceOpen = false"
    >
      <p class="text-sm text-slate-600">
        {{ tr('带水印导出永远免费、不限次数（页脚一行 seatmark.cn 细线签名）；无水印导出今日剩余') }} {{ quota.remaining }}{{ tr('。') }}
      </p>
      <template #actions>
        <button type="button" class="btn btn-secondary btn-md" data-testid="seating-export-watermarked" @click="chooseWatermarked">
          {{ tr('带水印导出（免费）') }}
        </button>
        <button type="button" class="btn btn-primary btn-md" @click="chooseClean">
          {{ tr('无水印导出') }}
        </button>
      </template>
    </ModalDialog>

    <!-- 打印 / PNG 导出宿主：teleport 到 body离屏渲染，打印时只输出这一页，html2canvas 截取同一节点 -->
    <Teleport to="body">
      <div v-if="renderHost" class="offscreen-host">
        <div ref="exportHost" class="sheet-page seating-sheet" data-testid="seating-export-sheet">
          <h2 class="seating-title">{{ title || tr('教室座位表') }}</h2>
          <div v-if="podium === 'top'" class="seating-podium">{{ tr('讲　台') }}</div>
          <div class="seating-grid">
            <div v-for="(rowCells, r) in displayGrid" :key="r" class="seating-row">
              <template v-for="(cell, i) in rowCells" :key="`${r}-${i}`">
                <div class="seating-seat" :class="{ 'seating-seat--empty': !cell.seat?.name }">
                  <span class="seating-seat-no">{{ cell.seat?.seatNo }}</span>
                  <span class="seating-seat-name">{{ cell.seat?.name || '—' }}</span>
                </div>
                <div v-if="cell.aisleAfter" class="seating-aisle" aria-hidden="true"></div>
              </template>
            </div>
          </div>
          <p
            v-if="unseatedFootnote"
            class="seating-footnote seating-footnote--unseated"
            data-testid="seating-export-unseated"
          >{{ unseatedFootnote }}</p>
          <p class="seating-footnote">
            {{ rows }} {{ tr('排') }} × {{ cols }} {{ tr('列') }} · {{ filledCount }} {{ personUnit }} ·
            {{ viewMode === 'teacher' ? tr('教师视角') : tr('学生视角') }} · {{ tr('seatmark.cn 生成') }}
          </p>
          <div v-if="withWatermark" class="sheet-watermark" aria-hidden="true">
            SeatMark 座签 · seatmark.cn
          </div>
        </div>
      </div>
    </Teleport>
    <NextStepBar
      :step="nextStep"
      :arrange-label="tr('随机排座')"
      :progress="nextStepProgress"
      :target="nextStepTarget"
      :quota-badge="exportBadge"
      :quota-badge-title="exportBadgeTitle"
    >
      <template #secondary="{ compact }">
        <MobilePreviewJump :compact="compact" :preview="previewContainer" :settings="basicSection" inline />
      </template>
    </NextStepBar>
    <MobilePreviewJump
      :preview="previewContainer"
      :settings="basicSection"
      :avoid="namesInput"
      :avoid-near-bottom="aisleRow"
    />
  </div>
</template>

<style scoped>
/* 教室座位表：A4 横向，mm 物理单位排版，打印所见即所得 */
.seating-sheet {
  width: 297mm;
  height: 210mm;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 10mm 12mm;
  background: #ffffff;
}

.seating-title {
  text-align: center;
  font-size: 7mm;
  line-height: 1.3;
  font-weight: 700;
  color: #0f172a;
}

.seating-podium {
  margin: 4mm auto 0;
  width: 70mm;
  border: 0.4mm solid #334155;
  border-radius: 1.5mm;
  padding: 1.6mm 0;
  text-align: center;
  font-size: 4.2mm;
  font-weight: 700;
  letter-spacing: 1mm;
  color: #334155;
  background: #f1f5f9;
}

.seating-grid {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  margin-top: 3mm;
  min-height: 0;
}

.seating-row {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: stretch;
  gap: 2mm;
  min-height: 0;
}

/* 整排交换把手：仅屏幕预览显示，打印宿主不渲染 */
.seating-row-handle {
  flex: none;
  width: 6mm;
  border: 0.3mm dashed #cbd5e1;
  border-radius: 1.2mm;
  font-size: 3mm;
  font-weight: 700;
  color: #94a3b8;
  background: #f8fafc;
  cursor: grab;
  transition:
    color 0.15s,
    border-color 0.15s,
    background 0.15s;
}

.seating-row-handle:hover {
  border-color: #6366f1;
  color: #4f46e5;
  background: #eef2ff;
}

.seating-row-handle--active {
  border-style: solid;
  border-color: #4f46e5;
  color: #ffffff;
  background: #4f46e5;
}

.seating-seat {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 0.3mm solid #94a3b8;
  border-radius: 1.2mm;
  padding: 1mm 0.5mm;
  overflow: hidden;
  cursor: pointer;
}

.seating-seat--empty {
  border-style: dashed;
  color: #64748b;
  cursor: default;
}

/* 性别底色：仅作预览辅助，色值极浅、打印近似白底 */
.seating-seat--boy {
  background: #eff6ff;
}

.seating-seat--girl {
  background: #fdf2f8;
}

.seating-seat--selected {
  border-color: #4f46e5;
  border-width: 0.6mm;
  box-shadow: 0 0 0 1mm rgba(79, 70, 229, 0.18);
}

/* 鼠标拖拽时的落点高亮 */
.seating-seat--found {
  border-color: #d97706;
  border-style: solid;
  box-shadow: 0 0 0 1mm rgba(217, 119, 6, 0.35);
  background: #fffbeb;
}
.seating-seat--drop-target {
  border-color: #16a34a;
  border-style: solid;
  box-shadow: 0 0 0 1mm rgba(22, 163, 74, 0.25);
  background: #f0fdf4;
}

.seating-seat-no {
  font-size: 2.8mm;
  line-height: 1.2;
  color: #475569;
  font-weight: 600;
}

.seating-seat-name {
  max-width: 100%;
  font-size: 4mm;
  line-height: 1.25;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.seating-seat--empty .seating-seat-name {
  color: #64748b;
}

.seating-aisle {
  width: 6mm;
  flex: none;
}

.seating-footnote {
  margin-top: 2mm;
  text-align: center;
  font-size: 2.8mm;
  color: #94a3b8;
}

/* 未排座名单：页脚上方一行，深一档色标出超员事实，超长时自动换行 */
.seating-footnote--unseated {
  color: #b45309;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.seating-footnote--unseated + .seating-footnote {
  margin-top: 1mm;
}
</style>
