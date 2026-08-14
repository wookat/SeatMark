<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import CheckboxField from '@/components/ui/CheckboxField.vue'
import ModalDialog from '@/components/ui/ModalDialog.vue'
import { useDragScroll } from '@/composables/useDragScroll'
import { t } from '@/i18n'
import { useToastStore } from '@/stores/toast'
import { useWorkspaceStore } from '@/stores/workspace'
import { compareCellText, dedupeDataRows, downloadSampleExcel, parsePastedRoster } from '@/utils/excel'

const workspace = useWorkspaceStore()
const toast = useToastStore()

const fileInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)

/** 面板小预览跟随排版顺序（筛选 + 排序后） */
const previewRows = computed(() => workspace.displayRows.slice(0, 5))

// 列较多时表格在容器内横向滚动，支持按住拖拽平移查看
const previewScroller = ref<HTMLElement | null>(null)
const viewerScroller = ref<HTMLElement | null>(null)
useDragScroll(previewScroller)
useDragScroll(viewerScroller)

/** 面板上的排版顺序摘要 */
const viewSummary = computed(() => {
  const parts: string[] = []
  if (workspace.sort.column) {
    parts.push(
      `按「${workspace.sort.column}」${workspace.sort.direction === 'asc' ? '升序' : '降序'}`,
    )
  }
  if (Object.keys(workspace.columnFilters).length) {
    parts.push(`筛选后 ${workspace.displayRows.length}/${workspace.excel.rows.length} 条`)
  }
  return parts.join(' · ')
})

// ---------- 全部数据浏览（列筛选与排序决定排版顺序） ----------
const dataViewerOpen = ref(false)
const dataQuery = ref('')

/** 在排版顺序（displayRows）基础上做仅查看用的全局搜索 */
const viewRows = computed(() => {
  const q = dataQuery.value.trim().toLowerCase()
  const rows = workspace.displayRows
  if (!q) return rows
  return rows.filter((row) =>
    workspace.excel.headers.some((h) => String(row[h] ?? '').toLowerCase().includes(q)),
  )
})

function openDataViewer() {
  dataQuery.value = ''
  dataViewerOpen.value = true
}

// ---------- 列筛选弹层（Excel 自动筛选风格） ----------
const filterColumn = ref<string | null>(null)
const filterPos = ref({ x: 0, y: 0 })
const filterQuery = ref('')
const filterDraft = ref(new Set<string>())
const filterPanel = ref<HTMLElement | null>(null)

/** 当前筛选列的全部取值（按 Excel 排序规则排列，含出现次数） */
const distinctValues = computed(() => {
  const header = filterColumn.value
  if (!header) return [] as Array<{ value: string; count: number }>
  const counts = new Map<string, number>()
  for (const row of workspace.excel.rows) {
    const value = String(row[header] ?? '')
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => compareCellText(a[0], b[0]))
    .map(([value, count]) => ({ value, count }))
})

const shownValues = computed(() => {
  const q = filterQuery.value.trim().toLowerCase()
  if (!q) return distinctValues.value
  return distinctValues.value.filter((item) => item.value.toLowerCase().includes(q))
})

function openFilter(header: string, event: MouseEvent) {
  filterColumn.value = header
  filterQuery.value = ''
  const current = workspace.columnFilters[header]
  filterDraft.value = new Set(current ?? distinctValues.value.map((i) => i.value))
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  filterPos.value = {
    x: Math.max(8, Math.min(rect.left - 60, window.innerWidth - 256)),
    y: Math.min(rect.bottom + 4, window.innerHeight - 340),
  }
}

function toggleDraftValue(value: string) {
  const next = new Set(filterDraft.value)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  filterDraft.value = next
}

function draftSelectAll(selected: boolean) {
  filterDraft.value = selected ? new Set(distinctValues.value.map((i) => i.value)) : new Set()
}

function applyFilter() {
  const header = filterColumn.value
  if (!header) return
  const all = distinctValues.value
  const draft = filterDraft.value
  const isAll = all.every((item) => draft.has(item.value))
  // 全选等价于取消该列筛选
  workspace.setColumnFilter(header, isAll ? null : [...draft])
  filterColumn.value = null
}

function onDocPointerDown(event: PointerEvent) {
  if (
    filterColumn.value &&
    filterPanel.value &&
    !filterPanel.value.contains(event.target as Node)
  ) {
    filterColumn.value = null
  }
}

function onDocKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') filterColumn.value = null
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown)
  document.addEventListener('keydown', onDocKeydown)
  // 导入面板可见即空闲预取解析库分包，首次导入不再等待网络拉取
  const prefetch = () => void import('xlsx').catch(() => {})
  if ('requestIdleCallback' in window) {
    requestIdleCallback(prefetch, { timeout: 3000 })
  } else {
    setTimeout(prefetch, 1500)
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
  document.removeEventListener('keydown', onDocKeydown)
})

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) void workspace.importExcel(file)
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  dragging.value = false
  const file = event.dataTransfer?.files[0]
  if (!file) return
  if (/\.(xlsx|xls|csv)$/i.test(file.name)) {
    void workspace.importExcel(file)
  } else {
    toast.warning('文件类型不支持', '请拖入 .xlsx / .xls / .csv 文件')
  }
}

// ---------- 粘贴名单导入 ----------
const pasteOpen = ref(false)
const pasteText = ref('')
/** 用户手动指定首行是否为表头；null 表示跟随关键词自动识别 */
const pasteHeaderOverride = ref<boolean | null>(null)
/** 导入时是否自动去除完全重复的行 */
const pasteDedupe = ref(true)
const txtInput = ref<HTMLInputElement | null>(null)

const pasteParsed = computed(() => {
  const parsed = parsePastedRoster(pasteText.value, pasteHeaderOverride.value ?? undefined)
  if (!pasteDedupe.value) return { ...parsed, removed: 0 }
  const { rows, removed } = dedupeDataRows(parsed.rows, parsed.headers)
  return { ...parsed, rows, removed }
})

function onTxtChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const text = typeof reader.result === 'string' ? reader.result : ''
    pasteText.value = pasteText.value.trim() ? `${pasteText.value}\n${text}` : text
  }
  reader.readAsText(file)
}

function togglePasteHeader(value: boolean) {
  pasteHeaderOverride.value = value
}

function openPasteDialog() {
  pasteText.value = ''
  pasteHeaderOverride.value = null
  pasteDedupe.value = true
  pasteOpen.value = true
}

function confirmPaste() {
  const parsed = pasteParsed.value
  if (!parsed.rows.length) {
    toast.warning('名单为空', '请粘贴名单内容，每行一条数据')
    return
  }
  workspace.applyDataset('粘贴的名单', parsed.headers, parsed.rows)
  pasteOpen.value = false
  const dedupeNote = parsed.removed ? `，已去重 ${parsed.removed} 条` : ''
  toast.success(
    `已导入 ${parsed.rows.length} 条数据`,
    (parsed.headerDetected ? '首行已识别为表头' : '未检测到表头，首列已按「姓名」处理') + dedupeNote,
  )
}

async function onDownloadSample() {
  const sample = await downloadSampleExcel(workspace.template)
  toast.success(`「${sample.sheetName}」样例已下载`, '按样例表头整理名单后上传即可直接导入')
}
</script>

