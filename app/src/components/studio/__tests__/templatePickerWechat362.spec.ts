// @vitest-environment jsdom
/**
 * 第 362 轮：模板面板「微信扫码打开」入口只在中文站渲染；英文站只保留「复制当前模板分享链接」，
 * 「导出 JSON」与相邻按钮同为 btn-secondary。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import TemplatePickerPanel from '@/components/studio/TemplatePickerPanel.vue'
import { setLocale } from '@/i18n'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

async function mountPanel(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(TemplatePickerPanel, { global: { plugins: [router] }, attachTo: document.body })
  await wrapper.vm.$nextTick()
  return wrapper
}

function buttonByText(wrapper: Awaited<ReturnType<typeof mountPanel>>, text: string) {
  return wrapper.findAll('button').find((b) => b.text().includes(text))
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })),
  )
  localStorage.clear()
  setActivePinia(createPinia())
})

afterEach(async () => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
  await setLocale('zh')
})

describe('第 362 轮：TemplatePickerPanel 微信扫码入口按 locale 渲染', () => {
  it('zh：渲染「微信扫码打开」按钮', async () => {
    await setLocale('zh')
    const wrapper = await mountPanel('/studio')
    expect(buttonByText(wrapper, '微信扫码打开')).toBeDefined()
    expect(buttonByText(wrapper, '复制当前模板分享链接')).toBeDefined()
    wrapper.unmount()
  })

  it('en：不渲染 WeChat 按钮，仅保留复制分享链接；导出 JSON 为 btn-secondary', async () => {
    await setLocale('en')
    const wrapper = await mountPanel('/en/studio')
    expect(wrapper.text()).not.toMatch(/WeChat/i)
    expect(buttonByText(wrapper, '微信扫码打开')).toBeUndefined()
    const copy = buttonByText(wrapper, 'Copy')
    expect(copy).toBeDefined()
    const exportJson = buttonByText(wrapper, 'Export JSON')
    expect(exportJson).toBeDefined()
    expect(exportJson!.classes()).toContain('btn-secondary')
    expect(exportJson!.classes()).not.toContain('btn-ghost')
    wrapper.unmount()
  })

  it('zh → en 响应式切换后按钮消失（不依赖挂载时快照）', async () => {
    await setLocale('zh')
    const wrapper = await mountPanel('/studio')
    expect(buttonByText(wrapper, '微信扫码打开')).toBeDefined()
    await setLocale('en')
    await wrapper.vm.$nextTick()
    expect(buttonByText(wrapper, '微信扫码打开')).toBeUndefined()
    expect(wrapper.text()).not.toMatch(/WeChat/i)
    wrapper.unmount()
  })
})
