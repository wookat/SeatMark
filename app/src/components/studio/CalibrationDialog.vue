<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

import ModalDialog from '@/components/ui/ModalDialog.vue'
import NumberField from '@/components/ui/NumberField.vue'
import { t } from '@/i18n'
import { useCalibrationStore } from '@/stores/calibration'
import { useToastStore } from '@/stores/toast'
import { useWorkspaceStore } from '@/stores/workspace'
import {
  computeCalibration,
  downloadCalibrationPdf,
  isCalibrationActive,
  isCalibrationReasonable,
  nominalFrame,
} from '@/utils/calibration'
import { paperLabel } from '@/utils/paper'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const workspace = useWorkspaceStore()
const calibrationStore = useCalibrationStore()
const toast = useToastStore()

const paperW = computed(() => workspace.template.page.paperWidth)
const paperH = computed(() => workspace.template.page.paperHeight)
const nominal = computed(() => nominalFrame(paperW.value, paperH.value))

/** 实测值输入，打开时预填名义值（未偏移的理想情况） */
const measured = reactive({ left: 0, top: 0, frameWidth: 0, frameHeight: 0 })

watch(
  () => [props.open, nominal.value] as const,
  () => {
    if (!props.open) return
    measured.left = nominal.value.left
    measured.top = nominal.value.top
    measured.frameWidth = nominal.value.frameWidth
    measured.frameHeight = nominal.value.frameHeight
  },
  { immediate: true },
)

const result = computed(() =>
  computeCalibration(measured, paperW.value, paperH.value),
)
const resultActive = computed(() => isCalibrationActive(result.value))
const resultReasonable = computed(() => isCalibrationReasonable(result.value))

async function onDownload() {
  try {
    await downloadCalibrationPdf(paperW.value, paperH.value)
    toast.success(t('校准页已下载'), t('请用目标打印机按 100% 实际大小、无边距打印这一页'))
  } catch (err) {
    toast.danger(t('校准页生成失败'), err instanceof Error ? err.message : String(err))
  }
}

function onSave() {
  calibrationStore.apply(result.value)
  toast.success(
    t('打印校准已保存'),
    t('之后所有导出与打印会自动应用偏移与缩放补偿，仅存于本机浏览器'),
  )
  emit('close')
}

function onReset() {
  calibrationStore.reset()
  toast.info(t('已清除校准'), t('导出与打印恢复为不做任何补偿'))
}

