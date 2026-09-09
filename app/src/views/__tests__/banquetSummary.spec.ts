// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useToastStore } from '@/stores/toast'
import { BANQUET_STATE_KEY, estimateCapacity, type BanquetGuest, type BanquetTable } from '@/utils/banquet'
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
    expect(wrapper.find('[data-testid="auto-assign"]').text()).toContain('尽量不拆组')
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
    expect(disabled.text()).toContain('这组 3 人没有一桌能坐下整组，已拆到 2 桌')
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

describe('第 366 轮：estimateCapacity 纯函数（与摘要栏同一份 guests / tables）', () => {
  function guestsOf(n: number, prefix = 'g'): BanquetGuest[] {
    return Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, name: `宾客${i}`, groupId: null }))
  }

  it('充足：48 人、8 桌×10 座 → 按每桌坐满至少 5 桌、预计空 3 桌', () => {
    const tables = Array.from({ length: 8 }, (_, i) => table(`t${i}`, `${i + 1}号桌`, 10, []))
    expect(estimateCapacity(guestsOf(48), tables)).toMatchObject({
      status: 'enough',
      guests: 48,
      tables: 8,
      seats: 80,
      capacity: 80,
      shortage: 0,
      minTables: 5,
      expectedEmptyTables: 3,
      lockedTables: 0,
    })
  })

  it('不足：30 人、3 桌×8 座 → 还差 6 个座位', () => {
    const tables = Array.from({ length: 3 }, (_, i) => table(`t${i}`, `${i + 1}号桌`, 8, []))
    expect(estimateCapacity(guestsOf(30), tables)).toMatchObject({
      status: 'short',
      seats: 24,
      capacity: 24,
      shortage: 6,
      minTables: 0,
      expectedEmptyTables: 0,
    })
  })

  it('空表：无名单 → no-guests；有名单无桌 → no-tables', () => {
    expect(estimateCapacity([], [table('t0', '1号桌', 10, [])]).status).toBe('no-guests')
    expect(estimateCapacity(guestsOf(5), []).status).toBe('no-tables')
    expect(estimateCapacity([], []).status).toBe('no-guests')
  })

  it('含锁定桌：锁定桌空位不计入容量、已就座人数计入；最少桌数 = 锁定桌 + 剩余人按未锁定桌均座向上取整', () => {
    const guests = guestsOf(25)
    const locked: BanquetTable = { ...table('L', '主桌', 10, ['g0', 'g1', 'g2', 'g3']), locked: true }
    const open = Array.from({ length: 3 }, (_, i) => table(`t${i}`, `${i + 1}号桌`, 10, []))
    // 容量 = 30（未锁定）+ 4（锁定桌已坐）= 34 ≥ 25；剩余 21 人 / 均 10 座 → 3 桌；最少 1 + 3 = 4 桌，空 0
    expect(estimateCapacity(guests, [locked, ...open])).toMatchObject({
      status: 'enough',
      seats: 40,
      capacity: 34,
      lockedTables: 1,
      minTables: 4,
      expectedEmptyTables: 0,
    })
    // 锁定桌空着 6 座不可用：35 人时容量 34 → 差 1
    expect(estimateCapacity(guestsOf(35), [locked, ...open])).toMatchObject({ status: 'short', shortage: 1 })
  })

  describe('第 373 轮：oversizedGroups 预判必拆分组', () => {
    const groups = [
      { id: 'a', name: '男方亲友', color: '#000' },
      { id: 'b', name: '女方亲友', color: '#000' },
      { id: 'c', name: '同事', color: '#000' },
    ]
    function grouped(sizes: Record<string, number>): BanquetGuest[] {
      return Object.entries(sizes).flatMap(([groupId, n]) =>
        Array.from({ length: n }, (_, i) => ({ id: `${groupId}${i}`, name: `${groupId}${i}`, groupId })),
      )
    }

    it('16 人组 vs 10 座桌 → 命中（带组名、人数、单桌最大座位）；≤10 人组不计', () => {
      const tables = Array.from({ length: 5 }, (_, i) => table(`t${i}`, `${i + 1}号桌`, 10, []))
      const est = estimateCapacity(grouped({ a: 16, b: 16, c: 10 }), tables, groups)
      expect(est.status).toBe('enough')
      expect(est.oversizedGroups).toEqual([
        { groupId: 'a', groupName: '男方亲友', size: 16, maxTableSeats: 10 },
        { groupId: 'b', groupName: '女方亲友', size: 16, maxTableSeats: 10 },
      ])
      // 座位不足（short）时同样给出预判
      const short = estimateCapacity(grouped({ a: 16, b: 16, c: 10 }), tables.slice(0, 3), groups)
      expect(short.status).toBe('short')
      expect(short.oversizedGroups.map((g) => g.groupId)).toEqual(['a', 'b'])
    })

    it('所有分组 ≤ 单桌最大座位、或无分组 → 空数组', () => {
      const tables = [table('t0', '1号桌', 8, []), table('t1', '2号桌', 12, [])]
      expect(estimateCapacity(grouped({ a: 12, b: 3 }), tables, groups).oversizedGroups).toEqual([])
      expect(estimateCapacity(guestsOf(20), tables, groups).oversizedGroups).toEqual([])
      expect(estimateCapacity(grouped({ a: 12 }), [], groups).oversizedGroups).toEqual([])
    })

    it('锁定桌不计：唯一的 20 座桌被锁定后，12 人组按未锁定桌最大 10 座判定必拆；未传 groups 时组名回退为 id', () => {
      const big: BanquetTable = { ...table('L', '主桌', 20, []), locked: true }
      const small = [table('t0', '1号桌', 10, []), table('t1', '2号桌', 10, [])]
      expect(estimateCapacity(grouped({ a: 12 }), [big, ...small], groups).oversizedGroups).toEqual([
        { groupId: 'a', groupName: '男方亲友', size: 12, maxTableSeats: 10 },
      ])
      expect(estimateCapacity(grouped({ a: 12 }), [{ ...big, locked: false }, ...small], groups).oversizedGroups).toEqual([])
      expect(estimateCapacity(grouped({ a: 12 }), small).oversizedGroups[0]).toMatchObject({ groupName: 'a' })
      // 全部桌锁定：无可分配桌，不做预判
      expect(
        estimateCapacity(grouped({ a: 12 }), small.map((t) => ({ ...t, locked: true })), groups).oversizedGroups,
      ).toEqual([])
    })
  })
})

