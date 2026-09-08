// @vitest-environment jsdom
/**
 * 第 346 轮：首页与教程摘要营销化表达收敛护栏。
 * 首页渲染文本「一键」≤1、「毫米级」≤1、「思路很简单」=0、「几分钟」=0；
 * 教程 title/description 合计「一键」≤1（/guides 索引页一屏可见）、「思路很简单」=0、「几分钟」=0。
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
