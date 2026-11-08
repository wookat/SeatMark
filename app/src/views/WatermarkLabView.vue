<script setup lang="ts">
import { computed, ref } from 'vue'

import LabelCard from '@/components/label/LabelCard.vue'
import { defaultTemplates } from '@/data/defaultTemplates'
import { MM_TO_PX } from '@/utils/layout'
import { watermarkPlacement } from '@/utils/watermark'

/**
 * 开发期水印走查页（/dev/watermark）：以示例数据 + 水印渲染全部内置模板，
 * 供截图比对不同模板下水印位置/形态是否重叠。
 * 查询参数：ids=a,b,c 只渲染这些模板；scale=0.8 调整缩放；variant=diagonal 只留指定形态。
 */
const params = new URLSearchParams(location.search)
const idsParam = params.get('ids')
const wanted = idsParam ? new Set(idsParam.split(',').map((s) => s.trim()).filter(Boolean)) : null
const variantFilter = params.get('variant')

const scale = ref(Number(params.get('scale')) || 0.8)
const list = computed(() =>
  defaultTemplates
    .filter((t) => !wanted || wanted.has(t.id))
    .map((template) => {
      const p = watermarkPlacement({
        width: template.label.width,
        height: template.label.height,
        fields: template.fields,
        seed: template.id,
      })
      return {
        template,
        variant: p.variant,
        kind: p.content.kind,
        w: template.label.width * MM_TO_PX * scale.value,
        h: template.label.height * MM_TO_PX * scale.value,
      }
    })
    .filter((item) => !variantFilter || item.variant === variantFilter || item.kind === variantFilter),
)
</script>

<template>
  <div class="min-h-screen bg-slate-200 p-4">
    <header class="sticky top-0 z-10 mb-4 flex items-center gap-3 rounded-lg bg-white/90 px-4 py-2 shadow backdrop-blur">
      <h1 class="text-sm font-bold">水印走查 · {{ list.length }} 个模板</h1>
      <label class="text-xs text-slate-500">
        缩放
        <input v-model.number="scale" type="range" min="0.3" max="1.5" step="0.05" class="align-middle" />
        {{ Math.round(scale * 100) }}%
      </label>
    </header>
    <div class="flex flex-wrap items-start gap-3">
      <figure
        v-for="item in list"
        :key="item.template.id"
        class="m-0 rounded bg-white p-2 shadow-sm"
        :data-template-id="item.template.id"
        :data-variant="item.variant"
      >
        <div
          class="relative overflow-hidden"
          :style="{ width: `${item.w}px`, height: `${item.h}px` }"
        >
          <div
            class="absolute top-0 left-0 origin-top-left"
            :style="{ transform: `scale(${scale})` }"
          >
            <LabelCard :template="item.template" sample-mode watermark />
          </div>
        </div>
        <figcaption class="mt-1.5 max-w-40 truncate text-[10px] leading-4 text-slate-500">
          {{ item.template.id }} · {{ item.template.name }} ·
          <strong class="text-slate-700">{{ item.variant }}·{{ item.kind }}</strong>
        </figcaption>
      </figure>
    </div>
  </div>
</template>
