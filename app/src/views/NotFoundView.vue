<script setup lang="ts">
import { guides } from '@/data/guides'
import { localePath, t, useI18n } from '@/i18n'

const { locale } = useI18n()

/** 404 页推荐入口：热门教程前 3 篇，避免流量直接流失（教程仅有中文正文，英文壳下不展示） */
const recommendedGuides = guides.slice(0, 3)
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-4 py-16 text-center sm:py-24">
    <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">404 Not Found</p>
    <h1 class="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
      {{ t('页面不存在或已被移动') }}
    </h1>
    <p class="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-600">
      {{ t('你访问的地址没有对应的页面。可能是链接拼写有误，或该内容已经调整位置。 下面是一些常用入口，或直接进入标签工坊开始制作。') }}
    </p>

    <div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
      <RouterLink :to="localePath('/')" class="btn btn-secondary btn-md w-full sm:w-auto">{{ t('返回首页') }}</RouterLink>
      <RouterLink :to="localePath('/studio')" class="btn btn-primary btn-md w-full sm:w-auto">
        {{ t('进入标签工坊') }}
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
    </div>

    <div class="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-bold text-brand-600">
      <RouterLink :to="localePath('/templates')" class="hover:underline">{{ t('标签模板库') }}</RouterLink>
      <RouterLink :to="localePath('/guides')" class="hover:underline">{{ t('教程中心') }}</RouterLink>
      <RouterLink :to="localePath('/pricing')" class="hover:underline">{{ t('定价说明') }}</RouterLink>
    </div>

    <section v-if="locale !== 'en'" class="mt-12 text-left">
      <h2 class="text-center text-sm font-bold text-slate-600">也许你在找这些教程</h2>
      <div class="mt-4 grid gap-3 sm:grid-cols-3">
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
    </section>
  </div>
</template>
