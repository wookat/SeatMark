<script setup lang="ts">
import { computed, ref } from 'vue'

import CheckboxField from '@/components/ui/CheckboxField.vue'
import SelectField, { type SelectOption } from '@/components/ui/SelectField.vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { isCompositeMapping, templateColumnsValid } from '@/utils/fieldTemplate'

const workspace = useWorkspaceStore()
const photoInput = ref<HTMLInputElement | null>(null)

/** 下拉中「自定义组合」选项的哨兵值（不会与真实表头冲突） */
const COMPOSITE_OPTION = '__composite__'

const TONE_CLASSES: Record<string, string> = {
  muted: 'border-slate-200 bg-slate-50 text-slate-600',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
}

const headerOptions = computed<SelectOption[]>(() =>
  workspace.excel.headers.map((h) => ({ value: h, label: h })),
)

const mappingOptions = computed<SelectOption[]>(() => [
  { value: '', label: '未映射' },
  ...headerOptions.value,
  { value: COMPOSITE_OPTION, label: '自定义组合…' },
])

function isComposite(value: string | undefined): boolean {
  return !!value && isCompositeMapping(value, workspace.excel.headers)
}

/** 下拉显示值：组合映射时选中「自定义组合」项 */
function selectValueFor(fieldId: string): string {
  const value = workspace.mapping[fieldId] ?? ''
  return isComposite(value) ? COMPOSITE_OPTION : value
}

// ---------- 组合字段编辑器 ----------
const compositeEditing = ref<string | null>(null)
const compositeDraft = ref('')

function onSelectMapping(fieldId: string, value: string) {
  if (value === COMPOSITE_OPTION) {
    openCompositeEditor(fieldId)
    return
  }
  compositeEditing.value = null
  workspace.setMappingValue(fieldId, value)
}

function openCompositeEditor(fieldId: string) {
  const current = workspace.mapping[fieldId] ?? ''
  compositeDraft.value = isComposite(current) ? current : current ? `{${current}}` : ''
  compositeEditing.value = fieldId
}

function insertColumn(header: string) {
  compositeDraft.value += `{${header}}`
}

const compositeDraftValid = computed(
  () =>
    isCompositeMapping(compositeDraft.value, workspace.excel.headers) &&
    templateColumnsValid(compositeDraft.value, workspace.excel.headers),
)

function saveComposite() {
  if (!compositeEditing.value || !compositeDraftValid.value) return
  workspace.setMappingValue(compositeEditing.value, compositeDraft.value)
  compositeEditing.value = null
}

function cancelComposite() {
  compositeEditing.value = null
}

const photoColumnOptions = computed<SelectOption[]>(() => [
  { value: '', label: '请选择 Excel 中的一列' },
  ...headerOptions.value,
])

function onPhotoFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  input.value = ''
  if (files.length) void workspace.importPhotos(files)
}
</script>

