<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import TemplateThumb from '@/components/label/TemplateThumb.vue'
import { defaultTemplates } from '@/data/defaultTemplates'
import { findLabelPaper, LABEL_PAPER_SHEET, labelPapers } from '@/data/labelPapers'
import { findTemplateDetail } from '@/data/templateDetails'
import { labelPaperGeometry } from '@/utils/labelPaper'
import NotFoundView from '@/views/NotFoundView.vue'

const route = useRoute()

const slug = computed(() => String(route.params.slug ?? ''))
const paper = computed(() => findLabelPaper(slug.value))
const geo = computed(() => (paper.value ? labelPaperGeometry(paper.value) : null))

const recommended = computed(() =>
  (paper.value?.recommendedTemplates ?? [])
    .map((id) => ({
      detail: findTemplateDetail(id),
      template: defaultTemplates.find((t) => t.id === id),
    }))
    .filter((x) => x.detail && x.template),
)

const others = computed(() => labelPapers.filter((p) => p.slug !== slug.value).slice(0, 4))

/** SVG 版式示意的每格坐标（mm） */
const cellRects = computed(() => {
  const p = paper.value
  const g = geo.value
  if (!p || !g) return []
  const out: { x: number; y: number }[] = []
  for (let r = 0; r < p.rows; r++) {
    for (let c = 0; c < p.cols; c++) {
      out.push({
        x: g.marginX + c * (p.labelWidth + p.gapX),
        y: g.marginY + r * (p.labelHeight + p.gapY),
      })
    }
  }
  return out
})

const specRows = computed(() => {
  const p = paper.value
  const g = geo.value
  if (!p || !g) return []
  return [
    { name: '整张纸', value: `A4（${LABEL_PAPER_SHEET.width} × ${LABEL_PAPER_SHEET.height} mm）` },
    { name: '单枚标签', value: `${p.labelWidth} × ${p.labelHeight} mm` },
    { name: '排列', value: `${p.cols} 列 × ${p.rows} 行，每页 ${g.perPage} 枚` },
    { name: '标签间距', value: `横向 ${p.gapX} mm · 纵向 ${p.gapY} mm` },
    { name: '页边距', value: `左右 ${g.marginX} mm · 上下 ${g.marginY} mm` },
    {
      name: '切角',
      value: p.corner === 'rounded' ? `圆角（半径约 ${p.cornerRadius ?? 2} mm）` : '直角满切',
    },
  ]
})
</script>

<template>
  <NotFoundView v-if="!paper || !geo" />
  <div v-else class="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
    <nav class="flex flex-wrap items-center gap-1.5 text-xs text-slate-600" aria-label="面包屑">
      <RouterLink to="/" class="hover:text-brand-600">首页</RouterLink>
      <span>/</span>
      <RouterLink to="/papers" class="hover:text-brand-600">纸型库</RouterLink>
      <span>/</span>
      <span class="text-slate-600">{{ paper.name }}</span>
    </nav>

    <div class="mt-6 grid items-start gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <!-- 版式示意 -->
      <div
        class="rounded-lg border border-slate-200 bg-[radial-gradient(circle,#cbd5e1_1px,transparent_1px)] bg-white bg-[size:12px_12px] p-8 sm:p-10"
      >
        <svg
          class="mx-auto w-full max-w-[260px] rounded-sm border border-slate-300 bg-white shadow-card"
          :viewBox="`0 0 ${LABEL_PAPER_SHEET.width} ${LABEL_PAPER_SHEET.height}`"
          role="img"
          :aria-label="`${paper.name} 版式示意图`"
        >
          <rect
            v-for="(cell, i) in cellRects"
            :key="i"
            :x="cell.x + 0.6"
            :y="cell.y + 0.6"
            :width="Math.max(paper.labelWidth - 1.2, 2)"
            :height="Math.max(paper.labelHeight - 1.2, 2)"
            :rx="paper.corner === 'rounded' ? (paper.cornerRadius ?? 2) : 0"
            fill="#eef2ff"
            stroke="#6366f1"
            stroke-width="0.6"
          />
        </svg>
        <p class="mt-4 text-center text-[11px] font-semibold text-slate-600">
          按毫米比例绘制的整页版式示意
        </p>
      </div>

      <!-- 规格信息 -->
      <div>
        <span class="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-600">
          A4 不干胶纸型
        </span>
        <h1 class="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {{ paper.name }}
        </h1>
        <p class="mt-3 text-sm leading-7 text-slate-600">{{ paper.description }}</p>

        <div class="mt-4 flex flex-wrap gap-1.5">
          <span
            v-for="alias in paper.aliases"
            :key="alias"
            class="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600"
          >
            {{ alias }}
          </span>
        </div>

        <RouterLink
          :to="`/studio?paper=${paper.slug}`"
          class="group btn btn-primary btn-lg mt-6 w-full sm:w-auto"
        >
          用此纸型开始排版
          <svg
            class="size-4 transition-transform duration-200 group-hover:translate-x-1"
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

        <div class="mt-8 overflow-hidden rounded-lg border border-slate-200">
          <table class="w-full text-left text-sm">
            <tbody>
              <tr
                v-for="row in specRows"
                :key="row.name"
                class="border-b border-slate-100 last:border-b-0"
              >
                <th class="w-28 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-600">
                  {{ row.name }}
                </th>
                <td class="px-4 py-2.5 text-slate-700">{{ row.value }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h2 class="text-xs font-bold text-slate-900">典型用途</h2>
          <ul class="mt-2 space-y-1.5 text-xs leading-5 text-slate-600">
            <li v-for="use in paper.uses" :key="use" class="flex items-start gap-1.5">
              <svg
                class="mt-0.5 size-3.5 shrink-0 text-brand-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="m5 13 4 4L19 7" />
              </svg>
              {{ use }}
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 适用模板推荐 -->
    <section class="mt-14">
      <h2 class="text-xl font-bold tracking-tight text-slate-900">适用模板推荐</h2>
      <p class="mt-1.5 text-sm text-slate-600">
        以下内置模板与该纸型的标签尺寸匹配良好，选模板后再在纸张设置里选择此纸型即可对版。
      </p>
      <div class="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <RouterLink
          v-for="item in recommended"
          :key="item.detail!.slug"
          :to="`/templates/${item.detail!.slug}`"
          class="group rounded-lg border border-slate-200 bg-white p-4 shadow-card transition-shadow hover:shadow-lg"
        >
          <div class="rounded-md bg-slate-50 p-3">
            <TemplateThumb :template="item.template!" />
          </div>
          <h3 class="mt-3 text-sm font-bold text-slate-900 group-hover:text-brand-600">
            {{ item.template!.name }}
          </h3>
          <p class="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
            {{ item.template!.description }}
          </p>
        </RouterLink>
      </div>
    </section>

    <!-- 其他纸型 -->
    <section class="mt-14">
      <h2 class="text-xl font-bold tracking-tight text-slate-900">其他常用纸型</h2>
      <div class="mt-5 flex flex-wrap gap-2">
        <RouterLink
          v-for="p in others"
          :key="p.slug"
          :to="`/papers/${p.slug}`"
          class="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-600"
        >
          {{ p.name }}
        </RouterLink>
        <RouterLink
          to="/papers"
          class="rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1.5 text-xs font-bold text-brand-600 hover:bg-brand-100"
        >
          查看全部纸型
        </RouterLink>
      </div>
    </section>
  </div>
</template>
