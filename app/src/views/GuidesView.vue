<script setup lang="ts">
import { computed, ref } from 'vue'

import { guides } from '@/data/guides'
import { matchesChineseQuery } from '@/utils/pinyin'

const activeCategory = ref('全部')
const activeAudience = ref('全部')
const searchQuery = ref('')

const categories = computed(() => ['全部', ...new Set(guides.map((g) => g.category))])
const audiences = computed(() => ['全部', ...new Set(guides.flatMap((g) => g.audiences))])

const filteredGuides = computed(() =>
  guides.filter(
    (g) =>
      (activeCategory.value === '全部' || g.category === activeCategory.value) &&
      (activeAudience.value === '全部' || g.audiences.includes(activeAudience.value)) &&
      matchesChineseQuery(`${g.title} ${g.description} ${g.category}`, searchQuery.value),
  ),
)

function resetFilters() {
  activeCategory.value = '全部'
  activeAudience.value = '全部'
  searchQuery.value = ''
}

/** 空结果时的推荐：优先同主题或同群体的教程，不足时用热门教程补齐 */
const recommendedGuides = computed(() => {
  const partial = guides.filter(
    (g) =>
      g.category === activeCategory.value ||
      (activeAudience.value !== '全部' && g.audiences.includes(activeAudience.value)),
  )
  const pool = partial.length > 0 ? partial : guides
  return pool.slice(0, 3)
})
</script>

<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
    <div class="text-center">
      <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Guides</p>
      <h1 class="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">教程中心</h1>
      <p class="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">
        座签、桌牌、席位卡、证卡的制作与打印实战教程：从 Excel 名单整理、模板选择到打印裁切，
        问答式讲解常见坑点，看完即可上手。
      </p>
    </div>

    <!-- 筛选器 -->
    <div class="mt-8 grid gap-3">
      <label class="relative mx-auto block w-full max-w-md">
        <svg
          class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="7" cy="7" r="4.5" />
          <path d="m10.5 10.5 3 3" />
        </svg>
        <input
          v-model="searchQuery"
          type="search"
          placeholder="搜索教程，支持拼音首字母，如“打印”“jkz”"
          class="w-full rounded-lg border border-slate-200 bg-white py-2 pr-4 pl-9 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
        />
      </label>
      <div class="flex flex-wrap items-center gap-2">
        <span class="shrink-0 text-xs font-bold text-slate-400">主题</span>
        <button
          v-for="cat in categories"
          :key="cat"
          type="button"
          class="rounded-full border px-3 py-1 text-xs font-bold transition-colors"
          :class="
            activeCategory === cat
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-slate-200 bg-white text-slate-500 hover:border-brand-300 hover:text-brand-600'
          "
          @click="activeCategory = cat"
        >
          {{ cat }}
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="shrink-0 text-xs font-bold text-slate-400">群体</span>
        <button
          v-for="aud in audiences"
          :key="aud"
          type="button"
          class="rounded-full border px-3 py-1 text-xs font-bold transition-colors"
          :class="
            activeAudience === aud
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-slate-200 bg-white text-slate-500 hover:border-brand-300 hover:text-brand-600'
          "
          @click="activeAudience = aud"
        >
          {{ aud }}
        </button>
      </div>
      <p class="text-xs text-slate-400">共 {{ filteredGuides.length }} 篇教程</p>
    </div>

    <div
      v-if="filteredGuides.length === 0"
      class="mt-10 rounded-lg border border-slate-200 bg-slate-50 p-8 text-center"
    >
      <p class="text-sm text-slate-500">该条件下暂无教程，换个关键词或筛选条件试试。</p>
      <button
        type="button"
        class="mt-3 text-xs font-bold text-brand-600 hover:underline"
        @click="resetFilters"
      >
        清除筛选
      </button>
      <div class="mt-6 border-t border-slate-200 pt-5 text-left">
        <p class="text-xs font-bold text-slate-500">也许你想看这些教程</p>
        <div class="mt-3 grid gap-3 sm:grid-cols-3">
          <RouterLink
            v-for="rec in recommendedGuides"
            :key="rec.slug"
            :to="`/guides/${rec.slug}`"
            class="group rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-brand-300"
          >
            <p class="text-[11px] font-bold text-brand-600">{{ rec.category }}</p>
            <h3 class="mt-1 line-clamp-2 text-xs leading-5 font-bold text-slate-700 group-hover:text-brand-600">
              {{ rec.title }}
            </h3>
          </RouterLink>
        </div>
      </div>
    </div>

    <div v-else class="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <RouterLink
        v-for="guide in filteredGuides"
        :key="guide.slug"
        :to="`/guides/${guide.slug}`"
        class="group flex flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-brand-300 hover:shadow-card-hover"
      >
        <div class="flex items-center gap-2 text-[11px] font-bold">
          <span class="rounded-md bg-brand-50 px-2 py-0.5 text-brand-600">{{ guide.category }}</span>
          <span class="text-slate-400">约 {{ guide.readingMinutes }} 分钟读完</span>
        </div>
        <h2
          class="mt-3 text-base leading-6 font-bold text-slate-900 group-hover:text-brand-600"
        >
          {{ guide.title }}
        </h2>
        <p class="mt-2 line-clamp-3 flex-1 text-xs leading-5 text-slate-500">
          {{ guide.description }}
        </p>
        <span class="mt-4 flex items-center gap-1 text-xs font-bold text-brand-600">
          阅读全文
          <svg
            class="size-3.5 transition-transform duration-200 group-hover:translate-x-1"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 8h10m-4-4 4 4-4 4" />
          </svg>
        </span>
      </RouterLink>
    </div>

    <!-- CTA -->
    <div
      class="mt-12 flex flex-col items-center justify-between gap-4 rounded-lg border border-brand-200 bg-brand-50/60 px-6 py-6 text-center sm:flex-row sm:text-left"
    >
      <div>
        <h2 class="text-base font-bold text-slate-900">边看边做，效果最好</h2>
        <p class="mt-1 text-sm text-slate-500">
          打开标签工坊，用演示数据即可完整体验教程里的每一步，全程免费。
        </p>
      </div>
      <RouterLink to="/studio?demo=1" class="btn btn-primary btn-md w-full shrink-0 sm:w-auto">
        用演示数据试试
      </RouterLink>
    </div>
  </div>
</template>
