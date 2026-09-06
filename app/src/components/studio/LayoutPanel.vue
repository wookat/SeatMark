<script setup lang="ts">
import { computed } from 'vue'

import FontPicker from '@/components/studio/FontPicker.vue'
import CheckboxField from '@/components/ui/CheckboxField.vue'
import NumberField from '@/components/ui/NumberField.vue'
import SelectField, { type SelectOption } from '@/components/ui/SelectField.vue'
import { t } from '@/i18n'
import { useTemplateLibrary } from '@/stores/templateLibrary'
import { useToastStore } from '@/stores/toast'
import { useWorkspaceStore } from '@/stores/workspace'
import type { LabelTemplate } from '@/types/template'
import { labelPapers } from '@/data/labelPapers'
import {
  applyLabelPaper,
  isPaperCompatible,
  matchLabelPaper,
  releaseLabelPaper,
} from '@/utils/labelPaper'
import {
  bestPaperForTemplate,
  evaluatePaperFit,
  FIT_LEVEL_LABELS,
  rankPapersForTemplate,
} from '@/utils/paperFit'
import { tFitReason } from '@/utils/paperFitI18n'
import { centerLayout, clamp, fitToPaper, layoutOverflow, round1 } from '@/utils/layout'
import { matchPaperPreset, PAPER_PRESETS, paperLabel } from '@/utils/paper'

const emit = defineEmits<{ openDesigner: [template: LabelTemplate] }>()

const workspace = useWorkspaceStore()
const library = useTemplateLibrary()
const toast = useToastStore()

/** 适配度评分基于模板设计尺寸（库中原始模板），而非已被纸型缩放后的副本 */
const designTemplate = computed(
  () => library.findById(workspace.selectedTemplateId) ?? workspace.template,
)

const recommendedPaper = computed(() => bestPaperForTemplate(designTemplate.value))

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

/** 不干胶纸型选择：选型号后自动锁定行列数、标签尺寸、边距与间距 */
const labelPaperSlug = computed({
  get: () =>
    matchLabelPaper(workspace.template.page, workspace.template.label)?.slug ?? 'none',
  set: (slug: string) => {
    if (slug === 'none') {
      if (!matchLabelPaper(workspace.template.page, workspace.template.label)) return
      releaseLabelPaper(workspace.template, designTemplate.value)
      toast.info('已取消纸型锁定', '恢复模板默认排版，可自由调整行列、尺寸与边距')
      return
    }
    const spec = labelPapers.find((p) => p.slug === slug)
    if (!spec) return
    if (!isPaperCompatible(workspace.template, spec)) {
      toast.warning(
        '当前模板与该纸型不兼容',
        '整页/折叠桌牌类模板需整页排版，请选择每页 1 枚的整版纸型或更换模板',
      )
      return
    }
    applyLabelPaper(workspace.template, spec)
    const fit = evaluatePaperFit(designTemplate.value, spec)
    if (fit.level === 'marginal' || fit.level === 'incompatible') {
      const best = recommendedPaper.value
      toast.warning(
        `该纸型与当前模板适配度：${FIT_LEVEL_LABELS[fit.level]}`,
        best && best.spec.slug !== spec.slug
          ? `${fit.reason}；建议改用「${best.spec.name}」`
          : fit.reason,
      )
      return
    }
    toast.info(
      '已按纸型锁定排版',
      `${spec.name}：${spec.cols} 列 × ${spec.rows} 行，每页 ${spec.cols * spec.rows} 枚（${spec.labelWidth} × ${spec.labelHeight} mm）`,
    )
  },
})

/** 纸型选项按适配度降序：推荐置顶加徽标，不适配排后并提示原因 */
const labelPaperOptions = computed<SelectOption[]>(() => [
  { value: 'none', label: t('不使用纸型（自由排版）') },
  ...rankPapersForTemplate(designTemplate.value).map(({ spec: p, fit }, index) => {
    const compatible = isPaperCompatible(workspace.template, p)
    const poor = fit.level === 'marginal' || fit.level === 'incompatible'
    return {
      value: p.slug,
      label: p.name,
      hint: compatible ? `${p.labelWidth} × ${p.labelHeight} mm` : t('与当前整页/折叠模板不兼容'),
      disabled: !compatible,
      badge:
        index === 0 && fit.level === 'recommended'
          ? t('推荐')
          : poor
            ? t(FIT_LEVEL_LABELS[fit.level])
            : undefined,
      badgeTone: (poor ? (fit.level === 'incompatible' ? 'danger' : 'warning') : 'positive') as
        | 'positive'
        | 'warning'
        | 'danger',
    }
  }),
])

