<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch, watchEffect } from 'vue'

import LabelSheet from '@/components/label/LabelSheet.vue'
import CalibrationDialog from '@/components/studio/CalibrationDialog.vue'
import DuplexGuideDialog from '@/components/studio/DuplexGuideDialog.vue'
import CheckboxField from '@/components/ui/CheckboxField.vue'
import ModalDialog from '@/components/ui/ModalDialog.vue'
import SelectField, { type SelectOption } from '@/components/ui/SelectField.vue'
import { useElementSize } from '@/composables/useElementSize'
import { t } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useCalibrationStore } from '@/stores/calibration'
import { QUOTA_USER_DAILY, useQuotaStore } from '@/stores/quota'
import { useToastStore } from '@/stores/toast'
import { useWorkspaceStore } from '@/stores/workspace'
import { dismissStudioGuide } from '@/utils/firstVisit'
import { labelPosition, labelsPerPage, MM_TO_PX } from '@/utils/layout'
import { paperLabel, setPrintPageSize } from '@/utils/paper'
import {
  deliverPdfForMobilePrint,
  isMobilePrintEnvironment,
  printAndWaitUntilDone,
} from '@/utils/printing'
import { copyToClipboard } from '@/utils/share'
import type { DataRow } from '@/types/template'
import {
  adaptiveRasterScale,
  defaultPdfFileName,
  estimatePdfBytes,
  EXPORT_CANCELLED_MESSAGE,
  exportPagedPdf,
  FONTS_READY_WAIT_MS,
  formatBytes,
  rasterDpi,
  settleWithin,
} from '@/utils/pdfExport'
import {
  buildFieldFileNames,
  defaultPngExportName,
  EINK_PRESETS,
  exactPixelHeight,
  exactPixelNamePrefix,
  exportPagedPng,
  findEinkPreset,
  isValidExactPixelWidth,
  MAX_EXACT_PIXEL_WIDTH,
  MIN_EXACT_PIXEL_WIDTH,
  presetAspectMismatch,
  sanitizeFileNamePart,
  type LabelExportItem,
} from '@/utils/pngExport'
import { templateColumnsValid } from '@/utils/fieldTemplate'

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

const ZOOM_OPTIONS = computed<SelectOption[]>(() => [
  { value: 'fit', label: t('适应宽度') },
  { value: 'fitLabel', label: t('适应单枚') },
  { value: '0.5', label: '50%' },
  { value: '0.75', label: '75%' },
  { value: '1', label: '100%' },
  { value: '1.5', label: '150%' },
  { value: '2', label: '200%' },
])

