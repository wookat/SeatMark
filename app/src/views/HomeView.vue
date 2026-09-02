<script setup lang="ts">
import { computed, ref, shallowRef, type Directive } from 'vue'

import LabelSheet from '@/components/label/LabelSheet.vue'
import TemplateThumb from '@/components/label/TemplateThumb.vue'
import { useElementSize } from '@/composables/useElementSize'
import { TEMPLATE_COUNT } from '@/data/templateMeta'
import { standardTemplate } from '@/data/templateStandard'
import type { DataRow, LabelTemplate } from '@/types/template'
import { localePath, t, useI18n } from '@/i18n'
import { makeDemoRows } from '@/utils/excel'
import { MM_TO_PX } from '@/utils/layout'

const { locale } = useI18n()

/** 滚动显现指令：进入视口时上浮淡入，value 为延迟毫秒（交错动画用） */
const revealObservers = new WeakMap<HTMLElement, IntersectionObserver>()
const vReveal: Directive<HTMLElement, number | undefined> = {
  mounted(el, binding) {
    el.classList.add('reveal-init')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('reveal-in')
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          window.setTimeout(() => el.classList.add('reveal-in'), binding.value ?? 0)
          io.disconnect()
          revealObservers.delete(el)
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    )
    io.observe(el)
    revealObservers.set(el, io)
  },
  unmounted(el) {
    revealObservers.get(el)?.disconnect()
    revealObservers.delete(el)
  },
}

const heroTemplate = standardTemplate

const HERO_EN_NAMES = [
  'Emma Johnson', 'Liam Smith', 'Olivia Brown', 'Noah Davis', 'Ava Wilson', 'Mason Clark',
  'Sophia Lewis', 'Ethan Walker', 'Mia Hall', 'Lucas Young', 'Isabella King', 'Henry Wright',
  'Amelia Scott', 'Jack Green', 'Harper Adams', 'Leo Baker', 'Ella Nelson', 'Owen Carter',
  'Grace Mitchell', 'Ryan Perez', 'Chloe Roberts', 'Caleb Turner', 'Lily Phillips', 'Nathan Campbell',
]

/** 英文站首屏演示行：英文姓名与英文考场名，其余字段与中文演示一致 */
const heroRowsEn: DataRow[] = HERO_EN_NAMES.map((name, i) => ({
  姓名: name,
  考场: `Room ${Math.floor(i / 12) + 1}`,
  座位号: String((i % 12) + 1).padStart(2, '0'),
  准考证号: String(2026061001 + i),
}))

const heroRowsZh = makeDemoRows(24).rows
const heroRows = computed(() => (locale.value === 'en' ? heroRowsEn : heroRowsZh))

const HERO_MAPPING: Record<string, string> = {
  seatNo: '座位号',
  name: '姓名',
  room: '考场',
  examId: '准考证号',
}

function heroGetText(row: DataRow, fieldId: string): string {
  const header = HERO_MAPPING[fieldId]
  return header ? (row[header] ?? '') : ''
}

// ---------- 模板展示：默认露出 5 款 + 「从空白新建」卡片，正好两排 ----------
// 模板定义体积较大，橱窗接近视口时才动态加载，首屏只需 standardTemplate 与计数
const SHOWCASE_COUNT = 5
const templatesExpanded = ref(false)
const allTemplates = shallowRef<LabelTemplate[] | null>(null)
let templatesRequested = false

async function loadTemplates() {
  if (templatesRequested) return
  templatesRequested = true
  allTemplates.value = (await import('@/data/defaultTemplates')).defaultTemplates
}

const templateLoaders = new WeakMap<HTMLElement, IntersectionObserver>()
/** 元素接近视口时触发模板橱窗数据加载 */
const vLoadTemplates: Directive<HTMLElement> = {
  mounted(el) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect()
          templateLoaders.delete(el)
          void loadTemplates()
        }
      },
      // 不预扩边界：大屏高视口下模板区距首屏很近，预扩会让首屏就拉取模板 chunk
      { rootMargin: '0px' },
    )
    io.observe(el)
    templateLoaders.set(el, io)
  },
  unmounted(el) {
    templateLoaders.get(el)?.disconnect()
    templateLoaders.delete(el)
  },
}

