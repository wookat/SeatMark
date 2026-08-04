<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { findGuide, guides } from '@/data/guides'

const route = useRoute()
const router = useRouter()

const guide = computed(() => findGuide(String(route.params.slug ?? '')))

// slug 无效时回教程列表（客户端导航场景）
watch(
  guide,
  (g) => {
    if (!g && typeof window !== 'undefined') void router.replace('/guides')
  },
  { immediate: true },
)

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
    <nav class="flex flex-wrap items-center gap-1.5 text-xs text-slate-400" aria-label="面包屑">
      <RouterLink to="/" class="hover:text-brand-600">首页</RouterLink>
      <span>/</span>
      <RouterLink to="/guides" class="hover:text-brand-600">教程中心</RouterLink>
      <span>/</span>
      <span class="text-slate-500">{{ guide.category }}</span>
    </nav>

    <header class="mt-4">
      <h1 class="text-2xl leading-snug font-bold tracking-tight text-slate-900 sm:text-3xl">
        {{ guide.title }}
      </h1>
      <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
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
          <p class="mt-1.5 text-sm leading-6 text-slate-500">{{ faq.a }}</p>
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
      <h2 class="text-base font-bold text-slate-900">相关教程</h2>
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
</template>
