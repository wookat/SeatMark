<script setup lang="ts">
import { useWorkspaceStore } from '@/stores/workspace'
import BrandMark from '@/components/ui/BrandMark.vue'

const workspace = useWorkspaceStore()
</script>

<template>
  <Transition
    enter-active-class="transition duration-150"
    enter-from-class="opacity-0"
    leave-active-class="transition duration-150"
    leave-to-class="opacity-0"
  >
    <div
      v-if="workspace.loading.active"
      class="no-print fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40"
    >
      <div class="flex flex-col items-center gap-3 rounded-lg bg-white px-8 py-6 shadow-pop">
        <div class="relative flex size-12 items-center justify-center">
          <span
            class="absolute inset-0 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-600"
          ></span>
          <BrandMark class="size-5 text-brand-600" />
        </div>
        <p class="text-sm font-semibold text-slate-700">{{ workspace.loading.text || '处理中...' }}</p>
        <button
          v-if="workspace.loading.cancel"
          type="button"
          class="btn btn-secondary btn-sm"
          @click="workspace.loading.cancel()"
        >
          取消
        </button>
      </div>
    </div>
  </Transition>
</template>
