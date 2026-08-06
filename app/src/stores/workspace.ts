import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'

import { defaultTemplates } from '@/data/defaultTemplates'
import { useFontsStore } from '@/stores/fonts'
import { isValidTemplate } from '@/stores/templateLibrary'
import { useToastStore } from '@/stores/toast'
import type { DataRow, FieldMapping, LabelTemplate, TemplateField } from '@/types/template'
import { autoMapFields } from '@/utils/autoMap'
import { evaluateFieldTemplate, isCompositeMapping } from '@/utils/fieldTemplate'
import { applyLabelPaper, isPaperCompatible, matchLabelPaper } from '@/utils/labelPaper'
import { demoExcelFor } from '@/data/demoDatasets'
import { compareCellText, parseExcelFile } from '@/utils/excel'
import { stackSortRows } from '@/utils/cutSort'
import { chunkRows, cloneTemplate, labelsPerPage } from '@/utils/layout'
import { loadPhotoFiles } from '@/utils/photos'

export type MappingTone = 'muted' | 'success' | 'warning'

export interface MappingSummary {
  tone: MappingTone
  title: string
  text: string
}

/** 工作区当前模板（含未保存的微调）的持久化键：刷新页面不丢失 */
const WORKSPACE_TEMPLATE_KEY = 'seatmark.workspace-template.v1'

