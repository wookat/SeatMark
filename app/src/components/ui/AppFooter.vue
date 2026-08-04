<script setup lang="ts">
import { guides } from '@/data/guides'

const NAV_GROUPS = [
  {
    title: '产品',
    links: [
      { label: '标签工坊', to: '/studio' },
      { label: '模板库', to: '/templates' },
      { label: '定价（Beta 免费）', to: '/pricing' },
    ],
  },
  {
    title: '教程',
    links: [
      { label: '教程中心', to: '/guides' },
      ...guides.slice(0, 4).map((g) => ({ label: g.title, to: `/guides/${g.slug}` })),
    ],
  },
]
</script>

<template>
  <footer class="no-print border-t border-slate-200 bg-white">
    <div class="mx-auto w-full max-w-6xl px-4 py-8">
      <div class="grid gap-8 sm:grid-cols-[1.2fr_1fr_1.4fr]">
        <div>
          <p class="text-sm font-bold text-slate-800">SeatMark 座签</p>
          <p class="mt-1.5 text-xs leading-5 text-slate-500">
            座签 · 桌牌席卡 · 门贴证卡批量生成工具。上传 Excel
            名单，批量生成毫米级精确排版的标签打印页。
          </p>
          <div class="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <svg
              class="size-3.5 shrink-0 text-emerald-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3z" />
            </svg>
            <span>所有数据仅在浏览器本地处理，不会上传服务器</span>
          </div>
        </div>

        <nav
          v-for="group in NAV_GROUPS"
          :key="group.title"
          :aria-label="group.title"
          class="text-xs"
        >
          <p class="font-bold text-slate-700">{{ group.title }}</p>
          <ul class="mt-2.5 flex flex-col gap-2">
            <li v-for="link in group.links" :key="link.to">
              <RouterLink
                :to="link.to"
                class="line-clamp-1 text-slate-500 transition-colors hover:text-brand-600"
              >
                {{ link.label }}
              </RouterLink>
            </li>
          </ul>
        </nav>
      </div>

      <div
        class="mt-8 flex flex-col items-center justify-between gap-2 border-t border-slate-100 pt-5 text-xs text-slate-400 sm:flex-row"
      >
        <a
          href="https://beian.miit.gov.cn"
          target="_blank"
          rel="noopener noreferrer"
          class="transition-colors hover:text-slate-600"
        >
          湘ICP备2026009844号
        </a>
        <span>© 2026 SeatMark. All rights reserved.</span>
      </div>
    </div>
  </footer>
</template>
