<script setup lang="ts">
import { computed, ref } from 'vue'

import EnIndexShell, { type EnIndexFeatured } from '@/components/ui/EnIndexShell.vue'
import SelectField, { type SelectOption } from '@/components/ui/SelectField.vue'
import ZhOnlyNotice from '@/components/ui/ZhOnlyNotice.vue'
import {
  formOf,
  labelPapers,
  sheetKeyOf,
  sheetOf,
  type LabelPaperSpec,
  type PaperForm,
  type SheetKey,
} from '@/data/labelPapers'
import { useI18n } from '@/i18n'
import { labelPaperGeometry } from '@/utils/labelPaper'

const { t, locale, localePath } = useI18n()

/** /en 下列表区的英文替代块：主题说明 + 精选入口（英文标题，指向中文纸型页） */
const EN_INTRO = `A library of ${labelPapers.length} pre-cut label sheets — common Chinese A4 self-adhesive die-cuts, A3/A5 full sheets, plus US Letter Avery-compatible stock (5390, 5392, 5395, 5160, 5163, 5164). Every layout ships with dedicated templates and portrait/landscape feed support: pick a sheet, upload your list, print and peel. Sheet details are in Chinese for now.`
const EN_FEATURED: EnIndexFeatured[] = [
  {
    title: 'Avery 5390 badge inserts (8-up, US Letter)',
    summary: 'The standard 2¼ × 3½ badge insert sheet — conference badges and visitor tags that slide straight into holders.',
    to: '/papers/avery-5390',
  },
  {
    title: 'Avery 5395 adhesive name badges (8-up, US Letter)',
    summary: 'Peel-and-stick name badges 2⅓ × 3⅜ — check-in table and event-floor staple.',
    to: '/papers/avery-5395',
  },
  {
    title: 'A4 21-up (3 × 7, 70 × 42.4 mm)',
    summary: 'Classic 3 × 7 full-bleed sheet (Avery 3652-compatible) — the go-to size for exam seat labels and name stickers.',
    to: '/papers/a4-21up',
  },
]

const query = ref('')
const activeSheet = ref<'全部' | SheetKey>('全部')
const activeForm = ref<'全部' | PaperForm>('全部')
const activeCorner = ref<'全部' | '直角' | '圆角'>('全部')
const activeCount = ref('全部')

/** 纸张筛选项：按数据内实际出现的纸张分类生成，保持固定展示顺序 */
const SHEET_ORDER: SheetKey[] = ['A4', 'A3', 'A5', 'US Letter', '其他']
const sheetOptions = computed(() =>
  SHEET_ORDER.filter((k) => labelPapers.some((p) => sheetKeyOf(p) === k)),
)
const FORM_OPTIONS: PaperForm[] = ['整版', '横条', '竖条', '多格', '对折', '圆形']
const countOptions = computed<SelectOption[]>(() => [
  { value: '全部', label: t('全部枚数') },
  ...[...new Set(labelPapers.map((p) => p.cols * p.rows))]
    .sort((a, b) => a - b)
    .map((n) => ({ value: String(n), label: t('每页 {n} 枚').replace('{n}', String(n)) })),
])

/** 搜索归一化：×/* 统一为 x，忽略大小写，支持空格分词（每个词都命中才算匹配） */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[×＊*]/g, 'x')
}

function matchesQuery(spec: LabelPaperSpec, raw: string): boolean {
  const hay = normalize(
    [
      spec.name,
      spec.slug,
      spec.description,
      ...spec.aliases,
      ...spec.uses,
      `${spec.labelWidth}x${spec.labelHeight}`,
      sheetKeyOf(spec),
      formOf(spec),
      `${spec.cols * spec.rows}格`,
      `${spec.cols * spec.rows}枚`,
    ].join(' '),
  )
  return raw
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => hay.includes(token))
}

const filtered = computed(() =>
  labelPapers.filter((p) => {
    if (activeSheet.value !== '全部' && sheetKeyOf(p) !== activeSheet.value) return false
    if (activeForm.value !== '全部' && formOf(p) !== activeForm.value) return false
    if (
      activeCorner.value !== '全部' &&
      (activeCorner.value === '圆角' ? p.corner !== 'rounded' : p.corner !== 'square')
    ) {
      return false
    }
    if (activeCount.value !== '全部' && p.cols * p.rows !== Number(activeCount.value)) return false
    const q = normalize(query.value.trim())
    if (q && !matchesQuery(p, q)) return false
    return true
  }),
)

const hasActiveFilter = computed(
  () =>
    query.value.trim() !== '' ||
    activeSheet.value !== '全部' ||
    activeForm.value !== '全部' ||
    activeCorner.value !== '全部' ||
    activeCount.value !== '全部',
)

function resetFilters() {
  query.value = ''
  activeSheet.value = '全部'
  activeForm.value = '全部'
  activeCorner.value = '全部'
  activeCount.value = '全部'
}

