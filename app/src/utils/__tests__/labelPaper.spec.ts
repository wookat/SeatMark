import { describe, expect, it } from 'vitest'

import { defaultTemplates } from '@/data/defaultTemplates'
import { LABEL_PAPER_SHEET, labelPapers } from '@/data/labelPapers'
import { templateDetails } from '@/data/templateDetails'
import {
  applyLabelPaper,
  isFullPageTemplate,
  isPaperCompatible,
  labelPaperGeometry,
  matchLabelPaper,
} from '@/utils/labelPaper'
import { cloneTemplate, labelsPerPage, layoutOverflow } from '@/utils/layout'

describe('纸型库几何计算', () => {
  it('首批规格数量 ≥15 且 slug / 名称唯一', () => {
    expect(labelPapers.length).toBeGreaterThanOrEqual(15)
    expect(new Set(labelPapers.map((p) => p.slug)).size).toBe(labelPapers.length)
    expect(new Set(labelPapers.map((p) => p.name)).size).toBe(labelPapers.length)
  })

  it('每种纸型的阵列均不超出 A4 纸面，边距非负', () => {
    for (const spec of labelPapers) {
      const geo = labelPaperGeometry(spec)
      expect(geo.contentWidth, `${spec.slug} 横向`).toBeLessThanOrEqual(LABEL_PAPER_SHEET.width + 0.01)
      expect(geo.contentHeight, `${spec.slug} 纵向`).toBeLessThanOrEqual(
        LABEL_PAPER_SHEET.height + 0.01,
      )
      expect(geo.marginX, `${spec.slug} marginX`).toBeGreaterThanOrEqual(0)
      expect(geo.marginY, `${spec.slug} marginY`).toBeGreaterThanOrEqual(0)
      expect(geo.perPage).toBe(spec.cols * spec.rows)
    }
  })

  it('几何推导正确：8格满切边距为 0 / 0.15，24格圆角水平居中', () => {
    const p8 = labelPapers.find((p) => p.slug === 'a4-8up')!
    const g8 = labelPaperGeometry(p8)
    expect(g8.contentWidth).toBe(210)
    expect(g8.marginX).toBe(0)
    expect(g8.contentHeight).toBe(297)
    expect(g8.marginY).toBe(0)

    const p24 = labelPapers.find((p) => p.slug === 'a4-24up-round')!
    const g24 = labelPaperGeometry(p24)
    // 3 × 63.5 + 2 × 2.5 = 195.5 → 边距 (210 - 195.5) / 2 = 7.3（0.1mm 取整）
    expect(g24.contentWidth).toBe(195.5)
    expect(g24.marginX).toBe(7.3)
  })

  it('applyLabelPaper 后排版不溢出、每页枚数与纸型一致、可被 matchLabelPaper 反查', () => {
    const base = cloneTemplate(defaultTemplates[0]!)
    for (const spec of labelPapers) {
      const template = cloneTemplate(base)
      applyLabelPaper(template, spec)
      const overflow = layoutOverflow(template)
      expect(overflow.x, `${spec.slug} 横向溢出`).toBeLessThanOrEqual(0.2)
      expect(overflow.y, `${spec.slug} 纵向溢出`).toBeLessThanOrEqual(0.2)
      expect(labelsPerPage(template)).toBe(spec.cols * spec.rows)
      expect(matchLabelPaper(template.page, template.label)?.slug).toBe(spec.slug)
      if (spec.corner === 'rounded') {
        expect(template.label.radius, `${spec.slug} 圆角`).toBeGreaterThan(0)
      } else {
        expect(template.label.radius).toBe(0)
      }
    }
  })

  it('applyLabelPaper 字段随标签尺寸等比缩放，内容不会落在标签外', () => {
    const base = cloneTemplate(defaultTemplates[0]!)
    for (const spec of labelPapers) {
      if (!isPaperCompatible(base, spec)) continue
      const template = cloneTemplate(base)
      applyLabelPaper(template, spec)
      for (const field of template.fields) {
        expect(field.x + field.width, `${spec.slug} ${field.id} 横向`).toBeLessThanOrEqual(
          spec.labelWidth + 0.5,
        )
        expect(field.y + field.height, `${spec.slug} ${field.id} 纵向`).toBeLessThanOrEqual(
          spec.labelHeight + 0.5,
        )
      }
    }
  })

  it('整页/折叠模板（vTent、fullPage）与多格小纸型不兼容，仅允许整版纸型', () => {
    const vTent = defaultTemplates.find((t) => t.id === 'vTent')!
    const fullPage = defaultTemplates.find((t) => t.id === 'fullPage')!
    expect(isFullPageTemplate(vTent)).toBe(true)
    expect(isFullPageTemplate(fullPage)).toBe(true)
    for (const t of [vTent, fullPage]) {
      for (const spec of labelPapers) {
        const compatible = isPaperCompatible(t, spec)
        expect(compatible, `${t.id} × ${spec.slug}`).toBe(spec.cols * spec.rows === 1)
      }
    }
  })

  it('普通多格模板与所有纸型兼容', () => {
    const standard = defaultTemplates[0]!
    expect(isFullPageTemplate(standard)).toBe(false)
    for (const spec of labelPapers) {
      expect(isPaperCompatible(standard, spec), spec.slug).toBe(true)
    }
  })

  it('推荐模板 id 全部有效（对应 /templates/:slug 落地页）', () => {
    const slugs = new Set(templateDetails.map((t) => t.slug))
    for (const spec of labelPapers) {
      expect(spec.recommendedTemplates.length, spec.slug).toBeGreaterThanOrEqual(2)
      for (const id of spec.recommendedTemplates) {
        expect(slugs.has(id), `${spec.slug} -> ${id}`).toBe(true)
      }
    }
  })
})
