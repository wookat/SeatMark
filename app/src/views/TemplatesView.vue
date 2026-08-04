<script setup lang="ts">
import { computed, ref } from 'vue'

import TemplateThumb from '@/components/label/TemplateThumb.vue'
import { defaultTemplates, TEMPLATE_CATEGORIES } from '@/data/defaultTemplates'
import { templateDetails } from '@/data/templateDetails'
import type { TemplateCategory } from '@/types/template'
import { matchesChineseQuery } from '@/utils/pinyin'

const items = templateDetails
  .map((detail) => ({
    detail,
    template: defaultTemplates.find((t) => t.id === detail.slug),
  }))
  .filter((item) => !!item.template)

type CategoryFilter = TemplateCategory | 'all'
const activeCategory = ref<CategoryFilter>('all')
const searchQuery = ref('')

const categoryOptions = computed<{ id: CategoryFilter; name: string; count: number }[]>(() => [
  { id: 'all', name: '全部', count: items.length },
  ...TEMPLATE_CATEGORIES.map((c) => ({
    id: c.id as CategoryFilter,
    name: c.name,
    count: items.filter((item) => item.template!.category === c.id).length,
  })).filter((o) => o.count > 0),
])

const filteredItems = computed(() => {
  let list = items
  if (activeCategory.value !== 'all') {
    list = list.filter((item) => item.template!.category === activeCategory.value)
  }
  const query = searchQuery.value.trim()
  if (!query) return list
  return list.filter((item) => {
    const t = item.template!
    return matchesChineseQuery(`${t.name} ${t.scenario ?? ''} ${t.description}`, query)
  })
})

function resetSearch() {
  searchQuery.value = ''
  activeCategory.value = 'all'
}

/** 搜索无结果时的推荐：当前分类下的模板优先，否则用常用模板兜底 */
const recommendedItems = computed(() => {
  const inCategory =
    activeCategory.value === 'all'
      ? items
      : items.filter((item) => item.template!.category === activeCategory.value)
  return (inCategory.length > 0 ? inCategory : items).slice(0, 3)
})
</script>

<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
    <div class="text-center">
      <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Templates</p>
      <h1 class="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        标签模板库
      </h1>
      <p class="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">
        {{ items.length }} 款免费内置模板覆盖考场座签、考号贴、课桌姓名贴、会议桌牌、
        出入证、学生证、工作证等场景，全部以毫米为单位精确排版，
        点击任意模板查看详情，或直接开始生成。
      </p>
    </div>

    <div class="mt-8 flex flex-col items-center gap-3">
      <label class="relative block w-full max-w-md">
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
          placeholder="搜索模板名称 / 场景，支持拼音首字母，如“桌牌”“jkz”"
          class="w-full rounded-lg border border-slate-200 bg-white py-2 pr-4 pl-9 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
        />
      </label>
      <div class="flex flex-wrap justify-center gap-1.5">
        <button
          v-for="opt in categoryOptions"
          :key="opt.id"
          type="button"
          class="cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition-colors duration-150"
          :class="
            activeCategory === opt.id
              ? 'border-brand-500 bg-brand-600 text-white shadow-sm'
              : 'border-slate-200 bg-white text-slate-500 hover:border-brand-300 hover:text-brand-600'
          "
          @click="activeCategory = opt.id"
        >
          {{ opt.name }}
          <span :class="activeCategory === opt.id ? 'text-brand-100' : 'text-slate-400'">
            {{ opt.count }}
          </span>
        </button>
      </div>
    </div>

    <div
      v-if="filteredItems.length === 0"
      class="mt-10 rounded-lg border border-slate-200 bg-slate-50 p-8 text-center"
    >
      <p class="text-sm text-slate-500">
        没有匹配“{{ searchQuery }}”的模板，换个关键词试试，或在设计器里从空白新建。
      </p>
      <div class="mt-3 flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          class="cursor-pointer text-xs font-bold text-brand-600 hover:underline"
          @click="resetSearch"
        >
          清除搜索条件
        </button>
        <RouterLink to="/studio?design=new" class="text-xs font-bold text-brand-600 hover:underline">
          从空白新建模板
        </RouterLink>
      </div>
      <div class="mt-6 border-t border-slate-200 pt-5 text-left">
        <p class="text-xs font-bold text-slate-500">也许这些模板能满足需求</p>
        <div class="mt-3 grid gap-4 sm:grid-cols-3">
          <RouterLink
            v-for="rec in recommendedItems"
            :key="rec.detail.slug"
            :to="`/templates/${rec.detail.slug}`"
            class="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-brand-300"
          >
            <div class="w-16 shrink-0">
              <TemplateThumb :template="rec.template!" />
            </div>
            <div class="min-w-0">
              <h3 class="truncate text-sm font-bold text-slate-800 group-hover:text-brand-600">
                {{ rec.template!.name }}
              </h3>
              <p class="mt-0.5 truncate text-xs text-slate-400">{{ rec.template!.scenario }}</p>
            </div>
          </RouterLink>
        </div>
      </div>
    </div>

    <div class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <RouterLink
        v-for="item in filteredItems"
        :key="item.detail.slug"
        :to="`/templates/${item.detail.slug}`"
        class="group relative flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-brand-300 hover:shadow-card-hover"
      >
        <span
          class="absolute inset-x-0 top-0 z-10 h-0.5 opacity-70"
          :style="{ background: item.template!.accent }"
        ></span>
        <div
          class="relative bg-[radial-gradient(circle,#cbd5e1_1px,transparent_1px)] bg-[size:12px_12px] px-8 pt-7 pb-5"
        >
          <div class="mx-auto max-w-56 ">
            <div class="bg-white shadow-card">
              <TemplateThumb :template="item.template!" />
            </div>
          </div>
          <span
            class="absolute top-3 right-3 rounded bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200"
          >
            {{ item.template!.scenario }}
          </span>
        </div>
        <div class="flex flex-1 flex-col p-4">
          <h2 class="text-sm font-bold text-slate-900 group-hover:text-brand-600">
            {{ item.template!.name }}
          </h2>
          <p class="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
            {{ item.template!.description }}
          </p>
          <div class="mt-auto flex flex-wrap gap-1.5 pt-3">
            <span class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
              {{ item.template!.label.width }} × {{ item.template!.label.height }} mm
            </span>
            <span class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
              {{ item.template!.page.cols * item.template!.page.rows }} 枚 / 页
            </span>
          </div>
        </div>
      </RouterLink>
    </div>

    <!-- CTA -->
    <div
      class="mt-12 flex flex-col items-center justify-between gap-4 rounded-lg border border-brand-200 bg-brand-50/60 px-6 py-6 text-center sm:flex-row sm:text-left"
    >
      <div>
        <h2 class="text-base font-bold text-slate-900">没有完全合适的？</h2>
        <p class="mt-1 text-sm text-slate-500">
          任何模板都可以在可视化设计器中继续调整，也可以从空白开始完全自定义。
        </p>
      </div>
      <RouterLink to="/studio?design=new" class="btn btn-primary btn-md w-full shrink-0 sm:w-auto">
        从空白新建模板
      </RouterLink>
    </div>
  </div>
</template>
