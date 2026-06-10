<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, type CSSProperties } from 'vue'

import LabelCard from '@/components/label/LabelCard.vue'
import FontPicker from '@/components/studio/FontPicker.vue'
import { useFontsStore } from '@/stores/fonts'
import { useTemplateLibrary } from '@/stores/templateLibrary'
import { useToastStore } from '@/stores/toast'
import type { FieldType, LabelTemplate, TemplateField } from '@/types/template'
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

const draft = ref(cloneTemplate(props.initial))
const selectedId = ref<string | null>(draft.value.fields[0]?.id ?? null)
const pxPerMm = ref(6)
const logoInput = ref<HTMLInputElement | null>(null)

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

const isEditingCustom = computed(() => library.isCustom(draft.value.id))
const selectedField = computed<TemplateField | null>(
  () => draft.value.fields.find((f) => f.id === selectedId.value) ?? null,
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
}

let drag: DragState | null = null

const snap = (v: number) => Math.round(v * 2) / 2

// ---------- 智能对齐（PPT 式参考线吸附） ----------
/** 吸附判定距离（屏幕像素，换算成 mm 后随缩放变化） */
const SNAP_TOLERANCE_PX = 6
/** 当前命中的参考线位置（mm），用于画布上的红色提示线 */
const activeGuides = ref<{ v: number | null; h: number | null }>({ v: null, h: null })

