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
    // 第 347 轮：本次分配后拆分明细自动展开，无需再点 toggle
    expect(wrapper.find('[data-testid="split-groups-toggle"]').attributes('aria-expanded')).toBe('true')
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

describe('第 347 轮：拆分/空桌收尾动作', () => {
  /** 48 人 3 组：同学 20（必拆）、亲友 11（可整桌）、同事 17（必拆）；6 桌 × 11 座（总 66 座，会出现空桌） */
  function seed48() {
    const guests = [
      ...Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, name: `同学${i}`, groupId: 'gC' })),
      ...Array.from({ length: 11 }, (_, i) => ({ id: `a${i}`, name: `亲友${i}`, groupId: 'gA' })),
      ...Array.from({ length: 17 }, (_, i) => ({ id: `b${i}`, name: `同事${i}`, groupId: 'gB' })),
    ]
    const groups = [
      { id: 'gC', name: '同学', color: '#4f46e5' },
      { id: 'gA', name: '亲友', color: '#0891b2' },
      { id: 'gB', name: '同事', color: '#d97706' },
    ]
    const tables = Array.from({ length: 6 }, (_, i) => table(`t${i + 1}`, `${i + 1}号桌`, 11, []))
    localStorage.setItem(
      BANQUET_STATE_KEY,
      JSON.stringify({ title: '测试', pasteText: '', guests, groups, tables, markers: [], paper: 'a4', orientation: 'landscape', exportColors: false }),
    )
  }

  async function pickStrategy(wrapper: Awaited<ReturnType<typeof mountView>>, label: string) {
    const strategy = wrapper.find('[data-testid="assign-strategy"]')
    await strategy.find('button').trigger('click')
    const option = strategy.findAll('[role="option"]').find((el) => el.text().includes(label))
    expect(option).toBeTruthy()
    await option!.trigger('click')
    await wrapper.vm.$nextTick()
  }

  it('48 人 fill-tables 后：明细自动展开含原因文案，toast 含后续动作提示，重新分配按钮切换策略并触发 autoAssign', async () => {
    seed48()
    const wrapper = await mountView()
    const toast = useToastStore()
    await pickStrategy(wrapper, '优先坐满')
    expect(wrapper.find('[data-testid="auto-assign"]').text()).toContain('优先坐满')

    await wrapper.find('[data-testid="auto-assign"]').trigger('click')
    await wrapper.vm.$nextTick()
    // fill-tables 按大组优先、按桌顺序坐满：同学 11+9，同事 2+11+4，亲友 7+4（轮到时无桌够整组）→ 3 组全拆，空桌 1
    const summary = wrapper.find('[data-banquet-summary]').text()
    expect(summary).toContain('拆分分组 3')
    expect(summary).toContain('空桌 1')

    const details = wrapper.find('[data-testid="split-groups-details"]')
    expect(details.exists()).toBe(true)
    expect(wrapper.find('[data-testid="split-groups-toggle"]').attributes('aria-expanded')).toBe('true')
    const rows = details.findAll('li')
    expect(rows).toHaveLength(3)
    expect(rows.some((r) => r.text().includes('同学 20 人 > 任一桌最大 11 座'))).toBe(true)
    expect(rows.some((r) => r.text().includes('轮到时没有一桌剩余座位够整组坐下'))).toBe(true)

    const last = toast.toasts.at(-1)!
    expect(last.title).toContain('已自动分配座位')
    expect(last.text).toContain('可指定整组到某桌，或换策略重新分配')
    expect(last.text).toContain('空桌可在摘要栏一键删除，也可保留备用')

    // 当前策略 fill-tables → 只展示「换用尽量不拆组」快捷按钮；空桌备用说明可见
    const actions = wrapper.find('[data-testid="split-reassign-actions"]')
    expect(actions.exists()).toBe(true)
    expect(actions.text()).toContain('空桌可删除，也可保留备用')
    expect(wrapper.find('[data-testid="reassign-fill-tables"]').exists()).toBe(false)
    const keep = wrapper.find('[data-testid="reassign-keep-groups"]')
    expect(keep.exists()).toBe(true)
    expect(keep.text()).toContain('尽量不拆组')
    await keep.trigger('click')
    await wrapper.vm.$nextTick()

    // keep-groups：亲友 11 可整桌落座 → splitGroups 由 3 变为 2；策略已切换，快捷按钮互换
    expect(wrapper.find('[data-testid="auto-assign"]').text()).toContain('同组同桌')
    expect(wrapper.find('[data-banquet-summary]').text()).toContain('拆分分组 2')
    expect(wrapper.find('[data-testid="reassign-keep-groups"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="reassign-fill-tables"]').exists()).toBe(true)
    expect(toast.toasts.length).toBeGreaterThan(1)
    expect(toast.toasts.at(-1)!.title).toContain('已自动分配座位')

    // 删除空桌后 emptyTables=0，保留原有行为
    await wrapper.find('[data-testid="remove-empty-tables"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-banquet-summary]').text()).toContain('空桌 0')

    wrapper.unmount()
  })

  it('拆分明细每行的「指定到某桌」仅列剩余座位足够的桌；选择后整组归一桌；无可用桌时禁用并说明', async () => {
    // 3 组：甲 3 人拆在 1/2 号桌，4 号桌空（座 4）可容纳；乙 2 人同桌
    const guests = [
      { id: 'a1', name: '甲一', groupId: 'gA' },
      { id: 'a2', name: '甲二', groupId: 'gA' },
      { id: 'a3', name: '甲三', groupId: 'gA' },
      { id: 'b1', name: '乙一', groupId: 'gB' },
      { id: 'b2', name: '乙二', groupId: 'gB' },
      { id: 'd1', name: '丁一', groupId: 'gD' },
      { id: 'd2', name: '丁二', groupId: 'gD' },
      { id: 'd3', name: '丁三', groupId: 'gD' },
      { id: 'd4', name: '丁四', groupId: 'gD' },
      { id: 'd5', name: '丁五', groupId: 'gD' },
    ]
    const groups = [
      { id: 'gA', name: '男方亲友', color: '#4f46e5' },
      { id: 'gB', name: '同事', color: '#0891b2' },
      { id: 'gD', name: '大家族', color: '#d97706' },
    ]
    const tables = [
      table('t1', '1号桌', 2, ['a1', 'a2']),
      table('t2', '2号桌', 4, ['a3', 'd1', 'd2', 'd3']),
      table('t3', '3号桌', 2, ['b1', 'b2']),
      table('t4', '4号桌', 4, ['d4', 'd5']),
    ]
    localStorage.setItem(
      BANQUET_STATE_KEY,
      JSON.stringify({ title: '测试', pasteText: '', guests, groups, tables, markers: [], paper: 'a4', orientation: 'landscape', exportColors: false }),
    )
    const wrapper = await mountView()
    await wrapper.find('[data-testid="split-groups-toggle"]').trigger('click')
    const rows = wrapper.findAll('[data-testid="split-groups-details"] li')
    expect(rows).toHaveLength(2)

    // 男方亲友 3 人：4 号桌剩 2（不够），2 号桌除去 a3 后剩 1（不够），1 号桌除去 a1/a2 后剩 2（不够）→ 禁用说明
    const groupA = rows.find((r) => r.text().includes('男方亲友'))!
    expect(groupA.find('[data-testid="move-group-gA"]').exists()).toBe(false)
    const disabled = groupA.find('[data-testid="move-group-gA-disabled"]')
    expect(disabled.exists()).toBe(true)
    expect(disabled.text()).toContain('无桌可整组容纳')
    expect(disabled.attributes('title')).toContain('没有一桌剩余座位够整组坐下')

    // 大家族 5 人：没有容纳 5 人的桌（最大 4 座）→ 也禁用
    const groupD = rows.find((r) => r.text().includes('大家族'))!
    expect(groupD.find('[data-testid="move-group-gD-disabled"]').exists()).toBe(true)

    // 把 4 号桌的丁四/丁五拿掉后，4 号桌空出 4 座 → 男方亲友可指定到 4 号桌
    const t4 = tables[3]!
    localStorage.setItem(
      BANQUET_STATE_KEY,
      JSON.stringify({
        title: '测试', pasteText: '', guests, groups,
        tables: [tables[0], tables[1], tables[2], { ...t4, guestIds: [] }],
        markers: [], paper: 'a4', orientation: 'landscape', exportColors: false,
      }),
    )
    wrapper.unmount()
    const w2 = await mountView()
    await w2.find('[data-testid="split-groups-toggle"]').trigger('click')
    const rowA = w2.findAll('[data-testid="split-groups-details"] li').find((r) => r.text().includes('男方亲友'))!
    const select = rowA.find('[data-testid="move-group-gA"]')
    expect(select.exists()).toBe(true)
    await select.find('button').trigger('click')
    const options = select.findAll('[role="option"]').map((o) => o.text())
    expect(options.some((o) => o.includes('4号桌'))).toBe(true)
    expect(options.some((o) => o.includes('3号桌'))).toBe(false)
    expect(options.some((o) => o.includes('2号桌'))).toBe(false)
    await select.findAll('[role="option"]').find((o) => o.text().includes('4号桌'))!.trigger('click')
    await w2.vm.$nextTick()

    expect(w2.find('[data-banquet-summary]').text()).toContain('拆分分组 0')
    const persisted = JSON.parse(localStorage.getItem(BANQUET_STATE_KEY) ?? '{}') as { tables: BanquetTable[] }
    expect(persisted.tables.find((t) => t.id === 't4')!.guestIds).toEqual(['a1', 'a2', 'a3'])
    expect(persisted.tables.find((t) => t.id === 't1')!.guestIds).toEqual([])
    expect(persisted.tables.find((t) => t.id === 't2')!.guestIds).toEqual(['d1', 'd2', 'd3'])
    const toast = useToastStore()
    expect(toast.toasts.at(-1)!.title).toContain('已将 男方亲友 整组移到 4号桌')

    w2.unmount()
  })
})

