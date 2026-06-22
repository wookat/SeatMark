<script setup lang="ts">
import { useWorkspaceStore } from '@/stores/workspace'

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
      class="no-print fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
    >
      <div class="flex flex-col items-center gap-3 rounded-2xl bg-white px-8 py-6 shadow-xl">
        <span
          class="size-8 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-600"
        ></span>
        <p class="text-sm font-semibold text-slate-700">{{ workspace.loading.text || '处理中...' }}</p>
      </div>
    </div>
  </Transition>
</template>
