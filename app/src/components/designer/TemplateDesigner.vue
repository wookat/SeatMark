<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue'

import AiDesignDialog from '@/components/designer/AiDesignDialog.vue'
import IconPickerDialog from '@/components/designer/IconPickerDialog.vue'
import LabelCard from '@/components/label/LabelCard.vue'
import FontPicker from '@/components/studio/FontPicker.vue'
import CheckboxField from '@/components/ui/CheckboxField.vue'
import ColorField from '@/components/ui/ColorField.vue'
import NumberField from '@/components/ui/NumberField.vue'
import SelectField, { type SelectOption } from '@/components/ui/SelectField.vue'
import { useElementSize } from '@/composables/useElementSize'
import { useIsMobile } from '@/composables/useMediaQuery'
import { useFontsStore } from '@/stores/fonts'
import { useTemplateLibrary } from '@/stores/templateLibrary'
import { useToastStore } from '@/stores/toast'
import type {
  FieldType,
  LabelTemplate,
  TemplateField,
  TextAlign,
  VerticalAlign,
} from '@/types/template'
import type { AiDesignResult } from '@/utils/aiDesign'
import { uid } from '@/utils/id'
import { centerLayout, clamp, cloneTemplate, fitToPaper, layoutOverflow, MM_TO_PX } from '@/utils/layout'
import { matchPaperPreset, PAPER_PRESETS, paperLabel } from '@/utils/paper'

const props = defineProps<{ initial: LabelTemplate }>()
const emit = defineEmits<{
  close: []
  save: [template: LabelTemplate, asNew: boolean]
}>()

const library = useTemplateLibrary()
const toast = useToastStore()
const fonts = useFontsStore()

const isMobile = useIsMobile()
const mobilePanel = ref<null | 'layers' | 'props'>(null)

const draft = ref(cloneTemplate(props.initial))
const pxPerMm = ref(6)
const logoInput = ref<HTMLInputElement | null>(null)

// ---------- 选中状态（支持 Ctrl/Shift 多选） ----------
const selectedIds = ref<string[]>(draft.value.fields[0] ? [draft.value.fields[0].id] : [])
/** 恰好选中一个字段时的 id：属性面板与缩放手柄仅在单选时生效 */
const selectedId = computed(() => (selectedIds.value.length === 1 ? (selectedIds.value[0] ?? null) : null))

function isSelected(id: string): boolean {
  return selectedIds.value.includes(id)
}

function isSoleSelected(id: string): boolean {
  return selectedIds.value.length === 1 && selectedIds.value[0] === id
}

function selectOnly(id: string) {
  selectedIds.value = [id]
}

function toggleSelect(id: string) {
  selectedIds.value = isSelected(id)
    ? selectedIds.value.filter((x) => x !== id)
    : [...selectedIds.value, id]
}

function clearSelection() {
  selectedIds.value = []
}

function onFieldListClick(id: string, event: MouseEvent) {
  if (event.ctrlKey || event.metaKey || event.shiftKey) toggleSelect(id)
  else selectOnly(id)
  // 移动端从字段列表选中后直接切到属性面板，免去再找入口
  if (isMobile.value && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    mobilePanel.value = 'props'
  }
}

// 编辑的模板可能引用了在线字体，进入设计器时后台补载
fonts.ensureTemplateFonts(draft.value)

/** 纸张规格（A3 / A4 / A5 × 横竖向）：切换后自动重算行列并居中 */
const paperId = computed({
  get: () => matchPaperPreset(draft.value.page)?.id ?? 'custom',
  set: (id: string) => {
    const preset = PAPER_PRESETS.find((p) => p.id === id)
    if (!preset) return
    draft.value.page.paperWidth = preset.width
    draft.value.page.paperHeight = preset.height
    fitToPaper(draft.value)
  },
})
const isCustomPaper = computed(() => paperId.value === 'custom')
const currentPaperLabel = computed(() => paperLabel(draft.value.page))

// ---------- 画布缩放（自动适应 + 步进加减） ----------
const ZOOM_MIN = 1
const ZOOM_MAX = 20

const canvasViewport = ref<HTMLElement | null>(null)
const { width: viewportWidth, height: viewportHeight } = useElementSize(canvasViewport)

/** 相对实际打印尺寸的百分比（pxPerMm = MM_TO_PX 时为 100%） */
const zoomPercent = computed(() => Math.round((pxPerMm.value / MM_TO_PX) * 100))

function setZoom(value: number) {
  pxPerMm.value = clamp(Math.round(value * 10) / 10, ZOOM_MIN, ZOOM_MAX)
}

function zoomIn() {
  setZoom(pxPerMm.value * 1.25)
}

function zoomOut() {
  setZoom(pxPerMm.value / 1.25)
}

function zoomReset() {
  setZoom(MM_TO_PX)
}

/** 适应窗口：按画布可视区域自动选择缩放比例 */
function zoomFit() {
  const w = viewportWidth.value || canvasViewport.value?.clientWidth || 0
  const h = viewportHeight.value || canvasViewport.value?.clientHeight || 0
  if (!w || !h) return
  const PADDING = 96
  setZoom(
    Math.min((w - PADDING) / draft.value.label.width, (h - PADDING) / draft.value.label.height),
  )
}

// 首次测得画布区域尺寸后自动适配一次
let autoFitted = false
watch(viewportWidth, (w) => {
  if (!autoFitted && w > 0) {
    autoFitted = true
    zoomFit()
  }
})

/** Ctrl/Cmd + 滚轮缩放画布 */
function onCanvasWheel(event: WheelEvent) {
  if (!(event.ctrlKey || event.metaKey)) return
  event.preventDefault()
  if (event.deltaY > 0) zoomOut()
  else zoomIn()
}

// ---------- 下拉选项 ----------
const TEXT_SOURCE_OPTIONS: SelectOption[] = [
  { value: 'excel', label: 'Excel 数据列（每枚不同）' },
  { value: 'fixed', label: '固定文本（每枚相同）' },
]

const IMAGE_SOURCE_OPTIONS: SelectOption[] = [
  { value: 'matched', label: '按匹配列照片（每枚不同）' },
  { value: 'static', label: '固定图片 / Logo（每枚相同）' },
]

const ALIGN_OPTIONS: SelectOption[] = [
  { value: 'left', label: '左' },
  { value: 'center', label: '居中' },
  { value: 'right', label: '右' },
]

const VALIGN_OPTIONS: SelectOption[] = [
  { value: 'top', label: '上' },
  { value: 'middle', label: '居中' },
  { value: 'bottom', label: '下' },
]

const paperOptions = computed<SelectOption[]>(() => {
  const options: SelectOption[] = PAPER_PRESETS.map((p) => ({
    value: p.id,
    label: p.label,
    hint: `${p.width} × ${p.height} mm`,
  }))
  if (isCustomPaper.value) {
    options.push({
      value: 'custom',
      label: `自定义（${draft.value.page.paperWidth} × ${draft.value.page.paperHeight}）`,
      disabled: true,
    })
  }
  return options
})

function setAlign(value: string) {
  if (selectedField.value) selectedField.value.align = value as TextAlign
}

function setVerticalAlign(value: string) {
  if (selectedField.value) selectedField.value.verticalAlign = value as VerticalAlign
}

const isEditingCustom = computed(() => library.isCustom(draft.value.id))
const selectedField = computed<TemplateField | null>(
  () => draft.value.fields.find((f) => f.id === selectedId.value) ?? null,
)
/** 当前选中的全部字段（多选操作：对齐 / 复制 / 删除 / 整体拖动） */
const selectedFields = computed<TemplateField[]>(() =>
  draft.value.fields.filter((f) => isSelected(f.id)),
)

/** 文本字段内容来源：Excel 映射列 or 固定文本 */
const textSource = computed({
  get: () => (selectedField.value?.fixedText != null ? 'fixed' : 'excel'),
  set: (value: string) => {
    const field = selectedField.value
    if (!field) return
    if (value === 'fixed') field.fixedText = field.fixedText ?? field.sample ?? '固定文本'
    else field.fixedText = undefined
  },
})

