<script lang="ts">
/**
 * /en 下内容站索引页（教程 / 模板 / 纸型 / 对比）顶部提示条：
 * 按页面数据是否含英文字段区分文案（模板页卡片已英文化，其余三页仅中文），
 * 并给出中文原页与已完整英文化的功能页链接。
 */
export type ZhOnlyNoticeVariant = 'chinese-only' | 'templates'

export const ZH_ONLY_NOTICE_TEXT: Record<ZhOnlyNoticeVariant, string> = {
  'chinese-only':
    'This section is currently available in Chinese only. The Studio, Seating Chart, Banquet planner and Pricing pages are fully in English.',
  templates:
    'Template names, descriptions and the label maker are in English; tutorial articles are in Chinese only.',
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { stripLocalePrefix, useI18n } from '@/i18n'

withDefaults(defineProps<{ variant?: ZhOnlyNoticeVariant }>(), { variant: 'chinese-only' })

const { locale } = useI18n()
const route = useRoute()
const zhPath = computed(() => stripLocalePrefix(route.path))
</script>

<template>
  <div
    v-if="locale === 'en'"
    data-testid="zh-only-notice"
    lang="en"
    role="note"
    class="mx-auto mt-5 flex max-w-2xl flex-col gap-1.5 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-left text-xs leading-5 text-amber-900 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
  >
    <p :data-variant="variant">{{ ZH_ONLY_NOTICE_TEXT[variant] }}</p>
    <p class="flex shrink-0 flex-wrap gap-3 font-semibold">
      <RouterLink
        :to="zhPath"
        class="underline decoration-amber-400 underline-offset-2 hover:text-amber-950"
        data-testid="zh-only-notice-zh-link"
      >
        Browse in Chinese
      </RouterLink>
      <RouterLink to="/en/studio" class="underline decoration-amber-400 underline-offset-2 hover:text-amber-950">
        Open Studio
      </RouterLink>
      <RouterLink to="/en" class="underline decoration-amber-400 underline-offset-2 hover:text-amber-950">
        English home
      </RouterLink>
    </p>
  </div>
</template>
