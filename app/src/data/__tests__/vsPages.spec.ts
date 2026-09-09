import { describe, expect, it } from 'vitest'

import { EN_CONTENT_DETAIL_PATHS, isEnContentDetailPath } from '@/data/enContentPaths'
import { isSitemapEligible, prerenderPaths, resolveSeo } from '@/data/seo'
import { findVsPage, vsLangOf, vsPagePath, vsPages, vsPagesFor } from '@/data/vsPages'
import { zhOnlyRedirectTarget } from '@/router'

const CJK = /[\u4e00-\u9fff]/

/**
 * 第 372 轮：对比页按正文语言分流——/vs 只列中文页，/en/vs/prismm-alternative 为独立英文页
 * （可索引、进 sitemap、不重定向回中文、无 ChineseOnlyNotice）。
 */
describe('vsPages 语言分流', () => {
  it('slug 唯一；缺省语言为 zh，Prismm 页为 en', () => {
    expect(new Set(vsPages.map((p) => p.slug)).size).toBe(vsPages.length)
    for (const p of vsPages) expect(['zh', 'en']).toContain(vsLangOf(p))
    expect(vsLangOf(findVsPage('canva')!)).toBe('zh')
    expect(vsLangOf(findVsPage('prismm-alternative')!)).toBe('en')
  })

  it('vsPagesFor 按语言过滤，中英互不混入', () => {
    const zh = vsPagesFor('zh')
    const en = vsPagesFor('en')
    expect(zh.map((p) => p.slug)).toEqual(['chuangkit', 'wps-mail-merge', 'placecard-us', 'canva'])
    expect(en.map((p) => p.slug)).toEqual(['prismm-alternative'])
    expect(zh.length + en.length).toBe(vsPages.length)
  })

  it('findVsPage 可按语言限定：中文路径查不到英文页，反之亦然', () => {
    expect(findVsPage('prismm-alternative', 'zh')).toBeUndefined()
    expect(findVsPage('prismm-alternative', 'en')?.slug).toBe('prismm-alternative')
    expect(findVsPage('canva', 'en')).toBeUndefined()
    expect(findVsPage('canva', 'zh')?.slug).toBe('canva')
    expect(findVsPage('nope')).toBeUndefined()
  })

  it('vsPagePath：英文页挂 /en/vs/:slug，中文页挂 /vs/:slug', () => {
    expect(vsPagePath(findVsPage('canva')!)).toBe('/vs/canva')
    expect(vsPagePath(findVsPage('prismm-alternative')!)).toBe('/en/vs/prismm-alternative')
  })

  it('EN_CONTENT_DETAIL_PATHS 与 lang=en 的对比页一一对应', () => {
    expect([...EN_CONTENT_DETAIL_PATHS].sort()).toEqual(vsPagesFor('en').map(vsPagePath).sort())
    expect(isEnContentDetailPath('/en/vs/prismm-alternative')).toBe(true)
    expect(isEnContentDetailPath('/en/vs/prismm-alternative/')).toBe(true)
    expect(isEnContentDetailPath('/en/vs/canva')).toBe(false)
  })
})

