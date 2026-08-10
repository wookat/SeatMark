<script setup lang="ts">
import { computed, nextTick, ref, watch, watchEffect } from 'vue'
import { useRouter } from 'vue-router'

import CheckboxField from '@/components/ui/CheckboxField.vue'
import NumberField from '@/components/ui/NumberField.vue'
import SelectField, { type SelectOption } from '@/components/ui/SelectField.vue'
import { useElementSize } from '@/composables/useElementSize'
import { useToastStore } from '@/stores/toast'
import { MM_TO_PX } from '@/utils/layout'
import { setPrintPageSize } from '@/utils/paper'
import { printAndWaitUntilDone } from '@/utils/printing'
import {
  interleaveByGender,
  parseSeatingRoster,
  SEATING_HANDOFF_KEY,
  shuffleEntries,
  type SeatingEntry,
  type SeatingHandoff,
} from '@/utils/seating'

const router = useRouter()
const toast = useToastStore()

// ---------- 输入（持久化到本地，避免跨页返回丢失排座成果） ----------
const SEATING_STATE_KEY = 'seatmark.seating-state.v1'

interface SeatingPersistedState {
  title: string
  rows: number
  cols: number
  podium: 'top' | 'none'
  fillOrder: 'rows' | 'serpentine'
  aisles: number[]
  namesText: string
  arranged: SeatingEntry[] | null
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

const title = ref(persisted?.title ?? '高三（2）班 期末考试')
const rows = ref(persisted?.rows ?? 6)
const cols = ref(persisted?.cols ?? 8)
const podium = ref<'top' | 'none'>(persisted?.podium ?? 'top')
const fillOrder = ref<'rows' | 'serpentine'>(persisted?.fillOrder ?? 'rows')
/** 过道位置：第 n 列之后（1 起） */
const aisles = ref(new Set<number>(persisted?.aisles ?? []))
const namesText = ref(persisted?.namesText ?? '')

const FILL_OPTIONS: SelectOption[] = [
  { value: 'rows', label: '按行填充', hint: '从讲台侧第一排，自左向右' },
  { value: 'serpentine', label: 'S 形蛇形填充', hint: '奇数排向右、偶数排向左' },
]

const parsedEntries = computed<SeatingEntry[]>(() => parseSeatingRoster(namesText.value))

/** 手工排座结果（随机 / 拖拽后生效）；名单文本变化时失效还原 */
const arranged = ref<SeatingEntry[] | null>(persisted?.arranged ?? null)
watch(namesText, () => {
  arranged.value = null
})

watch(
  [title, rows, cols, podium, fillOrder, aisles, namesText, arranged],
  () => {
    try {
      const state: SeatingPersistedState = {
        title: title.value,
        rows: rows.value,
        cols: cols.value,
        podium: podium.value,
        fillOrder: fillOrder.value,
        aisles: [...aisles.value],
        namesText: namesText.value,
        arranged: arranged.value,
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
  const surnames = '王李张刘陈杨赵黄周吴徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭'
  const given = '伟芳娜敏静丽强磊军洋勇艳杰娟涛明超霞平刚桂英华玉兰春香才发武新利'
  const list: string[] = []
  for (let i = 0; i < rows.value * cols.value; i++) {
    const name = `${surnames[i % surnames.length]}${given[(i * 7) % given.length]}${given[(i * 13 + 5) % given.length]}`
    list.push(`${name}\t${i % 2 === 0 ? '男' : '女'}`)
  }
  namesText.value = list.join('\n')
  toast.info('已生成演示名单', `共 ${list.length} 人（含性别列），与当前行列数一致`)
}

// ---------- 随机排座 ----------
function randomizeAll() {
  if (!entries.value.length) {
    toast.warning('名单为空', '请先在左侧粘贴学生名单')
    return
  }
  arranged.value = shuffleEntries(entries.value.filter((e) => e.name))
  selectedSeat.value = null
  toast.success('已完全随机排座', '再点一次可重新打乱')
}

function randomizeMixed() {
  if (!hasGender.value) return
  arranged.value = interleaveByGender(parsedEntries.value.filter((e) => e.name))
  selectedSeat.value = null
  toast.success('已按男女混排', '相邻座位尽量男女交替')
}

function restoreOrder() {
  arranged.value = null
  selectedSeat.value = null
  toast.info('已还原为名单原始顺序')
}

// ---------- 座位计算 ----------
interface Seat {
  row: number
  col: number
  seatNo: number
  name: string
  gender?: SeatingEntry['gender']
}

const seats = computed<Seat[]>(() => {
  const out: Seat[] = []
  let idx = 0
  for (let r = 0; r < rows.value; r++) {
    for (let c = 0; c < cols.value; c++) {
      const col = fillOrder.value === 'serpentine' && r % 2 === 1 ? cols.value - 1 - c : c
      const entry = entries.value[idx]
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
})

/** 按物理行列索引取座位（渲染网格用） */
const seatGrid = computed(() => {
  const grid: (Seat | null)[][] = Array.from({ length: rows.value }, () =>
    Array.from({ length: cols.value }, () => null),
  )
  for (const seat of seats.value) grid[seat.row - 1]![seat.col - 1] = seat
  return grid
})

// ---------- 视角切换（教师视角 / 学生视角左右镜像） ----------
const viewMode = ref<'teacher' | 'student'>('teacher')

interface DisplayCell {
  seat: Seat | null
  /** 展示序中该座位之后是否跟随过道 */
  aisleAfter: boolean
}

/** 展示网格：学生视角对每排做左右镜像，过道位置随之翻转 */
const displayGrid = computed<DisplayCell[][]>(() => {
  const mirrored = viewMode.value === 'student'
  return seatGrid.value.map((rowSeats) => {
    const ordered = mirrored ? [...rowSeats].reverse() : rowSeats
    return ordered.map((seat, i) => {
      if (i === ordered.length - 1) return { seat, aisleAfter: false }
      // 物理列号：展示序第 i 格与第 i+1 格之间是否有过道
      const physCol = mirrored ? cols.value - 1 - i : i + 1
      return { seat, aisleAfter: aisles.value.has(physCol) }
    })
  })
})

// ---------- 座位交换（点选互换 + 拖拽互换，含整排交换） ----------
const selectedSeat = ref<number | null>(null)
const selectedRow = ref<number | null>(null)
const dragSeat = ref<number | null>(null)
const dragRow = ref<number | null>(null)

/** 以当前座位序生成可交换的工作数组（长度补齐到座位数） */
function workingEntries(): SeatingEntry[] {
  const out: SeatingEntry[] = []
  for (let i = 0; i < rows.value * cols.value; i++) {
    out.push(entries.value[i] ?? { name: '' })
  }
  return out
}

function swapSeats(a: number, b: number) {
  if (a === b) return
  const work = workingEntries()
  ;[work[a], work[b]] = [work[b]!, work[a]!]
  arranged.value = work
}

function swapRows(a: number, b: number) {
  if (a === b) return
  const work = workingEntries()
  const c = cols.value
  for (let i = 0; i < c; i++) {
    ;[work[a * c + i], work[b * c + i]] = [work[b * c + i]!, work[a * c + i]!]
  }
  arranged.value = work
  toast.success(`已交换第 ${a + 1} 排与第 ${b + 1} 排`)
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
  swapSeats(selectedSeat.value, idx)
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
      swapSeats(dragSeat.value, dropSeatTarget.value)
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
const overflowCount = computed(() => Math.max(filledCount.value - seatCount.value, 0))

// ---------- A4 横向预览（mm 排版 + 缩放适配容器） ----------
const SHEET_W = 297
const SHEET_H = 210
const previewContainer = ref<HTMLElement | null>(null)
const { width: containerWidth } = useElementSize(previewContainer)
/** 最小缩放下限：窄屏（如 390px）整页缩放会让座位点选目标过小，保底后靠容器横向滚动查看 */
const MIN_SCALE = 0.45
const scale = computed(() => {
  if (!containerWidth.value) return 0.5
  const fit = (containerWidth.value - 16) / (SHEET_W * MM_TO_PX)
  return Math.min(Math.max(fit, MIN_SCALE), 1)
})

watchEffect(() => {
  if (typeof document === 'undefined') return
  setPrintPageSize(SHEET_W, SHEET_H)
})

// ---------- 打印 ----------
const renderHost = ref(false)

const printPending = ref(false)

async function doPrint() {
  if (printPending.value) return
  printPending.value = true
  // 打印设置提示需让用户先看到再弹对话框：window.print 会阻塞渲染，
  // 同一任务内先 toast 再 print 不会渲染出 toast 帧，需留出展示间隔
  toast.info('即将调起浏览器打印', '请选 A4 横向、无边距、缩放 100%，并勾选「背景图形」；也可「另存为 PDF」')
  renderHost.value = true
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 1200))
  // 等 afterprint 再卸载宿主：部分浏览器 window.print 立即返回，提前卸载会打印出空白
  await printAndWaitUntilDone()
  renderHost.value = false
  printPending.value = false
}

// ---------- 一键生成对应桌贴 ----------
function toDeskLabels() {
  const filled = seats.value.filter((s) => s.name)
  if (!filled.length) {
    toast.warning('名单为空', '请先在左侧粘贴学生名单，每行一个姓名')
    return
  }
  const handoff: SeatingHandoff = {
    title: title.value,
    rows: filled.map((s) => ({
      姓名: s.name,
      座位号: String(s.seatNo),
      排: String(s.row),
      列: String(s.col),
      班级: title.value,
    })),
  }
  try {
    localStorage.setItem(SEATING_HANDOFF_KEY, JSON.stringify(handoff))
  } catch {
    toast.danger('无法暂存名单', '浏览器存储不可用，请改用 Excel 上传方式')
    return
  }
  void router.push('/studio?from=seating')
}
</script>

<template>
  <div class="mx-auto w-full max-w-[1480px] px-4 py-6 sm:py-8">
    <div class="text-center">
      <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Seating Chart</p>
      <h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        教室座位表打印
      </h1>
      <p class="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
        粘贴名单、设置行列与过道，支持随机排座（男女混排）、点选或拖拽换位、整排交换与双视角切换，
        生成 A4 教室平面座位表直接打印张贴。数据全程在浏览器本地处理。
      </p>
    </div>

    <div class="mt-6 grid items-start gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
      <!-- 设置面板 -->
      <aside class="no-print flex min-w-0 flex-col gap-4">
        <section class="panel-card">
          <h2 class="section-title"><span class="step-chip">1</span>基本信息</h2>
          <div class="mt-3 grid grid-cols-2 gap-2.5">
            <div class="col-span-2">
              <label class="field-label" for="seating-title">班级 / 考场标题</label>
              <input
                id="seating-title"
                v-model="title"
                type="text"
                class="input-field"
                placeholder="如：高三（2）班 期末考试"
              />
            </div>
            <div>
              <label class="field-label">排数（前后）</label>
              <NumberField
                aria-label="排数（前后）" v-model="rows" :min="1" :max="20" />
            </div>
            <div>
              <label class="field-label">列数（左右）</label>
              <NumberField
                aria-label="列数（左右）" v-model="cols" :min="1" :max="16" />
            </div>
            <div class="col-span-2">
              <label class="field-label">座位填充顺序</label>
              <SelectField v-model="fillOrder" :options="FILL_OPTIONS" />
            </div>
            <div class="col-span-2">
              <CheckboxField
                :model-value="podium === 'top'"
                class="text-xs font-semibold text-slate-600"
                label="顶部标注讲台位置"
                @update:model-value="podium = $event ? 'top' : 'none'"
              />
            </div>
          </div>
          <div class="mt-3">
            <label class="field-label">过道位置（点击列间隙切换）</label>
            <div class="flex flex-wrap gap-1.5">
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
                第 {{ n }}-{{ n + 1 }} 列间
              </button>
            </div>
          </div>
        </section>

        <section class="panel-card">
          <div class="panel-head">
            <h2 class="section-title"><span class="step-chip">2</span>学生名单</h2>
            <button type="button" class="btn btn-ghost btn-sm" @click="loadDemoNames">
              用演示名单
            </button>
          </div>
          <textarea
            v-model="namesText"
            rows="10"
            class="input-field mt-2 h-auto min-h-40 resize-y py-2 leading-6"
            placeholder="每行一个姓名，可附性别列（空格/逗号分隔）：&#10;张伟 男&#10;李娜 女&#10;王芳……"
          ></textarea>
          <p class="mt-2 text-xs leading-5 text-slate-600">
            已输入 <strong class="text-slate-700">{{ filledCount }}</strong> 人 / 座位
            <strong class="text-slate-700">{{ seatCount }}</strong> 个。
            <span v-if="overflowCount" class="font-bold text-amber-600">
              超出 {{ overflowCount }} 人排不下，请增加行列数。
            </span>
          </p>
        </section>

        <section class="panel-card">
          <h2 class="section-title"><span class="step-chip">3</span>随机排座</h2>
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
              完全随机
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              :disabled="!hasGender"
              :title="hasGender ? '相邻座位尽量男女交替' : '名单需包含性别列（如：张伟 男）'"
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
              男女混排
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              :disabled="!arranged"
              @click="restoreOrder"
            >
              还原名单顺序
            </button>
          </div>
          <p class="mt-2 text-xs leading-5 text-slate-600">
            男女混排需名单包含性别列（每行「姓名 性别」）。预览中可
            <strong class="text-slate-600">点选两个座位互换</strong>，桌面鼠标还可直接按住座位拖拽交换；
            触屏设备请用点选方式。点击（桌面也可拖拽）行首「排」把手可整排交换。
          </p>
        </section>

        <section class="panel-card">
          <h2 class="section-title"><span class="step-chip">4</span>输出</h2>
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
              打印座位表（A4 横向）
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
              一键生成对应桌贴
            </button>
            <p class="text-xs leading-5 text-slate-600">
              「生成桌贴」会把这份名单（含座位号、排、列）带入标签工坊，选模板即可批量输出课桌贴。
            </p>
          </div>
        </section>
      </aside>

      <!-- 预览 -->
      <div class="no-print min-w-0">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div
            class="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-bold"
            role="group"
            aria-label="视角切换"
          >
            <button
              type="button"
              class="rounded-md px-3 py-1.5 transition-colors"
              :class="viewMode === 'teacher' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:text-brand-600'"
              @click="viewMode = 'teacher'"
            >
              教师视角
            </button>
            <button
              type="button"
              class="rounded-md px-3 py-1.5 transition-colors"
              :class="viewMode === 'student' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:text-brand-600'"
              @click="viewMode = 'student'"
            >
              学生视角（镜像）
            </button>
          </div>
          <p v-if="selectedSeat != null || selectedRow != null" class="text-xs font-semibold text-brand-600">
            {{ selectedRow != null ? `已选中第 ${selectedRow + 1} 排，点另一排把手交换` : '已选中座位，点另一个座位交换' }}
          </p>
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
                  <h2 class="seating-title">{{ title || '教室座位表' }}</h2>
                  <div v-if="podium === 'top'" class="seating-podium">讲　台</div>
                  <div class="seating-grid">
                    <div v-for="(rowCells, r) in displayGrid" :key="r" class="seating-row">
                      <button
                        type="button"
                        class="seating-row-handle"
                        :class="{
                          'seating-row-handle--active': selectedRow === r,
                          'seating-seat--drop-target': dragging && dropRowTarget === r,
                        }"
                        :title="`第 ${r + 1} 排：点击或拖拽与另一排交换`"
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
                  <p class="seating-footnote">
                    共 {{ rows }} 排 × {{ cols }} 列 · {{ filledCount }} 人 ·
                    {{ viewMode === 'teacher' ? '教师视角' : '学生视角' }} · seatmark.cn 生成
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 打印宿主：teleport 到 body，打印时只输出这一页 -->
    <Teleport to="body">
      <div v-if="renderHost" class="offscreen-host">
        <div class="sheet-page seating-sheet">
          <h2 class="seating-title">{{ title || '教室座位表' }}</h2>
          <div v-if="podium === 'top'" class="seating-podium">讲　台</div>
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
          <p class="seating-footnote">
            共 {{ rows }} 排 × {{ cols }} 列 · {{ filledCount }} 人 ·
            {{ viewMode === 'teacher' ? '教师视角' : '学生视角' }} · seatmark.cn 生成
          </p>
        </div>
      </div>
    </Teleport>
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
  color: #cbd5e1;
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
  color: #cbd5e1;
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
</style>
