import { describe, expect, it } from 'vitest'

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
})
