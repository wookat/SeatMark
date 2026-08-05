<script setup lang="ts">
import { computed, nextTick, ref, watch, watchEffect } from 'vue'

import LabelSheet from '@/components/label/LabelSheet.vue'
import CalibrationDialog from '@/components/studio/CalibrationDialog.vue'
import DuplexGuideDialog from '@/components/studio/DuplexGuideDialog.vue'
import CheckboxField from '@/components/ui/CheckboxField.vue'
import ModalDialog from '@/components/ui/ModalDialog.vue'
import SelectField, { type SelectOption } from '@/components/ui/SelectField.vue'
import { useElementSize } from '@/composables/useElementSize'
import { useAuthStore } from '@/stores/auth'
import { useCalibrationStore } from '@/stores/calibration'
import { useQuotaStore } from '@/stores/quota'
import { useToastStore } from '@/stores/toast'
import { useWorkspaceStore } from '@/stores/workspace'
import { MM_TO_PX } from '@/utils/layout'
import { paperLabel, setPrintPageSize } from '@/utils/paper'
import type { DataRow } from '@/types/template'
import {
  defaultRasterScale,
  estimatePdfBytes,
  exportPagedPdf,
  formatBytes,
  rasterDpi,
} from '@/utils/pdfExport'

const workspace = useWorkspaceStore()
const toast = useToastStore()
const quota = useQuotaStore()
const auth = useAuthStore()
const calibrationStore = useCalibrationStore()

const pageWidthPx = computed(() => workspace.template.page.paperWidth * MM_TO_PX)
const pageHeightPx = computed(() => workspace.template.page.paperHeight * MM_TO_PX)
const currentPaperLabel = computed(() => paperLabel(workspace.template.page))

/** 浏览器打印的 @page 尺寸跟随模板纸张；校准补偿同步注入打印样式 */
watchEffect(() => {
  setPrintPageSize(
    workspace.template.page.paperWidth,
    workspace.template.page.paperHeight,
    calibrationStore.calibration,
  )
})

/** 打印校准向导 */
const calibrationOpen = ref(false)
/** 双面/对折打印引导（镜像桌牌模板调起浏览器打印前弹出） */
const duplexGuideOpen = ref(false)

const previewContainer = ref<HTMLElement | null>(null)
const { width: containerWidth } = useElementSize(previewContainer)

const ZOOM_OPTIONS: SelectOption[] = [
  { value: 'fit', label: '适应宽度' },
  { value: '0.5', label: '50%' },
  { value: '0.75', label: '75%' },
  { value: '1', label: '100%' },
]

const zoomMode = ref('fit')
const scale = computed(() => {
  if (zoomMode.value === 'fit') {
    if (!containerWidth.value) return 0.6
    return Math.min((containerWidth.value - 24) / pageWidthPx.value, 1)
  }
  return Number(zoomMode.value)
})

const pageInput = ref(String(workspace.previewPage))
watch(
  () => workspace.previewPage,
  (value) => {
    pageInput.value = String(value)
  },
)

function jumpToPage() {
  if (!workspace.totalPages) return
  const page = Math.min(Math.max(Number(pageInput.value) || 1, 1), workspace.totalPages)
  workspace.previewPage = page
  pageInput.value = String(page)
}

// ---------- 导出 / 打印 ----------
const renderHost = ref(false)
const hostRef = ref<HTMLElement | null>(null)
/** 导出时仅挂载正在渲染的那一页（分页分批），null = 全部挂载（打印用） */
const hostPageIndex = ref<number | null>(null)
const hostPages = computed<(typeof workspace.pages)>(() =>
  hostPageIndex.value == null
    ? workspace.pages
    : workspace.pages.slice(hostPageIndex.value, hostPageIndex.value + 1),
)
/** 本次导出/打印是否叠加页脚角标水印（带水印不限次，无水印计入每日配额） */
const withWatermark = ref(false)
/** 导出方式选择弹窗：pdf = 图片版 PDF，print = 浏览器打印 */
const exportChoiceOpen = ref(false)
const pendingAction = ref<'pdf' | 'print'>('pdf')

