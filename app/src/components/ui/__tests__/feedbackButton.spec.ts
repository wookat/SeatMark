// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import FeedbackButton from '@/components/ui/FeedbackButton.vue'
import { setLocale } from '@/i18n'
import { useToastStore } from '@/stores/toast'

const CJK = /[\u4e00-\u9fff]/

function mountFeedback() {
  return mount(FeedbackButton, {
    global: { stubs: { Teleport: true, Transition: true } },
  })
}

function ariaLabels(html: string): string[] {
  return [...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!)
}

describe('第 341 轮：FeedbackButton 英文化（mock fetch，不发请求）', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    await setLocale('zh')
  })

  it('en：浮动按钮 aria-label 为英文；打开弹窗后 text/aria-label/placeholder 无 CJK', async () => {
    await setLocale('en')
    const w = mountFeedback()
    expect(w.find('button[aria-label]').attributes('aria-label')).toBe('Feedback')

    await w.find('button[aria-label="Feedback"]').trigger('click')
    expect(w.text()).toContain('Send feedback')
    expect(w.text()).toContain('Feature request')
    expect(w.text()).toContain('Bug report')
    expect(w.text()).toContain('Submit feedback')
    expect(w.text()).not.toMatch(CJK)
    expect(ariaLabels(w.html()).join(' ')).not.toMatch(CJK)
    const placeholders = w.findAll('[placeholder]').map((el) => el.attributes('placeholder') ?? '')
    expect(placeholders.length).toBeGreaterThan(0)
    expect(placeholders.join(' ')).not.toMatch(CJK)
  })

  it('en：空内容提交触发的 toast 标题为英文，且不发请求', async () => {
    await setLocale('en')
    const w = mountFeedback()
    await w.find('button[aria-label="Feedback"]').trigger('click')
    const submit = w.findAll('button').find((b) => b.text().includes('Submit feedback'))
    expect(submit).toBeTruthy()
    expect(submit!.attributes('disabled')).toBeDefined()
    await (w.vm as unknown as { submit: () => Promise<void> }).submit()
    const toasts = useToastStore().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0]!.title).toBe('Please enter your feedback')
    expect(toasts[0]!.title).not.toMatch(CJK)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('en：有内容时 POST /api/feedback 的 type/page 字段与中文站一致，成功 toast 为英文', async () => {
    await setLocale('en')
    const w = mountFeedback()
    await w.find('button[aria-label="Feedback"]').trigger('click')
    await w.find('textarea').setValue('  hello  ')
    const submit = w.findAll('button').find((b) => b.text().includes('Submit feedback'))
    await submit!.trigger('click')
    await w.vm.$nextTick()
    await Promise.resolve()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/feedback')
    const body = JSON.parse(String(init.body)) as Record<string, string>
    expect(body).toEqual({
      type: 'suggestion',
      content: 'hello',
      contact: '',
      page: window.location.pathname,
    })
    const toasts = useToastStore().toasts
    expect(toasts.at(-1)!.title).toBe('Thanks for your feedback!')
  })

  it('zh：文案与现状一致', async () => {
    await setLocale('zh')
    const w = mountFeedback()
    expect(w.find('button[aria-label]').attributes('aria-label')).toBe('反馈')
    await w.find('button[aria-label="反馈"]').trigger('click')
    expect(w.text()).toContain('意见反馈')
    expect(w.text()).toContain('功能建议')
    expect(w.text()).toContain('问题反馈')
    expect(w.text()).toContain('其他')
    expect(w.text()).toContain('反馈类型')
    expect(w.text()).toContain('反馈内容')
    expect(w.text()).toContain('提交反馈')
    expect(w.find('textarea').attributes('placeholder')).toBe('请描述你遇到的问题或建议...')

    await (w.vm as unknown as { submit: () => Promise<void> }).submit()
    expect(useToastStore().toasts[0]!.title).toBe('请填写反馈内容')
  })
})

