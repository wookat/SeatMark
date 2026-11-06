import { describe, expect, it } from 'vitest'

import { defaultTemplates } from '@/data/defaultTemplates'
import { enGuides } from '@/data/guidesEn'
import { isSitemapEligible, resolveSeo } from '@/data/seo'

const CJK = /[\u4e00-\u9fff]/

/** /en/guides 下的英文原生教程：质量口径与中文教程一致，正文须为纯英文。 */
describe('英文教程质量', () => {
  const slugs = new Set(enGuides.map((g) => g.slug))

  it('slug 唯一、标题与摘要唯一', () => {
    expect(slugs.size).toBe(enGuides.length)
    expect(new Set(enGuides.map((g) => g.title)).size).toBe(enGuides.length)
    expect(new Set(enGuides.map((g) => g.description)).size).toBe(enGuides.length)
  })

  it('全部可见字段为英文（无 CJK）', () => {
    for (const g of enGuides) {
      const strings = [
        g.title,
        g.description,
        g.category,
        g.body,
        ...g.keywords,
        ...g.audiences,
        ...g.faqs.flatMap((f) => [f.q, f.a]),
        ...(g.quickStart ? [g.quickStart.label, g.quickStart.note ?? ''] : []),
        ...(g.howTo ? [g.howTo.name, ...g.howTo.steps.flatMap((s) => [s.name, s.text])] : []),
      ]
      for (const s of strings) expect(s, `${g.slug}: ${s.slice(0, 60)}`).not.toMatch(CJK)
    }
  })

  it('相关阅读 slug 在 enGuides 内有效且不指向自身', () => {
    for (const g of enGuides) {
      expect(g.related.length, `${g.slug} 相关阅读数量`).toBeGreaterThanOrEqual(2)
      for (const rel of g.related) {
        expect(slugs.has(rel), `${g.slug} -> ${rel}`).toBe(true)
        expect(rel).not.toBe(g.slug)
      }
    }
  })

  it('正文内链为 /en 站内路径', () => {
    for (const g of enGuides) {
      const links = [...g.body.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]!)
      for (const link of links) {
        expect(link === '/en' || link.startsWith('/en/'), `${g.slug} 内链 ${link}`).toBe(true)
      }
    }
  })

  it('每篇有 quickStart / FAQ / 关键词 / HowTo', () => {
    const templateIds = new Set(defaultTemplates.map((t) => t.id))
    for (const g of enGuides) {
      expect(g.quickStart, `${g.slug} quickStart`).toBeTruthy()
      const tpl = /^\/studio\?template=([a-zA-Z0-9]+)/.exec(g.quickStart!.to)?.[1]
      if (tpl) expect(templateIds.has(tpl), `${g.slug} 模板 ${tpl}`).toBe(true)
      expect(g.faqs.length, `${g.slug} FAQ 数量`).toBeGreaterThanOrEqual(2)
      expect(g.keywords.length, `${g.slug} 关键词数量`).toBeGreaterThanOrEqual(3)
      expect(g.howTo, `${g.slug} howTo`).toBeTruthy()
    }
  })

  it('/en/guides 与教程详情可索引、英文 SEO、结构化数据齐备', async () => {
    const index = await resolveSeo('/en/guides')
    expect(index.lang).toBe('en')
    expect(index.title).not.toMatch(CJK)
    expect(isSitemapEligible(index)).toBe(true)
    expect(index.jsonLd[0]!['@type']).toBe('CollectionPage')
    expect(index.alternates).toEqual([
      { hreflang: 'en', path: '/en/guides' },
      { hreflang: 'x-default', path: '/en/guides' },
    ])

    for (const g of enGuides) {
      const seo = await resolveSeo(`/en/guides/${g.slug}`)
      expect(seo.lang, g.slug).toBe('en')
      expect(seo.path, g.slug).toBe(`/en/guides/${g.slug}`)
      expect(isSitemapEligible(seo), g.slug).toBe(true)
      expect(seo.title, g.slug).not.toMatch(CJK)
      const types = seo.jsonLd.map((j) => j['@type'])
      expect(types, g.slug).toEqual(['Article', 'BreadcrumbList', 'HowTo', 'FAQPage'])
      expect(seo.jsonLd[0]!['inLanguage'], g.slug).toBe('en')
    }
  })

  it('/en/vs 索引可索引、英文 CollectionPage', async () => {
    const seo = await resolveSeo('/en/vs')
    expect(seo.lang).toBe('en')
    expect(seo.title).not.toMatch(CJK)
    expect(isSitemapEligible(seo)).toBe(true)
    expect(seo.jsonLd[0]!['@type']).toBe('CollectionPage')
  })
})
