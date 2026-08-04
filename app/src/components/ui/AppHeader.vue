<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <header
    class="no-print sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur"
  >
    <div class="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
      <RouterLink to="/" class="group flex items-center gap-2.5">
        <span
          class="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm transition-transform duration-150 group-hover:scale-105"
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
        <span class="text-base font-bold tracking-tight text-slate-900">
          SeatMark <span class="text-brand-600">座签</span>
        </span>
        <span class="hidden text-xs text-slate-400 sm:inline">座签 · 桌牌席卡 · 门贴证卡批量生成</span>
      </RouterLink>

      <nav class="flex items-center gap-1.5">
        <RouterLink
          to="/"
          class="btn btn-ghost btn-sm hidden sm:inline-flex"
          :class="{ 'bg-slate-100 text-brand-600': route.name === 'home' }"
        >
          首页
        </RouterLink>
        <RouterLink
          to="/templates"
          class="btn btn-ghost btn-sm"
          :class="{
            'bg-slate-100 text-brand-600':
              route.name === 'templates' || route.name === 'template-detail',
          }"
        >
          模板
        </RouterLink>
        <RouterLink
          to="/guides"
          class="btn btn-ghost btn-sm"
          :class="{
            'bg-slate-100 text-brand-600':
              route.name === 'guides' || route.name === 'guide-article',
          }"
        >
          教程
        </RouterLink>
        <RouterLink
          to="/pricing"
          class="btn btn-ghost btn-sm hidden sm:inline-flex"
          :class="{ 'bg-slate-100 text-brand-600': route.name === 'pricing' }"
        >
          定价
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
