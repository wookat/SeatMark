// @vitest-environment jsdom
/**
 * 第 373 轮：/banquet 空名单引导条 390px 响应式——
 * 文案 <p> 窄屏整行（basis-full）、≥sm 才与按钮同行；按钮组窄屏整行、按钮允许换行；
 * 关闭 × 靠右；三个按钮交互不变。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

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

describe('第 373 轮：婚宴画布空状态引导条响应式', () => {
  it('文案窄屏整行、按钮组整行、按钮可换行、关闭按钮靠右', async () => {
    const wrapper = await mountView()
    const hint = wrapper.get(HINT)
    expect(hint.classes()).toContain('flex-wrap')

    const text = hint.get('p')
    for (const cls of ['min-w-0', 'basis-full', 'sm:basis-auto', 'sm:flex-1']) {
      expect(text.classes(), cls).toContain(cls)
    }
    expect(text.classes()).not.toContain('flex-1')

    const group = hint.get('[data-testid="banquet-canvas-empty-import"]').element.parentElement!
    for (const cls of ['flex', 'w-full', 'sm:w-auto', 'flex-wrap']) {
      expect(group.classList.contains(cls), cls).toBe(true)
    }

    for (const id of ['banquet-canvas-empty-import', 'banquet-canvas-empty-demo']) {
      const btn = hint.get(`[data-testid="${id}"]`)
      expect(btn.classes(), id).toContain('whitespace-normal')
      expect(btn.classes(), id).toContain('text-left')
    }
    expect(hint.get('[data-testid="banquet-canvas-empty-dismiss"]').classes()).toContain('ml-auto')
    wrapper.unmount()
  })

  it('三个按钮仍可点击：导入聚焦粘贴框、演示名单与关闭都让引导条消失', async () => {
    const importWrapper = await mountView()
    await importWrapper.get('[data-testid="banquet-canvas-empty-import"]').trigger('click')
    expect(document.activeElement).toBe(importWrapper.find('textarea').element)
    expect(importWrapper.find(HINT).exists()).toBe(true)
    importWrapper.unmount()
    localStorage.clear()
    setActivePinia(createPinia())

    const demoWrapper = await mountView()
    await demoWrapper.get('[data-testid="banquet-canvas-empty-demo"]').trigger('click')
    await demoWrapper.vm.$nextTick()
    expect(demoWrapper.find(HINT).exists()).toBe(false)
    demoWrapper.unmount()
    localStorage.clear()
    setActivePinia(createPinia())

    const dismissWrapper = await mountView()
    await dismissWrapper.get('[data-testid="banquet-canvas-empty-dismiss"]').trigger('click')
    expect(dismissWrapper.find(HINT).exists()).toBe(false)
    dismissWrapper.unmount()
  })
})
