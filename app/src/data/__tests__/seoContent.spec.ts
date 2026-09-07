import { describe, expect, it } from 'vitest'

import { defaultTemplates } from '@/data/defaultTemplates'
import { guides } from '@/data/guides'
import { guidesRound2 } from '@/data/guidesRound2'
import { guidesRound3 } from '@/data/guidesRound3'
import { guidesRound4 } from '@/data/guidesRound4'
import { guidesRound5 } from '@/data/guidesRound5'
import { enIndexShellPaths, isSitemapEligible, prerenderPaths, resolveSeo } from '@/data/seo'
import { templateDetails } from '@/data/templateDetails'

/**
 * SEO 内容质量门禁：
 * 保证预渲染出的每个页面 title/description 唯一、长度合理，
 * 教程内容的内链、相关阅读、字数满足运营基线。
 */

const seos = await Promise.all((await prerenderPaths()).map((p) => resolveSeo(p)))

describe('SEO 页面元数据质量', () => {

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

  it('/en 内容站索引外壳：预渲染、英文 title、noindex、不进 sitemap', async () => {
    const paths = await prerenderPaths()
    const shells = enIndexShellPaths()
    expect(shells).toEqual(['/en/templates', '/en/guides', '/en/papers', '/en/vs'])
    for (const p of shells) {
      expect(paths, `${p} 应预渲染`).toContain(p)
      const seo = await resolveSeo(p)
      expect(seo.lang).toBe('en')
      expect(seo.title, `${p} title 应为英文`).not.toMatch(/[\u4e00-\u9fff]/)
      expect(seo.robots).toMatch(/noindex/)
      expect(isSitemapEligible(seo)).toBe(false)
    }
    const sitemapPaths = (
      await Promise.all(paths.map(async (p) => ({ p, seo: await resolveSeo(p) })))
    ).filter(({ seo }) => isSitemapEligible(seo))
    expect(sitemapPaths.length).toBe(paths.length - shells.length)
  })

  it('/en/account 与 /en/admin 壳页使用英文 title 且 noindex', async () => {
    for (const p of ['/en/account', '/en/admin']) {
      const seo = await resolveSeo(p)
      expect(seo.title).not.toMatch(/[\u4e00-\u9fff]/)
      expect(seo.lang).toBe('en')
      expect(seo.robots).toMatch(/noindex/)
    }
    expect((await resolveSeo('/en/account')).title).toBe('My Account - SeatMark')
    expect((await resolveSeo('/account')).title).toBe('个人中心 - SeatMark 座签')
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

  it('标题与摘要不含泛化承诺类禁用词', () => {
    const banned = ['一键生成', '完整流程', '一次讲清', '全攻略', '一站式', '看完即可上手', '不出错', '保姆级']
    const hits = guides.flatMap((g) =>
      banned
        .filter((w) => g.title.includes(w) || g.description.includes(w))
        .map((w) => `${g.slug}: ${w}`),
    )
    expect(hits).toEqual([])
  })

  it('正文字数达标（第二轮及以后新增 ≥1200，存量 ≥800）', () => {
    const longFormSlugs = new Set(
      [...guidesRound2, ...guidesRound3, ...guidesRound4, ...guidesRound5].map((g) => g.slug),
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

  it('每篇教程都有 quickStart 且目标模板/路由有效', () => {
    const templateIds = new Set(defaultTemplates.map((t) => t.id))
    for (const g of guides) {
      expect(g.quickStart, `${g.slug} quickStart`).toBeTruthy()
      const to = g.quickStart!.to
      const tpl = /^\/studio\?template=([a-zA-Z0-9]+)/.exec(to)?.[1]
      if (tpl) {
        expect(templateIds.has(tpl), `${g.slug} quickStart 模板 ${tpl}`).toBe(true)
      } else {
        expect(['/seating', '/papers'].some((p) => to.startsWith(p)), `${g.slug} quickStart 目标 ${to}`).toBe(true)
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

  it('详情 intro/描述中写明的「宽×高 mm」与模板 label 实际尺寸（或整页等分裁切尺寸）一致', () => {
    const byId = new Map(defaultTemplates.map((t) => [t.id, t]))
    const sizeRe = /(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)\s*mm/g
    for (const d of templateDetails) {
      const tpl = byId.get(d.slug)!
      const { page } = tpl
      const allowed = [
        `${tpl.label.width}×${tpl.label.height}`,
        `${Math.floor(page.paperWidth / page.cols)}×${Math.floor(page.paperHeight / page.rows)}`,
      ]
      for (const text of [d.intro, d.seoDescription, tpl.description ?? '']) {
        for (const m of text.matchAll(sizeRe)) {
          expect(allowed, `${d.slug} 文案尺寸 ${m[0]}`).toContain(`${Number(m[1])}×${Number(m[2])}`)
        }
      }
    }
  })
})