describe('第 353 轮：窄屏向下滚动收起反馈气泡（不常驻压住右对齐行内按钮）', () => {
  function scrollTo(y: number) {
    Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true })
    window.dispatchEvent(new Event('scroll'))
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true })
  })

  it('初始常驻；向下滚动后 data-collapsed=true 且带 tablet-down:opacity-0 / pointer-events-none；停住不自动恢复', async () => {
    const w = mountFeedback()
    const btn = w.get('button[aria-label="反馈"]')
    expect(btn.attributes('data-collapsed')).toBe('false')
    expect(btn.classes()).not.toContain('tablet-down:opacity-0')

    scrollTo(300)
    await w.vm.$nextTick()
    expect(btn.attributes('data-collapsed')).toBe('true')
    expect(btn.classes()).toContain('tablet-down:opacity-0')
    expect(btn.classes()).toContain('tablet-down:pointer-events-none')

    scrollTo(301)
    await w.vm.$nextTick()
    expect(btn.attributes('data-collapsed')).toBe('true')
    w.unmount()
  })

  it('向上滚动即恢复；回到页顶 scrollY<80 也恢复', async () => {
    const w = mountFeedback()
    const btn = w.get('button[aria-label="反馈"]')
    scrollTo(600)
    await w.vm.$nextTick()
    expect(btn.attributes('data-collapsed')).toBe('true')

    scrollTo(560)
    await w.vm.$nextTick()
    expect(btn.attributes('data-collapsed')).toBe('false')

    scrollTo(900)
    await w.vm.$nextTick()
    expect(btn.attributes('data-collapsed')).toBe('true')
    scrollTo(40)
    await w.vm.$nextTick()
    expect(btn.attributes('data-collapsed')).toBe('false')
    w.unmount()
  })

  it('收起只作用于窄屏：桌面尺寸 class 保持 size-12，隐藏 class 全部带 tablet-down: 前缀（≥md 常驻）', async () => {
    const w = mountFeedback()
    scrollTo(500)
    await w.vm.$nextTick()
    const btn = w.get('button[aria-label="反馈"]')
    expect(btn.classes()).toContain('size-12')
    const hiding = btn.classes().filter((c) => /opacity-0|pointer-events-none|translate-y/.test(c))
    expect(hiding.length).toBeGreaterThan(0)
    expect(hiding.every((c) => c.startsWith('tablet-down:'))).toBe(true)
    expect(btn.classes().some((c) => c.startsWith('max-sm:'))).toBe(false)
    w.unmount()
  })
})

