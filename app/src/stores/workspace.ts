import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'

import { defaultTemplates } from '@/data/defaultTemplates'
import { useFontsStore } from '@/stores/fonts'
import { isValidTemplate } from '@/stores/templateLibrary'
import { useToastStore } from '@/stores/toast'
import type { DataRow, FieldMapping, LabelTemplate, TemplateField } from '@/types/template'
import { autoMapFields } from '@/utils/autoMap'
import { compareCellText, makeDemoRows, parseExcelFile } from '@/utils/excel'
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
  const loading = reactive({ active: false, text: '' })

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
  const pages = computed<DataRow[][]>(() => chunkRows(displayRows.value, perPage.value))
  const totalPages = computed(() => pages.value.length)
  const currentPageRows = computed<DataRow[]>(() => pages.value[previewPage.value - 1] ?? [])

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

    const examIdColumn = mapping.examId
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

    const roomColumn = mapping.room
    const seatColumn = mapping.seatNo
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
  function setLoading(active: boolean, text = '') {
    loading.active = active
    loading.text = text
  }

  async function withLoading<T>(text: string, fn: () => Promise<T>): Promise<T> {
    setLoading(true, text)
    try {
      return await fn()
    } finally {
      setLoading(false)
    }
  }

  /** 切换模板：保留已有人工映射，对缺口字段重新自动匹配 */
  function selectTemplate(next: LabelTemplate, options: { silent?: boolean } = {}) {
    template.value = cloneTemplate(next)
    selectedTemplateId.value = next.id
    previewPage.value = 1
    remapForTemplate()
    // 模板若使用了在线字体（自定义 / 分享 / 导入），后台补载
    useFontsStore().ensureTemplateFonts(template.value)
    if (!options.silent) {
      toast.info('模板已切换', `当前模板：${next.name}`)
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
    const demo = makeDemoRows(30)
    applyExcel({ fileName: '演示数据.xlsx', sheetName: '示例', ...demo })
    isDemoData.value = true
    toast.info('已载入演示数据', '体验完整流程后可清空并上传自己的 Excel')
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
  function fieldText(row: DataRow, fieldId: string): string {
    const field = template.value.fields.find((f) => f.id === fieldId)
    if (field?.fixedText != null) return field.fixedText
    if (field?.mirrorOf != null) return fieldText(row, field.mirrorOf)
    const column = mapping[fieldId]
    return column ? String(row[column] ?? '') : ''
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
    fieldText,
    isFieldEmpty,
    photoFor,
  }
})
