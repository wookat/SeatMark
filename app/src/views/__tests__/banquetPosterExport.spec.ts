// @vitest-environment jsdom
/**
 * 第 348 轮：宴会座位图「张贴版（远距可读）」导出开关。
 * 默认开：导出宿主渲染网格 poster-grid（空桌不参与、字号 ≥ 60px@300dpi）；
 * 关闭：导出宿主回到按场地图原样缩放的紧凑版（r347 输出）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { BANQUET_STATE_KEY } from '@/utils/banquet'
import { POSTER_PX_PER_MM } from '@/utils/banquetExportLayout'
import BanquetView from '@/views/BanquetView.vue'

const exportPagedPng = vi.fn()
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

/**
 * 载入 48 人演示名单并一键分配，然后走「导出 PNG → 空桌确认 → 带水印导出」，返回导出宿主页面元素。
 * 空桌确认按钮文案随张贴版开关变化：张贴版「跳过空桌」（空桌不参与布局），紧凑版「保留空桌」。
 */
async function exportAndCapturePage(
  wrapper: Awaited<ReturnType<typeof mountBanquet>>,
  emptyTableAction: string,
) {
  const demoBtn = wrapper.findAll('button').find((b) => b.text().includes('用演示名单'))
  expect(demoBtn).toBeTruthy()
  await demoBtn!.trigger('click')
  await wrapper.find('[data-testid="auto-assign"]').trigger('click')
  await wrapper.vm.$nextTick()

  let captured: HTMLElement | null = null
  exportPagedPng.mockImplementationOnce(async (options: { getPage: () => HTMLElement }) => {
    captured = options.getPage()
  })
  // 第 355 轮后按钮内还带内联额度文字，按 testid 定位
  const pngBtn = wrapper.find('[data-testid="banquet-export-png"]')
  expect(pngBtn.exists()).toBe(true)
  expect(pngBtn.text()).toContain('导出高清 PNG')
  await pngBtn.trigger('click')
  await wrapper.vm.$nextTick()
  // 圆桌预设 8 桌，48 人坐满 6 桌后剩 2 空桌：导出前检查提示空桌
  const keepEmpty = wrapper.findAll('button').find((b) => b.text().includes(emptyTableAction))
  expect(keepEmpty).toBeTruthy()
  // 「跳过/保留空桌，继续导出」是唯一主按钮（brand 实底）且排最后：桌面居右、移动端（ModalDialog 竖排反序）置顶
  expect(keepEmpty!.attributes('data-testid')).toBe('banquet-issues-confirm')
  expect(keepEmpty!.classes()).toContain('btn-primary')
  const actionBtns = wrapper.findAll('[data-testid="modal-actions"] button')
  expect(actionBtns.length).toBeGreaterThanOrEqual(2)
  expect(actionBtns[actionBtns.length - 1]!.element).toBe(keepEmpty!.element)
  for (const b of actionBtns.slice(0, -1)) {
    expect(b.classes()).toContain('btn-secondary')
    expect(b.classes()).not.toContain('btn-primary')
  }
  const actions = wrapper.find('[data-testid="modal-actions"]')
  expect(actions.classes()).toContain('max-sm:flex-col-reverse')
  await keepEmpty!.trigger('click')
  await wrapper.vm.$nextTick()
  const watermarked = wrapper.findAll('button').find((b) => b.text().includes('带水印导出（免费）'))
  expect(watermarked).toBeTruthy()
  await watermarked!.trigger('click')
  await wrapper.vm.$nextTick()
  await wrapper.vm.$nextTick()
  expect(exportPagedPng).toHaveBeenCalledTimes(1)
  expect(captured).not.toBeNull()
  return captured!
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  Element.prototype.scrollIntoView = vi.fn()
  localStorage.clear()
  setActivePinia(createPinia())
  exportPagedPng.mockReset()
})

