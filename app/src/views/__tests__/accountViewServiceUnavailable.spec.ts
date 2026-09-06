import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AccountView from '@/views/AccountView.vue'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function routeMock(url: string): Response {
  if (url.endsWith('/api/auth/me')) {
    return jsonResponse({ error: '账号服务未配置', code: 'auth_secret_missing' }, 503)
  }
  if (url.endsWith('/api/auth/captcha')) {
    return jsonResponse({ error: '账号服务未配置', code: 'auth_secret_missing' }, 503)
  }
  return jsonResponse({}, 404)
}

describe('AccountView：账号服务 503 分支', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('me/captcha 返回 503 时显示服务提示、禁用提交、验证码区不显示裸失败态', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => routeMock(String(input)))
    const wrapper = mount(AccountView)
    await flushPromises()

    const notice = wrapper.find('[data-testid="auth-service-unavailable"]')
    expect(notice.exists()).toBe(true)
    expect(notice.text()).toContain('账号服务暂时不可用，稍后再试')
    expect(notice.text()).toContain('导出与打印不受影响')

    const submit = wrapper.find('button[type="submit"]')
    expect(submit.attributes('disabled')).toBeDefined()

    expect(wrapper.text()).toContain('暂不可用')
    expect(wrapper.text()).not.toContain('加载失败')

    // 挂载时无条件确认登录态 + 拉取验证码
    const urls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(urls).toContain('/api/auth/me')
    expect(urls).toContain('/api/auth/captcha')
  })

  it('服务正常时不渲染提示条，提交按钮可用', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith('/api/auth/me')) return jsonResponse({ user: null })
      if (url.endsWith('/api/auth/captcha')) {
        return jsonResponse({ image: 'data:image/svg+xml;base64,PHN2Zy8+', token: 'tok' })
      }
      return jsonResponse({}, 404)
    })
    const wrapper = mount(AccountView)
    await flushPromises()
    expect(wrapper.find('[data-testid="auth-service-unavailable"]').exists()).toBe(false)
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('form img').exists()).toBe(true)
  })
})