const fmtMm = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)} mm`
const fmtScale = (v: number) => `${(v * 100).toFixed(2)}%`
</script>

<template>
  <ModalDialog :open="open" :title="t('打印校准向导')" size="lg" @close="emit('close')">
    <div class="space-y-4">
      <p class="leading-6">
        {{ t('打印跑偏、尺寸不准多因打印机存在固有偏移或缩放误差。按下面三步做一次校准，补偿参数保存在本机浏览器，之后所有导出与打印自动应用。') }}
        {{ t('详细排障说明见') }}<a href="/guides/print-offset-calibration-wizard" target="_blank" class="font-semibold text-brand-600 hover:underline">{{ t('打印偏移排障教程') }}</a>{{ t('。') }}
      </p>

      <!-- 第一步 -->
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h4 class="flex items-center gap-2 text-sm font-bold text-slate-900">
          <span class="flex size-5 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">1</span>
          {{ t('打印标尺校准页（{paper}）').replace('{paper}', paperLabel(workspace.template.page)) }}
        </h4>
        <p class="mt-1.5 text-xs leading-5 text-slate-600">
          {{ t('下载并用') }}<strong>{{ t('目标打印机') }}</strong>{{ t('打印这一页：缩放选「实际大小 / 100%」，不要选「适应页面」，边距设为无。') }}
        </p>
        <button type="button" class="btn btn-secondary btn-sm mt-2.5" @click="onDownload">
          <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 4v12m0 0 5-5m-5 5-5-5M4 20h16" />
          </svg>
          {{ t('下载校准页 PDF') }}
        </button>
      </div>

      <!-- 第二步 -->
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h4 class="flex items-center gap-2 text-sm font-bold text-slate-900">
          <span class="flex size-5 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">2</span>
          {{ t('用直尺量取 4 个实测值（mm）') }}
        </h4>
        <p class="mt-1.5 text-xs leading-5 text-slate-600">
          {{
            t('设计值：基准框距纸张左、上边缘各 {left} mm，框宽 {w} mm、框高 {h} mm。请量取打印出来的实际值：')
              .replace('{left}', String(nominal.left))
              .replace('{w}', String(nominal.frameWidth))
              .replace('{h}', String(nominal.frameHeight))
          }}
        </p>
        <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label class="block">
            <span class="mb-1 block text-xs font-semibold text-slate-600">{{ t('左边距') }}</span>
            <NumberField v-model="measured.left" :step="0.5" :min="0" />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-semibold text-slate-600">{{ t('上边距') }}</span>
            <NumberField v-model="measured.top" :step="0.5" :min="0" />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-semibold text-slate-600">{{ t('框宽') }}</span>
            <NumberField v-model="measured.frameWidth" :step="0.5" :min="1" />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-semibold text-slate-600">{{ t('框高') }}</span>
            <NumberField v-model="measured.frameHeight" :step="0.5" :min="1" />
          </label>
        </div>
      </div>

      <!-- 第三步 -->
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h4 class="flex items-center gap-2 text-sm font-bold text-slate-900">
          <span class="flex size-5 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">3</span>
          {{ t('保存补偿参数') }}
        </h4>
        <div class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-4">
          <span>{{ t('水平偏移') }} <strong class="text-slate-900">{{ fmtMm(result.offsetX) }}</strong></span>
          <span>{{ t('垂直偏移') }} <strong class="text-slate-900">{{ fmtMm(result.offsetY) }}</strong></span>
          <span>{{ t('水平缩放') }} <strong class="text-slate-900">{{ fmtScale(result.scaleX) }}</strong></span>
          <span>{{ t('垂直缩放') }} <strong class="text-slate-900">{{ fmtScale(result.scaleY) }}</strong></span>
        </div>
        <p v-if="!resultActive" class="mt-2 text-xs leading-5 text-slate-600">
          {{ t('实测值与设计值一致，无需补偿——你的打印机很准。') }}
        </p>
        <p v-else-if="!resultReasonable" class="mt-2 text-xs leading-5 text-amber-600">
          {{ t('计算出的补偿超出常见打印机误差范围，请复核量取值与打印缩放设置（必须为 100%）后重试。') }}
        </p>
      </div>

      <div v-if="calibrationStore.active" class="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
        <svg class="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m5 13 4 4 10-11" />
        </svg>
        {{
          t('当前已有生效的校准（偏移 {ox} / {oy}，缩放 {sx} / {sy}），保存将覆盖。')
            .replace('{ox}', fmtMm(calibrationStore.calibration.offsetX))
            .replace('{oy}', fmtMm(calibrationStore.calibration.offsetY))
            .replace('{sx}', fmtScale(calibrationStore.calibration.scaleX))
            .replace('{sy}', fmtScale(calibrationStore.calibration.scaleY))
        }}
      </div>
    </div>

    <template #actions>
      <button
        v-if="calibrationStore.active"
        type="button"
        class="btn btn-ghost btn-md mr-auto text-red-600"
        @click="onReset"
      >
        {{ t('清除校准') }}
      </button>
      <button type="button" class="btn btn-ghost btn-md" @click="emit('close')">{{ t('取消') }}</button>
      <button
        type="button"
        class="btn btn-primary btn-md"
        :disabled="!resultReasonable"
        @click="onSave"
      >
        {{ t('保存并全局应用') }}
      </button>
    </template>
  </ModalDialog>
</template>
