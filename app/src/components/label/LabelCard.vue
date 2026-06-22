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
  }>(),
  {
    texts: undefined,
    photoSrc: null,
    sampleMode: false,
    highlightMissing: false,
  },
)

const SAMPLE_FALLBACK: Record<string, string> = {
  seatNo: '12',
  name: '张同学',
  room: '考场-1',
  examId: '2025053002',
}

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
  if (props.sampleMode) {
    if (field.sample && field.sample !== 'photo') return field.sample
    return (
      props.template.sampleData?.[field.id] ?? SAMPLE_FALLBACK[field.id] ?? field.label ?? field.id
    )
  }
  return props.texts?.[field.id] ?? ''
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
    <template v-for="field in template.fields" :key="field.id">
      <div
        v-if="field.type === 'text'"
        class="label-field label-field--text"
        :class="fieldClasses(field)"
        :style="fieldStyle(field)"
      >
        <span v-if="field.caption" class="label-field__caption">{{ field.caption }}</span>
        <span class="label-field__content">{{ textOf(field) }}</span>
      </div>
      <div
        v-else
        class="label-field label-field--image"
        :class="fieldClasses(field)"
        :style="fieldStyle(field)"
      >
        <img v-if="imageSrcOf(field)" :src="imageSrcOf(field)!" alt="" />
        <span v-else class="label-field__placeholder">{{ field.imageSrc != null ? '图片' : '照片' }}</span>
      </div>
    </template>
  </div>
</template>
