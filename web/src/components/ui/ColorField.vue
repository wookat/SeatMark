<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** model 为空时展示的颜色（与原生 color input 的黑色默认一致） */
    fallback?: string
  }>(),
  { fallback: '#000000' },
)

const model = defineModel<string>({ default: '' })

const shown = computed(() => model.value || props.fallback)
</script>

<template>
  <!-- 自绘色块 + 色值，原生 color input 透明铺满仅负责调起系统取色器 -->
  <label
    class="input-field relative flex h-8 cursor-pointer items-center gap-2 !py-0 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/15"
  >
    <span
      aria-hidden="true"
      class="size-4.5 shrink-0 rounded-[5px] shadow-sm ring-1 ring-slate-900/10 ring-inset"
      :style="{ background: shown }"
    ></span>
    <span class="font-mono text-xs font-semibold tracking-wide text-slate-600 uppercase">
      {{ shown }}
    </span>
    <input
      v-model="model"
      type="color"
      class="absolute inset-0 size-full cursor-pointer opacity-0"
    />
  </label>
</template>