/** 标签名前缀（如“姓名”→ 渲染为“姓名 张三”），空串视为未设置 */
const captionModel = computed({
  get: () => selectedField.value?.caption ?? '',
  set: (value: string) => {
    const field = selectedField.value
    if (!field) return
    field.caption = value.trim() ? value.trim() : undefined
  },
})

/** 图片字段内容来源：按列匹配照片 or 固定图片（Logo） */
const imageSource = computed({
  get: () => (selectedField.value?.imageSrc != null ? 'static' : 'matched'),
  set: (value: string) => {
    const field = selectedField.value
    if (!field) return
    if (value === 'static') field.imageSrc = field.imageSrc ?? ''
    else field.imageSrc = undefined
  },
})

const hasBackground = computed({
  get: () => !!selectedField.value?.background,
  set: (value: boolean) => {
    const field = selectedField.value
    if (!field) return
    field.background = value ? (field.background ?? '#f1f5f9') : undefined
  },
})

function onLogoUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  const field = selectedField.value
  if (!file || !field) return
  if (file.size > 400 * 1024) {
    toast.warning('图片偏大', '建议使用 400KB 以内的图片，避免模板与导出体积过大')
  }
  const reader = new FileReader()
  reader.onload = () => {
    field.imageSrc = String(reader.result)
  }
  reader.readAsDataURL(file)
}
const overflow = computed(() => layoutOverflow(draft.value))
const hasOverflow = computed(() => overflow.value.x > 0 || overflow.value.y > 0)

// ---------- 历史记录（撤销 / 重做） ----------
/**
 * 快照式历史：深度监听 draft，停止操作 300ms 后把整个模板序列化入栈，
 * 拖拽 / 连续输入会被合并成一步，符合“每个操作一档”的直觉。
 */
const HISTORY_LIMIT = 100
const SNAPSHOT_DELAY = 300

const history = ref<string[]>([JSON.stringify(draft.value)])
const historyIndex = ref(0)
let applyingHistory = false
let snapshotTimer: number | undefined

const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)

watch(
  draft,
  () => {
    if (applyingHistory) return
    window.clearTimeout(snapshotTimer)
    snapshotTimer = window.setTimeout(() => {
      snapshotTimer = undefined
      pushSnapshot()
    }, SNAPSHOT_DELAY)
  },
  { deep: true },
)

function pushSnapshot() {
  const snap = JSON.stringify(draft.value)
  if (snap === history.value[historyIndex.value]) return
  // 在历史中间产生新改动时丢弃“重做”分支
  const next = history.value.slice(0, historyIndex.value + 1)
  next.push(snap)
  if (next.length > HISTORY_LIMIT) next.shift()
  history.value = next
  historyIndex.value = next.length - 1
}

/** 把尚未落档的改动立即入栈（撤销/重做前调用，保证不丢步） */
function flushPendingSnapshot() {
  if (snapshotTimer != null) {
    window.clearTimeout(snapshotTimer)
    snapshotTimer = undefined
    pushSnapshot()
  }
}

function applySnapshot(index: number) {
  const snap = history.value[index]
  if (snap == null) return
  applyingHistory = true
  historyIndex.value = index
  draft.value = JSON.parse(snap) as LabelTemplate
  // 恢复后剔除已不存在的选中字段
  const validIds = new Set(draft.value.fields.map((f) => f.id))
  selectedIds.value = selectedIds.value.filter((id) => validIds.has(id))
  void nextTick(() => {
    applyingHistory = false
  })
}

function undo() {
  flushPendingSnapshot()
  if (canUndo.value) applySnapshot(historyIndex.value - 1)
}

function redo() {
  flushPendingSnapshot()
  if (canRedo.value) applySnapshot(historyIndex.value + 1)
}

const MIN_SIZE_MM = 3

// ---------- 画布几何 ----------
const stageStyle = computed<CSSProperties>(() => ({
  width: `${draft.value.label.width * pxPerMm.value}px`,
  height: `${draft.value.label.height * pxPerMm.value}px`,
  '--designer-mm': `${pxPerMm.value}px`,
}))

const visualScale = computed(() => pxPerMm.value / MM_TO_PX)

function fieldBoxStyle(field: TemplateField): CSSProperties {
  return {
    left: `${field.x * pxPerMm.value}px`,
    top: `${field.y * pxPerMm.value}px`,
    width: `${field.width * pxPerMm.value}px`,
    height: `${field.height * pxPerMm.value}px`,
  }
}

// ---------- 拖拽与缩放 ----------
type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

interface DragState {
  mode: 'move' | 'resize'
  dir?: ResizeDir
  fieldId: string
  startClientX: number
  startClientY: number
  startX: number
  startY: number
  startW: number
  startH: number
  /** 多选整体移动：拖拽开始时所有选中字段的初始几何 */
  group: Array<{ id: string; x: number; y: number; width: number; height: number }>
}

let drag: DragState | null = null

const snap = (v: number) => Math.round(v * 2) / 2

// ---------- 智能对齐（PPT 式参考线吸附） ----------
/** 吸附判定距离（屏幕像素，换算成 mm 后随缩放变化） */
const SNAP_TOLERANCE_PX = 6
/** 当前命中的参考线位置（mm），用于画布上的红色提示线 */
const activeGuides = ref<{ v: number | null; h: number | null }>({ v: null, h: null })

/** 候选参考线：标签边缘与中线 + 其他字段的边缘与中线（排除正在拖动的字段组） */
function alignmentGuides(excludeIds: ReadonlySet<string>): { v: number[]; h: number[] } {
  const { width: labelW, height: labelH } = draft.value.label
  const v = [0, labelW / 2, labelW]
  const h = [0, labelH / 2, labelH]
  for (const f of draft.value.fields) {
    if (excludeIds.has(f.id)) continue
    v.push(f.x, f.x + f.width / 2, f.x + f.width)
    h.push(f.y, f.y + f.height / 2, f.y + f.height)
  }
  return { v, h }
}

/**
 * 把 raw（字段原点坐标）按锚点集合吸附到最近的参考线。
 * anchors 是相对原点的偏移（如 [0, w/2, w] 表示左 / 中 / 右）。
 */
function snapToGuides(
  raw: number,
  anchors: number[],
  guides: number[],
  tolerance: number,
): { value: number; guide: number | null } {
  let best: { value: number; guide: number; dist: number } | null = null
  for (const guide of guides) {
    for (const anchor of anchors) {
      const dist = Math.abs(raw + anchor - guide)
      if (dist <= tolerance && (!best || dist < best.dist)) {
        best = { value: guide - anchor, guide, dist }
      }
    }
  }
  return best ? { value: best.value, guide: best.guide } : { value: raw, guide: null }
}