/** SVG 迷你版式示意（按 mm 比例，viewBox 即纸张尺寸） */
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
        {{ t('不干胶纸型库') }}
      </h1>
      <p class="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        {{ t('收录国产电商常见的不干胶分切规格：A4 满切与圆角模切、A3/A5 整版，以及美标 Letter 的 Avery 兼容纸型，共 {n} 种。每种版型配专用模板，选好纸型上传名单即打即贴，详情页可下单同款纸包或定制模板。').replace('{n}', String(labelPapers.length)) }}
      </p>
      <ZhOnlyNotice />
    </div>

    <EnIndexShell
      v-if="locale === 'en'"
      :intro="EN_INTRO"
      featured-heading="Paper sizes"
      :featured="EN_FEATURED"
    />

    <div v-if="locale !== 'en'" class="mx-auto mt-8 max-w-xl">
      <div class="relative">
        <svg
          class="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          v-model="query"
          type="search"
          :placeholder="t('搜索型号、尺寸或用途，如 8格、99.1×67.7、考场')"
          :aria-label="t('搜索纸型')"
          class="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-800 shadow-card placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        <button
          v-if="query"
          type="button"
          class="absolute right-2.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          :aria-label="t('清空搜索')"
          @click="query = ''"
        >
          <svg class="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="m4 4 8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
    </div>

    <div v-if="locale !== 'en'" class="mt-6 space-y-3">
      <div class="flex flex-wrap items-center justify-center gap-2">
        <span class="shrink-0 text-xs font-bold text-slate-600">{{ t('纸张') }}</span>
        <button
          v-for="s in ['全部', ...sheetOptions] as const"
          :key="s"
          type="button"
          class="rounded-full border px-3 py-1 text-xs font-bold transition-colors"
          :class="
            activeSheet === s
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-600'
          "
          @click="activeSheet = s"
        >
          {{ t(s) }}
        </button>
        <span class="mx-1 hidden h-4 w-px bg-slate-200 sm:inline-block" />
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
      <div class="flex flex-wrap items-center justify-center gap-2">
        <span class="shrink-0 text-xs font-bold text-slate-600">{{ t('版式') }}</span>
        <button
          v-for="f in ['全部', ...FORM_OPTIONS] as const"
          :key="f"
          type="button"
          class="rounded-full border px-3 py-1 text-xs font-bold transition-colors"
          :class="
            activeForm === f
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-600'
          "
          @click="activeForm = f"
        >
          {{ t(f) }}
        </button>
        <span class="mx-1 hidden h-4 w-px bg-slate-200 sm:inline-block" />
        <label class="flex items-center gap-1.5 text-xs font-bold text-slate-600">
          {{ t('每页枚数') }}
          <SelectField v-model="activeCount" :options="countOptions" size="sm" class="w-36" />
        </label>
      </div>
    </div>

    <div
      v-if="locale !== 'en'"
      class="mt-6 flex items-center justify-between text-xs text-slate-600"
    >
      <span>{{ t('共 {n} 种纸型').replace('{n}', String(filtered.length)) }}</span>
      <button
        v-if="hasActiveFilter"
        type="button"
        class="font-bold text-brand-600 hover:underline"
        @click="resetFilters"
      >
        {{ t('清除筛选') }}
      </button>
    </div>

    <div
      v-if="locale !== 'en' && filtered.length === 0"
      class="mt-8 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center"
    >
      <p class="text-sm font-bold text-slate-700">{{ t('没有找到匹配的纸型') }}</p>
      <p class="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-600">
        {{ t('换个关键词或减少筛选条件试试；也可以在标签工坊里手动输入标签尺寸、行列数与边距，完全自定义排版。') }}
      </p>
      <button type="button" class="btn btn-secondary btn-sm mt-4" @click="resetFilters">
        {{ t('清除筛选') }}
      </button>
    </div>

    <div v-else-if="locale !== 'en'" class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <RouterLink
        v-for="p in filtered"
        :key="p.slug"
        :to="`/papers/${p.slug}`"
        class="group flex flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-card transition-shadow hover:shadow-lg"
      >
        <div class="flex items-start gap-4">
          <svg
            class="w-16 shrink-0 rounded-sm border border-slate-200 bg-slate-50"
            :viewBox="`0 0 ${sheetOf(p).width} ${sheetOf(p).height}`"
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
          <div class="min-w-0 flex-1">
            <h2 class="text-sm font-bold text-slate-900 group-hover:text-brand-600">
              {{ p.name }}
            </h2>
            <p class="mt-1 text-xs leading-5 text-slate-600">
              {{ p.labelWidth }} × {{ p.labelHeight }} mm · {{ p.cols }} {{ t('列') }} × {{ p.rows }} {{ t('行') }} ·
              {{ t('每页 {n} 枚').replace('{n}', String(p.cols * p.rows)) }} ·
              {{ t(p.corner === 'rounded' ? '圆角' : '直角') }}
            </p>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-1">
            <span
              class="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-600"
            >
              {{ sheetKeyOf(p) }}
            </span>
            <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
              {{ t(formOf(p)) }}
            </span>
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