/** 图片版 PDF 导出前的参数与体积预估（弹窗内展示，避免导出后才发现体积过大） */
const exportEstimate = computed(() => {
  const pageCount = workspace.totalPages
  if (!pageCount) return null
  const scale = defaultRasterScale(pageCount)
  const bytes = estimatePdfBytes({
    pageCount,
    scale,
    pageWidth: workspace.template.page.paperWidth,
    pageHeight: workspace.template.page.paperHeight,
  })
  return { pageCount, dpi: rasterDpi(scale), size: formatBytes(bytes) }
})

// ---------- 单张覆写（Edit One） ----------
const editRow = ref<DataRow | null>(null)
const editValues = ref<Record<string, string>>({})

const overriddenRows = computed(() => new Set(workspace.rowOverrides.keys()))
const editRowHasOverride = computed(
  () => editRow.value != null && !!workspace.overridesFor(editRow.value),
)

function openEditOne(row: DataRow) {
  const values: Record<string, string> = {}
  for (const field of workspace.mappableFields) {
    values[field.id] = workspace.fieldText(row, field.id)
  }
  editValues.value = values
  editRow.value = row
}

function saveEditOne() {
  const row = editRow.value
  if (!row) return
  const override: Record<string, string> = {}
  for (const field of workspace.mappableFields) {
    const value = editValues.value[field.id] ?? ''
    if (value !== workspace.baseFieldText(row, field.id)) override[field.id] = value
  }
  workspace.setRowOverride(row, override)
  editRow.value = null
  toast.success(
    Object.keys(override).length ? '单张覆写已保存' : '内容与名单一致，未保留覆写',
    '覆写只影响这一张标签；重新导入名单时会自动清除并提示',
  )
}