<template>
  <section class="panel-card">
    <div class="panel-head">
      <h2 class="section-title"><span class="step-chip">3</span>字段映射</h2>
    </div>

    <div
      class="rounded-lg border p-3 text-xs leading-5"
      :class="TONE_CLASSES[workspace.mappingSummary.tone]"
    >
      <p class="font-bold">{{ workspace.mappingSummary.title }}</p>
      <p class="mt-0.5 opacity-85">{{ workspace.mappingSummary.text }}</p>
    </div>

    <div class="mt-3 grid gap-2">
      <div
        v-for="field in workspace.mappableFields"
        :key="field.id"
        class="grid grid-cols-[88px_16px_1fr] items-center gap-2"
      >
        <span
          class="truncate rounded-lg px-2 py-1.5 text-xs font-bold"
          :class="
            workspace.mapping[field.id]
              ? 'bg-brand-50 text-brand-700'
              : 'bg-slate-100 text-slate-600'
          "
        >
          {{ field.label || field.id }}
        </span>
        <span class="text-center text-slate-300">→</span>
        <SelectField
          :model-value="selectValueFor(field.id)"
          :options="mappingOptions"
          @update:model-value="onSelectMapping(field.id, $event)"
        />
        <div
          v-if="isComposite(workspace.mapping[field.id]) && compositeEditing !== field.id"
          class="col-span-3 -mt-0.5 flex items-center justify-between gap-2 rounded-lg bg-brand-50/60 px-2 py-1.5"
        >
          <code class="truncate text-[11px] text-brand-700">{{ workspace.mapping[field.id] }}</code>
          <button
            type="button"
            class="shrink-0 text-[11px] font-bold text-brand-600 hover:text-brand-700"
            @click="openCompositeEditor(field.id)"
          >
            编辑
          </button>
        </div>
        <div
          v-if="compositeEditing === field.id"
          class="col-span-3 rounded-lg border border-brand-200 bg-brand-50/50 p-2.5"
        >
          <label class="field-label">组合模板：用 {列名} 引用列，其余文字原样输出</label>
          <input
            v-model="compositeDraft"
            type="text"
            class="input-field w-full"
            placeholder="如：第{考场}考场-{座位号}号"
          />
          <div class="mt-1.5 flex flex-wrap gap-1">
            <button
              v-for="header in workspace.excel.headers"
              :key="header"
              type="button"
              class="rounded-full border border-brand-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-50"
              @click="insertColumn(header)"
            >
              + {{ header }}
            </button>
          </div>
          <p v-if="compositeDraft && !compositeDraftValid" class="mt-1.5 text-[11px] text-amber-600">
            模板需至少引用一个 {列名}，且引用的列必须存在于当前表头
          </p>
          <div class="mt-2 flex justify-end gap-2">
            <button type="button" class="btn btn-secondary btn-sm" @click="cancelComposite">
              取消
            </button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="!compositeDraftValid"
              @click="saveComposite"
            >
              应用组合
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="workspace.hasDataQualityRisk"
      class="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800"
    >
      <p class="font-bold">数据质量提醒</p>
      <ul class="mt-1 list-inside list-disc space-y-0.5">
        <li v-if="workspace.dataQuality.missingRows">
          {{ workspace.dataQuality.missingRows }} 行存在已映射字段为空
        </li>
        <li v-if="workspace.dataQuality.duplicateExamIds">
          {{ workspace.dataQuality.duplicateExamIds }} 个准考证号重复
        </li>
        <li v-if="workspace.dataQuality.duplicateSeatKeys">
          {{ workspace.dataQuality.duplicateSeatKeys }} 个「考场 + 座位号」组合重复
        </li>
      </ul>
      <CheckboxField
        v-model="workspace.highlightMissing"
        tone="amber"
        class="mt-2 font-semibold"
        label="在预览中高亮缺失内容"
      />
    </div>

    <div v-if="workspace.hasMatchedImageField" class="mt-4 border-t border-slate-100 pt-4">
      <h3 class="text-xs font-bold text-slate-700">照片匹配</h3>
      <p class="mt-1 text-[11px] leading-4 text-slate-600">
        照片文件名与所选列的值一致或包含该值即可匹配。例如「张伟2023010101.jpg」，
        按姓名列或学号列都能匹配；完全一致的文件优先。
      </p>
      <div class="mt-2 grid gap-2">
        <div>
          <label class="field-label">匹配列</label>
          <SelectField
            :model-value="workspace.photoColumn"
            :options="photoColumnOptions"
            @update:model-value="workspace.setPhotoColumn($event)"
          />
        </div>
        <button
          type="button"
          class="btn btn-secondary btn-md"
          :disabled="!workspace.photoColumn"
          @click="photoInput?.click()"
        >
          上传照片文件（可多选）
        </button>
        <input
          ref="photoInput"
          type="file"
          accept="image/*"
          multiple
          class="hidden"
          @change="onPhotoFiles"
        />
        <p v-if="workspace.photoStats.totalPhotos > 0" class="text-xs text-slate-600">
          已导入 {{ workspace.photoStats.totalPhotos }} 张照片，匹配
          {{ workspace.photoStats.matchedRows }}/{{ workspace.photoStats.totalRows }} 行（覆盖率
          {{ workspace.photoStats.coverage }}%）
        </p>
        <details v-if="workspace.photoErrors.length" class="text-xs text-slate-600">
          <summary class="cursor-pointer font-semibold text-amber-600">
            {{ workspace.photoErrors.length }} 个文件未匹配，查看详情
          </summary>
          <ul class="mt-1 max-h-32 list-inside list-disc space-y-0.5 overflow-y-auto">
            <li v-for="(err, i) in workspace.photoErrors" :key="i">{{ err }}</li>
          </ul>
        </details>
      </div>
    </div>
  </section>
</template>
