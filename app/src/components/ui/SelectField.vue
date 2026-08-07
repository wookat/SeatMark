<script lang="ts">
/** SelectField 下拉选项 */
export interface SelectOption {
  value: string
  label: string
  /** 右侧辅助说明（如纸张尺寸） */
  hint?: string
  /** 名称右侧小徽标（如「推荐」「勉强」） */
  badge?: string
  /** 徽标色调：positive 绿 / warning 琥珀 / danger 红 */
  badgeTone?: 'positive' | 'warning' | 'danger'
  disabled?: boolean
}

const BADGE_TONE_CLASS: Record<NonNullable<SelectOption['badgeTone']>, string> = {
  positive: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-600',
}
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    options: SelectOption[]
    /** sm：工具栏紧凑尺寸；md：表单常规尺寸 */
    size?: 'sm' | 'md'
    placeholder?: string
  }>(),
  { modelValue: undefined, size: 'md', placeholder: '请选择' },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

const current = computed(() => props.options.find((o) => o.value === props.modelValue))

function pick(option: SelectOption) {
  if (option.disabled) return
  emit('update:modelValue', option.value)
  open.value = false
}

function onDocClick(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="input-field flex cursor-pointer items-center justify-between gap-1.5 text-left"
      :class="size === 'sm' ? '!py-1 text-xs' : ''"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="truncate">{{ current?.label ?? placeholder }}</span>
      <svg
        class="size-3.5 shrink-0 text-slate-600 transition-transform"
        :class="{ 'rotate-180': open }"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="m4 6 4 4 4-4" />
      </svg>
    </button>

    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="-translate-y-1 opacity-0"
      leave-active-class="transition duration-75 ease-in"
      leave-to-class="-translate-y-1 opacity-0"
    >
      <div
        v-if="open"
        class="absolute right-0 z-30 mt-1.5 w-max max-w-80 min-w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-pop"
        role="listbox"
      >
        <div class="max-h-64 overflow-y-auto p-1.5">
          <button
            v-for="option in options"
            :key="option.value"
            type="button"
            class="flex w-full items-center justify-between gap-2 rounded-lg text-left"
            :class="[
              size === 'sm' ? 'px-2 py-1.5 text-xs' : 'px-2.5 py-2 text-sm',
              option.disabled
                ? 'cursor-not-allowed text-slate-600 opacity-60'
                : 'cursor-pointer hover:bg-slate-50',
              option.value === modelValue && !option.disabled
                ? 'bg-brand-50/70 font-semibold text-brand-700'
                : '',
            ]"
            role="option"
            :aria-selected="option.value === modelValue"
            :disabled="option.disabled"
            @click="pick(option)"
          >
            <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
            <span
              v-if="option.badge"
              class="shrink-0 rounded px-1 py-0.5 text-[10px] leading-none font-bold"
              :class="BADGE_TONE_CLASS[option.badgeTone ?? 'positive']"
            >
              {{ option.badge }}
            </span>
            <span v-if="option.hint" class="shrink-0 text-[10px] text-slate-600">
              {{ option.hint }}
            </span>
            <svg
              v-if="option.value === modelValue && !option.disabled"
              class="size-3.5 shrink-0 text-brand-600"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m3.5 8.5 3 3 6-7" />
            </svg>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>