function clearEditOne() {
  if (editRow.value) workspace.clearRowOverride(editRow.value)
  editRow.value = null
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function mountHost(pageIndex: number | null = null) {
  hostPageIndex.value = pageIndex
  renderHost.value = true
  await nextTick()
  // 等在线字体就绪，避免栅格化/打印时字形回退
  try {
    await document.fonts.ready
  } catch {
    /* 旧浏览器无 fonts API：跳过 */
  }
  await sleep(pageIndex == null ? 250 : 60)
}

function unmountHost() {
  renderHost.value = false
  hostPageIndex.value = null
}

function openExportChoice(action: 'pdf' | 'print') {
  if (!workspace.excel.rows.length) return
  pendingAction.value = action
  exportChoiceOpen.value = true
}

/** 无水印导出：配额只在导出成功后消耗，失败/取消不扣次数 */
async function chooseClean() {
  if (quota.remaining <= 0) {
    quota.limitDialogOpen = true
    return
  }
  exportChoiceOpen.value = false
  withWatermark.value = false
  await runPendingAction()
}

async function chooseWatermarked() {
  exportChoiceOpen.value = false
  withWatermark.value = true
  await runPendingAction()
}

async function runPendingAction() {
  if (pendingAction.value === 'pdf') {
    await doExportPdf()
  } else if (workspace.hasMirrorFields) {
    // 对折双联（镜像）桌牌：打印前先弹双面/对折引导
    duplexGuideOpen.value = true
  } else {
    await doPrint()
  }
}

async function confirmDuplexPrint() {
  duplexGuideOpen.value = false
  await doPrint()
}

/** 导出/打印成功后消耗无水印配额（失败不扣，可直接重试） */
async function consumeQuotaAfterSuccess() {
  if (withWatermark.value) return
  await quota.tryConsume()
}

async function doExportPdf() {
  workspace.setLoading(true, '正在准备页面...')
  try {
    const pageCount = workspace.totalPages
    const scale = defaultRasterScale(pageCount)
    await exportPagedPdf({
      pageCount,
      // 分页分批：每次只挂载并栅格化一页，60+ 页任务内存占用恒定
      getPage: async (i) => {
        workspace.setLoading(true, `正在渲染第 ${i + 1}/${pageCount} 页...`)
        await mountHost(i)
        const el = hostRef.value?.querySelector<HTMLElement>('.sheet-page')
        if (!el) throw new Error('页面节点未挂载')
        return el
      },
      scale,
      pageWidth: workspace.template.page.paperWidth,
      pageHeight: workspace.template.page.paperHeight,
      calibration: calibrationStore.active ? calibrationStore.calibration : undefined,
      onProgress: (done, total) =>
        workspace.setLoading(true, `已完成 ${done}/${total} 页，正在写入 PDF...`),
    })
    await consumeQuotaAfterSuccess()
    toast.success(
      '图片版 PDF 已生成',
      `每页为 ${rasterDpi(scale)}dpi 高清栅格，放大打印仍清晰；文字需可选中请用「打印 / 矢量 PDF」`,
    )
  } catch (err) {
    toast.danger(
      'PDF 生成失败',
      `${err instanceof Error ? err.message : String(err)}；本次未扣除无水印次数，可直接重试`,
    )
  } finally {
    workspace.setLoading(false)
    unmountHost()
  }
}

/**
 * 浏览器打印：既是实体打印入口，也可选「另存为 PDF」导出矢量 PDF。
 */
async function doPrint() {
  workspace.setLoading(true, `正在准备 ${workspace.totalPages} 页打印内容...`)
  try {
    await mountHost()
  } finally {
    workspace.setLoading(false)
  }
  window.print()
  unmountHost()
  await consumeQuotaAfterSuccess()
  toast.info(
    '已调起浏览器打印',
    `目标打印机选「另存为 PDF」即可导出矢量 PDF；直接打印请用 ${currentPaperLabel.value} 纸张、无边距、缩放 100%`,
  )
}

// ---------- 开关说明（移动端可点击查看，不依赖 hover title） ----------
const HINTS: Record<string, { title: string; text: string }> = {
  cutSort: {
    title: '裁切排序（摞优先）',
    text: '多页叠齐一起裁切后，每摞标签天然按考场/座位号连续有序，免人工分拣。仅改变标签在页面上的排列顺序，不改变内容。',
  },
  mirror: {
    title: '对折双联（镜像）',
    text: '桌牌上半区 180° 镜像重复下半区内容，沿中线对折后两面都能正读。关闭后只印单面内容。',
  },
}
const hintKey = ref<keyof typeof HINTS | null>(null)
</script>

<template>
  <section class="flex h-full flex-col">
    <div
      class="no-print sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-white/95 px-3 py-2.5 shadow-card backdrop-blur sm:px-4"
    >
      <div class="flex items-center gap-1.5 text-xs">
        <span
          v-if="workspace.excel.rows.length"
          class="rounded-full bg-brand-50 px-2.5 py-1 font-bold text-brand-700"
        >
          {{ workspace.excel.rows.length }} 个标签
        </span>
        <span class="rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-500">
          {{ workspace.totalPages }} 页
        </span>
        <span class="rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-500">
          {{ currentPaperLabel }}
        </span>
      </div>

      <div v-if="workspace.totalPages > 0" class="flex items-center gap-1.5">
        <button
          type="button"
          class="btn btn-secondary btn-sm !px-2"
          aria-label="上一页"
          :disabled="workspace.previewPage <= 1"
          @click="workspace.previewPage--"
        >
          <svg
            class="size-3.5"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m10 4-4 4 4 4" />
          </svg>
        </button>
        <div class="flex items-center gap-1 text-xs text-slate-500">
          <input
            v-model="pageInput"
            type="number"
            min="1"
            :max="workspace.totalPages"
            class="input-field w-14 text-center"
            @change="jumpToPage"
            @keyup.enter="jumpToPage"
          />
          <span>/ {{ workspace.totalPages }}</span>
        </div>
        <button
          type="button"
          class="btn btn-secondary btn-sm !px-2"
          aria-label="下一页"
          :disabled="workspace.previewPage >= workspace.totalPages"
          @click="workspace.previewPage++"
        >
          <svg
            class="size-3.5"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m6 4 4 4-4 4" />
          </svg>
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <SelectField v-model="zoomMode" class="w-24" size="sm" :options="ZOOM_OPTIONS" />
        <CheckboxField
          v-model="workspace.showCutLines"
          class="text-xs font-semibold text-slate-600"
          label="裁切线"
        />
        <CheckboxField
          v-model="workspace.highlightMissing"
          tone="amber"
          class="text-xs font-semibold text-slate-600"
          label="高亮缺失"
        />
        <span
          v-if="workspace.totalPages > 1 || workspace.cutStackSort"
          class="flex items-center gap-0.5"
        >
          <CheckboxField
            v-model="workspace.cutStackSort"
            class="text-xs font-semibold text-slate-600"
            :title="HINTS.cutSort!.text"
            label="裁切排序"
          />
          <button
            type="button"
            class="grid size-4 place-items-center rounded-full text-slate-400 hover:text-slate-600"
            aria-label="裁切排序说明"
            @click="hintKey = 'cutSort'"
          >
            <svg class="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="8" cy="8" r="6.4" />
              <path d="M6.4 6.2a1.6 1.6 0 1 1 2.4 1.4c-.5.3-.8.6-.8 1.2m0 2h.01" />
            </svg>
          </button>
        </span>
        <span v-if="workspace.hasMirrorFields" class="flex items-center gap-0.5">
          <CheckboxField
            v-model="workspace.showMirror"
            class="text-xs font-semibold text-slate-600"
            :title="HINTS.mirror!.text"
            label="对折双联（镜像）"
          />
          <button
            type="button"
            class="grid size-4 place-items-center rounded-full text-slate-400 hover:text-slate-600"
            aria-label="对折双联说明"
            @click="hintKey = 'mirror'"
          >
            <svg class="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="8" cy="8" r="6.4" />
              <path d="M6.4 6.2a1.6 1.6 0 1 1 2.4 1.4c-.5.3-.8.6-.8 1.2m0 2h.01" />
            </svg>
          </button>
        </span>
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          :title="calibrationStore.active ? '打印校准已生效：导出与打印自动应用偏移/缩放补偿' : '打印跑偏、尺寸不准？打印一页标尺校准页，量两下即可全局补偿'"
          @click="calibrationOpen = true"
        >
          <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 17 17 3l4 4L7 21H3v-4zM14 6l4 4M9 11l1.5 1.5M11.5 8.5 13 10" />
          </svg>
          打印校准<span
            v-if="calibrationStore.active"
            class="ml-0.5 size-1.5 rounded-full bg-emerald-500"
            aria-label="校准已生效"
          ></span>
        </button>
        <button
          type="button"
          class="btn btn-primary btn-sm relative"
          title="经浏览器打印对话框输出：选「另存为 PDF」可得到矢量 PDF；直接打印请用对应纸张、无边距、缩放 100%"
          :disabled="!workspace.excel.rows.length"
          @click="openExportChoice('print')"
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
            <path d="M7 8V3h10v5M7 17H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3m-10-3h10v7H7v-7z" />
          </svg>
          打印<span class="hidden sm:inline"> / 矢量 PDF</span>
          <span
            class="absolute -top-2 -right-1.5 rounded-full px-1.5 py-px text-[9px] font-bold"
            :class="quota.remaining > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'"
            :title="`今日无水印导出剩余 ${quota.remaining}/${quota.limit} 次；带水印不限次`"
          >无水印 {{ quota.remaining }}</span>
        </button>
        <button
          type="button"
          class="btn btn-secondary btn-sm relative"
          title="逐页渲染为高清图片后合成 PDF，所见即所得、任何设备打开都一致（推荐）；文字不可选中，如需矢量文字请用「打印 / 矢量 PDF」"
          :disabled="!workspace.excel.rows.length || workspace.loading.active"
          @click="openExportChoice('pdf')"
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
            <path d="M12 4v12m0 0 5-5m-5 5-5-5M4 20h16" />
          </svg>
          图片版 PDF<span class="hidden sm:inline">（推荐）</span>
          <span
            class="absolute -top-2 -right-1.5 rounded-full px-1.5 py-px text-[9px] font-bold"
            :class="quota.remaining > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'"
            :title="`今日无水印导出剩余 ${quota.remaining}/${quota.limit} 次；带水印不限次`"
          >无水印 {{ quota.remaining }}</span>
        </button>
      </div>
    </div>

    <div
      ref="previewContainer"
      class="no-print mt-3 flex-1 overflow-auto rounded-lg border border-slate-200/80 bg-[radial-gradient(circle,#cbd5e1_1px,transparent_1px)] bg-slate-100/70 bg-[size:16px_16px] p-3 shadow-[inset_0_1px_3px_rgba(15,23,42,0.05)]"
    >
      <div v-if="!workspace.excel.rows.length" class="flex h-full items-center justify-center py-12">
        <div class="max-w-xs text-center">
          <div
            class="mx-auto grid w-44 grid-cols-2 gap-1.5 rounded-lg border border-slate-200 bg-white p-3 shadow-card"
          >
            <div
              v-for="n in 8"
              :key="n"
              class="h-7 animate-pulse rounded-sm bg-slate-100"
              :style="{ animationDelay: `${n * 80}ms` }"
            ></div>
          </div>
          <h3 class="mt-4 text-sm font-bold text-slate-800">还没有名单数据</h3>
          <p class="mt-1.5 text-xs leading-5 text-slate-500">
            在左侧「导入数据」上传 Excel 后，这里会实时显示按毫米排版的真实打印效果
          </p>
          <button
            type="button"
            class="btn btn-secondary btn-sm mt-3"
            @click="workspace.useDemoData()"
          >
            先用演示数据看看效果
          </button>
        </div>
      </div>

      <div v-else class="flex justify-center">
        <div
          class="relative origin-top-left"
          :style="{ width: `${pageWidthPx * scale}px`, height: `${pageHeightPx * scale}px` }"
        >
          <div class="absolute top-0 left-0 origin-top-left" :style="{ transform: `scale(${scale})` }">
            <LabelSheet
              :template="workspace.renderTemplate"
              :rows="workspace.currentPageRows"
              :get-text="workspace.fieldText"
              :get-photo="workspace.photoFor"
              :show-cut-lines="workspace.showCutLines"
              :highlight-missing="workspace.highlightMissing"
              :overridden-rows="overriddenRows"
              screen
              interactive
              @label-click="openEditOne"
            />
          </div>
        </div>
      </div>
    </div>

    <ModalDialog
      :open="exportChoiceOpen"
      :title="pendingAction === 'pdf' ? '导出图片版 PDF（推荐）' : '打印 / 矢量 PDF'"
      size="md"
      @close="exportChoiceOpen = false"
    >
      <p class="leading-6">选择导出方式：</p>
      <p
        v-if="pendingAction === 'pdf' && exportEstimate"
        class="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500"
      >
        共 {{ exportEstimate.pageCount }} 页 · 每页约 {{ exportEstimate.dpi }}dpi ·
        预估体积约 <span class="font-bold text-slate-700">{{ exportEstimate.size }}</span>（按页数自适应清晰度与压缩）
      </p>
      <div class="mt-3 grid gap-3">
        <button
          type="button"
          class="flex items-start gap-3 rounded-lg border p-4 text-left transition-colors"
          :class="quota.remaining > 0 ? 'border-brand-200 bg-brand-50 hover:border-brand-300' : 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-70'"
          :disabled="quota.remaining <= 0"
          @click="chooseClean"
        >
          <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m5 13 4 4 10-11" />
            </svg>
          </span>
          <span>
            <span class="block text-sm font-bold text-slate-900">无水印导出（今日剩余 {{ quota.remaining }} 次）</span>
            <span class="mt-0.5 block text-xs leading-5 text-slate-500">
              {{ quota.remaining > 0 ? '页面不叠加任何标识' : (auth.isLoggedIn ? '今日已用完，分享链接每被点开 1 次即得 1 次，或明日 0 点恢复' : '今日已用完，登录后每天 3 次，还可分享送次数') }}
            </span>
          </span>
        </button>
        <button
          type="button"
          class="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-slate-300"
          @click="chooseWatermarked"
        >
          <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-600 text-white">
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3v18M3 12h18" />
            </svg>
          </span>
          <span>
            <span class="block text-sm font-bold text-slate-900">带水印导出（不限次数）</span>
            <span class="mt-0.5 block text-xs leading-5 text-slate-500">
              页脚叠加「SeatMark 座签 · seatmark.cn」角标，位于页边距区域，不遮挡标签内容
            </span>
          </span>
        </button>
      </div>
      <p v-if="!auth.isLoggedIn" class="mt-3 text-xs leading-5 text-slate-400">
        登录后无水印导出每天 3 次，分享链接每被点开 1 次再得 1 次；同时获得 Beta 专业版免费试用。
      </p>
    </ModalDialog>

    <ModalDialog
      :open="editRow != null"
      title="单张覆写：只改这一张标签"
      size="md"
      @close="editRow = null"
    >
      <p class="text-xs leading-5 text-slate-500">
        修改只影响这一张标签，不改动名单数据；重新导入名单时覆写会自动清除并提示。
      </p>
      <div class="mt-3 grid gap-2.5">
        <div v-for="field in workspace.mappableFields" :key="field.id">
          <label class="field-label">{{ field.label || field.id }}</label>
          <input v-model="editValues[field.id]" type="text" class="input-field w-full" />
        </div>
      </div>
      <div class="mt-4 flex flex-wrap items-center justify-end gap-2">
        <button
          v-if="editRowHasOverride"
          type="button"
          class="btn btn-secondary btn-sm mr-auto text-amber-600"
          @click="clearEditOne"
        >
          清除本张覆写
        </button>
        <button type="button" class="btn btn-secondary btn-sm" @click="editRow = null">取消</button>
        <button type="button" class="btn btn-primary btn-sm" @click="saveEditOne">保存覆写</button>
      </div>
    </ModalDialog>

    <CalibrationDialog :open="calibrationOpen" @close="calibrationOpen = false" />

    <DuplexGuideDialog
      :open="duplexGuideOpen"
      @close="duplexGuideOpen = false"
      @confirm="confirmDuplexPrint"
    />

    <ModalDialog
      :open="hintKey != null"
      :title="hintKey ? HINTS[hintKey]!.title : ''"
      size="md"
      @close="hintKey = null"
    >
      <p class="text-sm leading-6 text-slate-600">{{ hintKey ? HINTS[hintKey]!.text : '' }}</p>
    </ModalDialog>

    <Teleport to="body">
      <div v-if="renderHost" ref="hostRef" class="offscreen-host">
        <LabelSheet
          v-for="(pageRows, i) in hostPages"
          :key="hostPageIndex != null ? hostPageIndex : i"
          :template="workspace.renderTemplate"
          :rows="pageRows"
          :get-text="workspace.fieldText"
          :get-photo="workspace.photoFor"
          :show-cut-lines="workspace.showCutLines"
          :watermark="withWatermark"
        />
      </div>
    </Teleport>
  </section>
</template>
