<script setup lang="ts">
import { PRICING_FAQS } from '@/data/seo'

interface Plan {
  name: string
  originalPrice: string | null
  tagline: string
  features: string[]
  highlight: boolean
}

const PLANS: Plan[] = [
  {
    name: '免费版',
    originalPrice: null,
    tagline: '个人日常制签，永久免费',
    features: [
      '全部 33 款内置模板',
      'Excel 名单批量导入与智能映射',
      'A4 / A5 / A3 排版与 PDF 导出',
      '裁切线与浏览器直接打印',
      '数据全程浏览器本地处理',
    ],
    highlight: false,
  },
  {
    name: '专业版',
    originalPrice: '¥29',
    tagline: '考务与会务重度用户',
    features: [
      '含免费版全部功能',
      '照片批量核验与覆盖率统计',
      '可视化模板设计器（毫米级）',
      '自定义模板保存与分享链接',
      '在线开源字体库',
      'AI 设计辅助',
    ],
    highlight: true,
  },
  {
    name: '团队版',
    originalPrice: '¥99',
    tagline: '学校 / 机构多人协作',
    features: [
      '含专业版全部功能',
      '模板分享链接团队分发',
      '多设备使用不限次数',
      '机构商用授权',
      '优先反馈响应',
    ],
    highlight: false,
  },
]
</script>

<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
    <div class="text-center">
      <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Pricing</p>
      <h1 class="mt-1 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
        定价方案
      </h1>
      <p
        class="mx-auto mt-4 inline-flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-bold text-emerald-700"
      >
        <svg
          class="size-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83" />
        </svg>
        Beta 期间全部档位限时免费体验
      </p>
      <p class="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">
        产品处于 Beta 公测阶段，专业版与团队版的全部功能现在
        <strong class="text-slate-700">无需注册、完全免费</strong>使用。
        正式定价生效前会提前公告，现在开始使用不吃亏。
      </p>
    </div>

    <div class="mt-10 grid gap-5 md:grid-cols-3">
      <div
        v-for="plan in PLANS"
        :key="plan.name"
        class="relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
        :class="plan.highlight ? 'border-brand-400 ring-2 ring-brand-500/20' : 'border-slate-200'"
      >
        <span
          v-if="plan.highlight"
          class="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-0.5 text-[11px] font-bold text-white shadow-sm"
        >
          最受欢迎
        </span>
        <h2 class="text-base font-bold text-slate-900">{{ plan.name }}</h2>
        <p class="mt-0.5 text-xs text-slate-500">{{ plan.tagline }}</p>

        <div class="mt-4 flex items-end gap-2">
          <span class="text-4xl font-black tracking-tight text-slate-900">¥0</span>
          <span v-if="plan.originalPrice" class="pb-1 text-sm font-semibold text-slate-400">
            <s>{{ plan.originalPrice }}</s>/月
          </span>
          <span v-else class="pb-1 text-sm font-semibold text-slate-400">/ 永久</span>
        </div>
        <p
          v-if="plan.originalPrice"
          class="mt-1 inline-flex w-fit items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700"
        >
          <svg
            class="size-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 8v4l2.5 2.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          </svg>
          Beta 限时免费
        </p>
        <p v-else class="mt-1 text-[11px] font-bold text-emerald-600">始终免费</p>

        <ul class="mt-5 flex flex-1 flex-col gap-2.5 text-sm text-slate-600">
          <li v-for="feature in plan.features" :key="feature" class="flex items-start gap-2">
            <svg
              class="mt-0.5 size-4 shrink-0 text-emerald-500"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m3.5 8.5 3 3 6-7" />
            </svg>
            {{ feature }}
          </li>
        </ul>

        <RouterLink
          to="/studio"
          class="btn btn-md mt-6 w-full"
          :class="plan.highlight ? 'btn-primary' : 'btn-secondary'"
        >
          免费开始使用
        </RouterLink>
      </div>
    </div>

    <p class="mt-6 text-center text-xs text-slate-400">
      Beta 期间不接入任何支付，无隐藏收费；所有数据仅在浏览器本地处理，不会上传服务器。
    </p>

    <!-- FAQ -->
    <section class="mx-auto mt-14 max-w-3xl">
      <h2 class="text-center text-2xl font-black tracking-tight text-slate-900">定价常见问题</h2>
      <div class="mt-6 grid gap-4">
        <div
          v-for="faq in PRICING_FAQS"
          :key="faq.q"
          class="rounded-2xl border border-slate-200 bg-white p-5"
        >
          <h3 class="text-sm font-bold text-slate-900">{{ faq.q }}</h3>
          <p class="mt-2 text-sm leading-6 text-slate-500">{{ faq.a }}</p>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <div class="mt-12 text-center">
      <RouterLink to="/studio" class="btn btn-primary btn-lg shadow-lg shadow-brand-600/25">
        进入标签工坊，免费开始
        <svg
          class="size-4"
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
      <p class="mt-3 text-xs text-slate-400">
        还不确定？先看看<RouterLink to="/guides" class="font-semibold text-brand-600 hover:underline">教程中心</RouterLink>或<RouterLink to="/templates" class="font-semibold text-brand-600 hover:underline">模板库</RouterLink>
      </p>
    </div>
  </div>
</template>