/** 小屏（<sm）整页适应宽度会把姓名缩到不可读，默认改为「适应单枚」；桌面端仍默认整页 */
const zoomMode = ref(
  typeof window !== 'undefined' && window.matchMedia?.('(max-width: 639px)').matches
    ? 'fitLabel'
    : 'fit',
)
/** 小屏下把低频显示选项（裁切线/高亮缺失/裁切排序/对折双联/打印校准）收进「显示选项」，避免工具栏折成四行 */
const displayOptionsOpen = ref(false)
const displayOptionsActiveCount = computed(() =>
  [
    workspace.showCutLines,
    workspace.highlightMissing,
    workspace.cutStackSort,
    workspace.hasMirrorFields && workspace.showMirror,
    calibrationStore.active,
  ].filter(Boolean).length,
)
const scale = computed(() => {
  if (zoomMode.value === 'fit') {
    if (!containerWidth.value) return 0.6
    return Math.min((containerWidth.value - 24) / pageWidthPx.value, 1)
  }
  if (zoomMode.value === 'fitLabel') {
    const labelWidthPx = workspace.template.label.width * MM_TO_PX
    if (!containerWidth.value || !labelWidthPx) return 1
    return Math.min((containerWidth.value - 24) / labelWidthPx, 3)
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
/** 导出文件名前缀跟随当前模板名（如「婚礼席位卡」），下载目录里一眼可辨 */
const exportNamePrefix = computed(
  () => sanitizeFileNamePart(workspace.template.name) || '考场座位标签',
)
/** 本次导出/打印是否叠加页脚角标水印（带水印不限次，无水印计入每日配额） */
const withWatermark = ref(false)
/**
 * 打印宿主是否渲染 DOM 徽章水印：纯黑白 PNG 导出时不渲染 ——
 * 半透明水印经二值化后可能以纯黑残留，与导出器补盖的纯黑水印行叠在一起；
 * 该路径由 pngExport 在二值化后统一补盖纯黑水印（watermarkText）
 */
const hostWatermark = computed(
  () => withWatermark.value && !(pendingAction.value === 'png' && pngMonochrome.value),
)
/** 导出方式选择弹窗：pdf = 图片版 PDF，print = 浏览器打印，png = 图片 PNG */
const exportChoiceOpen = ref(false)
const pendingAction = ref<'pdf' | 'print' | 'png'>('pdf')

// ---------- PNG 导出参数 ----------
/** 成图单位：label = 按标签逐张成图（默认）；page = 整页成图 */
const pngExportUnit = ref<'label' | 'page'>('label')
/** 尺寸模式：standard = 300dpi 基准（小标签自动提清）；exact = 精确像素（电子墨水屏等场景） */
const pngSizeMode = ref<'standard' | 'exact'>('standard')
/** 精确像素目标宽度；高度按模板宽高比自动推导 */
const pngExactWidth = ref(800)
/** 纯黑白输出（电子墨水屏只认纯黑纯白） */
const pngMonochrome = ref(false)

/** 电子座签模板：默认精确 800×480 + 纯黑白 */
const isEinkTemplate = computed(() => workspace.template.id === 'eink800')

/** 分辨率预设：custom = 自定义宽度（高度按模板比例推导）；其余为电子墨水屏常见规格精确像素 */
const pngPresetId = ref('custom')
/** 多页 zip 文件命名：seq = 序号命名（前缀-001）；field = 按名单字段命名 */
const pngNameMode = ref<'seq' | 'field'>('seq')
/** 字段命名模板串，如 {姓名}-{考场} */
const pngNameTemplate = ref('')

watch(
  () => workspace.template.id,
  () => {
    pngSizeMode.value = isEinkTemplate.value ? 'exact' : 'standard'
    pngPresetId.value = isEinkTemplate.value ? 'eink-800x480' : 'custom'
    pngExactWidth.value = 800
    pngMonochrome.value = isEinkTemplate.value
  },
  { immediate: true },
)

const PNG_PRESET_OPTIONS = computed<SelectOption[]>(() => [
  { value: 'custom', label: t('自定义宽度（高度按模板比例）') },
  ...EINK_PRESETS.map((p) => ({ value: p.id, label: p.label })),
])

const pngPreset = computed(() => findEinkPreset(pngPresetId.value))

/** 选中预设时同步宽度并建议纯黑白（电子墨水屏只认纯黑纯白，可手动取消） */
watch(pngPreset, (preset) => {
  if (!preset) return
  pngExactWidth.value = preset.width
  pngMonochrome.value = true
})

const PNG_NAME_OPTIONS = computed<SelectOption[]>(() => [
  { value: 'seq', label: t('序号命名（前缀-001.png）') },
  { value: 'field', label: t('按名单字段命名（如 张三-第1考场.png）') },
])

const PNG_UNIT_OPTIONS = computed<SelectOption[]>(() => [
  { value: 'label', label: t('按标签逐张导出（每一张标签一张 PNG，推荐）') },
  { value: 'page', label: t('按整页导出（每页纸张一张 PNG）') },
])

/** 逐标签导出的总枚数（跳过裁切排序等产生的空位） */
const pngTotalLabels = computed(() =>
  workspace.pages.reduce((sum, page) => sum + page.filter((row) => row != null).length, 0),
)

/** 命名模板默认取第一列（多为姓名）；切换到字段命名且为空时填入 */
watch(pngNameMode, (mode) => {
  if (mode === 'field' && !pngNameTemplate.value.trim() && workspace.excel.headers.length) {
    pngNameTemplate.value = `{${workspace.excel.headers[0]}}`
  }
})

function appendNameField(header: string) {
  pngNameTemplate.value += `{${header}}`
}

const pngNameTemplateValid = computed(
  () =>
    !pngNameTemplate.value.trim() ||
    templateColumnsValid(pngNameTemplate.value, workspace.excel.headers),
)

const PNG_SIZE_OPTIONS = computed<SelectOption[]>(() => [
  { value: 'standard', label: t('标准清晰度（300dpi，小标签自动提清）') },
  { value: 'exact', label: isEinkTemplate.value ? t('精确像素（电子墨水屏 800×480）') : t('精确像素（自定义宽度）') },
])

const pngExactWidthValid = computed(() => isValidExactPixelWidth(pngExactWidth.value))

/**
 * 精确像素模式的设计区域（mm）：每页 1 枚的模板（如电子座签）取标签本体，
 * 不含纸张留白边距；多枚模板取整页
 */
const pngCropRect = computed(() => {
  const template = workspace.renderTemplate
  if (labelsPerPage(template) !== 1) return null
  const pos = labelPosition(template, 0)
  return { x: pos.left, y: pos.top, width: template.label.width, height: template.label.height }
})

const pngDesignRect = computed(() => {
  if (pngExportUnit.value === 'label') {
    const { label } = workspace.renderTemplate
    return { width: label.width, height: label.height }
  }
  return (
    pngCropRect.value ?? {
      width: workspace.template.page.paperWidth,
      height: workspace.template.page.paperHeight,
    }
  )
})

const pngExactHeight = computed(() => {
  const preset = pngPreset.value
  if (preset) return preset.height
  if (!pngExactWidthValid.value) return 0
  return exactPixelHeight(pngExactWidth.value, pngDesignRect.value.width, pngDesignRect.value.height)
})

/** 预设比例与模板设计区域不一致时提示会拉伸，建议换模板或自定义宽度 */
const pngPresetStretch = computed(() => {
  const preset = pngPreset.value
  if (!preset) return false
  return presetAspectMismatch(preset, pngDesignRect.value.width, pngDesignRect.value.height)
})

/** 图片版 PDF 导出前的参数与体积预估（弹窗内展示，避免导出后才发现体积过大） */
const exportEstimate = computed(() => {
  const pageCount = workspace.totalPages
  if (!pageCount) return null
  const scale = adaptiveRasterScale(pageCount, workspace.renderTemplate.label)
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

/**
 * 导出成功后的轻量转化提示：带水印导出后温和告知「去除水印」路径（登录/分享），
 * 无水印导出后引导分享送次数。每会话至多 2 次、每天至多 2 次，关闭即消失，不打断操作
 */
const SHARE_PROMPT_KEY = 'seatmark.post-export-share-prompt.v2'
const SHARE_PROMPT_MAX = 2
let sharePromptSessionCount = 0
const sharePromptVisible = ref(false)
/** 本次提示对应的导出是否带水印（决定文案侧重：去水印 vs 分享送次数） */
const sharePromptWatermarked = ref(false)

/** 本地时区的当天日期（分享引导频控按用户本地 0 点重置） */
function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function maybeShowSharePrompt() {
  if (sharePromptSessionCount >= SHARE_PROMPT_MAX) return
  try {
    const raw = localStorage.getItem(SHARE_PROMPT_KEY)
    let count = 0
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<{ date: string; count: number }>
      if (parsed.date === todayStr() && typeof parsed.count === 'number') count = parsed.count
    }
    if (count >= SHARE_PROMPT_MAX) return
    localStorage.setItem(SHARE_PROMPT_KEY, JSON.stringify({ date: todayStr(), count: count + 1 }))
  } catch {
    /* 隐私模式：不持久化，按会话计数展示 */
  }
  sharePromptSessionCount += 1
  sharePromptWatermarked.value = withWatermark.value
  sharePromptVisible.value = true
  // 转化提示与单张覆写小技巧同屏会在小屏堆叠遮挡预览，一次只保留一层
  dismissEditOneHint()
}

function dismissSharePrompt() {
  sharePromptVisible.value = false
}

// 配额引导弹窗是最强转化时机，独占屏幕：打开时收起分享提示条，避免双登录 CTA 同屏竞争
watch(
  () => quota.limitDialogOpen,
  (open) => {
    if (open) dismissSharePrompt()
  },
)

async function copyReferralLink() {
  const code = auth.user?.share.code
  if (!code) return
  if (await copyToClipboard(`https://www.seatmark.cn/?ref=${code}`)) {
    toast.success('分享链接已复制', '发给同事或群聊，每被点开 1 次即得 1 次无水印导出')
  } else {
    toast.warning('复制失败', '可到个人中心手动复制专属分享链接')
  }
  dismissSharePrompt()
}

/** Edit One 首次使用引导气泡：只展示一次，关闭或用过一次后不再出现 */
const EDIT_ONE_HINT_KEY = 'seatmark.edit-one-hint-dismissed.v1'
const editOneHintVisible = ref(false)

onMounted(() => {
  try {
    editOneHintVisible.value = !localStorage.getItem(EDIT_ONE_HINT_KEY)
  } catch {
    editOneHintVisible.value = false
  }
})

function dismissEditOneHint() {
  editOneHintVisible.value = false
  try {
    localStorage.setItem(EDIT_ONE_HINT_KEY, '1')
  } catch {
    /* 隐私模式：下次仍会展示，可接受 */
  }
}

function openEditOne(row: DataRow) {
  if (editOneHintVisible.value) dismissEditOneHint()
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

/** 逐标签导出时临时关掉离屏宿主的裁切线：单枚标签图上的裁切线只会成为杂线 */
const hostSuppressCutLines = ref(false)

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function mountHost(pageIndex: number | null = null) {
  hostPageIndex.value = pageIndex
  renderHost.value = true
  await nextTick()
  // 等在线字体就绪，避免栅格化/打印时字形回退；
  // 带上限：在线字体加载卡死时 fonts.ready 可能永不落定，不允许拖死导出/打印
  if ('fonts' in document) {
    await settleWithin(document.fonts.ready.then(() => undefined), FONTS_READY_WAIT_MS)
  }
  // 双 requestAnimationFrame：确保浏览器完成布局与绘制后再截图/打印
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
  await sleep(pageIndex == null ? 250 : 60)
}

function unmountHost() {
  renderHost.value = false
  hostPageIndex.value = null
}

/** 重建离屏容器：卸掉 Teleport 内的宿主节点后等完成 DOM 移除，下次 getPage 会重新挂载 */
async function rebuildHost() {
  unmountHost()
  await nextTick()
}

function openExportChoice(action: 'pdf' | 'print' | 'png') {
  if (!workspace.excel.rows.length) return
  pendingAction.value = action
  exportChoiceOpen.value = true
}

/** 无水印导出：配额只在导出成功后消耗，失败/取消不扣次数 */
async function chooseClean() {
  if (quota.remaining <= 0) {
    // 先关导出选择框再开配额引导弹窗，避免两层 modal 叠加遮挡
    exportChoiceOpen.value = false
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
  } else if (pendingAction.value === 'png') {
    await doExportPng()
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
  // 拿到过一次成品即视为老用户，首访三步引导不再展示
  dismissStudioGuide()
  if (withWatermark.value) return
  await quota.tryConsume()
}

async function doExportPdf() {
  const abort = new AbortController()
  const cancel = () => abort.abort()
  workspace.setLoading(true, '正在准备页面...', cancel)
  try {
    const pageCount = workspace.totalPages
    // 渲染倍率按标签物理尺寸自适应：大尺寸桌牌降档避免过采样
    const scale = adaptiveRasterScale(pageCount, workspace.renderTemplate.label)
    await exportPagedPdf({
      pageCount,
      signal: abort.signal,
      // 分页分批：每次只挂载并栅格化一页，60+ 页任务内存占用恒定
      getPage: async (i) => {
        workspace.setLoading(true, `正在渲染第 ${i + 1}/${pageCount} 页...`, cancel)
        await mountHost(i)
        const el = hostRef.value?.querySelector<HTMLElement>('.sheet-page')
        if (!el) throw new Error('页面节点未挂载')
        return el
      },
      rebuildHost,
      scale,
      pageWidth: workspace.template.page.paperWidth,
      pageHeight: workspace.template.page.paperHeight,
      calibration: calibrationStore.active ? calibrationStore.calibration : undefined,
      fileName: defaultPdfFileName(exportNamePrefix.value),
      onProgress: (done, total) =>
        workspace.setLoading(true, `已完成 ${done}/${total} 页，正在写入 PDF...`, cancel),
    })
    await consumeQuotaAfterSuccess()
    toast.success(
      t('图片版 PDF 已生成'),
      t('每页为 {dpi}dpi 高清栅格，放大打印仍清晰；文字需可选中请用「打印 / 矢量 PDF」').replace('{dpi}', String(rasterDpi(scale))),
    )
    maybeShowSharePrompt()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message === EXPORT_CANCELLED_MESSAGE) {
      toast.info('已取消导出', '本次未扣除无水印次数，可随时重新导出')
    } else {
      toast.danger('PDF 生成失败', `${message}；本次未扣除无水印次数，可直接重试`)
    }
  } finally {
    workspace.setLoading(false)
    unmountHost()
  }
}

async function doExportPng() {
  if (pngSizeMode.value === 'exact' && !pngPreset.value && !pngExactWidthValid.value) {
    toast.warning('像素宽度无效', `请输入 ${MIN_EXACT_PIXEL_WIDTH}–${MAX_EXACT_PIXEL_WIDTH} 之间的整数像素宽度`)
    return
  }
  const abort = new AbortController()
  const cancel = () => abort.abort()
  workspace.setLoading(true, '正在准备页面...', cancel)
  try {
    const pageCount = workspace.totalPages
    const exact = pngSizeMode.value === 'exact'
    const perLabel = pngExportUnit.value === 'label'
    const baseName = defaultPngExportName(
      exact
        ? exactPixelNamePrefix(exportNamePrefix.value, pngExactWidth.value, pngExactHeight.value)
        : exportNamePrefix.value,
    )
    // 逐标签成图：收集每页各占位标签的裁剪区域与对应名单行（逐行命名，
    // 多枚/页模板不再按页首行命名）
    let labelsByPage: LabelExportItem[][] | undefined
    if (perLabel) {
      const template = workspace.renderTemplate
      const labelRows: (DataRow | null)[] = []
      labelsByPage = workspace.pages.map((page) => {
        const items: LabelExportItem[] = []
        page.forEach((row, idx) => {
          if (row == null) return
          const pos = labelPosition(template, idx)
          items.push({
            rect: {
              x: pos.left,
              y: pos.top,
              width: template.label.width,
              height: template.label.height,
            },
          })
          labelRows.push(row)
        })
        return items
      })
      if (pngNameMode.value === 'field' && pngNameTemplate.value.trim()) {
        const names = buildFieldFileNames({
          template: pngNameTemplate.value.trim(),
          rows: labelRows,
          fallbackPrefix: baseName,
        })
        let n = 0
        for (const items of labelsByPage) for (const item of items) item.fileName = names[n++]
      }
    }
    // 按字段命名（整页成图）：多枚模板每页取第一条记录求值；空模板/空字段回退序号命名
    const pageFileNames =
      !perLabel && pngNameMode.value === 'field' && pngNameTemplate.value.trim() && pageCount > 1
        ? buildFieldFileNames({
            template: pngNameTemplate.value.trim(),
            rows: workspace.pages.map((page) => page.find((row) => row != null) ?? null),
            fallbackPrefix: baseName,
          })
        : undefined
    hostSuppressCutLines.value = perLabel
    await exportPagedPng({
      pageCount,
      signal: abort.signal,
      getPage: async (i) => {
        workspace.setLoading(true, `正在渲染第 ${i + 1}/${pageCount} 页...`, cancel)
        await mountHost(i)
        const el = hostRef.value?.querySelector<HTMLElement>('.sheet-page')
        if (!el) throw new Error('页面节点未挂载')
        return el
      },
      rebuildHost,
      pageWidth: workspace.template.page.paperWidth,
      pageHeight: workspace.template.page.paperHeight,
      exactPixels: exact
        ? pngPreset.value
          ? { width: pngPreset.value.width, height: pngPreset.value.height }
          : { width: pngExactWidth.value, height: pngExactHeight.value }
        : undefined,
      cropRect: exact && !perLabel ? (pngCropRect.value ?? undefined) : undefined,
      labelsByPage,
      monochrome: pngMonochrome.value,
      watermarkText:
        withWatermark.value && pngMonochrome.value ? 'SeatMark 座签 · seatmark.cn' : undefined,
      fileName: baseName,
      pageFileNames,
      onProgress: (done, total) =>
        workspace.setLoading(
          true,
          perLabel
            ? `已完成 ${done}/${total} 张标签，正在生成图片...`
            : `已完成 ${done}/${total} 页，正在生成图片...`,
          cancel,
        ),
    })
    await consumeQuotaAfterSuccess()
    const exactW = pngPreset.value?.width ?? pngExactWidth.value
    const unitCount = perLabel ? pngTotalLabels.value : pageCount
    const unitWord = perLabel ? '张标签' : '页'
    toast.success(
      unitCount === 1
        ? t('PNG 图片已生成')
        : t('PNG 图片已生成（{n} {unit}打包为 zip）')
            .replace('{n}', String(unitCount))
            .replace('{unit}', t(unitWord)),
      exact
        ? t('每{unit}精确 {w}×{h} 像素{mono}，可直接导入电子桌牌系统')
            .replace('{unit}', t(unitWord))
            .replace('{w}', String(exactW))
            .replace('{h}', String(pngExactHeight.value))
            .replace('{mono}', pngMonochrome.value ? t('、纯黑白') : '')
        : perLabel
          ? t('每一张标签单独成图（尺寸=标签实际尺寸×清晰度），可直接逐张打印或屏显')
          : t('每页一张高清 PNG，可直接用于屏显或二次编辑'),
    )
    maybeShowSharePrompt()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message === EXPORT_CANCELLED_MESSAGE) {
      toast.info('已取消导出', '本次未扣除无水印次数，可随时重新导出')
    } else {
      toast.danger('PNG 生成失败', `${message}；本次未扣除无水印次数，可直接重试`)
    }
  } finally {
    workspace.setLoading(false)
    unmountHost()
    hostSuppressCutLines.value = false
  }
}

/** 移动端环境：浏览器打印预览对隐藏宿主渲染不可靠，改走 PDF 分享/打印通道 */
const isMobile = isMobilePrintEnvironment()

/**
 * 浏览器打印：既是实体打印入口，也可选「另存为 PDF」导出矢量 PDF。
 * 移动端浏览器的打印预览常把隐藏宿主渲染为空白（window.print 立即返回、
 * 预览异步渲染时宿主已卸载），改为生成图片版 PDF 后调起系统分享 / 打印。
 */
async function doPrint() {
  if (isMobile) {
    await doMobilePrint()
    return
  }
  workspace.setLoading(true, `正在准备 ${workspace.totalPages} 页打印内容...`)
  try {
    await mountHost()
  } finally {
    workspace.setLoading(false)
  }
  // 等 afterprint 后再卸载打印宿主：部分浏览器 window.print 立即返回，
  // 提前卸载会让打印预览拿到空白页
  await printAndWaitUntilDone()
  unmountHost()
  await consumeQuotaAfterSuccess()
  toast.info(
    t('已调起浏览器打印'),
    t('彩色打印三步：勾选「背景图形」、颜色选「彩色」、打印机首选项关闭灰度/省墨；目标打印机选「另存为 PDF」即可导出矢量 PDF；直接打印请用 {paper} 纸张、无边距、缩放 100%').replace('{paper}', currentPaperLabel.value),
  )
  maybeShowSharePrompt()
}

/**
 * 移动端打印通道：逐页渲染生成图片版 PDF（与「图片版 PDF」同链路），
 * 再调起系统分享面板（可选打印 / 用 PDF 应用打开），不依赖移动浏览器打印预览。
 */
async function doMobilePrint() {
  const abort = new AbortController()
  const cancel = () => abort.abort()
  workspace.setLoading(true, '正在准备页面...', cancel)
  try {
    const pageCount = workspace.totalPages
    const fileName = defaultPdfFileName(exportNamePrefix.value)
    const blob = await exportPagedPdf({
      pageCount,
      signal: abort.signal,
      getPage: async (i) => {
        workspace.setLoading(true, `正在渲染第 ${i + 1}/${pageCount} 页...`, cancel)
        await mountHost(i)
        const el = hostRef.value?.querySelector<HTMLElement>('.sheet-page')
        if (!el) throw new Error('页面节点未挂载')
        return el
      },
      rebuildHost,
      pageWidth: workspace.template.page.paperWidth,
      pageHeight: workspace.template.page.paperHeight,
      calibration: calibrationStore.active ? calibrationStore.calibration : undefined,
      fileName,
      output: 'blob',
      onProgress: (done, total) =>
        workspace.setLoading(true, `已完成 ${done}/${total} 页，正在生成 PDF...`, cancel),
    })
    if (!blob) throw new Error('PDF 生成失败')
    const delivery = await deliverPdfForMobilePrint(blob, fileName)
    if (delivery === 'cancelled') {
      toast.info('已取消分享', '本次未扣除无水印次数，可随时重新打印')
      return
    }
    await consumeQuotaAfterSuccess()
    toast.success(
      t('打印 PDF 已生成'),
      delivery === 'shared'
        ? t('在分享面板选「打印」或用 PDF 应用打开后打印即可')
        : t('已打开 / 下载 PDF，用系统 PDF 查看器的打印功能输出即可'),
    )
    maybeShowSharePrompt()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message === EXPORT_CANCELLED_MESSAGE) {
      toast.info('已取消导出', '本次未扣除无水印次数，可随时重新导出')
    } else {
      toast.danger('打印 PDF 生成失败', `${message}；本次未扣除无水印次数，可直接重试`)
    }
  } finally {
    workspace.setLoading(false)
    unmountHost()
  }
}

/**
 * 导出按钮角标：额度 > 0 时正向展示「今日剩余 n 次」（与导出弹窗口径一致），用完后不再展示刺眼的 0，
 * 改为强调「带水印导出永远免费、不限次数」（与价值阶梯弹窗口径一致）
 */
const exportBadge = computed(() =>
  quota.remaining > 0
    ? { text: `${t('今日剩余')} ${quota.remaining} ${t('次')}`, cls: 'bg-emerald-100 text-emerald-700' }
    : { text: t('带水印免费'), cls: 'bg-sky-100 text-sky-700' },
)
const exportBadgeTitle = computed(
  () =>
    `${t('带水印导出永远免费、不限次数；无水印今日剩余')} ${quota.remaining}/${quota.limit} ${t('次')}${
      auth.isLoggedIn ? '' : `${t('，免费登录后每天')} ${QUOTA_USER_DAILY} ${t('次')}`
    }`,
)

/** 未映射字段集合：预览中展示轻量占位提示（导出 / 打印宿主不传，成品不含占位） */
const unmappedFieldIds = computed(() => new Set(workspace.unmappedFields.map((f) => f.id)))

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
          {{ workspace.excel.rows.length }} {{ t('个标签') }}
        </span>
        <span
          v-if="workspace.totalPages > 0"
          class="rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-600"
        >
          {{ workspace.totalPages }} {{ t('页') }}
        </span>
        <span class="rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-600">
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
        <div class="flex items-center gap-1 text-xs text-slate-600">
          <input
            v-model="pageInput"
            type="number"
            min="1"
            :max="workspace.totalPages"
            aria-label="跳转到页码"
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
        <button
          type="button"
          class="btn btn-secondary btn-sm sm:hidden"
          :aria-expanded="displayOptionsOpen"
          @click="displayOptionsOpen = !displayOptionsOpen"
        >
          {{ t('显示选项') }}<span
            v-if="displayOptionsActiveCount"
            class="ml-0.5 rounded-full bg-brand-100 px-1.5 text-[10px] font-bold text-brand-700"
          >{{ displayOptionsActiveCount }}</span>
          <svg
            class="size-3 transition-transform"
            :class="{ 'rotate-180': displayOptionsOpen }"
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
          class="w-full flex-wrap items-center gap-2 sm:contents"
          :class="displayOptionsOpen ? 'flex' : 'hidden'"
        >
        <CheckboxField
          v-model="workspace.showCutLines"
          class="text-xs font-semibold text-slate-600"
          :label="t('裁切线')"
        />
        <CheckboxField
          v-model="workspace.highlightMissing"
          tone="amber"
          class="text-xs font-semibold text-slate-600"
          :label="t('高亮缺失')"
        />
        <span
          v-if="workspace.totalPages > 1 || workspace.cutStackSort"
          class="flex items-center gap-0.5"
        >
          <CheckboxField
            v-model="workspace.cutStackSort"
            class="text-xs font-semibold text-slate-600"
            :title="t(HINTS.cutSort!.text)"
            :label="t('裁切排序')"
          />
          <button
            type="button"
            class="grid size-4 place-items-center rounded-full text-slate-600 hover:text-slate-600"
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
            :title="t(HINTS.mirror!.text)"
            :label="t('对折双联（镜像）')"
          />
          <button
            type="button"
            class="grid size-4 place-items-center rounded-full text-slate-600 hover:text-slate-600"
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
          :title="calibrationStore.active ? t('打印校准已生效：导出与打印自动应用偏移/缩放补偿') : t('打印跑偏、尺寸不准？打印一页标尺校准页，量两下即可全局补偿')"
          @click="calibrationOpen = true"
        >
          <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 17 17 3l4 4L7 21H3v-4zM14 6l4 4M9 11l1.5 1.5M11.5 8.5 13 10" />
          </svg>
          {{ t('打印校准') }}<span
            v-if="calibrationStore.active"
            class="ml-0.5 size-1.5 rounded-full bg-emerald-500"
            aria-label="校准已生效"
          ></span>
        </button>
        </div>
        <button
          type="button"
          class="btn btn-primary btn-sm relative"
          :title="t('经浏览器打印对话框输出：选「另存为 PDF」可得到矢量 PDF；直接打印请用对应纸张、无边距、缩放 100%')"
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
          {{ t('打印') }}<span class="hidden sm:inline"> / {{ t('矢量 PDF') }}</span>
        </button>
        <button
          type="button"
          class="btn btn-secondary btn-sm relative"
          :title="t('逐页渲染为高清图片后合成 PDF，所见即所得、任何设备打开都一致（推荐）；文字不可选中，如需矢量文字请用「打印 / 矢量 PDF」')"
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
          {{ t('图片版 PDF') }}<span class="hidden sm:inline">{{ t('（推荐）') }}</span>
          <span
            v-if="!sharePromptVisible"
            class="absolute -top-2.5 -right-2 rounded-full px-1.5 py-px text-[9px] font-bold ring-1 ring-white"
            :class="exportBadge.cls"
            :title="exportBadgeTitle"
          >{{ exportBadge.text }}</span>
        </button>
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          :title="t('按标签逐张导出 PNG 图片：每一张标签单独成图，单张直接下载，多张自动打包 zip；电子座签模板支持精确 800×480 像素输出')"
          :disabled="!workspace.excel.rows.length || workspace.loading.active"
          @click="openExportChoice('png')"
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
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
          {{ t('图片 PNG') }}
        </button>
      </div>
    </div>

    <div
      v-if="sharePromptVisible"
      class="no-print mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2.5"
    >
      <span class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
        <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="18" cy="18" r="3" />
          <path d="m8.7 10.6 6.6-3.2m-6.6 6 6.6 3.2" />
        </svg>
      </span>
      <p class="min-w-0 flex-1 text-xs leading-5 text-slate-600">
        <strong class="text-slate-800">{{ sharePromptWatermarked ? t('想去除页脚水印？') : t('成品已拿到，觉得好用？') }}</strong>
        {{
          sharePromptWatermarked
            ? (auth.isLoggedIn
                ? `${t('今日还剩')} ${quota.remaining} ${t('次无水印导出，分享链接每被点开 1 次再 +1 次')}`
                : `${t('免费登录后每天')} ${QUOTA_USER_DAILY} ${t('次无水印导出，分享被点开还能再送次数')}`)
            : (auth.isLoggedIn
                ? t('把工具分享给同事，他们每点开 1 次你就再得 1 次无水印导出')
                : quota.remaining <= 0
                  ? `${t('今日无水印次数已用完，免费登录后每天')} ${QUOTA_USER_DAILY} ${t('次，分享被点开还能再送次数')}`
                  : `${t('登录后无水印导出每天')} ${QUOTA_USER_DAILY} ${t('次，自定义模板可同步云端，还可分享送次数')}`)
        }}
      </p>
      <div class="flex shrink-0 items-center gap-1.5 max-sm:basis-full max-sm:justify-end">
        <button
          v-if="auth.isLoggedIn"
          type="button"
          class="btn btn-primary btn-sm"
          @click="copyReferralLink"
        >
          {{ t('复制分享链接') }}
        </button>
        <RouterLink v-else to="/account" class="btn btn-primary btn-sm" @click="dismissSharePrompt">
          {{ sharePromptWatermarked ? t('免费登录去水印') : t('免费登录解锁') }}
        </RouterLink>
        <button
          type="button"
          class="grid size-6 place-items-center rounded text-slate-600 hover:text-slate-600"
          aria-label="关闭分享提示"
          @click="dismissSharePrompt"
        >
          <svg class="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <path d="m4 4 8 8m0-8-8 8" />
          </svg>
        </button>
      </div>
    </div>

    <div
      ref="previewContainer"
      tabindex="0"
      aria-label="标签预览区"
      class="no-print relative mt-3 flex-1 overflow-auto rounded-lg border border-slate-200/80 bg-[radial-gradient(circle,#cbd5e1_1px,transparent_1px)] bg-slate-100/70 bg-[size:16px_16px] p-3 shadow-[inset_0_1px_3px_rgba(15,23,42,0.05)]"
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
          <h3 class="mt-4 text-sm font-bold text-slate-800">{{ t('还没有名单数据') }}</h3>
          <p class="mt-1.5 text-xs leading-5 text-slate-600">
            {{ t('在左侧「导入数据」上传 Excel 后，这里会实时显示按毫米排版的真实打印效果') }}
          </p>
          <button
            type="button"
            class="btn btn-secondary btn-sm mt-3"
            @click="workspace.useDemoData()"
          >
            {{ t('先用演示数据看看效果') }}
          </button>
        </div>
      </div>

      <!-- w-fit + min-w-full：内容宽于容器时包裹层随内容撑宽，避免 flex 居中把溢出部分裁到滚动区外 -->
      <div v-else class="flex w-fit min-w-full justify-center">
        <div
          v-if="editOneHintVisible"
          class="absolute top-2 left-2 z-10 flex max-w-xs items-start gap-2 rounded-lg border border-brand-200 bg-white/95 px-3 py-2.5 shadow-pop backdrop-blur"
        >
          <span class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
            <svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </span>
          <p class="text-xs leading-5 text-slate-600">
            <strong class="text-slate-800">{{ t('小技巧：单张覆写') }}</strong><br />
            {{ t('点击预览中任意一张标签，可单独修改这一张的内容，不影响名单数据。') }}
          </p>
          <button
            type="button"
            class="grid size-5 shrink-0 place-items-center rounded text-slate-600 hover:text-slate-600"
            aria-label="关闭提示"
            @click="dismissEditOneHint"
          >
            <svg class="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <path d="m4 4 8 8m0-8-8 8" />
            </svg>
          </button>
        </div>
        <div
          class="relative origin-top-left"
          :style="{ width: `${pageWidthPx * scale}px`, height: `${pageHeightPx * scale}px` }"
        >
          <div class="absolute top-0 left-0 origin-top-left" :style="{ transform: `scale(${scale})` }">
            <LabelSheet
              :key="workspace.rareFontTick"
              :template="workspace.renderTemplate"
              :rows="workspace.currentPageRows"
              :get-text="workspace.fieldText"
              :get-photo="workspace.photoFor"
              :show-cut-lines="workspace.showCutLines"
              :highlight-missing="workspace.highlightMissing"
              :unmapped-fields="unmappedFieldIds"
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
      :title="pendingAction === 'pdf' ? t('导出图片版 PDF（推荐）') : pendingAction === 'png' ? t('导出图片（PNG）') : t('打印 / 矢量 PDF')"
      size="md"
      @close="exportChoiceOpen = false"
    >
      <div v-if="pendingAction === 'png'" class="mb-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
        <label class="field-label" for="png-unit">{{ t('成图单位') }}</label>
        <SelectField id="png-unit" v-model="pngExportUnit" size="sm" :options="PNG_UNIT_OPTIONS" />
        <p class="mt-1.5 text-xs leading-5 text-slate-600">
          {{
            pngExportUnit === 'label'
              ? `${t('按标签逐张导出：共')} ${pngTotalLabels} ${t('张标签，每一张单独生成一张 PNG（尺寸=标签实际尺寸），支持按每张标签对应的名单行命名')}`
              : t('按整页导出：每页纸张（含多枚标签）合成一张 PNG')
          }}
        </p>
        <label class="field-label mt-3">{{ t('输出尺寸') }}</label>
        <SelectField v-model="pngSizeMode" size="sm" :options="PNG_SIZE_OPTIONS" />
        <template v-if="pngSizeMode === 'exact'">
          <label class="field-label mt-2" for="png-preset">{{ t('分辨率预设（电子墨水屏）') }}</label>
          <SelectField id="png-preset" v-model="pngPresetId" size="sm" :options="PNG_PRESET_OPTIONS" />
          <div
            v-if="!pngPreset"
            class="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600"
          >
            <label class="font-semibold" for="png-exact-width">{{ t('宽度（px）') }}</label>
            <input
              id="png-exact-width"
              v-model.number="pngExactWidth"
              type="number"
              :min="MIN_EXACT_PIXEL_WIDTH"
              :max="MAX_EXACT_PIXEL_WIDTH"
              class="input-field w-24 text-center"
              :class="pngExactWidthValid ? '' : '!border-red-400'"
            />
            <span v-if="pngExactWidthValid" class="text-slate-600">
              {{ t('输出') }} <strong class="text-slate-700">{{ pngExactWidth }}×{{ pngExactHeight }}</strong> {{ t('像素（高度按模板比例自动推导）') }}
            </span>
            <span v-else class="text-red-500">{{ t('请输入') }} {{ MIN_EXACT_PIXEL_WIDTH }}–{{ MAX_EXACT_PIXEL_WIDTH }} {{ t('之间的整数') }}</span>
          </div>
          <p v-else class="mt-2 text-xs text-slate-600">
            {{ t('每页精确输出') }} <strong class="text-slate-700">{{ pngPreset.width }}×{{ pngPreset.height }}</strong> {{ t('像素') }}
          </p>
          <p v-if="pngPresetStretch" class="mt-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
            {{ t('该预设宽高比与当前模板不一致，画面会被拉伸；建议改用比例匹配的模板，或选「自定义宽度」按模板比例输出。') }}
          </p>
        </template>
        <CheckboxField
          v-model="pngMonochrome"
          class="mt-2 text-xs font-semibold text-slate-600"
          :label="t('纯黑白输出（电子墨水屏推荐）')"
        />
        <p class="mt-2 text-xs leading-5 text-slate-600">
          {{ t('单张直接下载 PNG，多张自动打包为 zip；') }}{{ isEinkTemplate ? t('电子座签模板默认精确 800×480 像素 + 纯黑白，可直接导入电子桌牌系统。') : t('需要精确像素（如电子墨水屏）时选「精确像素」，可用分辨率预设或自定义宽度。') }}
        </p>
        <template v-if="pngExportUnit === 'label' ? pngTotalLabels > 1 : workspace.totalPages > 1">
          <label class="field-label mt-3" for="png-name-mode">{{ t('zip 内文件命名') }}</label>
          <SelectField id="png-name-mode" v-model="pngNameMode" size="sm" :options="PNG_NAME_OPTIONS" />
          <div v-if="pngNameMode === 'field'" class="mt-2 text-xs text-slate-600">
            <input
              v-model="pngNameTemplate"
              type="text"
              class="input-field w-full"
              :class="pngNameTemplateValid ? '' : '!border-amber-400'"
              :placeholder="t('如 {姓名}-{考场}')"
              :aria-label="t('文件命名模板')"
            />
            <div v-if="workspace.excel.headers.length" class="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span class="text-slate-600">{{ t('点击插入字段：') }}</span>
              <button
                v-for="header in workspace.excel.headers"
                :key="header"
                type="button"
                class="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-700"
                @click="appendNameField(header)"
              >
                {{ header }}
              </button>
            </div>
            <p v-if="!pngNameTemplateValid" class="mt-1.5 text-amber-600">
              {{ t('模板中引用了名单里不存在的列，对应占位符会按空处理；字段为空的页面自动回退为序号命名。') }}
            </p>
            <p v-else class="mt-1.5 text-slate-600">
              {{ t('{列名} 会替换为') }}{{ pngExportUnit === 'label' ? t('每张标签对应名单行') : t('该页对应名单行（每页多枚时取该页第一条记录）') }}{{ t('的内容；非法字符自动过滤，重名自动追加 -2，空字段回退序号命名。') }}
            </p>
          </div>
        </template>
      </div>
      <p
        v-if="pendingAction === 'pdf'"
        class="mb-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600"
      >
        {{ t('图片版 PDF：每页渲染为高清图片后合成，所见即所得、任何设备打开都一致；文字不可选中，需要矢量文字请改用「打印 / 矢量 PDF」。') }}
      </p>
      <p
        v-else-if="pendingAction === 'print'"
        class="mb-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600"
      >
        <template v-if="isMobile">
          {{ t('手机浏览器的打印预览容易出现空白：将先生成打印用 PDF，再调起系统分享面板，在面板中选「打印」或用 PDF 应用打开后打印。') }}
        </template>
        <template v-else>
          {{ t('打印 / 矢量 PDF：调起浏览器打印对话框，目标打印机选「另存为 PDF」即得到文字可选中的矢量 PDF，也可直接连打印机输出。') }}
        </template>
      </p>
      <details
        v-if="pendingAction === 'print' && !isMobile"
        class="mb-2 rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2"
      >
        <summary class="cursor-pointer text-xs font-bold text-amber-800 select-none">
          {{ t('打印出来是黑白的？彩色打印检查清单（3 步）') }}
        </summary>
        <ol class="mt-2 list-decimal space-y-1.5 pl-5 text-xs leading-5 text-slate-600">
          <li>
            {{ t('在浏览器打印对话框展开「更多设置」，勾选') }}
            <strong class="text-slate-800">「{{ t('背景图形 / Background graphics') }}」</strong>{{ t('，否则背景色与装饰会整体丢失。') }}
          </li>
          <li>
            {{ t('打印对话框的「颜色」选项选') }}
            <strong class="text-slate-800">「{{ t('彩色 / Color') }}」</strong>{{ t('，不要选黑白（黑白模式会把整页转成灰度）。') }}
          </li>
          <li>
            {{ t('仍是黑白时，多半是打印机驱动默认开了省墨 / 灰度模式：在打印对话框的「使用系统对话框打印」或系统「打印机首选项」里，关闭') }}
            <strong class="text-slate-800">「{{ t('灰度打印 / 黑白打印 / 省墨模式') }}」</strong>{{ t('后重试。') }}
          </li>
        </ol>
        <p class="mt-1.5 pl-5 text-[11px] leading-4 text-slate-600">
          {{ t('小验证：目标打印机先选「另存为 PDF」，导出的 PDF 是彩色就说明页面没问题，剩下的是打印机设置。') }}
        </p>
      </details>
      <p class="leading-6">{{ t('选择导出方式') }}<span class="text-xs text-slate-500">{{ t('（点击即开始导出，可随时取消，取消不扣次数）') }}</span>：</p>
      <p
        v-if="pendingAction === 'pdf' && exportEstimate"
        class="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600"
      >
        {{ t('共') }} {{ exportEstimate.pageCount }} {{ t('页') }} · {{ t('每页约') }} {{ exportEstimate.dpi }}dpi ·
        {{ t('预估体积约') }} <span class="font-bold text-slate-700">{{ exportEstimate.size }}</span>{{ t('（按页数自适应清晰度与压缩）') }}
        <span v-if="exportEstimate.dpi < 240" class="mt-0.5 block text-amber-700">
          {{ t('页数较多时清晰度自动降档以控制体积；追求最高打印清晰度请改用「打印 / 矢量 PDF」。') }}
        </span>
      </p>
      <div class="mt-3 grid gap-3">
        <button
          type="button"
          class="relative flex items-start gap-3 rounded-lg border p-4 text-left transition-colors"
          :class="quota.remaining > 0 ? 'border-brand-200 bg-brand-50 hover:border-brand-300' : 'border-slate-200 bg-slate-50 hover:border-slate-300'"
          data-testid="choose-clean"
          @click="chooseClean"
        >
          <span
            v-if="quota.remaining <= 0"
            class="absolute top-2 right-2 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600"
          >
            {{ t('今日 0 次') }}
          </span>
          <span
            class="flex size-8 shrink-0 items-center justify-center rounded-lg text-white"
            :class="quota.remaining > 0 ? 'bg-brand-600' : 'bg-slate-400'"
          >
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m5 13 4 4 10-11" />
            </svg>
          </span>
          <span>
            <span class="block text-sm font-bold text-slate-900">{{ t('无水印导出（今日剩余 {n} 次）').replace('{n}', String(quota.remaining)) }}</span>
            <span class="mt-0.5 block text-xs leading-5 text-slate-600">
              {{ quota.remaining > 0 ? t('页面不叠加任何标识') : (auth.isLoggedIn ? t('今日已用完，分享链接每被点开 1 次即得 1 次，或明日 0 点恢复') : t('今日已用完，登录后每天 3 次，还可分享送次数')) }}
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
            <span class="block text-sm font-bold text-slate-900">{{ t('带水印导出（不限次数）') }}</span>
            <span class="mt-0.5 block text-xs leading-5 text-slate-600">
              {{ t('每张标签底边叠加细线签名式品牌水印（细线 + seatmark.cn 小字，配色随模板自适应），不遮挡姓名等核心内容') }}
            </span>
          </span>
        </button>
      </div>
      <p v-if="!auth.isLoggedIn" class="mt-3 text-xs leading-5 text-slate-600">
        {{ t('注册即送 7 天专业版试用（无水印导出不限次）；免费版登录后每天') }} {{ QUOTA_USER_DAILY }} {{ t('次，分享链接每被点开 1 次再得 1 次。') }}
      </p>
    </ModalDialog>

    <ModalDialog
      :open="editRow != null"
      :title="t('单张覆写：只改这一张标签')"
      size="md"
      @close="editRow = null"
    >
      <p class="text-xs leading-5 text-slate-600">
        {{ t('修改只影响这一张标签，不改动名单数据；重新导入名单时覆写会自动清除并提示。') }}
      </p>
      <div class="mt-3 grid gap-2.5">
        <div v-for="field in workspace.mappableFields" :key="field.id">
          <label class="field-label">{{ t(field.label || field.id) }}</label>
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
          {{ t('清除本张覆写') }}
        </button>
        <button type="button" class="btn btn-secondary btn-sm" @click="editRow = null">{{ t('取消') }}</button>
        <button type="button" class="btn btn-primary btn-sm" @click="saveEditOne">{{ t('保存覆写') }}</button>
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
      :title="hintKey ? t(HINTS[hintKey]!.title) : ''"
      size="md"
      @close="hintKey = null"
    >
      <p class="text-sm leading-6 text-slate-600">{{ hintKey ? t(HINTS[hintKey]!.text) : '' }}</p>
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
          :show-cut-lines="hostSuppressCutLines ? false : workspace.showCutLines"
          :watermark="hostWatermark"
        />
      </div>
    </Teleport>
  </section>
</template>
