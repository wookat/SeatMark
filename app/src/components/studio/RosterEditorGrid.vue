<script setup lang="ts">
/**
 * 在线编辑名单（表格体）：免 Excel 直接录入 / 修改名单。
 * 由名单数据弹窗的「编辑」模式挂载；挂载时载入当前已导入名单（可整体改），
 * 空数据则按当前模板的可映射字段预置列名，保存后自动映射命中率最高。
 */
import { onMounted, ref } from 'vue'

import { t } from '@/i18n'
import { useToastStore } from '@/stores/toast'
import { useWorkspaceStore } from '@/stores/workspace'
import type { DataRow } from '@/types/template'

const emit = defineEmits<{ saved: []; cancel: [] }>()

const workspace = useWorkspaceStore()
const toast = useToastStore()

/** 大名单请走 Excel/粘贴导入：单元格全是 input，行数过多会卡 */
const MAX_ROWS = 500
const MAX_COLS = 8
const SEED_ROWS = 5

const headers = ref<string[]>([])
const grid = ref<string[][]>([])

/** 挂载即初始化：有名单载入现有数据，空名单按模板字段播种 */
onMounted(() => {
  if (workspace.excel.rows.length) {
    headers.value = [...workspace.excel.headers]
    grid.value = workspace.excel.rows.map((row) =>
      headers.value.map((h) => String(row[h] ?? '')),
    )
  } else {
    const seed = [...new Set(workspace.mappableFields.map((f) => f.label).filter(Boolean))].slice(
      0,
      MAX_COLS,
    )
    headers.value = seed.length ? seed : [t('姓名')]
    grid.value = Array.from({ length: SEED_ROWS }, () => headers.value.map(() => ''))
  }
})

function addRow() {
  if (grid.value.length >= MAX_ROWS) {
    toast.warning(t('最多 {max} 行').replace('{max}', String(MAX_ROWS)), t('大量名单建议用 Excel 导入'))
    return
  }
  grid.value.push(headers.value.map(() => ''))
}

function removeRow(index: number) {
  grid.value.splice(index, 1)
  if (!grid.value.length) addRow()
}

function addColumn() {
  if (headers.value.length >= MAX_COLS) {
    toast.warning(t('最多 {max} 列').replace('{max}', String(MAX_COLS)))
    return
  }
  headers.value.push('')
  for (const row of grid.value) row.push('')
}

function removeColumn(index: number) {
  if (headers.value.length <= 1) {
    toast.warning(t('至少保留一列'))
    return
  }
  headers.value.splice(index, 1)
  for (const row of grid.value) row.splice(index, 1)
}

function moveRow(index: number, delta: -1 | 1) {
  const target = index + delta
  if (target < 0 || target >= grid.value.length) return
  const [row] = grid.value.splice(index, 1)
  grid.value.splice(target, 0, row!)
}

function save() {
  const cols = headers.value.map((h) => h.trim())
  const keepIdx = cols.map((c, i) => (c ? i : -1)).filter((i) => i >= 0)
  if (!keepIdx.length) {
    toast.warning(t('至少需要一列'))
    return
  }
  // 列名去重：重名列自动加 _2 后缀（同 Excel 行为），避免 DataRow 键冲突丢数据
  const seen = new Map<string, number>()
  const finalHeaders = keepIdx.map((i) => {
    const base = cols[i]!
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return n === 1 ? base : `${base}_${n}`
  })
  const rows = grid.value
    .map((row) => keepIdx.map((i) => (row[i] ?? '').trim()))
    .filter((cells) => cells.some((c) => c))
  if (!rows.length) {
    toast.warning(t('至少需要一行数据'))
    return
  }
  const dataRows: DataRow[] = rows.map((cells) =>
    Object.fromEntries(finalHeaders.map((h, j) => [h, cells[j]!])),
  )
  workspace.applyDataset(t('在线编辑名单'), finalHeaders, dataRows, { suggestTemplate: true })
  toast.success(t('名单已更新'), `${dataRows.length} ${t('条')}`)
  emit('saved')
}

defineExpose({ save })
</script>

