// @vitest-environment jsdom
/**
 * 第 369 轮：反馈浮层提交改走统一 apiFetch/ApiError（15s 超时 + 错误码→文案）——
 * 成功清空表单；失败（503 / 超时 / 网络异常 / 4xx）toast 分别给可理解文案且表单内容保留。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import FeedbackButton from '@/components/ui/FeedbackButton.vue'
import { setLocale } from '@/i18n'
import { useToastStore } from '@/stores/toast'
import { API_TIMEOUT_MESSAGE, API_TIMEOUT_STATUS, ApiError } from '@/utils/api'

const apiFetch = vi.fn()
vi.mock('@/utils/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/utils/api')>()
  return {
    ...mod,
    apiFetch: (...args: Parameters<typeof mod.apiFetch>) => apiFetch(...args),
  }
})

function mountFeedback() {
  return mount(FeedbackButton, {
    global: { stubs: { Teleport: true, Transition: true } },
  })
}

async function openAndFill(w: ReturnType<typeof mountFeedback>, content: string, contact = '') {
  await w.find('button[aria-label="反馈"]').trigger('click')
  await w.find('textarea').setValue(content)
  if (contact) await w.find('input[type="text"]').setValue(contact)
}

async function clickSubmit(w: ReturnType<typeof mountFeedback>) {
  const submit = w.findAll('button').find((b) => b.text().includes('提交反馈'))
  expect(submit).toBeTruthy()
  await submit!.trigger('click')
  await new Promise((r) => setTimeout(r, 0))
  await w.vm.$nextTick()
}

const fetchSpy = vi.fn()

beforeEach(() => {
  setActivePinia(createPinia())
  apiFetch.mockReset()
  fetchSpy.mockReset()
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await setLocale('zh')
})

describe('第 369 轮：FeedbackButton 走 apiFetch', () => {
  it('成功：apiFetch POST /api/feedback 请求体不变 → 成功 toast、弹窗关闭并清空表单；不再有裸 fetch', async () => {
    apiFetch.mockResolvedValue({ ok: true })
    const w = mountFeedback()
    await openAndFill(w, '  排座很好用  ', 'me@example.com')
    await clickSubmit(w)

    expect(apiFetch).toHaveBeenCalledTimes(1)
    expect(apiFetch.mock.calls[0]).toEqual([
      '/api/feedback',
      {
        method: 'POST',
        body: { type: 'suggestion', content: '排座很好用', contact: 'me@example.com', page: window.location.pathname },
      },
    ])
    expect(fetchSpy).not.toHaveBeenCalled()
    const toasts = useToastStore().toasts
    expect(toasts.at(-1)).toMatchObject({ type: 'success', title: '感谢反馈！', text: '已收到你的意见' })
    // 弹窗已关闭、表单已清空
    expect(w.find('textarea').exists()).toBe(false)
    await w.find('button[aria-label="反馈"]').trigger('click')
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('')
    expect((w.find('input[type="text"]').element as HTMLInputElement).value).toBe('')
    w.unmount()
  })

  it('ApiError(503) → 失败 toast「服务暂时不可用，请稍后重试」，表单内容与联系方式保留、弹窗不关', async () => {
    apiFetch.mockRejectedValue(new ApiError(503, '服务暂时不可用，请重试'))
    const w = mountFeedback()
    await openAndFill(w, '导出失败了', '138')
    await clickSubmit(w)

    const toasts = useToastStore().toasts
    expect(toasts.at(-1)).toMatchObject({ type: 'danger', title: '提交失败', text: '服务暂时不可用，请稍后重试' })
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('导出失败了')
    expect((w.find('input[type="text"]').element as HTMLInputElement).value).toBe('138')
    const submit = w.findAll('button').find((b) => b.text().includes('提交反馈'))
    expect(submit!.attributes('disabled')).toBeUndefined()
    w.unmount()
  })

  it('超时（apiFetch 抛 ApiError 408 请求超时）→ 提示「网络超时，请稍后重试」，表单保留', async () => {
    apiFetch.mockRejectedValue(new ApiError(API_TIMEOUT_STATUS, API_TIMEOUT_MESSAGE))
    const w = mountFeedback()
    await openAndFill(w, '页面卡住')
    await clickSubmit(w)
    expect(useToastStore().toasts.at(-1)).toMatchObject({ type: 'danger', title: '提交失败', text: '网络超时，请稍后重试' })
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('页面卡住')
    w.unmount()
  })

  it('网络异常（fetch 抛 TypeError，非 ApiError）→ 「网络异常，请检查网络后重试」；4xx 照搬服务端可读错误', async () => {
    apiFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const w = mountFeedback()
    await openAndFill(w, '离线了')
    await clickSubmit(w)
    expect(useToastStore().toasts.at(-1)!.text).toBe('网络异常，请检查网络后重试')

    apiFetch.mockRejectedValueOnce(new ApiError(429, '今日反馈次数已达上限，请明天再试'))
    await clickSubmit(w)
    expect(useToastStore().toasts.at(-1)!.text).toBe('今日反馈次数已达上限，请明天再试')
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('离线了')
    w.unmount()
  })

  it('en：失败文案为英文', async () => {
    await setLocale('en')
    apiFetch.mockRejectedValue(new ApiError(API_TIMEOUT_STATUS, API_TIMEOUT_MESSAGE))
    const w = mountFeedback()
    await w.find('button[aria-label="Feedback"]').trigger('click')
    await w.find('textarea').setValue('slow')
    const submit = w.findAll('button').find((b) => b.text().includes('Submit feedback'))
    await submit!.trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(useToastStore().toasts.at(-1)).toMatchObject({
      title: 'Submission failed',
      text: 'Network timed out, please try again later',
    })
    w.unmount()
  })

  it('源码审查：FeedbackButton.vue 不再直接调用 fetch(，且不新增任何上传路径', () => {
    const sfc = readFileSync(resolve(__dirname, '../FeedbackButton.vue'), 'utf8')
    expect(sfc).not.toMatch(/\bfetch\(/)
    expect(sfc).toContain("apiFetch('/api/feedback'")
    expect(sfc.match(/apiFetch\(/g)).toHaveLength(1)
  })
})
