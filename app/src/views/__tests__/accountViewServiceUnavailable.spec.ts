import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
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

  it('me/captcha 返回 503 时只渲染降级卡：整张表单不渲染，卡内有返回工坊链接', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => routeMock(String(input)))
    const wrapper = mount(AccountView, { global: { stubs: { RouterLink: RouterLinkStub } } })
    await flushPromises()

    const notice = wrapper.find('[data-testid="auth-service-unavailable"]')
    expect(notice.exists()).toBe(true)
    expect(notice.text()).toContain('账号服务暂时不可用，稍后再试')
    expect(notice.text()).toContain('导出与打印不受影响')
    expect(notice.text()).toContain('返回工坊')
    expect(
      notice.findComponent(RouterLinkStub).props('to'),
    ).toBe('/studio')

    // 登录/注册/找回整张表单不渲染
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
    expect(wrapper.find('input[type="email"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('加载失败')
    expect(wrapper.text()).not.toContain('7 天专业版')
    expect(wrapper.text()).toContain('账号服务维护中，带水印导出不限次')

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
    const wrapper = mount(AccountView, { global: { stubs: { RouterLink: RouterLinkStub } } })
    await flushPromises()
    expect(wrapper.find('[data-testid="auth-service-unavailable"]').exists()).toBe(false)
    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('form img').exists()).toBe(true)
  })
})
