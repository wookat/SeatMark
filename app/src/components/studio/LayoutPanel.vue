<script setup lang="ts">
import { computed } from 'vue'

import FontPicker from '@/components/studio/FontPicker.vue'
import CheckboxField from '@/components/ui/CheckboxField.vue'
import NumberField from '@/components/ui/NumberField.vue'
import SelectField, { type SelectOption } from '@/components/ui/SelectField.vue'
import { useToastStore } from '@/stores/toast'
import { useWorkspaceStore } from '@/stores/workspace'
import type { LabelTemplate } from '@/types/template'
import { centerLayout, clamp, fitToPaper, layoutOverflow, round1 } from '@/utils/layout'
import { matchPaperPreset, PAPER_PRESETS, paperLabel } from '@/utils/paper'

const emit = defineEmits<{ openDesigner: [template: LabelTemplate] }>()

const workspace = useWorkspaceStore()
const toast = useToastStore()

const overflow = computed(() => layoutOverflow(workspace.template))
const hasOverflow = computed(() => overflow.value.x > 0 || overflow.value.y > 0)
const currentPaperLabel = computed(() => paperLabel(workspace.template.page))

/** 纸张规格选择（A3 / A4 / A5 × 横竖向）：切换后自动重算行列并居中 */
const paperId = computed({
  get: () => matchPaperPreset(workspace.template.page)?.id ?? 'custom',
  set: (id: string) => {
    const preset = PAPER_PRESETS.find((p) => p.id === id)
    if (!preset) return
    const page = workspace.template.page
    page.paperWidth = preset.width
    page.paperHeight = preset.height
    fitToPaper(workspace.template)
    toast.info(
      '已自动适配新纸张',
      `${preset.label}：${page.cols} 列 × ${page.rows} 行，每页 ${page.cols * page.rows} 枚`,
    )
  },
})

const isCustomPaper = computed(() => paperId.value === 'custom')

const paperOptions = computed<SelectOption[]>(() => {
  const options: SelectOption[] = PAPER_PRESETS.map((p) => ({
    value: p.id,
    label: p.label,
    hint: `${p.width} × ${p.height} mm`,
  }))
  if (isCustomPaper.value) {
    options.push({
      value: 'custom',
      label: `自定义（${workspace.template.page.paperWidth} × ${workspace.template.page.paperHeight}）`,
      disabled: true,
    })
  }
  return options
})

/** 模板全局中文字体 */
const templateFontZh = computed({
  get: () => workspace.template.fontFamily,
  set: (value: string | undefined) => {
    workspace.template.fontFamily = value
  },
})

/** 模板全局西文字体（英文/数字） */
const templateFontEn = computed({
  get: () => workspace.template.fontFamilyEn,
  set: (value: string | undefined) => {
    workspace.template.fontFamilyEn = value
  },
})

function setLabelSize(prop: 'width' | 'height', value: number) {
  workspace.template.label[prop] = round1(clamp(value, 10, 420))
}

function setGrid(prop: 'rows' | 'cols', value: number) {
  const max = prop === 'cols' ? 12 : 30
  workspace.template.page[prop] = Math.round(clamp(value, 1, max))
}

function setGap(prop: 'gapX' | 'gapY', value: number) {
  workspace.template.page[prop] = round1(clamp(value, 0, 50))
}

function setMargin(
  prop: 'marginTop' | 'marginBottom' | 'marginLeft' | 'marginRight',
  value: number,
) {
  workspace.template.page[prop] = round1(clamp(value, 0, 100))
}

function onCenterLayout() {
  centerLayout(workspace.template)
}
</script>

<template>
  <section class="panel-card">
    <div class="panel-head">
      <h2 class="section-title"><span class="step-chip">4</span>页面与版式</h2>
      <button
        type="button"
        class="btn btn-secondary btn-sm"
        @click="emit('openDesigner', workspace.template)"
      >
        打开可视化设计器
      </button>
    </div>

    <div class="grid grid-cols-2 gap-2.5">
      <div class="col-span-2">
        <label class="field-label">纸张规格</label>
        <SelectField v-model="paperId" :options="paperOptions" />
      </div>
      <div>
        <label class="field-label">中文字体</label>
        <FontPicker v-model="templateFontZh" lang="zh" default-label="宋体（系统默认）" />
      </div>
      <div>
        <label class="field-label">西文字体（英文/数字）</label>
        <FontPicker v-model="templateFontEn" lang="en" default-label="跟随中文字体" />
      </div>
      <div>
        <label class="field-label">标签宽 (mm)</label>
        <NumberField
          :model-value="workspace.template.label.width"
          :step="1"
          :min="10"
          :max="420"
          @update:model-value="setLabelSize('width', $event)"
        />
      </div>
      <div>
        <label class="field-label">标签高 (mm)</label>
        <NumberField
          :model-value="workspace.template.label.height"
          :step="1"
          :min="10"
          :max="420"
          @update:model-value="setLabelSize('height', $event)"
        />
      </div>
      <div>
        <label class="field-label">列数</label>
        <NumberField
          :model-value="workspace.template.page.cols"
          :min="1"
          :max="12"
          @update:model-value="setGrid('cols', $event)"
        />
      </div>
      <div>
        <label class="field-label">行数</label>
        <NumberField
          :model-value="workspace.template.page.rows"
          :min="1"
          :max="30"
          @update:model-value="setGrid('rows', $event)"
        />
      </div>
      <div>
        <label class="field-label">横向间距 (mm)</label>
        <NumberField
          :model-value="workspace.template.page.gapX"
          :step="0.5"
          :min="0"
          :max="50"
          @update:model-value="setGap('gapX', $event)"
        />
      </div>
      <div>
        <label class="field-label">纵向间距 (mm)</label>
        <NumberField
          :model-value="workspace.template.page.gapY"
          :step="0.5"
          :min="0"
          :max="50"
          @update:model-value="setGap('gapY', $event)"
        />
      </div>
      <div>
        <label class="field-label">左右边距 (mm)</label>
        <NumberField
          :model-value="workspace.template.page.marginLeft"
          :step="0.5"
          :min="0"
          :max="100"
          @update:model-value="setMargin('marginLeft', $event), setMargin('marginRight', $event)"
        />
      </div>
      <div>
        <label class="field-label">上下边距 (mm)</label>
        <NumberField
          :model-value="workspace.template.page.marginTop"
          :step="0.5"
          :min="0"
          :max="100"
          @update:model-value="setMargin('marginTop', $event), setMargin('marginBottom', $event)"
        />
      </div>
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-2">
      <CheckboxField
        v-model="workspace.template.showLabelBorder"
        class="text-xs font-semibold text-slate-600"
        label="显示标签边框"
      />
      <button type="button" class="btn btn-ghost btn-sm" @click="onCenterLayout">
        阵列居中（自动均分边距）
      </button>
    </div>

    <p
      v-if="hasOverflow"
      class="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs leading-4 text-red-700"
    >
      当前排版超出 {{ currentPaperLabel }} 纸面：
      <template v-if="overflow.x > 0">横向超出 {{ overflow.x }}mm；</template>
      <template v-if="overflow.y > 0">纵向超出 {{ overflow.y }}mm；</template>
      请减小标签尺寸、行列数或边距，或换更大的纸张。
    </p>
  </section>
</template>
