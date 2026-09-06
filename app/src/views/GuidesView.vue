<script setup lang="ts">
import { computed, ref } from 'vue'

import { useBatchedList } from '@/composables/useBatchedList'
import ZhOnlyNotice from '@/components/ui/ZhOnlyNotice.vue'
import { guides } from '@/data/guides'
import { t as tr } from '@/i18n'
import { useI18n } from '@/i18n'
import { matchesChineseQuery } from '@/utils/pinyin'

const { t, localePath } = useI18n()

const activeCategory = ref('全部')
const activeAudience = ref('全部')
const searchQuery = ref('')

/** <769px 下筛选面板默认折叠为一行（sticky），展开后变为 static 不再占视口；≥769px 忽略此状态 */
const filtersOpen = ref(false)

/** 折叠行上展示的已选条件（不含「全部」） */
const activeFilterChips = computed(() => {
  const chips: { key: string; label: string; clear: () => void }[] = []
  if (activeCategory.value !== '全部') {
    chips.push({
      key: 'category',
      label: t(activeCategory.value),
      clear: () => (activeCategory.value = '全部'),
    })
  }
  if (activeAudience.value !== '全部') {
    chips.push({
      key: 'audience',
      label: t(activeAudience.value),
      clear: () => (activeAudience.value = '全部'),
    })
  }
  const q = searchQuery.value.trim()
  if (q) chips.push({ key: 'query', label: `“${q}”`, clear: () => (searchQuery.value = '') })
  return chips
})

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

const {
  visible: visibleGuides,
  hasMore,
  showMore,
} = useBatchedList(filteredGuides, [activeCategory, activeAudience, searchQuery])

