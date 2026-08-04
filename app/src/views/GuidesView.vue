<script setup lang="ts">
import { guides } from '@/data/guides'
</script>

<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
    <div class="text-center">
      <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Guides</p>
      <h1 class="mt-1 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">教程中心</h1>
      <p class="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">
        座签、桌牌、席位卡、证卡的制作与打印实战教程：从 Excel 名单整理、模板选择到打印裁切，
        问答式讲解常见坑点，看完即可上手。
      </p>
    </div>

    <div class="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <RouterLink
        v-for="guide in guides"
        :key="guide.slug"
        :to="`/guides/${guide.slug}`"
        class="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg"
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
      class="mt-12 flex flex-col items-center justify-between gap-4 rounded-2xl border border-brand-200 bg-brand-50/60 px-6 py-6 text-center sm:flex-row sm:text-left"
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
