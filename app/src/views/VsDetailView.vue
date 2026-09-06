<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import ChineseOnlyNotice from '@/components/ChineseOnlyNotice.vue'
import NotFoundView from '@/views/NotFoundView.vue'
import { findVsPage, SEATMARK_HIGHLIGHTS } from '@/data/vsPages'

const route = useRoute()
const page = computed(() => findVsPage(String(route.params.slug ?? '')))
</script>

<template>
  <div v-if="page" class="mx-auto w-full max-w-4xl px-4 py-10 sm:py-14">
    <ChineseOnlyNotice />
    <!-- 面包屑 -->
    <nav class="flex flex-wrap items-center gap-1.5 text-xs text-slate-600" aria-label="面包屑">
      <RouterLink to="/" class="hover:text-brand-600">首页</RouterLink>
      <span>/</span>
      <RouterLink to="/vs" class="hover:text-brand-600">工具对比</RouterLink>
      <span>/</span>
      <span class="line-clamp-1" aria-current="page">vs {{ page.competitorName }}</span>
    </nav>

    <header class="mt-4">
      <h1 class="text-2xl leading-snug font-bold tracking-tight text-slate-900 sm:text-3xl">
        {{ page.heading }}
      </h1>
      <p class="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        {{ page.intro }}
      </p>
    </header>

    <!-- 对方长处（如实致意） -->
    <section class="mt-8">
      <h2 class="text-lg font-bold tracking-tight text-slate-900">{{ page.competitorName }} 的长处</h2>
      <ul class="mt-3 space-y-2">
        <li
          v-for="s in page.competitorStrengths"
          :key="s"
          class="flex items-start gap-2 text-sm leading-6 text-slate-600"
        >
          <span class="mt-2 size-1.5 shrink-0 rounded-full bg-slate-400"></span>
          {{ s }}
        </li>
      </ul>
    </section>

    <!-- 能力对照表 -->
    <section class="mt-8">
      <h2 class="text-lg font-bold tracking-tight text-slate-900">逐项能力对照</h2>
      <p class="mt-2 text-[11px] leading-5 text-slate-400 sm:hidden">← 左右滑动查看完整对照表 →</p>
      <div class="mt-3 overflow-x-auto rounded-lg border border-slate-200">
        <table class="w-full min-w-[560px] border-collapse bg-white text-left text-sm">
          <thead>
            <tr class="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
              <th scope="col" class="px-4 py-3 font-bold">维度</th>
              <th scope="col" class="px-4 py-3 font-bold">{{ page.competitorName }}</th>
              <th scope="col" class="px-4 py-3 font-bold text-brand-700">SeatMark 座签</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="d in page.dimensions"
              :key="d.dimension"
              class="border-b border-slate-100 last:border-b-0"
            >
              <th scope="row" class="w-32 px-4 py-3 align-top text-xs font-bold text-slate-900">
                {{ d.dimension }}
              </th>
              <td class="px-4 py-3 align-top text-xs leading-5 text-slate-600">{{ d.competitor }}</td>
              <td class="px-4 py-3 align-top text-xs leading-5 font-semibold text-slate-700">
                {{ d.seatmark }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="mt-2 text-[11px] leading-5 text-slate-500">
        以上为我们 {{ page.researchDate }} 的实际上手/公开页面调研结论，双方产品均会持续迭代，
        {{ page.competitorName }} 的最新功能与价格以其官方渠道为准。
      </p>
    </section>

    <!-- SeatMark 差异化亮点 -->
    <section class="mt-10">
      <h2 class="text-lg font-bold tracking-tight text-slate-900">SeatMark 的差异化亮点</h2>
      <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="h in SEATMARK_HIGHLIGHTS"
          :key="h.title"
          class="rounded-lg border border-slate-200 bg-white p-4"
        >
          <h3 class="text-sm font-bold text-slate-900">{{ h.title }}</h3>
          <p class="mt-1.5 text-xs leading-5 text-slate-600">{{ h.text }}</p>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section class="mt-10">
      <h2 class="text-lg font-bold tracking-tight text-slate-900">常见问答</h2>
      <div class="mt-4 grid gap-3">
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

    <!-- CTA -->
    <div
      class="mt-10 flex flex-col items-center justify-between gap-4 rounded-lg bg-brand-700 px-6 py-6 text-center sm:flex-row sm:text-left"
    >
      <div>
        <h2 class="text-base font-bold text-white">亲自对比一下最直观</h2>
        <p class="mt-1 text-sm text-brand-100">免费、免登录，上传名单即生成打印页，名单不出浏览器。</p>
      </div>
      <RouterLink
        to="/studio"
        class="btn btn-md w-full shrink-0 bg-white text-brand-700 hover:bg-brand-50 sm:w-auto"
      >
        打开标签工坊试试
      </RouterLink>
    </div>

    <!-- 相关教程 -->
    <section class="mt-10">
      <h2 class="text-base font-bold text-slate-900">相关教程</h2>
      <div class="mt-3 grid gap-3 sm:grid-cols-3">
        <RouterLink
          v-for="rel in page.relatedGuides"
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
