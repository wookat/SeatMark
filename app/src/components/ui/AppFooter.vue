<script setup lang="ts">
import { footerGuideLinks } from '@/data/guideLinks'
import BeianInfo from '@/components/ui/BeianInfo.vue'
import BrandMark from '@/components/ui/BrandMark.vue'

const GROUPS = [
  {
    title: '产品',
    links: [
      { label: '标签工坊', to: '/studio' },
      { label: '模板库', to: '/templates' },
      { label: '定价（Beta 限时免费试用）', to: '/pricing' },
      { label: '教室座位表打印', to: '/seating' },
      { label: '不干胶纸型库', to: '/papers' },
      { label: '模板设计器', to: '/studio?design=new' },
      { label: '演示数据体验', to: '/studio?demo=1' },
    ],
  },
  {
    title: '教程',
    links: [
      { label: '教程中心', to: '/guides' },
      ...footerGuideLinks,
    ],
  },
  {
    title: '资源',
    links: [
      { label: '使用流程', to: '/#how' },
      { label: '功能特性', to: '/#features' },
      { label: '常见问题', to: '/#faq' },
      { label: '用户协议', to: '/terms' },
      { label: '隐私政策', to: '/privacy' },
    ],
  },
]
</script>

<template>
  <footer class="no-print border-t border-slate-200 bg-white">
    <div class="mx-auto w-full max-w-6xl px-4 py-10">
      <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div class="flex items-center gap-2.5">
            <BrandMark class="size-8 shrink-0 text-brand-600" />
            <span class="text-base font-bold tracking-tight text-slate-900">
              SeatMark <span class="text-brand-600">座签</span>
            </span>
          </div>
          <p class="mt-3 max-w-xs text-xs leading-5 text-slate-500">
            考场座签、桌牌席卡、门贴证卡在线批量生成工具。上传 Excel
            名单即可输出毫米级精确排版的打印页。
          </p>
          <p
            class="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200"
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
            所有数据仅在浏览器本地处理
          </p>
        </div>

        <div v-for="group in GROUPS" :key="group.title">
          <h3 class="text-xs font-bold tracking-wide text-slate-900">{{ group.title }}</h3>
          <ul class="mt-3 space-y-2">
            <li v-for="link in group.links" :key="link.label">
              <RouterLink
                :to="link.to"
                class="line-clamp-1 text-xs text-slate-500 transition-colors hover:text-brand-600"
              >
                {{ link.label }}
              </RouterLink>
            </li>
          </ul>
        </div>
      </div>

      <div
        class="mt-9 flex flex-col items-center justify-between gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400 sm:flex-row"
      >
        <span>© 2026 SeatMark 座签 · 版权所有</span>
        <BeianInfo />
      </div>
    </div>
  </footer>
</template>
