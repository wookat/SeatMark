<script setup lang="ts">
/**
 * 产品介绍页 /about：产品定位、能力、场景、隐私口径、收费与联系方式。
 * 中英双语正文（locale 分支），均可索引、互挂 hreflang。
 */
import { computed } from 'vue'

import BrandMark from '@/components/ui/BrandMark.vue'
import { localePath, useI18n } from '@/i18n'

const { locale } = useI18n()
const isEn = computed(() => locale.value === 'en')

const CAPABILITIES = computed(() =>
  isEn.value
    ? [
        { icon: 'M4 5h16v14H4z M4 9h16 M9 9v10', title: 'Roster to print layout', desc: 'Upload an Excel file, paste a list, or type names directly in the editor — SeatMark maps columns to label fields and lays them out at real mm sizes.' },
        { icon: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z', title: '226 built-in templates', desc: 'Seat labels, table tents, door signs, badges and ID cards — all customizable in the template designer.' },
        { icon: 'M3 8l9-5 9 5-9 5-9-5z M3 8v8l9 5 9-5V8', title: 'Paper-accurate imposition', desc: 'A4 / A5 / A3 sheets with rows, columns, margins and cut marks computed from the physical label size. Print at 100% scale for exact alignment.' },
        { icon: 'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', title: 'Seating chart tools', desc: 'Classroom seating and banquet table planners that carry the same roster into printable charts and matching labels.' },
        { icon: 'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M18.4 5.6l-2.1 2.1 M7.7 16.3l-2.1 2.1', title: 'AI-assisted design', desc: 'Describe the style you want and let the AI draft a template — site-hosted models need no API key, custom OpenAI-compatible endpoints are supported.' },
        { icon: 'M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3z', title: 'Local-first privacy', desc: 'Rosters, photos and layouts are processed entirely in your browser and never uploaded. Optional features (account, AI, payment) are clearly separated.' },
      ]
    : [
        { icon: 'M4 5h16v14H4z M4 9h16 M9 9v10', title: '名单到打印排版', desc: '上传 Excel、粘贴名单或在编辑器里直接录入——自动把列映射到标签字段，按实际毫米尺寸排版。' },
        { icon: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z', title: '226 款内置模板', desc: '考场座签、会议桌牌、门贴门牌、证卡胸卡全部覆盖，模板设计器可继续自定义。' },
        { icon: 'M3 8l9-5 9 5-9 5-9-5z M3 8v8l9 5 9-5V8', title: '按纸张实际尺寸排版', desc: 'A4 / A5 / A3 纸型按标签物理尺寸计算行列、边距与裁切参考线，100% 缩放打印不偏位。' },
        { icon: 'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', title: '排座工具', desc: '教室座位表与宴会排桌工具：同一份名单既生成可打印的座位图，也直接产出配套桌签。' },
        { icon: 'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M18.4 5.6l-2.1 2.1 M7.7 16.3l-2.1 2.1', title: 'AI 辅助设计', desc: '描述想要的风格即可让 AI 起草模板——站点托管模型开箱即用，也支持自定义 OpenAI 兼容接口。' },
        { icon: 'M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3z', title: '数据本地处理', desc: '名单、照片、排版全部在浏览器内完成，不上传服务器；账号、AI、付费等可选功能边界清晰。' },
      ],
)

const SCENARIOS = computed(() =>
  isEn.value
    ? ['Exam halls: seat labels with ID numbers', 'Meetings & lectures: table tents and podiums', 'Weddings & banquets: place cards and table plans', 'Offices & schools: badges, door signs and locker labels']
    : ['考务场景：带考号考场座签', '会议讲座：会议桌牌与主席台桌牌', '婚宴庆典：席位卡与整桌排座', '办公校园：工作证、门牌与柜贴'],
)
</script>

<template>
  <div class="mx-auto w-full max-w-4xl px-4 py-10 sm:py-14" :lang="isEn ? 'en' : undefined" data-testid="about-view">
    <!-- 头部 -->
    <div class="flex items-center gap-3">
      <BrandMark class="size-10 shrink-0 text-brand-600" />
      <div>
        <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">{{ isEn ? 'About SeatMark' : '关于 SeatMark 座签' }}</p>
        <h1 class="mt-0.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {{ isEn ? 'Batch label printing that runs in your browser' : '在浏览器里批量生成可打印的座签与证卡' }}
        </h1>
      </div>
    </div>
    <p class="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
      {{
        isEn
          ? 'SeatMark turns a name list into print-ready seat labels, table tents, door signs and badges. Everything from spreadsheet parsing to PDF export happens locally on your device — fast, private, and accurate to the millimetre.'
          : 'SeatMark 座签把一份名单变成可直接打印的座签、桌牌席卡、门贴与证卡。从 Excel 解析到 PDF 导出全部在你自己的设备上完成——快、私密，且精确到毫米。'
      }}
    </p>
    <div class="mt-5 flex flex-wrap gap-2">
      <RouterLink :to="localePath('/studio')" class="btn btn-primary">
        {{ isEn ? 'Start making labels' : '开始制作标签' }}
      </RouterLink>
      <RouterLink :to="localePath('/templates')" class="btn btn-secondary">
        {{ isEn ? 'Browse templates' : '浏览模板库' }}
      </RouterLink>
    </div>

    <!-- 核心能力 -->
    <h2 class="mt-12 text-lg font-bold text-slate-900">{{ isEn ? 'What it does' : '产品能力' }}</h2>
    <div class="mt-4 grid gap-4 sm:grid-cols-2">
      <div
        v-for="cap in CAPABILITIES"
        :key="cap.title"
        class="rounded-xl border border-slate-200 bg-white p-4"
      >
        <span class="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="cap.icon" /></svg>
        </span>
        <h3 class="mt-2.5 text-sm font-bold text-slate-900">{{ cap.title }}</h3>
        <p class="mt-1 text-xs leading-5.5 text-slate-600">{{ cap.desc }}</p>
      </div>
    </div>

    <!-- 适用场景 -->
    <h2 class="mt-10 text-lg font-bold text-slate-900">{{ isEn ? 'Where it fits' : '适用场景' }}</h2>
    <ul class="mt-3 grid gap-2 sm:grid-cols-2">
      <li v-for="s in SCENARIOS" :key="s" class="flex items-center gap-2 text-sm text-slate-700">
        <svg class="size-4 shrink-0 text-emerald-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3.5 8.5 3 3 6-7" /></svg>
        {{ s }}
      </li>
    </ul>

    <!-- 收费与隐私 -->
    <div class="mt-10 grid gap-4 sm:grid-cols-2">
      <div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <h2 class="text-sm font-bold text-slate-900">{{ isEn ? 'Pricing' : '收费模式' }}</h2>
        <p class="mt-1.5 text-xs leading-5.5 text-slate-600">
          {{
            isEn
              ? 'Core generation and printing are free. A Pro plan raises export quotas and unlocks higher AI design limits — see pricing for current terms.'
              : '核心生成与打印免费；专业版提升导出水印配额与 AI 设计额度。详见定价页当前说明。'
          }}
        </p>
        <RouterLink :to="localePath('/pricing')" class="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700">
          {{ isEn ? 'View pricing' : '查看定价' }} <span aria-hidden="true">→</span>
        </RouterLink>
      </div>
      <div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <h2 class="text-sm font-bold text-slate-900">{{ isEn ? 'Privacy' : '隐私与数据' }}</h2>
        <p class="mt-1.5 text-xs leading-5.5 text-slate-600">
          {{
            isEn
              ? 'Your roster and photos never leave the browser — close the tab and they are gone. The privacy policy documents the exact request boundary.'
              : '名单与照片只在浏览器本地处理，关掉页面即清空。隐私政策写明了具体的服务端请求边界。'
          }}
        </p>
        <RouterLink :to="localePath('/privacy')" class="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700">
          {{ isEn ? 'Privacy policy' : '隐私政策' }} <span aria-hidden="true">→</span>
        </RouterLink>
      </div>
    </div>

    <!-- 联系我们 -->
    <div class="mt-10 rounded-xl border border-brand-100 bg-brand-50/60 p-5">
      <h2 class="text-sm font-bold text-slate-900">{{ isEn ? 'Contact us' : '联系我们' }}</h2>
      <p class="mt-1.5 text-xs leading-5.5 text-slate-600">
        {{ isEn ? 'Questions, template requests or business cooperation — reach us any time.' : '使用问题、模板需求或商务合作，欢迎随时联系。' }}
      </p>
      <div class="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <a href="mailto:wookat@qq.com" class="flex items-center gap-1.5 font-semibold text-slate-700 transition-colors hover:text-brand-600">
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
          wookat@qq.com
        </a>
        <span class="flex items-center gap-1.5 font-semibold text-slate-700">
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
          {{ isEn ? 'WeChat' : '微信' }}：HERUOZAI
        </span>
      </div>
    </div>
  </div>
</template>
