<script setup lang="ts">
import { computed, ref } from 'vue'

import ZhOnlyNotice from '@/components/ui/ZhOnlyNotice.vue'
import { LABEL_PAPER_SHEET, labelPapers } from '@/data/labelPapers'
import { useI18n } from '@/i18n'
import { labelPaperGeometry } from '@/utils/labelPaper'

const { t, localePath } = useI18n()

const activeCorner = ref<'全部' | '直角' | '圆角'>('全部')

const filtered = computed(() =>
  labelPapers.filter(
    (p) =>
      activeCorner.value === '全部' ||
      (activeCorner.value === '圆角' ? p.corner === 'rounded' : p.corner === 'square'),
  ),
)

/** SVG 迷你版式示意（按 mm 比例，viewBox 即 A4 尺寸） */
function cells(spec: (typeof labelPapers)[number]) {
  const geo = labelPaperGeometry(spec)
  const out: { x: number; y: number }[] = []
  for (let r = 0; r < spec.rows; r++) {
    for (let c = 0; c < spec.cols; c++) {
      out.push({
        x: geo.marginX + c * (spec.labelWidth + spec.gapX),
        y: geo.marginY + r * (spec.labelHeight + spec.gapY),
      })
    }
  }
  return out
}
</script>

<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
    <div class="text-center">
      <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Label Papers</p>
      <h1 class="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        {{ t('A4 不干胶纸型库') }}
      </h1>
      <p class="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        {{ t('收录国产电商常见的 A4 不干胶分切规格：2×4、3×7、3×10、圆角模切等 {n} 种。在标签工坊选好纸型，行列数、边距与间距自动锁定，打印即对版，免手动调参。').replace('{n}', String(labelPapers.length)) }}
      </p>
      <ZhOnlyNotice />
    </div>

    <div class="mt-8 flex flex-wrap items-center justify-center gap-2">
      <span class="shrink-0 text-xs font-bold text-slate-600">{{ t('切角') }}</span>
      <button
        v-for="c in ['全部', '直角', '圆角'] as const"
        :key="c"
        type="button"
        class="rounded-full border px-3 py-1 text-xs font-bold transition-colors"
        :class="
          activeCorner === c
            ? 'border-brand-600 bg-brand-600 text-white'
            : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-600'
        "
        @click="activeCorner = c"
      >
        {{ t(c) }}
      </button>
    </div>

    <div class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <RouterLink
        v-for="p in filtered"
        :key="p.slug"
        :to="`/papers/${p.slug}`"
        class="group flex flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-card transition-shadow hover:shadow-lg"
      >
        <div class="flex items-start gap-4">
          <svg
            class="w-16 shrink-0 rounded-sm border border-slate-200 bg-slate-50"
            :viewBox="`0 0 ${LABEL_PAPER_SHEET.width} ${LABEL_PAPER_SHEET.height}`"
            role="img"
            :aria-label="`${p.name} ${t('版式示意')}`"
          >
            <rect
              v-for="(cell, i) in cells(p)"
              :key="i"
              :x="cell.x + 1"
              :y="cell.y + 1"
              :width="Math.max(p.labelWidth - 2, 2)"
              :height="Math.max(p.labelHeight - 2, 2)"
              :rx="p.corner === 'rounded' ? (p.cornerRadius ?? 2) * 2 : 0"
              fill="#c7d2fe"
              stroke="#6366f1"
              stroke-width="0.8"
            />
          </svg>
          <div class="min-w-0">
            <h2 class="text-sm font-bold text-slate-900 group-hover:text-brand-600">
              {{ p.name }}
            </h2>
            <p class="mt-1 text-xs leading-5 text-slate-600">
              {{ p.labelWidth }} × {{ p.labelHeight }} mm · {{ p.cols }} {{ t('列') }} × {{ p.rows }} {{ t('行') }} ·
              {{ t('每页 {n} 枚').replace('{n}', String(p.cols * p.rows)) }} ·
              {{ t(p.corner === 'rounded' ? '圆角' : '直角') }}
            </p>
          </div>
        </div>
        <p class="mt-3 line-clamp-2 text-xs leading-5 text-slate-600">{{ p.description }}</p>
        <div class="mt-3 flex flex-wrap gap-1.5">
          <span
            v-for="alias in p.aliases.slice(0, 2)"
            :key="alias"
            class="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600"
          >
            {{ alias }}
          </span>
        </div>
      </RouterLink>
    </div>

    <div class="mt-12 rounded-lg border border-brand-100 bg-brand-50/60 p-6 text-center">
      <h2 class="text-base font-bold text-slate-900">{{ t('买回来的标签纸不在列表里？') }}</h2>
      <p class="mx-auto mt-2 max-w-xl text-xs leading-5 text-slate-600">
        {{ t('标签工坊支持完全自定义：手动输入标签尺寸、行列数与边距，同样精确到毫米。也欢迎通过页面右下角反馈告诉我们缺少的型号，我们会尽快收录。') }}
      </p>
      <RouterLink :to="localePath('/studio')" class="btn btn-primary btn-md mt-4">
        {{ t('打开标签工坊') }}
      </RouterLink>
    </div>
  </div>
</template>
