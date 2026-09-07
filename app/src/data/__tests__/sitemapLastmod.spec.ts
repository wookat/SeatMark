/**
 * sitemap <lastmod> 真实化（第 351 轮）：/guides/* 逐条取 guides 数据的 dateModified，
 * 非法日期回退构建日，工具页/首页保持构建日；整站至少出现 5 个不同日期。
 */
import { describe, expect, it } from 'vitest'

import { guides } from '@/data/guides'
import { isSitemapEligible, prerenderPaths, resolveSeo } from '@/data/seo'
import { templateDetails } from '@/data/templateDetails'
import { topicPages } from '@/data/topicPages'
import { vsPages } from '@/data/vsPages'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { isValidIsoDate, resolveLastmod } from '../../../scripts/sitemapLastmod.mjs'

const today = '2026-09-07'
const sources = { guides, templateDetails, vsPages, topicPages, today }

describe('sitemap lastmod 取数据源日期', () => {
  it('isValidIsoDate 只接受真实存在的 YYYY-MM-DD', () => {
    expect(isValidIsoDate('2026-08-06')).toBe(true)
    expect(isValidIsoDate('2026-8-6')).toBe(false)
    expect(isValidIsoDate('2026-08')).toBe(false)
    expect(isValidIsoDate('2026-02-31')).toBe(false)
    expect(isValidIsoDate('')).toBe(false)
    expect(isValidIsoDate(undefined)).toBe(false)
  })

  it('/guides/* 的 lastmod 与对应 guide.dateModified 逐条一致', () => {
    expect(guides.length).toBeGreaterThan(0)
    for (const guide of guides) {
      expect(isValidIsoDate(guide.dateModified), guide.slug).toBe(true)
      expect(resolveLastmod(`/guides/${guide.slug}`, sources), guide.slug).toBe(guide.dateModified)
    }
  })

  it('首页/工具页/未知 slug 回退构建日；非法日期回退构建日', () => {
    expect(resolveLastmod('/', sources)).toBe(today)
    expect(resolveLastmod('/studio', sources)).toBe(today)
    expect(resolveLastmod('/seating', sources)).toBe(today)
    expect(resolveLastmod('/guides/not-a-real-slug', sources)).toBe(today)
    const bad = {
      ...sources,
      guides: [{ slug: 'x', dateModified: '2026/08/06', datePublished: 'yesterday' }],
    }
    expect(resolveLastmod('/guides/x', bad)).toBe(today)
    const published = { ...sources, guides: [{ slug: 'y', datePublished: '2026-07-01' }] }
    expect(resolveLastmod('/guides/y', published)).toBe('2026-07-01')
    expect(() => resolveLastmod('/', { ...sources, today: 'nope' })).toThrow()
  })

  it('/vs/* researchDate 为 YYYY-MM 精度时不当作 lastmod（回退构建日）；给出全格式日期则采用', () => {
    for (const vs of vsPages) {
      expect(resolveLastmod(`/vs/${vs.slug}`, sources), vs.slug).toBe(
        isValidIsoDate(vs.researchDate) ? vs.researchDate : today,
      )
    }
    const dated = { ...sources, vsPages: [{ slug: 'z', researchDate: '2026-08-15' }] }
    expect(resolveLastmod('/vs/z', dated)).toBe('2026-08-15')
    const topicDated = { ...sources, topicPages: [{ path: '/topics/t', updatedAt: '2026-08-20' }] }
    expect(resolveLastmod('/topics/t', topicDated)).toBe('2026-08-20')
  })

  it('sitemap 全部 URL 的 lastmod 至少出现 5 个不同日期', async () => {
    const paths = await prerenderPaths()
    const eligible: string[] = []
    for (const p of paths) {
      if (isSitemapEligible(await resolveSeo(p))) eligible.push(p)
    }
    expect(eligible.length).toBeGreaterThan(300)
    const dates = new Set(eligible.map((p) => resolveLastmod(p, sources)))
    for (const d of dates) expect(isValidIsoDate(d)).toBe(true)
    expect(dates.size).toBeGreaterThanOrEqual(5)
  })
})
