// @vitest-environment jsdom
/**
 * 第 364 轮：/banquet 宾客速查表「下载 PDF」——复用离屏速查表宿主，按 A4 纵向逐页截图后走图片版 PDF 路径；
 * 全部浏览器本地、不消耗无水印配额；导出中按钮 disabled 并显示「生成中…」。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useQuotaStore } from '@/stores/quota'
import { useToastStore } from '@/stores/toast'
import { paginateQuickRefBlocks } from '@/utils/banquet'
import BanquetView from '@/views/BanquetView.vue'

const exportPagedPdf = vi.fn()
vi.mock('@/utils/pdfExport', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/utils/pdfExport')>()
  return {
    ...mod,
    exportPagedPdf: (...args: Parameters<typeof mod.exportPagedPdf>) => exportPagedPdf(...args),
  }
})

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

async function mountBanquet() {
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

describe('paginateQuickRefBlocks', () => {
  it('内容不满一页 → 单页；跨页的块整体推到下一页起点，不在行中间切开', () => {
    expect(paginateQuickRefBlocks([{ top: 0, bottom: 100 }], 1000)).toEqual([0])
    const rows = Array.from({ length: 30 }, (_, i) => ({ top: i * 100, bottom: i * 100 + 90 }))
    // 页高 1000：第 10 行（top 1000）恰好放不下上一页 → 第二页从 1000 开始，第三页从 2000
    expect(paginateQuickRefBlocks(rows, 1000)).toEqual([0, 1000, 2000])
    // 页高 950：第 10 行（900–990）跨过页底，整行推到下一页起点 900；之后每 9 行一页
    expect(paginateQuickRefBlocks(rows, 950)).toEqual([0, 900, 1800, 2700])
  })

  it('双栏并排块：切线不能横跨任何一栏的行——左栏行边界被右栏跨越时退回到两栏都干净的位置', () => {
    // 左栏 30 行（100px 一行、90px 高）；右栏一个 850–1150 的整块（如带标题的短表）横跨 1000 处
    const left = Array.from({ length: 30 }, (_, i) => ({ top: i * 100, bottom: i * 100 + 90 }))
    const right = [{ top: 850, bottom: 1150 }]
    const starts = paginateQuickRefBlocks([...left, ...right], 1000)
    // 1000 / 990 / 900 都被右栏块横跨；800 是两栏都不横跨的最靠下切线
    expect(starts[0]).toBe(0)
    expect(starts[1]).toBe(800)
    for (const s of starts.slice(1)) {
      expect([...left, ...right].some((b) => b.top < s && s < b.bottom), `切线 ${s} 横跨了内容块`).toBe(false)
    }
    // 上一页与下一页之间不重叠：每页起点严格递增且页尾不超过页高
    for (let i = 1; i < starts.length; i += 1) {
      expect(starts[i]! - starts[i - 1]!).toBeGreaterThan(0)
      expect(starts[i]! - starts[i - 1]!).toBeLessThanOrEqual(1000)
    }
  })

  it('单块高于一页时按页高硬切，不死循环；无块 → 单页', () => {
    expect(paginateQuickRefBlocks([{ top: 0, bottom: 2500 }], 1000)).toEqual([0, 1000, 2000])
    expect(paginateQuickRefBlocks([], 1000)).toEqual([0])
  })
})

describe('第 364 轮：宾客速查表下载 PDF', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    exportPagedPdf.mockReset()
  })

  it('迎宾台配套区有「下载 PDF」按钮，与打印 / CSV 按钮同组', async () => {
    const wrapper = await mountBanquet()
    const btn = wrapper.find('[data-testid="banquet-quickref-pdf"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toBe('下载 PDF')
    expect(btn.attributes('disabled')).toBeUndefined()
    const group = btn.element.parentElement!
    expect(group.querySelector('[data-testid="banquet-quickref-print"]')).toBeTruthy()
    expect(group.querySelector('[data-testid="banquet-roster-csv"]')).toBeTruthy()
  })

  it('点击后调用 exportPagedPdf 一次：A4 纵向、文件名含「宾客速查表」、getPage 返回速查表裁切视口；不扣无水印配额', async () => {
    const wrapper = await mountBanquet()
    const quota = useQuotaStore()
    const consume = vi.spyOn(quota, 'tryConsume')
    const demoBtn = wrapper.findAll('button').find((b) => b.text().includes('用演示名单'))
    await demoBtn!.trigger('click')
    await wrapper.find('[data-testid="auto-assign"]').trigger('click')
    await wrapper.vm.$nextTick()

    let resolveExport: (() => void) | null = null
    let captured: HTMLElement | null = null
    exportPagedPdf.mockImplementationOnce(
      async (options: { getPage: (i: number) => Promise<HTMLElement> | HTMLElement }) => {
        captured = await options.getPage(0)
        await new Promise<void>((resolve) => {
          resolveExport = resolve
        })
      },
    )
    const btn = wrapper.find('[data-testid="banquet-quickref-pdf"]')
    await btn.trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    // 导出中：按钮 disabled 且显示「生成中…」
    expect(btn.text()).toBe('生成中…')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(exportPagedPdf).toHaveBeenCalledTimes(1)
    const options = exportPagedPdf.mock.calls[0]![0] as {
      pageCount: number
      pageWidth: number
      pageHeight: number
      fileName: string
    }
    expect(options.pageWidth).toBe(210)
    expect(options.pageHeight).toBe(297)
    expect(options.pageCount).toBeGreaterThanOrEqual(1)
    expect(options.fileName).toContain('宾客速查表')
    expect(options.fileName.endsWith('.pdf')).toBe(true)
    expect(captured).not.toBeNull()
    expect(captured!.classList.contains('quickref-pdf-viewport')).toBe(true)
    expect(captured!.querySelector('[data-testid="banquet-quickref-sheet"]')).toBeTruthy()
    // 上下页边距白色遮罩：相邻页的行不会露在边距里
    expect(captured!.querySelector('.quickref-pdf-mask-top')).toBeTruthy()
    expect(captured!.querySelector('.quickref-pdf-mask-bottom')).toBeTruthy()

    resolveExport!()
    await new Promise((r) => setTimeout(r, 0))
    await wrapper.vm.$nextTick()
    expect(btn.text()).toBe('下载 PDF')
    expect(btn.attributes('disabled')).toBeUndefined()
    expect(consume).not.toHaveBeenCalled()
    expect(useToastStore().toasts.map((t) => t.title)).toContain('速查表 PDF 已导出')
  })

  it('名单为空时不调用 PDF 生成，只提示先粘贴名单', async () => {
    const wrapper = await mountBanquet()
    await wrapper.find('[data-testid="banquet-quickref-pdf"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(exportPagedPdf).not.toHaveBeenCalled()
    expect(useToastStore().toasts.map((t) => t.text)).toContain('请先粘贴宾客名单')
  })
})