describe('第 366 轮：让位范围扩到 ≤768px（tablet-down 变体，matchMedia 模拟）', () => {
  function scrollTo(y: number) {
    Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true })
    window.dispatchEvent(new Event('scroll'))
  }

  /** 模拟视口宽度 width：innerWidth + matchMedia（tablet-down = (width <= 768px)，Tailwind max-md = (width < 48rem)） */
  function stubViewport(width: number) {
    Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true })
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => {
        const lt = /width\s*<\s*([\d.]+)rem/.exec(query)
        const le = /width\s*<=\s*([\d.]+)px/.exec(query)
        const max = /max-width:\s*([\d.]+)px/.exec(query)
        const min = /min-width:\s*([\d.]+)px/.exec(query)
        let matches = false
        if (le) matches = width <= Number(le[1])
        else if (lt) matches = width < Number(lt[1]) * 16
        else if (max) matches = width <= Number(max[1])
        else if (min) matches = width >= Number(min[1])
        return { matches, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false } as unknown as MediaQueryList
      }),
    )
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('767px：向下滚动后 collapsed，隐藏 class 为 tablet-down:（该档命中），尺寸 class 为 tablet-down:size-10', async () => {
    stubViewport(767)
    expect(window.matchMedia('(width <= 768px)').matches).toBe(true)
    const w = mountFeedback()
    const btn = w.get('button[aria-label="反馈"]')
    expect(btn.classes()).toContain('tablet-down:size-10')
    expect(btn.classes()).toContain('tablet-down:right-3')
    scrollTo(400)
    await w.vm.$nextTick()
    expect(btn.attributes('data-collapsed')).toBe('true')
    expect(btn.classes()).toContain('tablet-down:opacity-0')
    expect(btn.classes()).toContain('tablet-down:pointer-events-none')
    expect(btn.classes()).toContain('tablet-down:translate-y-2')
    w.unmount()
  })

  it('textarea 聚焦后收起（data-input-focused=true + tablet-down 隐藏 class）；失焦后恢复', async () => {
    stubViewport(767)
    const ta = document.createElement('textarea')
    document.body.appendChild(ta)
    const w = mountFeedback()
    const btn = w.get('button[aria-label="反馈"]')
    expect(btn.attributes('data-collapsed')).toBe('false')

    ta.focus()
    document.dispatchEvent(new Event('focusin'))
    await w.vm.$nextTick()
    expect(btn.attributes('data-input-focused')).toBe('true')
    expect(btn.attributes('data-collapsed')).toBe('true')
    expect(btn.classes()).toContain('tablet-down:opacity-0')

    ta.blur()
    document.dispatchEvent(new Event('focusout'))
    await w.vm.$nextTick()
    expect(btn.attributes('data-input-focused')).toBe('false')
    expect(btn.attributes('data-collapsed')).toBe('false')
    expect(btn.classes()).not.toContain('tablet-down:opacity-0')
    ta.remove()
    w.unmount()
  })

  it('回到页顶（scrollY < 80）恢复常驻', async () => {
    stubViewport(767)
    const w = mountFeedback()
    const btn = w.get('button[aria-label="反馈"]')
    scrollTo(800)
    await w.vm.$nextTick()
    expect(btn.attributes('data-collapsed')).toBe('true')
    scrollTo(20)
    await w.vm.$nextTick()
    expect(btn.attributes('data-collapsed')).toBe('false')
    expect(btn.classes()).not.toContain('tablet-down:pointer-events-none')
    w.unmount()
  })

  it('768px（iPad 竖屏）：tablet-down 命中（max-md 不命中），滚动后仍收起；769px 起为桌面常驻', async () => {
    stubViewport(768)
    expect(window.matchMedia('(width <= 768px)').matches).toBe(true)
    expect(window.matchMedia('(width < 48rem)').matches).toBe(false)
    const w = mountFeedback()
    const btn = w.get('button[aria-label="反馈"]')
    scrollTo(400)
    await w.vm.$nextTick()
    expect(btn.attributes('data-collapsed')).toBe('true')
    expect(btn.classes()).toContain('tablet-down:opacity-0')
    expect(btn.classes()).toContain('tablet-down:pointer-events-none')
    expect(btn.classes()).toContain('tablet-down:size-10')
    // 隐藏 class 全部限定在 tablet-down: 前缀内：>768px 桌面不受影响，基础 size-12 保持
    const hiding = btn.classes().filter((c) => /opacity-0|pointer-events-none|translate-y/.test(c))
    expect(hiding.every((c) => c.startsWith('tablet-down:'))).toBe(true)
    expect(btn.classes()).toContain('size-12')
    expect(btn.classes().some((c) => /^(opacity-0|pointer-events-none|md:opacity-0|lg:opacity-0)$/.test(c))).toBe(false)
    w.unmount()

    stubViewport(769)
    expect(window.matchMedia('(width <= 768px)').matches).toBe(false)
  })

  it('main.css 定义 tablet-down 变体为 (width <= 768px)，FeedbackButton 不再使用 max-md/max-sm 让位', () => {
    const css = readFileSync(resolve(__dirname, '../../../assets/main.css'), 'utf8')
    expect(css).toMatch(/@custom-variant tablet-down \(@media \(width <= 768px\)\);/)
    const sfc = readFileSync(resolve(__dirname, '../FeedbackButton.vue'), 'utf8')
    expect(sfc).not.toMatch(/max-(sm|md):/)
    expect(sfc).toContain('tablet-down:opacity-0')
  })
})
