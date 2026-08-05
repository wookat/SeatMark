<script lang="ts">
import type { Directive } from 'vue'

/** 字号自适应下限：不低于基准字号的一半，且不低于 5pt（保证可读性） */
const AUTOFIT_MIN_RATIO = 0.5
const AUTOFIT_MIN_PT = 5

function autofitEl(el: HTMLElement): void {
  const base = Number(el.dataset.autofitBase ?? '0')
  if (!base) return
  const body = el.querySelector<HTMLElement>('.label-field__body')
  if (!body) return
  el.style.fontSize = `${base}pt`
  const cs = getComputedStyle(el)
  const availHeight =
    el.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0)
  const overflows = () =>
    body.scrollHeight > body.clientHeight + 1 ||
    body.scrollWidth > body.clientWidth + 1 ||
    body.scrollHeight > availHeight + 1
  if (!overflows()) return
  let lo = Math.max(AUTOFIT_MIN_PT, base * AUTOFIT_MIN_RATIO)
  let hi = base
  for (let i = 0; i < 7; i++) {
    const mid = (lo + hi) / 2
    el.style.fontSize = `${mid}pt`
    if (overflows()) hi = mid
    else lo = mid
  }
  el.style.fontSize = `${lo}pt`
  if (overflows()) el.style.fontSize = `${Math.max(AUTOFIT_MIN_PT, base * AUTOFIT_MIN_RATIO)}pt`
}

/** 已挂载的自适应字段：在线字体就绪后统一重排（字形宽度可能变化） */
const autofitRegistry = new Set<HTMLElement>()
let fontsListenerBound = false

function bindFontsListener(): void {
  if (fontsListenerBound || typeof document === 'undefined' || !('fonts' in document)) return
  fontsListenerBound = true
  document.fonts.addEventListener('loadingdone', () => {
    for (const el of autofitRegistry) autofitEl(el)
  })
}

/**
 * SVG 内部 id（渐变/图案等 paint server）全局唯一化：
 * 同一模板会同时渲染多份（缩略图 / 预览 / 打印宿主），重复 id 会让 url(#id)
 * 解析到文档中第一个同名节点；打印时屏幕预览所在的 #app 被 display:none，
 * 引用到隐藏子树里的渐变会整体失效，导致彩色装饰打印丢色甚至整卡空白。
 */
let decorInstanceSeq = 0

export function uniquifySvgIds(svg: string, suffix: string): string {
  const ids = new Set<string>()
  for (const m of svg.matchAll(/\sid="([^"]+)"/g)) ids.add(m[1]!)
  let out = svg
  for (const id of ids) {
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out
      .replace(new RegExp(`(\\sid=")${esc}(")`, 'g'), `$1${id}-${suffix}$2`)
      .replace(new RegExp(`(url\\(#)${esc}(\\))`, 'g'), `$1${id}-${suffix}$2`)
  }
  return out
}

/**
 * v-autofit：文本超出字段框时按比例缩小字号直至放得下（或到达下限），
 * 预览 / 缩略图 / 设计器 / 导出共用同一套缩放逻辑。
 */
const vAutofit: Directive<HTMLElement, number> = {
  mounted(el, binding) {
    el.dataset.autofitBase = String(binding.value)
    autofitRegistry.add(el)
    bindFontsListener()
    autofitEl(el)
  },
  updated(el, binding) {
    el.dataset.autofitBase = String(binding.value)
    autofitEl(el)
  },
  unmounted(el) {
    autofitRegistry.delete(el)
  },
}
</script>

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'

import { combineFontStacks, DEFAULT_FONT_STACK } from '@/data/fonts'
import type { LabelTemplate, TemplateField } from '@/types/template'

const props = withDefaults(
  defineProps<{
    template: LabelTemplate
    /** 字段 id -> 实际文本；sampleMode 下忽略 */
    texts?: Record<string, string>
    photoSrc?: string | null
    /** 使用模板示例数据渲染（缩略图 / 设计器） */
    sampleMode?: boolean
    highlightMissing?: boolean
    /** 品牌水印：渲染在标签内部底部居中（带水印导出/打印时开启） */
    watermark?: boolean
  }>(),
  {
    texts: undefined,
    photoSrc: null,
    sampleMode: false,
    highlightMissing: false,
    watermark: false,
  },
)