const shownNote = computed(() =>
  tr('已显示 {shown}/{total}')
    .replace('{shown}', String(visibleGuides.value.length))
    .replace('{total}', String(filteredGuides.value.length)),
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
      <h1 class="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        {{ t('教程中心') }}
      </h1>
      <p class="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        {{ t('座签、桌牌、席位卡、证卡的制作与打印实战教程：从 Excel 名单整理、模板选择到打印裁切，问答式讲解常见坑点。') }}
      </p>
      <ZhOnlyNotice />
    </div>

    <!-- 筛选器：移动端默认折叠为一行 sticky，展开时不再 sticky；桌面端始终展开且 static -->
    <div
      class="-mx-4 mt-8 border-b border-slate-200 bg-white px-4 min-[769px]:static min-[769px]:mx-0 min-[769px]:border-0 min-[769px]:bg-transparent min-[769px]:p-0"
      :class="filtersOpen ? 'static' : 'sticky top-14 z-20'"
      data-testid="guides-filter-bar"
    >
      <div class="flex h-12 items-center gap-2 min-[769px]:hidden" data-testid="guides-filter-toggle-row">
        <button
          type="button"
          class="btn btn-secondary btn-sm shrink-0"
          :aria-expanded="filtersOpen"
          aria-controls="guides-filter-panel"
          data-testid="guides-filter-toggle"
          @click="filtersOpen = !filtersOpen"
        >
          <svg
            class="size-3.5 transition-transform"
            :class="{ 'rotate-180': filtersOpen }"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="m4 6 4 4 4-4" />
          </svg>
          {{ t('筛选') }}
          <span v-if="activeFilterChips.length" class="font-normal text-slate-500">
            {{ t('（已选') }} {{ activeFilterChips.length }} {{ t('项）') }}
          </span>
        </button>
        <div
          v-if="activeFilterChips.length"
          class="flex min-w-0 flex-1 gap-1.5 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          data-testid="guides-filter-chips"
        >
          <button
            v-for="chip in activeFilterChips"
            :key="chip.key"
            type="button"
            class="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-600 bg-brand-600 px-2.5 py-1 text-xs font-bold text-white"
            :aria-label="`${t('清除筛选')} ${chip.label}`"
            @click="chip.clear()"
          >
            {{ chip.label }}
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <p v-else class="min-w-0 flex-1 truncate text-xs text-slate-600">
          {{ t('共 {n} 篇教程').replace('{n}', String(filteredGuides.length)) }}
        </p>
      </div>
      <div
        id="guides-filter-panel"
        class="gap-3 pb-3 min-[769px]:grid min-[769px]:p-0"
        :class="filtersOpen ? 'grid' : 'hidden'"
        data-testid="guides-filter-panel"
      >
        <label class="relative mx-auto block w-full max-w-md">
          <svg
            class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-600"
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
            :placeholder="t('搜索教程，支持拼音、首字母，如“打印”“dayin”“jkz”')"
            class="w-full rounded-lg border border-slate-200 bg-white py-2 pr-4 pl-9 text-sm text-slate-700 shadow-sm placeholder:text-slate-600 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
          />
        </label>
        <div class="flex flex-wrap items-center gap-2">
          <span class="shrink-0 text-xs font-bold text-slate-600">{{ t('主题') }}</span>
          <button
            v-for="cat in categories"
            :key="cat"
            type="button"
            class="rounded-full border px-3 py-1 text-xs font-bold transition-colors"
            :class="
              activeCategory === cat
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-600'
            "
            @click="activeCategory = cat"
          >
            {{ t(cat) }}
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="shrink-0 text-xs font-bold text-slate-600">{{ t('群体') }}</span>
          <button
            v-for="aud in audiences"
            :key="aud"
            type="button"
            class="rounded-full border px-3 py-1 text-xs font-bold transition-colors"
            :class="
              activeAudience === aud
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-600'
            "
            @click="activeAudience = aud"
          >
            {{ t(aud) }}
          </button>
        </div>
        <p class="text-xs text-slate-600">
          {{ t('共 {n} 篇教程').replace('{n}', String(filteredGuides.length)) }}
        </p>
      </div>
    </div>

    <div
      v-if="filteredGuides.length === 0"
      class="mt-10 rounded-lg border border-slate-200 bg-slate-50 p-8 text-center"
    >
      <p class="text-sm text-slate-600">{{ t('该条件下暂无教程，换个关键词或筛选条件试试。') }}</p>
      <button
        type="button"
        class="mt-3 text-xs font-bold text-brand-600 hover:underline"
        @click="resetFilters"
      >
        {{ t('清除筛选') }}
      </button>
      <div class="mt-6 border-t border-slate-200 pt-5 text-left">
        <p class="text-xs font-bold text-slate-600">{{ t('也许你想看这些教程') }}</p>
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
        v-for="guide in visibleGuides"
        :key="guide.slug"
        :to="`/guides/${guide.slug}`"
        class="group flex flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-brand-300 hover:shadow-card-hover"
      >
        <div class="flex items-center gap-2 text-[11px] font-bold">
          <span class="rounded-md bg-brand-50 px-2 py-0.5 text-brand-600">{{ t(guide.category) }}</span>
          <span class="text-slate-600">
            {{ t('约 {n} 分钟读完').replace('{n}', String(guide.readingMinutes)) }}
          </span>
        </div>
        <h2
          class="mt-3 text-base leading-6 font-bold text-slate-900 group-hover:text-brand-600"
        >
          {{ guide.title }}
        </h2>
        <p class="mt-2 line-clamp-3 flex-1 text-xs leading-5 text-slate-600">
          {{ guide.description }}
        </p>
        <span class="mt-4 flex items-center gap-1 text-xs font-bold text-brand-600">
          {{ t('阅读全文') }}
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

    <div v-if="hasMore" class="mt-8 flex flex-col items-center gap-2">
      <button type="button" class="btn btn-secondary btn-md" data-testid="load-more" @click="showMore">
        {{ tr('加载更多') }}
      </button>
      <p class="text-xs text-slate-500">{{ shownNote }}</p>
    </div>

    <!-- CTA -->
    <div
      class="mt-12 flex flex-col items-center justify-between gap-4 rounded-lg border border-brand-200 bg-brand-50/60 px-6 py-6 text-center sm:flex-row sm:text-left"
    >
      <div>
        <h2 class="text-base font-bold text-slate-900">{{ t('边看边做，效果最好') }}</h2>
        <p class="mt-1 text-sm text-slate-600">
          {{ t('打开标签工坊，用演示数据即可完整体验教程里的每一步，全程免费。') }}
        </p>
      </div>
      <RouterLink
        :to="localePath('/studio?demo=1')"
        class="btn btn-primary btn-md w-full shrink-0 sm:w-auto"
      >
        {{ t('用演示数据试试') }}
      </RouterLink>
    </div>
  </div>
</template>
