<script setup lang="ts">
withDefaults(
  defineProps<{
    open: boolean
    title: string
    /** 对话框宽度：md 表单确认 / lg 内容浏览 / xl 数据表格 */
    size?: 'md' | 'lg' | 'xl'
  }>(),
  { size: 'md' },
)

const emit = defineEmits<{ close: [] }>()

const SIZE_CLASSES: Record<string, string> = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-5xl',
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="no-print fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 p-4"
        @click.self="emit('close')"
      >
        <div
          class="flex max-h-[88vh] w-full flex-col rounded-2xl bg-white p-6 shadow-2xl"
          :class="SIZE_CLASSES[size]"
        >
          <div class="flex items-start justify-between gap-3">
            <h3 class="text-base font-bold text-slate-900">{{ title }}</h3>
            <button
              type="button"
              class="-mt-1 -mr-1 flex size-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="关闭"
              @click="emit('close')"
            >
              <svg
                class="size-4"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
              >
                <path d="m4 4 8 8m0-8-8 8" />
              </svg>
            </button>
          </div>
          <div class="mt-3 min-h-0 flex-1 overflow-y-auto text-sm text-slate-600">
            <slot />
          </div>
          <div class="mt-5 flex justify-end gap-2 empty:hidden">
            <slot name="actions" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