const shownTemplates = computed(() => {
  const list = allTemplates.value
  if (!list) return [standardTemplate]
  return templatesExpanded.value ? list : list.slice(0, SHOWCASE_COUNT)
})
const showcaseSkeletonCount = computed(() =>
  allTemplates.value ? 0 : SHOWCASE_COUNT - shownTemplates.value.length,
)
const hiddenTemplateCount = computed(() => Math.max(TEMPLATE_COUNT - SHOWCASE_COUNT, 0))

async function toggleTemplates() {
  await loadTemplates()
  templatesExpanded.value = !templatesExpanded.value
}

const heroPanel = ref<HTMLElement | null>(null)
const { width: heroPanelWidth } = useElementSize(heroPanel)

/** 预览容器内边距：给纸张投影留出渐隐空间，避免被 overflow 裁出生硬切边 */
const HERO_PAD_X = 16
const HERO_PAD_TOP = 16
const HERO_PAD_BOTTOM = 44

/** 面板实测宽度就绪前的估算值：max-w-md（448px）与视口余量取小，
 * 使首帧高度即接近终值，Hero 不产生布局偏移（CLS） */
const estimatedPanelWidth =
  typeof window === 'undefined' ? 448 : Math.min(448, window.innerWidth - 32)

const heroScale = computed(() => {
  const width = heroPanelWidth.value || estimatedPanelWidth
  return Math.min((width - HERO_PAD_X * 2) / (heroTemplate.page.paperWidth * MM_TO_PX), 0.62)
})
const heroHeight = computed(
  () => heroTemplate.page.paperHeight * MM_TO_PX * heroScale.value + HERO_PAD_TOP + HERO_PAD_BOTTOM,
)

