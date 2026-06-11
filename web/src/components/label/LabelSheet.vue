<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'

import LabelCard from '@/components/label/LabelCard.vue'
import type { DataRow, LabelTemplate } from '@/types/template'
import { cutLines, labelPosition } from '@/utils/layout'

const props = withDefaults(
  defineProps<{
    template: LabelTemplate
    rows: DataRow[]
    getText: (row: DataRow, fieldId: string) => string
    getPhoto?: (row: DataRow) => string | null
    showCutLines?: boolean
    highlightMissing?: boolean
    /** 屏幕预览模式下带圆角阴影；导出/打印时关闭 */
    screen?: boolean
  }>(),
  {
    getPhoto: undefined,
    showCutLines: true,
    highlightMissing: false,
    screen: false,
  },
)

const lines = computed(() => cutLines(props.template))

/** 纸张尺寸由模板决定（A4 / A5 / A3、横竖向） */
const pageStyle = computed<CSSProperties>(() => ({
  width: `${props.template.page.paperWidth}mm`,
  height: `${props.template.page.paperHeight}mm`,
}))

function lineStyle(line: (typeof lines.value)[number]): CSSProperties {
  if (line.orientation === 'v') {
    return { left: `${line.left}mm`, top: `${line.top}mm`, height: `${line.length}mm`, width: '0' }
  }
  return { left: `${line.left}mm`, top: `${line.top}mm`, width: `${line.length}mm`, height: '0' }
}

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
    <div v-if="showCutLines" class="cut-layer">
      <div
        v-for="line in lines"
        :key="line.key"
        class="cut-line"
        :class="line.orientation === 'v' ? 'cut-line--v' : 'cut-line--h'"
        :style="lineStyle(line)"
      ></div>
    </div>
    <div v-for="(row, idx) in rows" :key="idx" class="label-box" :style="boxStyle(idx)">
      <LabelCard
        :template="template"
        :texts="textsFor(row)"
        :photo-src="getPhoto ? getPhoto(row) : null"
        :highlight-missing="highlightMissing"
      />
    </div>
  </div>
</template>
