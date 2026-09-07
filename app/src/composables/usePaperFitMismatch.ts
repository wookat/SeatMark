import { computed } from 'vue'

import { useTemplateLibrary } from '@/stores/templateLibrary'
import { useWorkspaceStore } from '@/stores/workspace'
import { matchLabelPaper } from '@/utils/labelPaper'
import { bestPaperForTemplate, evaluatePaperFit } from '@/utils/paperFit'

/**
 * 当前模板 × 纸型的错配评估（FitSuggestionBanner 与 StudioView 共用）：
 * mismatch 非 null 表示适配度为「勉强 / 不适配」，侧栏会展示错配提示条。
 */
export function usePaperFitMismatch() {
  const workspace = useWorkspaceStore()
  const library = useTemplateLibrary()

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

  return { designTemplate, currentPaper, currentFit, recommended, mismatch }
}
