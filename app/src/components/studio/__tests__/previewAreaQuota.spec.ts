// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import PreviewArea from '@/components/studio/PreviewArea.vue'
import QuotaLimitDialog from '@/components/ui/QuotaLimitDialog.vue'
import { QUOTA_ANON_DAILY, useQuotaStore } from '@/stores/quota'
import { useWorkspaceStore } from '@/stores/workspace'
import type { PngExportOptions } from '@/utils/pngExport'

const exportPagedPng = vi.fn(async (_options: PngExportOptions) => {})
vi.mock('@/utils/pngExport', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/utils/pngExport')>()
  return {
    ...mod,
    exportPagedPng: (...args: Parameters<typeof mod.exportPagedPng>) => exportPagedPng(...args),
  }
})

async function makeRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/studio')
  await router.isReady()
  return router
}

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

describe('第 365 轮：额度用完弹窗内「改用带水印导出，继续」', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    localStorage.clear()
    setActivePinia(createPinia())
    exportPagedPng.mockClear()
  })

  const USAGE_KEY = 'seatmark.clean-export-usage.v1'

  it('从 PNG 导出入口点无水印 → 弹窗内有按钮，点击后关弹窗并直接带水印导出，本地额度计数不变', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    const quota = useQuotaStore()
    for (let i = 0; i < QUOTA_ANON_DAILY; i++) await quota.tryConsume()
    expect(quota.remaining).toBe(0)
    quota.limitDialogOpen = false
    const usageBefore = localStorage.getItem(USAGE_KEY)

    const wrapper = await mountPreview()
    const router = await makeRouter()
    const dialog = mount(QuotaLimitDialog, {
      global: { plugins: [router], stubs: { Teleport: true, Transition: true } },
      attachTo: document.body,
    })
    // 未从导出入口打开时不渲染该按钮
    quota.openLimitDialog()
    await dialog.vm.$nextTick()
    expect(dialog.find('[data-testid="quota-continue-watermarked"]').exists()).toBe(false)
    quota.limitDialogOpen = false
    await dialog.vm.$nextTick()

    await wrapper.find('[data-testid="export-png-button"]').trigger('click')
    await wrapper.find('[data-testid="choose-clean"]').trigger('click')
    await dialog.vm.$nextTick()
    expect(quota.limitDialogOpen).toBe(true)
    expect(exportPagedPng).not.toHaveBeenCalled()

    const cont = dialog.find('[data-testid="quota-continue-watermarked"]')
    expect(cont.exists()).toBe(true)
    expect(cont.text()).toBe('改用带水印导出，继续')
    expect(dialog.text()).toContain('每张标签底边细线 + seatmark.cn 小字')
    await cont.trigger('click')
    await flushPromises()

    expect(quota.limitDialogOpen).toBe(false)
    expect(quota.limitDialogContinue).toBeNull()
    expect(exportPagedPng).toHaveBeenCalledTimes(1)
    // 带水印路径不消耗额度：本地计数与导出前字节一致
    expect(localStorage.getItem(USAGE_KEY)).toBe(usageBefore)
    expect(quota.remaining).toBe(0)

    dialog.unmount()
    wrapper.unmount()
  })
})
