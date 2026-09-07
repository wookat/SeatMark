<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 勾选框右侧文案；复杂内容可改用默认插槽 */
    label?: string
    /** brand：常规；amber：警示类选项（如「高亮缺失」） */
    tone?: 'brand' | 'amber'
  }>(),
  { label: '', tone: 'brand' },
)

const model = defineModel<boolean>({ default: false })
</script>

<template>
  <!-- 原生 input 仅保留给键盘 / 读屏（sr-only），视觉用自绘方块 -->
  <label class="group flex cursor-pointer items-center gap-1.5 select-none max-sm:min-h-9">
    <input v-model="model" type="checkbox" class="peer sr-only" />
    <span
      aria-hidden="true"
      class="flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2"
      :class="[
        tone === 'amber'
          ? 'peer-focus-visible:outline-amber-500'
          : 'peer-focus-visible:outline-brand-500',
        model
          ? tone === 'amber'
            ? 'border-amber-500 bg-amber-500'
            : 'border-brand-600 bg-brand-600'
          : tone === 'amber'
            ? 'border-slate-300 bg-white shadow-sm group-hover:border-amber-400'
            : 'border-slate-300 bg-white shadow-sm group-hover:border-brand-400',
      ]"
    >
      <svg
        class="size-3 text-white transition-transform duration-150 ease-out"
        :class="model ? 'scale-100' : 'scale-0'"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="m3.5 8.5 3 3 6-7" />
      </svg>
    </span>
    <slot>{{ label }}</slot>
  </label>
</template>