function loadInitialTemplate(): { template: LabelTemplate; id: string } {
  try {
    const raw = localStorage.getItem(WORKSPACE_TEMPLATE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { id?: unknown; template?: unknown }
      if (parsed && isValidTemplate(parsed.template)) {
        return {
          template: parsed.template,
          id: typeof parsed.id === 'string' ? parsed.id : parsed.template.id,
        }
      }
    }
  } catch {
    /* 数据损坏 / 隐私模式：回落到默认模板 */
  }
  const first = defaultTemplates[0]!
  return { template: cloneTemplate(first), id: first.id }
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const toast = useToastStore()

  // ---------- 模板 ----------
  const initial = loadInitialTemplate()
  const template = ref<LabelTemplate>(initial.template)
  const selectedTemplateId = ref(initial.id)

  // 恢复的模板可能引用在线字体，后台补载
  useFontsStore().ensureTemplateFonts(template.value)

  // 当前模板与选择持久化（防抖合并连续修改）
  let persistTimer: number | undefined
  watch(
    [template, selectedTemplateId],
    () => {
      window.clearTimeout(persistTimer)
      persistTimer = window.setTimeout(() => {
        try {
          localStorage.setItem(
            WORKSPACE_TEMPLATE_KEY,
            JSON.stringify({ id: selectedTemplateId.value, template: template.value }),
          )
        } catch {
          /* 存储满 / 隐私模式下静默失败 */
        }
      }, 400)
    },
    { deep: true },
  )

  // ---------- 数据 ----------
  const excel = reactive({
    fileName: '',
    sheetName: '',
    headers: [] as string[],
    rows: [] as DataRow[],
  })
  const isDemoData = ref(false)
  const mapping = reactive<FieldMapping>({})

  // ---------- 单张覆写（Edit One） ----------
  /** 数据行 -> 字段 id -> 覆写文本；以行对象为键，筛选/排序不影响对应关系 */
  const rowOverrides = ref(new Map<DataRow, Record<string, string>>())
  const overrideCount = computed(() => rowOverrides.value.size)

  function overridesFor(row: DataRow): Record<string, string> | undefined {
    return rowOverrides.value.get(row)
  }

  /** 设置某行的字段覆写；传空对象等价于清除该行覆写 */
  function setRowOverride(row: DataRow, values: Record<string, string>) {
    const next = new Map(rowOverrides.value)
    if (Object.keys(values).length) next.set(row, values)
    else next.delete(row)
    rowOverrides.value = next
  }

  function clearRowOverride(row: DataRow) {
    if (!rowOverrides.value.has(row)) return
    const next = new Map(rowOverrides.value)
    next.delete(row)
    rowOverrides.value = next
  }

  /** 清空全部单张覆写；重新导入名单时调用并提示 */
  function clearAllOverrides(options: { silent?: boolean } = {}) {
    const count = rowOverrides.value.size
    if (!count) return
    rowOverrides.value = new Map()
    if (!options.silent) {
      toast.info('单张覆写已清除', `名单已更新，原有 ${count} 张标签的单独改字已一并清除`)
    }
  }

  // ---------- 照片 ----------
  const photoColumn = ref('')
  const photos = ref(new Map<string, string>())
  const photoErrors = ref<string[]>([])

  // ---------- 数据视图：列筛选与排序（Excel 风格，决定排版顺序） ----------
  const sort = reactive({ column: '', direction: 'asc' as 'asc' | 'desc' })
  /** 表头 -> 勾选保留的值列表；不含该表头表示此列不筛选 */
  const columnFilters = ref<Record<string, string[]>>({})

  /** 应用列筛选与排序后的数据，预览 / 导出 / 打印全部按此顺序排版 */
  const displayRows = computed<DataRow[]>(() => {
    let rows: DataRow[] = excel.rows
    for (const [header, values] of Object.entries(columnFilters.value)) {
      const allow = new Set(values)
      rows = rows.filter((row) => allow.has(String(row[header] ?? '')))
    }
    if (sort.column) {
      const dir = sort.direction === 'asc' ? 1 : -1
      const column = sort.column
      rows = [...rows].sort(
        (a, b) => dir * compareCellText(String(a[column] ?? ''), String(b[column] ?? '')),
      )
    }
    return rows
  })

  /** 当前是否启用了筛选或排序（排版顺序与导入顺序不一致） */
  const isViewCustomized = computed(
    () => !!sort.column || Object.keys(columnFilters.value).length > 0,
  )

  /** 点击表头循环：升序 -> 降序 -> 恢复原始顺序 */
  function toggleSort(column: string) {
    if (sort.column !== column) {
      sort.column = column
      sort.direction = 'asc'
    } else if (sort.direction === 'asc') {
      sort.direction = 'desc'
    } else {
      sort.column = ''
      sort.direction = 'asc'
    }
  }

  /** 设置某列的筛选值集合；传 null 表示取消该列筛选 */
  function setColumnFilter(header: string, values: string[] | null) {
    const next = { ...columnFilters.value }
    if (values == null) delete next[header]
    else next[header] = values
    columnFilters.value = next
  }

  /** 清除全部筛选与排序，恢复 Excel 导入顺序 */
  function resetDataView() {
    sort.column = ''
    sort.direction = 'asc'
    columnFilters.value = {}
  }

  // ---------- 预览 / 全局 ----------
  const previewPage = ref(1)
  const showCutLines = ref(true)
  const highlightMissing = ref(false)
  /** 裁切分拣排序（摞优先）：裁切后每摞标签天然连续有序；默认关 */
  const cutStackSort = ref(false)
  /** 对折双联（镜像）：桌牌类模板可关闭镜像半区，只印单面内容 */
  const showMirror = ref(true)
  const loading = reactive<{ active: boolean; text: string; onCancel: (() => void) | null }>({
    active: false,
    text: '',
    onCancel: null,
  })

  // ---------- 派生状态 ----------
  const textFields = computed<TemplateField[]>(() =>
    template.value.fields.filter((f) => f.type === 'text'),
  )
  /** 参与 Excel 映射的文本字段（排除固定文本与镜像字段） */
  const mappableFields = computed<TemplateField[]>(() =>
    textFields.value.filter((f) => f.fixedText == null && f.mirrorOf == null),
  )
  const imageFields = computed<TemplateField[]>(() =>
    template.value.fields.filter((f) => f.type === 'image'),
  )
  const hasImageField = computed(() => imageFields.value.length > 0)
  /** 是否存在需要按列匹配照片的图片字段（固定图片/Logo 不算） */
  const hasMatchedImageField = computed(() =>
    imageFields.value.some((f) => f.imageSrc == null),
  )

  const perPage = computed(() => labelsPerPage(template.value))
  const pages = computed<(DataRow | null)[][]>(() =>
    cutStackSort.value
      ? chunkRows(stackSortRows(displayRows.value, perPage.value), perPage.value)
      : chunkRows<DataRow | null>(displayRows.value, perPage.value),
  )
  const totalPages = computed(() => pages.value.length)
  const currentPageRows = computed<(DataRow | null)[]>(
    () => pages.value[previewPage.value - 1] ?? [],
  )

  /** 当前模板是否含镜像字段（对折双联桌牌，如 V 型折叠桌牌） */
  const hasMirrorFields = computed(() =>
    template.value.fields.some((f) => f.mirrorOf != null),
  )

  /** 预览/导出/打印实际使用的模板：关闭对折双联时去掉镜像半区字段 */
  const renderTemplate = computed<LabelTemplate>(() => {
    if (showMirror.value || !hasMirrorFields.value) return template.value
    const clone = cloneTemplate(template.value)
    clone.fields = clone.fields.filter((f) => f.mirrorOf == null)
    return clone
  })

  const mappedCount = computed(() => mappableFields.value.filter((f) => !!mapping[f.id]).length)
  const unmappedFields = computed(() => mappableFields.value.filter((f) => !mapping[f.id]))

  const mappingSummary = computed<MappingSummary>(() => {
    const total = mappableFields.value.length
    const matched = mappedCount.value
    if (!total) {
      return { tone: 'muted', title: '当前模板没有文本字段', text: '无需做 Excel 字段匹配。' }
    }
    if (!excel.rows.length) {
      return {
        tone: 'muted',
        title: '上传后会自动尝试匹配常见列名',
        text: '表头包含姓名、考场、准考证号、座位号等时，系统通常可以自动识别。',
      }
    }
    if (matched === total) {
      return {
        tone: 'success',
        title: `已自动匹配 ${matched}/${total} 个字段`,
        text: '可以直接查看预览，如有偏差再手动调整映射。',
      }
    }
    if (matched > 0) {
      return {
        tone: 'warning',
        title: `已自动匹配 ${matched}/${total} 个字段`,
        text: '还有字段需要手动选择对应的 Excel 列。',
      }
    }
    return {
      tone: 'warning',
      title: '暂未识别到可自动匹配的列',
      text: '请检查表头命名，或手动选择每个字段对应的列。',
    }
  })

  const dataQuality = computed(() => {
    const result = { missingRows: 0, duplicateExamIds: 0, duplicateSeatKeys: 0 }
    const rows = excel.rows
    if (!rows.length) return result

    const mappedTextFields = mappableFields.value.filter((f) => mapping[f.id])
    if (mappedTextFields.length) {
      result.missingRows = rows.filter((row) =>
        mappedTextFields.some((f) => !fieldText(row, f.id).trim()),
      ).length
    }

    const examIdColumn = columnOf('examId')
    if (examIdColumn) {
      const seen = new Set<string>()
      const dup = new Set<string>()
      for (const row of rows) {
        const value = String(row[examIdColumn] ?? '').trim()
        if (!value) continue
        if (seen.has(value)) dup.add(value)
        else seen.add(value)
      }
      result.duplicateExamIds = dup.size
    }

    const roomColumn = columnOf('room')
    const seatColumn = columnOf('seatNo')
    if (roomColumn && seatColumn) {
      const seen = new Set<string>()
      const dup = new Set<string>()
      for (const row of rows) {
        const room = String(row[roomColumn] ?? '').trim()
        const seat = String(row[seatColumn] ?? '').trim()
        if (!room || !seat) continue
        const key = `${room}__${seat}`
        if (seen.has(key)) dup.add(key)
        else seen.add(key)
      }
      result.duplicateSeatKeys = dup.size
    }

    return result
  })

  const hasDataQualityRisk = computed(
    () =>
      dataQuality.value.missingRows > 0 ||
      dataQuality.value.duplicateExamIds > 0 ||
      dataQuality.value.duplicateSeatKeys > 0,
  )

  const photoStats = computed(() => {
    const totalRows = excel.rows.length
    const matchedRows = photoColumn.value
      ? excel.rows.filter((row) => photos.value.has(String(row[photoColumn.value] ?? ''))).length
      : 0
    const coverage = totalRows ? Math.round((matchedRows / totalRows) * 100) : 0
    return { totalRows, matchedRows, totalPhotos: photos.value.size, coverage }
  })

  watch(totalPages, (value) => {
    if (!value) previewPage.value = 1
    else if (previewPage.value > value) previewPage.value = value
  })

  // ---------- 行为 ----------
  function setLoading(active: boolean, text = '', onCancel: (() => void) | null = null) {
    loading.active = active
    loading.text = text
    loading.onCancel = active ? onCancel : null
  }

  async function withLoading<T>(text: string, fn: () => Promise<T>): Promise<T> {
    setLoading(true, text)
    try {
      return await fn()
    } finally {
      setLoading(false)
    }
  }

  /** 切换模板：保留已有人工映射与已选纸型，对缺口字段重新自动匹配 */
  function selectTemplate(next: LabelTemplate, options: { silent?: boolean } = {}) {
    // 切换前记录当前已选纸型：兼容的新模板继续沿用，避免重选
    const currentPaper = matchLabelPaper(template.value.page, template.value.label)
    template.value = cloneTemplate(next)
    selectedTemplateId.value = next.id
    previewPage.value = 1
    let paperNote = ''
    if (currentPaper) {
      if (isPaperCompatible(template.value, currentPaper)) {
        applyLabelPaper(template.value, currentPaper)
        paperNote = `，已保留纸型「${currentPaper.name}」`
      } else if (!options.silent) {
        toast.warning(
          '已选纸型与新模板不兼容',
          `「${currentPaper.name}」不适用于整页/折叠类模板，已恢复模板默认排版`,
        )
      }
    }
    remapForTemplate()
    // 模板若使用了在线字体（自定义 / 分享 / 导入），后台补载
    useFontsStore().ensureTemplateFonts(template.value)
    if (!options.silent) {
      toast.info('模板已切换', `当前模板：${next.name}${paperNote}`)
    }
  }

  function remapForTemplate() {
    const validIds = new Set(mappableFields.value.map((f) => f.id))
    for (const key of Object.keys(mapping)) {
      if (!validIds.has(key)) delete mapping[key]
    }
    if (!excel.headers.length) return
    const auto = autoMapFields(template.value.fields, excel.headers)
    for (const field of mappableFields.value) {
      if (!mapping[field.id] && auto[field.id]) {
        mapping[field.id] = auto[field.id]
      }
    }
  }

  function applyExcel(data: {
    fileName: string
    sheetName: string
    headers: string[]
    rows: DataRow[]
  }) {
    excel.fileName = data.fileName
    excel.sheetName = data.sheetName
    excel.headers = data.headers
    excel.rows = data.rows
    previewPage.value = 1
    clearPhotos()
    resetDataView()
    clearAllOverrides()
    for (const key of Object.keys(mapping)) delete mapping[key]
    Object.assign(mapping, autoMapFields(template.value.fields, data.headers))
  }

  async function importExcel(file: File) {
    await withLoading('正在解析 Excel 文件...', async () => {
      try {
        const parsed = await parseExcelFile(file)
        applyExcel(parsed)
        isDemoData.value = false
        toast.success('Excel 导入成功', `已读取 ${parsed.rows.length} 条数据`)
      } catch (err) {
        toast.danger('Excel 导入失败', err instanceof Error ? err.message : String(err))
      }
    })
  }

  /** 由站内功能（如教室座位表）直接注入名单数据，等效于导入一份 Excel */
  function applyDataset(fileName: string, headers: string[], rows: DataRow[]) {
    applyExcel({ fileName, sheetName: '站内数据', headers, rows })
    isDemoData.value = false
  }

  function useDemoData() {
    const demo = demoExcelFor(template.value)
    applyExcel(demo)
    // 演示数据自带精确映射（含模板专属补充列），覆盖自动匹配可能漏掉的槽位
    Object.assign(mapping, demo.mapping)
    isDemoData.value = true
    toast.info(`已载入「${demo.sheetName}」演示数据`, '体验完整流程后可清空并上传自己的 Excel')
  }

  function clearData() {
    excel.fileName = ''
    excel.sheetName = ''
    excel.headers = []
    excel.rows = []
    isDemoData.value = false
    for (const key of Object.keys(mapping)) delete mapping[key]
    clearPhotos()
    resetDataView()
    clearAllOverrides({ silent: true })
    previewPage.value = 1
    toast.info('数据已清空', '可以重新导入新的 Excel 与照片')
  }

  function setMappingValue(fieldId: string, header: string) {
    if (header) mapping[fieldId] = header
    else delete mapping[fieldId]
  }

  function setPhotoColumn(column: string) {
    photoColumn.value = column
  }

  async function importPhotos(files: File[]) {
    if (!photoColumn.value) {
      toast.warning('请先选择匹配列', '照片文件名需等于或包含该列的值，如「张伟2023010101.jpg」')
      return
    }
    await withLoading(`正在加载 ${files.length} 张照片...`, async () => {
      const matchValues = new Set(
        excel.rows.map((row) => String(row[photoColumn.value] ?? '')).filter(Boolean),
      )
      const result = await loadPhotoFiles(files, matchValues)
      const merged = new Map(photos.value)
      result.photos.forEach((dataUrl, key) => merged.set(key, dataUrl))
      photos.value = merged
      photoErrors.value = result.errors
      toast.success(
        '照片已加载',
        `本次匹配 ${result.matched} 张，当前覆盖率 ${photoStats.value.coverage}%`,
      )
    })
  }

  function clearPhotos() {
    photos.value = new Map()
    photoErrors.value = []
    photoColumn.value = ''
  }

  // ---------- 取值辅助 ----------
  /** 某字段映射到的单一 Excel 列；组合字段（模板串）返回空 */
  function columnOf(fieldId: string): string {
    const value = mapping[fieldId]
    if (!value || isCompositeMapping(value, excel.headers)) return ''
    return value
  }

  /** 不含单张覆写的基础取值：固定文本 / 镜像 / 组合模板串 / 单列映射 */
  function baseFieldText(row: DataRow, fieldId: string): string {
    const field = template.value.fields.find((f) => f.id === fieldId)
    if (field?.fixedText != null) return field.fixedText
    if (field?.mirrorOf != null) return fieldText(row, field.mirrorOf)
    const value = mapping[fieldId]
    if (!value) return ''
    if (isCompositeMapping(value, excel.headers)) return evaluateFieldTemplate(value, row)
    return String(row[value] ?? '')
  }

  function fieldText(row: DataRow, fieldId: string): string {
    const override = rowOverrides.value.get(row)?.[fieldId]
    if (override != null) return override
    return baseFieldText(row, fieldId)
  }

  function isFieldEmpty(row: DataRow, fieldId: string): boolean {
    return !fieldText(row, fieldId).trim()
  }

  function photoFor(row: DataRow): string | null {
    if (!photoColumn.value) return null
    const key = String(row[photoColumn.value] ?? '')
    return key ? (photos.value.get(key) ?? null) : null
  }

  return {
    template,
    selectedTemplateId,
    excel,
    isDemoData,
    mapping,
    photoColumn,
    photos,
    photoErrors,
    sort,
    columnFilters,
    displayRows,
    isViewCustomized,
    toggleSort,
    setColumnFilter,
    resetDataView,
    previewPage,
    showCutLines,
    highlightMissing,
    cutStackSort,
    showMirror,
    hasMirrorFields,
    renderTemplate,
    loading,
    textFields,
    mappableFields,
    imageFields,
    hasImageField,
    hasMatchedImageField,
    perPage,
    pages,
    totalPages,
    currentPageRows,
    mappedCount,
    unmappedFields,
    mappingSummary,
    dataQuality,
    hasDataQualityRisk,
    photoStats,
    setLoading,
    withLoading,
    selectTemplate,
    importExcel,
    applyDataset,
    useDemoData,
    clearData,
    setMappingValue,
    setPhotoColumn,
    importPhotos,
    clearPhotos,
    rowOverrides,
    overrideCount,
    overridesFor,
    setRowOverride,
    clearRowOverride,
    clearAllOverrides,
    baseFieldText,
    fieldText,
    isFieldEmpty,
    photoFor,
  }
})
