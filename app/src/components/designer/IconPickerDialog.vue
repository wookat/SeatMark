<script setup lang="ts">
import { ref } from 'vue'

import ModalDialog from '@/components/ui/ModalDialog.vue'
import { iconDataUrl, VECTOR_ICONS, type VectorIcon } from '@/data/icons'

defineProps<{ open: boolean }>()

const emit = defineEmits<{
  close: []
  pick: [payload: { name: string; dataUrl: string }]
}>()

const PALETTE = [
  '#0f172a',
  '#475569',
  '#94a3b8',
  '#4f46e5',
  '#0ea5e9',
  '#0d9488',
  '#d97706',
  '#dc2626',
]

const color = ref(PALETTE[0]!)

function pick(icon: VectorIcon) {
  emit('pick', { name: icon.name, dataUrl: iconDataUrl(icon, color.value) })
}
</script>

<template>
  <ModalDialog :open="open" title="插入矢量图标" size="lg" @close="emit('close')">
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs font-semibold text-slate-500">图标颜色</span>
      <div class="flex items-center gap-1.5">
        <button
          v-for="c in PALETTE"
          :key="c"
          type="button"
          class="size-6 cursor-pointer rounded-full transition-shadow ring-offset-1"
          :class="color === c ? 'ring-2 ring-brand-500' : 'hover:ring-2 hover:ring-slate-300'"
          :style="{ background: c }"
          :aria-label="`颜色 ${c}`"
          @click="color = c"
        ></button>
        <label
          class="relative ml-1 flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-slate-400 transition-colors hover:text-slate-600"
        >
          <span
            aria-hidden="true"
            class="size-6 rounded-full shadow-sm ring-offset-1"
            :class="!PALETTE.includes(color) ? 'ring-2 ring-brand-500' : 'ring-1 ring-slate-900/10'"
            :style="{
              background: PALETTE.includes(color)
                ? 'conic-gradient(#f87171, #facc15, #4ade80, #38bdf8, #a78bfa, #f87171)'
                : color,
            }"
          ></span>
          自定义
          <input
            v-model="color"
            type="color"
            class="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>

    <div class="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
      <button
        v-for="icon in VECTOR_ICONS"
        :key="icon.id"
        type="button"
        class="group flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
        :title="`插入「${icon.name}」`"
        @click="pick(icon)"
      >
        <!-- eslint-disable-next-line vue/no-v-html -->
        <svg
          class="size-7 transition-transform duration-150 group-hover:scale-110"
          viewBox="0 0 24 24"
          fill="none"
          :stroke="color"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          v-html="icon.body"
        ></svg>
        <span class="text-[10px] font-semibold text-slate-500">{{ icon.name }}</span>
      </button>
    </div>

    <p class="mt-3 text-[11px] leading-4 text-slate-400">
      图标以矢量（SVG）形式嵌入模板，打印导出不失真；插入后可在画布上拖拽调整大小与位置，建议保持方形比例。
      需要自有图片时，用「添加字段 → 固定图片 / Logo」上传即可。
    </p>
  </ModalDialog>
</template>
