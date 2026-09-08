// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import PreviewArea from '@/components/studio/PreviewArea.vue'
import { useQuotaStore } from '@/stores/quota'
import { useToastStore } from '@/stores/toast'
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

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const USAGE_KEY = 'seatmark.clean-export-usage.v1'

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

async function openPngDialog(wrapper: Awaited<ReturnType<typeof mountPreview>>) {
  await wrapper.find('[data-testid="export-png-button"]').trigger('click')
  await wrapper.vm.$nextTick()
}

function lastCall(): PngExportOptions {
  const call = exportPagedPng.mock.calls.at(-1)
  expect(call).toBeTruthy()
  return call![0]
}

function flatFileNames(options: PngExportOptions): (string | undefined)[] {
  return (options.labelsByPage ?? []).flatMap((items) => items.map((i) => i.fileName))
}

describe('第 365 轮：标签工坊 PNG 逐张导出「导出范围」补打', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    localStorage.clear()
    setActivePinia(createPinia())
    exportPagedPng.mockClear()
  })

  it('输入框仅在按标签导出时出现（data-testid=png-label-range，placeholder 全部（如 5 或 1-3,10 只补打这些张））', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    const wrapper = await mountPreview()
    await openPngDialog(wrapper)
    const input = wrapper.find('[data-testid="png-label-range"]')
    expect(input.exists()).toBe(true)
    expect(input.attributes('placeholder')).toBe('全部（如 5 或 1-3,10 只补打这些张）')
    expect((input.element as HTMLInputElement).value).toBe('')
    // 摘要留空 = 现状
    expect(wrapper.find('[data-testid="export-summary"]').text()).toContain('26 张 PNG，打包 zip')
    wrapper.unmount()
  })

  it('留空：labelsByPage 为 26 张且不写显式序号文件名（与现状一致）', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    const wrapper = await mountPreview()
    await openPngDialog(wrapper)
    await wrapper.find('[data-testid="choose-watermark"]').trigger('click')
    await flushPromises()
    expect(exportPagedPng).toHaveBeenCalledTimes(1)
    const opts = lastCall()
    const names = flatFileNames(opts)
    expect(names).toHaveLength(26)
    expect(names.every((n) => n === undefined)).toBe(true)
    wrapper.unmount()
  })

  it('输入「5」：只导出第 5 张，文件名保持 -005.png（全局序号）；摘要写「1 张 PNG（共 26 张中选 1 张）」', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    const wrapper = await mountPreview()
    await openPngDialog(wrapper)
    await wrapper.find('[data-testid="png-label-range"]').setValue('5')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="export-summary"]').text()).toContain('1 张 PNG（共 26 张中选 1 张）')
    expect(wrapper.find('[data-testid="png-label-range-error"]').exists()).toBe(false)

    await wrapper.find('[data-testid="choose-watermark"]').trigger('click')
    await flushPromises()
    expect(exportPagedPng).toHaveBeenCalledTimes(1)
    const opts = lastCall()
    const names = flatFileNames(opts)
    expect(names).toHaveLength(1)
    expect(names[0]).toMatch(/-005\.png$/)
    expect(names[0]!.startsWith(`${opts.fileName}-`)).toBe(true)
    // 页数不变（渲染器按页取节点；无标签的页被跳过）
    expect(opts.pageCount).toBe(workspace.totalPages)
    // 第 5 张位于第 1 页
    expect(opts.labelsByPage![0]).toHaveLength(1)
    expect(opts.labelsByPage![1]).toHaveLength(0)
    wrapper.unmount()
  })

  it('输入「1-3,10」：4 张、文件名 -001/-002/-003/-010，裁剪区域与全量导出中对应张一致', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    const wrapper = await mountPreview()

    await openPngDialog(wrapper)
    await wrapper.find('[data-testid="choose-watermark"]').trigger('click')
    await flushPromises()
    const full = lastCall()
    const fullRects = (full.labelsByPage ?? []).flat().map((i) => i.rect)

    await openPngDialog(wrapper)
    await wrapper.find('[data-testid="png-label-range"]').setValue('1-3,10')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="export-summary"]').text()).toContain('4 张 PNG（共 26 张中选 4 张）')
    await wrapper.find('[data-testid="choose-watermark"]').trigger('click')
    await flushPromises()
    expect(exportPagedPng).toHaveBeenCalledTimes(2)
    const part = lastCall()
    const items = (part.labelsByPage ?? []).flat()
    expect(items.map((i) => i.fileName?.slice(-8))).toEqual(['-001.png', '-002.png', '-003.png', '-010.png'])
    expect(items.map((i) => i.rect)).toEqual([fullRects[0], fullRects[1], fullRects[2], fullRects[9]])
    wrapper.unmount()
  })

  it('输入「30」或「abc」：toast.warning、不调用导出、无水印额度不变', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    const quota = useQuotaStore()
    const toast = useToastStore()
    const before = quota.remaining
    const usageBefore = localStorage.getItem(USAGE_KEY)
    const wrapper = await mountPreview()

    for (const bad of ['30', 'abc']) {
      await openPngDialog(wrapper)
      await wrapper.find('[data-testid="png-label-range"]').setValue(bad)
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="png-label-range-error"]').exists()).toBe(true)
      await wrapper.find('[data-testid="choose-clean"]').trigger('click')
      await flushPromises()
      expect(exportPagedPng).not.toHaveBeenCalled()
      const warn = toast.toasts.find((i) => i.type === 'warning' && i.title === '导出范围无效')
      expect(warn).toBeTruthy()
      expect(warn!.text).toContain('1–26')
      expect(warn!.text).not.toMatch(/[!！]/)
      expect(quota.remaining).toBe(before)
      expect(localStorage.getItem(USAGE_KEY)).toBe(usageBefore)
      toast.toasts.splice(0)
    }
    wrapper.unmount()
  })

  it('切到整页导出时范围不生效：输入「5」仍导出全部整页', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    const wrapper = await mountPreview()
    await openPngDialog(wrapper)
    await wrapper.find('[data-testid="png-label-range"]').setValue('5')
    const unit = wrapper
      .findAllComponents({ name: 'SelectField' })
      .find((s) => s.attributes('id') === 'png-unit')
    unit!.vm.$emit('update:modelValue', 'page')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="png-label-range"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="export-summary"]').text()).toContain('2 张整页 PNG')
    await wrapper.find('[data-testid="choose-watermark"]').trigger('click')
    await flushPromises()
    const opts = lastCall()
    expect(opts.labelsByPage).toBeUndefined()
    expect(opts.pageCount).toBe(2)
    wrapper.unmount()
  })
})
