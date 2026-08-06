<script setup lang="ts">
import { computed, ref } from 'vue'

import { useWorkspaceStore } from '@/stores/workspace'
import { dismissStudioGuide, isStudioGuideDismissed } from '@/utils/firstVisit'

const workspace = useWorkspaceStore()

const visible = ref(!isStudioGuideDismissed())

const hasRows = computed(() => workspace.excel.rows.length > 0)

const steps = computed(() => [
  { title: '选模板', desc: '默认已选好，可随时更换', done: true },
  {
    title: '导入名单',
    desc: hasRows.value ? '名单已就绪' : '上传 Excel 或先用演示数据',
    done: hasRows.value,
  },
  { title: '导出打印', desc: '预览区右上角导出 PDF / 打印', done: false },
])

function close() {
  dismissStudioGuide()
  visible.value = false
}

function tryDemo() {
  if (!hasRows.value) workspace.useDemoData()
}
</script>

<template>
  <section
    v-if="visible"
    class="rounded-lg border border-brand-200 bg-brand-50/60 p-4"
    aria-label="首次使用引导"
  >
    <div class="flex items-start justify-between gap-2">
      <p class="text-sm font-bold text-slate-900">三步拿到成品</p>
      <button
        type="button"
        class="cursor-pointer rounded p-1 text-slate-400 transition-colors hover:bg-white hover:text-slate-600"
        aria-label="关闭引导"
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
          <p class="text-[11px] leading-4 text-slate-500">{{ step.desc }}</p>
        </div>
      </li>
    </ol>

    <button
      v-if="!hasRows"
      type="button"
      class="btn btn-primary btn-sm mt-3 w-full"
      @click="tryDemo"
    >
      用演示数据先试试
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
