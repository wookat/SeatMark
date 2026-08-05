import { describe, expect, it } from 'vitest'

import { defaultTemplates } from '@/data/defaultTemplates'
import { findLabelPaper, labelPapers } from '@/data/labelPapers'
import { isPaperCompatible } from '@/utils/labelPaper'
import {
  bestPaperForTemplate,
  evaluatePaperFit,
  paperFitScore,
  rankPapersForTemplate,
  rankTemplatesForPaper,
} from '@/utils/paperFit'

const byId = (id: string) => defaultTemplates.find((t) => t.id === id)!
const standard = byId('standard')
const fullPage = byId('fullPage')
const paper21 = findLabelPaper('a4-21up')!
const paper1 = findLabelPaper('a4-1up')!

describe('paperFit 评分', () => {
  it('分数恒在 0–100 之间，且与硬门槛一致', () => {
    for (const template of defaultTemplates) {
      for (const spec of labelPapers) {
        const fit = evaluatePaperFit(template, spec)
        expect(fit.score).toBeGreaterThanOrEqual(0)
        expect(fit.score).toBeLessThanOrEqual(100)
        if (!isPaperCompatible(template, spec)) {
          expect(fit.level).toBe('incompatible')
          expect(fit.score).toBe(0)
        }
        expect(fit.reason.length).toBeGreaterThan(0)
      }
    }
  })

  it('标准座签（60×32）× 21 格（70×42.4）为推荐档', () => {
    const fit = evaluatePaperFit(standard, paper21)
    expect(fit.level).toBe('recommended')
    expect(fit.score).toBeGreaterThanOrEqual(75)
  })

  it('小模板配整版大纸型：判为勉强/不适配（大版面配小模板要拦住）', () => {
    const fit = evaluatePaperFit(standard, paper1)
    expect(['marginal', 'incompatible']).toContain(fit.level)
    expect(fit.score).toBeLessThan(55)
  })

  it('整页/折叠模板 × 多格纸型：硬门槛判不适配并说明原因', () => {
    const fit = evaluatePaperFit(fullPage, paper21)
    expect(fit.level).toBe('incompatible')
    expect(fit.score).toBe(0)
    expect(fit.reason).toContain('整页')
    expect(fit.reason).toContain('21 格')
  })

  it('整页模板 × 整版纸型：满分推荐', () => {
    const fit = evaluatePaperFit(fullPage, paper1)
    expect(fit.level).toBe('recommended')
    expect(fit.score).toBe(100)
  })

  it('尺寸完全一致时得满分', () => {
    const clone = structuredClone(standard)
    clone.label.width = paper21.labelWidth
    clone.label.height = paper21.labelHeight
    expect(paperFitScore(clone, paper21)).toBe(100)
  })
})

describe('paperFit 排序', () => {
  it('纸型排序：分数单调递减，21 格排在整版之前（标准座签）', () => {
    const ranked = rankPapersForTemplate(standard)
    expect(ranked.length).toBe(labelPapers.length)
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]!.fit.score).toBeGreaterThanOrEqual(ranked[i]!.fit.score)
    }
    const idx = (slug: string) => ranked.findIndex((r) => r.spec.slug === slug)
    expect(idx('a4-21up')).toBeLessThan(idx('a4-1up'))
  })

  it('模板排序：不适配的整页模板排在标准座签之后（21 格纸型）', () => {
    const ranked = rankTemplatesForPaper([fullPage, standard], paper21)
    expect(ranked[0]!.template.id).toBe('standard')
    expect(ranked[1]!.fit.level).toBe('incompatible')
  })

  it('bestPaperForTemplate：标准座签推荐多格纸型，整页模板推荐整版', () => {
    expect(bestPaperForTemplate(standard)!.spec.slug).not.toBe('a4-1up')
    expect(bestPaperForTemplate(fullPage)!.spec.slug).toBe('a4-1up')
  })

  it('每款内置模板都存在非不适配的纸型可推荐', () => {
    for (const template of defaultTemplates) {
      expect(bestPaperForTemplate(template), template.id).not.toBeNull()
    }
  })
})
