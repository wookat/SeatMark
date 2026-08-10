<script setup lang="ts">
import { vsPages } from '@/data/vsPages'
</script>

<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
    <div class="text-center">
      <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Compare</p>
      <h1 class="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        工具对比：SeatMark 与常见桌牌席卡做法
      </h1>
      <p class="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        基于我们对各工具的实际上手记录，逐项对照名单批量生成、打印拼版、校准精度、隐私与价格，
        帮你按自己的场景选对工具。措辞如实客观，对方领先项照写。
      </p>
    </div>

    <div class="mt-10 grid gap-5 sm:grid-cols-2">
      <RouterLink
        v-for="page in vsPages"
        :key="page.slug"
        :to="`/vs/${page.slug}`"
        class="group flex flex-col rounded-lg border border-slate-200 bg-white p-6 shadow-card transition-shadow hover:shadow-lg"
      >
        <h2 class="text-base font-bold text-slate-900 group-hover:text-brand-600">
          SeatMark vs {{ page.competitorName }}
        </h2>
        <p class="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">{{ page.intro }}</p>
        <span class="mt-4 inline-flex items-center gap-1 text-xs font-bold text-brand-600">
          查看逐项对比
          <svg
            class="size-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M5 12h14m-6-6 6 6-6 6" />
          </svg>
        </span>
      </RouterLink>
    </div>

    <div class="mt-12 rounded-lg border border-brand-100 bg-brand-50/60 p-6 text-center">
      <h2 class="text-base font-bold text-slate-900">不想逐篇看？直接上手试试</h2>
      <p class="mx-auto mt-2 max-w-xl text-xs leading-5 text-slate-600">
        免费、免登录，上传 Excel 名单即可批量生成桌牌、座签与席卡，名单全程不出浏览器。
      </p>
      <RouterLink to="/studio" class="btn btn-primary btn-md mt-4">打开标签工坊</RouterLink>
    </div>
  </div>
</template>
