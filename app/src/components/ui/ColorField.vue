<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** model 为空时展示的颜色（与原生 color input 的黑色默认一致） */
    fallback?: string
  }>(),
  { fallback: '#000000' },
)

const model = defineModel<string>({ default: '' })

const shown = computed(() => model.value || props.fallback)

// HEX 可直接键入/粘贴（品牌色号），失焦或回车时校验并提交
const hexText = ref(shown.value)
watch(shown, (value) => {
  hexText.value = value
})

function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#?/, '')
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw.toLowerCase().split('').map((c) => c + c).join('')}`
  }
  return null
}

function commitHex() {
  const normalized = normalizeHex(hexText.value)
  if (normalized) model.value = normalized
  else hexText.value = shown.value
}
</script>

<template>
  <!-- 色块调起系统取色器；HEX 文本框可直接键入/粘贴色号 -->
  <div
    class="input-field flex h-8 items-center gap-2 !py-0 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/15"
  >
    <label class="relative flex shrink-0 cursor-pointer items-center" aria-label="打开取色器">
      <span
        aria-hidden="true"
        class="size-4.5 shrink-0 rounded-[5px] shadow-sm ring-1 ring-slate-900/10 ring-inset"
        :style="{ background: shown }"
      ></span>
      <input
        v-model="model"
        type="color"
        class="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </label>
    <input
      v-model="hexText"
      type="text"
      class="w-full min-w-0 border-0 bg-transparent p-0 font-mono text-xs font-semibold tracking-wide text-slate-600 uppercase outline-none"
      spellcheck="false"
      aria-label="HEX 色值"
      @blur="commitHex"
      @keydown.enter.prevent="commitHex(); ($event.target as HTMLInputElement).blur()"
    />
  </div>
</template>
