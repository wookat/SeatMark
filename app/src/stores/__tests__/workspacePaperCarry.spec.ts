/**
 * 切换模板时的纸型沿用门槛（P1：badge 会话选的「A4 4格」残留到 weddingPlace，
 * 逐张 PNG 被拉伸成纸型单格尺寸）：适配度达「可用」以上才沿用纸型，
 * 勉强/不适配一律恢复模板默认排版。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useWorkspaceStore } from '@/stores/workspace'
import { defaultTemplates } from '@/data/defaultTemplates'
import { labelPapers } from '@/data/labelPapers'
import { applyLabelPaper, matchLabelPaper } from '@/utils/labelPaper'
import { evaluatePaperFit } from '@/utils/paperFit'

const templateById = (id: string) => {
  const found = defaultTemplates.find((t) => t.id === id)
  if (!found) throw new Error(`模板不存在：${id}`)
  return found
}

const paperBySlug = (slug: string) => {
  const found = labelPapers.find((p) => p.slug === slug)
  if (!found) throw new Error(`纸型不存在：${slug}`)
  return found
}

describe('workspace 切换模板纸型沿用门槛', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  it('适配度勉强/不适配的纸型不跨模板沿用（badge 的 A4 4格 → examDoor 整页模板）', () => {
    const workspace = useWorkspaceStore()
    const paper = paperBySlug('a4-4up')
    workspace.selectTemplate(templateById('badge'), { silent: true })
    applyLabelPaper(workspace.template, paper)

    // 整页门贴与多格纸型两个进纸方向都不兼容，沿用门槛应恢复默认排版
    const door = templateById('examDoor')
    const fit = evaluatePaperFit(door, paper)
    expect(['marginal', 'incompatible']).toContain(fit.level)

    workspace.selectTemplate(door, { silent: true })
    expect(workspace.template.label.width).toBe(door.label.width)
    expect(workspace.template.label.height).toBe(door.label.height)
  })

  it('适配度可用以上的纸型继续沿用，免去重选', () => {
    const workspace = useWorkspaceStore()
    workspace.selectTemplate(templateById('badge'), { silent: true })
    const paper = paperBySlug('a4-4up')
    applyLabelPaper(workspace.template, paper)

    const compatible = defaultTemplates.find((t) => {
      const fit = evaluatePaperFit(t, paper)
      return (fit.level === 'recommended' || fit.level === 'usable') && t.id !== 'badge'
    })
    expect(compatible).toBeTruthy()

    workspace.selectTemplate(compatible!, { silent: true })
    // 沿用后几何与该纸型一致（竖放或横向进纸均可被 matchLabelPaper 反查）
    expect(matchLabelPaper(workspace.template.page, workspace.template.label)?.slug).toBe(
      'a4-4up',
    )
  })
})
