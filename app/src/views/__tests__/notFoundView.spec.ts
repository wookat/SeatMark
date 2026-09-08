// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import { footerGuideLinks } from '@/data/guideLinks'
import { guides } from '@/data/guides'
import { setLocale } from '@/i18n'
import NotFoundView from '@/views/NotFoundView.vue'

const CJK = /[\u4e00-\u9fff]/

async function mountAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: NotFoundView }],
  })
  await router.push(path)
  await router.isReady()
  return mount(NotFoundView, { global: { plugins: [router] } })
}

function hrefs(wrapper: ReturnType<typeof mount>): string[] {
  return wrapper.findAll('a').map((a) => a.attributes('href') ?? '')
}

describe('第 341 轮：NotFoundView 英文化', () => {
  afterEach(async () => {
    await setLocale('zh')
  })

  it('en：文本无 CJK，首页/工坊/模板/教程/定价链接均指向 /en/*，教程推荐区块隐藏', async () => {
    await setLocale('en')
    const w = await mountAt('/en/does-not-exist')
    expect(w.text()).not.toMatch(CJK)
    expect(w.text()).toContain('Page not found or moved')
    expect(w.text()).toContain('Back to home')
    const links = hrefs(w)
    expect(links).toEqual(['/en', '/en/studio', '/en/templates', '/en/guides', '/en/pricing'])
    expect(links.some((h) => /^\/guides\//.test(h))).toBe(false)
  })

  it('zh：文案与链接与现状完全一致，含前 3 篇教程推荐', async () => {
    await setLocale('zh')
    const w = await mountAt('/does-not-exist')
    expect(w.text()).toContain('页面不存在或已被移动')
    expect(w.text()).toContain('返回首页')
    expect(w.text()).toContain('进入标签工坊')
    expect(w.text()).toContain('标签模板库')
    expect(w.text()).toContain('教程中心')
    expect(w.text()).toContain('定价说明')
    expect(w.text()).toContain('也许你在找这些教程')
    const links = hrefs(w)
    expect(links.slice(0, 5)).toEqual(['/', '/studio', '/templates', '/guides', '/pricing'])
    expect(links.slice(5)).toEqual(guides.slice(0, 3).map((g) => `/guides/${g.slug}`))
    for (const g of guides.slice(0, 3)) expect(w.text()).toContain(g.title)
  })
})

describe('第 371 轮：404 页不再全量引入教程正文', () => {
  it('推荐清单取自 guideLinks 且前 3 条与 guides 前 3 篇一致', () => {
    const picked = footerGuideLinks.slice(0, 3)
    expect(picked.map((l) => l.to)).toEqual(guides.slice(0, 3).map((g) => `/guides/${g.slug}`))
    expect(picked.map((l) => l.label)).toEqual(guides.slice(0, 3).map((g) => g.title))
    expect(picked.map((l) => l.category)).toEqual(guides.slice(0, 3).map((g) => g.category))
  })

  it('NotFoundView 源码不 import @/data/guides', () => {
    const src = readFileSync(resolve(__dirname, '../NotFoundView.vue'), 'utf8')
    expect(src).not.toMatch(/from '@\/data\/guides'/)
    expect(src).toMatch(/from '@\/data\/guideLinks'/)
  })
})
