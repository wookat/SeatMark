<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import CheckboxField from '@/components/ui/CheckboxField.vue'
import ModalDialog from '@/components/ui/ModalDialog.vue'
import { useDragScroll } from '@/composables/useDragScroll'
import { useToastStore } from '@/stores/toast'
import { useWorkspaceStore } from '@/stores/workspace'
import { compareCellText, downloadSampleExcel } from '@/utils/excel'

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
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    void workspace.importExcel(file)
  } else {
    toast.warning('文件类型不支持', '请拖入 .xlsx 或 .xls 文件')
  }
}

async function onDownloadSample() {
  await downloadSampleExcel()
  toast.success('示例模板已下载', '按示例表头整理数据后重新上传即可')
}
</script>

<template>
  <section class="panel-card">
    <div class="panel-head">
      <h2 class="section-title"><span class="step-chip">2</span>导入数据</h2>
      <button type="button" class="btn btn-ghost btn-sm" @click="onDownloadSample">
        下载示例 Excel
      </button>
    </div>

    <template v-if="!workspace.excel.rows.length">
      <div
        class="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors"
        :class="
          dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-50 hover:border-brand-400'
        "
        @click="fileInput?.click()"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop="onDrop"
      >
        <span
          class="rounded-lg bg-emerald-100 px-2 py-1 text-[11px] font-black tracking-wide text-emerald-700"
        >
          XLSX
        </span>
        <p class="text-sm text-slate-600">
          <strong class="text-brand-600">点击选择</strong> 或拖拽 Excel 到此处
        </p>
        <p class="text-xs text-slate-400">第一行默认作为表头，支持 .xlsx / .xls</p>
      </div>
      <button type="button" class="btn btn-ghost btn-sm mt-3 w-full" @click="workspace.useDemoData()">
        没有现成文件？先用演示数据体验
      </button>
    </template>

    <template v-else>
      <div class="flex items-center justify-between rounded-xl bg-slate-50 p-3">
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-slate-800">
            {{ workspace.excel.fileName }}
            <span
              v-if="workspace.isDemoData"
              class="ml-1 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700"
            >
              演示数据
            </span>
          </p>
          <p class="mt-0.5 text-xs text-slate-500">
            工作表「{{ workspace.excel.sheetName }}」 · 共
            <strong class="text-brand-600">{{ workspace.excel.rows.length }}</strong> 条数据
          </p>
        </div>
        <div class="flex shrink-0 gap-1.5">
          <button type="button" class="btn btn-secondary btn-sm" @click="fileInput?.click()">
            重新上传
          </button>
          <button type="button" class="btn btn-danger btn-sm" @click="workspace.clearData()">
            清空
          </button>
        </div>
      </div>

      <p
        v-if="workspace.isViewCustomized"
        class="mt-2 flex items-center gap-2 rounded-lg border border-brand-100 bg-brand-50/70 px-2.5 py-1.5 text-[11px] leading-4 text-brand-700"
      >
        <span class="min-w-0 flex-1">排版顺序：{{ viewSummary }}</span>
        <button
          type="button"
          class="shrink-0 cursor-pointer font-bold transition-colors hover:text-brand-900 hover:underline"
          @click="workspace.resetDataView()"
        >
          恢复原序
        </button>
      </p>

      <div
        ref="previewScroller"
        class="mt-3 cursor-grab overflow-x-auto rounded-lg border border-slate-200"
      >
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="bg-slate-50 text-slate-500">
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
          查看全部数据（可筛选排序）
        </button>
        <p v-if="workspace.displayRows.length > 5" class="text-[11px] text-slate-400">
          仅展示前 5 条，共 {{ workspace.displayRows.length }} 条
        </p>
      </div>
    </template>

    <ModalDialog
      :open="dataViewerOpen"
      :title="`全部数据 · ${workspace.excel.fileName}`"
      size="xl"
      @close="dataViewerOpen = false"
    >
      <div class="flex flex-wrap items-center gap-2">
        <input
          v-model="dataQuery"
          type="text"
          class="input-field max-w-60"
          placeholder="搜索任意列（仅查看，不影响排版）…"
        />
        <span class="text-xs text-slate-400">
          {{ viewRows.length }} / {{ workspace.excel.rows.length }} 条
        </span>
        <button
          v-if="workspace.isViewCustomized"
          type="button"
          class="btn btn-ghost btn-sm"
          @click="workspace.resetDataView()"
        >
          清除筛选与排序
        </button>
        <span class="ml-auto hidden text-[11px] text-slate-400 sm:inline">
          点击列名排序、漏斗筛选，标签将按当前顺序排版
        </span>
      </div>

      <div
        ref="viewerScroller"
        class="mt-3 max-h-[62vh] cursor-grab overflow-auto rounded-lg border border-slate-200"
      >
        <table class="w-full text-left text-xs">
          <thead class="sticky top-0 z-10">
            <tr class="bg-slate-50 text-slate-500">
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
                    :class="workspace.columnFilters[h] ? 'text-brand-600' : 'text-slate-300 hover:text-slate-500'"
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
              <td class="px-2.5 py-1.5 whitespace-nowrap text-slate-400">{{ i + 1 }}</td>
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
                class="px-2.5 py-8 text-center text-slate-400"
              >
                没有匹配的数据，请调整搜索或列筛选条件
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <template #actions>
        <button type="button" class="btn btn-secondary btn-md" @click="dataViewerOpen = false">
          关闭
        </button>
      </template>
    </ModalDialog>

    <!-- 列筛选弹层（Excel 自动筛选风格，覆盖在数据弹窗之上） -->
    <Teleport to="body">
      <div
        v-if="filterColumn"
        ref="filterPanel"
        class="fixed z-[70] w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        :style="{ left: `${filterPos.x}px`, top: `${filterPos.y}px` }"
      >
        <div class="border-b border-slate-100 p-2">
          <p class="px-1 pb-1.5 text-[11px] font-bold text-slate-500">筛选「{{ filterColumn }}」</p>
          <input
            v-model="filterQuery"
            type="text"
            class="input-field !py-1 text-xs"
            placeholder="搜索取值…"
          />
        </div>
        <div class="flex items-center gap-1 border-b border-slate-100 px-2 py-1">
          <button type="button" class="btn btn-ghost btn-sm !px-1.5" @click="draftSelectAll(true)">
            全选
          </button>
          <button type="button" class="btn btn-ghost btn-sm !px-1.5" @click="draftSelectAll(false)">
            清空
          </button>
          <span class="ml-auto text-[10px] text-slate-400">
            已选 {{ filterDraft.size }}/{{ distinctValues.length }}
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
            <span class="min-w-0 flex-1 truncate" :class="{ 'text-slate-400 italic': !item.value }">
              {{ item.value || '(空白)' }}
            </span>
            <span class="shrink-0 text-[10px] text-slate-400">{{ item.count }}</span>
          </CheckboxField>
          <p v-if="!shownValues.length" class="px-2 py-4 text-center text-xs text-slate-400">
            没有匹配「{{ filterQuery }}」的取值
          </p>
        </div>
        <div class="flex justify-end gap-1.5 border-t border-slate-100 p-2">
          <button type="button" class="btn btn-ghost btn-sm" @click="filterColumn = null">
            取消
          </button>
          <button type="button" class="btn btn-primary btn-sm" @click="applyFilter">应用</button>
        </div>
      </div>
    </Teleport>

    <input
      ref="fileInput"
      type="file"
      accept=".xlsx,.xls"
      class="hidden"
      @change="onFileChange"
    />
  </section>
</template>
