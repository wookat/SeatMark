<script setup lang="ts">
import { t } from '@/i18n'

// 透传 aria-label 等无障碍属性到真正的 input，而不是外层容器
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    step?: number
    min?: number
    max?: number
  }>(),
  { step: 1, min: undefined, max: undefined },
)

const model = defineModel<number>({ default: 0 })

function clampValue(value: number): number {
  let out = value
  if (props.min != null) out = Math.max(props.min, out)
  if (props.max != null) out = Math.min(props.max, out)
  return out
}

/** 步进后按千分位取整，规避浮点累计误差（0.1 + 0.2 类问题） */
function nudge(dir: 1 | -1) {
  model.value = clampValue(Math.round(((model.value ?? 0) + dir * props.step) * 1000) / 1000)
}

function onChange(event: Event) {
  const input = event.target as HTMLInputElement
  const raw = Number(input.value)
  if (input.value.trim() === '' || Number.isNaN(raw)) {
    input.value = String(model.value ?? 0)
    return
  }
  const next = clampValue(raw)
  model.value = next
  // 模型值未变（如重复越界输入）时手动回写显示
  input.value = String(next)
}
</script>

<template>
  <!-- 隐藏原生 spinner 后的替代：hover / 聚焦时浮现的紧凑步进按钮 -->
  <div class="group/nf relative">
    <input
      v-bind="$attrs"
      type="number"
      class="input-field pr-6"
      :step="step"
      :min="min"
      :max="max"
      :value="model"
      @change="onChange"
    />
    <div
      class="absolute inset-y-[3px] right-[3px] flex w-5 flex-col overflow-hidden rounded-md border border-slate-200 bg-white opacity-0 shadow-sm transition-opacity duration-100 group-focus-within/nf:opacity-100 group-hover/nf:opacity-100"
    >
      <button
        type="button"
        tabindex="-1"
        :aria-label="t('增大')"
        class="flex flex-1 cursor-pointer items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-brand-600 active:bg-slate-200"
        @click="nudge(1)"
      >
        <svg
          class="size-2.5"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m4 10 4-4 4 4" />
        </svg>
      </button>
      <button
        type="button"
        tabindex="-1"
        :aria-label="t('减小')"
        class="flex flex-1 cursor-pointer items-center justify-center border-t border-slate-100 text-slate-600 hover:bg-slate-100 hover:text-brand-600 active:bg-slate-200"
        @click="nudge(-1)"
      >
        <svg
          class="size-2.5"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
    </div>
  </div>
</template>
