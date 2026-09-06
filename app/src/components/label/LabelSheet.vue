<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'

import LabelCard from '@/components/label/LabelCard.vue'
import { t } from '@/i18n'
import type { DataRow, LabelTemplate } from '@/types/template'
import { cutLines, labelPosition } from '@/utils/layout'

const props = withDefaults(
  defineProps<{
    template: LabelTemplate
    /** 数据行；null 表示版位留白（裁切分拣排序的尾页占位） */
    rows: (DataRow | null)[]
    getText: (row: DataRow, fieldId: string) => string
    getPhoto?: (row: DataRow) => string | null
    showCutLines?: boolean
    highlightMissing?: boolean
    /** 未映射字段 id 集合：预览时展示轻量占位提示（导出 / 打印宿主不传） */
    unmappedFields?: Set<string>
    /** 屏幕预览模式下带圆角阴影；导出/打印时关闭 */
    screen?: boolean
    /** 品牌水印：每张标签内部底部居中 + 页脚角标（免费不限次导出/打印时叠加） */
    watermark?: boolean
    /** 预览交互模式：标签可点击（单张覆写入口） */
    interactive?: boolean
    /** 含单张覆写的行集合：预览时给对应标签叠加角标 */
    overriddenRows?: Set<DataRow>
  }>(),
  {
    getPhoto: undefined,
    showCutLines: true,
    highlightMissing: false,
    unmappedFields: undefined,
    screen: false,
    watermark: false,
    interactive: false,
    overriddenRows: undefined,
  },
)

const emit = defineEmits<{ labelClick: [row: DataRow] }>()

const lines = computed(() => cutLines(props.template))

/** 纸张尺寸由模板决定（A4 / A5 / A3、横竖向） */
const pageStyle = computed<CSSProperties>(() => ({
  width: `${props.template.page.paperWidth}mm`,
  height: `${props.template.page.paperHeight}mm`,
}))

function boxStyle(idx: number): CSSProperties {
  const pos = labelPosition(props.template, idx)
  // --i 供外部交错动画使用（如首页 Hero 的逐枚落版进场）
  return { left: `${pos.left}mm`, top: `${pos.top}mm`, '--i': idx } as CSSProperties
}

function textsFor(row: DataRow): Record<string, string> {
  const result: Record<string, string> = {}
  for (const field of props.template.fields) {
    if (field.type === 'text') result[field.id] = props.getText(row, field.id)
  }
  return result
}
</script>

<template>
  <div class="sheet-page" :class="{ 'sheet-page--screen': screen }" :style="pageStyle">
    <!-- 裁切线用内联 SVG 绘制：html2canvas-pro 不栅格化虚线边框与重复渐变背景，但能正确渲染内联 SVG（同模板装饰层机制） -->
    <svg
      v-if="showCutLines"
      class="cut-layer"
      :viewBox="`0 0 ${template.page.paperWidth} ${template.page.paperHeight}`"
      width="100%"
      height="100%"
      aria-hidden="true"
    >
      <line
        v-for="line in lines"
        :key="line.key"
        class="cut-line"
        :x1="line.left"
        :y1="line.top"
        :x2="line.orientation === 'v' ? line.left : line.left + line.length"
        :y2="line.orientation === 'v' ? line.top + line.length : line.top"
        stroke="rgba(120, 130, 150, 0.65)"
        stroke-width="0.35"
        stroke-dasharray="1.2 1.2"
      />
    </svg>
    <div v-if="watermark" class="sheet-watermark" aria-hidden="true">SeatMark 座签 · seatmark.cn</div>
    <div
      v-for="(row, idx) in rows"
      :key="idx"
      class="label-box"
      :class="interactive && row ? 'cursor-pointer transition-shadow hover:ring-2 hover:ring-brand-400' : ''"
      :title="interactive && row ? t('点击可单张覆写：只改这一张标签，不改名单') : undefined"
      :style="boxStyle(idx)"
      @click="interactive && row && emit('labelClick', row)"
    >
      <LabelCard
        v-if="row"
        :template="template"
        :texts="textsFor(row)"
        :photo-src="getPhoto ? getPhoto(row) : null"
        :highlight-missing="highlightMissing"
        :unmapped-fields="unmappedFields"
        :watermark="watermark"
      />
      <span
        v-if="row && overriddenRows?.has(row)"
        class="pointer-events-none absolute top-0.5 right-0.5 z-10 rounded-full bg-brand-600 px-1.5 py-0.5 text-[8px] font-bold text-white"
        :aria-label="t('此标签含单张覆写')"
      >
        {{ t('已改') }}
      </span>
    </div>
  </div>
</template>
