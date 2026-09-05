<script setup lang="ts">
/**
 * /en 下仅有中文正文的内容站索引页（教程 / 模板 / 纸型 / 对比）顶部提示条：
 * 明确告知本节暂仅中文，并指向已完整英文化的功能页。
 */
import { useI18n } from '@/i18n'

const { locale } = useI18n()
</script>

<template>
  <div
    v-if="locale === 'en'"
    data-testid="zh-only-notice"
    lang="en"
    role="note"
    class="mx-auto mt-5 flex max-w-2xl flex-col gap-1.5 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-left text-xs leading-5 text-amber-900 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
  >
    <p>
      This section is currently available in Chinese only. The Studio, Seating Chart, Banquet
      planner and Pricing pages are fully in English.
    </p>
    <p class="flex shrink-0 gap-3 font-semibold">
      <RouterLink to="/en/studio" class="underline decoration-amber-400 underline-offset-2 hover:text-amber-950">
        Open Studio
      </RouterLink>
      <RouterLink to="/en" class="underline decoration-amber-400 underline-offset-2 hover:text-amber-950">
        English home
      </RouterLink>
    </p>
  </div>
</template>