<template>
  <section class="panel-card">
    <div class="panel-head">
      <h2 class="section-title"><span class="step-chip">2</span>{{ t('导入数据') }}</h2>
      <button type="button" class="btn btn-ghost btn-sm" @click="onDownloadSample">
        {{ t('下载样例 Excel') }}
      </button>
    </div>

    <template v-if="!workspace.excel.rows.length">
      <div
        class="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors"
        :class="
          dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-50 hover:border-brand-400'
        "
        @click="fileInput?.click()"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop="onDrop"
      >
        <span
          class="rounded-lg bg-emerald-100 px-2 py-1 text-[11px] font-bold tracking-wide text-emerald-700"
        >
          XLSX
        </span>
        <p class="text-sm text-slate-600">
          <strong class="text-brand-600">{{ t('点击选择') }}</strong> {{ t('或拖拽 Excel 到此处') }}
        </p>
        <p class="text-xs text-slate-600">{{ t('第一行默认作为表头，支持 .xlsx / .xls / .csv；不确定格式可先下载样例 Excel') }}</p>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <button type="button" class="btn btn-ghost btn-sm" @click="openPasteDialog">
          {{ t('没有文件？粘贴名单') }}
        </button>
        <button type="button" class="btn btn-ghost btn-sm" @click="workspace.useDemoData()">
          {{ t('先用演示数据体验') }}
        </button>
      </div>
    </template>

    <template v-else>
      <div class="flex items-center justify-between rounded-lg bg-slate-50 p-3">
        <div class="min-w-0">
          <p class="flex min-w-0 items-center text-sm font-semibold text-slate-800">
            <span class="truncate">{{ workspace.excel.fileName }}</span>
            <span
              v-if="workspace.isDemoData"
              class="ml-1 shrink-0 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700"
            >
              {{ t('演示数据') }}
            </span>
          </p>
          <p class="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-600">
            <template v-if="workspace.excel.sheetNames.length > 1">
              <label class="flex items-center gap-1">
                工作表
                <select
                  class="max-w-36 cursor-pointer truncate rounded border border-slate-300 bg-white px-1 py-0.5 text-xs text-slate-700"
                  :value="workspace.excel.sheetName"
                  aria-label="切换工作表"
                  @change="
                    workspace.switchSheet(($event.target as HTMLSelectElement).value)
                  "
                >
                  <option v-for="name in workspace.excel.sheetNames" :key="name" :value="name">
                    {{ name }}
                  </option>
                </select>
              </label>
            </template>
            <template v-else>{{ t('工作表') }}「{{ workspace.excel.sheetName }}」</template>
            ·
            <span class="whitespace-nowrap"
              >{{ t('共') }} <strong class="text-brand-600">{{ workspace.excel.rows.length }}</strong> {{ t('条数据') }}</span
            >
          </p>
        </div>
        <div class="flex shrink-0 gap-1.5">
          <button type="button" class="btn btn-secondary btn-sm" @click="fileInput?.click()">
            {{ t('重新上传') }}
          </button>
          <button type="button" class="btn btn-danger btn-sm" @click="workspace.clearData()">
            {{ t('清空') }}
          </button>
        </div>
      </div>

      <p
        v-if="workspace.isViewCustomized"
        class="mt-2 flex items-center gap-2 rounded-lg border border-brand-100 bg-brand-50/70 px-2.5 py-1.5 text-[11px] leading-4 text-brand-700"
      >
        <span class="min-w-0 flex-1">{{ t('排版顺序：') }}{{ viewSummary }}</span>
        <button
          type="button"
          class="shrink-0 cursor-pointer font-bold transition-colors hover:text-brand-900 hover:underline"
          @click="workspace.resetDataView()"
        >
          {{ t('恢复原序') }}
        </button>
      </p>

      <div
        ref="previewScroller"
        tabindex="0"
        role="region"
        aria-label="名单数据预览（可横向滚动）"
        class="mt-3 cursor-grab overflow-x-auto rounded-lg border border-slate-200 focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="bg-slate-50 text-slate-600">
              <th
                v-for="h in workspace.excel.headers"
                :key="h"
                class="px-2.5 py-1.5 font-semibold whitespace-nowrap"
              >
                {{ h }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in previewRows" :key="i" class="border-t border-slate-100">
              <td
                v-for="h in workspace.excel.headers"
                :key="h"
                class="px-2.5 py-1.5 whitespace-nowrap text-slate-700"
              >
                {{ row[h] }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="mt-1.5 flex items-center justify-between">
        <button type="button" class="btn btn-ghost btn-sm -ml-2" @click="openDataViewer">
          {{ t('查看全部数据（可筛选排序）') }}
        </button>
        <p v-if="workspace.displayRows.length > 5" class="text-[11px] text-slate-600">
          {{ t('仅展示前 5 条') }}，{{ t('共') }} {{ workspace.displayRows.length }} {{ t('条') }}
        </p>
      </div>
    </template>

    <ModalDialog :open="pasteOpen" :title="t('粘贴名单导入')" size="md" @close="pasteOpen = false">
      <p class="text-xs text-slate-600">
        {{ t('从 Excel/WPS 直接复制区域粘贴（自动分列），或粘贴微信、文档里整理的名单（每行一条，多列可用逗号、顿号或空格分隔），也可直接上传 .txt 文本名单。数据不出浏览器。') }}
      </p>
      <div class="mt-2 flex items-center justify-between gap-2">
        <button type="button" class="btn btn-ghost btn-sm -ml-2" @click="txtInput?.click()">
          {{ t('上传 TXT 文件') }}
        </button>
        <input
          ref="txtInput"
          type="file"
          accept=".txt,text/plain"
          class="hidden"
          aria-label="上传 TXT 名单文件"
          @change="onTxtChange"
        />
        <CheckboxField v-model="pasteDedupe" class="shrink-0 text-xs text-slate-600">
          {{ t('自动去重重复行') }}
        </CheckboxField>
      </div>
      <textarea
        v-model="pasteText"
        rows="10"
        class="input-field mt-2 w-full resize-y font-mono text-xs"
        placeholder="例如：
姓名	班级	座位号
张伟	高三（1）班	01
王芳	高三（1）班	02"
        aria-label="粘贴名单内容"
      ></textarea>
      <div
        v-if="pasteText.trim()"
        class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600"
      >
        <span class="min-w-0">
          识别到 <strong class="text-brand-600">{{ pasteParsed.rows.length }}</strong> 条数据、{{ pasteParsed.headers.length }} 列（{{ pasteParsed.headerDetected ? `首行为表头：${pasteParsed.headers.join('、')}` : '未检测到表头，首列将按「姓名」处理' }}）<template v-if="pasteParsed.removed">，已去重 <strong class="text-amber-600">{{ pasteParsed.removed }}</strong> 条</template>
        </span>
        <CheckboxField
          class="shrink-0"
          :model-value="pasteParsed.headerDetected"
          @update:model-value="togglePasteHeader"
        >
          {{ t('首行是表头') }}
        </CheckboxField>
      </div>
      <template #actions>
        <button type="button" class="btn btn-secondary btn-md" @click="pasteOpen = false">
          {{ t('取消') }}
        </button>
        <button
          type="button"
          class="btn btn-primary btn-md"
          :disabled="!pasteParsed.rows.length"
          @click="confirmPaste"
        >
          {{ t('导入名单') }}
        </button>
      </template>
    </ModalDialog>

    <ModalDialog
      :open="dataViewerOpen"
      :title="`${t('全部数据')} · ${workspace.excel.fileName}`"
      size="xl"
      @close="dataViewerOpen = false"
    >
      <div class="flex flex-wrap items-center gap-2">
        <input
          v-model="dataQuery"
          type="text"
          class="input-field max-w-60"
          :placeholder="t('搜索任意列（仅查看，不影响排版）…')"
        />
        <span class="text-xs text-slate-600">
          {{ viewRows.length }} / {{ workspace.excel.rows.length }} {{ t('条') }}
        </span>
        <button
          v-if="workspace.isViewCustomized"
          type="button"
          class="btn btn-ghost btn-sm"
          @click="workspace.resetDataView()"
        >
          {{ t('清除筛选与排序') }}
        </button>
        <span class="ml-auto hidden text-[11px] text-slate-600 sm:inline">
          {{ t('点击列名排序、漏斗筛选，标签将按当前顺序排版') }}
        </span>
      </div>

      <div
        ref="viewerScroller"
        class="mt-3 max-h-[62vh] cursor-grab overflow-auto rounded-lg border border-slate-200"
      >
        <table class="w-full text-left text-xs">
          <thead class="sticky top-0 z-10">
            <tr class="bg-slate-50 text-slate-600">
              <th class="w-12 px-2.5 py-1.5 font-semibold whitespace-nowrap">#</th>
              <th
                v-for="h in workspace.excel.headers"
                :key="h"
                class="px-1.5 py-1 font-semibold whitespace-nowrap"
              >
                <span class="flex items-center">
                  <button
                    type="button"
                    class="flex cursor-pointer items-center gap-1 rounded-md px-1 py-1 transition-colors hover:bg-slate-200/60 hover:text-brand-700"
                    :class="{ 'text-brand-700': workspace.sort.column === h }"
                    :title="`按「${h}」排序（再次点击切换升降序 / 还原）`"
                    @click="workspace.toggleSort(h)"
                  >
                    {{ h }}
                    <svg
                      v-if="workspace.sort.column === h"
                      class="size-3 shrink-0"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path
                        v-if="workspace.sort.direction === 'asc'"
                        d="M8 13V3m0 0L4.5 6.5M8 3l3.5 3.5"
                      />
                      <path v-else d="M8 3v10m0 0 3.5-3.5M8 13l-3.5-3.5" />
                    </svg>
                    <svg
                      v-else
                      class="size-3 shrink-0 text-slate-300"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.6"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="m5 6 3-3 3 3M5 10l3 3 3-3" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-slate-200/60"
                    :class="workspace.columnFilters[h] ? 'text-brand-600' : 'text-slate-300 hover:text-slate-600'"
                    :aria-label="`筛选「${h}」`"
                    :title="`筛选「${h}」`"
                    @click="openFilter(h, $event)"
                  >
                    <svg
                      class="size-3"
                      viewBox="0 0 16 16"
                      :fill="workspace.columnFilters[h] ? 'currentColor' : 'none'"
                      stroke="currentColor"
                      stroke-width="1.6"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M2 3h12L9.5 8.5V13l-3-1.5V8.5L2 3Z" />
                    </svg>
                  </button>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, i) in viewRows"
              :key="i"
              class="border-t border-slate-100 hover:bg-slate-50/70"
            >
              <td class="px-2.5 py-1.5 whitespace-nowrap text-slate-600">{{ i + 1 }}</td>
              <td
                v-for="h in workspace.excel.headers"
                :key="h"
                class="px-2.5 py-1.5 whitespace-nowrap text-slate-700"
              >
                {{ row[h] }}
              </td>
            </tr>
            <tr v-if="!viewRows.length">
              <td
                :colspan="workspace.excel.headers.length + 1"
                class="px-2.5 py-8 text-center text-slate-600"
              >
                {{ t('没有匹配的数据，请调整搜索或列筛选条件') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <template #actions>
        <button type="button" class="btn btn-secondary btn-md" @click="dataViewerOpen = false">
          {{ t('关闭') }}
        </button>
      </template>
    </ModalDialog>

    <!-- 列筛选弹层（Excel 自动筛选风格，覆盖在数据弹窗之上） -->
    <Teleport to="body">
      <div
        v-if="filterColumn"
        ref="filterPanel"
        class="fixed z-[70] w-60 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-pop"
        :style="{ left: `${filterPos.x}px`, top: `${filterPos.y}px` }"
      >
        <div class="border-b border-slate-100 p-2">
          <p class="px-1 pb-1.5 text-[11px] font-bold text-slate-600">{{ t('筛选') }}「{{ filterColumn }}」</p>
          <input
            v-model="filterQuery"
            type="text"
            class="input-field !py-1 text-xs"
            :placeholder="t('搜索取值…')"
          />
        </div>
        <div class="flex items-center gap-1 border-b border-slate-100 px-2 py-1">
          <button type="button" class="btn btn-ghost btn-sm !px-1.5" @click="draftSelectAll(true)">
            {{ t('全选') }}
          </button>
          <button type="button" class="btn btn-ghost btn-sm !px-1.5" @click="draftSelectAll(false)">
            {{ t('清空') }}
          </button>
          <span class="ml-auto text-[10px] text-slate-600">
            {{ t('已选') }} {{ filterDraft.size }}/{{ distinctValues.length }}
          </span>
        </div>
        <div class="max-h-56 overflow-y-auto p-1.5">
          <CheckboxField
            v-for="item in shownValues"
            :key="item.value"
            class="rounded-lg px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
            :model-value="filterDraft.has(item.value)"
            @update:model-value="toggleDraftValue(item.value)"
          >
            <span class="min-w-0 flex-1 truncate" :class="{ 'text-slate-600 italic': !item.value }">
              {{ item.value || t('(空白)') }}
            </span>
            <span class="shrink-0 text-[10px] text-slate-600">{{ item.count }}</span>
          </CheckboxField>
          <p v-if="!shownValues.length" class="px-2 py-4 text-center text-xs text-slate-600">
            {{ t('没有匹配的取值') }}
          </p>
        </div>
        <div class="flex justify-end gap-1.5 border-t border-slate-100 p-2">
          <button type="button" class="btn btn-ghost btn-sm" @click="filterColumn = null">
            {{ t('取消') }}
          </button>
          <button type="button" class="btn btn-primary btn-sm" @click="applyFilter">{{ t('应用') }}</button>
        </div>
      </div>
    </Teleport>

    <input
      ref="fileInput"
      type="file"
      accept=".xlsx,.xls,.csv"
      class="hidden"
      @change="onFileChange"
    />
  </section>
</template>