function beginDrag(field: TemplateField, event: PointerEvent, mode: 'move' | 'resize', dir?: ResizeDir) {
  if (mode === 'move' && (event.ctrlKey || event.metaKey || event.shiftKey)) {
    // 修饰键点击 = 切换多选，不进入拖拽
    toggleSelect(field.id)
    return
  }
  // 点击未选中的字段 → 单选；点击已选中的字段 → 保留多选并整体拖动
  if (!isSelected(field.id)) selectOnly(field.id)
  drag = {
    mode,
    dir,
    fieldId: field.id,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startX: field.x,
    startY: field.y,
    startW: field.width,
    startH: field.height,
    group:
      mode === 'move'
        ? selectedFields.value.map((f) => ({
            id: f.id,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
          }))
        : [],
  }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (!drag) return
  const field = draft.value.fields.find((f) => f.id === drag!.fieldId)
  if (!field) return

  const dx = (event.clientX - drag.startClientX) / pxPerMm.value
  const dy = (event.clientY - drag.startClientY) / pxPerMm.value
  const labelW = draft.value.label.width
  const labelH = draft.value.label.height
  const tolerance = SNAP_TOLERANCE_PX / pxPerMm.value
  const guides = alignmentGuides(
    new Set(drag.mode === 'move' && drag.group.length ? drag.group.map((g) => g.id) : [field.id]),
  )

  if (drag.mode === 'move') {
    const rawX = clamp(drag.startX + dx, 0, Math.max(labelW - field.width, 0))
    const rawY = clamp(drag.startY + dy, 0, Math.max(labelH - field.height, 0))
    // 左 / 中 / 右（上 / 中 / 下）三条锚线分别尝试吸附，命中参考线时用精确值，否则落回 0.5mm 网格
    const sx = snapToGuides(rawX, [0, field.width / 2, field.width], guides.v, tolerance)
    const sy = snapToGuides(rawY, [0, field.height / 2, field.height], guides.h, tolerance)
    const anchorX = clamp(sx.guide != null ? sx.value : snap(rawX), 0, Math.max(labelW - field.width, 0))
    const anchorY = clamp(sy.guide != null ? sy.value : snap(rawY), 0, Math.max(labelH - field.height, 0))

    // 以锚点字段的位移为基准整体移动选中组，并约束整组不出画布
    const group = drag.group.length ? drag.group : [{ id: field.id, x: drag.startX, y: drag.startY, width: field.width, height: field.height }]
    const minX = Math.min(...group.map((g) => g.x))
    const minY = Math.min(...group.map((g) => g.y))
    const maxRight = Math.max(...group.map((g) => g.x + g.width))
    const maxBottom = Math.max(...group.map((g) => g.y + g.height))
    const deltaX = clamp(anchorX - drag.startX, -minX, Math.max(labelW - maxRight, -minX))
    const deltaY = clamp(anchorY - drag.startY, -minY, Math.max(labelH - maxBottom, -minY))
    for (const member of group) {
      const target = draft.value.fields.find((f) => f.id === member.id)
      if (!target) continue
      target.x = member.x + deltaX
      target.y = member.y + deltaY
    }
    activeGuides.value = { v: sx.guide, h: sy.guide }
    return
  }

  const dir = drag.dir ?? 'se'
  let vGuide: number | null = null
  let hGuide: number | null = null

  if (dir.includes('e')) {
    const rawEdge = drag.startX + drag.startW + dx
    const s = snapToGuides(rawEdge, [0], guides.v, tolerance)
    const edge = s.guide != null ? s.value : snap(rawEdge)
    field.width = clamp(edge - drag.startX, MIN_SIZE_MM, labelW - drag.startX)
    vGuide = s.guide
  }
  if (dir.includes('s')) {
    const rawEdge = drag.startY + drag.startH + dy
    const s = snapToGuides(rawEdge, [0], guides.h, tolerance)
    const edge = s.guide != null ? s.value : snap(rawEdge)
    field.height = clamp(edge - drag.startY, MIN_SIZE_MM, labelH - drag.startY)
    hGuide = s.guide
  }
  if (dir.includes('w')) {
    const rawX = drag.startX + dx
    const s = snapToGuides(rawX, [0], guides.v, tolerance)
    const newX = clamp(
      s.guide != null ? s.value : snap(rawX),
      0,
      drag.startX + drag.startW - MIN_SIZE_MM,
    )
    field.width = drag.startX + drag.startW - newX
    field.x = newX
    vGuide = s.guide
  }
  if (dir.includes('n')) {
    const rawY = drag.startY + dy
    const s = snapToGuides(rawY, [0], guides.h, tolerance)
    const newY = clamp(
      s.guide != null ? s.value : snap(rawY),
      0,
      drag.startY + drag.startH - MIN_SIZE_MM,
    )
    field.height = drag.startY + drag.startH - newY
    field.y = newY
    hGuide = s.guide
  }
  activeGuides.value = { v: vGuide, h: hGuide }
}

function endDrag() {
  drag = null
  activeGuides.value = { v: null, h: null }
}

const HANDLES: Array<{ dir: ResizeDir; class: string }> = [
  { dir: 'nw', class: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize' },
  { dir: 'n', class: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize' },
  { dir: 'ne', class: 'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize' },
  { dir: 'e', class: 'top-1/2 right-0 translate-x-1/2 -translate-y-1/2 cursor-ew-resize' },
  { dir: 'se', class: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize' },
  { dir: 's', class: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize' },
  { dir: 'sw', class: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize' },
  { dir: 'w', class: 'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize' },
]

// ---------- 键盘操作 ----------
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    addMenuOpen.value = false
    aiOpen.value = false
    iconPickerOpen.value = false
    return
  }
  // 对话框打开时不响应画布快捷键（方向键 / Delete）
  if (aiOpen.value || iconPickerOpen.value) return
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return

  // 撤销 / 重做（输入框内保留浏览器原生行为）
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    if (event.shiftKey) redo()
    else undo()
    event.preventDefault()
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
    redo()
    event.preventDefault()
    return
  }

  // 缩放快捷键
  if ((event.ctrlKey || event.metaKey) && (event.key === '=' || event.key === '+')) {
    zoomIn()
    event.preventDefault()
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.key === '-') {
    zoomOut()
    event.preventDefault()
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.key === '0') {
    zoomFit()
    event.preventDefault()
    return
  }

  // 复制 / 全选
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
    duplicateSelected()
    event.preventDefault()
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
    selectedIds.value = draft.value.fields.map((f) => f.id)
    event.preventDefault()
    return
  }

  const fields = selectedFields.value
  if (!fields.length) return

  const step = event.shiftKey ? 2 : 0.5
  const labelW = draft.value.label.width
  const labelH = draft.value.label.height

  switch (event.key) {
    case 'ArrowLeft':
      for (const f of fields) f.x = snap(clamp(f.x - step, 0, Math.max(labelW - f.width, 0)))
      break
    case 'ArrowRight':
      for (const f of fields) f.x = snap(clamp(f.x + step, 0, Math.max(labelW - f.width, 0)))
      break
    case 'ArrowUp':
      for (const f of fields) f.y = snap(clamp(f.y - step, 0, Math.max(labelH - f.height, 0)))
      break
    case 'ArrowDown':
      for (const f of fields) f.y = snap(clamp(f.y + step, 0, Math.max(labelH - f.height, 0)))
      break
    case 'Delete':
    case 'Backspace':
      removeSelected()
      break
    default:
      return
  }
  event.preventDefault()
}

function onDocPointerDown(event: PointerEvent) {
  if (
    addMenuOpen.value &&
    addMenuRoot.value &&
    !addMenuRoot.value.contains(event.target as Node) &&
    !addMenuEl.value?.contains(event.target as Node)
  ) {
    addMenuOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('pointerdown', onDocPointerDown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.removeEventListener('pointerdown', onDocPointerDown)
  window.clearTimeout(snapshotTimer)
})

// ---------- 预设字段库 ----------
const addMenuOpen = ref(false)
const addMenuRoot = ref<HTMLElement | null>(null)
const addMenuEl = ref<HTMLElement | null>(null)
// 菜单 teleport 到 body 后用 fixed 定位：否则会被工具栏 overflow-x-auto 裁切不可见
const addMenuPos = ref({ left: 0, top: 0 })

function toggleAddMenu() {
  if (!addMenuOpen.value && addMenuRoot.value) {
    const rect = addMenuRoot.value.getBoundingClientRect()
    const menuWidth = 208
    addMenuPos.value = {
      left: Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8)),
      top: rect.bottom + 4,
    }
  }
  addMenuOpen.value = !addMenuOpen.value
}

/** 文本类预设的公共默认值 */
function presetText(id: string, label: string, overrides: Partial<TemplateField>): TemplateField {
  return {
    id,
    label,
    type: 'text',
    x: 5,
    y: 5,
    width: 30,
    height: 8,
    fontSize: 10,
    fontWeight: 'normal',
    align: 'center',
    verticalAlign: 'middle',
    color: '#475569',
    padding: 0.5,
    lineHeight: 1.15,
    maxLines: 1,
    ...overrides,
  }
}

interface FieldPreset {
  /** 首选字段 id（与表头自动映射规则对应，重复时自动加后缀） */
  key: string
  name: string
  tag: '文' | '图' | '固定' | '形'
  make: (id: string) => TemplateField
}

