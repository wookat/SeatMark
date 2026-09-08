// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setLocale } from '@/i18n'
import { BANQUET_STATE_KEY, type BanquetTable } from '@/utils/banquet'
import BanquetView from '@/views/BanquetView.vue'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function table(id: string, name: string, seats: number, guestIds: string[]): BanquetTable {
  return { id, name, shape: 'round', x: 0, y: 0, width: 80, height: 80, seats, guestIds }
}

/** 2 桌各 3 座：甲组 3 人 + 乙组 2 人；甲三、乙一分别坐在「不属于本组」的桌上 */
function seedState() {
  const guests = [
    { id: 'a1', name: '甲一', groupId: 'gA' },
    { id: 'a2', name: '甲二', groupId: 'gA' },
    { id: 'a3', name: '甲三', groupId: 'gA' },
    { id: 'b1', name: '乙一', groupId: 'gB' },
    { id: 'b2', name: '乙二', groupId: 'gB' },
  ]
  const groups = [
    { id: 'gA', name: '男方亲友', color: '#4f46e5' },
    { id: 'gB', name: '同事', color: '#0891b2' },
  ]
  const tables = [table('t1', '1号桌', 3, ['a1', 'a2', 'b1']), table('t2', '2号桌', 3, ['a3', 'b2'])]
  localStorage.setItem(
    BANQUET_STATE_KEY,
    JSON.stringify({
      title: '测试',
      pasteText: '',
      guests,
      groups,
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
    ],
  })
  const wrapper = mount(BanquetView, {
    global: { plugins: [router], stubs: { Teleport: true, Transition: true } },
    attachTo: document.body,
  })
  await wrapper.vm.$nextTick()
  return wrapper
}

function persisted() {
  return JSON.parse(localStorage.getItem(BANQUET_STATE_KEY) ?? '{}') as {
    guests: { id: string; pinnedTableId?: string | null }[]
    tables: { id: string; guestIds: string[] }[]
  }
}

function pinToggleFor(wrapper: Awaited<ReturnType<typeof mountView>>, tableId: string, name: string) {
  const chips = wrapper.findAll(`[data-table-id="${tableId}"] .banquet-guest`)
  const chip = chips.find((c) => c.text().includes(name))
  expect(chip, `${tableId} 应有 ${name}`).toBeTruthy()
  return chip!.find('[data-testid="guest-pin-toggle"]')
}

beforeEach(async () => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  Element.prototype.scrollIntoView = vi.fn()
  localStorage.clear()
  setActivePinia(createPinia())
  await setLocale('zh')
})

describe('第 358 轮 P2-1：BanquetView 钉住宾客', () => {
  it('芯片上的图钉可切换钉住；钉住状态持久化到本地状态且不触发任何网络请求', async () => {
    seedState()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const wrapper = await mountView()

    const toggle = pinToggleFor(wrapper, 't1', '乙一')
    expect(toggle.exists()).toBe(true)
    expect(toggle.attributes('aria-pressed')).toBe('false')
    expect(wrapper.find('[data-testid="pin-count"]').exists()).toBe(false)

    await toggle.trigger('click')
    expect(toggle.attributes('aria-pressed')).toBe('true')
    expect(toggle.attributes('aria-label')).toBe('取消钉住 乙一')
    expect(wrapper.find('[data-testid="pin-count"]').text()).toBe('已钉住 1 人')
    await new Promise((r) => setTimeout(r, 0))
    expect(persisted().guests.find((g) => g.id === 'b1')?.pinnedTableId).toBe('t1')

    await toggle.trigger('click')
    expect(toggle.attributes('aria-pressed')).toBe('false')
    expect(wrapper.find('[data-testid="pin-count"]').exists()).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()

    fetchSpy.mockRestore()
    wrapper.unmount()
  })

  it('钉住 2 人后重新自动分配（同组同桌）：二人桌位不变，其余按组分配且不超容量', async () => {
    seedState()
    const wrapper = await mountView()

    await pinToggleFor(wrapper, 't1', '乙一').trigger('click')
    await pinToggleFor(wrapper, 't2', '甲三').trigger('click')
    expect(wrapper.find('[data-testid="pin-count"]').text()).toBe('已钉住 2 人')

    await wrapper.find('[data-testid="auto-assign"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))

    const t1 = persisted().tables.find((t) => t.id === 't1')!
    const t2 = persisted().tables.find((t) => t.id === 't2')!
    expect(t1.guestIds).toContain('b1')
    expect(t2.guestIds).toContain('a3')
    expect(t1.guestIds.length).toBeLessThanOrEqual(3)
    expect(t2.guestIds.length).toBeLessThanOrEqual(3)
    expect([...t1.guestIds, ...t2.guestIds].sort()).toEqual(['a1', 'a2', 'a3', 'b1', 'b2'])
    // 钉住芯片仍带钉住标记
    expect(pinToggleFor(wrapper, 't1', '乙一').attributes('aria-pressed')).toBe('true')
    expect(pinToggleFor(wrapper, 't2', '甲三').attributes('aria-pressed')).toBe('true')

    wrapper.unmount()
  })

  it('EN locale：图钉 aria-label / 说明 / 已钉住计数均为英文（无 CJK）', async () => {
    seedState()
    await setLocale('en')
    const wrapper = await mountView()
    const cjk = /[\u4e00-\u9fff]/

    const toggle = pinToggleFor(wrapper, 't1', '乙一')
    expect(toggle.attributes('aria-label')).toBe('Pin 乙一 to this table')
    expect(toggle.attributes('title')).toBe('Pin to this table')
    const hint = wrapper.find('[data-testid="pin-hint"]')
    expect(cjk.test(hint.text())).toBe(false)
    expect(hint.text()).toContain('pin')

    await toggle.trigger('click')
    expect(toggle.attributes('aria-label')).toBe('Unpin 乙一')
    expect(wrapper.find('[data-testid="pin-count"]').text()).toBe('1 pinned')

    wrapper.unmount()
  })
})
