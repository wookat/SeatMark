<script setup lang="ts">
/**
 * /en 下仅有中文正文的内容站索引页（教程 / 对比 / 纸型）列表区替代块：
 * 一段英文主题说明 + 「Browse in Chinese」主按钮 + ≤3 条英文标题的精选入口（指向中文详情页），
 * 不再整列渲染中文卡片。仅在 locale === 'en' 时由调用方渲染。
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { stripLocalePrefix } from '@/i18n'

export interface EnIndexFeatured {
  /** 英文标题 */
  title: string
  /** 中文详情页路径（/en 下详情页会重定向回中文，故直接给中文路径） */
  to: string
}

const props = defineProps<{
  /** 英文主题说明（本节讲什么、为何目前仅中文） */
  intro: string
  /** 精选入口，最多渲染 3 条 */
  featured?: EnIndexFeatured[]
  /** 在每条精选入口旁渲染「Chinese」语言角标（字面英文，不走 i18n） */
  langBadge?: boolean
}>()

const route = useRoute()
const zhPath = computed(() => stripLocalePrefix(route.path))
const picks = computed(() => (props.featured ?? []).slice(0, 3))
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
      <h2 class="mt-7 text-xs font-bold tracking-widest text-slate-500 uppercase">Featured (in Chinese)</h2>
      <ul class="mt-3 divide-y divide-slate-100" data-testid="en-index-featured">
        <li v-for="item in picks" :key="item.to">
          <RouterLink
            :to="item.to"
            class="group flex items-center justify-between gap-3 py-2.5 text-sm font-semibold text-slate-800 hover:text-brand-600"
          >
            <span class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span>{{ item.title }}</span>
              <span
                v-if="langBadge"
                class="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200"
                data-testid="lang-badge-zh"
              >Chinese</span>
            </span>
            <svg
              class="size-3.5 shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-brand-600"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M3 8h10m-4-4 4 4-4 4" />
            </svg>
          </RouterLink>
        </li>
      </ul>
    </template>
  </section>
</template>
