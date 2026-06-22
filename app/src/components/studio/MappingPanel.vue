<script setup lang="ts">
import { computed, ref } from 'vue'

import CheckboxField from '@/components/ui/CheckboxField.vue'
import SelectField, { type SelectOption } from '@/components/ui/SelectField.vue'
import { useWorkspaceStore } from '@/stores/workspace'

const workspace = useWorkspaceStore()
const photoInput = ref<HTMLInputElement | null>(null)

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
])

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
    <h2 class="section-title mb-3"><span class="step-chip">3</span>字段映射</h2>

    <div
      class="rounded-xl border p-3 text-xs leading-5"
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
              : 'bg-slate-100 text-slate-500'
          "
        >
          {{ field.label || field.id }}
        </span>
        <span class="text-center text-slate-300">→</span>
        <SelectField
          :model-value="workspace.mapping[field.id] ?? ''"
          :options="mappingOptions"
          @update:model-value="workspace.setMappingValue(field.id, $event)"
        />
      </div>
    </div>

    <div
      v-if="workspace.hasDataQualityRisk"
      class="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800"
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
      <p class="mt-1 text-[11px] leading-4 text-slate-400">
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
        <p v-if="workspace.photoStats.totalPhotos > 0" class="text-xs text-slate-500">
          已导入 {{ workspace.photoStats.totalPhotos }} 张照片，匹配
          {{ workspace.photoStats.matchedRows }}/{{ workspace.photoStats.totalRows }} 行（覆盖率
          {{ workspace.photoStats.coverage }}%）
        </p>
        <details v-if="workspace.photoErrors.length" class="text-xs text-slate-500">
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
