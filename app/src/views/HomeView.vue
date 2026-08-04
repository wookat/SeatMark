<script setup lang="ts">
import { computed, ref, type Directive } from 'vue'

import LabelSheet from '@/components/label/LabelSheet.vue'
import TemplateThumb from '@/components/label/TemplateThumb.vue'
import { useElementSize } from '@/composables/useElementSize'
import { defaultTemplates } from '@/data/defaultTemplates'
import type { DataRow } from '@/types/template'
import { makeDemoRows } from '@/utils/excel'
import { MM_TO_PX } from '@/utils/layout'

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

const heroTemplate = defaultTemplates[0]!
const heroRows = makeDemoRows(24).rows

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
const SHOWCASE_COUNT = 5
const templatesExpanded = ref(false)
const shownTemplates = computed(() =>
  templatesExpanded.value ? defaultTemplates : defaultTemplates.slice(0, SHOWCASE_COUNT),
)
const hiddenTemplateCount = computed(() =>
  Math.max(defaultTemplates.length - SHOWCASE_COUNT, 0),
)

const heroPanel = ref<HTMLElement | null>(null)
const { width: heroPanelWidth } = useElementSize(heroPanel)

/** 预览容器内边距：给纸张投影留出渐隐空间，避免被 overflow 裁出生硬切边 */
const HERO_PAD_X = 16
const HERO_PAD_TOP = 16
const HERO_PAD_BOTTOM = 44

const heroScale = computed(() => {
  if (!heroPanelWidth.value) return 0.4
  return Math.min(
    (heroPanelWidth.value - HERO_PAD_X * 2) / (heroTemplate.page.paperWidth * MM_TO_PX),
    0.62,
  )
})
const heroHeight = computed(
  () => heroTemplate.page.paperHeight * MM_TO_PX * heroScale.value + HERO_PAD_TOP + HERO_PAD_BOTTOM,
)

