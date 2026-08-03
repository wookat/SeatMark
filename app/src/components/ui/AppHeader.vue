<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

/** 落地页锚点导航：仅首页展示 */
const SECTIONS = [
  { href: '#templates', label: '模板' },
  { href: '#features', label: '功能' },
  { href: '#how', label: '使用流程' },
  { href: '#faq', label: '常见问题' },
]
</script>

<template>
  <header
    class="no-print sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-md"
  >
    <div class="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
      <RouterLink to="/" class="group flex min-w-0 items-center gap-2.5">
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm ring-1 ring-brand-800/20 transition-transform duration-150 group-hover:scale-105"
        >
          <svg class="size-4.5" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="4" width="7" height="7" rx="1.2" fill="currentColor" />
            <rect
              x="13.5"
              y="4"
              width="6.5"
              height="7"
              rx="1.2"
              stroke="currentColor"
              stroke-width="1.6"
            />
            <rect
              x="4"
              y="13.5"
              width="7"
              height="6.5"
              rx="1.2"
              stroke="currentColor"
              stroke-width="1.6"
            />
            <rect
              x="13.5"
              y="13.5"
              width="6.5"
              height="6.5"
              rx="1.2"
              stroke="currentColor"
              stroke-width="1.6"
            />
          </svg>
        </span>
        <span class="truncate text-base font-bold tracking-tight text-slate-900">
          SeatMark <span class="text-brand-600">座签</span>
        </span>
      </RouterLink>

      <nav
        v-if="route.name === 'home'"
        class="ml-4 hidden items-center gap-1 lg:flex"
        aria-label="页面导航"
      >
        <a
          v-for="section in SECTIONS"
          :key="section.href"
          :href="section.href"
          class="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          {{ section.label }}
        </a>
      </nav>

      <nav class="ml-auto flex shrink-0 items-center gap-1.5">
        <span
          class="hidden items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200 md:inline-flex"
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
          数据不出浏览器
        </span>
        <RouterLink
          to="/"
          class="btn btn-ghost btn-sm"
          :class="{ 'bg-slate-100 text-brand-600': route.name === 'home' }"
        >
          首页
        </RouterLink>
        <RouterLink
          to="/studio"
          class="btn btn-sm"
          :class="route.name === 'studio' ? 'btn-secondary text-brand-600' : 'btn-primary'"
        >
          {{ route.name === 'studio' ? '正在制作中' : '开始制作' }}
        </RouterLink>
      </nav>
    </div>
  </header>
</template>
