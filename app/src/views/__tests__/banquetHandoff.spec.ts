// @vitest-environment jsdom
/**
 * 第 355 轮：宴会排桌 → 座签工坊「一键生成席位卡 / 桌号牌」——
 * 复用 SEATING_HANDOFF_KEY：载荷 rows=[{姓名, 桌号, 分组, 座位号}]、title=宴会名、source='banquet'；
 * /studio?from=banquet 读取后即删除载荷，默认切到婚礼席位卡并自动映射 姓名→name、桌号→tableNo；
 * 未安排宾客时按钮禁用。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { defaultTemplates } from '@/data/defaultTemplates'
import { setLocale } from '@/i18n'
import { useToastStore } from '@/stores/toast'
import { useWorkspaceStore } from '@/stores/workspace'
import { autoMapFields } from '@/utils/autoMap'
import {
  BANQUET_HANDOFF_HEADERS,
  BANQUET_STATE_KEY,
  buildBanquetHandoffRows,
  type BanquetGroup,
  type BanquetGuest,
  type BanquetTable,
} from '@/utils/banquet'
import { SEATING_HANDOFF_KEY, type SeatingHandoff } from '@/utils/seating'
import BanquetView from '@/views/BanquetView.vue'
import StudioView from '@/views/StudioView.vue'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function table(id: string, name: string, seats: number, guestIds: string[]): BanquetTable {
  return { id, name, shape: 'round', x: 0, y: 0, width: 80, height: 80, seats, guestIds }
}

const guests: BanquetGuest[] = [
  { id: 'a1', name: '张伟', groupId: 'gA' },
  { id: 'a2', name: '王芳', groupId: 'gA' },
  { id: 'b1', name: '李娜', groupId: 'gB' },
  { id: 'u1', name: '刘洋', groupId: null },
  { id: 'x1', name: '未安排者', groupId: null },
]
const groups: BanquetGroup[] = [
  { id: 'gA', name: '男方亲友', color: '#4f46e5' },
  { id: 'gB', name: '同事', color: '#0891b2' },
]
const tables: BanquetTable[] = [
  table('t1', '1号桌', 4, ['a1', 'a2']),
  table('t2', '2号桌', 4, ['b1', 'ghost', 'u1']),
  table('t3', '3号桌', 4, []),
]

function seedState(assigned: boolean) {
  localStorage.setItem(
    BANQUET_STATE_KEY,
    JSON.stringify({
      title: '张王婚宴',
      pasteText: '',
      guests,
      groups,
      tables: assigned ? tables : tables.map((t) => ({ ...t, guestIds: [] })),
      markers: [],
      paper: 'a4',
      orientation: 'landscape',
      exportColors: false,
    }),
  )
}

async function makeRouter(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push(path)
  await router.isReady()
  return router
}

async function mountBanquet() {
  const router = await makeRouter('/banquet')
  const wrapper = mount(BanquetView, {
    global: { plugins: [router], stubs: { Teleport: true, Transition: true } },
    attachTo: document.body,
  })
  await wrapper.vm.$nextTick()
  return { router, wrapper }
}

const STUDIO_STUBS = {
  PreviewArea: true,
  TemplateDesigner: true,
  DataImportPanel: true,
  MappingPanel: true,
  LayoutPanel: true,
  TemplatePickerPanel: true,
}

beforeEach(async () => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  )
  Element.prototype.scrollIntoView = vi.fn()
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
  await setLocale('zh')
})

describe('buildBanquetHandoffRows（纯函数）', () => {
  it('按桌顺序展开已安排宾客：桌号 = 桌名、座位号 = 桌内座次、分组名可空；未安排与幽灵 id 不出现', () => {
    const rows = buildBanquetHandoffRows(guests, tables, groups)
    expect(rows).toEqual([
      { 姓名: '张伟', 桌号: '1号桌', 分组: '男方亲友', 座位号: '1' },
      { 姓名: '王芳', 桌号: '1号桌', 分组: '男方亲友', 座位号: '2' },
      { 姓名: '李娜', 桌号: '2号桌', 分组: '同事', 座位号: '1' },
      { 姓名: '刘洋', 桌号: '2号桌', 分组: '', 座位号: '2' },
    ])
    for (const row of rows) expect(Object.keys(row)).toEqual([...BANQUET_HANDOFF_HEADERS])
  })

  it('无人安排返回空数组', () => {
    expect(buildBanquetHandoffRows(guests, tables.map((t) => ({ ...t, guestIds: [] })), groups)).toEqual([])
  })

  it('婚礼席位卡对载荷表头自动映射：name→姓名、tableNo→桌号', () => {
    const place = defaultTemplates.find((t) => t.id === 'weddingPlace')!
    const mapping = autoMapFields(place.fields, [...BANQUET_HANDOFF_HEADERS])
    expect(mapping.name).toBe('姓名')
    expect(mapping.tableNo).toBe('桌号')
  })
})

describe('BanquetView「一键生成席位卡 / 桌号牌」', () => {
  it('有已安排宾客：写入 SEATING_HANDOFF_KEY 载荷（source=banquet，rows 姓名/桌号/分组/座位号）并跳转 /studio?from=banquet', async () => {
    seedState(true)
    const { router, wrapper } = await mountBanquet()
    const button = wrapper.get('[data-testid="banquet-place-cards"]')
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    await flushPromises()

    const raw = localStorage.getItem(SEATING_HANDOFF_KEY)
    expect(raw).toBeTruthy()
    const handoff = JSON.parse(raw!) as SeatingHandoff
    expect(handoff.source).toBe('banquet')
    expect(handoff.title).toBe('张王婚宴')
    expect(handoff.rows).toHaveLength(4)
    expect(Object.keys(handoff.rows[0]!)).toEqual([...BANQUET_HANDOFF_HEADERS])
    expect(handoff.rows[0]).toEqual({ 姓名: '张伟', 桌号: '1号桌', 分组: '男方亲友', 座位号: '1' })
    expect(router.currentRoute.value.fullPath).toBe('/studio?from=banquet')
    wrapper.unmount()
  })

  it('未安排宾客：按钮禁用并带提示，不写载荷', async () => {
    seedState(false)
    const { router, wrapper } = await mountBanquet()
    const button = wrapper.get('[data-testid="banquet-place-cards"]')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('title')).toContain('先在第 3 步安排宾客')
    expect(wrapper.text()).toContain('安排宾客后可用')
    await button.trigger('click')
    await flushPromises()
    expect(localStorage.getItem(SEATING_HANDOFF_KEY)).toBeNull()
    expect(router.currentRoute.value.fullPath).toBe('/banquet')
    wrapper.unmount()
  })
})

describe('/studio?from=banquet 消费载荷', () => {
  it('默认考场模板对不上桌号 → 自动切到婚礼席位卡，姓名/桌号已映射，载荷读后即删', async () => {
    const handoff: SeatingHandoff = {
      title: '张王婚宴',
      source: 'banquet',
      rows: buildBanquetHandoffRows(guests, tables, groups),
    }
    localStorage.setItem(SEATING_HANDOFF_KEY, JSON.stringify(handoff))
    const router = await makeRouter('/studio?from=banquet')
    const wrapper = mount(StudioView, { global: { plugins: [router], stubs: STUDIO_STUBS } })
    await flushPromises()

    const workspace = useWorkspaceStore()
    const toast = useToastStore()
    expect(workspace.template.id).toBe('weddingPlace')
    expect(workspace.excel.rows).toHaveLength(4)
    expect(workspace.excel.fileName).toBe('张王婚宴.名单')
    expect(workspace.mapping.name).toBe('姓名')
    expect(workspace.mapping.tableNo).toBe('桌号')
    expect(workspace.unmappedFields).toHaveLength(0)
    expect(toast.toasts.some((t) => t.title === '已切换到婚礼席位卡模板')).toBe(true)
    expect(toast.toasts.some((t) => t.title === '排桌名单已带入')).toBe(true)
    expect(localStorage.getItem(SEATING_HANDOFF_KEY)).toBeNull()
    wrapper.unmount()
  })

  it('没有载荷时 from=banquet 不做任何事', async () => {
    const router = await makeRouter('/studio?from=banquet')
    const wrapper = mount(StudioView, { global: { plugins: [router], stubs: STUDIO_STUBS } })
    await flushPromises()
    const workspace = useWorkspaceStore()
    const toast = useToastStore()
    expect(workspace.excel.rows).toHaveLength(0)
    expect(toast.toasts.some((t) => t.title === '排桌名单已带入')).toBe(false)
    wrapper.unmount()
  })
})