const STEPS = [
  {
    num: 1,
    title: '选择标签类型',
    desc: '从座签、桌贴、桌牌、门贴、证卡模板开始，也可自定义',
    icon: 'M4 5h7v7H4zM13 5h7v4h-7zM13 12h7v7h-7zM4 15h7v4H4z',
  },
  {
    num: 2,
    title: '上传 Excel 名单',
    desc: '自动识别姓名、编号、考场、座位号等常见列',
    icon: 'M12 16V4m0 0L7 9m5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  },
  {
    num: 3,
    title: '预览并打印',
    desc: '检查裁切线、页数和排版，下载 PDF 或直接打印',
    icon: 'M12 4v12m0 0 5-5m-5 5-5-5M4 20h16',
  },
]

const FEATURES = [
  {
    title: '数据本地处理',
    desc: 'Excel 名单与照片全部在浏览器内解析，不经过任何服务器，敏感人员信息零外泄。',
    icon: 'M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3zM9 12l2 2 4-4',
  },
  {
    title: '字段智能映射',
    desc: '姓名、座位号、考号、部门、班级等常见表头自动匹配，不规范列名也可手动指定。',
    icon: 'M4 7h9M4 12h16M4 17h12M19.5 5.5 17 8l-1.5-1.5',
  },
  {
    title: '照片批量核验',
    desc: '支持「姓名+学号」等组合命名，按所选列自动匹配照片，覆盖率实时统计。',
    icon: 'M4 5h16v14H4zM9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM20 15l-4.5-4.5L7 19',
  },
  {
    title: '可视化模板设计器',
    desc: '拖拽调整字段位置与大小，毫米级精度控制，自定义模板可保存复用。',
    icon: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z',
  },
  {
    title: '多纸张打印精度',
    desc: '支持 A4 / A5 / A3 横竖向，尺寸以毫米计算，自带裁切参考线，张贴、摆放、裁剪不跑偏。',
    icon: 'M12 2v4M12 18v4M2 12h4M18 12h4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  },
  {
    title: '开源字体在线选',
    desc: '内置思源黑体、霞鹜文楷、Inter 等中英文开源字体，一键加载即用，可免费商用。',
    icon: 'M5 20h14M7 16 12 4l5 12M8.8 12h6.4',
  },
]

const FAQS = [
  {
    q: '除了考场座签还能生成什么？',
    a: '内置模板覆盖考场桌贴、座位号贴、考号贴、门贴门牌、会议桌牌 / 桌签 / 台签 / 席卡、半页与整页大名牌、学生证、工作证、胸卡出入证等多种场景；字段、尺寸与排版都可在可视化设计器中自由调整。',
  },
  {
    q: 'Excel 应该怎么准备？',
    a: '第一行为表头，建议包含姓名、考场、座位号、准考证号、班级、学号、部门、工号等列。表头越规范，自动匹配越准确；也可以先下载示例文件参考。',
  },
  {
    q: '数据会上传到服务器吗？',
    a: '不会。本工具为纯前端应用，Excel 解析、照片匹配、PDF 生成全部在你的浏览器中完成，关掉页面即清空。',
  },
  {
    q: '照片模板怎么用？',
    a: '照片文件名与 Excel 中某一列的值一致、或包含该值即可，例如「张伟2023010101.jpg」用姓名列或学号列都能匹配。上传后工具会自动完成匹配并统计覆盖率。',
  },
  {
    q: '最终输出是什么？',
    a: '一份按所选纸张（A4 / A5 / A3）排版的 PDF 文件，可直接打印；也可以调起浏览器打印（矢量输出，文字更锐利）。每页标签数量由模板决定。',
  },
]
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,#c7d2fe66_1px,transparent_1px)] bg-[size:26px_26px] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]"
      ></div>
      <!-- 漂移光斑：为 Hero 增加缓慢流动的氛围光 -->
      <div
        class="pointer-events-none absolute -top-28 -left-28 size-96 rounded-full bg-brand-300/40 blur-3xl motion-safe:animate-blob"
      ></div>
      <div
        class="pointer-events-none absolute top-1/4 -right-24 size-[28rem] rounded-full bg-sky-300/30 blur-3xl motion-safe:animate-blob-slow"
      ></div>
      <div
        class="pointer-events-none absolute -bottom-24 left-1/3 size-80 rounded-full bg-violet-300/30 blur-3xl motion-safe:animate-blob [animation-delay:-13s]"
      ></div>
      <div
        class="relative mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-10 sm:py-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:py-20"
      >
        <div v-reveal>
          <p
            class="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-bold text-brand-700 shadow-sm"
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
            免费 · 无需注册 · 数据不出浏览器
          </p>
          <h1
            class="mt-4 text-3xl leading-tight font-black tracking-tight text-slate-900 sm:text-4xl lg:text-5xl"
          >
            上传 Excel，批量生成<br />
            <span
              class="bg-gradient-to-r from-brand-600 via-violet-500 to-sky-500 bg-[length:200%_auto] bg-clip-text text-transparent motion-safe:animate-gradient"
            >
              座签 · 桌牌席卡 · 门贴证卡
            </span>
          </h1>
          <p class="mt-4 max-w-lg text-base leading-7 text-slate-600">
            一站式制作考场座签、课桌桌贴、考号贴、会议桌牌 / 桌签 / 台签 / 席卡、
            门贴门牌、学生证 / 工作证、胸卡出入证等。适合考试、会议、培训、活动签到、
            入场核验与校园 / 单位管理场景，导入名单即可输出排版精确到毫米的打印页，
            支持照片核验、开源字体与自定义模板设计。
          </p>
          <div class="mt-7 flex flex-wrap gap-3">
            <RouterLink
              to="/studio"
              class="group btn btn-primary btn-lg w-full shadow-lg shadow-brand-600/25 transition-shadow hover:shadow-xl hover:shadow-brand-600/30 sm:w-auto"
            >
              开始生成标签
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
            <RouterLink to="/studio?demo=1" class="btn btn-secondary btn-lg w-full sm:w-auto">
              用演示数据先试试
            </RouterLink>
          </div>
          <div class="mt-6 flex flex-wrap gap-x-5 gap-y-1.5 text-xs font-semibold text-slate-500">
            <span
              v-for="mark in ['无需安装', 'Excel 批量导入', 'PDF / 直接打印', 'A4 · A5 · A3']"
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
          class="relative mx-auto w-full max-w-md min-w-0 motion-safe:animate-float"
        >
          <div
            class="absolute -inset-4 rounded-3xl bg-gradient-to-br from-brand-200/60 to-emerald-100/40 blur-2xl"
          ></div>
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
              <!-- 扫描光带：模拟批量生成的打印进度感 -->
              <div class="hero-scanline motion-reduce:hidden" aria-hidden="true"></div>
            </div>
          </div>
          <p
            class="absolute right-3 bottom-3 rounded-lg bg-slate-900/85 px-2.5 py-1 text-[11px] font-bold text-white"
          >
            A4 实际排版效果 · 24 枚/页
          </p>
        </div>
      </div>
    </section>

    <!-- 步骤 -->
    <section class="border-y border-slate-200 bg-white">
      <div
        class="mx-auto flex w-full max-w-6xl flex-col items-stretch gap-4 px-4 py-8 sm:flex-row sm:items-center"
      >
        <template v-for="(step, i) in STEPS" :key="step.num">
          <div v-reveal="i * 90" class="group flex flex-1 items-start gap-3">
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-all duration-200 group-hover:scale-110 group-hover:bg-brand-600 group-hover:text-white"
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
              <p class="mt-0.5 text-xs leading-5 text-slate-500">{{ step.desc }}</p>
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
    <section class="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
      <div v-reveal class="text-center">
        <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Templates</p>
        <h2 class="mt-1 text-2xl font-black tracking-tight text-slate-900">选择适合你的模板</h2>
        <p class="mt-2 text-sm text-slate-500">
          {{ defaultTemplates.length }} 套内置模板覆盖座位标签、考场桌贴、考号贴、桌牌、学生证 /
          工作证、胸卡出入证、门贴门牌等场景，也可以在设计器中从零开始
        </p>
      </div>
      <div class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <RouterLink
          v-for="(t, i) in shownTemplates"
          :key="t.id"
          v-reveal="(i % 3) * 80"
          :to="`/studio?template=${t.id}`"
          class="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg"
        >
          <span
            class="absolute inset-x-0 top-0 z-10 h-0.5 opacity-70"
            :style="{ background: t.accent }"
          ></span>
          <div
            class="relative bg-[radial-gradient(circle,#cbd5e1_1px,transparent_1px)] bg-[size:12px_12px] px-8 pt-7 pb-5"
          >
            <div
              class="mx-auto max-w-56 transition-transform duration-300 group-hover:scale-[1.04] group-hover:-rotate-1"
            >
              <div class="bg-white shadow-[0_8px_24px_-10px_rgba(15,23,42,0.35)]">
                <TemplateThumb :template="t" />
              </div>
            </div>
            <span
              class="absolute top-3 right-3 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-500 shadow-sm ring-1 ring-slate-200"
            >
              {{ t.scenario }}
            </span>
          </div>
          <div class="flex flex-1 flex-col p-4">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-bold text-slate-900 group-hover:text-brand-600">
                {{ t.name }}
              </h3>
              <span
                class="flex items-center gap-0.5 text-xs font-bold text-brand-600 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              >
                使用
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
            <p class="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{{ t.description }}</p>
            <div class="mt-auto flex flex-wrap gap-1.5 pt-3">
              <span
                class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500"
              >
                {{ t.label.width }} × {{ t.label.height }} mm
              </span>
              <span
                class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500"
              >
                {{ t.page.cols * t.page.rows }} 枚 / 页
              </span>
            </div>
          </div>
        </RouterLink>

        <RouterLink
          v-reveal="160"
          to="/studio?design=new"
          class="group flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-6 text-center transition-all duration-200 hover:-translate-y-1 hover:border-brand-400 hover:bg-brand-50/40"
        >
          <span
            class="flex size-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200 transition-colors group-hover:text-brand-600"
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
              从空白新建模板
            </h3>
            <p class="mt-1 text-xs leading-5 text-slate-500">
              打开可视化设计器，拖拽字段自由排版，<br />毫米级精度完全自定义
            </p>
          </div>
        </RouterLink>
      </div>

      <div v-if="hiddenTemplateCount > 0" class="mt-7 flex flex-wrap items-center justify-center gap-3 text-center">
        <button
          type="button"
          class="btn btn-secondary btn-md"
          @click="templatesExpanded = !templatesExpanded"
        >
          {{ templatesExpanded ? '收起模板列表' : `查看更多模板（还有 ${hiddenTemplateCount} 款）` }}
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
        <RouterLink to="/templates" class="btn btn-ghost btn-md text-brand-600">
          浏览模板库详情
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
    <section class="border-y border-slate-200 bg-white">
      <div class="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
        <div v-reveal class="text-center">
          <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Features</p>
          <h2 class="mt-1 text-2xl font-black tracking-tight text-slate-900">
            为批量制签和打印交付打磨的细节
          </h2>
        </div>
        <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="(feature, i) in FEATURES"
            :key="feature.title"
            v-reveal="(i % 3) * 80"
            class="group rounded-2xl border border-slate-200 bg-slate-50/60 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white hover:shadow-md"
          >
            <span
              class="flex size-9 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm ring-1 ring-slate-200 transition-all duration-200 group-hover:scale-110 group-hover:-rotate-6 group-hover:bg-brand-600 group-hover:text-white group-hover:ring-brand-600"
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
            <p class="mt-1.5 text-xs leading-5 text-slate-500">{{ feature.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section class="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
      <div v-reveal class="text-center">
        <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">FAQ</p>
        <h2 class="mt-1 text-2xl font-black tracking-tight text-slate-900">常见问题</h2>
        <p class="mt-2 text-sm text-slate-500">
          更多制作与打印实战技巧见
          <RouterLink to="/guides" class="font-semibold text-brand-600 hover:underline">教程中心</RouterLink>，
          商用与免费说明见
          <RouterLink to="/pricing" class="font-semibold text-brand-600 hover:underline">定价页</RouterLink>
        </p>
      </div>
      <div class="mt-8 grid gap-4 sm:grid-cols-2">
        <div
          v-for="(faq, i) in FAQS"
          :key="faq.q"
          v-reveal="(i % 2) * 90"
          class="rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-brand-200"
        >
          <h3 class="flex items-start gap-2 text-sm font-bold text-slate-900">
            <span
              class="mt-px flex size-4.5 shrink-0 items-center justify-center rounded-md bg-brand-50 text-[10px] font-black text-brand-600"
            >
              Q
            </span>
            {{ faq.q }}
          </h3>
          <p class="mt-2 pl-6.5 text-xs leading-5 text-slate-500">{{ faq.a }}</p>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="mx-auto w-full max-w-6xl px-4 pb-12 sm:pb-16">
      <div
        v-reveal
        class="relative flex flex-col items-center justify-between gap-5 overflow-hidden rounded-3xl bg-gradient-to-r from-brand-600 via-violet-600 to-brand-700 bg-[length:200%_auto] px-6 py-8 text-center motion-safe:animate-gradient sm:flex-row sm:px-8 sm:py-10 sm:text-left"
      >
        <div
          class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,#ffffff22_1px,transparent_1px)] bg-[size:18px_18px]"
        ></div>
        <div
          class="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-white/15 blur-2xl motion-safe:animate-blob"
        ></div>
        <div class="relative">
          <h2 class="text-xl font-black text-white">准备好了？</h2>
          <p class="mt-1 text-sm text-brand-100">选择模板、上传 Excel，几分钟完成一批座签、门贴或证卡。</p>
        </div>
        <RouterLink
          to="/studio"
          class="group btn btn-lg relative w-full shrink-0 bg-white text-brand-700 shadow-lg hover:bg-brand-50 sm:w-auto"
        >
          进入标签工坊
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
