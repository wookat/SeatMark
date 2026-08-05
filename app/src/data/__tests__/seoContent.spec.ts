import { describe, expect, it } from 'vitest'

import { defaultTemplates } from '@/data/defaultTemplates'
import { guides } from '@/data/guides'
import { guidesRound2 } from '@/data/guidesRound2'
import { guidesRound3 } from '@/data/guidesRound3'
import { guidesRound4 } from '@/data/guidesRound4'
import { prerenderPaths, resolveSeo } from '@/data/seo'
import { templateDetails } from '@/data/templateDetails'

/**
 * SEO 内容质量门禁：
 * 保证预渲染出的每个页面 title/description 唯一、长度合理，
 * 教程内容的内链、相关阅读、字数满足运营基线。
 */

describe('SEO 页面元数据质量', () => {
  const seos = prerenderPaths().map((p) => resolveSeo(p))

  it('所有预渲染页面 title 唯一', () => {
    const titles = seos.map((s) => s.title)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('所有预渲染页面 description 唯一且长度合理（40–170 字符）', () => {
    const descriptions = seos.map((s) => s.description)
    expect(new Set(descriptions).size).toBe(descriptions.length)
    for (const s of seos) {
      expect(s.description.length, `${s.path} description 长度`).toBeGreaterThanOrEqual(40)
      expect(s.description.length, `${s.path} description 长度`).toBeLessThanOrEqual(170)
    }
  })

  it('title 长度不超过 60 个汉字宽度（保守上限 65 字符）', () => {
    for (const s of seos) {
      expect(s.title.length, `${s.path} title 长度`).toBeLessThanOrEqual(65)
    }
  })

  it('每个页面都有规范 path 且不以斜杠结尾（根路径除外）', () => {
    for (const s of seos) {
      expect(s.path === '/' || !s.path.endsWith('/'), `${s.path}`).toBe(true)
    }
  })
})

describe('教程内容质量', () => {
  const slugs = new Set(guides.map((g) => g.slug))
  const templateSlugs = new Set(templateDetails.map((t) => t.slug))

  it('slug 唯一', () => {
    expect(slugs.size).toBe(guides.length)
  })

  it('标题与摘要唯一', () => {
    expect(new Set(guides.map((g) => g.title)).size).toBe(guides.length)
    expect(new Set(guides.map((g) => g.description)).size).toBe(guides.length)
  })

  it('正文字数达标（第二轮及以后新增 ≥1200，存量 ≥800）', () => {
    const longFormSlugs = new Set(
      [...guidesRound2, ...guidesRound3, ...guidesRound4].map((g) => g.slug),
    )
    for (const g of guides) {
      const textLength = g.body.replace(/<[^>]+>/g, '').replace(/\s/g, '').length
      const min = longFormSlugs.has(g.slug) ? 1200 : 800
      expect(textLength, `${g.slug} 正文字数`).toBeGreaterThanOrEqual(min)
    }
  })

  it('相关阅读 slug 全部有效且不指向自身', () => {
    for (const g of guides) {
      expect(g.related.length, `${g.slug} 相关阅读数量`).toBeGreaterThanOrEqual(2)
      for (const rel of g.related) {
        expect(slugs.has(rel), `${g.slug} -> ${rel}`).toBe(true)
        expect(rel).not.toBe(g.slug)
      }
    }
  })

  it('正文内链的教程与模板路径全部有效', () => {
    for (const g of guides) {
      const links = [...g.body.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]!)
      for (const link of links) {
        const clean = link.split('?')[0]!
        if (clean.startsWith('/guides/')) {
          expect(slugs.has(clean.slice('/guides/'.length)), `${g.slug} 内链 ${link}`).toBe(true)
        } else if (clean.startsWith('/templates/')) {
          expect(templateSlugs.has(clean.slice('/templates/'.length)), `${g.slug} 内链 ${link}`).toBe(true)
        }
      }
    }
  })

  it('每篇教程含 FAQ 与关键词', () => {
    for (const g of guides) {
      expect(g.faqs.length, `${g.slug} FAQ 数量`).toBeGreaterThanOrEqual(2)
      expect(g.keywords.length, `${g.slug} 关键词数量`).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('模板详情与数据一致性', () => {
  it('每个模板详情都有对应的内置模板', () => {
    const templateIds = new Set(defaultTemplates.map((t) => t.id))
    for (const d of templateDetails) {
      expect(templateIds.has(d.slug), `模板详情 ${d.slug}`).toBe(true)
    }
  })
})
