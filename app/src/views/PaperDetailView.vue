<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import ChineseOnlyNotice from '@/components/ChineseOnlyNotice.vue'
import TemplateThumb from '@/components/label/TemplateThumb.vue'
import PaperCommerceSection from '@/components/paper/PaperCommerceSection.vue'
import { defaultTemplates } from '@/data/defaultTemplates'
import { findLabelPaper, labelPapers, sheetKeyOf, sheetOf } from '@/data/labelPapers'
import { findTemplateDetail, type TemplateDetail } from '@/data/templateDetails'
import type { LabelTemplate } from '@/types/template'
import { foldOffsets, labelPaperGeometry } from '@/utils/labelPaper'
import { rankTemplatesForPaper } from '@/utils/paperFit'
import NotFoundView from '@/views/NotFoundView.vue'

const route = useRoute()

const slug = computed(() => String(route.params.slug ?? ''))
const paper = computed(() => findLabelPaper(slug.value))
const geo = computed(() => (paper.value ? labelPaperGeometry(paper.value) : null))

/** 该纸型的专用模板（designedForPaper 指向本纸型 slug，几何与模切一致） */
const dedicated = computed(() => {
  const slug = paper.value?.slug
  if (!slug) return []
  return defaultTemplates.filter((t) => t.designedForPaper === slug)
})

/** 推荐列表：专用模板 → 人工推荐 → 按适配度实时补足到 6 款（均需有详情页） */
const recommended = computed(() => {
  const p = paper.value
  if (!p) return []
  const seen = new Set<string>()
  const out: { detail: TemplateDetail; template: LabelTemplate; dedicated: boolean }[] = []
  const push = (template: LabelTemplate | undefined, dedicated: boolean) => {
    if (!template || seen.has(template.id)) return
    const d = findTemplateDetail(template.id)
    if (!d) return
    seen.add(template.id)
    out.push({ detail: d, template, dedicated })
  }
  for (const t of dedicated.value) push(t, true)
  for (const id of p.recommendedTemplates) {
    push(defaultTemplates.find((t) => t.id === id), false)
  }
  if (out.length < 6) {
    for (const { template, fit } of rankTemplatesForPaper(defaultTemplates, p)) {
      if (out.length >= 6) break
      if (fit.level === 'incompatible' || fit.level === 'marginal') continue
      push(template, false)
    }
  }
  return out
})

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

/** 对折纸型的折线线段（示意 SVG 内，覆盖在标签格上） */
const foldLines = computed(() => {
  const p = paper.value
  if (!p?.fold) return []
  const offsets = foldOffsets(p)
  return cellRects.value.map((cell, i) => {
    const mid = offsets[Math.floor(i / p.cols)] ?? 0
    return p.fold === 'horizontal'
      ? { x1: cell.x + 0.6, y1: mid, x2: cell.x + p.labelWidth - 0.6, y2: mid }
      : { x1: offsets[i % p.cols] ?? 0, y1: cell.y + 0.6, x2: offsets[i % p.cols] ?? 0, y2: cell.y + p.labelHeight - 0.6 }
  })
})

const specRows = computed(() => {
  const p = paper.value
  const g = geo.value
  if (!p || !g) return []
  const sheet = sheetOf(p)
  const sheetName = sheetKeyOf(p)
  const right = p.marginRight ?? g.marginX
  const bottom = p.marginBottom ?? g.marginY
  const marginText =
    right === g.marginX && bottom === g.marginY
      ? `左右 ${g.marginX} mm · 上下 ${g.marginY} mm`
      : `左 ${g.marginX} / 右 ${right} mm · 上 ${g.marginY} / 下 ${bottom} mm`
  const foldText =
    p.fold === 'horizontal'
      ? `每枚中线横向压痕，对折成型约 ${p.labelWidth} × ${Math.round(p.labelHeight / 2)} mm`
      : p.fold === 'vertical'
        ? `每枚中线纵向压痕，对折成型约 ${Math.round(p.labelWidth / 2)} × ${p.labelHeight} mm`
        : null
  return [
    { name: '整张纸', value: `${sheetName}（${sheet.width} × ${sheet.height} mm）` },
    { name: '单枚标签', value: `${p.labelWidth} × ${p.labelHeight} mm` },
    { name: '排列', value: `${p.cols} 列 × ${p.rows} 行，每页 ${g.perPage} 枚` },
    { name: '标签间距', value: `横向 ${p.gapX} mm · 纵向 ${p.gapY} mm` },
    { name: '页边距', value: marginText },
    ...(foldText ? [{ name: '折线', value: foldText }] : []),
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
    <ChineseOnlyNotice />
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
          :viewBox="`0 0 ${sheetOf(paper).width} ${sheetOf(paper).height}`"
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
          <line
            v-for="(seg, i) in foldLines"
            :key="`fold-${i}`"
            :x1="seg.x1"
            :y1="seg.y1"
            :x2="seg.x2"
            :y2="seg.y2"
            stroke="#f59e0b"
            stroke-width="0.8"
            stroke-dasharray="3 2"
          />
        </svg>
        <p class="mt-4 text-center text-[11px] font-semibold text-slate-600">
          按毫米比例绘制的整页版式示意
        </p>
      </div>

      <!-- 规格信息 -->
      <div>
        <span class="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-600">
          {{ sheetKeyOf(paper) === 'US Letter' ? 'US Letter 纸型' : `${sheetKeyOf(paper)} 不干胶纸型` }}
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
        「专用」模板按此纸型的模切格设计，其余模板与该纸型的标签尺寸匹配良好；点「直接用」会同时载入模板并锁定此纸型。
      </p>
      <div class="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="item in recommended"
          :key="item.detail.slug"
          class="group relative rounded-lg border border-slate-200 bg-white p-4 shadow-card transition-shadow hover:shadow-lg"
        >
          <span
            v-if="item.dedicated"
            class="absolute right-3 top-3 z-10 rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700"
          >
            专用
          </span>
          <RouterLink :to="`/templates/${item.detail.slug}`">
            <div class="rounded-md bg-slate-50 p-3">
              <TemplateThumb :template="item.template" defer />
            </div>
            <h3 class="mt-3 text-sm font-bold text-slate-900 group-hover:text-brand-600">
              {{ item.template.name }}
            </h3>
            <p class="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
              {{ item.template.description }}
            </p>
          </RouterLink>
          <RouterLink
            :to="`/studio?paper=${paper.slug}&template=${item.detail.slug}`"
            class="btn btn-secondary btn-sm mt-3 w-full"
          >
            用此模板 + 纸型排版
          </RouterLink>
        </article>
      </div>
    </section>

    <!-- 购买与定制 -->
    <PaperCommerceSection :spec="paper" />

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
