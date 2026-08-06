// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import PreviewArea from '@/components/studio/PreviewArea.vue'
import { QUOTA_ANON_DAILY, useQuotaStore } from '@/stores/quota'
import { useWorkspaceStore } from '@/stores/workspace'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

async function mountPreview() {
  const wrapper = mount(PreviewArea, {
    global: {
      stubs: {
        LabelSheet: true,
        CalibrationDialog: true,
        DuplexGuideDialog: true,
        Teleport: true,
        Transition: true,
      },
    },
    attachTo: document.body,
  })
  await wrapper.vm.$nextTick()
  return wrapper
}

describe('PreviewArea 导出选择框：配额用尽仍可点无水印进入引导弹窗', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('剩余 0 次时无水印按钮不 disabled，点击后关闭选择框并打开 QuotaLimitDialog', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()

    const quota = useQuotaStore()
    for (let i = 0; i < QUOTA_ANON_DAILY; i++) {
      expect((await quota.tryConsume()).ok).toBe(true)
    }
    expect(quota.remaining).toBe(0)
    quota.limitDialogOpen = false

    const wrapper = await mountPreview()

    // 打开导出选择框（图片版 PDF 入口）
    const exportBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('导出 PDF') || (b.attributes('title') ?? '').includes('逐页渲染'))
    expect(exportBtn).toBeTruthy()
    await exportBtn!.trigger('click')

    const cleanBtn = wrapper.find('[data-testid="choose-clean"]')
    expect(cleanBtn.exists()).toBe(true)
    expect(cleanBtn.attributes('disabled')).toBeUndefined()
    expect(cleanBtn.text()).toContain('今日 0 次')

    await cleanBtn.trigger('click')
    await wrapper.vm.$nextTick()

    // 选择框已关闭、配额引导弹窗已打开（先关后开，无两层 modal 叠加）
    expect(quota.limitDialogOpen).toBe(true)
    expect(wrapper.find('[data-testid="choose-clean"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('剩余次数大于 0 时无水印按钮保持主要样式，不显示 0 次角标', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    const quota = useQuotaStore()
    expect(quota.remaining).toBeGreaterThan(0)

    const wrapper = await mountPreview()
    const exportBtn = wrapper
      .findAll('button')
      .find((b) => (b.attributes('title') ?? '').includes('逐页渲染'))
    await exportBtn!.trigger('click')

    const cleanBtn = wrapper.find('[data-testid="choose-clean"]')
    expect(cleanBtn.exists()).toBe(true)
    expect(cleanBtn.text()).not.toContain('今日 0 次')
    expect(cleanBtn.classes().join(' ')).toContain('border-brand-200')

    wrapper.unmount()
  })
})
