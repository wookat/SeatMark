// @vitest-environment jsdom
/**
 * 第 369 轮：/banquet 按桌名单 CSV / 宾客速查表（打印、PDF）并入导出前预检——
 * 名单为空或一人未安排都阻止并 warning；部分未安排时可导出并在成功文案里提示未安排人数；全部安排时文案不变。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useToastStore } from '@/stores/toast'
import { BANQUET_STATE_KEY, type BanquetTable } from '@/utils/banquet'
import BanquetView from '@/views/BanquetView.vue'

const downloadBlob = vi.fn()
vi.mock('@/utils/pngExport', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/utils/pngExport')>()
  return {
    ...mod,
    downloadBlob: (...args: Parameters<typeof mod.downloadBlob>) => downloadBlob(...args),
  }
})

const exportPagedPdf = vi.fn()
vi.mock('@/utils/pdfExport', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/utils/pdfExport')>()
  return {
    ...mod,
    exportPagedPdf: (...args: Parameters<typeof mod.exportPagedPdf>) => exportPagedPdf(...args),
  }
})

const printAndWaitUntilDone = vi.fn()
vi.mock('@/utils/printing', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/utils/printing')>()
  return {
    ...mod,
    printAndWaitUntilDone: (...args: Parameters<typeof mod.printAndWaitUntilDone>) =>
      printAndWaitUntilDone(...args),
  }
})

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function table(id: string, name: string, seats: number, guestIds: string[]): BanquetTable {
  return { id, name, shape: 'round', x: 0, y: 0, width: 80, height: 80, seats, guestIds }
}

const GUESTS = [
  { id: 'a1', name: '甲一', groupId: 'gA' },
  { id: 'a2', name: '甲二', groupId: 'gA' },
  { id: 'b1', name: '乙一', groupId: 'gB' },
  { id: 'b2', name: '乙二', groupId: 'gB' },
]
const GROUPS = [
  { id: 'gA', name: '男方亲友', color: '#4f46e5' },
  { id: 'gB', name: '同事', color: '#0891b2' },
]

function seedState(tables: BanquetTable[]) {
  localStorage.setItem(
    BANQUET_STATE_KEY,
    JSON.stringify({
      title: '测试',
      pasteText: '',
      guests: GUESTS,
      groups: GROUPS,
      tables,
      markers: [],
      paper: 'a4',
      orientation: 'landscape',
      exportColors: false,
    }),
  )
}

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

const toasts = () => useToastStore().toasts
const titles = () => toasts().map((t) => t.title)
const texts = () => toasts().map((t) => t.text ?? '')

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  Element.prototype.scrollIntoView = vi.fn()
  localStorage.clear()
  setActivePinia(createPinia())
  downloadBlob.mockReset()
  exportPagedPdf.mockReset()
  printAndWaitUntilDone.mockReset()
  printAndWaitUntilDone.mockResolvedValue(undefined)
})

describe('第 369 轮：导出前预检（0 安排）', () => {
  it('有名单但 0 人安排 → CSV 不产生 downloadBlob，warning「还没有已安排的宾客，先一键自动分配」', async () => {
    seedState([table('t1', '1号桌', 4, [])])
    const wrapper = await mountView()
    await wrapper.find('[data-testid="banquet-roster-csv"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(downloadBlob).not.toHaveBeenCalled()
    const warn = toasts().find((t) => t.title === '还没有已安排的宾客，先一键自动分配')
    expect(warn).toBeTruthy()
    expect(warn!.type).toBe('warning')
    wrapper.unmount()
  })

  it('0 人安排 → 速查表 PDF 与打印同样被阻止，不调用 exportPagedPdf / print', async () => {
    seedState([table('t1', '1号桌', 4, [])])
    const wrapper = await mountView()
    await wrapper.find('[data-testid="banquet-quickref-pdf"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="banquet-quickref-print"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(exportPagedPdf).not.toHaveBeenCalled()
    expect(printAndWaitUntilDone).not.toHaveBeenCalled()
    expect(titles().filter((t) => t === '还没有已安排的宾客，先一键自动分配')).toHaveLength(2)
    expect(titles()).not.toContain('即将调起浏览器打印')
    wrapper.unmount()
  })

  it('名单为空 → 仍是「名单为空」提示，不导出', async () => {
    const wrapper = await mountView()
    await wrapper.find('[data-testid="banquet-roster-csv"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(downloadBlob).not.toHaveBeenCalled()
    expect(titles()).toContain('名单为空')
    expect(titles()).not.toContain('还没有已安排的宾客，先一键自动分配')
    wrapper.unmount()
  })
})

describe('第 369 轮：部分 / 全部安排时的导出文案', () => {
  it('4 人中 3 人已安排 → CSV 正常下载，成功文案带「1 位未安排宾客已列在末尾」，CSV 末尾含「待安排」行', async () => {
    seedState([table('t1', '1号桌', 4, ['a1', 'a2', 'b1'])])
    const wrapper = await mountView()
    await wrapper.find('[data-testid="banquet-roster-csv"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(downloadBlob).toHaveBeenCalledTimes(1)
    const blob = downloadBlob.mock.calls[0]![0] as Blob
    const csv = await blob.text()
    expect(csv).toContain('待安排,,乙二')
    expect(titles()).toContain('CSV 已下载')
    const success = toasts().find((t) => t.title === 'CSV 已下载')!
    expect(success.type).toBe('success')
    expect(success.text).toContain('可直接用 Excel 打开')
    expect(success.text).toContain('1 位未安排宾客已列在末尾「待安排」')
    wrapper.unmount()
  })

  it('部分安排 → 速查表 PDF 导出成功文案带未安排提示；打印提示同样带上', async () => {
    seedState([table('t1', '1号桌', 4, ['a1', 'a2'])])
    exportPagedPdf.mockResolvedValue(undefined)
    const wrapper = await mountView()
    await wrapper.find('[data-testid="banquet-quickref-pdf"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    await wrapper.vm.$nextTick()
    expect(exportPagedPdf).toHaveBeenCalledTimes(1)
    const pdf = toasts().find((t) => t.title === '速查表 PDF 已导出')
    expect(pdf).toBeTruthy()
    expect(pdf!.text).toContain('2 位未安排宾客已列在末尾「待安排」')

    await wrapper.find('[data-testid="banquet-quickref-print"]').trigger('click')
    await wrapper.vm.$nextTick()
    const print = toasts().find((t) => t.title === '即将调起浏览器打印')
    expect(print).toBeTruthy()
    expect(print!.text).toContain('2 位未安排宾客已列在末尾「待安排」')
    await new Promise((r) => setTimeout(r, 1300))
    expect(printAndWaitUntilDone).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('全部安排 → 文案与原来完全一致，不出现未安排提示', async () => {
    seedState([table('t1', '1号桌', 4, ['a1', 'a2', 'b1', 'b2'])])
    const wrapper = await mountView()
    await wrapper.find('[data-testid="banquet-roster-csv"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(downloadBlob).toHaveBeenCalledTimes(1)
    const success = toasts().find((t) => t.title === 'CSV 已下载')!
    expect(success.text).toBe('列：桌名 / 座次 / 姓名 / 分组，可直接用 Excel 打开')
    expect(texts().some((t) => t.includes('未安排'))).toBe(false)
    wrapper.unmount()
  })
})
