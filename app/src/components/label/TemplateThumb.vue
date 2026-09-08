<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import LabelCard from '@/components/label/LabelCard.vue'
import { useElementSize } from '@/composables/useElementSize'
import { useI18n } from '@/i18n'
import type { LabelTemplate } from '@/types/template'
import { MM_TO_PX } from '@/utils/layout'
import { localizeTemplateForLocale, templateHasCjk } from '@/utils/templateLocale'

const props = defineProps<{
  template: LabelTemplate
  /** 进入视口附近才渲染标签内容（长列表页用，降低一次性挂载成本） */
  defer?: boolean
}>()

const { locale } = useI18n()

/** 缩略图按当前 locale 本地化固定文案/示例；zh 下原样返回 */
const localized = computed(() => localizeTemplateForLocale(props.template, locale.value))

/** en 下仍含中文示例值（人名/口号等不宜逐条翻译）时外层标 lang="zh" */
const lang = computed(() =>
  locale.value === 'en' && templateHasCjk(localized.value) ? 'zh' : undefined,
)

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
    { rootMargin: '900px' },
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
  <div aria-hidden="true" class="w-full border border-slate-200 bg-slate-100" :lang="lang">
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
        <LabelCard :template="localized" sample-mode />
      </div>
      <div
        v-else
        aria-hidden="true"
        class="absolute inset-0 flex items-center justify-center"
        data-testid="template-thumb-skeleton"
      >
        <div class="flex w-3/5 flex-col items-center justify-center gap-1.5 rounded border border-dashed border-slate-300 bg-white/60 py-[8%]">
          <span class="block h-1.5 w-1/2 rounded-full bg-slate-200"></span>
          <span class="block h-1 w-1/3 rounded-full bg-slate-200"></span>
        </div>
      </div>
    </div>
  </div>
</template>
