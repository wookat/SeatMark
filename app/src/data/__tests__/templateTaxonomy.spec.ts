import { describe, expect, it } from 'vitest'

import { defaultTemplates } from '../defaultTemplates'
import { guides } from '../guides'
import { templateDetails } from '../templateDetails'
import { TEMPLATE_COUNT } from '../templateMeta'
import { TEMPLATE_SUBCATEGORIES, subcategoryOf } from '../templateTaxonomy'

describe('templateMeta', () => {
  it('TEMPLATE_COUNT 与内置模板实际数量一致', () => {
    expect(TEMPLATE_COUNT).toBe(defaultTemplates.length)
  })

  it('第 355 轮：guides / templateDetails 正文不再写死「200 多款」，模板数量统一插值 TEMPLATE_COUNT', () => {
    const stale = /200\s*多\s*款|两百多款|200\+\s*款/
    for (const g of guides) {
      const text = `${g.title}\n${g.description}\n${g.body}`
      expect(text, `guide ${g.slug} 仍含「200 多款」`).not.toMatch(stale)
    }
    for (const d of templateDetails) {
      const text = [d.seoTitle, d.seoDescription, d.intro, ...d.useCases, ...d.tips, ...(d.faqs ?? []).flatMap((f) => [f.q, f.a])].join('\n')
      expect(text, `templateDetail ${d.slug} 仍含「200 多款」`).not.toMatch(stale)
    }
    const mentions = guides.filter((g) => g.body.includes(`${TEMPLATE_COUNT} 款`))
    expect(mentions.length).toBeGreaterThanOrEqual(3)
  })
})

describe('templateTaxonomy', () => {
  const builtinIds = new Set(defaultTemplates.map((t) => t.id))

  it('每个内置模板都有且仅有一个二级分类', () => {
    const seen = new Map<string, string>()
    for (const subs of Object.values(TEMPLATE_SUBCATEGORIES)) {
      for (const sub of subs) {
        for (const id of sub.templateIds) {
          expect(seen.get(id), `模板 ${id} 重复出现在 ${seen.get(id)} 与 ${sub.id}`).toBeUndefined()
          seen.set(id, sub.id)
        }
      }
    }
    const missing = [...builtinIds].filter((id) => !seen.has(id))
    expect(missing, '缺少二级分类归属的内置模板').toEqual([])
  })

  it('二级分类不引用不存在的模板 id', () => {
    for (const subs of Object.values(TEMPLATE_SUBCATEGORIES)) {
      for (const sub of subs) {
        for (const id of sub.templateIds) {
          expect(builtinIds.has(id), `二级分类 ${sub.id} 引用了不存在的模板 ${id}`).toBe(true)
        }
      }
    }
  })

  it('二级分类与模板一级分类一致', () => {
    for (const t of defaultTemplates) {
      if (!t.category) continue
      const subs = TEMPLATE_SUBCATEGORIES[t.category]
      const sub = subcategoryOf(t.id)
      expect(sub, `模板 ${t.id} 无二级分类`).toBeDefined()
      expect(
        subs.some((s) => s.id === sub!.id),
        `模板 ${t.id} 的二级分类 ${sub!.id} 不属于其一级分类 ${t.category}`,
      ).toBe(true)
    }
  })
})