const STEPS = computed(() => [
  {
    num: 1,
    title: t('选择标签类型'),
    desc: t('从座签、桌贴、桌牌、门贴、证卡模板开始，也可自定义'),
    icon: 'M4 5h7v7H4zM13 5h7v4h-7zM13 12h7v7h-7zM4 15h7v4H4z',
  },
  {
    num: 2,
    title: t('上传 Excel 名单'),
    desc: t('自动识别姓名、编号、考场、座位号等常见列'),
    icon: 'M12 16V4m0 0L7 9m5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  },
  {
    num: 3,
    title: t('预览并打印'),
    desc: t('检查裁切线、页数和排版，下载 PDF 或直接打印'),
    icon: 'M12 4v12m0 0 5-5m-5 5-5-5M4 20h16',
  },
])

const FEATURES = computed(() => [
  {
    title: t('数据本地处理'),
    desc: t('Excel 名单与照片全部在浏览器内解析，不经过任何服务器，敏感人员信息零外泄。'),
    icon: 'M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3zM9 12l2 2 4-4',
  },
  {
    title: t('字段智能映射'),
    desc: t('姓名、座位号、考号、部门、班级等常见表头自动匹配，不规范列名也可手动指定。'),
    icon: 'M4 7h9M4 12h16M4 17h12M19.5 5.5 17 8l-1.5-1.5',
  },
  {
    title: t('照片批量核验'),
    desc: t('支持「姓名+学号」等组合命名，按所选列自动匹配照片，覆盖率实时统计。'),
    icon: 'M4 5h16v14H4zM9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM20 15l-4.5-4.5L7 19',
  },
  {
    title: t('可视化模板设计器'),
    desc: t('拖拽调整字段位置与大小，毫米级精度控制，自定义模板可保存复用。'),
    icon: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z',
  },
  {
    title: t('多纸张打印精度'),
    desc: t('支持 A4 / A5 / A3 横竖向，尺寸以毫米计算，自带裁切参考线，张贴、摆放、裁剪不跑偏。'),
    icon: 'M12 2v4M12 18v4M2 12h4M18 12h4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  },
  {
    title: t('开源字体在线选'),
    desc: t('内置思源黑体、霞鹜文楷、Inter 等中英文开源字体，一键加载即用，可免费商用。'),
    icon: 'M5 20h14M7 16 12 4l5 12M8.8 12h6.4',
  },
])

const TRUST_STATS = computed(() => [
  { value: '100%', label: t('数据本地处理') },
  { value: locale.value === 'en' ? `${TEMPLATE_COUNT}` : `${TEMPLATE_COUNT} 款`, label: t('内置专业模板') },
  { value: '0.1mm', label: t('排版精度') },
  { value: t('免费'), label: t('无需注册即用') },
])

const FAQS = computed(() => [
  {
    q: t('除了考场座签还能生成什么？'),
    a: t('150+ 款内置模板覆盖考场桌贴、座位号贴、考号贴、门贴门牌、会议桌牌 / 桌签 / 台签 / 席卡、医院床头卡、政务窗口牌、餐饮外卖架、图书馆索书标、驿站货架、学生证、工作证、胸卡出入证等场景，叠加纸张与设计器自定义，相当于数百种成品方案；字段、尺寸与排版都可自由调整。'),
  },
  {
    q: t('Excel 应该怎么准备？'),
    a: t('第一行为表头，建议包含姓名、考场、座位号、准考证号、班级、学号、部门、工号等列。表头越规范，自动匹配越准确；也可以先下载示例文件参考。'),
  },
  {
    q: t('数据会上传到服务器吗？'),
    a: t('不会。本工具为纯前端应用，Excel 解析、照片匹配、PDF 生成全部在你的浏览器中完成，关掉页面即清空。'),
  },
  {
    q: t('照片模板怎么用？'),
    a: t('照片文件名与 Excel 中某一列的值一致、或包含该值即可，例如「张伟2023010101.jpg」用姓名列或学号列都能匹配。上传后工具会自动完成匹配并统计覆盖率。'),
  },
  {
    q: t('最终输出是什么？'),
    a: t('一份按所选纸张（A4 / A5 / A3）排版的 PDF 文件，可直接打印；也可以调起浏览器打印（矢量输出，文字更锐利）。每页标签数量由模板决定。'),
  },
])
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="relative overflow-hidden border-b border-slate-200 bg-white">
      <div
        class="relative mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-10 sm:py-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:py-20"
      >
        <div v-reveal>
          <p
            class="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
          >
            <svg
              class="size-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3z" />
            </svg>
            {{ t('免费 · 无需注册 · 数据不出浏览器') }}
          </p>
          <h1
            class="mt-4 text-3xl leading-tight font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl"
          >
            <template v-if="locale === 'en'">
              Upload a spreadsheet, batch-create <br />
              <span class="text-brand-600"><span class="whitespace-nowrap">seating charts</span> · <span class="whitespace-nowrap">place cards</span> · <span class="whitespace-nowrap">name tags</span></span>
            </template>
            <template v-else>
              上传 Excel，批量生成<br />
              <span class="text-brand-600"><span class="whitespace-nowrap">座签</span> · <span class="whitespace-nowrap">桌牌席卡</span> · <span class="whitespace-nowrap">门贴证卡</span></span>
            </template>
          </h1>
          <p class="mt-4 max-w-lg text-base leading-7 text-slate-600">
            <template v-if="locale === 'en'">
              Make wedding seating charts, place cards, table tent cards, classroom seating labels,
              exam desk labels, door signs and name badges. {{ TEMPLATE_COUNT }} built-in templates
              covering weddings, conferences, classrooms and offices: import your guest list and get
              print-ready pages with millimetre-accurate layout, photo matching, open-source fonts
              and a visual template designer.
            </template>
            <template v-else>
              制作考场座签、课桌桌贴、考号贴、会议桌牌 / 桌签 / 台签 / 席卡 /
              坐席卡、座位背签、门贴门牌、学生证 / 工作证、胸卡出入证。{{ TEMPLATE_COUNT }}
              款内置模板、数百种成品方案，覆盖考试、会议、婚庆、校园、医疗、政务、
              餐饮与仓储物流等场景：导入名单即可输出排版精确到毫米的打印页，
              支持照片核验、开源字体与自定义模板设计。
            </template>
          </p>
          <div class="mt-7 flex flex-wrap gap-3">
            <RouterLink
              :to="localePath('/studio')"
              class="group btn btn-primary btn-lg w-full sm:w-auto"
            >
              {{ t('开始生成标签') }}
              <svg
                class="size-4 transition-transform duration-200 group-hover:translate-x-1"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </RouterLink>
            <RouterLink :to="localePath('/studio?demo=1')" class="btn btn-secondary btn-lg w-full sm:w-auto">
              {{ t('用演示数据先试试') }}
            </RouterLink>
          </div>
          <div
            v-if="locale !== 'en'"
            class="mt-5 flex flex-wrap items-center gap-2 text-xs text-slate-600"
          >
            <span class="font-semibold">{{ t('快捷入口：') }}</span>
            <RouterLink
              v-for="chip in [
                { text: '台签在线制作', to: '/guides/desk-sign-online-maker' },
                { text: '席卡生成器', to: '/guides/place-card-generator-online' },
                { text: '考场桌贴', to: '/guides/exam-seat-label-batch-print' },
                { text: '批量座位背签', to: '/guides/seat-back-sticker-batch' },
                { text: '电子座签 800×480', to: '/guides/eink-800x480-desk-card' },
              ]"
              :key="chip.to"
              :to="chip.to"
              class="group inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-600 shadow-xs transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            >
              {{ t(chip.text) }}<svg
                class="size-3 text-slate-400 transition-colors group-hover:text-brand-500"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="m6 4 4 4-4 4" />
              </svg>
            </RouterLink>
          </div>
          <div class="mt-6 flex flex-wrap gap-x-5 gap-y-1.5 text-xs font-semibold text-slate-600">
            <span
              v-for="mark in [t('无需安装'), t('Excel 批量导入'), t('PDF / 直接打印'), 'A4 · A5 · A3']"
              :key="mark"
              class="flex items-center gap-1"
            >
              <svg
                class="size-3.5 text-emerald-500"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="m3.5 8.5 3 3 6-7" />
              </svg>
              {{ mark }}
            </span>
          </div>
        </div>

        <!-- min-w-0：A4 预览的固有宽度（max-w-md）不得撑大 grid 轨道，否则小屏整个 Hero 溢出 -->
        <div
          ref="heroPanel"
          v-reveal="150"
          class="relative mx-auto w-full max-w-md min-w-0"
        >
          <div
            class="hero-sheet relative max-h-96 overflow-hidden px-4 pt-4 [mask-image:linear-gradient(to_bottom,black_72%,transparent)] sm:max-h-none sm:[mask-image:none]"
            :style="{ height: `${heroHeight}px` }"
          >
            <div class="relative w-fit origin-top-left" :style="{ transform: `scale(${heroScale})` }">
              <LabelSheet
                :template="heroTemplate"
                :rows="heroRows"
                :get-text="heroGetText"
                show-cut-lines
                screen
              />
            </div>
          </div>
          <p
            class="absolute right-3 bottom-3 rounded bg-slate-900/85 px-2.5 py-1 text-[11px] font-semibold text-white"
          >
            {{ t('A4 实际排版效果 · 24 枚/页') }}
          </p>
        </div>
      </div>
    </section>

    <!-- 信任要素条 -->
    <section class="border-y border-slate-200 bg-white">
      <div class="mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-4 gap-y-5 px-4 py-7 sm:grid-cols-4">
        <div
          v-for="(stat, i) in TRUST_STATS"
          :key="stat.label"
          v-reveal="i * 70"
          class="text-center"
        >
          <p class="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            {{ stat.value }}
          </p>
          <p class="mt-0.5 text-xs font-semibold text-slate-600">{{ stat.label }}</p>
        </div>
      </div>
    </section>

    <!-- 三步流程 -->
    <section id="how" class="scroll-mt-16 border-b border-slate-200 bg-slate-50/70">
      <div
        class="mx-auto flex w-full max-w-6xl flex-col items-stretch gap-4 px-4 py-8 sm:flex-row sm:items-center"
      >
        <template v-for="(step, i) in STEPS" :key="step.num">
          <div v-reveal="i * 90" class="group flex flex-1 items-start gap-3">
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"
            >
              <svg
                class="size-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path :d="step.icon" />
              </svg>
            </span>
            <div>
              <p class="text-sm font-bold text-slate-900">
                <span class="mr-1 text-brand-600">{{ step.num }}.</span>{{ step.title }}
              </p>
              <p class="mt-0.5 text-xs leading-5 text-pretty text-slate-600">{{ step.desc }}</p>
            </div>
          </div>
          <svg
            v-if="i < STEPS.length - 1"
            class="hidden size-4 shrink-0 text-slate-300 sm:block"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m6 4 4 4-4 4" />
          </svg>
        </template>
      </div>
    </section>

    <!-- 模板展示 -->
    <section
      id="templates"
      v-load-templates
      class="mx-auto w-full max-w-6xl scroll-mt-16 px-4 py-10 sm:py-14"
    >
      <div v-reveal class="text-center">
        <p class="section-eyebrow">Templates</p>
        <h2 class="section-heading">{{ t('选择适合你的模板') }}</h2>
        <p class="section-sub">
          <template v-if="locale === 'en'">
            {{ TEMPLATE_COUNT }} built-in templates cover seating charts, place cards, desk labels,
            name badges, door signs and more — or start from a blank canvas in the designer
          </template>
          <template v-else>
            {{ TEMPLATE_COUNT }} 套内置模板覆盖座位标签、考场桌贴、考号贴、桌牌、学生证 /
            工作证、胸卡出入证、门贴门牌等场景，也可以在设计器中从零开始
          </template>
        </p>
      </div>
      <div class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <RouterLink
          v-for="(tpl, i) in shownTemplates"
          :key="tpl.id"
          v-reveal="(i % 3) * 80"
          :to="localePath(`/studio?template=${tpl.id}`)"
          class="group relative flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card transition-[border-color,box-shadow] duration-150 hover:border-brand-300 hover:shadow-card-hover"
        >
          <span
            class="absolute inset-x-0 top-0 z-10 h-0.5 opacity-70"
            :style="{ background: tpl.accent }"
          ></span>
          <div
            class="relative bg-[radial-gradient(circle,#cbd5e1_1px,transparent_1px)] bg-[size:12px_12px] px-8 pt-7 pb-5"
          >
            <div class="mx-auto max-w-56">
              <div class="bg-white shadow-card">
                <TemplateThumb :template="tpl" />
              </div>
            </div>
            <span
              class="absolute top-3 right-3 rounded bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200"
            >
              {{ tpl.scenario ? t(tpl.scenario) : '' }}
            </span>
          </div>
          <div class="flex flex-1 flex-col p-4">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-bold text-slate-900 group-hover:text-brand-600">
                {{ t(tpl.name) }}
              </h3>
              <span
                class="flex items-center gap-0.5 text-xs font-bold text-brand-600 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              >
                {{ t('使用') }}
                <svg
                  class="size-3.5"
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
            </div>
            <p class="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{{ t(tpl.description) }}</p>
            <div class="mt-auto flex flex-wrap gap-1.5 pt-3">
              <span
                class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600"
              >
                {{ tpl.label.width }} × {{ tpl.label.height }} mm
              </span>
              <span
                class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600"
              >
                {{ locale === 'en' ? `${tpl.page.cols * tpl.page.rows} / page` : `${tpl.page.cols * tpl.page.rows} 枚 / 页` }}
              </span>
            </div>
          </div>
        </RouterLink>

        <div
          v-for="n in showcaseSkeletonCount"
          :key="`showcase-skeleton-${n}`"
          class="min-h-64 animate-pulse rounded-lg border border-slate-200 bg-slate-100/70"
          aria-hidden="true"
        ></div>

        <RouterLink
          v-reveal="160"
          :to="localePath('/studio?design=new')"
          class="group flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center transition-colors duration-150 hover:border-brand-400 hover:bg-brand-50/40"
        >
          <span
            class="flex size-12 items-center justify-center rounded-lg bg-white text-slate-600 shadow-card ring-1 ring-slate-200 transition-colors group-hover:text-brand-600"
          >
            <svg
              class="size-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <div>
            <h3 class="text-sm font-bold text-slate-700 group-hover:text-brand-700">
              {{ t('从空白新建模板') }}
            </h3>
            <p class="mt-1 text-xs leading-5 text-slate-600">
              <template v-if="locale === 'en'">Open the visual designer and lay out fields freely<br />with millimetre precision</template>
              <template v-else>打开可视化设计器，拖拽字段自由排版，<br />毫米级精度完全自定义</template>
            </p>
          </div>
        </RouterLink>
      </div>

      <div v-if="hiddenTemplateCount > 0" class="mt-7 flex flex-wrap items-center justify-center gap-3 text-center">
        <button
          type="button"
          class="btn btn-secondary btn-md"
          @click="toggleTemplates"
        >
          {{ templatesExpanded ? t('收起模板列表') : (locale === 'en' ? `Show more templates (${hiddenTemplateCount} more)` : `查看更多模板（还有 ${hiddenTemplateCount} 款）`) }}
          <svg
            class="size-3.5 transition-transform"
            :class="{ 'rotate-180': templatesExpanded }"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m4 6 4 4 4-4" />
          </svg>
        </button>
        <RouterLink :to="localePath('/templates')" class="btn btn-ghost btn-md text-brand-600">
          {{ t('浏览模板库详情') }}
          <svg
            class="size-3.5"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 8h10m-4-4 4 4-4 4" />
          </svg>
        </RouterLink>
      </div>
    </section>

    <!-- 特性 -->
    <section id="features" class="scroll-mt-16 border-y border-slate-200 bg-white">
      <div class="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
        <div v-reveal class="text-center">
          <p class="section-eyebrow">Features</p>
          <h2 class="section-heading">{{ t('为批量制签和打印交付打磨的细节') }}</h2>
          <p class="section-sub">
            {{ t('从名单解析到裁切线，每一步都按真实考务与会务交付流程设计') }}
          </p>
        </div>
        <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="(feature, i) in FEATURES"
            :key="feature.title"
            v-reveal="(i % 3) * 80"
            class="group rounded-lg border border-slate-200 bg-slate-50/60 p-5 transition-[border-color,background-color,box-shadow] duration-150 hover:border-brand-200 hover:bg-white hover:shadow-card-hover"
          >
            <span
              class="flex size-9 items-center justify-center rounded-lg bg-white text-brand-600 ring-1 ring-slate-200"
            >
              <svg
                class="size-4.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path :d="feature.icon" />
              </svg>
            </span>
            <h3 class="mt-3 text-sm font-bold text-slate-900">{{ feature.title }}</h3>
            <p class="mt-1.5 text-xs leading-5 text-pretty text-slate-600">{{ feature.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 隐私实测对比 -->
    <section id="privacy" class="scroll-mt-16 border-b border-slate-200 bg-slate-50/70">
      <div class="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
        <div v-reveal class="text-center">
          <p class="section-eyebrow">Privacy Proof</p>
          <h2 class="section-heading">{{ t('实测网络面板：名单零上传') }}</h2>
          <p class="section-sub">
            {{ t('打开浏览器开发者工具（F12 → Network）就能自己验证：在 SeatMark 上传 Excel、生成、导出全程，没有任何一个携带名单数据的网络请求') }}
          </p>
        </div>
        <div class="mt-8 grid gap-4 md:grid-cols-2">
          <div
            v-reveal
            class="rounded-lg border-2 border-emerald-200 bg-white p-5 shadow-card"
          >
            <div class="flex items-center gap-2">
              <span
                class="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"
              >
                <svg
                  class="size-4.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 3 4 6v5c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6l-8-3z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </span>
              <h3 class="text-sm font-bold text-slate-900">{{ t('SeatMark：名单只在你的浏览器里') }}</h3>
            </div>
            <ul class="mt-4 space-y-2.5 text-xs leading-5 text-slate-600">
              <li class="flex gap-2">
                <svg class="mt-0.5 size-3.5 flex-none text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7" /></svg>
                <template v-if="locale === 'en'">Uploading a spreadsheet adds <strong>zero network requests</strong>: parsing runs in local JS</template>
                <template v-else>上传 Excel 后网络面板<strong>零新增请求</strong>：解析由本地 JS 完成</template>
              </li>
              <li class="flex gap-2">
                <svg class="mt-0.5 size-3.5 flex-none text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7" /></svg>
                <template v-if="locale === 'en'">Photos and PDF rendering also stay in local memory — <strong>exports keep working offline</strong></template>
                <template v-else>照片、PDF 渲染同样在本地内存中进行，<strong>断网也能继续导出</strong></template>
              </li>
              <li class="flex gap-2">
                <svg class="mt-0.5 size-3.5 flex-none text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7" /></svg>
                {{ t('关闭页面即清空，没有任何服务器存过你的学生 / 员工名单') }}
              </li>
            </ul>
          </div>
          <div v-reveal="120" class="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
            <div class="flex items-center gap-2">
              <span
                class="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600"
              >
                <svg
                  class="size-4.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M17.5 19a4.5 4.5 0 1 0-.4-8.98 6 6 0 0 0-11.54 1.7A4 4 0 0 0 6 19h11.5z" />
                  <path d="M12 11v4M12 17.5h.01" />
                </svg>
              </span>
              <h3 class="text-sm font-bold text-slate-900">{{ t('云端设计类工具：名单需先上云') }}</h3>
            </div>
            <ul class="mt-4 space-y-2.5 text-xs leading-5 text-slate-600">
              <li class="flex gap-2">
                <svg class="mt-0.5 size-3.5 flex-none text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                <template v-if="locale === 'en'">Bulk merge requires uploading your list — the network panel shows the <strong>whole sheet POSTed out</strong></template>
                <template v-else>批量套数据需把名单上传到服务器，网络面板可见<strong>整表 POST 出网</strong></template>
              </li>
              <li class="flex gap-2">
                <svg class="mt-0.5 size-3.5 flex-none text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                {{ t('名单在对方服务器的留存时长、访问范围，用户无法自行验证') }}
              </li>
              <li class="flex gap-2">
                <svg class="mt-0.5 size-3.5 flex-none text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                {{ t('含身份证号 / 照片的考生名单出网，可能触碰学校与单位的合规红线') }}
              </li>
            </ul>
          </div>
        </div>
        <p v-reveal class="mt-5 text-center text-xs text-slate-600">
          {{ t('完整验证步骤见教程') }}
          <RouterLink
            to="/guides/roster-privacy-network-test"
            class="font-semibold text-brand-600 hover:underline"
          >
            {{ t('《实测网络面板：为什么名单类工具必须零上传》') }}
          </RouterLink>
        </p>
      </div>
    </section>

    <!-- FAQ -->
    <section id="faq" class="mx-auto w-full max-w-6xl scroll-mt-16 px-4 py-10 sm:py-14">
      <div v-reveal class="text-center">
        <p class="section-eyebrow">FAQ</p>
        <h2 class="section-heading">{{ t('常见问题') }}</h2>
        <p class="section-sub">
          <template v-if="locale === 'en'">
            More how-tos in the
            <RouterLink :to="localePath('/guides')" class="font-semibold text-brand-600 hover:underline">guides</RouterLink>;
            commercial-use and free-plan details on the
            <RouterLink :to="localePath('/pricing')" class="font-semibold text-brand-600 hover:underline">pricing page</RouterLink>
          </template>
          <template v-else>
            更多制作与打印实战技巧见
            <RouterLink to="/guides" class="font-semibold text-brand-600 hover:underline">教程中心</RouterLink>，
            商用与免费说明见
            <RouterLink to="/pricing" class="font-semibold text-brand-600 hover:underline">定价页</RouterLink>
          </template>
        </p>
      </div>
      <div class="mt-8 grid gap-4 sm:grid-cols-2">
        <div
          v-for="(faq, i) in FAQS"
          :key="faq.q"
          v-reveal="(i % 2) * 90"
          class="rounded-lg border border-slate-200 bg-white p-5 shadow-card"
        >
          <h3 class="flex items-start gap-2 text-sm font-bold text-slate-900">
            <span
              class="mt-px flex size-4.5 shrink-0 items-center justify-center rounded bg-brand-50 text-[10px] font-bold text-brand-600"
            >
              Q
            </span>
            {{ faq.q }}
          </h3>
          <p class="mt-2 pl-6.5 text-xs leading-5 text-slate-600">{{ faq.a }}</p>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="mx-auto w-full max-w-6xl px-4 pb-12 sm:pb-16">
      <div
        v-reveal
        class="relative flex flex-col items-center justify-between gap-5 rounded-lg bg-brand-700 px-6 py-10 text-center sm:flex-row sm:px-10 sm:py-12 sm:text-left"
      >
        <div class="relative">
          <h2 class="text-xl font-bold text-white sm:text-2xl">{{ t('开始生成你的标签') }}</h2>
          <p class="mt-1.5 text-sm text-brand-100">
            {{ t('选择模板、上传 Excel，几分钟完成一批座签、门贴或证卡。无需注册，数据不出浏览器。') }}
          </p>
        </div>
        <RouterLink
          :to="localePath('/studio')"
          class="group btn btn-lg relative w-full shrink-0 bg-white text-brand-700 hover:bg-brand-50 sm:w-auto"
        >
          {{ t('进入标签工坊') }}
          <svg
            class="size-4 transition-transform duration-200 group-hover:translate-x-1"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M5 12h14m-6-6 6 6-6 6" />
          </svg>
        </RouterLink>
      </div>
    </section>
  </div>
</template>
