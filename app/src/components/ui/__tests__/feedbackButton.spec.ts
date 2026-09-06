// @vitest-environment jsdom
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
    expect(w.find('textarea').attributes('placeholder')).toBe('请描述您遇到的问题或建议...')

    await (w.vm as unknown as { submit: () => Promise<void> }).submit()
    expect(useToastStore().toasts[0]!.title).toBe('请填写反馈内容')
  })
})
