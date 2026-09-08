import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import AdminView from '@/views/AdminView.vue'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function mountAdmin(status: number, body: unknown) {
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () => jsonResponse(body, status))
  const auth = useAuthStore()
  auth.ready = true
  const wrapper = mount(AdminView, { global: { stubs: { RouterLink: RouterLinkStub } } })
  await flushPromises()
  return { wrapper, fetchMock }
}

describe('AdminView：账号服务 503 整页 gate（第 363 轮）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('全部接口 503 auth_secret_missing → 渲染 gate 卡、不弹 danger toast、页面不出现内部错误码', async () => {
    const { wrapper } = await mountAdmin(503, {
      error: '账号服务未配置',
      code: 'auth_secret_missing',
    })
    const gate = wrapper.find('[data-testid="admin-service-unavailable"]')
    expect(gate.exists()).toBe(true)
    expect(gate.text()).toContain('账号服务暂不可用')
    expect(gate.text()).toContain('管理后台依赖账号服务，请稍后再试')
    const links = gate.findAllComponents(RouterLinkStub).map((l: { props: (name: string) => unknown }) => l.props('to'))
    expect(links).toEqual(['/', '/account'])

    expect(wrapper.text()).not.toContain('auth_secret_missing')
    expect(wrapper.text()).not.toContain('需要管理员权限')
    expect(wrapper.text()).not.toContain('加载中')
    const toast = useToastStore()
    expect(toast.toasts.filter((t) => t.type === 'danger')).toHaveLength(0)
    expect(toast.toasts).toHaveLength(0)
    expect(console.warn).toHaveBeenCalled()
  })

  it('401 仍走原「需要管理员权限」卡', async () => {
    const { wrapper } = await mountAdmin(401, { error: '未登录' })
    expect(wrapper.find('[data-testid="admin-service-unavailable"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('需要管理员权限')
    expect(useToastStore().toasts).toHaveLength(0)
  })

  it('其他 5xx（非 503）仍走 toast.danger 且不渲染 gate', async () => {
    const { wrapper } = await mountAdmin(500, { error: '服务暂时不可用，请重试' })
    expect(wrapper.find('[data-testid="admin-service-unavailable"]').exists()).toBe(false)
    const toast = useToastStore()
    expect(toast.toasts.filter((t) => t.type === 'danger')).toHaveLength(1)
  })
})