describe('第 373 轮：容量预估文案追加「哪些分组会被拆」预告', () => {
  it('48 人、3 个 16 人组、6 桌×10 座：分配前即列出 3 个必拆分组，分配后摘要「拆分分组 3」一致', async () => {
    const groups = [
      { id: 'a', name: '男方亲友', color: '#4f46e5' },
      { id: 'b', name: '女方亲友', color: '#e11d48' },
      { id: 'c', name: '同事', color: '#0891b2' },
    ]
    const guests = groups.flatMap((g) =>
      Array.from({ length: 16 }, (_, i) => ({ id: `${g.id}${i}`, name: `${g.name}${i}`, groupId: g.id })),
    )
    const tables = Array.from({ length: 6 }, (_, i) => table(`t${i + 1}`, `${i + 1}号桌`, 10, []))
    localStorage.setItem(
      BANQUET_STATE_KEY,
      JSON.stringify({ title: '测试', pasteText: '', guests, groups, tables, markers: [], paper: 'a4', orientation: 'landscape', exportColors: false }),
    )
    const wrapper = await mountView()
    const estimate = wrapper.find('[data-testid="capacity-estimate"]')
    expect(estimate.attributes('data-status')).toBe('enough')
    expect(estimate.text()).toContain('3 个分组人数超过单桌最大 10 座，分配时会拆到多桌：男方亲友、女方亲友、同事')
    expect(estimate.text()).not.toContain('…')

    await wrapper.find('[data-testid="auto-assign"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-banquet-summary]').text()).toContain('拆分分组 3')
    wrapper.unmount()
  })

  it('无超容量分组时不追加预告；超过 3 组只列前 3 组并加省略号', async () => {
    const groups = Array.from({ length: 4 }, (_, i) => ({ id: `g${i}`, name: `第${i + 1}组`, color: '#000' }))
    const smallGuests = groups.flatMap((g) =>
      Array.from({ length: 5 }, (_, i) => ({ id: `${g.id}-${i}`, name: `${g.name}${i}`, groupId: g.id })),
    )
    const tables = Array.from({ length: 4 }, (_, i) => table(`t${i + 1}`, `${i + 1}号桌`, 10, []))
    localStorage.setItem(
      BANQUET_STATE_KEY,
      JSON.stringify({ title: '测试', pasteText: '', guests: smallGuests, groups, tables, markers: [], paper: 'a4', orientation: 'landscape', exportColors: false }),
    )
    let wrapper = await mountView()
    expect(wrapper.find('[data-testid="capacity-estimate"]').text()).not.toContain('分配时会拆到多桌')
    wrapper.unmount()

    const bigGuests = groups.flatMap((g) =>
      Array.from({ length: 11 }, (_, i) => ({ id: `${g.id}-${i}`, name: `${g.name}${i}`, groupId: g.id })),
    )
    localStorage.setItem(
      BANQUET_STATE_KEY,
      JSON.stringify({ title: '测试', pasteText: '', guests: bigGuests, groups, tables, markers: [], paper: 'a4', orientation: 'landscape', exportColors: false }),
    )
    wrapper = await mountView()
    const text = wrapper.find('[data-testid="capacity-estimate"]').text()
    expect(text).toContain('4 个分组人数超过单桌最大 10 座，分配时会拆到多桌：第1组、第2组、第3组…')
    expect(text).not.toContain('第4组')
    wrapper.unmount()
  })
})

