// @vitest-environment jsdom
/**
 * 第 348 轮：英文词典病句护栏。
 * - 译文不得出现嵌套括号 '((' / ') ('（如 '(signing up (free) raises it to'）；
 * - 分号后不得紧跟大写开头的普通词（拼接后会渲染成 '; Once restored'），专有名词/产品名除外；
 * - 教室座位表排把手 tooltip 使用带占位符的完整句词条，不再由 '第' / '排：' 碎片拼接。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import { en } from '@/i18n/locales/en'
import { enDemoValues, enFieldLabels, enPaperNames, enSubcategories, enTemplateNames, enTemplateScenarios } from '@/i18n/locales/enStudio'
import { enTemplateDescriptions } from '@/i18n/locales/enStudioDescriptions'
import { setLocale } from '@/i18n'
import GuidesView from '@/views/GuidesView.vue'
import HomeView from '@/views/HomeView.vue'
import PapersView from '@/views/PapersView.vue'
import TemplatesView from '@/views/TemplatesView.vue'
import VsIndexView from '@/views/VsIndexView.vue'

const CJK = /[\u4e00-\u9fff]/

/** 分号后允许大写的专有名词 / 缩写 */
const PROPER_NOUNS = new Set([
  'Pro',
  'Team',
  'SeatMark',
  'Excel',
  'PDF',
  'PNG',
  'ZIP',
  'CSV',
  'TXT',
  'A3',
  'A4',
  'A5',
  'WeChat',
  'Studio',
  'Chrome',
  'Safari',
  'Firefox',
  'Edge',
  'Windows',
  'Mac',
  'iOS',
  'Android',
  'Word',
  'WPS',
  'ID',
  'QR',
  'URL',
  'ICP',
])

