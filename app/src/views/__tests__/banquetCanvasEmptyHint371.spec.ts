// @vitest-environment jsdom
/**
 * 第 371 轮：/banquet 空名单时画布顶部的引导条——
 * 名单空→显示；载入演示名单→消失；手动关闭→消失且不影响默认 8 张空桌。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { BANQUET_STATE_KEY } from '@/utils/banquet'
import BanquetView from '@/views/BanquetView.vue'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const HINT = '[data-testid="banquet-canvas-empty-hint"]'

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/banquet', component: BanquetView },
      { path: '/studio', component: { template: '<div />' } },
    ],
  })
  const wrapper = mount(BanquetView, {
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

describe('第 371 轮：婚宴画布空状态引导条', () => {
  it('名单为空时显示引导条，默认 8 张空桌不受影响', async () => {
    const wrapper = await mountView()
    const hint = wrapper.find(HINT)
    expect(hint.exists()).toBe(true)
    expect(hint.text()).toContain('先导入宾客名单，再点“自动分配”一键分桌')
    expect(wrapper.findAll('[data-testid="banquet-table-lock-toggle"]')).toHaveLength(8)
    wrapper.unmount()
  })

  it('点「导入宾客名单」滚动并聚焦到名单粘贴框', async () => {
    const wrapper = await mountView()
    await wrapper.find('[data-testid="banquet-canvas-empty-import"]').trigger('click')
    const textarea = wrapper.find('textarea').element
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    expect(document.activeElement).toBe(textarea)
    wrapper.unmount()
  })

  it('点「用演示名单试试」载入演示名单后引导条消失', async () => {
    const wrapper = await mountView()
    await wrapper.find('[data-testid="banquet-canvas-empty-demo"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find(HINT).exists()).toBe(false)
    expect(wrapper.find('[data-testid="banquet-canvas-empty-cta"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('已有名单（持久化恢复）时不显示引导条', async () => {
    localStorage.setItem(
      BANQUET_STATE_KEY,
      JSON.stringify({
        title: '测试',
        pasteText: '',
        guests: [{ id: 'a1', name: '甲一', groupId: null }],
        groups: [],
        tables: [],
        markers: [],
        paper: 'a4',
        orientation: 'landscape',
        exportColors: false,
      }),
    )
    const wrapper = await mountView()
    expect(wrapper.find(HINT).exists()).toBe(false)
    wrapper.unmount()
  })

  it('点关闭后引导条消失', async () => {
    const wrapper = await mountView()
    await wrapper.find('[data-testid="banquet-canvas-empty-dismiss"]').trigger('click')
    expect(wrapper.find(HINT).exists()).toBe(false)
    wrapper.unmount()
  })
})