describe('第 366 轮：第 3 步「一键自动分配」上方容量预估文案', () => {
  it('48 人、8 桌×10 座：显示「至少需要 5 桌 … 预计空 3 桌」，且在自动分配按钮之前', async () => {
    const guests = Array.from({ length: 48 }, (_, i) => ({ id: `g${i}`, name: `宾客${i}`, groupId: null }))
    const tables = Array.from({ length: 8 }, (_, i) => table(`t${i + 1}`, `${i + 1}号桌`, 10, []))
    localStorage.setItem(
      BANQUET_STATE_KEY,
      JSON.stringify({ title: '测试', pasteText: '', guests, groups: [], tables, markers: [], paper: 'a4', orientation: 'landscape', exportColors: false }),
    )
    const wrapper = await mountView()
    const estimate = wrapper.find('[data-testid="capacity-estimate"]')
    expect(estimate.exists()).toBe(true)
    expect(estimate.attributes('data-status')).toBe('enough')
    expect(estimate.text()).toContain('48 位宾客 · 8 桌 80 座')
    expect(estimate.text()).toContain('至少需要 5 桌')
    expect(estimate.text()).toContain('预计空 3 桌')
    const section = estimate.element.parentElement!
    const btn = wrapper.find('[data-testid="auto-assign"]').element
    expect(section.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(estimate.element.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    // 自动分配后摘要栏口径：无分组 → 48 人坐满 5 桌、空 3 桌，与预估不矛盾
    await wrapper.find('[data-testid="auto-assign"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-banquet-summary]').text()).toContain('空桌 3')
    wrapper.unmount()
  })

  it('座位不足时显示缺口并提示加桌；无名单时提示先完成第 1 步', async () => {
    const guests = Array.from({ length: 30 }, (_, i) => ({ id: `g${i}`, name: `宾客${i}`, groupId: null }))
    const tables = Array.from({ length: 3 }, (_, i) => table(`t${i + 1}`, `${i + 1}号桌`, 8, []))
    localStorage.setItem(
      BANQUET_STATE_KEY,
      JSON.stringify({ title: '测试', pasteText: '', guests, groups: [], tables, markers: [], paper: 'a4', orientation: 'landscape', exportColors: false }),
    )
    const wrapper = await mountView()
    const estimate = wrapper.find('[data-testid="capacity-estimate"]')
    expect(estimate.attributes('data-status')).toBe('short')
    expect(estimate.text()).toContain('30 位宾客 · 3 桌 24 座，还差 6 个座位，请加桌或提高每桌座位数')
    wrapper.unmount()

    localStorage.setItem(
      BANQUET_STATE_KEY,
      JSON.stringify({ title: '测试', pasteText: '', guests: [], groups: [], tables, markers: [], paper: 'a4', orientation: 'landscape', exportColors: false }),
    )
    const empty = await mountView()
    const est2 = empty.find('[data-testid="capacity-estimate"]')
    expect(est2.attributes('data-status')).toBe('no-guests')
    expect(est2.text()).toContain('请先在第 1 步导入宾客名单')
    empty.unmount()
  })
})