describe('BanquetView 张贴版导出开关', () => {
  it('开关默认开启并持久化；关闭后刷新仍为关闭', async () => {
    const wrapper = await mountBanquet()
    const toggle = wrapper.find<HTMLInputElement>('[data-testid="poster-layout-toggle"] input[type="checkbox"]')
    expect(toggle.exists()).toBe(true)
    expect(toggle.element.checked).toBe(true)
    await toggle.setValue(false)
    await wrapper.vm.$nextTick()
    const saved = JSON.parse(localStorage.getItem(BANQUET_STATE_KEY) ?? 'null') as { posterLayout?: boolean } | null
    expect(saved?.posterLayout).toBe(false)
    wrapper.unmount()

    const again = await mountBanquet()
    expect(
      again.find<HTMLInputElement>('[data-testid="poster-layout-toggle"] input[type="checkbox"]').element.checked,
    ).toBe(false)
    again.unmount()
  })

  it('张贴版：48 人坐满 6 桌（2 空桌不参与）→ 3 列网格、48 枚姓名、字号 ≥ 60px@300dpi、页面仍为 A4 横版', async () => {
    const wrapper = await mountBanquet()
    const page = await exportAndCapturePage(wrapper, '跳过空桌，继续导出')
    expect(page.style.width).toBe('297mm')
    expect(page.style.height).toBe('210mm')
    const grid = page.querySelector<HTMLElement>('[data-testid="poster-grid"]')
    expect(grid).not.toBeNull()
    expect(grid!.style.gridTemplateColumns.startsWith('repeat(3, ')).toBe(true)
    expect(grid!.querySelectorAll('.banquet-poster-table')).toHaveLength(6)
    expect(grid!.querySelectorAll('.banquet-poster-guest')).toHaveLength(48)
    const fontMm = parseFloat(grid!.style.getPropertyValue('--poster-name-font'))
    expect(fontMm * POSTER_PX_PER_MM).toBeGreaterThanOrEqual(60)
    // 张贴版不渲染场地图
    expect(page.querySelector('.banquet-venue--export')).toBeNull()
    expect(page.querySelector('.sheet-watermark')).not.toBeNull()
    wrapper.unmount()
  })

  it('关闭张贴版：导出宿主回到场地图原样缩放（紧凑版）', async () => {
    const wrapper = await mountBanquet()
    await wrapper
      .find<HTMLInputElement>('[data-testid="poster-layout-toggle"] input[type="checkbox"]')
      .setValue(false)
    const page = await exportAndCapturePage(wrapper, '保留空桌，继续导出')
    expect(page.querySelector('[data-testid="poster-grid"]')).toBeNull()
    expect(page.querySelector('.banquet-venue--export')).not.toBeNull()
    expect(page.querySelectorAll('.banquet-venue--export .banquet-table')).toHaveLength(8)
    expect(page.querySelectorAll('.banquet-venue--export .banquet-guest')).toHaveLength(48)
    wrapper.unmount()
  })
})

describe('第 363 轮：导出检查弹窗「本次导出」摘要行', () => {
  async function openIssuesDialog(wrapper: Awaited<ReturnType<typeof mountBanquet>>) {
    const demoBtn = wrapper.findAll('button').find((b) => b.text().includes('用演示名单'))
    expect(demoBtn).toBeTruthy()
    await demoBtn!.trigger('click')
    await wrapper.find('[data-testid="auto-assign"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="banquet-export-png"]').trigger('click')
    await wrapper.vm.$nextTick()
    const summary = wrapper.find('[data-testid="banquet-export-summary"]')
    expect(summary.exists()).toBe(true)
    return summary
  }

  it('48 人自动分配后：摘要含「张贴版」「已安排 48/48」「空桌 2」「6/8」与水印状态，且位于问题区块之上', async () => {
    const wrapper = await mountBanquet()
    const summary = await openIssuesDialog(wrapper)
    const text = summary.text()
    expect(text).toContain('本次导出')
    expect(text).toContain('张贴版')
    expect(text).toContain('已安排 48/48')
    expect(text).toContain('空桌 2')
    expect(text).toContain('6/8')
    expect(text).toContain('带底边细线水印')
    // 与状态条数字同源
    const bar = wrapper.text()
    expect(bar).toContain('空桌 2')
    const dialog = wrapper.find('[role="dialog"]').html()
    expect(dialog.indexOf('banquet-export-summary')).toBeLessThan(dialog.indexOf('删除空桌后导出'))
    // 主按钮文案：删除空桌后导出 / 跳过空桌，继续导出
    const labels = wrapper.findAll('[data-testid="modal-actions"] button').map((b) => b.text())
    expect(labels).toContain('删除空桌后导出')
    expect(labels).toContain('跳过空桌，继续导出')
    wrapper.unmount()
  })

  it('关闭张贴版：摘要写「紧凑版」，主按钮为「保留空桌，继续导出」', async () => {
    const wrapper = await mountBanquet()
    await wrapper
      .find<HTMLInputElement>('[data-testid="poster-layout-toggle"] input[type="checkbox"]')
      .setValue(false)
    const summary = await openIssuesDialog(wrapper)
    expect(summary.text()).toContain('紧凑版')
    expect(summary.text()).not.toContain('张贴版')
    const labels = wrapper.findAll('[data-testid="modal-actions"] button').map((b) => b.text())
    expect(labels).toContain('保留空桌，继续导出')
    wrapper.unmount()
  })
})
