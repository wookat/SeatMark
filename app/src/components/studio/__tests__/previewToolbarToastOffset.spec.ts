// @vitest-environment jsdom
/**
 * 第 352 轮：PreviewArea 把预览工具栏的自然底边写入 html 的 --studio-toolbar-bottom，
 * ToastHost ≥lg 据此把右上 toast 落到工具栏下方；卸载后移除变量（排座 / 宴会页回退 top-20）。
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

  it('挂载后按「父容器文档顶边 + 工具栏高度」写入变量；卸载后移除', async () => {
    useWorkspaceStore().useDemoData()
    // jsdom 无布局：模拟工具栏高 84px、父容器（非 sticky）顶边距视口 77px、页面已滚动 120px
    const spy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const isToolbar = this.dataset.testid === 'preview-toolbar'
        const height = isToolbar ? 84 : 600
        const top = isToolbar ? 0 : 77 - 120
        return { x: 0, y: top, top, bottom: top + height, left: 0, right: 0, width: 0, height, toJSON: () => ({}) } as DOMRect
      })
    Object.defineProperty(window, 'scrollY', { value: 120, configurable: true })

    const wrapper = mount(PreviewArea, {
      global: { stubs: { LabelSheet: true, CalibrationDialog: true, DuplexGuideDialog: true, Teleport: true } },
      attachTo: document.body,
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="preview-toolbar"]').classes()).toContain('sticky')
    expect(document.documentElement.style.getPropertyValue(STUDIO_TOOLBAR_BOTTOM_VAR)).toBe('161px')

    wrapper.unmount()
    expect(document.documentElement.style.getPropertyValue(STUDIO_TOOLBAR_BOTTOM_VAR)).toBe('')
    spy.mockRestore()
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
  })
})
