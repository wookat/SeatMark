// @vitest-environment jsdom
/**
 * 第 373 轮：/seating 男女混排后，同性相邻座位在预览层加虚线复核标记；
 * 点选互换 / 还原名单顺序后随数据重算；导出宿主（打印 / PNG 同一节点）不带该标记。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setLocale } from '@/i18n'
import SeatingView from '@/views/SeatingView.vue'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

async function mountSeating() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/seating', component: SeatingView },
      { path: '/studio', component: { template: '<div />' } },
    ],
  })
  await router.push('/seating')
  await router.isReady()
  const wrapper = mount(SeatingView, {
    global: { plugins: [router], stubs: { Transition: true } },
    attachTo: document.body,
  })
  await wrapper.vm.$nextTick()
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof mountSeating>>

async function setGrid(wrapper: Wrapper, rows: number, cols: number) {
  const inputs = wrapper.findAll('input[type="number"]')
  await inputs[0]!.setValue(String(rows))
  await inputs[1]!.setValue(String(cols))
  await flushPromises()
}

/** 男 26 / 女 22，共 48 人 */
const ROSTER = [
  ...Array.from({ length: 26 }, (_, i) => `男生${i + 1}\t男`),
  ...Array.from({ length: 22 }, (_, i) => `女生${i + 1}\t女`),
].join('\n')

function previewSeats(wrapper: Wrapper) {
  return wrapper.findAll('[data-testid="seating-preview-column"] .seating-seat')
}
function markedSeatNos(wrapper: Wrapper): number[] {
  return previewSeats(wrapper)
    .filter((s) => s.attributes('data-gender-review') === 'true')
    .map((s) => Number(s.attributes('data-seat-no')))
}
function seatByNo(wrapper: Wrapper, no: number) {
  return previewSeats(wrapper).find((s) => s.attributes('data-seat-no') === String(no))!
}

beforeEach(async () => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  Element.prototype.scrollIntoView = vi.fn()
  localStorage.clear()
  setActivePinia(createPinia())
  await setLocale('zh')
})

afterEach(async () => {
  document.body.innerHTML = ''
  await setLocale('zh')
})

