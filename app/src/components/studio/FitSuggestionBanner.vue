<script setup lang="ts">
import { computed } from 'vue'

import { t } from '@/i18n'
import { useTemplateLibrary } from '@/stores/templateLibrary'
import { useToastStore } from '@/stores/toast'
import { useWorkspaceStore } from '@/stores/workspace'
import { applyLabelPaper, matchLabelPaper } from '@/utils/labelPaper'
import { bestPaperForTemplate, evaluatePaperFit, FIT_LEVEL_LABELS } from '@/utils/paperFit'

/**
 * 模板 × 纸型错配提示条（非阻断）：
 * 当前组合适配度为「勉强 / 不适配」时给出原因与更优组合建议，
 * 提供一键切换推荐纸型，不强制切换、尊重用户选择。
 */

const workspace = useWorkspaceStore()
const library = useTemplateLibrary()
const toast = useToastStore()

/** 评分基于模板设计尺寸（库中原始模板），而非已被纸型缩放后的工作区副本 */
const designTemplate = computed(
  () => library.findById(workspace.selectedTemplateId) ?? workspace.template,
)

const currentPaper = computed(() =>
  matchLabelPaper(workspace.template.page, workspace.template.label),
)

const currentFit = computed(() =>
  currentPaper.value ? evaluatePaperFit(designTemplate.value, currentPaper.value) : null,
)

const recommended = computed(() => bestPaperForTemplate(designTemplate.value))

const mismatch = computed(() => {
  const fit = currentFit.value
  if (!fit) return null
  if (fit.level !== 'marginal' && fit.level !== 'incompatible') return null
  return fit
})

const showSwitch = computed(
  () => recommended.value && recommended.value.spec.slug !== currentPaper.value?.slug,
)

function switchToRecommended() {
  const best = recommended.value
  if (!best) return
  applyLabelPaper(workspace.template, best.spec)
  toast.success(t('已切换到推荐纸型'), `${best.spec.name}：${best.fit.reason}`)
}
</script>

<template>
  <div
    v-if="mismatch"
    class="flex flex-wrap items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs leading-4 text-amber-800"
    role="status"
  >
    <svg
      class="mt-0.5 size-4 shrink-0 text-amber-500"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M10 3 2.5 16h15L10 3Z" />
      <path d="M10 8v4M10 14.5h.01" />
    </svg>
    <div class="min-w-0 flex-1">
      <p class="font-semibold">
        {{
          t('当前模板与纸型「{paper}」适配度：{level}')
            .replace('{paper}', currentPaper?.name ?? '')
            .replace('{level}', t(FIT_LEVEL_LABELS[mismatch.level]))
        }}
      </p>
      <p class="mt-0.5 text-amber-700">{{ mismatch.reason }}</p>
      <p v-if="recommended && showSwitch" class="mt-0.5 text-amber-700">
        {{ t('建议改用「{paper}」：{reason}').replace('{paper}', recommended.spec.name).replace('{reason}', recommended.fit.reason) }}
      </p>
    </div>
    <button
      v-if="showSwitch"
      type="button"
      class="btn btn-secondary btn-sm shrink-0"
      @click="switchToRecommended"
    >
      {{ t('一键切换推荐纸型') }}
    </button>
  </div>
</template>
