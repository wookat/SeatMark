// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import GuidesView from '@/views/GuidesView.vue'

async function mountGuides() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/guides', component: GuidesView },
      { path: '/:rest(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push('/guides')
  await router.isReady()
  const wrapper = mount(GuidesView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('GuidesView 移动端筛选折叠', () => {
  it('默认折叠：外层 sticky top-14、折叠行 h-12、面板 hidden；展开后外层 static、面板 grid', async () => {
    const wrapper = await mountGuides()
    const bar = wrapper.get('[data-testid="guides-filter-bar"]')
    const row = wrapper.get('[data-testid="guides-filter-toggle-row"]')
    const panel = wrapper.get('[data-testid="guides-filter-panel"]')
    const toggle = wrapper.get('[data-testid="guides-filter-toggle"]')

    expect(bar.classes()).toEqual(expect.arrayContaining(['sticky', 'top-14']))
    expect(bar.classes()).toContain('min-[769px]:static')
    expect(row.classes()).toEqual(expect.arrayContaining(['h-12', 'min-[769px]:hidden']))
    expect(panel.classes()).toContain('hidden')
    expect(panel.classes()).toContain('min-[769px]:grid')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(toggle.text()).toContain('筛选')
    expect(toggle.text()).not.toContain('已选')

    await toggle.trigger('click')
    expect(bar.classes()).toContain('static')
    expect(bar.classes()).not.toContain('sticky')
    expect(panel.classes()).toContain('grid')
    expect(panel.classes()).not.toContain('hidden')
    expect(toggle.attributes('aria-expanded')).toBe('true')

    // 展开态可正常筛选：点一个主题后折叠行显示「已选 1 项」与可清除的标签
    const topic = panel.findAll('button').find((b) => b.text() !== '全部' && b.text().length > 0)
    expect(topic).toBeTruthy()
    await topic!.trigger('click')
    expect(toggle.text()).toContain('已选')
    expect(toggle.text()).toContain('1')
    const chips = wrapper.get('[data-testid="guides-filter-chips"]')
    expect(chips.findAll('button')).toHaveLength(1)
    expect(chips.text()).toContain(topic!.text())

    await chips.find('button').trigger('click')
    expect(wrapper.find('[data-testid="guides-filter-chips"]').exists()).toBe(false)
    expect(toggle.text()).not.toContain('已选')

    await toggle.trigger('click')
    expect(bar.classes()).toContain('sticky')
    expect(panel.classes()).toContain('hidden')
    wrapper.unmount()
  })
})