/** 候选参考线：标签边缘与中线 + 其他字段的边缘与中线 */
function alignmentGuides(excludeId: string): { v: number[]; h: number[] } {
  const { width: labelW, height: labelH } = draft.value.label
  const v = [0, labelW / 2, labelW]
  const h = [0, labelH / 2, labelH]
  for (const f of draft.value.fields) {
    if (f.id === excludeId) continue
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
  selectedId.value = field.id
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
  const guides = alignmentGuides(field.id)

  if (drag.mode === 'move') {
    const rawX = clamp(drag.startX + dx, 0, Math.max(labelW - field.width, 0))
    const rawY = clamp(drag.startY + dy, 0, Math.max(labelH - field.height, 0))
    // 左 / 中 / 右（上 / 中 / 下）三条锚线分别尝试吸附，命中参考线时用精确值，否则落回 0.5mm 网格
    const sx = snapToGuides(rawX, [0, field.width / 2, field.width], guides.v, tolerance)
    const sy = snapToGuides(rawY, [0, field.height / 2, field.height], guides.h, tolerance)
    field.x = clamp(sx.guide != null ? sx.value : snap(rawX), 0, Math.max(labelW - field.width, 0))
    field.y = clamp(sy.guide != null ? sy.value : snap(rawY), 0, Math.max(labelH - field.height, 0))
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
    return
  }
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return
  const field = selectedField.value
  if (!field) return

  const step = event.shiftKey ? 2 : 0.5
  const labelW = draft.value.label.width
  const labelH = draft.value.label.height

  switch (event.key) {
    case 'ArrowLeft':
      field.x = snap(clamp(field.x - step, 0, Math.max(labelW - field.width, 0)))
      break
    case 'ArrowRight':
      field.x = snap(clamp(field.x + step, 0, Math.max(labelW - field.width, 0)))
      break
    case 'ArrowUp':
      field.y = snap(clamp(field.y - step, 0, Math.max(labelH - field.height, 0)))
      break
    case 'ArrowDown':
      field.y = snap(clamp(field.y + step, 0, Math.max(labelH - field.height, 0)))
      break
    case 'Delete':
    case 'Backspace':
      removeField(field.id)
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
    !addMenuRoot.value.contains(event.target as Node)
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
})

// ---------- 预设字段库 ----------
const addMenuOpen = ref(false)
const addMenuRoot = ref<HTMLElement | null>(null)

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
  tag: '文' | '图' | '固定'
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

function addPreset(preset: FieldPreset) {
  const id = draft.value.fields.some((f) => f.id === preset.key) ? uid(preset.key) : preset.key
  const field = preset.make(id)
  // 依字段数量小幅错位，避免连续添加时完全重叠
  const offset = (draft.value.fields.length % 5) * 2
  field.x = snap(clamp(field.x + offset, 0, Math.max(draft.value.label.width - field.width, 0)))
  field.y = snap(clamp(field.y + offset, 0, Math.max(draft.value.label.height - field.height, 0)))
  draft.value.fields.push(field)
  selectedId.value = id
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
  selectedId.value = id
  addMenuOpen.value = false
}

function removeField(id: string) {
  draft.value.fields = draft.value.fields.filter((f) => f.id !== id)
  if (selectedId.value === id) selectedId.value = null
}

function alignField(mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') {
  const field = selectedField.value
  if (!field) return
  const labelW = draft.value.label.width
  const labelH = draft.value.label.height
  if (mode === 'left') field.x = 0
  else if (mode === 'center') field.x = snap(Math.max((labelW - field.width) / 2, 0))
  else if (mode === 'right') field.x = snap(Math.max(labelW - field.width, 0))
  else if (mode === 'top') field.y = 0
  else if (mode === 'middle') field.y = snap(Math.max((labelH - field.height) / 2, 0))
  else field.y = snap(Math.max(labelH - field.height, 0))
}

// ---------- 表单辅助 ----------
function numberFrom(event: Event): number {
  return Number((event.target as HTMLInputElement).value) || 0
}

function setFieldNumber(
  prop: 'x' | 'y' | 'width' | 'height' | 'fontSize' | 'padding' | 'lineHeight' | 'maxLines' | 'radius' | 'borderWidth' | 'letterSpacing',
  event: Event,
) {
  const field = selectedField.value
  if (!field) return
  const value = numberFrom(event)
  if (prop === 'maxLines') field.maxLines = Math.round(clamp(value, 1, 6))
  else if (prop === 'fontSize') field.fontSize = clamp(value, 4, 120)
  else if (prop === 'lineHeight') field.lineHeight = clamp(value, 0.8, 3)
  else if (prop === 'letterSpacing')
    field.letterSpacing = Math.round(clamp(value, -0.2, 2) * 100) / 100
  else if (prop === 'borderWidth')
    field.borderWidth = Math.round(clamp(value, 0.05, 2) * 100) / 100
  else field[prop] = snap(Math.max(value, 0))
}

function setLabelNumber(prop: 'width' | 'height' | 'radius', event: Event) {
  const value = numberFrom(event)
  if (prop === 'radius') draft.value.label.radius = snap(clamp(value, 0, 20))
  else draft.value.label[prop] = snap(clamp(value, 10, 420))
}

function setPageNumber(
  prop: 'rows' | 'cols' | 'gapX' | 'gapY' | 'marginTop' | 'marginBottom' | 'marginLeft' | 'marginRight',
  event: Event,
) {
  const value = numberFrom(event)
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
      class="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4"
    >
      <div class="flex min-w-0 items-center gap-3">
        <span class="hidden text-sm font-bold text-slate-400 sm:inline">模板设计器</span>
        <input
          v-model="draft.name"
          type="text"
          class="input-field w-56 font-semibold"
          placeholder="模板名称"
        />
      </div>
      <div class="flex items-center gap-2">
        <select v-model.number="pxPerMm" class="input-field w-24 !py-1 text-xs">
          <option :value="4">缩放 ×4</option>
          <option :value="6">缩放 ×6</option>
          <option :value="8">缩放 ×8</option>
          <option :value="10">缩放 ×10</option>
        </select>
        <button type="button" class="btn btn-ghost btn-md" @click="emit('close')">取消</button>
        <template v-if="isEditingCustom">
          <button type="button" class="btn btn-secondary btn-md" @click="save(true)">
            另存为新模板
          </button>
          <button type="button" class="btn btn-primary btn-md" @click="save(false)">
            保存修改
          </button>
        </template>
        <button v-else type="button" class="btn btn-primary btn-md" @click="save(true)">
          保存为我的模板
        </button>
      </div>
    </header>

    <div class="flex min-h-0 flex-1">
      <!-- 画布 -->
      <div class="flex-1 overflow-auto" @pointerdown.self="selectedId = null">
        <div class="grid min-h-full w-full place-items-center p-10">
          <div>
            <div
              class="designer-grid relative border border-slate-300 bg-white shadow-md"
              :style="stageStyle"
              @pointerdown.self="selectedId = null"
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
                  selectedId === field.id
                    ? 'z-10 cursor-move outline-2 outline-brand-500'
                    : 'cursor-move outline-1 outline-dashed outline-transparent hover:outline-brand-300'
                "
                :style="fieldBoxStyle(field)"
                @pointerdown.stop="beginDrag(field, $event, 'move')"
                @pointermove="onPointerMove"
                @pointerup="endDrag"
                @pointercancel="endDrag"
              >
                <template v-if="selectedId === field.id">
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

            <p class="mt-3 text-center text-[11px] text-slate-400">
              拖拽时自动吸附对齐线 · 八向手柄缩放 · 方向键微调 0.5mm（Shift = 2mm） · Delete 删除字段
            </p>
          </div>
        </div>
      </div>

      <!-- 属性面板 -->
      <aside class="w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4">
        <!-- 字段列表 -->
        <div>
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-bold text-slate-700">字段</h3>
            <div ref="addMenuRoot" class="relative">
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                @click="addMenuOpen = !addMenuOpen"
              >
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
              <div
                v-if="addMenuOpen"
                class="absolute right-0 z-30 mt-1 max-h-80 w-52 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
              >
                <p class="px-2 pt-1 pb-0.5 text-[10px] font-bold tracking-wider text-slate-400">
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
                    class="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-bold text-slate-500"
                  >
                    {{ preset.tag }}
                  </span>
                </button>
                <p class="px-2 pt-2 pb-0.5 text-[10px] font-bold tracking-wider text-slate-400">
                  空白字段
                </p>
                <button
                  type="button"
                  class="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                  @click="addField('text')"
                >
                  空白文本
                  <span
                    class="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-bold text-slate-500"
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
                    class="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-bold text-slate-500"
                  >
                    图
                  </span>
                </button>
              </div>
            </div>
          </div>
          <ul class="mt-2 grid gap-1">
            <li
              v-for="field in draft.fields"
              :key="field.id"
              class="flex cursor-pointer items-center justify-between rounded-lg border px-2 py-1.5 text-xs"
              :class="
                selectedId === field.id
                  ? 'border-brand-400 bg-brand-50 font-bold text-brand-700'
                  : 'border-slate-200 text-slate-600 hover:border-brand-200'
              "
              @click="selectedId = field.id"
            >
              <span class="flex items-center gap-1.5">
                <span
                  class="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-bold text-slate-500"
                >
                  {{ field.type === 'image' ? '图' : '文' }}
                </span>
                {{ field.label || field.id }}
              </span>
              <button
                type="button"
                class="cursor-pointer text-slate-300 hover:text-red-500"
                aria-label="删除字段"
                @click.stop="removeField(field.id)"
              >
                ✕
              </button>
            </li>
          </ul>
        </div>

        <!-- 选中字段属性 -->
        <div v-if="selectedField" class="mt-4 border-t border-slate-100 pt-4">
          <h3 class="text-xs font-bold text-slate-700">
            字段属性 · {{ selectedField.label || selectedField.id }}
          </h3>

          <div class="mt-2 grid grid-cols-2 gap-2">
            <div class="col-span-2">
              <label class="field-label">显示名称</label>
              <input v-model="selectedField.label" type="text" class="input-field" />
            </div>

            <div v-if="selectedField.type === 'text'" class="col-span-2">
              <label class="field-label">内容来源</label>
              <select v-model="textSource" class="input-field">
                <option value="excel">Excel 数据列（每枚不同）</option>
                <option value="fixed">固定文本（每枚相同）</option>
              </select>
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
                placeholder="如：请对号入座 / 学校名称"
              />
            </div>
            <div
              v-else-if="selectedField.type === 'text'"
              class="col-span-2"
            >
              <label class="field-label">示例内容（仅预览用）</label>
              <input v-model="selectedField.sample" type="text" class="input-field" />
            </div>

            <div v-if="selectedField.type === 'text'" class="col-span-2">
              <label class="field-label">标签名前缀（可选）</label>
              <input
                v-model="captionModel"
                type="text"
                class="input-field"
                placeholder="如填“姓名”则渲染为：姓名 张三"
              />
            </div>

            <div v-if="selectedField.type === 'image'" class="col-span-2">
              <label class="field-label">图片来源</label>
              <select v-model="imageSource" class="input-field">
                <option value="matched">按匹配列照片（每枚不同）</option>
                <option value="static">固定图片 / Logo（每枚相同）</option>
              </select>
              <div v-if="imageSource === 'static'" class="mt-2 flex items-center gap-2">
                <img
                  v-if="selectedField.imageSrc"
                  :src="selectedField.imageSrc"
                  class="size-10 border border-slate-200 bg-white object-contain"
                  alt=""
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
              <p v-else class="mt-1 text-[11px] leading-4 text-slate-400">
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
            <div>
              <label class="field-label">X (mm)</label>
              <input
                type="number"
                step="0.5"
                class="input-field"
                :value="selectedField.x"
                @change="setFieldNumber('x', $event)"
              />
            </div>
            <div>
              <label class="field-label">Y (mm)</label>
              <input
                type="number"
                step="0.5"
                class="input-field"
                :value="selectedField.y"
                @change="setFieldNumber('y', $event)"
              />
            </div>
            <div>
              <label class="field-label">宽 (mm)</label>
              <input
                type="number"
                step="0.5"
                class="input-field"
                :value="selectedField.width"
                @change="setFieldNumber('width', $event)"
              />
            </div>
            <div>
              <label class="field-label">高 (mm)</label>
              <input
                type="number"
                step="0.5"
                class="input-field"
                :value="selectedField.height"
                @change="setFieldNumber('height', $event)"
              />
            </div>
          </div>

          <div class="mt-2 flex flex-wrap gap-1">
            <button type="button" class="btn btn-ghost btn-sm" @click="alignField('left')">左对齐</button>
            <button type="button" class="btn btn-ghost btn-sm" @click="alignField('center')">水平居中</button>
            <button type="button" class="btn btn-ghost btn-sm" @click="alignField('right')">右对齐</button>
            <button type="button" class="btn btn-ghost btn-sm" @click="alignField('top')">顶对齐</button>
            <button type="button" class="btn btn-ghost btn-sm" @click="alignField('middle')">垂直居中</button>
            <button type="button" class="btn btn-ghost btn-sm" @click="alignField('bottom')">底对齐</button>
          </div>

          <template v-if="selectedField.type === 'text'">
            <div class="mt-2 grid grid-cols-2 gap-2">
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
                <input
                  type="number"
                  step="0.5"
                  class="input-field"
                  :value="selectedField.fontSize ?? 12"
                  @change="setFieldNumber('fontSize', $event)"
                />
              </div>
              <div>
                <label class="field-label">颜色</label>
                <input
                  v-model="selectedField.color"
                  type="color"
                  class="input-field h-8 cursor-pointer !p-0.5"
                />
              </div>
              <div>
                <label class="field-label">水平对齐</label>
                <select v-model="selectedField.align" class="input-field">
                  <option value="left">左</option>
                  <option value="center">居中</option>
                  <option value="right">右</option>
                </select>
              </div>
              <div>
                <label class="field-label">垂直对齐</label>
                <select v-model="selectedField.verticalAlign" class="input-field">
                  <option value="top">上</option>
                  <option value="middle">居中</option>
                  <option value="bottom">下</option>
                </select>
              </div>
              <div>
                <label class="field-label">最多行数</label>
                <input
                  type="number"
                  min="1"
                  max="6"
                  class="input-field"
                  :value="selectedField.maxLines ?? 1"
                  @change="setFieldNumber('maxLines', $event)"
                />
              </div>
              <div>
                <label class="field-label">内边距 (mm)</label>
                <input
                  type="number"
                  step="0.2"
                  class="input-field"
                  :value="selectedField.padding ?? 0.8"
                  @change="setFieldNumber('padding', $event)"
                />
              </div>
              <div>
                <label class="field-label">字距 (em)</label>
                <input
                  type="number"
                  step="0.02"
                  class="input-field"
                  :value="selectedField.letterSpacing ?? 0"
                  @change="setFieldNumber('letterSpacing', $event)"
                />
              </div>
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
              <label class="flex cursor-pointer items-center gap-1.5">
                <input
                  :checked="selectedField.fontWeight === 'bold'"
                  type="checkbox"
                  class="accent-brand-600"
                  @change="
                    selectedField.fontWeight = ($event.target as HTMLInputElement).checked
                      ? 'bold'
                      : 'normal'
                  "
                />
                加粗
              </label>
              <label class="flex cursor-pointer items-center gap-1.5">
                <input
                  :checked="selectedField.emphasis === 'hero'"
                  type="checkbox"
                  class="accent-brand-600"
                  @change="
                    selectedField.emphasis = ($event.target as HTMLInputElement).checked
                      ? 'hero'
                      : undefined
                  "
                />
                特大强调（座位号）
              </label>
            </div>
          </template>

          <div class="mt-2 grid grid-cols-2 gap-2">
            <div class="col-span-2 flex items-center gap-3 text-xs font-semibold text-slate-600">
              <label class="flex cursor-pointer items-center gap-1.5">
                <input v-model="selectedField.border" type="checkbox" class="accent-brand-600" />
                显示边框
              </label>
              <label class="flex cursor-pointer items-center gap-1.5">
                <input v-model="hasBackground" type="checkbox" class="accent-brand-600" />
                填充背景
              </label>
            </div>
            <div v-if="hasBackground">
              <label class="field-label">背景色</label>
              <input
                v-model="selectedField.background"
                type="color"
                class="input-field h-8 cursor-pointer !p-0.5"
              />
            </div>
            <template v-if="selectedField.border">
              <div>
                <label class="field-label">边框宽 (mm)</label>
                <input
                  type="number"
                  step="0.05"
                  class="input-field"
                  :value="selectedField.borderWidth ?? 0.2"
                  @change="setFieldNumber('borderWidth', $event)"
                />
              </div>
              <div>
                <label class="field-label">边框色</label>
                <input
                  v-model="selectedField.borderColor"
                  type="color"
                  class="input-field h-8 cursor-pointer !p-0.5"
                />
              </div>
            </template>
            <div>
              <label class="field-label">圆角 (mm)</label>
              <input
                type="number"
                step="0.5"
                class="input-field"
                :value="selectedField.radius ?? 0"
                @change="setFieldNumber('radius', $event)"
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
              <select v-model="paperId" class="input-field">
                <option v-for="p in PAPER_PRESETS" :key="p.id" :value="p.id">
                  {{ p.label }}（{{ p.width }} × {{ p.height }}）
                </option>
                <option v-if="isCustomPaper" value="custom" disabled>
                  自定义（{{ draft.page.paperWidth }} × {{ draft.page.paperHeight }}）
                </option>
              </select>
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
              <input
                type="number"
                class="input-field"
                :value="draft.label.width"
                @change="setLabelNumber('width', $event)"
              />
            </div>
            <div>
              <label class="field-label">标签高 (mm)</label>
              <input
                type="number"
                class="input-field"
                :value="draft.label.height"
                @change="setLabelNumber('height', $event)"
              />
            </div>
            <div>
              <label class="field-label">标签圆角 (mm)</label>
              <input
                type="number"
                step="0.5"
                class="input-field"
                :value="draft.label.radius ?? 0"
                @change="setLabelNumber('radius', $event)"
              />
            </div>
            <div>
              <label class="field-label">列 × 行</label>
              <div class="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="12"
                  class="input-field"
                  :value="draft.page.cols"
                  @change="setPageNumber('cols', $event)"
                />
                <span class="text-slate-300">×</span>
                <input
                  type="number"
                  min="1"
                  max="30"
                  class="input-field"
                  :value="draft.page.rows"
                  @change="setPageNumber('rows', $event)"
                />
              </div>
            </div>
            <div>
              <label class="field-label">横向间距 (mm)</label>
              <input
                type="number"
                step="0.5"
                class="input-field"
                :value="draft.page.gapX"
                @change="setPageNumber('gapX', $event)"
              />
            </div>
            <div>
              <label class="field-label">纵向间距 (mm)</label>
              <input
                type="number"
                step="0.5"
                class="input-field"
                :value="draft.page.gapY"
                @change="setPageNumber('gapY', $event)"
              />
            </div>
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
            <label class="flex cursor-pointer items-center gap-1.5">
              <input v-model="draft.showLabelBorder" type="checkbox" class="accent-brand-600" />
              标签边框
            </label>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              @click="centerLayout(draft)"
            >
              阵列居中
            </button>
          </div>
          <p
            v-if="hasOverflow"
            class="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] leading-4 text-red-700"
          >
            排版超出 {{ currentPaperLabel }}：
            <template v-if="overflow.x > 0">横向 {{ overflow.x }}mm </template>
            <template v-if="overflow.y > 0">纵向 {{ overflow.y }}mm</template>
          </p>
          <div class="mt-2">
            <label class="field-label">模板说明</label>
            <input v-model="draft.description" type="text" class="input-field" />
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>