describe('Prismm 英文页内容如实', () => {
  const page = findVsPage('prismm-alternative', 'en')!

  it('全部字段为英文（无 CJK），标注 formerly Allseated 与 Cvent 公告口径', () => {
    const strings: string[] = [
      page.competitorName,
      page.heading,
      page.seoTitle,
      page.seoDescription,
      page.intro,
      ...page.competitorStrengths,
      ...page.dimensions.flatMap((d) => [d.dimension, d.competitor, d.seatmark]),
      ...page.faqs.flatMap((f) => [f.q, f.a]),
      ...page.relatedGuides.map((g) => g.label),
    ]
    for (const s of strings) expect(s, s).not.toMatch(CJK)
    expect(page.competitorName).toContain('formerly Allseated')
    expect(page.intro).toContain('October 1, 2026')
    expect(page.intro).toContain('December 31, 2026')
    expect(page.intro).toMatch(/per Cvent's public notice/)
    expect(page.intro).toMatch(/verify/i)
    expect(page.researchDate).toBe('2026-09')
  })

  it('维度覆盖价格/数据存放/导出打印/席位卡/离线/3D，3D 标 Prismm 领先且 SeatMark 无', () => {
    const dims = page.dimensions.map((d) => d.dimension.toLowerCase())
    for (const needle of ['price', 'data', 'export', 'place-card', 'offline', '3d']) {
      expect(dims.some((d) => d.includes(needle)), needle).toBe(true)
    }
    const threeD = page.dimensions.find((d) => /3d/i.test(d.dimension))!
    expect(threeD.competitor).toMatch(/leads/i)
    expect(threeD.seatmark).toMatch(/^None/)
    const storage = page.dimensions.find((d) => /data/i.test(d.dimension))!
    expect(storage.competitor).toMatch(/cloud/i)
    expect(storage.seatmark).toMatch(/browser-local/i)
  })

  it('FAQ 如实回答不支持导入 Prismm 文件，可粘贴 / CSV 导入名单', () => {
    const faq = page.faqs.find((f) => /import.*prismm/i.test(f.q))!
    expect(faq.a).toMatch(/^No\./)
    expect(faq.a).toMatch(/paste/i)
    expect(faq.a).toMatch(/CSV/)
    expect(faq.a).toMatch(/no automatic import/i)
  })

  it('相关链接只指向已英文化页面', () => {
    expect(page.relatedGuides.map((g) => g.to)).toEqual(['/en/banquet', '/en/seating', '/en/templates'])
  })
})

describe('Prismm 英文页路由 / SEO / 预渲染', () => {
  it('/en/vs/prismm-alternative 不重定向回中文；中文对比页仍重定向', () => {
    expect(zhOnlyRedirectTarget('/en/vs/prismm-alternative')).toBeNull()
    expect(zhOnlyRedirectTarget('/en/vs/canva')).toBe('/vs/canva')
  })

  it('英文 SEO：lang=en、canonical 为自身、可索引、hreflang 仅 en + x-default、JSON-LD 英文', async () => {
    const seo = await resolveSeo('/en/vs/prismm-alternative')
    expect(seo.lang).toBe('en')
    expect(seo.path).toBe('/en/vs/prismm-alternative')
    expect(seo.robots).toBeUndefined()
    expect(isSitemapEligible(seo)).toBe(true)
    expect(seo.title).not.toMatch(CJK)
    expect(seo.description).not.toMatch(CJK)
    expect(seo.alternates).toEqual([
      { hreflang: 'en', path: '/en/vs/prismm-alternative' },
      { hreflang: 'x-default', path: '/en/vs/prismm-alternative' },
    ])
    const types = seo.jsonLd.map((j) => j['@type'])
    expect(types).toEqual(['Article', 'FAQPage', 'BreadcrumbList'])
    expect(JSON.stringify(seo.jsonLd)).not.toMatch(CJK)
    expect(seo.jsonLd[0]!['inLanguage']).toBe('en')
    expect(seo.jsonLd[0]!['mainEntityOfPage']).toBe('https://www.seatmark.cn/en/vs/prismm-alternative')
  })

  it('中文路径 /vs/prismm-alternative 不产出中文 SEO（回落到 404 口径）', async () => {
    const seo = await resolveSeo('/vs/prismm-alternative')
    expect(seo.robots).toMatch(/noindex/)
  })

  it('/vs 索引 JSON-LD 只含中文页；预渲染清单含英文页且不含 /vs/prismm-alternative', async () => {
    const index = await resolveSeo('/vs')
    const collection = index.jsonLd[0] as { hasPart: { url: string }[] }
    expect(collection.hasPart.map((p) => p.url)).not.toContain('https://www.seatmark.cn/vs/prismm-alternative')
    const paths = await prerenderPaths()
    expect(paths).toContain('/en/vs/prismm-alternative')
    expect(paths).not.toContain('/vs/prismm-alternative')
  })
})
