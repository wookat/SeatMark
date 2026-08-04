<script setup lang="ts">
/**
 * 品牌图形标「座位格」（brand/ 方案 A）：
 * 2×2 圆角格，右下一格实心带白点，表达「在座位表中定位到你的座位」。
 * 描边与实心格随 currentColor；定位点颜色可配（反白版传品牌色/墨色）。
 */
withDefaults(defineProps<{ dot?: string }>(), { dot: '#ffffff' })
</script>

<template>
  <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <rect x="6" y="6" width="23" height="23" rx="6" stroke="currentColor" stroke-width="5" />
    <rect x="35" y="6" width="23" height="23" rx="6" stroke="currentColor" stroke-width="5" />
    <rect x="6" y="35" width="23" height="23" rx="6" stroke="currentColor" stroke-width="5" />
    <rect x="35" y="35" width="23" height="23" rx="6" fill="currentColor" />
    <circle cx="46.5" cy="46.5" r="4.5" :fill="dot" />
  </svg>
</template>
