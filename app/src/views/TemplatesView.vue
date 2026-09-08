<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import TemplateThumb from '@/components/label/TemplateThumb.vue'
import { useBatchedList } from '@/composables/useBatchedList'
import { useIsNarrow } from '@/composables/useMediaQuery'
import ZhOnlyNotice from '@/components/ui/ZhOnlyNotice.vue'
import { defaultTemplates, TEMPLATE_CATEGORIES } from '@/data/defaultTemplates'
import { templateDetails } from '@/data/templateDetails'
import { TEMPLATE_SUBCATEGORIES, subcategoryOf } from '@/data/templateTaxonomy'
import { t as tr } from '@/i18n'
import { useI18n } from '@/i18n'
import type { TemplateCategory } from '@/types/template'
import { matchesChineseQuery } from '@/utils/pinyin'

const { t, localePath, locale } = useI18n()

const CJK_RE = /[\u4e00-\u9fff]/

/** 列表前几张卡片在首屏内，直接渲染缩略图不走懒渲染 */
const EAGER_THUMB_COUNT = 6

/** en 下卡片说明：优先读已有英文译文，缺失时隐藏中文段落而不外泄 */
function cardText(text: string | undefined): string {
  if (!text) return ''
  const localized = t(text)
  return locale.value === 'en' && CJK_RE.test(localized) ? '' : localized
}

const items = templateDetails
  .map((detail) => ({
    detail,
    template: defaultTemplates.find((tpl) => tpl.id === detail.slug),
  }))
  .filter((item) => !!item.template)

type CategoryFilter = TemplateCategory | 'all'

// 分类筛选同步到 route.query：浏览器返回时分类与滚动位置一并恢复。
// 搜索词是用户输入，不进地址栏（避免被读 location.href 的第三方脚本外发），
// 改用 sessionStorage 保状态：返回/刷新本页签仍恢复搜索，关页签即清除。
const route = useRoute()
const router = useRouter()

const VALID_CATEGORIES = new Set<string>(TEMPLATE_CATEGORIES.map((c) => c.id))

/** 搜索词的会话级持久化键（与 index.html 直开 ?q= 转存脚本共用） */
const SEARCH_STORAGE_KEY = 'seatmark.templates-search.v1'