const FIELD_PRESETS: FieldPreset[] = [
  {
    key: 'seatNo',
    name: '座位号',
    tag: '文',
    make: (id) =>
      presetText(id, '座位号', {
        width: 20,
        height: 14,
        fontSize: 26,
        fontWeight: 'bold',
        color: '#0f172a',
        padding: 0,
        lineHeight: 1,
        emphasis: 'hero',
        sample: '12',
      }),
  },
  {
    key: 'name',
    name: '姓名（带标签名）',
    tag: '文',
    make: (id) =>
      presetText(id, '姓名', {
        height: 10,
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
        letterSpacing: 0.05,
        caption: '姓名',
        sample: '张同学',
      }),
  },
  {
    key: 'room',
    name: '考场（带标签名）',
    tag: '文',
    make: (id) => presetText(id, '考场', { caption: '考场', sample: '第1考场' }),
  },
  {
    key: 'examId',
    name: '准考证号（带标签名）',
    tag: '文',
    make: (id) =>
      presetText(id, '准考证号', {
        width: 40,
        letterSpacing: 0.06,
        caption: '准考证号',
        sample: '2026061001',
      }),
  },
  {
    key: 'gender',
    name: '性别（带标签名）',
    tag: '文',
    make: (id) => presetText(id, '性别', { width: 18, caption: '性别', sample: '男' }),
  },
  {
    key: 'idCard',
    name: '身份证号（带标签名）',
    tag: '文',
    make: (id) =>
      presetText(id, '身份证号', {
        width: 48,
        fontSize: 9,
        letterSpacing: 0.03,
        caption: '身份证号',
        sample: '110101200803150017',
      }),
  },
  {
    key: 'className',
    name: '班级（带标签名）',
    tag: '文',
    make: (id) => presetText(id, '班级', { caption: '班级', sample: '高三（2）班' }),
  },
  {
    key: 'studentId',
    name: '学号（带标签名）',
    tag: '文',
    make: (id) =>
      presetText(id, '学号', {
        width: 40,
        letterSpacing: 0.06,
        caption: '学号',
        sample: '2024030112',
      }),
  },
  {
    key: 'school',
    name: '学校 / 单位',
    tag: '文',
    make: (id) => presetText(id, '学校', { width: 40, sample: '市第一中学' }),
  },
  {
    key: 'caption',
    name: '提示语',
    tag: '固定',
    make: (id) =>
      presetText(id, '提示语', {
        width: 42,
        height: 6,
        fontSize: 8,
        color: '#94a3b8',
        letterSpacing: 0.2,
        fixedText: '请对号入座 · PLEASE BE SEATED',
      }),
  },
  {
    key: 'divider',
    name: '分隔线',
    tag: '固定',
    make: (id) =>
      presetText(id, '分隔线', {
        height: 0.3,
        padding: 0,
        fixedText: '',
        background: '#cbd5e1',
      }),
  },
  {
    key: 'photo',
    name: '照片（按列匹配）',
    tag: '图',
    make: (id) => ({
      id,
      label: '照片',
      type: 'image',
      x: 5,
      y: 5,
      width: 20,
      height: 26,
      radius: 0,
      borderWidth: 0.2,
      borderColor: '#94a3b8',
      sample: 'photo',
    }),
  },
  {
    key: 'logo',
    name: '固定图片 / Logo',
    tag: '图',
    make: (id) => ({
      id,
      label: 'Logo',
      type: 'image',
      x: 5,
      y: 5,
      width: 16,
      height: 16,
      imageSrc: '',
      sample: 'photo',
    }),
  },
]

/** 形状预设：用色块字段实现（fixedText 为空串 → 不参与映射与缺失高亮） */
const SHAPE_PRESETS: FieldPreset[] = [
  {
    key: 'rect',
    name: '矩形色块',
    tag: '形',
    make: (id) =>
      presetText(id, '矩形', { width: 22, height: 12, fixedText: '', background: '#e2e8f0', padding: 0 }),
  },
  {
    key: 'circle',
    name: '圆形色块',
    tag: '形',
    make: (id) =>
      presetText(id, '圆形', {
        width: 14,
        height: 14,
        radius: 7,
        fixedText: '',
        background: '#e0e7ff',
        padding: 0,
      }),
  },
  {
    key: 'vline',
    name: '竖直分隔线',
    tag: '形',
    make: (id) =>
      presetText(id, '竖线', { width: 0.3, height: 20, fixedText: '', background: '#cbd5e1', padding: 0 }),
  },
]

// ---------- 矢量图标 ----------
const iconPickerOpen = ref(false)

function openIconPicker() {
  addMenuOpen.value = false
  iconPickerOpen.value = true
}

function addIconField(payload: { name: string; dataUrl: string }) {
  const id = uid('icon')
  const offset = (draft.value.fields.length % 5) * 2
  const field: TemplateField = {
    id,
    label: `图标 · ${payload.name}`,
    type: 'image',
    x: snap(clamp(5 + offset, 0, Math.max(draft.value.label.width - 10, 0))),
    y: snap(clamp(5 + offset, 0, Math.max(draft.value.label.height - 10, 0))),
    width: 10,
    height: 10,
    imageSrc: payload.dataUrl,
    sample: 'photo',
  }
  draft.value.fields.push(field)
  selectOnly(id)
  iconPickerOpen.value = false
}

function addPreset(preset: FieldPreset) {
  const id = draft.value.fields.some((f) => f.id === preset.key) ? uid(preset.key) : preset.key
  const field = preset.make(id)
  // 依字段数量小幅错位，避免连续添加时完全重叠
  const offset = (draft.value.fields.length % 5) * 2
  field.x = snap(clamp(field.x + offset, 0, Math.max(draft.value.label.width - field.width, 0)))
  field.y = snap(clamp(field.y + offset, 0, Math.max(draft.value.label.height - field.height, 0)))
  draft.value.fields.push(field)
  selectOnly(id)
  addMenuOpen.value = false
}

// ---------- 字段管理 ----------
function addField(type: FieldType) {
  const id = uid(type === 'image' ? 'photo' : 'text')
  const field: TemplateField =
    type === 'image'
      ? { id, label: '照片', type, x: 5, y: 5, width: 20, height: 25, radius: 1, sample: 'photo' }
      : {
          id,
          label: '新字段',
          type,
          x: 5,
          y: 5,
          width: 30,
          height: 10,
          fontSize: 12,
          fontWeight: 'normal',
          align: 'center',
          verticalAlign: 'middle',
          padding: 0.8,
          lineHeight: 1.15,
          maxLines: 1,
          sample: '示例文本',
        }
  draft.value.fields.push(field)
  selectOnly(id)
  addMenuOpen.value = false
}

function removeField(id: string) {
  draft.value.fields = draft.value.fields.filter((f) => f.id !== id)
  selectedIds.value = selectedIds.value.filter((x) => x !== id)
}

function removeSelected() {
  if (!selectedIds.value.length) return
  const ids = new Set(selectedIds.value)
  draft.value.fields = draft.value.fields.filter((f) => !ids.has(f.id))
  selectedIds.value = []
}

/** 复制选中字段：副本偏移 2mm 放置并接管选中 */
function duplicateSelected() {
  const fields = selectedFields.value
  if (!fields.length) return
  const labelW = draft.value.label.width
  const labelH = draft.value.label.height
  const clones = fields.map((f) => {
    const clone = JSON.parse(JSON.stringify(f)) as TemplateField
    clone.id = uid(f.type === 'image' ? 'photo' : 'field')
    clone.x = snap(clamp(f.x + 2, 0, Math.max(labelW - f.width, 0)))
    clone.y = snap(clamp(f.y + 2, 0, Math.max(labelH - f.height, 0)))
    return clone
  })
  draft.value.fields.push(...clones)
  selectedIds.value = clones.map((c) => c.id)
}

/**
 * 对齐：单选时相对标签画布；多选时相对选区包围盒，
 * 例如「左对齐」把所有选中字段的左缘对齐到选区最左。
 */
