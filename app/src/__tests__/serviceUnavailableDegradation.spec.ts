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
import { faqMentionsAccountBonus, PRICING_FAQS } from '@/data/seo'
import { useAuthStore } from '@/stores/auth'
import { useQuotaStore } from '@/stores/quota'
import { useWorkspaceStore } from '@/stores/workspace'
import { AUTH_MAINTENANCE_HINT } from '@/utils/maintenanceCopy'
import PricingView from '@/views/PricingView.vue'

/** 第 364 轮：定价页三处与配额弹窗统一为同一句短文案 */
const NEUTRAL = AUTH_MAINTENANCE_HINT
const PRICING_CARD_HINT = AUTH_MAINTENANCE_HINT
/** 导出弹窗：维护说明挂在「无水印导出」选项内，不再在弹窗底部重复 */
const EXPORT_HINT = '登录暂不可用（服务维护中），暂无法登录领取更多次数；下方带水印导出与打印不受影响'

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
      // 第 348 轮：权益卡与含「注册送 7 天」承诺的 FAQ 旁出现弱提示；
      // 第 363 轮：卡内不再重复 features bullet，卡底一条合并文案；
      // 第 366 轮：FAQ 区聚合为标题下方恰 1 条，不再逐条 FAQ 重复
      const hints = wrapper.findAll('[data-testid="pricing-maintenance-hint"]')
      expect(hints).toHaveLength(2)
      const cards = wrapper.findAll('[data-testid="pricing-plan-card"]')
      expect(cards).toHaveLength(3)
      const cardHints = cards.flatMap((c) => c.findAll('[data-testid="pricing-maintenance-hint"]'))
      expect(cardHints).toHaveLength(1)
      expect(cardHints[0]!.text()).toBe(PRICING_CARD_HINT)
      for (const c of cards) expect(c.findAll('li').filter((li) => li.text() === NEUTRAL)).toHaveLength(0)
      const faqHints = hints.filter((h) => !cards.some((c) => c.element.contains(h.element)))
      expect(faqHints).toHaveLength(1)
      expect(faqHints[0]!.text()).toBe(NEUTRAL)
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
      expect(wrapper.find('[data-testid="pricing-maintenance-hint"]').exists()).toBe(false)
    })

    it('ready 为 false 时挂载不探测（由 App bootstrap 负责首次登录态）', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}, 404))
      mount(PricingView, { global: { stubs } })
      await flushPromises()
      expect(fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/api/auth/me'))).toHaveLength(0)
    })

    it('直接落地 /pricing：挂载时 ready 为 false，App bootstrap 置 ready 后补探一次并切换降级文案', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        if (String(input).endsWith('/api/auth/me')) {
          return jsonResponse({ error: '账号服务未配置', code: 'auth_secret_missing' }, 503)
        }
        return jsonResponse({}, 404)
      })
      const auth = useAuthStore()
      const wrapper = mount(PricingView, { global: { stubs } })
      await flushPromises()
      expect(fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/api/auth/me'))).toHaveLength(0)
      expect(wrapper.text()).toContain('注册送 7 天')

      // 匿名访客 bootstrap：不发请求，直接 ready
      await auth.bootstrap()
      await flushPromises()
      expect(fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/api/auth/me'))).toHaveLength(1)
      expect(auth.serviceUnavailable).toBe(true)
      expect(wrapper.text()).not.toContain('注册送 7 天')
      expect(wrapper.text()).toContain(NEUTRAL)
      expect(wrapper.find('[data-testid="pricing-pro-cta-degraded"]').exists()).toBe(true)
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
      const hint = wrapper.find('[data-testid="export-service-unavailable"]')
      expect(hint.text()).toBe(EXPORT_HINT)
      expect(wrapper.find('[data-testid="choose-clean"]').element.contains(hint.element)).toBe(true)
      expect(wrapper.text().split('服务维护中').length - 1).toBe(1)
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

describe('第 365 轮：定价页「分享送次数」维护期注记', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('faqMentionsAccountBonus：注册(即)?送 / 分享…送|得|+1 为真；无账号赠送承诺为假', () => {
    expect(faqMentionsAccountBonus('邮箱注册即送 7 天专业版试用')).toBe(true)
    expect(faqMentionsAccountBonus('新用户注册送 7 天')).toBe(true)
    expect(faqMentionsAccountBonus('分享专属链接——每被点开 1 次即得 1 次无水印导出')).toBe(true)
    expect(faqMentionsAccountBonus('分享给同事可再送次数')).toBe(true)
    expect(faqMentionsAccountBonus('分享链接每次打开 +1 次')).toBe(true)
    expect(faqMentionsAccountBonus('带水印导出与打印完全不限次数')).toBe(false)
    expect(faqMentionsAccountBonus('名单全程浏览器本地处理，不上传任何服务器')).toBe(false)
    expect(faqMentionsAccountBonus('团队版可在定价页预订登记，开通后邮件通知')).toBe(false)
    // 真实 FAQ：「无水印次数用完了怎么办」因「分享…得」命中；「带水印和无水印区别」不命中
    const byQ = (q: string) => PRICING_FAQS.find((f) => f.q === q)!.a
    expect(faqMentionsAccountBonus(byQ('无水印次数用完了怎么办？'))).toBe(true)
    expect(faqMentionsAccountBonus(byQ('带水印和无水印导出有什么区别？'))).toBe(false)
    expect(faqMentionsAccountBonus(byQ('我的名单数据安全吗？'))).toBe(false)
  })

  it('维护态：免费版卡「分享送次数」bullet 尾注恰 1 处；FAQ 区标题下灰字恰 1 处（不逐条重复）；恢复后全部消失', async () => {
    const auth = useAuthStore()
    auth.ready = false
    auth.serviceUnavailable = true
    const wrapper = mount(PricingView, { global: { stubs } })
    await flushPromises()

    const cards = wrapper.findAll('[data-testid="pricing-plan-card"]')
    const freeBullets = cards[0]!.findAll('li').map((li) => li.text())
    const shareBullets = freeBullets.filter((b) => b.includes('分享链接每被点开 1 次'))
    expect(shareBullets).toHaveLength(1)
    expect(shareBullets[0]).toBe('分享链接每被点开 1 次即得 1 次无水印导出（服务维护中暂不可用）')
    expect(freeBullets.filter((b) => b.includes('服务维护中'))).toHaveLength(1)
    expect(cards[0]!.findAll('[data-testid="pricing-maintenance-hint"]')).toHaveLength(0)
    expect(freeBullets).toHaveLength(6)

    const faqBoxes = wrapper.findAll('h3').map((h) => h.element.parentElement!)
    for (const box of faqBoxes) {
      expect(box.querySelectorAll('[data-testid="pricing-maintenance-hint"]')).toHaveLength(0)
    }
    const faqSection = wrapper.findAll('h2').find((h) => h.text() === '定价常见问题')!.element.parentElement!
    const faqHints = faqSection.querySelectorAll('[data-testid="pricing-maintenance-hint"]')
    expect(faqHints).toHaveLength(1)
    expect(faqHints[0]!.textContent?.trim()).toBe(NEUTRAL)
    // 标题下方、FAQ 列表之前
    const h2 = faqSection.querySelector('h2')!
    expect(h2.compareDocumentPosition(faqHints[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(faqHints[0]!.compareDocumentPosition(faqBoxes[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    auth.serviceUnavailable = false
    await flushPromises()
    expect(wrapper.text()).not.toContain('服务维护中')
    expect(wrapper.find('[data-testid="pricing-maintenance-hint"]').exists()).toBe(false)
    expect(
      cards[0]!.findAll('li').map((li) => li.text()),
    ).toContain('分享链接每被点开 1 次即得 1 次无水印导出')
    wrapper.unmount()
  })
})
