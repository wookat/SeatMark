// @vitest-environment jsdom
/**
 * 第 351 轮：模板库 <640px 吸顶筛选区瘦身——吸顶区只剩一行横向滚动分类 chips + 「筛选 (N)」按钮，
 * 搜索框 / 子分类折进按钮展开的非吸顶面板；≥640px 维持原多行布局。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import { templateDetails } from '@/data/templateDetails'
import { defaultTemplates } from '@/data/defaultTemplates'
import TemplatesView from '@/views/TemplatesView.vue'

const BAR = '[data-testid="templates-filter-bar"]'
const CHIPS = '[data-testid="templates-category-chips"]'
const TOGGLE = '[data-testid="templates-filter-toggle"]'
const PANEL = '[data-testid="templates-filter-panel"]'

function stubViewport(narrow: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: narrow && query === '(max-width: 639px)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
}

async function mountView(path = '/templates') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/templates', component: TemplatesView },
      { path: '/:rest(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(TemplatesView, {
    global: { plugins: [router], stubs: { TemplateThumb: true } },
  })
  await flushPromises()
  return wrapper
}

const cardLinks = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('a[href^="/templates/"]').filter((a) => a.classes().includes('group'))

describe('第 351 轮：TemplatesView 移动端吸顶筛选器', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  it('<640px：吸顶区仅渲染横向滚动 chips 行 + 筛选按钮，无搜索框；面板默认收起', async () => {
    stubViewport(true)
    const wrapper = await mountView()
    const bar = wrapper.get(BAR)
    expect(bar.classes()).toEqual(expect.arrayContaining(['sticky', 'top-14', 'bg-white']))
    expect(bar.find('input[type="search"]').exists()).toBe(false)
    const chips = bar.get(CHIPS)
    expect(chips.classes()).toEqual(
      expect.arrayContaining(['overflow-x-auto', 'snap-x', 'scrollbar-none']),
    )
    expect(chips.findAll('button').length).toBeGreaterThan(1)
    for (const chip of chips.findAll('button')) {
      expect(chip.classes()).toContain('shrink-0')
      expect(chip.classes()).toContain('snap-start')
    }
    const toggle = bar.get(TOGGLE)
    expect(toggle.text()).toContain('筛选')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(bar.findAll(':scope > div').length).toBe(1)
    expect(wrapper.find(PANEL).exists()).toBe(false)
    wrapper.unmount()
  })

  it('点击按钮展开非吸顶面板（含搜索框），搜索后角标显示已选筛选数，结果与筛选一致', async () => {
    stubViewport(true)
    const wrapper = await mountView()
    const before = cardLinks(wrapper).length
    await wrapper.get(TOGGLE).trigger('click')
    await flushPromises()
    const panel = wrapper.get(PANEL)
    expect(panel.classes()).not.toContain('sticky')
    expect(wrapper.get(TOGGLE).attributes('aria-expanded')).toBe('true')
    expect(wrapper.find(`${BAR} input[type="search"]`).exists()).toBe(false)

    const target = defaultTemplates.find((tpl) => templateDetails.some((d) => d.slug === tpl.id))!
    await panel.get('input[type="search"]').setValue(target.name)
    await flushPromises()
    expect(wrapper.get('[data-testid="templates-filter-count"]').text()).toBe('(1)')
    const after = cardLinks(wrapper)
    expect(after.length).toBeGreaterThan(0)
    expect(after.length).toBeLessThan(before)
    expect(wrapper.text()).toContain(target.name)

    // 收起面板后筛选结果不变
    await wrapper.get(TOGGLE).trigger('click')
    await flushPromises()
    expect(wrapper.find(PANEL).exists()).toBe(false)
    expect(cardLinks(wrapper).length).toBe(after.length)
    wrapper.unmount()
  })

  it('<640px 分类 chip 直接可点：切换分类后子分类进入面板，角标随子分类计数', async () => {
    stubViewport(true)
    const wrapper = await mountView()
    const chips = wrapper.get(CHIPS).findAll('button')
    await chips[1]!.trigger('click')
    await flushPromises()
    expect(chips[1]!.classes()).toContain('bg-brand-600')
    await wrapper.get(TOGGLE).trigger('click')
    await flushPromises()
    const subButtons = wrapper.get(PANEL).findAll('button')
    if (subButtons.length > 1) {
      await subButtons[1]!.trigger('click')
      await flushPromises()
      expect(wrapper.get('[data-testid="templates-filter-count"]').text()).toBe('(1)')
    } else {
      expect(wrapper.get(PANEL).text()).toContain('选中一个分类后可按子类继续筛选')
    }
    wrapper.unmount()
  })

  it('≥640px：维持原布局——搜索框与分类 chips 同在筛选区，无筛选按钮/面板', async () => {
    stubViewport(false)
    const wrapper = await mountView()
    const bar = wrapper.get(BAR)
    expect(bar.find('input[type="search"]').exists()).toBe(true)
    expect(bar.find(CHIPS).exists()).toBe(false)
    expect(bar.find(TOGGLE).exists()).toBe(false)
    expect(wrapper.find(PANEL).exists()).toBe(false)
    expect(bar.findAll('button').length).toBeGreaterThan(1)
    wrapper.unmount()
  })
})
