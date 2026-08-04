<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import TemplateThumb from '@/components/label/TemplateThumb.vue'
import { defaultTemplates } from '@/data/defaultTemplates'
import { findTemplateDetail, TEMPLATE_STEPS, templateDetails } from '@/data/templateDetails'

const route = useRoute()
const router = useRouter()

const slug = computed(() => String(route.params.slug ?? ''))
const detail = computed(() => findTemplateDetail(slug.value))
const template = computed(() => defaultTemplates.find((t) => t.id === slug.value))

watch(
  detail,
  (d) => {
    if (!d && typeof window !== 'undefined') void router.replace('/templates')
  },
  { immediate: true },
)

/** 同类推荐：模板库里除自己外取 3 款 */
const others = computed(() => {
  const idx = templateDetails.findIndex((t) => t.slug === slug.value)
  const rest = templateDetails.filter((t) => t.slug !== slug.value)
  const start = Math.max(idx, 0) % Math.max(rest.length, 1)
  return [...rest.slice(start), ...rest.slice(0, start)].slice(0, 3).map((d) => ({
    detail: d,
    template: defaultTemplates.find((t) => t.id === d.slug)!,
  }))
})
</script>

<template>
  <div v-if="detail && template" class="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
    <!-- 面包屑 -->
    <nav class="flex flex-wrap items-center gap-1.5 text-xs text-slate-400" aria-label="面包屑">
      <RouterLink to="/" class="hover:text-brand-600">首页</RouterLink>
      <span>/</span>
      <RouterLink to="/templates" class="hover:text-brand-600">模板库</RouterLink>
      <span>/</span>
      <span class="text-slate-500">{{ template.name }}</span>
    </nav>

    <div class="mt-6 grid items-start gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <!-- 预览 -->
      <div
        class="rounded-lg border border-slate-200 bg-[radial-gradient(circle,#cbd5e1_1px,transparent_1px)] bg-white bg-[size:12px_12px] p-8 sm:p-10"
      >
        <div class="mx-auto max-w-sm">
          <div class="bg-white shadow-card">
            <TemplateThumb :template="template" />
          </div>
        </div>
        <div class="mt-6 flex flex-wrap justify-center gap-2 text-[11px] font-semibold text-slate-500">
          <span class="rounded-md bg-slate-100 px-2 py-1">
            标签 {{ template.label.width }} × {{ template.label.height }} mm
          </span>
          <span class="rounded-md bg-slate-100 px-2 py-1">
            {{ template.page.cols }} 列 × {{ template.page.rows }} 行 ·
            {{ template.page.cols * template.page.rows }} 枚 / 页
          </span>
          <span class="rounded-md bg-slate-100 px-2 py-1">
            纸张 {{ template.page.paperWidth }} × {{ template.page.paperHeight }} mm
          </span>
        </div>
      </div>

      <!-- 信息 -->
      <div>
        <span class="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-600">
          {{ template.scenario }}
        </span>
        <h1 class="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {{ template.name }}
        </h1>
        <p class="mt-3 text-sm leading-7 text-slate-600">{{ detail.intro }}</p>

        <RouterLink
          :to="`/studio?template=${detail.slug}`"
          class="group btn btn-primary btn-lg mt-6 w-full sm:w-auto"
        >
          用此模板开始
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
        <p class="mt-2 text-xs text-slate-400">免费使用 · 无需注册 · 数据不出浏览器</p>

        <h2 class="mt-8 text-sm font-bold text-slate-900">适用场景</h2>
        <ul class="mt-2 grid gap-1.5 text-sm text-slate-600 sm:grid-cols-2">
          <li v-for="useCase in detail.useCases" :key="useCase" class="flex items-start gap-2">
            <svg
              class="mt-0.5 size-4 shrink-0 text-emerald-500"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m3.5 8.5 3 3 6-7" />
            </svg>
            {{ useCase }}
          </li>
        </ul>
      </div>
    </div>

    <!-- 使用步骤 -->
    <section class="mt-12">
      <h2 class="text-xl font-bold tracking-tight text-slate-900">使用步骤</h2>
      <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="(step, i) in TEMPLATE_STEPS"
          :key="step.name"
          class="rounded-lg border border-slate-200 bg-white p-4"
        >
          <span
            class="flex size-7 items-center justify-center rounded-lg bg-brand-50 text-sm font-bold text-brand-600"
          >
            {{ i + 1 }}
          </span>
          <h3 class="mt-2.5 text-sm font-bold text-slate-900">{{ step.name }}</h3>
          <p class="mt-1 text-xs leading-5 text-slate-500">{{ step.text }}</p>
        </div>
      </div>
    </section>

    <!-- 打印建议 -->
    <section class="mt-10">
      <h2 class="text-xl font-bold tracking-tight text-slate-900">打印与使用建议</h2>
      <ul class="mt-4 grid gap-2 text-sm text-slate-600">
        <li v-for="tip in detail.tips" :key="tip" class="flex items-start gap-2">
          <svg
            class="mt-1 size-3.5 shrink-0 text-brand-500"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <circle cx="8" cy="8" r="2.5" />
          </svg>
          {{ tip }}
        </li>
      </ul>
      <p class="mt-4 text-xs text-slate-400">
        更多打印技巧见<RouterLink to="/guides" class="font-semibold text-brand-600 hover:underline">教程中心</RouterLink>，
        如<RouterLink to="/guides/label-print-troubleshooting" class="font-semibold text-brand-600 hover:underline">打印常见问题排查</RouterLink>。
      </p>
    </section>

    <!-- 其他模板 -->
    <section class="mt-12">
      <div class="flex items-center justify-between">
        <h2 class="text-base font-bold text-slate-900">其他模板</h2>
        <RouterLink to="/templates" class="text-xs font-bold text-brand-600 hover:underline">
          查看全部模板
        </RouterLink>
      </div>
      <div class="mt-4 grid gap-4 sm:grid-cols-3">
        <RouterLink
          v-for="other in others"
          :key="other.detail.slug"
          :to="`/templates/${other.detail.slug}`"
          class="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-brand-300"
        >
          <div class="w-20 shrink-0">
            <TemplateThumb :template="other.template" />
          </div>
          <div class="min-w-0">
            <h3 class="truncate text-sm font-bold text-slate-800 group-hover:text-brand-600">
              {{ other.template.name }}
            </h3>
            <p class="mt-0.5 truncate text-xs text-slate-400">{{ other.template.scenario }}</p>
          </div>
        </RouterLink>
      </div>
    </section>
  </div>
</template>