/** 小标签只放域名，宽度足够时放全称（品牌名+域名） */
const WATERMARK_FULL = 'SeatMark 座签 · seatmark.cn'
const WATERMARK_SHORT = 'seatmark.cn'

/** 估算水印文本宽度（mm）：CJK 记 1em、西文/符号记 0.64em */
function estimateTextWidth(text: string, fontSizeMm: number): number {
  let em = 0
  for (const ch of text) em += /[\u2E80-\u9FFF\uF900-\uFAFF]/.test(ch) ? 1 : 0.64
  return em * fontSizeMm * 1.06
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/**
 * 水印位置与内容：字号随标签尺寸自适应，按「底部居中 → 底部右 → 底部左 → 顶部居中 →
 * 顶部右」的优先级寻找不与任何字段相交的空位；全部被占时退回底部居中（半透明叠加，
 * 不影响黑白打印可读性）。
 */
const watermarkLayout = computed<{ text: string; style: CSSProperties }>(() => {
  const { width, height } = props.template.label
  // 字号约为标签宽度的 4.5%，下限 2.2mm（黑白打印可读），上限 5mm
  const size = Math.min(Math.max(Math.min(width, height * 2.4) * 0.045, 2.2), 5)
  const wmHeight = size * 1.15
  const inset = Math.max(0.8, size * 0.4)
  const fieldRects: Rect[] = props.template.fields.map((f) => ({
    x: f.x,
    y: f.y,
    w: f.width,
    h: f.height,
  }))
  const texts =
    estimateTextWidth(WATERMARK_FULL, size) <= width * 0.86
      ? [WATERMARK_FULL, WATERMARK_SHORT]
      : [WATERMARK_SHORT]
  for (const text of texts) {
    const wmWidth = estimateTextWidth(text, size)
    const yBottom = height - inset - wmHeight
    const candidates: Rect[] = [
      { x: (width - wmWidth) / 2, y: yBottom, w: wmWidth, h: wmHeight },
      { x: width - inset - wmWidth, y: yBottom, w: wmWidth, h: wmHeight },
      { x: inset, y: yBottom, w: wmWidth, h: wmHeight },
      { x: (width - wmWidth) / 2, y: inset, w: wmWidth, h: wmHeight },
      { x: width - inset - wmWidth, y: inset, w: wmWidth, h: wmHeight },
    ]
    for (const rect of candidates) {
      if (rect.x < inset - 0.01) continue
      if (fieldRects.some((f) => intersects(rect, f))) continue
      return { text, style: styleFor(rect, size) }
    }
  }
  // 兜底：底部靠右半透明叠加（密排模板的字段多为左对齐，右端视觉留白更多）
  const text = texts[texts.length - 1]!
  const wmWidth = estimateTextWidth(text, size)
  return {
    text,
    style: styleFor(
      { x: width - inset - wmWidth, y: height - inset - wmHeight, w: wmWidth, h: wmHeight },
      size,
    ),
  }
})

function styleFor(rect: Rect, size: number): CSSProperties {
  return {
    left: `${Math.max(0, rect.x)}mm`,
    top: `${rect.y}mm`,
    fontSize: `${size}mm`,
  }
}

const SAMPLE_FALLBACK: Record<string, string> = {
  seatNo: '12',
  name: '张同学',
  room: '考场-1',
  examId: '2025053002',
}

/**
 * 装饰层安全门禁：模板可能来自分享链接 / 导入 JSON，
 * 仅允许纯 svg 矢量标记，拒绝脚本、事件处理器与外部引用
 */
function isSafeDecorSvg(svg: string): boolean {
  const s = svg.trim()
  if (!s.startsWith('<svg')) return false
  return !/<script|<foreignobject|\son\w+\s*=|javascript:|\shref\s*=|xlink:href/i.test(s)
}

const decorUid = `u${++decorInstanceSeq}`

const decorSvg = computed(() => {
  const svg = props.template.label.decorSvg
  return svg && isSafeDecorSvg(svg) ? uniquifySvgIds(svg, decorUid) : null
})

const rootStyle = computed<CSSProperties>(() => {
  const { label, showLabelBorder } = props.template
  return {
    position: 'relative',
    width: `${label.width}mm`,
    height: `${label.height}mm`,
    borderRadius: `${label.radius ?? 0}mm`,
    background: label.background ?? '#ffffff',
    border: showLabelBorder
      ? `${label.borderWidth ?? 0.2}mm solid ${label.borderColor ?? '#334155'}`
      : 'none',
    boxSizing: 'border-box',
    overflow: 'hidden',
  }
})

function textOf(field: TemplateField): string {
  if (field.fixedText != null) return field.fixedText
  // 镜像字段：取源字段的内容（如折叠桌牌上半区重复下半区数据）
  const source = field.mirrorOf
    ? (props.template.fields.find((f) => f.id === field.mirrorOf) ?? field)
    : field
  if (props.sampleMode) {
    if (source.sample && source.sample !== 'photo') return source.sample
    return (
      props.template.sampleData?.[source.id] ??
      SAMPLE_FALLBACK[source.id] ??
      source.label ??
      source.id
    )
  }
  return props.texts?.[source.id] ?? ''
}

function imageSrcOf(field: TemplateField): string | null {
  if (field.imageSrc) return field.imageSrc
  if (props.sampleMode) return null
  return props.photoSrc ?? null
}

function fieldStyle(field: TemplateField): CSSProperties {
  const pad = field.padding ?? 0.8
  return {
    left: `${field.x}mm`,
    top: `${field.y}mm`,
    width: `${field.width}mm`,
    height: `${field.height}mm`,
    fontSize: `${field.fontSize ?? 12}pt`,
    fontWeight: field.fontWeight ?? 'normal',
    textAlign: field.align ?? 'center',
    color: field.color ?? (field.fontWeight === 'bold' ? '#0f172a' : '#334155'),
    // 西文字体在前仅覆盖英文/数字，中文字体兜底汉字；字段未设置时跟随模板
    fontFamily: combineFontStacks(
      field.fontFamilyEn ?? props.template.fontFamilyEn,
      field.fontFamily ?? props.template.fontFamily ?? DEFAULT_FONT_STACK,
    ),
    ...(field.letterSpacing != null ? { letterSpacing: `${field.letterSpacing}em` } : {}),
    lineHeight: String(field.lineHeight ?? 1.15),
    padding: `${pad}mm`,
    border: field.border
      ? `${field.borderWidth ?? 0.2}mm solid ${field.borderColor ?? '#64748b'}`
      : 'none',
    borderRadius: `${field.radius ?? 0}mm`,
    ...(field.background ? { background: field.background } : {}),
    ...(field.rotate ? { transform: `rotate(${field.rotate}deg)` } : {}),
    justifyContent:
      field.verticalAlign === 'top'
        ? 'flex-start'
        : field.verticalAlign === 'bottom'
          ? 'flex-end'
          : 'center',
    '--max-lines': String(field.maxLines ?? 1),
  }
}

function fieldClasses(field: TemplateField): Record<string, boolean> {
  const empty = !props.sampleMode && props.highlightMissing
  return {
    'label-field--hero': field.emphasis === 'hero',
    'label-field--empty':
      empty && field.type === 'text' && field.fixedText == null && !textOf(field).trim(),
    'label-field--photo-missing': empty && field.type === 'image' && !imageSrcOf(field),
    // 矢量图标（SVG data URL）：完整等比显示且无照片底色
    'label-field--vector':
      field.type === 'image' && !!field.imageSrc?.startsWith('data:image/svg'),
  }
}
</script>

<template>
  <div :style="rootStyle">
    <div v-if="decorSvg" class="label-decor" aria-hidden="true" v-html="decorSvg"></div>
    <template v-for="field in template.fields" :key="field.id">
      <div
        v-if="field.type === 'text'"
        v-autofit="field.fontSize ?? 12"
        class="label-field label-field--text"
        :class="fieldClasses(field)"
        :style="fieldStyle(field)"
      >
        <span class="label-field__body">
          <span v-if="field.caption" class="label-field__caption">{{ field.caption }}</span>
          <span class="label-field__content">{{ textOf(field) }}</span>
        </span>
      </div>
      <div
        v-else
        class="label-field label-field--image"
        :class="fieldClasses(field)"
        :style="fieldStyle(field)"
      >
        <img
          v-if="imageSrcOf(field)"
          :src="imageSrcOf(field)!"
          :alt="field.imageSrc != null ? '模板图片素材' : '标签照片'"
        />
        <span v-else class="label-field__placeholder">{{ field.imageSrc != null ? '图片' : '照片' }}</span>
      </div>
    </template>
    <div v-if="watermark" class="label-watermark" :style="watermarkLayout.style" aria-hidden="true">
      {{ watermarkLayout.text }}
    </div>
  </div>
</template>
