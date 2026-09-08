<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useI18n } from '@/i18n'

import { useWorkspaceStore } from '@/stores/workspace'
import { dismissStudioGuide, studioExportedOnce, studioGuideDismissed } from '@/utils/firstVisit'

/**
 * compact：侧栏同屏已有另一条完整提示（如纸型错配条）时，引导折叠为单行可展开态；
 * 内容不删不改，compact 恢复 false 后自动回到完整态。
 */
const props = withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const { t } = useI18n()
const workspace = useWorkspaceStore()

// 响应式联动：导出/打印成功后（dismissStudioGuide）引导卡片当场消失
const visible = computed(() => !studioGuideDismissed.value)

/** 紧凑态下用户手动展开；重新进入紧凑态时回到折叠 */
const manuallyExpanded = ref(false)
watch(
  () => props.compact,
  (compact) => {
    if (compact) manuallyExpanded.value = false
  },
)
const collapsed = computed(() => props.compact && !manuallyExpanded.value)

const hasRows = computed(() => workspace.excel.rows.length > 0)
const unmappedCount = computed(() => workspace.unmappedFields.length)
/** 无可映射文本字段的模板（如纯固定文字）视为已核对完成 */
const mappingDone = computed(
  () => hasRows.value && (workspace.mappableFields.length === 0 || unmappedCount.value === 0),
)

/** 四步与左侧面板 step-chip 编号 1 选择模板 / 2 导入数据 / 3 字段映射 / 4 页面与版式 一一对应 */
const steps = computed(() => [
  { title: t('选模板'), desc: t('默认已选好，可随时更换'), done: true },
  {
    title: t('导入名单'),
    desc: hasRows.value ? t('名单已就绪') : t('上传 Excel 或先用演示数据'),
    done: hasRows.value,
  },
  {
    title: t('核对字段映射与版式'),
    desc:
      hasRows.value && unmappedCount.value > 0
        ? t('还有 {n} 个字段未对上列').replace('{n}', String(unmappedCount.value))
        : t('字段已按表头自动匹配，若表头不同请手动选择'),
    done: mappingDone.value,
  },
  { title: t('导出打印'), desc: t('预览面板工具栏导出 PDF / 打印'), done: studioExportedOnce.value },
])

function close() {
  dismissStudioGuide()
}

function tryDemo() {
  if (!hasRows.value) workspace.useDemoData()
}
</script>

<template>
  <section
    v-if="visible && collapsed"
    class="rounded-lg border border-brand-200 bg-brand-50/60 px-4 py-2"
    :aria-label="t('首次使用引导')"
    data-testid="first-visit-guide-compact"
  >
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 text-left text-xs font-bold text-slate-800 transition-colors hover:text-brand-700"
        :aria-expanded="false"
        @click="manuallyExpanded = true"
      >
        <span class="truncate">{{ t('新手四步引导') }}</span>
        <span class="text-slate-500" aria-hidden="true">▸</span>
      </button>
      <button
        v-if="!hasRows"
        type="button"
        class="btn btn-primary btn-sm shrink-0 whitespace-nowrap"
        data-testid="first-visit-guide-demo"
        @click="tryDemo"
      >
        {{ t('用演示数据先试试') }}
      </button>
    </div>
  </section>
  <section
    v-else-if="visible"
    class="rounded-lg border border-brand-200 bg-brand-50/60 p-4"
    :aria-label="t('首次使用引导')"
    data-testid="first-visit-guide"
  >
    <div class="flex items-start justify-between gap-2">
      <p class="text-sm font-bold text-slate-900">{{ t('选模板、导入名单、核对预览、导出打印，4 步') }}</p>
      <button
        type="button"
        class="cursor-pointer rounded p-1 text-slate-600 transition-colors hover:bg-white hover:text-slate-600"
        :aria-label="t('关闭引导')"
        @click="close"
      >
        <svg
          class="size-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>

    <ol class="mt-3 grid gap-2">
      <li v-for="(step, i) in steps" :key="step.title" class="flex items-start gap-2.5">
        <span
          class="flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
          :class="step.done ? 'bg-emerald-500 text-white' : 'bg-white text-brand-700 ring-1 ring-brand-200'"
        >
          <svg
            v-if="step.done"
            class="size-3"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m3.5 8.5 3 3 6-7" />
          </svg>
          <template v-else>{{ i + 1 }}</template>
        </span>
        <div class="min-w-0">
          <p class="text-xs font-bold text-slate-800">{{ step.title }}</p>
          <p class="text-[11px] leading-4 text-slate-600">{{ step.desc }}</p>
        </div>
      </li>
    </ol>

    <button
      v-if="!hasRows"
      type="button"
      class="btn btn-primary btn-sm mt-3 w-full"
      @click="tryDemo"
    >
      {{ t('用演示数据先试试') }}
      <svg
        class="size-3.5"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 8h10m-4-4 4 4-4 4" />
      </svg>
    </button>
  </section>
</template>