describe('第 348 轮：en.ts 译文病句护栏', () => {
  const entries = Object.entries(en)

  it('任一译文不含嵌套括号 "((" 或 ") ("', () => {
    const bad = entries.filter(([, v]) => /\(\(|\) \(/.test(v))
    expect(bad.map(([k]) => k)).toEqual([])
  })

  it('任一译文分号后不紧跟大写普通词（专有名词除外）', () => {
    const bad: string[] = []
    for (const [k, v] of entries) {
      for (const m of v.matchAll(/; ([A-Z][A-Za-z0-9]*)/g)) {
        if (!PROPER_NOUNS.has(m[1]!)) bad.push(`${k} → ${v}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('定价页与维护提示译文已修正', () => {
    expect(en['次（免费登录即升为每日']).toBe('(signing up free raises it to')
    expect(en['恢复后可注册领取专业版试用。']).toMatch(/^once restored/)
    expect(en['账号服务维护中，恢复后可领取']).toBeTruthy()
  })

  it('英文首页 FAQ 区 eyebrow 为 Help，与标题 FAQ 不重复', () => {
    expect(en['常见问题']).toBe('FAQ')
  })

  it('排把手 tooltip 为带占位符的完整句，不再有 "第" / "排：" 碎片', () => {
    expect(en['第 {n} 排：点击或拖拽与另一排交换']).toBe('Row {n}: click or drag to swap with another row')
    expect(en).not.toHaveProperty('第')
    expect(en).not.toHaveProperty('排：')
    // 以「：」结尾且译文为 ': ' 的碎片词条只剩通用的「：」本身
    const fragments = entries.filter(([k, v]) => k.endsWith('：') && k !== '：' && v === ': ')
    expect(fragments.map(([k]) => k)).toEqual([])
  })
})

/**
 * 第 358 轮：英文词典统一美式拼写（centred→centered、colour→color、labelled→labeled 等），
 * 三份词典（en / enStudio / enStudioDescriptions）任一译文命中英式拼写即失败。
 */
const BRITISH_SPELLINGS = [
  /\bcentred\b/i,
  /\bcentre\b/i,
  /\bcolours?\b/i,
  /\bcolour(ed|ing|ful)\b/i,
  /\b\w+colours?\b/i,
  /\blabelled\b/i,
  /\blabelling\b/i,
  /\borganis(e|ed|es|ing|ation|ations)\b/i,
  /\brecognis(e|ed|es|ing)\b/i,
  /\bcustomis(e|ed|es|ing|ation)\b/i,
  /\boptimis(e|ed|es|ing|ation)\b/i,
  /\bcancelled\b/i,
  /\bcancelling\b/i,
  /\bgrey(scale)?\b/i,
  /\bfavourite\b/i,
  /\bbehaviour\b/i,
  /\bcatalogue\b/i,
  /\btravelling\b/i,
  /\banalyse\b/i,
  /\blicence\b/i,
  /\bprogramme\b/i,
  /\bdefence\b/i,
  /\bpractise\b/i,
]

describe('第 358 轮：英文词典禁用英式拼写', () => {
  const DICTS: Array<[string, Record<string, string>]> = [
    ['en.ts', en],
    ['enStudio.ts', { ...enFieldLabels, ...enDemoValues, ...enPaperNames, ...enSubcategories, ...enTemplateNames, ...enTemplateScenarios }],
    ['enStudioDescriptions.ts', enTemplateDescriptions],
  ]
  it.each(DICTS)('%s 译文无英式拼写', (_name, dict) => {
    const bad: string[] = []
    for (const [k, v] of Object.entries(dict)) {
      for (const re of BRITISH_SPELLINGS) {
        const m = v.match(re)
        if (m) bad.push(`${m[0]} ← ${k.slice(0, 40)}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('禁词表本身能识别典型英式拼写', () => {
    for (const word of ['centred', 'colour', 'watercolour', 'labelled', 'organisation', 'recognised']) {
      expect(BRITISH_SPELLINGS.some((re) => re.test(word)), word).toBe(true)
    }
    for (const word of ['centered', 'color', 'watercolor', 'labeled', 'organization', 'recognized']) {
      expect(BRITISH_SPELLINGS.some((re) => re.test(word)), word).toBe(false)
    }
  })
})

/**
 * 第 349 轮：/en 内容站四页黄条无中文且含 Browse in Chinese；模板卡片标题/说明读取已有英文译文（无 CJK）；
 * 首页 FAQ eyebrow 在 en 下为 Help（≠ 标题）。
 * 教程/纸型/对比三页的卡片标题数据尚无英文字段（不新增机翻内容），仅由黄条声明 Chinese only，不在此断言。
 */
const INDEX_VIEWS = [
  { name: 'TemplatesView', component: TemplatesView, path: '/templates', cardTitlesEn: true },
  { name: 'GuidesView', component: GuidesView, path: '/guides', cardTitlesEn: false },
  { name: 'PapersView', component: PapersView, path: '/papers', cardTitlesEn: false },
  { name: 'VsIndexView', component: VsIndexView, path: '/vs', cardTitlesEn: false },
] as const

async function mountAt(component: (typeof INDEX_VIEWS)[number]['component'] | typeof HomeView, path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path, component },
      { path: '/:rest(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  await setLocale('en')
  return mount(component, {
    global: { plugins: [router], stubs: { TemplateThumb: true, LabelSheet: true } },
  })
}

afterEach(async () => {
  await setLocale('zh')
})

describe('第 349 轮：/en 内容站黄条与卡片标题无中文', () => {
  for (const view of INDEX_VIEWS) {
    it(`${view.name}：黄条为英文并含 Browse in Chinese${view.cardTitlesEn ? '，卡片标题无 CJK' : ''}`, async () => {
      const wrapper = await mountAt(view.component, `/en${view.path}`)
      const notice = wrapper.find('[data-testid="zh-only-notice"]')
      expect(notice.exists()).toBe(true)
      expect(notice.text()).not.toMatch(CJK)
      expect(notice.text()).toContain('Browse in Chinese')
      expect(notice.find('[data-testid="zh-only-notice-zh-link"]').attributes('href')).toBe(view.path)

      if (view.cardTitlesEn) {
        const titles = wrapper.findAll('h2').map((h) => h.text().trim()).filter(Boolean)
        expect(titles.length).toBeGreaterThan(0)
        const leaked = titles.filter((title) => CJK.test(title))
        expect(leaked, `${view.name} 卡片标题含中文`).toEqual([])
      }
      wrapper.unmount()
    })
  }

  it('TemplatesView en：卡片说明与场景标签读取已有英文译文，无 CJK', async () => {
    const wrapper = await mountAt(TemplatesView, '/en/templates')
    const descriptions = wrapper.findAll('p.line-clamp-2').map((p) => p.text())
    expect(descriptions.length).toBeGreaterThan(0)
    expect(descriptions.filter((d) => CJK.test(d))).toEqual([])
    wrapper.unmount()
  })
})

describe('第 349 轮：首页 FAQ eyebrow', () => {
  it('en 下 eyebrow 为 Help 且 ≠ 标题；zh 下保持 FAQ', async () => {
    const io = class {
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    const prevIO = globalThis.IntersectionObserver
    const prevRO = globalThis.ResizeObserver
    const prevMatchMedia = window.matchMedia
    globalThis.IntersectionObserver = io as unknown as typeof IntersectionObserver
    globalThis.ResizeObserver = io as unknown as typeof ResizeObserver
    window.matchMedia = (() => ({ matches: true, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
    try {
      const wrapper = await mountAt(HomeView, '/en')
      const faq = wrapper.find('#faq')
      const eyebrow = faq.find('.section-eyebrow').text()
      const heading = faq.find('.section-heading').text()
      expect(eyebrow).toBe('Help')
      expect(heading).toBe('FAQ')
      expect(eyebrow).not.toBe(heading)
      wrapper.unmount()

      await setLocale('zh')
      const zh = await mountAt(HomeView, '/')
      await setLocale('zh')
      expect(zh.find('#faq .section-eyebrow').text()).toBe('FAQ')
      expect(zh.find('#faq .section-heading').text()).toBe('常见问题')
      zh.unmount()
    } finally {
      globalThis.IntersectionObserver = prevIO
      globalThis.ResizeObserver = prevRO
      window.matchMedia = prevMatchMedia
    }
  })
})
