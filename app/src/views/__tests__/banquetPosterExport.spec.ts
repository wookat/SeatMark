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
  const pngBtn = wrapper.findAll('button').find((b) => b.text() === '导出高清 PNG')
  expect(pngBtn).toBeTruthy()
  await pngBtn!.trigger('click')
  await wrapper.vm.$nextTick()
  // 圆桌预设 8 桌，48 人坐满 6 桌后剩 2 空桌：导出前检查提示空桌
  const keepEmpty = wrapper.findAll('button').find((b) => b.text().includes(emptyTableAction))
  expect(keepEmpty).toBeTruthy()
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
