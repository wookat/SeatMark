// @vitest-environment jsdom
/**
 * 第 346 轮：首页与教程摘要营销化表达收敛护栏。
 * 首页渲染文本「一键」≤1、「毫米级」≤1、「思路很简单」=0、「几分钟」=0；
 * 教程 title/description 合计「一键」≤1（/guides 索引页一屏可见）、「思路很简单」=0、「几分钟」=0。
 * 第 366 轮：首页「每一步都按」=0；guides 全文「耗掉半天」=0；
 * 教程开场（quickStart 尾注 + 正文首段）单篇「无需注册」≤1、全部合计 ≤6。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import App from '@/App.vue'
import { createAppRouter } from '@/router'
import { setLocale } from '@/i18n'
import { guides } from '@/data/guides'
import { defaultTemplates } from '@/data/defaultTemplates'
import { templateDetails } from '@/data/templateDetails'
import { footerGuideLinks } from '@/data/guideLinks'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function count(text: string, word: string): number {
  return text.split(word).length - 1
}

let mounted: ReturnType<typeof mount> | null = null

async function mountApp(path: string) {
  const router = createAppRouter()
  await router.push(path)
  await router.isReady()
  const w = mount(App, {
    global: { plugins: [router], stubs: { Teleport: true, Transition: true, TransitionGroup: true } },
    attachTo: document.body,
  })
  await flushPromises()
  await w.vm.$nextTick()
  mounted = w
  return w
}

describe('第 346 轮：营销化表达收敛', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    setActivePinia(createPinia())
    vi.stubGlobal('scrollTo', vi.fn())
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 404 }))
  })
  afterEach(async () => {
    mounted?.unmount()
    mounted = null
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
    await setLocale('zh')
  })

  it('首页（zh）：「一键」≤1、「毫米级」≤1、无「思路很简单」「几分钟」，核心主张保留', async () => {
    const w = await mountApp('/')
    const text = w.text()
    expect(count(text, '一键')).toBeLessThanOrEqual(1)
    expect(count(text, '毫米级')).toBeLessThanOrEqual(1)
    expect(text).not.toContain('思路很简单')
    expect(text).not.toContain('几分钟')
    expect(text).toContain('Excel')
    expect(text).toContain('浏览器')
  })

  it('首页（en）：无 "one click" / "in minutes" 夸张表述', async () => {
    await setLocale('en')
    const w = await mountApp('/en')
    const text = w.text().toLowerCase()
    expect(text).not.toContain('one click')
    expect(text).not.toContain('one-click')
    expect(text).not.toContain('in minutes')
  })

  it('教程 title/description：合计「一键」≤1、无「思路很简单」「几分钟」；页脚精选与教程标题一致', () => {
    const joined = guides.map((g) => `${g.title}\n${g.description}`).join('\n')
    expect(count(joined, '一键')).toBeLessThanOrEqual(1)
    expect(joined).not.toContain('思路很简单')
    expect(joined).not.toContain('几分钟')
    for (const link of footerGuideLinks) {
      const slug = link.to.replace('/guides/', '')
      const guide = guides.find((g) => g.slug === slug)
      expect(guide, link.to).toBeDefined()
      expect(link.label).toBe(guide!.title)
    }
  })

  it('第 363 轮：模板文案改为可验证表述——无「特大姓名远距清晰」「培训签到即贴即用」「排版精确到毫米」', async () => {
    const descriptions = defaultTemplates.map((tpl) => tpl.description ?? '').join('\n')
    expect(descriptions).not.toContain('特大姓名远距清晰')
    expect(descriptions).not.toContain('培训签到即贴即用')
    expect(descriptions).toContain('姓名字高约 22 mm')
    expect(descriptions).toContain('5 米外可读')
    expect(descriptions).toContain('字高约 31 mm')
    expect(descriptions).toContain('签到时撕下即贴，无需再手写')

    const details = templateDetails
      .map((d) => `${d.seoDescription}\n${d.intro}`)
      .join('\n')
    expect(details).not.toContain('特大姓名远距离清晰')
    expect(details).not.toContain('签到即贴即用')
    expect(details).toContain('姓名字高约 22 mm')
    expect(details).toContain('姓名字高约 31 mm')

    const w = await mountApp('/')
    const text = w.text()
    expect(text).not.toContain('排版精确到毫米')
    expect(text).toContain('尺寸按毫米设定，打印后与模板标注一致')
  })
})

/** 教程开场：文章头部 quickStart 尾注 + 正文第一段（读者最先看到的两处） */
function guideOpening(g: (typeof guides)[number]): string {
  const m = /<p>([\s\S]*?)<\/p>/.exec(g.body)
  const firstParagraph = m ? m[1]!.replace(/<[^>]+>/g, '') : ''
  return `${g.quickStart?.note ?? ''}\n${firstParagraph}`
}