const paperOptions = computed<SelectOption[]>(() => {
  const options: SelectOption[] = PAPER_PRESETS.map((p) => ({
    value: p.id,
    label: p.label,
    hint: `${p.width} × ${p.height} mm`,
  }))
  if (isCustomPaper.value) {
    options.push({
      value: 'custom',
      label: `${t('自定义')}（${workspace.template.page.paperWidth} × ${workspace.template.page.paperHeight}）`,
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
      <h2 class="section-title"><span class="step-chip">4</span>{{ t('页面与版式') }}</h2>
      <button
        type="button"
        class="btn btn-secondary btn-sm"
        @click="emit('openDesigner', workspace.template)"
      >
        {{ t('打开可视化设计器') }}
      </button>
    </div>

    <div class="grid grid-cols-2 gap-2.5">
      <div class="col-span-2">
        <label class="field-label">
          {{ t('按不干胶纸型选择') }}
          <RouterLink to="/papers" class="ml-1 font-normal text-brand-600 hover:underline">
            {{ t('查看纸型库') }}
          </RouterLink>
        </label>
        <SelectField v-model="labelPaperSlug" :options="labelPaperOptions" />
        <p
          v-if="recommendedPaper && labelPaperSlug !== recommendedPaper.spec.slug"
          class="mt-1.5 flex items-start gap-1 text-[11px] leading-4 text-slate-600"
        >
          <svg
            class="mt-0.5 size-3 shrink-0 text-emerald-500"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M8 1.5 9.9 5.6l4.4.5-3.3 3 1 4.4L8 11.2l-4 2.3 1-4.4-3.3-3 4.4-.5z" />
          </svg>
          <span>
            {{ t('推荐纸型：') }}
            <button
              type="button"
              class="cursor-pointer font-semibold text-brand-600 hover:underline"
              @click="labelPaperSlug = recommendedPaper.spec.slug"
            >
              {{ t(recommendedPaper.spec.name) }}
            </button>
            ，{{ tFitReason(recommendedPaper.fit.reason) }}
          </span>
        </p>
      </div>
      <div class="col-span-2">
        <label class="field-label">{{ t('纸张规格') }}</label>
        <SelectField v-model="paperId" :options="paperOptions" />
      </div>
      <div>
        <label class="field-label">{{ t('中文字体') }}</label>
        <FontPicker v-model="templateFontZh" lang="zh" :default-label="t('宋体（系统默认）')" />
      </div>
      <div>
        <label class="field-label">{{ t('西文字体（英文/数字）') }}</label>
        <FontPicker v-model="templateFontEn" lang="en" :default-label="t('跟随中文字体')" />
      </div>
      <div>
        <label class="field-label">{{ t('标签宽 (mm)') }}</label>
        <NumberField
          aria-label="标签宽 (mm)"
          :model-value="workspace.template.label.width"
          :step="1"
          :min="10"
          :max="420"
          @update:model-value="setLabelSize('width', $event)"
        />
      </div>
      <div>
        <label class="field-label">{{ t('标签高 (mm)') }}</label>
        <NumberField
          aria-label="标签高 (mm)"
          :model-value="workspace.template.label.height"
          :step="1"
          :min="10"
          :max="420"
          @update:model-value="setLabelSize('height', $event)"
        />
      </div>
      <div>
        <label class="field-label">{{ t('列数') }}</label>
        <NumberField
          aria-label="列数"
          :model-value="workspace.template.page.cols"
          :min="1"
          :max="12"
          @update:model-value="setGrid('cols', $event)"
        />
      </div>
      <div>
        <label class="field-label">{{ t('行数') }}</label>
        <NumberField
          aria-label="行数"
          :model-value="workspace.template.page.rows"
          :min="1"
          :max="30"
          @update:model-value="setGrid('rows', $event)"
        />
      </div>
      <div>
        <label class="field-label">{{ t('横向间距 (mm)') }}</label>
        <NumberField
          aria-label="横向间距 (mm)"
          :model-value="workspace.template.page.gapX"
          :step="0.5"
          :min="0"
          :max="50"
          @update:model-value="setGap('gapX', $event)"
        />
      </div>
      <div>
        <label class="field-label">{{ t('纵向间距 (mm)') }}</label>
        <NumberField
          aria-label="纵向间距 (mm)"
          :model-value="workspace.template.page.gapY"
          :step="0.5"
          :min="0"
          :max="50"
          @update:model-value="setGap('gapY', $event)"
        />
      </div>
      <div>
        <label class="field-label">{{ t('左右边距 (mm)') }}</label>
        <NumberField
          aria-label="左右边距 (mm)"
          :model-value="workspace.template.page.marginLeft"
          :step="0.5"
          :min="0"
          :max="100"
          @update:model-value="setMargin('marginLeft', $event), setMargin('marginRight', $event)"
        />
      </div>
      <div>
        <label class="field-label">{{ t('上下边距 (mm)') }}</label>
        <NumberField
          aria-label="上下边距 (mm)"
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
        :label="t('显示标签边框')"
      />
      <button type="button" class="btn btn-ghost btn-sm" @click="onCenterLayout">
        {{ t('阵列居中（自动均分边距）') }}
      </button>
    </div>

    <p
      v-if="hasOverflow"
      class="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs leading-4 text-red-700"
    >
      {{ t('当前排版超出纸面') }}（{{ currentPaperLabel }}）：
      <template v-if="overflow.x > 0">{{ t('横向超出') }} {{ overflow.x }}mm；</template>
      <template v-if="overflow.y > 0">{{ t('纵向超出') }} {{ overflow.y }}mm；</template>
      {{ t('请减小标签尺寸、行列数或边距，或换更大的纸张。') }}
    </p>
  </section>
</template>