function storedSearch(): string {
  try {
    return sessionStorage.getItem(SEARCH_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function persistSearch(q: string) {
  try {
    if (q.trim()) sessionStorage.setItem(SEARCH_STORAGE_KEY, q)
    else sessionStorage.removeItem(SEARCH_STORAGE_KEY)
  } catch {
    // sessionStorage 不可用时仅影响搜索词恢复
  }
}

function queryStr(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

const initialCat = queryStr(route.query.cat)
const activeCategory = ref<CategoryFilter>(
  VALID_CATEGORIES.has(initialCat) ? (initialCat as TemplateCategory) : 'all',
)
const activeSubcategory = ref<string>(queryStr(route.query.sub) || 'all')
const searchQuery = ref(queryStr(route.query.q) || storedSearch())

// 兼容带 ?q= 的旧分享链接/站内跳转：带入搜索词后立即从地址栏移除
if (route.query.q !== undefined) {
  persistSearch(searchQuery.value)
  void router.replace({ query: { ...route.query, q: undefined } })
}

watch([activeCategory, activeSubcategory, searchQuery], ([cat, sub, q]) => {
  persistSearch(q)
  void router.replace({
    query: {
      ...route.query,
      cat: cat === 'all' ? undefined : cat,
      sub: sub === 'all' ? undefined : sub,
      q: undefined,
    },
  })
})

function selectCategory(id: CategoryFilter) {
  activeCategory.value = id
  activeSubcategory.value = 'all'
}

const subcategoryOptions = computed<{ id: string; name: string; count: number }[]>(() => {
  const cat = activeCategory.value
  if (cat === 'all') return []
  const list = items.filter((item) => item.template!.category === cat)
  const options = TEMPLATE_SUBCATEGORIES[cat]
    .map((sub) => ({
      id: sub.id,
      name: sub.name,
      count: list.filter((item) => subcategoryOf(item.template!.id)?.id === sub.id).length,
    }))
    .filter((o) => o.count > 0)
  if (options.length <= 1) return []
  return [{ id: 'all', name: t('全部'), count: list.length }, ...options]
})

const categoryOptions = computed<{ id: CategoryFilter; name: string; count: number }[]>(() => [
  { id: 'all', name: t('全部'), count: items.length },
  ...TEMPLATE_CATEGORIES.map((c) => ({
    id: c.id as CategoryFilter,
    name: t(c.name),
    count: items.filter((item) => item.template!.category === c.id).length,
  })).filter((o) => o.count > 0),
])

// 搜索与分类叠加生效；类内无命中而全库有命中时回退全库结果（避免误报「没有匹配」）
const searchResult = computed(() => {
  const query = searchQuery.value.trim()
  let list = items
  if (activeCategory.value !== 'all') {
    list = list.filter((item) => item.template!.category === activeCategory.value)
    if (activeSubcategory.value !== 'all') {
      list = list.filter((item) => subcategoryOf(item.template!.id)?.id === activeSubcategory.value)
    }
  }
  if (!query) return { list, globalFallback: false }
  const matches = (item: (typeof items)[number]) => {
    const t = item.template!
    return matchesChineseQuery(`${t.name} ${t.scenario ?? ''} ${t.description}`, query)
  }
  const inScope = list.filter(matches)
  if (inScope.length > 0 || activeCategory.value === 'all') {
    return { list: inScope, globalFallback: false }
  }
  return { list: items.filter(matches), globalFallback: true }
})

const filteredItems = computed(() => searchResult.value.list)

const {
  visible: visibleItems,
  hasMore,
  showMore,
} = useBatchedList(filteredItems, [activeCategory, activeSubcategory, searchQuery])

const shownNote = computed(() =>
  tr('已显示 {shown}/{total}')
    .replace('{shown}', String(visibleItems.value.length))
    .replace('{total}', String(filteredItems.value.length)),
)

const searchActive = computed(() => searchQuery.value.trim().length > 0)

const activeCategoryName = computed(() =>
  t(TEMPLATE_CATEGORIES.find((c) => c.id === activeCategory.value)?.name ?? ''),
)

function fill(zh: string, vars: Record<string, string | number>): string {
  return t(zh).replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))
}

const searchScopeNote = computed(() => {
  if (!searchActive.value || filteredItems.value.length === 0) return ''
  const vars = { cat: activeCategoryName.value, n: filteredItems.value.length }
  if (searchResult.value.globalFallback) {
    return fill('「{cat}」分类下无匹配，已在全部分类中找到 {n} 款', vars)
  }
  if (activeCategory.value !== 'all') {
    return fill('在「{cat}」分类中找到 {n} 款', vars)
  }
  return fill('在全部分类中找到 {n} 款', vars)
})

function resetSearch() {
  searchQuery.value = ''
  activeCategory.value = 'all'
  activeSubcategory.value = 'all'
}

/**
 * <640px 窄屏：吸顶区只保留一行横向滚动的分类 chips + 「筛选 (N)」按钮，
 * 搜索框与子分类折进按钮展开的面板（非吸顶，占位在列表上方）；≥640px 维持原多行布局。
 */
const isNarrow = useIsNarrow()
const filterPanelOpen = ref(false)
/** 折起面板内已生效的筛选数（搜索词 / 子分类），显示在按钮角标 */
const extraFilterCount = computed(
  () => (searchActive.value ? 1 : 0) + (activeSubcategory.value !== 'all' ? 1 : 0),
)

/**
 * chips 横滑可发现性：右侧白色渐隐遮罩，提示右边还有分类；滚到末尾（或内容未溢出）时隐藏，滚回时恢复。
 * 尚未完成布局（scrollWidth = 0）时保持当前状态，默认可见。
 */
const chipsEl = ref<HTMLElement | null>(null)
const chipsFadeVisible = ref(true)
function updateChipsFade() {
  const el = chipsEl.value
  if (!el || !el.scrollWidth) return
  const overflow = el.scrollWidth - el.clientWidth
  chipsFadeVisible.value = overflow > 1 && el.scrollLeft < overflow - 1
}
function scrollChipsForward() {
  const el = chipsEl.value
  if (!el) return
  el.scrollBy({ left: el.clientWidth * 0.6, behavior: 'smooth' })
}
watch(chipsEl, updateChipsFade, { flush: 'post' })
onMounted(() => window.addEventListener('resize', updateChipsFade))
onBeforeUnmount(() => window.removeEventListener('resize', updateChipsFade))

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
        {{ t('标签模板库') }}
      </h1>
      <p class="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        {{ fill('{n} 款免费内置模板覆盖考场座签、考号贴、课桌姓名贴、会议桌牌、出入证、学生证、工作证等场景，全部以毫米为单位精确排版，点击任意模板查看详情，或直接开始生成。', { n: items.length }) }}
      </p>
      <ZhOnlyNotice variant="templates" />
    </div>

    <div
      class="sticky top-14 z-20 -mx-4 mt-8 flex flex-col items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 min-[769px]:static min-[769px]:mx-0 min-[769px]:border-0 min-[769px]:bg-transparent min-[769px]:p-0"
      :class="isNarrow ? 'py-2' : ''"
      data-testid="templates-filter-bar"
    >
      <div v-if="isNarrow" class="flex w-full items-center gap-2">
        <div class="relative min-w-0 flex-1">
          <div
            ref="chipsEl"
            class="scrollbar-none flex snap-x snap-mandatory gap-1.5 overflow-x-auto"
            role="tablist"
            :aria-label="t('模板分类')"
            data-testid="templates-category-chips"
            @scroll.passive="updateChipsFade"
          >
            <button
              v-for="opt in categoryOptions"
              :key="opt.id"
              type="button"
              role="tab"
              :aria-selected="activeCategory === opt.id"
              :aria-pressed="activeCategory === opt.id"
              class="shrink-0 cursor-pointer snap-start rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors duration-150"
              :class="
                activeCategory === opt.id
                  ? 'border-brand-500 bg-brand-600 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-600'
              "
              @click="selectCategory(opt.id)"
            >
              {{ opt.name }}
              <span :class="activeCategory === opt.id ? 'text-brand-100' : 'text-slate-600'">
                {{ opt.count }}
              </span>
            </button>
          </div>
          <div
            v-show="chipsFadeVisible"
            class="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-end bg-gradient-to-l from-white via-white/80 to-transparent"
            data-testid="templates-chips-fade"
          >
            <button
              type="button"
              class="pointer-events-auto flex size-6 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors duration-150 hover:border-brand-300 hover:text-brand-600"
              :aria-label="t('查看更多分类')"
              data-testid="templates-chips-more"
              @click="scrollChipsForward"
            >
              <svg class="size-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m6 4 4 4-4 4" />
              </svg>
            </button>
          </div>
        </div>
        <button
          type="button"
          class="relative inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-colors duration-150"
          :class="
            filterPanelOpen || extraFilterCount > 0
              ? 'border-brand-300 bg-brand-50 text-brand-700'
              : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-600'
          "
          :aria-expanded="filterPanelOpen"
          aria-controls="templates-filter-panel"
          data-testid="templates-filter-toggle"
          @click="filterPanelOpen = !filterPanelOpen"
        >
          <svg class="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 4h12M4.5 8h7M7 12h2" />
          </svg>
          {{ tr('筛选') }}
          <span v-if="extraFilterCount > 0" data-testid="templates-filter-count">({{ extraFilterCount }})</span>
        </button>
      </div>
      <template v-else>
      <label class="relative block w-full max-w-md">
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
          :placeholder="t('搜索模板 / 场景，支持拼音、首字母')"
          :title="t('搜索模板或场景名称，支持中文、拼音全拼与首字母')"
          class="w-full rounded-lg border border-slate-200 bg-white py-2 pr-4 pl-9 text-sm text-slate-700 shadow-sm placeholder:text-slate-600 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
        />
      </label>
      <p v-if="searchScopeNote" class="text-xs text-slate-500">
        {{ searchScopeNote }}
      </p>
      <div class="flex flex-wrap justify-center gap-1.5">
        <button
          v-for="opt in categoryOptions"
          :key="opt.id"
          type="button"
          class="cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition-colors duration-150"
          :class="
            activeCategory === opt.id
              ? 'border-brand-500 bg-brand-600 text-white shadow-sm'
              : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-600'
          "
          @click="selectCategory(opt.id)"
        >
          {{ opt.name }}
          <span :class="activeCategory === opt.id ? 'text-brand-100' : 'text-slate-600'">
            {{ opt.count }}
          </span>
        </button>
      </div>
      <div v-if="subcategoryOptions.length > 0" class="flex flex-wrap justify-center gap-1.5">
        <button
          v-for="sub in subcategoryOptions"
          :key="sub.id"
          type="button"
          class="cursor-pointer rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors duration-150"
          :class="
            activeSubcategory === sub.id
              ? 'border-brand-300 bg-brand-50 text-brand-700'
              : 'border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-700'
          "
          @click="activeSubcategory = sub.id"
        >
          {{ t(sub.name) }}
          <span :class="activeSubcategory === sub.id ? 'text-brand-400' : 'text-slate-600'">
            {{ sub.count }}
          </span>
        </button>
      </div>
      </template>
    </div>

    <!-- 窄屏展开的筛选面板：不吸顶，占位在列表上方 -->
    <div
      v-if="isNarrow && filterPanelOpen"
      id="templates-filter-panel"
      class="mt-3 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
      data-testid="templates-filter-panel"
    >
      <label class="relative block w-full">
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
          :placeholder="t('搜索模板 / 场景，支持拼音、首字母')"
          :title="t('搜索模板或场景名称，支持中文、拼音全拼与首字母')"
          class="w-full rounded-lg border border-slate-200 bg-white py-2 pr-4 pl-9 text-sm text-slate-700 shadow-sm placeholder:text-slate-600 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
        />
      </label>
      <p v-if="searchScopeNote" class="text-xs text-slate-500">
        {{ searchScopeNote }}
      </p>
      <div v-if="subcategoryOptions.length > 0" class="flex flex-wrap gap-1.5">
        <button
          v-for="sub in subcategoryOptions"
          :key="sub.id"
          type="button"
          class="cursor-pointer rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors duration-150"
          :class="
            activeSubcategory === sub.id
              ? 'border-brand-300 bg-brand-50 text-brand-700'
              : 'border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-700'
          "
          @click="activeSubcategory = sub.id"
        >
          {{ t(sub.name) }}
          <span :class="activeSubcategory === sub.id ? 'text-brand-400' : 'text-slate-600'">
            {{ sub.count }}
          </span>
        </button>
      </div>
      <p v-else class="text-xs text-slate-500">{{ tr('选中一个分类后可按子类继续筛选') }}</p>
    </div>

    <div
      v-if="filteredItems.length === 0"
      class="mt-10 rounded-lg border border-slate-200 bg-slate-50 p-8 text-center"
    >
      <p class="text-sm text-slate-600">
        {{ fill('没有匹配“{q}”的模板，换个关键词试试，或在设计器里从空白新建。', { q: searchQuery }) }}
      </p>
      <div class="mt-3 flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          class="cursor-pointer text-xs font-bold text-brand-600 hover:underline"
          @click="resetSearch"
        >
          {{ t('清除搜索条件') }}
        </button>
        <RouterLink
          :to="localePath('/studio?design=new')"
          class="text-xs font-bold text-brand-600 hover:underline"
        >
          {{ t('从空白新建模板') }}
        </RouterLink>
      </div>
      <div class="mt-6 border-t border-slate-200 pt-5 text-left">
        <p class="text-xs font-bold text-slate-600">{{ t('没有完全匹配的，先看看这些相近模板') }}</p>
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
                {{ t(rec.template!.name) }}
              </h3>
              <p v-if="cardText(rec.template!.scenario)" class="mt-0.5 truncate text-xs text-slate-600">{{ cardText(rec.template!.scenario) }}</p>
            </div>
          </RouterLink>
        </div>
      </div>
    </div>

    <div class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <RouterLink
        v-for="(item, index) in visibleItems"
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
              <TemplateThumb
                :template="item.template!"
                :defer="index >= EAGER_THUMB_COUNT"
              />
            </div>
          </div>
          <div class="absolute top-3 right-3 flex max-w-[calc(100%-1.5rem)] flex-wrap justify-end gap-1">
            <span
              v-if="cardText(item.template!.scenario)"
              class="rounded bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200"
            >
              {{ cardText(item.template!.scenario) }}
            </span>
            <span
              v-if="locale === 'en'"
              lang="en"
              class="rounded bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200"
              data-testid="lang-badge-zh"
            >Chinese</span>
          </div>
        </div>
        <div class="flex flex-1 flex-col p-4">
          <h2 class="text-sm font-bold text-slate-900 group-hover:text-brand-600">
            {{ t(item.template!.name) }}
          </h2>
          <p v-if="cardText(item.template!.description)" class="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
            {{ cardText(item.template!.description) }}
          </p>
          <div class="mt-auto flex flex-wrap gap-1.5 pt-3">
            <span class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
              {{ item.template!.label.width }} × {{ item.template!.label.height }} mm
            </span>
            <span class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
              {{ item.template!.page.cols * item.template!.page.rows }} {{ t('枚 / 页') }}
            </span>
          </div>
        </div>
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
        <h2 class="text-base font-bold text-slate-900">{{ t('没有完全合适的？') }}</h2>
        <p class="mt-1 text-sm text-slate-600">
          {{ t('任何模板都可以在可视化设计器中继续调整，也可以从空白开始完全自定义。') }}
        </p>
      </div>
      <RouterLink
        :to="localePath('/studio?design=new')"
        class="btn btn-primary btn-md w-full shrink-0 sm:w-auto"
      >
        {{ t('从空白新建模板') }}
      </RouterLink>
    </div>
  </div>
</template>