<template>
  <div>
    <p class="text-xs text-slate-600">
      {{ t('直接录入或修改名单：点单元格编辑，行尾按钮可上下移动 / 删除；保存后立即用于排版，数据不出浏览器。') }}
    </p>

    <div class="mt-3 max-h-[52vh] overflow-auto rounded-lg border border-slate-200">
      <table class="w-full text-left text-xs">
        <thead class="sticky top-0 z-10">
          <tr class="bg-slate-50 text-slate-600">
            <th class="w-8 px-1.5 py-1.5 text-center font-semibold">#</th>
            <th v-for="(_, ci) in headers" :key="ci" class="min-w-28 px-1 py-1 font-semibold">
              <div class="flex items-center gap-0.5">
                <input
                  v-model="headers[ci]"
                  class="input-field min-w-0 flex-1 !border-transparent !bg-transparent px-1 py-0.5 text-xs font-semibold focus:!border-brand-300"
                  :placeholder="t('列名')"
                  :aria-label="t('第 {n} 列列名').replace('{n}', String(ci + 1))"
                />
                <button
                  type="button"
                  class="shrink-0 cursor-pointer rounded p-0.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  :aria-label="t('删除此列')"
                  :title="t('删除此列')"
                  @click="removeColumn(ci)"
                >
                  <svg class="size-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m4 4 8 8m0-8-8 8" /></svg>
                </button>
              </div>
            </th>
            <th class="w-20 px-1.5 py-1.5 text-center font-semibold">{{ t('操作') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(_, ri) in grid" :key="ri" class="border-t border-slate-100">
            <td class="px-1.5 py-0.5 text-center text-slate-400">{{ ri + 1 }}</td>
            <td v-for="(_, ci) in headers" :key="ci" class="px-1 py-0.5">
              <input
                v-model="grid[ri]![ci]"
                class="input-field w-full !border-transparent !bg-transparent px-1 py-0.5 text-xs focus:!border-brand-300"
                :aria-label="`${t('第 {n} 行').replace('{n}', String(ri + 1))} · ${headers[ci] || t('列名')}`"
              />
            </td>
            <td class="px-1.5 py-0.5">
              <div class="flex items-center justify-center gap-0.5">
                <button
                  type="button"
                  class="cursor-pointer rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
                  :disabled="ri === 0"
                  :aria-label="t('上移此行')"
                  @click="moveRow(ri, -1)"
                >
                  <svg class="size-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m4 10 4-4 4 4" /></svg>
                </button>
                <button
                  type="button"
                  class="cursor-pointer rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
                  :disabled="ri === grid.length - 1"
                  :aria-label="t('下移此行')"
                  @click="moveRow(ri, 1)"
                >
                  <svg class="size-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m4 6 4 4 4-4" /></svg>
                </button>
                <button
                  type="button"
                  class="cursor-pointer rounded p-0.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  :aria-label="t('删除此行')"
                  @click="removeRow(ri)"
                >
                  <svg class="size-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m4 4 8 8m0-8-8 8" /></svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-2.5 flex flex-wrap items-center gap-2">
      <button type="button" class="btn btn-ghost btn-sm" :disabled="grid.length >= MAX_ROWS" @click="addRow">
        + {{ t('添加行') }}
      </button>
      <button type="button" class="btn btn-ghost btn-sm" :disabled="headers.length >= MAX_COLS" @click="addColumn">
        + {{ t('添加列') }}
      </button>
      <span class="ml-auto text-[11px] text-slate-500">
        {{ grid.length }} {{ t('行') }} · {{ headers.length }} {{ t('列') }}（{{ t('上限 {r} 行 {c} 列').replace('{r}', String(MAX_ROWS)).replace('{c}', String(MAX_COLS)) }}）
      </span>
    </div>

    <div class="mt-4 flex justify-end gap-2">
      <button type="button" class="btn btn-ghost btn-sm" @click="emit('cancel')">{{ t('取消') }}</button>
      <button type="button" class="btn btn-primary btn-sm" data-testid="roster-save" @click="save">
        {{ t('保存名单') }}
      </button>
    </div>
  </div>
</template>
