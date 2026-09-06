// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import BanquetView from '@/views/BanquetView.vue'
import SeatingView from '@/views/SeatingView.vue'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/banquet', component: BanquetView },
      { path: '/seating', component: SeatingView },
      { path: '/studio', component: { template: '<div />' } },
    ],
  })
}

async function mountView(component: typeof BanquetView | typeof SeatingView) {
  const router = makeRouter()
  const wrapper = mount(component, {
    global: { plugins: [router], stubs: { Teleport: true, Transition: true } },
    attachTo: document.body,
  })
  await wrapper.vm.$nextTick()
  return wrapper
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  Element.prototype.scrollIntoView = vi.fn()
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('BanquetView 空状态 CTA', () => {
  it('0 位宾客时摘要显示「尚未导入宾客」并渲染两颗 CTA；载入示例后 24 人 3 组且 CTA 消失', async () => {
    const wrapper = await mountView(BanquetView)
    const summary = wrapper.find('[data-banquet-summary]')
    expect(summary.text()).toContain('尚未导入宾客')
    expect(summary.text()).not.toContain('已安排 0/0')
    expect(wrapper.text()).not.toContain('全部宾客都已安排上桌。')

    const cta = wrapper.find('[data-testid="banquet-empty-cta"]')
    expect(cta.exists()).toBe(true)
    const buttons = cta.findAll('button')
    expect(buttons.map((b) => b.text())).toEqual(['粘贴名单', '载入示例'])

    await buttons[0]!.trigger('click')
    expect(document.activeElement?.tagName).toBe('TEXTAREA')

    await buttons[1]!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="banquet-empty-cta"]').exists()).toBe(false)
    expect(wrapper.find('[data-banquet-summary]').text()).toContain('已安排 0/24')
    const guestInputs = wrapper.findAll('input[aria-label="宾客姓名"]')
    expect(guestInputs).toHaveLength(24)
    expect(wrapper.findAll('input[aria-label="分组名称"]')).toHaveLength(3)

    wrapper.unmount()
  })
})

describe('SeatingView 空状态 CTA', () => {
  it('0 人时在「排 × 列 · 0 人」旁渲染 CTA；载入示例后座位自动生成且 CTA 消失', async () => {
    const wrapper = await mountView(SeatingView)
    const cta = wrapper.find('[data-testid="seating-empty-cta"]')
    expect(cta.exists()).toBe(true)
    expect(cta.text()).toMatch(/6 排 × 8 列 · 0 人/)
    const buttons = cta.findAll('button')
    expect(buttons.map((b) => b.text())).toEqual(['粘贴名单', '载入示例'])

    await buttons[0]!.trigger('click')
    expect(document.activeElement?.tagName).toBe('TEXTAREA')

    await buttons[1]!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="seating-empty-cta"]').exists()).toBe(false)
    const named = wrapper.findAll('.seating-seat-name').filter((el) => el.text() !== '—')
    expect(named.length).toBeGreaterThan(0)
    expect(wrapper.text()).toContain('6 排 × 8 列 · 48 人')

    wrapper.unmount()
  })
})
