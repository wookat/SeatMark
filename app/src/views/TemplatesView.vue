<script setup lang="ts">
import TemplateThumb from '@/components/label/TemplateThumb.vue'
import { defaultTemplates } from '@/data/defaultTemplates'
import { templateDetails } from '@/data/templateDetails'

const items = templateDetails
  .map((detail) => ({
    detail,
    template: defaultTemplates.find((t) => t.id === detail.slug),
  }))
  .filter((item) => !!item.template)
</script>

<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
    <div class="text-center">
      <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Templates</p>
      <h1 class="mt-1 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
        标签模板库
      </h1>
      <p class="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">
        {{ items.length }} 款免费内置模板覆盖考场座签、考号贴、课桌姓名贴、会议桌牌、
        出入证、学生证、工作证等场景，全部以毫米为单位精确排版，
        点击任意模板查看详情，或直接开始生成。
      </p>
    </div>

    <div class="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <RouterLink
        v-for="item in items"
        :key="item.detail.slug"
        :to="`/templates/${item.detail.slug}`"
        class="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg"
      >
        <span
          class="absolute inset-x-0 top-0 z-10 h-0.5 opacity-70"
          :style="{ background: item.template!.accent }"
        ></span>
        <div
          class="relative bg-[radial-gradient(circle,#cbd5e1_1px,transparent_1px)] bg-[size:12px_12px] px-8 pt-7 pb-5"
        >
          <div class="mx-auto max-w-56 transition-transform duration-300 group-hover:scale-[1.04]">
            <div class="bg-white shadow-[0_8px_24px_-10px_rgba(15,23,42,0.35)]">
              <TemplateThumb :template="item.template!" />
            </div>
          </div>
          <span
            class="absolute top-3 right-3 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-500 shadow-sm ring-1 ring-slate-200"
          >
            {{ item.template!.scenario }}
          </span>
        </div>
        <div class="flex flex-1 flex-col p-4">
          <h2 class="text-sm font-bold text-slate-900 group-hover:text-brand-600">
            {{ item.template!.name }}
          </h2>
          <p class="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
            {{ item.template!.description }}
          </p>
          <div class="mt-auto flex flex-wrap gap-1.5 pt-3">
            <span class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
              {{ item.template!.label.width }} × {{ item.template!.label.height }} mm
            </span>
            <span class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
              {{ item.template!.page.cols * item.template!.page.rows }} 枚 / 页
            </span>
          </div>
        </div>
      </RouterLink>
    </div>

    <!-- CTA -->
    <div
      class="mt-12 flex flex-col items-center justify-between gap-4 rounded-2xl border border-brand-200 bg-brand-50/60 px-6 py-6 text-center sm:flex-row sm:text-left"
    >
      <div>
        <h2 class="text-base font-bold text-slate-900">没有完全合适的？</h2>
        <p class="mt-1 text-sm text-slate-500">
          任何模板都可以在可视化设计器中继续调整，也可以从空白开始完全自定义。
        </p>
      </div>
      <RouterLink to="/studio?design=new" class="btn btn-primary btn-md w-full shrink-0 sm:w-auto">
        从空白新建模板
      </RouterLink>
    </div>
  </div>
</template>