describe('第 373 轮：男女混排同性相邻复核标记', () => {
  it('hint 文案改为「尽量交替；…已用虚线框标出便于人工微调」', async () => {
    const wrapper = await mountSeating()
    expect(wrapper.text()).toContain('尽量交替；人数不等或有过道时尾部会有同性相邻，已用虚线框标出便于人工微调')
    expect(wrapper.text()).not.toContain('人数不均、座位数不整齐或有过道时')
  })

  it('混排前无标记、无图例；混排后末尾 4 座（45–48）带 ring-1 ring-dashed ring-amber-400 与 title，图例出现', async () => {
    const wrapper = await mountSeating()
    await setGrid(wrapper, 6, 8)
    await wrapper.get('textarea').setValue(ROSTER)
    await flushPromises()
    expect(markedSeatNos(wrapper)).toEqual([])
    expect(wrapper.find('[data-testid="seating-gender-legend"]').exists()).toBe(false)

    await wrapper.get('[data-testid="seating-randomize-mixed"]').trigger('click')
    await flushPromises()

    expect(markedSeatNos(wrapper)).toEqual([45, 46, 47, 48])
    const seat = seatByNo(wrapper, 46)
    expect(seat.classes()).toEqual(expect.arrayContaining(['ring-1', 'ring-dashed', 'ring-amber-400', 'seating-seat--gender-review']))
    expect(seat.attributes('title')).toBe('同性相邻，建议人工复核')
    expect(seatByNo(wrapper, 1).attributes('title')).toBeUndefined()
    expect(seatByNo(wrapper, 1).classes()).not.toContain('ring-amber-400')

    const legend = wrapper.get('[data-testid="seating-gender-legend"]')
    expect(legend.text()).toContain('虚线框：同性相邻的 4 个座位，建议人工复核')
    expect(legend.text()).toContain('导出与打印不带此标记')
  })

  it('点选互换后标记即时重算；还原名单顺序后标记与图例清除', async () => {
    const wrapper = await mountSeating()
    await setGrid(wrapper, 6, 8)
    await wrapper.get('textarea').setValue(ROSTER)
    await flushPromises()
    await wrapper.get('[data-testid="seating-randomize-mixed"]').trigger('click')
    await flushPromises()
    expect(markedSeatNos(wrapper)).toEqual([45, 46, 47, 48])

    // 座位 2（女）与座位 48（男）互换 → 前排 1-3 同性、末尾 45-47 同性
    await seatByNo(wrapper, 2).trigger('click')
    await seatByNo(wrapper, 48).trigger('click')
    await flushPromises()
    expect(markedSeatNos(wrapper)).toEqual([1, 2, 3, 45, 46, 47])
    expect(wrapper.get('[data-testid="seating-gender-legend"]').text()).toContain('6 个座位')

    await wrapper.findAll('button').filter((b) => b.text().includes('还原名单顺序'))[0]!.trigger('click')
    await flushPromises()
    expect(markedSeatNos(wrapper)).toEqual([])
    expect(wrapper.find('[data-testid="seating-gender-legend"]').exists()).toBe(false)
  })

  it('完全随机后不再显示混排标记（即便碰巧同性相邻）', async () => {
    const wrapper = await mountSeating()
    await setGrid(wrapper, 6, 8)
    await wrapper.get('textarea').setValue(ROSTER)
    await flushPromises()
    await wrapper.get('[data-testid="seating-randomize-mixed"]').trigger('click')
    await flushPromises()
    expect(markedSeatNos(wrapper)).toHaveLength(4)
    await wrapper.get('[data-testid="seating-randomize"]').trigger('click')
    await flushPromises()
    expect(markedSeatNos(wrapper)).toEqual([])
    expect(wrapper.find('[data-testid="seating-gender-legend"]').exists()).toBe(false)
  })

  it('导出 / 打印宿主（teleport 到 body）不含虚线标记 class 与 title', async () => {
    const wrapper = await mountSeating()
    await setGrid(wrapper, 6, 8)
    await wrapper.get('textarea').setValue(ROSTER)
    await flushPromises()
    await wrapper.get('[data-testid="seating-randomize-mixed"]').trigger('click')
    await flushPromises()
    expect(markedSeatNos(wrapper)).toHaveLength(4)

    // 打印会渲染导出宿主；window.print 在 jsdom 中打桩
    vi.stubGlobal('print', vi.fn())
    await wrapper.findAll('button').filter((b) => b.text().includes('打印座位表'))[0]!.trigger('click')
    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))

    const host = document.body.querySelector('[data-testid="seating-export-sheet"]')
    expect(host).not.toBeNull()
    const exportSeats = host!.querySelectorAll('.seating-seat')
    expect(exportSeats.length).toBeGreaterThanOrEqual(48)
    expect(host!.querySelectorAll('.seating-seat--gender-review, .ring-amber-400, [data-gender-review]')).toHaveLength(0)
    expect(host!.querySelectorAll('[title*="同性相邻"]')).toHaveLength(0)
    expect(host!.querySelector('[data-testid="seating-gender-legend"]')).toBeNull()
  })

  it('混排状态持久化：刷新后标记仍在（genderMixed 落盘）', async () => {
    const wrapper = await mountSeating()
    await setGrid(wrapper, 6, 8)
    await wrapper.get('textarea').setValue(ROSTER)
    await flushPromises()
    await wrapper.get('[data-testid="seating-randomize-mixed"]').trigger('click')
    await flushPromises()
    expect(markedSeatNos(wrapper)).toHaveLength(4)
    wrapper.unmount()

    const again = await mountSeating()
    await flushPromises()
    expect(markedSeatNos(again)).toEqual([45, 46, 47, 48])
  })
})