function alignField(mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') {
  const fields = selectedFields.value
  if (!fields.length) return
  const labelW = draft.value.label.width
  const labelH = draft.value.label.height

  if (fields.length === 1) {
    const field = fields[0]!
    if (mode === 'left') field.x = 0
    else if (mode === 'center') field.x = snap(Math.max((labelW - field.width) / 2, 0))
    else if (mode === 'right') field.x = snap(Math.max(labelW - field.width, 0))
    else if (mode === 'top') field.y = 0
    else if (mode === 'middle') field.y = snap(Math.max((labelH - field.height) / 2, 0))
    else field.y = snap(Math.max(labelH - field.height, 0))
    return
  }

  const minX = Math.min(...fields.map((f) => f.x))
  const minY = Math.min(...fields.map((f) => f.y))
  const maxRight = Math.max(...fields.map((f) => f.x + f.width))
  const maxBottom = Math.max(...fields.map((f) => f.y + f.height))
  for (const f of fields) {
    if (mode === 'left') f.x = minX
    else if (mode === 'center') f.x = (minX + maxRight) / 2 - f.width / 2
    else if (mode === 'right') f.x = maxRight - f.width
    else if (mode === 'top') f.y = minY
    else if (mode === 'middle') f.y = (minY + maxBottom) / 2 - f.height / 2
    else f.y = maxBottom - f.height
  }
}

/** 工具栏对齐按钮（图标为 16 viewBox 内的对齐示意线） */
const ALIGN_ACTIONS = [
  { mode: 'left', title: '左对齐', icon: 'M2.5 2v12M4.5 4.5h9M4.5 9.5h5.5' },
  { mode: 'center', title: '水平居中', icon: 'M8 2v12M3 4.5h10M4.5 9.5h7' },
  { mode: 'right', title: '右对齐', icon: 'M13.5 2v12M2.5 4.5h9M6 9.5h5.5' },
  { mode: 'top', title: '顶对齐', icon: 'M2 2.5h12M4.5 4.5v9M9.5 4.5v5.5' },
  { mode: 'middle', title: '垂直居中', icon: 'M2 8h12M4.5 3v10M9.5 4.5v7' },
  { mode: 'bottom', title: '底对齐', icon: 'M2 13.5h12M4.5 2.5v9M9.5 6v5.5' },
] as const

// ---------- AI 自动设计 ----------
const aiOpen = ref(false)

/** 当前数据字段 → 「字段名: 示例」预填文本（固定文本与装饰字段不参与） */
const aiPrefill = computed(() =>
  draft.value.fields
    .filter((f) => f.fixedText == null)
    .map((f) =>
      f.type === 'image' ? `${f.label || '照片'}:` : `${f.label || f.id}: ${f.sample ?? ''}`,
    )
    .join('\n'),
)

function applyAiDesign(payload: { width: number; height: number; result: AiDesignResult }) {
  draft.value.label.width = payload.width
  draft.value.label.height = payload.height
  Object.assign(draft.value.label, payload.result.label)
  if (payload.result.showLabelBorder !== undefined) {
    draft.value.showLabelBorder = payload.result.showLabelBorder
  }
  draft.value.fields = payload.result.fields
  fitToPaper(draft.value)
  selectedIds.value = draft.value.fields[0] ? [draft.value.fields[0].id] : []
  aiOpen.value = false
  zoomFit()
  toast.success('AI 设计已生成', '已按新版式重排页面，可继续拖拽微调')
}

// ---------- 表单辅助 ----------
function setFieldNumber(
  prop: 'x' | 'y' | 'width' | 'height' | 'fontSize' | 'padding' | 'lineHeight' | 'maxLines' | 'radius' | 'borderWidth' | 'letterSpacing',
  value: number,
) {
  const field = selectedField.value
  if (!field) return
  if (prop === 'maxLines') field.maxLines = Math.round(clamp(value, 1, 6))
  else if (prop === 'fontSize') field.fontSize = clamp(value, 4, 120)
  else if (prop === 'lineHeight') field.lineHeight = clamp(value, 0.8, 3)
  else if (prop === 'letterSpacing')
    field.letterSpacing = Math.round(clamp(value, -0.2, 2) * 100) / 100
  else if (prop === 'borderWidth')
    field.borderWidth = Math.round(clamp(value, 0.05, 2) * 100) / 100
  else field[prop] = snap(Math.max(value, 0))
}

function setLabelNumber(prop: 'width' | 'height' | 'radius', value: number) {
  if (prop === 'radius') draft.value.label.radius = snap(clamp(value, 0, 20))
  else draft.value.label[prop] = snap(clamp(value, 10, 420))
}

function setPageNumber(
  prop: 'rows' | 'cols' | 'gapX' | 'gapY' | 'marginTop' | 'marginBottom' | 'marginLeft' | 'marginRight',
  value: number,
) {
  if (prop === 'rows') draft.value.page.rows = Math.round(clamp(value, 1, 30))
  else if (prop === 'cols') draft.value.page.cols = Math.round(clamp(value, 1, 12))
  else draft.value.page[prop] = snap(clamp(value, 0, 100))
}

// ---------- 保存 ----------
function save(asNew: boolean) {
  if (!draft.value.name.trim()) {
    toast.warning('模板名称不能为空', '请先给模板取一个便于区分的名字')
    return
  }
  if (!draft.value.fields.length) {
    toast.warning('模板没有任何字段', '请至少添加一个文本或照片字段')
    return
  }
  emit('save', cloneTemplate(draft.value), asNew)
}
</script>