describe('第 366 轮：文案去模板化与伪精确数字', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    setActivePinia(createPinia())
    vi.stubGlobal('scrollTo', vi.fn())
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 404 }))
  })
  afterEach(async () => {
    mounted?.unmount()
    mounted = null
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
    await setLocale('zh')
  })

  it('首页（zh）：「每一步都按」=0，副标题改为具体能力清单', async () => {
    const w = await mountApp('/')
    const text = w.text()
    expect(count(text, '每一步都按')).toBe(0)
    expect(text).toContain('名单解析、字段映射、裁切线与出血、批量导出')
  })

  it('首页（en）：无 "every step is designed" 泛化表述，能力清单译文生效', async () => {
    await setLocale('en')
    const w = await mountApp('/en')
    const text = w.text()
    expect(text.toLowerCase()).not.toContain('every step is designed')
    expect(text).toContain('List parsing, field mapping, cut lines and bleed, batch export')
  })

  it('guides 全文「耗掉半天」=0；考场座位贴教程首段不再用伪精确人数 + 时长', () => {
    const all = guides.map((g) => `${g.title}\n${g.description}\n${g.quickStart?.note ?? ''}\n${g.body}`).join('\n')
    expect(count(all, '耗掉半天')).toBe(0)
    const exam = guides.find((g) => g.slug === 'exam-seat-label-batch-print')!
    expect(guideOpening(exam)).not.toContain('500 人')
    expect(guideOpening(exam)).toContain('名单每改一次都要从头再来')
  })

  it('教程开场（尾注 + 首段）：单篇「无需注册」≤1，全部合计 ≤6', () => {
    let total = 0
    for (const g of guides) {
      const n = count(guideOpening(g), '无需注册')
      expect(n, g.slug).toBeLessThanOrEqual(1)
      total += n
    }
    expect(total).toBeLessThanOrEqual(6)
  })

  it('按人群重写的 8 篇开场：以该人群真实起点开头，首段不再堆叠隐私/免费声明', () => {
    const rewritten: Record<string, string> = {
      'exam-seat-label-batch-print': '考前一天下午',
      'class-teacher-exam-workflow': '考前一晚',
      'parent-meeting-desk-card': '家长会通知发下去以后',
      'excel-generate-desk-cards': '报名截止那天',
      'hr-annual-meeting-materials': '年会前一周',
      'desk-sign-online-maker': '下午四点',
      'wedding-place-card-guide': '婚期前两周',
      'hotel-wedding-place-card-setup': '婚礼前一晚在酒店对桌',
    }
    for (const [slug, lead] of Object.entries(rewritten)) {
      const g = guides.find((x) => x.slug === slug)
      expect(g, slug).toBeDefined()
      const m = /<p>([\s\S]*?)<\/p>/.exec(g!.body)
      const first = m ? m[1]!.replace(/<[^>]+>/g, '') : ''
      expect(first.startsWith(lead), slug).toBe(true)
      expect(count(first, '无需注册'), slug).toBe(0)
      expect(count(first, '不出浏览器') + count(first, '不离开浏览器'), slug).toBe(0)
    }
  })
})
