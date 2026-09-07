// @vitest-environment jsdom
/**
 * 第 345 轮：账号服务不可用（auth.serviceUnavailable）时，定价页 / 配额弹窗 / 页脚 / 导出选择框
 * 的「注册送 7 天专业版」利益点替换为中性文案并隐藏注册 CTA；恢复正常时原文案照常渲染。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import PreviewArea from '@/components/studio/PreviewArea.vue'
import AppFooter from '@/components/ui/AppFooter.vue'
import QuotaLimitDialog from '@/components/ui/QuotaLimitDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useQuotaStore } from '@/stores/quota'
import { useWorkspaceStore } from '@/stores/workspace'
import PricingView from '@/views/PricingView.vue'

const NEUTRAL = '账号服务维护中，带水印导出不限次'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const stubs = {
  RouterLink: RouterLinkStub,
  Teleport: true,
  Transition: true,
  LabelSheet: true,
  CalibrationDialog: true,
  DuplexGuideDialog: true,
}

describe('第 345 轮：账号服务不可用降级文案', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  })

  describe('PricingView', () => {
    it('挂载时若 ready 且未探测过则只 GET 一次 /api/auth/me；503 后隐藏注册送 7 天并显示中性文案', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = String(input)
        if (url.endsWith('/api/auth/me')) {
          expect((init?.method ?? 'GET').toUpperCase()).toBe('GET')
          return jsonResponse({ error: '账号服务未配置', code: 'auth_secret_missing' }, 503)
        }
        return jsonResponse({}, 404)
      })
      const auth = useAuthStore()
      auth.ready = true
      const wrapper = mount(PricingView, { global: { stubs } })
      await flushPromises()

      const meCalls = fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/api/auth/me'))
      expect(meCalls).toHaveLength(1)
      expect(auth.serviceUnavailable).toBe(true)
      expect(auth.probed).toBe(true)

      expect(wrapper.text()).not.toContain('注册送 7 天')
      expect(wrapper.text()).not.toContain('注册领 7 天试用')
      expect(wrapper.text()).toContain(NEUTRAL)
      expect(wrapper.find('[data-testid="pricing-pro-cta"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="pricing-pro-cta-degraded"]').exists()).toBe(true)
      // 定价不变：专业版原价 ¥19、团队版 ¥49
      expect(wrapper.text()).toContain('¥19')
      expect(wrapper.text()).toContain('¥49')

      // 再次挂载不重复探测
      mount(PricingView, { global: { stubs } })
      await flushPromises()
      expect(
        fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/api/auth/me')),
      ).toHaveLength(1)
    })

    it('服务正常时渲染注册送 7 天利益点与注册 CTA', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        if (String(input).endsWith('/api/auth/me')) return jsonResponse({ user: null })
        return jsonResponse({}, 404)
      })
      const auth = useAuthStore()
      auth.ready = true
      const wrapper = mount(PricingView, { global: { stubs } })
      await flushPromises()
      expect(auth.serviceUnavailable).toBe(false)
      expect(wrapper.text()).toContain('注册送 7 天')
      expect(wrapper.text()).toContain('注册领 7 天试用')
      expect(wrapper.text()).not.toContain(NEUTRAL)
      expect(wrapper.find('[data-testid="pricing-pro-cta"]').exists()).toBe(true)
    })

    it('ready 为 false 时挂载不探测（由 App bootstrap 负责首次登录态）', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}, 404))
      mount(PricingView, { global: { stubs } })
      await flushPromises()
      expect(fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/api/auth/me'))).toHaveLength(0)
    })
  })

  describe('QuotaLimitDialog', () => {
    async function mountDialog(unavailable: boolean) {
      const auth = useAuthStore()
      auth.serviceUnavailable = unavailable
      const quota = useQuotaStore()
      quota.limitDialogOpen = true
      const wrapper = mount(QuotaLimitDialog, { global: { stubs }, attachTo: document.body })
      await flushPromises()
      return wrapper
    }

    it('serviceUnavailable=true：隐藏注册/登录利益点与 CTA，显示中性文案', async () => {
      const wrapper = await mountDialog(true)
      expect(wrapper.find('[data-testid="quota-service-unavailable"]').text()).toBe(NEUTRAL)
      expect(wrapper.text()).not.toContain('注册即送 7 天')
      expect(wrapper.text()).not.toContain('免费登录')
      expect(wrapper.findAllComponents(RouterLinkStub)).toHaveLength(0)
      expect(wrapper.text()).toContain('带水印导出永远免费')
      wrapper.unmount()
    })

    it('serviceUnavailable=false：原利益点与登录 CTA 照常', async () => {
      const wrapper = await mountDialog(false)
      expect(wrapper.find('[data-testid="quota-service-unavailable"]').exists()).toBe(false)
      expect(wrapper.text()).toContain('注册即送 7 天')
      expect(wrapper.findAllComponents(RouterLinkStub).length).toBeGreaterThan(0)
      wrapper.unmount()
    })
  })

  describe('AppFooter', () => {
    it('定价链接文案随 serviceUnavailable 切换', async () => {
      const auth = useAuthStore()
      auth.serviceUnavailable = true
      const degraded = mount(AppFooter, { global: { stubs } })
      await flushPromises()
      expect(degraded.text()).not.toContain('注册送 7 天')
      expect(degraded.text()).toContain('定价')

      auth.serviceUnavailable = false
      await flushPromises()
      expect(degraded.text()).toContain('定价（注册送 7 天专业版）')
    })
  })

  describe('PreviewArea 导出选择框', () => {
    async function openExportChoice() {
      const workspace = useWorkspaceStore()
      workspace.useDemoData()
      const wrapper = mount(PreviewArea, { global: { stubs }, attachTo: document.body })
      await wrapper.vm.$nextTick()
      const exportBtn = wrapper
        .findAll('button')
        .find((b) => b.text().includes('导出 PDF') || (b.attributes('title') ?? '').includes('逐页渲染'))
      expect(exportBtn).toBeTruthy()
      await exportBtn!.trigger('click')
      await wrapper.vm.$nextTick()
      return wrapper
    }

    it('serviceUnavailable=true：未登录提示改为中性文案', async () => {
      useAuthStore().serviceUnavailable = true
      const wrapper = await openExportChoice()
      expect(wrapper.find('[data-testid="export-service-unavailable"]').text()).toBe(NEUTRAL)
      expect(wrapper.text()).not.toContain('注册即送 7 天')
      wrapper.unmount()
    })

    it('serviceUnavailable=false：原「注册即送 7 天」提示照常', async () => {
      useAuthStore().serviceUnavailable = false
      const wrapper = await openExportChoice()
      expect(wrapper.find('[data-testid="export-service-unavailable"]').exists()).toBe(false)
      expect(wrapper.text()).toContain('注册即送 7 天')
      wrapper.unmount()
    })
  })
})
