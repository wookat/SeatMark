<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import NotFoundView from '@/views/NotFoundView.vue'
import { findTopicPage } from '@/data/topicPages'

const route = useRoute()
const page = computed(() => findTopicPage(route.path))
</script>

<template>
  <div v-if="page" class="mx-auto w-full max-w-4xl px-4 py-10 sm:py-14">
    <!-- 首屏：直达生成器 -->
    <header class="text-center">
      <h1 class="text-3xl leading-tight font-bold tracking-tight text-slate-900 sm:text-4xl">
        {{ page.heading }}
      </h1>
      <p class="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-600">
        {{ page.subheading }}
      </p>
      <div class="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <RouterLink :to="page.cta.to" class="btn btn-primary btn-md w-full sm:w-auto">
          {{ page.cta.label }}
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
        <RouterLink
          :to="page.secondaryCta.to"
          class="btn btn-md w-full border border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-600 sm:w-auto"
        >
          {{ page.secondaryCta.label }}
        </RouterLink>
      </div>
      <p class="mt-3 text-xs text-slate-500">免费 · 免登录 · 名单不出浏览器</p>
    </header>

    <!-- 三步用法 -->
    <section class="mt-12">
      <h2 class="text-center text-xl font-bold tracking-tight text-slate-900">三步完成</h2>
      <div class="mt-5 grid gap-4 sm:grid-cols-3">
        <div
          v-for="(step, i) in page.steps"
          :key="step.name"
          class="rounded-lg border border-slate-200 bg-white p-5 shadow-card"
        >
          <span
            class="flex size-8 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-600 ring-1 ring-brand-200"
          >
            {{ i + 1 }}
          </span>
          <h3 class="mt-3 text-sm font-bold text-slate-900">{{ step.name }}</h3>
          <p class="mt-1.5 text-xs leading-5 text-slate-600">{{ step.text }}</p>
        </div>
      </div>
    </section>

    <!-- 能力要点 -->
    <section class="mt-12">
      <h2 class="text-center text-xl font-bold tracking-tight text-slate-900">为什么用 SeatMark</h2>
      <div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="f in page.features"
          :key="f.title"
          class="rounded-lg border border-slate-200 bg-white p-4"
        >
          <h3 class="text-sm font-bold text-slate-900">{{ f.title }}</h3>
          <p class="mt-1.5 text-xs leading-5 text-slate-600">{{ f.text }}</p>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section class="mt-12">
      <h2 class="text-center text-xl font-bold tracking-tight text-slate-900">常见问答</h2>
      <div class="mt-5 grid gap-3">
        <div
          v-for="faq in page.faqs"
          :key="faq.q"
          class="rounded-lg border border-slate-200 bg-white p-4"
        >
          <h3 class="text-sm font-bold text-slate-900">{{ faq.q }}</h3>
          <p class="mt-1.5 text-sm leading-6 text-slate-600">{{ faq.a }}</p>
        </div>
      </div>
    </section>

    <!-- 尾部 CTA -->
    <div
      class="mt-12 flex flex-col items-center justify-between gap-4 rounded-lg bg-brand-700 px-6 py-6 text-center sm:flex-row sm:text-left"
    >
      <div>
        <h2 class="text-base font-bold text-white">现在就把名单变成打印页</h2>
        <p class="mt-1 text-sm text-brand-100">免费、免登录，几秒出结果。</p>
      </div>
      <RouterLink
        :to="page.cta.to"
        class="btn btn-md w-full shrink-0 bg-white text-brand-700 hover:bg-brand-50 sm:w-auto"
      >
        {{ page.cta.label }}
      </RouterLink>
    </div>

    <!-- 相关内链 -->
    <section class="mt-10">
      <h2 class="text-base font-bold text-slate-900">相关模板与教程</h2>
      <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <RouterLink
          v-for="rel in page.relatedLinks"
          :key="rel.to"
          :to="rel.to"
          class="group rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-brand-300"
        >
          <h3 class="line-clamp-2 text-xs leading-5 font-bold text-slate-700 group-hover:text-brand-600">
            {{ rel.label }}
          </h3>
        </RouterLink>
      </div>
    </section>
  </div>
  <NotFoundView v-else />
</template>