<template>
  <div class="no-print fixed inset-0 z-50 flex flex-col bg-slate-50">
    <header
      class="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 shadow-card sm:px-4"
    >
      <div class="flex min-w-0 items-center gap-2 sm:gap-3">
        <!-- 移动端侧栏切换：字段列表 -->
        <button
          v-if="isMobile"
          type="button"
          class="btn btn-ghost btn-sm !px-2"
          :class="{ 'bg-slate-100 text-brand-600': mobilePanel === 'layers' }"
          aria-label="字段列表"
          @click="mobilePanel = mobilePanel === 'layers' ? null : 'layers'"
        >
          <svg class="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
          </svg>
        </button>
        <!-- 移动端侧栏切换：字段属性（放头部始终可见，不随工具栏横向滚动藏到屏外） -->
        <button
          v-if="isMobile"
          type="button"
          class="btn btn-ghost btn-sm !px-2"
          :class="{ 'bg-slate-100 text-brand-600': mobilePanel === 'props' }"
          aria-label="属性面板"
          @click="mobilePanel = mobilePanel === 'props' ? null : 'props'"
        >
          <svg class="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.5 2.5h4v4M13.5 2.5 8.5 7.5M6.5 13.5h-4v-4M2.5 13.5l5-5" />
          </svg>
        </button>
        <span class="hidden text-sm font-bold text-slate-600 sm:inline">模板设计器</span>
        <input
          v-model="draft.name"
          type="text"
          class="input-field w-32 font-semibold sm:w-56"
          placeholder="模板名称"
        />
      </div>
      <div class="flex items-center gap-1.5 sm:gap-2">
        <button type="button" class="btn btn-ghost btn-sm sm:btn-md" @click="emit('close')">取消</button>
        <template v-if="isEditingCustom">
          <button type="button" class="btn btn-secondary btn-sm sm:btn-md" @click="save(true)">
            另存
          </button>
          <button type="button" class="btn btn-primary btn-sm sm:btn-md" @click="save(false)">
            保存
          </button>
        </template>
        <button v-else type="button" class="btn btn-primary btn-sm sm:btn-md" @click="save(true)">
          保存
        </button>
      </div>
    </header>

    <!-- 工具栏 -->
    <div
      class="flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3"
    >
      <div ref="addMenuRoot" class="relative shrink-0">
        <button type="button" class="btn btn-secondary btn-sm" @click="toggleAddMenu">
          + 添加字段
          <svg
            class="size-3 transition-transform"
            :class="{ 'rotate-180': addMenuOpen }"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m4 6 4 4 4-4" />
          </svg>
        </button>
        <Teleport to="body">
        <div
          v-if="addMenuOpen"
          ref="addMenuEl"
          class="fixed z-[70] max-h-80 w-52 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1.5 shadow-pop"
          :style="{ left: `${addMenuPos.left}px`, top: `${addMenuPos.top}px` }"
        >
          <p class="px-2 pt-1 pb-0.5 text-[10px] font-bold tracking-wider text-slate-600">
            常用考务字段
          </p>
          <button
            v-for="preset in FIELD_PRESETS"
            :key="preset.key"
            type="button"
            class="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
            @click="addPreset(preset)"
          >
            {{ preset.name }}
            <span
              class="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-bold text-slate-600"
            >
              {{ preset.tag }}
            </span>
          </button>
          <p class="px-2 pt-2 pb-0.5 text-[10px] font-bold tracking-wider text-slate-600">
            形状与图标
          </p>
          <button
            v-for="preset in SHAPE_PRESETS"
            :key="preset.key"
            type="button"
            class="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
            @click="addPreset(preset)"
          >
            {{ preset.name }}
            <span
              class="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-bold text-slate-600"
            >
              {{ preset.tag }}
            </span>
          </button>
          <button
            type="button"
            class="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
            @click="openIconPicker"
          >
            矢量图标库…
            <span
              class="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-bold text-slate-600"
            >
              图
            </span>
          </button>
          <p class="px-2 pt-2 pb-0.5 text-[10px] font-bold tracking-wider text-slate-600">
            空白字段
          </p>
          <button
            type="button"
            class="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
            @click="addField('text')"
          >
            空白文本
            <span
              class="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-bold text-slate-600"
            >
              文
            </span>
          </button>
          <button
            type="button"
            class="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
            @click="addField('image')"
          >
            空白照片
            <span
              class="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-bold text-slate-600"
            >
              图
            </span>
          </button>
        </div>
        </Teleport>
      </div>

      <span class="mx-1.5 h-5 w-px shrink-0 bg-slate-200"></span>

      <button
        type="button"
        class="btn btn-ghost btn-sm shrink-0 !px-1.5"
        :disabled="!canUndo"
        title="撤销（Ctrl+Z）"
        aria-label="撤销"
        @click="undo"
      >
        <svg
          class="size-4"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M6 3.5 2.5 7 6 10.5" />
          <path d="M2.5 7h7a4 4 0 0 1 0 8H7" />
        </svg>
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-sm shrink-0 !px-1.5"
        :disabled="!canRedo"
        title="重做（Ctrl+Shift+Z / Ctrl+Y）"
        aria-label="重做"
        @click="redo"
      >
        <svg
          class="size-4"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m10 3.5 3.5 3.5-3.5 3.5" />
          <path d="M13.5 7h-7a4 4 0 0 0 0 8H9" />
        </svg>
      </button>

      <span class="mx-1.5 h-5 w-px shrink-0 bg-slate-200"></span>

      <button
        type="button"
        class="btn btn-ghost btn-sm shrink-0 !px-1.5"
        :disabled="!selectedIds.length"
        title="复制选中字段（Ctrl+D）"
        aria-label="复制选中字段"
        @click="duplicateSelected"
      >
        <svg
          class="size-4"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
          <path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
        </svg>
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-sm shrink-0 !px-1.5"
        :disabled="!selectedIds.length"
        title="删除选中字段（Delete）"
        aria-label="删除选中字段"
        @click="removeSelected"
      >
        <svg
          class="size-4"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M2.5 4h11M5.5 4V2.5h5V4M4 4l.7 9a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4M6.5 7v4M9.5 7v4" />
        </svg>
      </button>

      <span class="mx-1.5 h-5 w-px shrink-0 bg-slate-200"></span>

      <button
        v-for="action in ALIGN_ACTIONS"
        :key="action.mode"
        type="button"
        class="btn btn-ghost btn-sm shrink-0 !px-1.5"
        :disabled="!selectedIds.length"
        :title="`${action.title}（多选时按选区对齐）`"
        :aria-label="action.title"
        @click="alignField(action.mode)"
      >
        <svg
          class="size-4"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        >
          <path :d="action.icon" />
        </svg>
      </button>

      <span class="flex-1"></span>

      <button type="button" class="btn btn-secondary btn-sm shrink-0" @click="aiOpen = true">
        <svg
          class="size-4 text-brand-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z" />
          <path d="M18.5 14.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3z" />
        </svg>
        AI 自动设计
      </button>

      <span class="mx-1.5 h-5 w-px shrink-0 bg-slate-200"></span>

      <div class="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          class="btn btn-ghost btn-sm !px-1.5"
          :disabled="pxPerMm <= ZOOM_MIN"
          title="缩小（Ctrl+-）"
          aria-label="缩小"
          @click="zoomOut"
        >
          <svg
            class="size-4"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          >
            <path d="M3.5 8h9" />
          </svg>
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-sm w-14 !px-1 text-xs tabular-nums"
          title="点击重置为 100%（实际打印大小）"
          @click="zoomReset"
        >
          {{ zoomPercent }}%
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-sm !px-1.5"
          :disabled="pxPerMm >= ZOOM_MAX"
          title="放大（Ctrl++）"
          aria-label="放大"
          @click="zoomIn"
        >
          <svg
            class="size-4"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          >
            <path d="M8 3.5v9M3.5 8h9" />
          </svg>
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-sm !px-1.5"
          title="适应窗口（Ctrl+0，也可 Ctrl+滚轮缩放）"
          aria-label="适应窗口"
          @click="zoomFit"
        >
          <svg
            class="size-4"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M6 2.5H2.5V6M10 2.5h3.5V6M6 13.5H2.5V10M10 13.5h3.5V10" />
          </svg>
        </button>
      </div>

    </div>

    <div class="relative flex min-h-0 flex-1">
      <!-- 字段列表（图层） -->
      <aside
        class="flex shrink-0 flex-col border-r border-slate-200 bg-white"
        :class="isMobile ? 'absolute inset-y-0 left-0 z-30 w-64 max-w-[80vw] shadow-pop transition-transform' : 'w-56'"
        :style="isMobile ? { transform: mobilePanel === 'layers' ? 'translateX(0)' : 'translateX(-100%)' } : {}"
      >
        <div class="flex shrink-0 items-center justify-between border-b border-slate-100 px-3 py-2.5">
          <h3 class="text-xs font-bold text-slate-700">字段</h3>
          <span class="text-[10px] font-semibold text-slate-600">{{ draft.fields.length }} 个</span>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto p-2">
          <ul v-if="draft.fields.length" class="grid gap-1">
            <li
              v-for="field in draft.fields"
              :key="field.id"
              class="flex cursor-pointer items-center justify-between rounded-lg border px-2 py-1.5 text-xs"
              :class="
                isSelected(field.id)
                  ? 'border-brand-400 bg-brand-50 font-bold text-brand-700'
                  : 'border-slate-200 text-slate-600 hover:border-brand-200'
              "
              @click="onFieldListClick(field.id, $event)"
            >
              <span class="flex min-w-0 items-center gap-1.5">
                <span
                  class="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-bold text-slate-600"
                >
                  {{ field.type === 'image' ? '图' : '文' }}
                </span>
                <span class="truncate">{{ field.label || field.id }}</span>
              </span>
              <button
                type="button"
                class="shrink-0 cursor-pointer text-slate-300 hover:text-red-500"
                aria-label="删除字段"
                @click.stop="removeField(field.id)"
              >
                ✕
              </button>
            </li>
          </ul>
          <p
            v-else
            class="m-1 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-3 text-center text-[11px] leading-4 text-slate-600"
          >
            还没有字段<br />点击工具栏「+ 添加字段」开始
          </p>
        </div>
        <p class="shrink-0 border-t border-slate-100 px-3 py-2 text-[10px] leading-4 text-slate-600">
          点击选中 · Ctrl+点击多选 · Ctrl+A 全选 · Ctrl+D 复制 · Delete 删除
        </p>
      </aside>

      <!-- 画布 -->
      <div
        ref="canvasViewport"
        class="flex-1 overflow-auto bg-slate-100/70 bg-[radial-gradient(circle,#cbd5e1_1px,transparent_1px)] bg-[size:16px_16px]"
        @pointerdown.self="clearSelection(); isMobile && (mobilePanel = null)"
        @wheel="onCanvasWheel"
      >
        <div class="grid min-h-full w-full place-items-center p-10">
          <div>
            <div
              class="designer-grid relative border border-slate-300 bg-white shadow-pop"
              :style="stageStyle"
              @pointerdown.self="clearSelection()"
            >
              <div
                class="pointer-events-none absolute top-0 left-0 origin-top-left"
                :style="{ transform: `scale(${visualScale})` }"
              >
                <LabelCard :template="draft" sample-mode />
              </div>

              <!-- 智能对齐参考线（拖拽/缩放吸附时显示） -->
              <div
                v-if="activeGuides.v != null"
                class="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-red-500/80"
                :style="{ left: `${activeGuides.v * pxPerMm}px` }"
              ></div>
              <div
                v-if="activeGuides.h != null"
                class="pointer-events-none absolute right-0 left-0 z-30 h-px bg-red-500/80"
                :style="{ top: `${activeGuides.h * pxPerMm}px` }"
              ></div>

              <div
                v-for="field in draft.fields"
                :key="field.id"
                class="absolute touch-none select-none"
                :class="
                  isSelected(field.id)
                    ? 'z-10 cursor-move outline-2 outline-brand-500'
                    : 'cursor-move outline-1 outline-dashed outline-transparent hover:outline-brand-300'
                "
                :style="fieldBoxStyle(field)"
                @pointerdown.stop="beginDrag(field, $event, 'move')"
                @pointermove="onPointerMove"
                @pointerup="endDrag"
                @pointercancel="endDrag"
              >
                <template v-if="isSoleSelected(field.id)">
                  <span
                    v-for="handle in HANDLES"
                    :key="handle.dir"
                    class="absolute z-20 size-2 rounded-full border border-white bg-brand-600 shadow"
                    :class="handle.class"
                    @pointerdown.stop="beginDrag(field, $event, 'resize', handle.dir)"
                    @pointermove="onPointerMove"
                    @pointerup="endDrag"
                    @pointercancel="endDrag"
                  ></span>
                  <span
                    class="absolute -top-6 left-0 rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-white"
                  >
                    {{ field.label }} · {{ field.x }},{{ field.y }} · {{ field.width }}×{{ field.height }}mm
                  </span>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 属性面板 -->
      <aside
        class="shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4"
        :class="isMobile ? 'absolute inset-y-0 right-0 z-30 w-72 max-w-[85vw] shadow-pop transition-transform' : 'w-80'"
        :style="isMobile ? { transform: mobilePanel === 'props' ? 'translateX(0)' : 'translateX(100%)' } : {}"
      >
        <!-- 选中字段属性 -->
        <p
          v-if="!selectedField"
          class="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-3 text-[11px] leading-4 text-slate-600"
        >
          {{
            selectedIds.length > 1
              ? `已选中 ${selectedIds.length} 个字段：可在工具栏对齐、复制或删除，拖动任一字段整体移动`
              : '在画布或左侧列表中选中一个字段后，在这里编辑它的内容与样式（Ctrl+点击可多选）'
          }}
        </p>
        <div v-if="selectedField">
          <h3 class="text-xs font-bold text-slate-700">
            字段属性 · {{ selectedField.label || selectedField.id }}
          </h3>

          <div class="mt-2 grid grid-cols-2 gap-2">
            <div class="col-span-2">
              <label class="field-label">显示名称</label>
              <input v-model="selectedField.label" type="text" class="input-field" aria-label="显示名称" />
            </div>

            <div v-if="selectedField.type === 'text'" class="col-span-2">
              <label class="field-label">内容来源</label>
              <SelectField v-model="textSource" :options="TEXT_SOURCE_OPTIONS" />
            </div>
            <div
              v-if="selectedField.type === 'text' && textSource === 'fixed'"
              class="col-span-2"
            >
              <label class="field-label">固定文本内容</label>
              <input
                v-model="selectedField.fixedText"
                type="text"
                class="input-field"
                aria-label="固定文本内容"
                placeholder="如：请对号入座 / 学校名称"
              />
            </div>
            <div
              v-else-if="selectedField.type === 'text'"
              class="col-span-2"
            >
              <label class="field-label">示例内容（仅预览用）</label>
              <input v-model="selectedField.sample" type="text" class="input-field" aria-label="示例内容（仅预览用）" />
            </div>

            <div v-if="selectedField.type === 'text'" class="col-span-2">
              <label class="field-label">标签名前缀（可选）</label>
              <input
                v-model="captionModel"
                type="text"
                class="input-field"
                aria-label="标签名前缀（可选）"
                placeholder="如填“姓名”则渲染为：姓名 张三"
              />
            </div>

            <div v-if="selectedField.type === 'image'" class="col-span-2">
              <label class="field-label">图片来源</label>
              <SelectField v-model="imageSource" :options="IMAGE_SOURCE_OPTIONS" />
              <div v-if="imageSource === 'static'" class="mt-2 flex items-center gap-2">
                <img
                  v-if="selectedField.imageSrc"
                  :src="selectedField.imageSrc"
                  class="size-10 border border-slate-200 bg-white object-contain"
                  alt="已上传的图片素材预览"
                />
                <button type="button" class="btn btn-secondary btn-sm" @click="logoInput?.click()">
                  上传图片
                </button>
                <button
                  v-if="selectedField.imageSrc"
                  type="button"
                  class="btn btn-ghost btn-sm"
                  @click="selectedField.imageSrc = ''"
                >
                  移除
                </button>
              </div>
              <p v-else class="mt-1 text-[11px] leading-4 text-slate-600">
                照片在工坊「字段映射 → 照片匹配」中按列批量上传
              </p>
              <input
                ref="logoInput"
                type="file"
                accept="image/*"
                class="hidden"
                @change="onLogoUpload"
              />
            </div>

            <p
              class="col-span-2 mt-1.5 flex items-center gap-2 text-[10px] font-bold tracking-wider text-slate-600"
            >
              位置与尺寸
              <span class="h-px flex-1 bg-slate-100"></span>
            </p>
            <div>
              <label class="field-label">X (mm)</label>
              <NumberField
                aria-label="X (mm)"
                :model-value="selectedField.x"
                :step="0.5"
                :min="0"
                @update:model-value="setFieldNumber('x', $event)"
              />
            </div>
            <div>
              <label class="field-label">Y (mm)</label>
              <NumberField
                aria-label="Y (mm)"
                :model-value="selectedField.y"
                :step="0.5"
                :min="0"
                @update:model-value="setFieldNumber('y', $event)"
              />
            </div>
            <div>
              <label class="field-label">宽 (mm)</label>
              <NumberField
                aria-label="宽 (mm)"
                :model-value="selectedField.width"
                :step="0.5"
                :min="0"
                @update:model-value="setFieldNumber('width', $event)"
              />
            </div>
            <div>
              <label class="field-label">高 (mm)</label>
              <NumberField
                aria-label="高 (mm)"
                :model-value="selectedField.height"
                :step="0.5"
                :min="0"
                @update:model-value="setFieldNumber('height', $event)"
              />
            </div>
          </div>

          <template v-if="selectedField.type === 'text'">
            <div class="mt-2 grid grid-cols-2 gap-2">
              <p
                class="col-span-2 mt-1.5 flex items-center gap-2 text-[10px] font-bold tracking-wider text-slate-600"
              >
                文字样式
                <span class="h-px flex-1 bg-slate-100"></span>
              </p>
              <div class="col-span-2">
                <label class="field-label">中文字体（默认跟随模板）</label>
                <FontPicker v-model="selectedField.fontFamily" lang="zh" default-label="跟随模板字体" />
              </div>
              <div class="col-span-2">
                <label class="field-label">西文字体（英文/数字）</label>
                <FontPicker v-model="selectedField.fontFamilyEn" lang="en" default-label="跟随模板字体" />
              </div>
              <div>
                <label class="field-label">字号 (pt)</label>
                <NumberField
                  aria-label="字号 (pt)"
                  :model-value="selectedField.fontSize ?? 12"
                  :step="0.5"
                  :min="4"
                  :max="120"
                  @update:model-value="setFieldNumber('fontSize', $event)"
                />
              </div>
              <div>
                <label class="field-label">颜色</label>
                <ColorField v-model="selectedField.color" />
              </div>
              <div>
                <label class="field-label">水平对齐</label>
                <SelectField
                  :model-value="selectedField.align ?? 'center'"
                  :options="ALIGN_OPTIONS"
                  @update:model-value="setAlign"
                />
              </div>
              <div>
                <label class="field-label">垂直对齐</label>
                <SelectField
                  :model-value="selectedField.verticalAlign ?? 'middle'"
                  :options="VALIGN_OPTIONS"
                  @update:model-value="setVerticalAlign"
                />
              </div>
              <div>
                <label class="field-label">最多行数</label>
                <NumberField
                  aria-label="最多行数"
                  :model-value="selectedField.maxLines ?? 1"
                  :min="1"
                  :max="6"
                  @update:model-value="setFieldNumber('maxLines', $event)"
                />
              </div>
              <div>
                <label class="field-label">内边距 (mm)</label>
                <NumberField
                  aria-label="内边距 (mm)"
                  :model-value="selectedField.padding ?? 0.8"
                  :step="0.2"
                  :min="0"
                  @update:model-value="setFieldNumber('padding', $event)"
                />
              </div>
              <div>
                <label class="field-label">字距 (em)</label>
                <NumberField
                  aria-label="字距 (em)"
                  :model-value="selectedField.letterSpacing ?? 0"
                  :step="0.02"
                  :min="-0.2"
                  :max="2"
                  @update:model-value="setFieldNumber('letterSpacing', $event)"
                />
              </div>
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
              <CheckboxField
                :model-value="selectedField.fontWeight === 'bold'"
                label="加粗"
                @update:model-value="selectedField.fontWeight = $event ? 'bold' : 'normal'"
              />
              <CheckboxField
                :model-value="selectedField.emphasis === 'hero'"
                label="特大强调（座位号）"
                @update:model-value="selectedField.emphasis = $event ? 'hero' : undefined"
              />
            </div>
          </template>

          <div class="mt-2 grid grid-cols-2 gap-2">
            <p
              class="col-span-2 mt-1.5 flex items-center gap-2 text-[10px] font-bold tracking-wider text-slate-600"
            >
              外观
              <span class="h-px flex-1 bg-slate-100"></span>
            </p>
            <div class="col-span-2 flex items-center gap-3 text-xs font-semibold text-slate-600">
              <CheckboxField v-model="selectedField.border" label="显示边框" />
              <CheckboxField v-model="hasBackground" label="填充背景" />
            </div>
            <div v-if="hasBackground">
              <label class="field-label">背景色</label>
              <ColorField v-model="selectedField.background" fallback="#ffffff" />
            </div>
            <template v-if="selectedField.border">
              <div>
                <label class="field-label">边框宽 (mm)</label>
                <NumberField
                  aria-label="边框宽 (mm)"
                  :model-value="selectedField.borderWidth ?? 0.2"
                  :step="0.05"
                  :min="0.05"
                  :max="2"
                  @update:model-value="setFieldNumber('borderWidth', $event)"
                />
              </div>
              <div>
                <label class="field-label">边框色</label>
                <ColorField v-model="selectedField.borderColor" />
              </div>
            </template>
            <div>
              <label class="field-label">圆角 (mm)</label>
              <NumberField
                aria-label="圆角 (mm)"
                :model-value="selectedField.radius ?? 0"
                :step="0.5"
                :min="0"
                @update:model-value="setFieldNumber('radius', $event)"
              />
            </div>
          </div>
        </div>

        <!-- 标签与页面 -->
        <div class="mt-4 border-t border-slate-100 pt-4">
          <h3 class="text-xs font-bold text-slate-700">标签与页面</h3>
          <div class="mt-2 grid grid-cols-2 gap-2">
            <div class="col-span-2">
              <label class="field-label">纸张规格</label>
              <SelectField v-model="paperId" :options="paperOptions" />
            </div>
            <div class="col-span-2">
              <label class="field-label">模板中文字体</label>
              <FontPicker v-model="draft.fontFamily" lang="zh" default-label="宋体（系统默认）" />
            </div>
            <div class="col-span-2">
              <label class="field-label">模板西文字体（英文/数字）</label>
              <FontPicker v-model="draft.fontFamilyEn" lang="en" default-label="跟随中文字体" />
            </div>
            <div>
              <label class="field-label">标签宽 (mm)</label>
              <NumberField
                aria-label="标签宽 (mm)"
                :model-value="draft.label.width"
                :min="10"
                :max="420"
                @update:model-value="setLabelNumber('width', $event)"
              />
            </div>
            <div>
              <label class="field-label">标签高 (mm)</label>
              <NumberField
                aria-label="标签高 (mm)"
                :model-value="draft.label.height"
                :min="10"
                :max="420"
                @update:model-value="setLabelNumber('height', $event)"
              />
            </div>
            <div>
              <label class="field-label">标签圆角 (mm)</label>
              <NumberField
                aria-label="标签圆角 (mm)"
                :model-value="draft.label.radius ?? 0"
                :step="0.5"
                :min="0"
                :max="20"
                @update:model-value="setLabelNumber('radius', $event)"
              />
            </div>
            <div>
              <label class="field-label">列 × 行</label>
              <div class="flex items-center gap-1">
                <NumberField
                  class="flex-1"
                  aria-label="列数"
                  :model-value="draft.page.cols"
                  :min="1"
                  :max="12"
                  @update:model-value="setPageNumber('cols', $event)"
                />
                <span class="text-slate-300">×</span>
                <NumberField
                  class="flex-1"
                  aria-label="行数"
                  :model-value="draft.page.rows"
                  :min="1"
                  :max="30"
                  @update:model-value="setPageNumber('rows', $event)"
                />
              </div>
            </div>
            <div>
              <label class="field-label">横向间距 (mm)</label>
              <NumberField
                aria-label="横向间距 (mm)"
                :model-value="draft.page.gapX"
                :step="0.5"
                :min="0"
                :max="100"
                @update:model-value="setPageNumber('gapX', $event)"
              />
            </div>
            <div>
              <label class="field-label">纵向间距 (mm)</label>
              <NumberField
                aria-label="纵向间距 (mm)"
                :model-value="draft.page.gapY"
                :step="0.5"
                :min="0"
                :max="100"
                @update:model-value="setPageNumber('gapY', $event)"
              />
            </div>
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
            <CheckboxField v-model="draft.showLabelBorder" label="标签边框" />
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              @click="centerLayout(draft)"
            >
              阵列居中
            </button>
          </div>
          <div class="mt-2">
            <label class="field-label">模板说明</label>
            <input v-model="draft.description" type="text" class="input-field" aria-label="模板说明" />
          </div>
        </div>
      </aside>
    </div>

    <!-- 状态栏 -->
    <footer
      class="flex h-8 shrink-0 items-center gap-x-4 overflow-x-auto border-t border-slate-200 bg-white px-4 text-[11px] whitespace-nowrap text-slate-600"
      tabindex="0"
      aria-label="设计器状态栏"
    >
      <span>{{ currentPaperLabel }}</span>
      <span>标签 {{ draft.label.width }} × {{ draft.label.height }} mm</span>
      <span>
        {{ draft.page.cols }} 列 × {{ draft.page.rows }} 行 ·
        {{ draft.page.cols * draft.page.rows }} 枚/页
      </span>
      <span v-if="hasOverflow" class="font-bold text-red-600">
        超出{{ currentPaperLabel }}：<template v-if="overflow.x > 0">横向 {{ overflow.x }}mm </template>
        <template v-if="overflow.y > 0">纵向 {{ overflow.y }}mm</template>
      </span>
      <span class="min-w-0 flex-1"></span>
      <span v-if="selectedField" class="font-semibold text-slate-600">
        {{ selectedField.label || selectedField.id }} · X {{ selectedField.x }} · Y
        {{ selectedField.y }} · {{ selectedField.width }} × {{ selectedField.height }} mm
      </span>
      <span v-else-if="selectedIds.length > 1" class="font-semibold text-brand-600">
        已选 {{ selectedIds.length }} 个字段 · 可整体拖动 / 对齐 / 复制 / 删除
      </span>
      <span v-else class="hidden text-slate-600 md:inline">
        拖拽自动吸附参考线 · Ctrl+点击多选 · 方向键微调 0.5mm（Shift = 2mm） · Delete 删除字段
      </span>
    </footer>

    <AiDesignDialog
      :open="aiOpen"
      :label-width="draft.label.width"
      :label-height="draft.label.height"
      :prefill="aiPrefill"
      @close="aiOpen = false"
      @apply="applyAiDesign"
    />

    <IconPickerDialog
      :open="iconPickerOpen"
      @close="iconPickerOpen = false"
      @pick="addIconField"
    />
  </div>
</template>
