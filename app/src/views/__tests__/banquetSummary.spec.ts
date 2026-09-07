// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useToastStore } from '@/stores/toast'
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

/** 4 桌：「男方亲友」被拆到 1/2 号桌，3 号桌满座同组，4 号桌为空桌 */
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
  const tables = [
    table('t1', '1号桌', 2, ['a1', 'a2']),
    table('t2', '2号桌', 2, ['a3']),
    table('t3', '3号桌', 2, ['b1', 'b2']),
    table('t4', '4号桌', 2, []),
  ]
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

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  Element.prototype.scrollIntoView = vi.fn()
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('BanquetView 摘要栏：拆分分组明细 + 删除空桌', () => {
  it('拆分分组 N>0 时可展开明细，显示分组名与各桌人数', async () => {
    seedState()
    const wrapper = await mountView()
    const summary = wrapper.find('[data-banquet-summary]')
    expect(summary.text()).toContain('拆分分组 1')
    expect(wrapper.find('[data-testid="split-groups-details"]').exists()).toBe(false)

    const toggle = wrapper.find('[data-testid="split-groups-toggle"]')
    expect(toggle.exists()).toBe(true)
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')

    const details = wrapper.find('[data-testid="split-groups-details"]')
    expect(details.exists()).toBe(true)
    expect(toggle.attributes('aria-expanded')).toBe('true')
    const rows = details.findAll('li')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain('男方亲友')
    expect(rows[0]!.text()).toContain('1号桌（2 人）')
    expect(rows[0]!.text()).toContain('2号桌（1 人）')
    expect(rows[0]!.text()).not.toContain('同事')

    wrapper.unmount()
  })

  it('N=0 时不渲染展开控件', async () => {
    const wrapper = await mountView()
    expect(wrapper.find('[data-banquet-summary]').text()).toContain('拆分分组 0')
    expect(wrapper.find('[data-testid="split-groups-toggle"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="remove-empty-tables"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('点击「删除空桌」后空桌归 0、默认桌名重新编号并 toast', async () => {
    seedState()
    const wrapper = await mountView()
    const toast = useToastStore()
    const summary = wrapper.find('[data-banquet-summary]')
    expect(summary.text()).toContain('空桌 1')

    const remove = wrapper.find('[data-testid="remove-empty-tables"]')
    expect(remove.exists()).toBe(true)
    expect(remove.text()).toBe('删除空桌')
    await remove.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-banquet-summary]').text()).toContain('空桌 0')
    expect(wrapper.find('[data-testid="remove-empty-tables"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-table-id]')).toHaveLength(3)
    expect(toast.toasts.some((t) => t.title.includes('已删除空桌'))).toBe(true)

    const persisted = JSON.parse(localStorage.getItem(BANQUET_STATE_KEY) ?? '{}') as {
      tables: BanquetTable[]
    }
    expect(persisted.tables.map((t) => t.name)).toEqual(['1号桌', '2号桌', '3号桌'])

    wrapper.unmount()
  })
})

describe('第 346 轮：BanquetView 分配策略 + 拆分原因', () => {
  /** 2 桌 × 10 座；同学 12 人（必拆）、亲友 6 人、同事 6 人 */
  function seedBig() {
    const guests = [
      ...Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, name: `同学${i}`, groupId: 'gC' })),
      ...Array.from({ length: 6 }, (_, i) => ({ id: `a${i}`, name: `亲友${i}`, groupId: 'gA' })),
      ...Array.from({ length: 6 }, (_, i) => ({ id: `b${i}`, name: `同事${i}`, groupId: 'gB' })),
    ]
    const groups = [
      { id: 'gC', name: '同学', color: '#4f46e5' },
      { id: 'gA', name: '亲友', color: '#0891b2' },
      { id: 'gB', name: '同事', color: '#d97706' },
    ]
    const tables = [
      table('t1', '1号桌', 10, []),
      table('t2', '2号桌', 10, []),
      table('t3', '3号桌', 10, []),
    ]
    localStorage.setItem(
      BANQUET_STATE_KEY,
      JSON.stringify({ title: '测试', pasteText: '', guests, groups, tables, markers: [], paper: 'a4', orientation: 'landscape', exportColors: false }),
    )
  }

  it('默认策略「尽量不拆组」：拆分明细每行显示原因与桌号；切到「优先坐满」后结果变化', async () => {
    seedBig()
    const wrapper = await mountView()
    const strategy = wrapper.find('[data-testid="assign-strategy"]')
    expect(strategy.exists()).toBe(true)
    expect(strategy.text()).toContain('尽量不拆组（默认）')

    await wrapper.find('[data-testid="auto-assign"]').trigger('click')
    await wrapper.vm.$nextTick()
    // keep-groups：同学 12 > 10 必拆（10+2），亲友 6 → 3号桌，同事 6 → 2号桌剩 8 → 不拆
    expect(wrapper.find('[data-banquet-summary]').text()).toContain('拆分分组 1')
    await wrapper.find('[data-testid="split-groups-toggle"]').trigger('click')
    let rows = wrapper.findAll('[data-testid="split-groups-details"] li')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.attributes('data-split-reason')).toBe('group-larger-than-any-table')
    expect(rows[0]!.text()).toContain('同学 12 人 > 任一桌最大 10 座')
    expect(rows[0]!.text()).toContain('拆到')
    expect(rows[0]!.text()).toContain('1号桌（10 人）')
    expect(rows[0]!.text()).toContain('2号桌（2 人）')

    // 切换到 fill-tables：同学 10+2、亲友 2号桌剩 8 → 6 不拆、同事 2号桌剩 2 + 3号桌 4 → 拆
    const trigger = strategy.find('button')
    await trigger.trigger('click')
    const option = strategy.findAll('[role="option"], li, button').find((el) => el.text().includes('优先坐满'))
    expect(option).toBeTruthy()
    await option!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="auto-assign"]').text()).toContain('优先坐满')
    await wrapper.find('[data-testid="auto-assign"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-banquet-summary]').text()).toContain('拆分分组 2')
    if (!wrapper.find('[data-testid="split-groups-details"]').exists()) {
      await wrapper.find('[data-testid="split-groups-toggle"]').trigger('click')
    }
    rows = wrapper.findAll('[data-testid="split-groups-details"] li')
    expect(rows).toHaveLength(2)
    const reasons = rows.map((r) => r.attributes('data-split-reason'))
    expect(reasons).toContain('group-larger-than-any-table')
    expect(reasons).toContain('no-table-had-enough-free-seats')
    const colleague = rows.find((r) => r.text().includes('同事'))!
    expect(colleague.text()).toContain('同事 6 人：轮到时没有一桌剩余座位够整组坐下')
    expect(colleague.text()).toContain('2号桌（2 人）')
    expect(colleague.text()).toContain('3号桌（4 人）')

    wrapper.unmount()
  })
})
