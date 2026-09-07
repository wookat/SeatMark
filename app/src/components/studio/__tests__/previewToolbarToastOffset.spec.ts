// @vitest-environment jsdom
/**
 * 第 352 轮（补丁）：PreviewArea 把预览工具栏当前相对视口的底边写入 html 的 --studio-toolbar-bottom，
 * ToastHost（fixed）≥lg 据此把右上 toast 落到工具栏下方；预览列在 md+ 为 sticky，故不得叠加 scrollY；
 * 滚动 / resize 时刷新；卸载后移除变量（排座 / 宴会页回退 top-20）。
 */
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import PreviewArea from '@/components/studio/PreviewArea.vue'
import { STUDIO_TOOLBAR_BOTTOM_VAR } from '@/composables/useStickyActions'
import { useWorkspaceStore } from '@/stores/workspace'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('PreviewArea 工具栏底边 → --studio-toolbar-bottom', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    localStorage.clear()
    setActivePinia(createPinia())
  })
  afterEach(() => {
    vi.restoreAllMocks()
    document.documentElement.style.removeProperty(STUDIO_TOOLBAR_BOTTOM_VAR)
  })

  it('挂载后写入工具栏视口底边（页面已滚动时不叠加 scrollY）；滚动后刷新；卸载后移除', async () => {
    useWorkspaceStore().useDemoData()
    // jsdom 无布局：模拟 sticky 工具栏钉在视口 top 77、高 132（1280 宽实测），页面已滚动 991px
    let toolbarTop = 77
    const spy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const isToolbar = this.dataset.testid === 'preview-toolbar'
        const height = isToolbar ? 132 : 600
        const top = isToolbar ? toolbarTop : 0
        return { x: 0, y: top, top, bottom: top + height, left: 0, right: 0, width: 0, height, toJSON: () => ({}) } as DOMRect
      })
    Object.defineProperty(window, 'scrollY', { value: 991, configurable: true })

    const wrapper = mount(PreviewArea, {
      global: { stubs: { LabelSheet: true, CalibrationDialog: true, DuplexGuideDialog: true, Teleport: true } },
      attachTo: document.body,
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="preview-toolbar"]').classes()).toContain('sticky')
    expect(document.documentElement.style.getPropertyValue(STUDIO_TOOLBAR_BOTTOM_VAR)).toBe('209px')

    // 视口变化（如 <md 单列时工具栏随页面滚动）→ scroll 事件后刷新
    toolbarTop = 40
    window.dispatchEvent(new Event('scroll'))
    expect(document.documentElement.style.getPropertyValue(STUDIO_TOOLBAR_BOTTOM_VAR)).toBe('172px')

    wrapper.unmount()
    expect(document.documentElement.style.getPropertyValue(STUDIO_TOOLBAR_BOTTOM_VAR)).toBe('')
    spy.mockRestore()
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
  })
})
