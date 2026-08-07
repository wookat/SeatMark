<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import NotFoundView from '@/views/NotFoundView.vue'
import { findGuide, guides } from '@/data/guides'

const route = useRoute()
const router = useRouter()

const guide = computed(() => findGuide(String(route.params.slug ?? '')))

const relatedGuides = computed(() =>
  (guide.value?.related ?? [])
    .map((slug) => guides.find((g) => g.slug === slug))
    .filter((g) => !!g),
)

/** 正文内链走 SPA 导航，避免整页刷新 */
function onArticleClick(event: MouseEvent) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return
  }
  const anchor = (event.target as HTMLElement).closest('a')
  if (!anchor) return
  const href = anchor.getAttribute('href')
  if (href?.startsWith('/')) {
    event.preventDefault()
    void router.push(href)
  }
}
</script>

<template>
  <div v-if="guide" class="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
    <!-- 面包屑 -->
    <nav class="flex flex-wrap items-center gap-1.5 text-xs text-slate-600" aria-label="面包屑">
      <RouterLink to="/" class="hover:text-brand-600">首页</RouterLink>
      <span>/</span>
      <RouterLink to="/guides" class="hover:text-brand-600">教程中心</RouterLink>
      <span>/</span>
      <span class="line-clamp-1 text-slate-600" aria-current="page">{{ guide.title }}</span>
    </nav>

    <header class="mt-4">
      <h1 class="text-2xl leading-snug font-bold tracking-tight text-slate-900 sm:text-3xl">
        {{ guide.title }}
      </h1>
      <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
        <span class="rounded-md bg-brand-50 px-2 py-0.5 font-bold text-brand-600">
          {{ guide.category }}
        </span>
        <span>更新于 {{ guide.dateModified }}</span>
        <span>约 {{ guide.readingMinutes }} 分钟读完</span>
      </div>
      <p class="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        {{ guide.description }}
      </p>
    </header>

    <!-- 高意向词一键开始：3 秒内给出直达工坊入口（预选模板 + 演示数据） -->
    <div
      v-if="guide.quickStart"
      class="mt-6 flex flex-col items-start justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50/70 p-4 sm:flex-row sm:items-center"
    >
      <div class="flex items-start gap-3">
        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 ring-1 ring-brand-200">
          <svg
            class="size-4.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M13 3 4 14h6l-1 7 9-11h-6l1-7z" />
          </svg>
        </span>
        <div>
          <p class="text-sm font-bold text-slate-900">不想读长文？直接上手试试</p>
          <p v-if="guide.quickStart.note" class="mt-0.5 text-xs leading-5 text-slate-600">
            {{ guide.quickStart.note }}
          </p>
        </div>
      </div>
      <RouterLink
        :to="guide.quickStart.to"
        class="btn btn-primary btn-md w-full shrink-0 sm:w-auto"
      >
        {{ guide.quickStart.label }}
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

    <!-- 正文（站内维护的受控 HTML） -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <article class="article-body mt-8" @click="onArticleClick" v-html="guide.body"></article>

    <!-- FAQ -->
    <section v-if="guide.faqs.length" class="mt-10">
      <h2 class="text-xl font-bold tracking-tight text-slate-900">常见问答</h2>
      <div class="mt-4 grid gap-3">
        <div
          v-for="faq in guide.faqs"
          :key="faq.q"
          class="rounded-lg border border-slate-200 bg-white p-4"
        >
          <h3 class="text-sm font-bold text-slate-900">{{ faq.q }}</h3>
          <p class="mt-1.5 text-sm leading-6 text-slate-600">{{ faq.a }}</p>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <div
      class="mt-10 flex flex-col items-center justify-between gap-4 rounded-lg bg-brand-700 px-6 py-6 text-center sm:flex-row sm:text-left"
    >
      <div>
        <h2 class="text-base font-bold text-white">在标签工坊中实践本教程</h2>
        <p class="mt-1 text-sm text-brand-100">免费、无需注册，名单不出浏览器。</p>
      </div>
      <RouterLink
        to="/studio"
        class="btn btn-md w-full shrink-0 bg-white text-brand-700 hover:bg-brand-50 sm:w-auto"
      >
        进入标签工坊
      </RouterLink>
    </div>

    <!-- 相关文章 -->
    <section v-if="relatedGuides.length" class="mt-10">
      <h2 class="text-base font-bold text-slate-900">相关阅读</h2>
      <div class="mt-3 grid gap-3 sm:grid-cols-3">
        <RouterLink
          v-for="rel in relatedGuides"
          :key="rel!.slug"
          :to="`/guides/${rel!.slug}`"
          class="group rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-brand-300"
        >
          <p class="text-[11px] font-bold text-brand-600">{{ rel!.category }}</p>
          <h3 class="mt-1 line-clamp-2 text-xs leading-5 font-bold text-slate-700 group-hover:text-brand-600">
            {{ rel!.title }}
          </h3>
        </RouterLink>
      </div>
    </section>
  </div>
  <NotFoundView v-else />
</template>
