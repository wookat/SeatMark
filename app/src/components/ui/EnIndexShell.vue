<script setup lang="ts">
/**
 * /en 下仅有中文正文的内容站索引页（教程 / 对比 / 纸型）列表区替代块：
 * 一段英文主题说明 + 「Browse in Chinese」主按钮 + ≤3 条英文精选入口（英文标题 + 一句英文摘要 + 「Read in Chinese →」CTA，
 * 指向中文详情页），区块标题为纯英文，语言标记只以条目级「Chinese」小徽标出现。仅在 locale === 'en' 时由调用方渲染。
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { stripLocalePrefix } from '@/i18n'

export interface EnIndexFeatured {
  /** 英文标题 */
  title: string
  /** 一句英文摘要 */
  summary: string
  /** 中文详情页路径（/en 下详情页会重定向回中文，故直接给中文路径） */
  to: string
}

const props = defineProps<{
  /** 英文主题说明（本节讲什么、为何目前仅中文） */
  intro: string
  /** 精选区块的英文标题（如 Featured guides / Paper sizes / Comparisons） */
  featuredHeading: string
  /** 精选入口，最多渲染 3 条 */
  featured?: EnIndexFeatured[]
}>()

const route = useRoute()
const zhPath = computed(() => stripLocalePrefix(route.path))
const picks = computed(() => (props.featured ?? []).slice(0, 3))
const READ_CTA = 'Read in Chinese →'
</script>

<template>
  <section
    lang="en"
    class="mx-auto mt-8 max-w-2xl rounded-lg border border-slate-200 bg-white p-6 text-left shadow-sm sm:p-8"
    data-testid="en-index-shell"
  >
    <p class="text-sm leading-6 text-slate-700">{{ intro }}</p>
    <RouterLink
      :to="zhPath"
      class="btn btn-primary btn-md mt-5 w-full sm:w-auto"
      data-testid="en-index-browse-zh"
    >
      Browse in Chinese
    </RouterLink>
    <template v-if="picks.length">
      <h2
        class="mt-7 text-xs font-bold tracking-widest text-slate-500 uppercase"
        data-testid="en-index-featured-heading"
      >{{ featuredHeading }}</h2>
      <ul class="mt-3 divide-y divide-slate-100" data-testid="en-index-featured">
        <li v-for="item in picks" :key="item.to">
          <RouterLink
            :to="item.to"
            class="group flex items-start justify-between gap-3 py-3 text-slate-800 hover:text-brand-600"
          >
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold">{{ item.title }}</span>
              <span class="mt-1 block text-[13px] leading-5 text-slate-600" data-testid="en-index-summary">{{
                item.summary
              }}</span>
              <span
                class="mt-1.5 inline-block text-xs font-semibold text-brand-600 group-hover:underline"
                data-testid="en-index-read-cta"
              >{{ READ_CTA }}</span>
            </span>
            <span
              class="mt-0.5 shrink-0 rounded bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200"
              data-testid="lang-badge-zh"
            >Chinese</span>
          </RouterLink>
        </li>
      </ul>
    </template>
  </section>
</template>
