// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setLocale } from '@/i18n'
import { useToastStore } from '@/stores/toast'
import { BANQUET_STATE_KEY, type AvoidPair, type BanquetTable } from '@/utils/banquet'
import BanquetView from '@/views/BanquetView.vue'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function table(id: string, name: string, seats: number, guestIds: string[]): BanquetTable {
  return { id, name, shape: 'round', x: 0, y: 0, width: 80, height: 80, seats, guestIds }
}

/** 2 桌各 2 座，4 位散客：甲、乙在 1 号桌，丙、丁在 2 号桌 */
function seedState(avoidPairs?: AvoidPair[]) {
  const guests = [
    { id: 'a', name: '甲', groupId: null },
    { id: 'b', name: '乙', groupId: null },
    { id: 'c', name: '丙', groupId: null },
    { id: 'd', name: '丁', groupId: null },
  ]
  const tables = [table('t1', '1号桌', 2, ['a', 'b']), table('t2', '2号桌', 2, ['c', 'd'])]
  localStorage.setItem(
    BANQUET_STATE_KEY,
    JSON.stringify({
      title: '测试',
      pasteText: '',
      guests,
      groups: [],
      tables,
      markers: [],
      paper: 'a4',
      orientation: 'landscape',
      exportColors: false,
      ...(avoidPairs ? { avoidPairs } : {}),
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
    avoidPairs?: AvoidPair[]
    tables: { id: string; guestIds: string[] }[]
  }
}

async function chooseOption(wrapper: Awaited<ReturnType<typeof mountView>>, testId: string, label: string) {
  const select = wrapper.find(`[data-testid="${testId}"]`)
  await select.find('button').trigger('click')
  const opt = select.findAll('[role="option"]').find((o) => o.text().includes(label))
  expect(opt, `${testId} 应有选项 ${label}`).toBeTruthy()
  await opt!.trigger('click')
}

beforeEach(async () => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  Element.prototype.scrollIntoView = vi.fn()
  localStorage.clear()
  setActivePinia(createPinia())
  await setLocale('zh')
})

afterEach(async () => {
  await setLocale('zh')
  document.body.innerHTML = ''
})

describe('第 359 轮 P3：BanquetView 「不同桌」排斥清单', () => {
  it('折叠区可添加/删除排斥对，仅持久化到 localStorage，不触发网络请求', async () => {
    seedState()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="avoid-section"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="avoid-panel"]').exists()).toBe(false)
    await wrapper.find('[data-testid="avoid-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="avoid-panel"]').exists()).toBe(true)

    await chooseOption(wrapper, 'avoid-select-a', '甲')
    await chooseOption(wrapper, 'avoid-select-b', '丙')
    await wrapper.find('[data-testid="avoid-add"]').trigger('click')

    const items = wrapper.findAll('[data-testid="avoid-item"]')
    expect(items).toHaveLength(1)
    expect(items[0]!.text()).toContain('甲')
    expect(items[0]!.text()).toContain('丙')
    expect(wrapper.find('[data-testid="avoid-count"]').text()).toBe('1')
    // 甲在 1 号桌、丙在 2 号桌 → 无冲突
    expect(wrapper.find('[data-testid="avoid-conflict-count"]').exists()).toBe(false)
    await new Promise((r) => setTimeout(r, 0))
    expect(persisted().avoidPairs).toEqual([['a', 'c']])

    // 重复添加（反向）被忽略
    await chooseOption(wrapper, 'avoid-select-a', '丙')
    await chooseOption(wrapper, 'avoid-select-b', '甲')
    await wrapper.find('[data-testid="avoid-add"]').trigger('click')
    expect(wrapper.findAll('[data-testid="avoid-item"]')).toHaveLength(1)

    await wrapper.find('[data-testid="avoid-remove"]').trigger('click')
    expect(wrapper.findAll('[data-testid="avoid-item"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="avoid-count"]').exists()).toBe(false)
    await new Promise((r) => setTimeout(r, 0))
    expect(persisted().avoidPairs).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('持久化的排斥对同桌时显示冲突计数与摘要；拖到对方桌 toast 警告但不阻止', async () => {
    seedState([['a', 'c']])
    const wrapper = await mountView()
    const toast = useToastStore()

    // 默认展开（已有清单），甲/丙不同桌 → 无冲突
    expect(wrapper.find('[data-testid="avoid-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="avoid-conflict-count"]').exists()).toBe(false)

    // 把丙拖到 1 号桌（甲所在桌）：Pointer 拖拽，elementFromPoint 指向 1 号桌
    const t1 = document.querySelector<HTMLElement>('[data-table-id="t1"]')
    expect(t1).toBeTruthy()
    document.elementFromPoint = vi.fn(() => t1)
    const chips = wrapper.findAll('[data-table-id="t2"] .banquet-guest')
    const chip = chips.find((c) => c.text().includes('丙'))
    expect(chip).toBeTruthy()
    const down = new MouseEvent('pointerdown', { button: 0, clientX: 0, clientY: 0, bubbles: true, cancelable: true })
    Object.defineProperty(down, 'pointerType', { value: 'mouse' })
    chip!.element.dispatchEvent(down)
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 50, clientY: 50 }))
    window.dispatchEvent(new MouseEvent('pointerup'))
    await wrapper.vm.$nextTick()

    expect(persisted().tables.find((t) => t.id === 't1')?.guestIds).toEqual(['a', 'b', 'c'])
    const warn = toast.toasts.find((i) => i.type === 'warning' && i.title.includes('不同桌'))
    expect(warn, '应有「不同桌」警告 toast').toBeTruthy()
    expect(warn!.title).toContain('丙')
    expect(warn!.title).toContain('甲')
    expect(wrapper.find('[data-testid="avoid-conflict-count"]').text()).toBe('排斥冲突 1 对')
    const item = wrapper.find('[data-testid="avoid-item"]')
    expect(item.text()).toContain('同桌中')
    wrapper.unmount()
  })

  it('/en 下折叠区文案为英文', async () => {
    await setLocale('en')
    seedState([['a', 'c']])
    const wrapper = await mountView()
    const toggle = wrapper.find('[data-testid="avoid-toggle"]')
    expect(toggle.text()).toContain('Keep apart')
    expect(toggle.text()).not.toMatch(/[\u4e00-\u9fff]/)
    expect(wrapper.find('[data-testid="avoid-add"]').text()).toBe('Add')
    expect(wrapper.find('[data-testid="avoid-remove"]').text()).toBe('Delete')
    wrapper.unmount()
  })
})
