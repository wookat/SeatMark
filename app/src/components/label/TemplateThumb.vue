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
const { width, height } = useElementSize(container)

/** 测到容器尺寸前不展示：避免 SSR / 首帧以 scale(1) 渲染原尺标签被容器裁成左上角 */
const measured = computed(() => width.value > 0)

/** 按容器宽高两个方向取较小缩放，容器高度受限时宽扁模板也完整可见 */
const scale = computed(() => {
  const naturalWidth = props.template.label.width * MM_TO_PX
  const naturalHeight = props.template.label.height * MM_TO_PX
  if (!width.value || !naturalWidth) return 1
  const byWidth = width.value / naturalWidth
  if (!height.value || !naturalHeight) return byWidth
  return Math.min(byWidth, height.value / naturalHeight)
})

const cardStyle = computed(() => ({
  transform: `translateX(-50%) scale(${scale.value})`,
  visibility: measured.value ? undefined : ('hidden' as const),
}))

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
        class="absolute top-0 left-1/2 origin-top"
        :style="cardStyle"
        data-testid="template-thumb-card"
      >
        <LabelCard :template="template" sample-mode />
      </div>
    </div>
  </div>
</template>
