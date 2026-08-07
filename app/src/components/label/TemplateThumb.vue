<script setup lang="ts">
import { computed, ref } from 'vue'

import LabelCard from '@/components/label/LabelCard.vue'
import { useElementSize } from '@/composables/useElementSize'
import type { LabelTemplate } from '@/types/template'
import { MM_TO_PX } from '@/utils/layout'

const props = defineProps<{ template: LabelTemplate }>()

const container = ref<HTMLElement | null>(null)
const { width } = useElementSize(container)

const scale = computed(() => {
  const naturalWidth = props.template.label.width * MM_TO_PX
  if (!width.value || !naturalWidth) return 1
  return width.value / naturalWidth
})
</script>

<template>
  <!-- 灰色衬底边框放在外层：内层盒子无边框，aspect-ratio 高度与缩放后的标签
       完全一致，避免标签自身的底部边框被裁掉 -->
  <div aria-hidden="true" class="w-full border border-slate-200 bg-slate-100">
    <div
      ref="container"
      class="relative w-full overflow-hidden"
      :style="{ aspectRatio: `${template.label.width} / ${template.label.height}` }"
    >
      <div class="absolute top-0 left-0 origin-top-left" :style="{ transform: `scale(${scale})` }">
        <LabelCard :template="template" sample-mode />
      </div>
    </div>
  </div>
</template>
