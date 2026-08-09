<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import LabelCard from '@/components/label/LabelCard.vue'
import { useElementSize } from '@/composables/useElementSize'
import type { LabelTemplate } from '@/types/template'
import { MM_TO_PX } from '@/utils/layout'

const props = defineProps<{
  template: LabelTemplate
  /** 进入视口附近才渲染标签内容（长列表页用，降低一次性挂载成本） */
  defer?: boolean
}>()

const container = ref<HTMLElement | null>(null)
const { width } = useElementSize(container)

const scale = computed(() => {
  const naturalWidth = props.template.label.width * MM_TO_PX
  if (!width.value || !naturalWidth) return 1
  return width.value / naturalWidth
})

const revealed = ref(!props.defer)
let observer: IntersectionObserver | null = null

onMounted(() => {
  if (revealed.value) return
  if (typeof IntersectionObserver === 'undefined' || !container.value) {
    revealed.value = true
    return
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        revealed.value = true
        observer?.disconnect()
        observer = null
      }
    },
    { rootMargin: '400px' },
  )
  observer.observe(container.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
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
      <div
        v-if="revealed"
        class="absolute top-0 left-0 origin-top-left"
        :style="{ transform: `scale(${scale})` }"
      >
        <LabelCard :template="template" sample-mode />
      </div>
    </div>
  </div>
</template>
