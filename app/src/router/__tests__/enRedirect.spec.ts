import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { appShellPaths, prerenderPaths } from '@/data/seo'
import { localePath } from '@/i18n'
import { createAppRouter, zhOnlyRedirectTarget } from '@/router'

describe('zhOnlyRedirectTarget', () => {
  it('/en 下仅有中文正文的详情页映射到中文路径', () => {
    expect(zhOnlyRedirectTarget('/en/guides/print-margin-calibration')).toBe(
      '/guides/print-margin-calibration',
    )
    expect(zhOnlyRedirectTarget('/en/templates/standard')).toBe('/templates/standard')
    expect(zhOnlyRedirectTarget('/en/papers/a4-2x4')).toBe('/papers/a4-2x4')
    expect(zhOnlyRedirectTarget('/en/vs/canva')).toBe('/vs/canva')
  })

  it('/en 下协议/隐私与专题落地页整路径映射到中文路径', () => {
    expect(zhOnlyRedirectTarget('/en/terms')).toBe('/terms')
    expect(zhOnlyRedirectTarget('/en/privacy')).toBe('/privacy')
    expect(zhOnlyRedirectTarget('/en/desk-card-generator')).toBe('/desk-card-generator')
    expect(zhOnlyRedirectTarget('/en/name-card-batch')).toBe('/name-card-batch')
  })

  it('索引页、已英文化页与中文路径不重定向', () => {
    expect(zhOnlyRedirectTarget('/en/guides')).toBeNull()
    expect(zhOnlyRedirectTarget('/en/templates')).toBeNull()
    expect(zhOnlyRedirectTarget('/en/papers')).toBeNull()
    expect(zhOnlyRedirectTarget('/en/vs')).toBeNull()
    expect(zhOnlyRedirectTarget('/en')).toBeNull()
    expect(zhOnlyRedirectTarget('/en/banquet')).toBeNull()
    expect(zhOnlyRedirectTarget('/guides/print-margin-calibration')).toBeNull()
  })
})

describe('router /en 详情页守卫', () => {
  it('/en/guides/xxx 重定向到 /guides/xxx 并保留 query/hash', async () => {
    const router = createAppRouter()
    await router.push('/en/guides/print-margin-calibration?from=en#faq')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/guides/print-margin-calibration')
    expect(router.currentRoute.value.name).toBe('guide-article')
    expect(router.currentRoute.value.query.from).toBe('en')
    expect(router.currentRoute.value.hash).toBe('#faq')
  })

  it('/en/templates/xxx 重定向到 /templates/xxx', async () => {
    const router = createAppRouter()
    await router.push('/en/templates/standard')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/templates/standard')
  })

  it('/en/guides 索引页保持英文路由', async () => {
    const router = createAppRouter()
    await router.push('/en/guides')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/en/guides')
    expect(router.currentRoute.value.name).toBe('en-guides')
  })

  it('/en/terms 重定向到 /terms', async () => {
    const router = createAppRouter()
    await router.push('/en/terms')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/terms')
    expect(router.currentRoute.value.name).toBe('terms')
  })
})

/**
 * 守卫：页头/页脚每一个站内链接在 /en 下都必须有静态落点——
 * 要么预渲染了 /en 版本（prerenderPaths ∩ appShellPaths），要么由 zhOnlyRedirectTarget 回到中文页。
 * 防止未来新增链接时漏预渲染，静态托管直开 /en/xxx 返回 404。
 */
describe('AppHeader/AppFooter 站内链接 /en 落点守卫', () => {
  const componentFiles = ['AppHeader.vue', 'AppFooter.vue'].map((f) =>
    resolve(__dirname, '../../components/ui', f),
  )

  function internalLinkTargets(source: string): string[] {
    const targets = new Set<string>()
    for (const m of source.matchAll(/localePath\('(\/[^']*)'/g)) targets.add(m[1]!)
    for (const m of source.matchAll(/\bto:\s*'(\/[^']*)'/g)) targets.add(m[1]!)
    for (const m of source.matchAll(/\bto="(\/[^"]*)"/g)) targets.add(m[1]!)
    return [...targets]
  }

  it('每个链接的 /en 路径 ∈ 预渲染清单 ∪ zhOnlyRedirectTarget 命中', async () => {
    const staticPaths = new Set([...(await prerenderPaths()), ...appShellPaths()])
    const checked: string[] = []
    for (const file of componentFiles) {
      const source = readFileSync(file, 'utf-8')
      for (const target of internalLinkTargets(source)) {
        const base = target.split('?')[0]!.split('#')[0]!
        const enPath = localePath(base, 'en')
        const zhPath = zhOnlyRedirectTarget(enPath)
        const landed = staticPaths.has(enPath) || (zhPath !== null && staticPaths.has(zhPath))
        expect(landed, `${file.split('/').pop()} 链接 ${target} → ${enPath} 无静态落点`).toBe(true)
        checked.push(enPath)
      }
    }
    // 确保守卫真的扫到了链接（防止正则失效造成空跑假绿）
    expect(checked).toContain('/en/terms')
    expect(checked).toContain('/en/pricing')
    expect(checked.length).toBeGreaterThanOrEqual(12)
  })
})
