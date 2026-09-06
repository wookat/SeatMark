<script setup lang="ts">
import { useI18n } from '@/i18n'

/** 内容数据是否带英文字段；为 true 时不渲染提示 */
defineProps<{ hasEnglish?: boolean }>()

const { locale } = useI18n()
</script>

<template>
  <p
    v-if="locale === 'en' && !hasEnglish"
    class="mb-6 border-b border-slate-200 pb-3 text-xs leading-5 text-slate-500"
    data-testid="chinese-only-notice"
  >
    This page is currently available in Chinese only. The label maker itself
    (<RouterLink to="/en/studio" class="font-semibold text-brand-600 hover:underline">/en/studio</RouterLink>)
    is fully in English.
  </p>
</template>