describe('第 356 轮：未安排区操作指引对比度', () => {
  it('拖拽/多选两种提示均用 text-slate-600，不再是 text-slate-400', async () => {
    localStorage.setItem(
      BANQUET_STATE_KEY,
      JSON.stringify({
        title: '测试', pasteText: '',
        guests: [{ id: 'a1', name: '甲一', groupId: 'gA' }, { id: 'a2', name: '甲二', groupId: 'gA' }],
        groups: [{ id: 'gA', name: '亲友', color: '#4f46e5' }],
        tables: [table('t1', '1号桌', 2, ['a1'])],
        markers: [], paper: 'a4', orientation: 'landscape', exportColors: false,
      }),
    )
    const wrapper = await mountView()
    const hint = wrapper.find('[data-testid="unassigned-pool-hint"]')
    expect(hint.exists()).toBe(true)
    expect(hint.text()).toContain('拖到餐桌上即可安排')
    expect(hint.classes()).toContain('text-slate-600')
    expect(hint.classes()).not.toContain('text-slate-400')

    await wrapper.find('[data-testid="toggle-multi-select"]').trigger('click')
    await wrapper.vm.$nextTick()
    const multiHint = wrapper.find('[data-testid="unassigned-pool-hint"]')
    expect(multiHint.text()).toContain('点选宾客后在底部操作条批量归组')
    expect(multiHint.classes()).toContain('text-slate-600')
    expect(multiHint.classes()).not.toContain('text-slate-400')
    wrapper.unmount()
  })
})

describe('第 350 轮：桌面端画布列吸顶', () => {
  it('右列容器仅在 lg 断点 sticky（top 4.5rem、self-start、max-h + overflow-auto），无断点的 sticky 类不出现', async () => {
    seedState()
    const wrapper = await mountView()
    const col = wrapper.find('[data-testid="banquet-canvas-column"]')
    expect(col.exists()).toBe(true)
    const classes = col.classes()
    expect(classes).toEqual(
      expect.arrayContaining([
        'lg:sticky',
        'lg:top-[4.5rem]',
        'lg:self-start',
        'lg:max-h-[calc(100vh-8.5rem)]',
        'lg:overflow-auto',
      ]),
    )
    expect(classes.filter((c) => /^(sticky|fixed|md:sticky|sm:sticky)$/.test(c))).toEqual([])
    // 画布容器仍在右列内，MobilePreviewJump / 缩放按钮引用不受影响
    expect(col.find('[data-testid="canvas-fit-toggle"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
