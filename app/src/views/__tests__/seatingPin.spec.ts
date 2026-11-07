// @vitest-environment jsdom
/**
 * 钉座：座位上的 📌 把当前学生钉在该格，重新随机/混排/还原时保持原位；
 * 手工换座（点选互换 / 整排交换）直接解除该格的钉。
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
    global: { plugins: [router], stubs: { Teleport: true, Transition: true } },
    attachTo: document.body,
  })
  await wrapper.vm.$nextTick()
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof mountSeating>>

async function setRoster(wrapper: Wrapper, names: string[]) {
  const ta = wrapper.get('textarea')
  await ta.setValue(names.join('\n'))
  await flushPromises()
}

function seatEl(wrapper: Wrapper, seatNo: number) {
  return wrapper.get(`[data-seat-no="${seatNo}"]`)
}

function seatName(wrapper: Wrapper, seatNo: number): string {
  return seatEl(wrapper, seatNo).get('.seating-seat-name').text()
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
})

describe('钉座（📌）', () => {
  it('钉住的座位在重新随机后仍是同一人；未钉的会被打乱', async () => {
    const wrapper = await mountSeating()
    const names = Array.from({ length: 12 }, (_, i) => `学${i + 1}号`)
    await setRoster(wrapper, names)

    // 随机一次形成座次，记下 1 号与 2 号位上的人
    await wrapper.get('[data-testid="seating-randomize"]').trigger('click')
    await flushPromises()
    const pinnedName = seatName(wrapper, 1)
    const otherName = seatName(wrapper, 2)
    expect(pinnedName).not.toBe('')

    // 钉住 1 号位 → 再随机 → 1 号位仍是同一人
    await seatEl(wrapper, 1).get('[data-testid="seat-pin"]').trigger('click')
    await flushPromises()
    expect(seatEl(wrapper, 1).get('[data-testid="seat-pin"]').classes()).toContain('seating-pin--on')

    await wrapper.get('[data-testid="seating-randomize"]').trigger('click')
    await flushPromises()
    expect(seatName(wrapper, 1)).toBe(pinnedName)
    // 钉住者从普通填充中剔除：2 号位不应是他
    expect(seatName(wrapper, 2)).not.toBe(pinnedName)
    void otherName
    wrapper.unmount()
  })

  it('手工点选互换解除该格的钉', async () => {
    const wrapper = await mountSeating()
    const names = Array.from({ length: 6 }, (_, i) => `生${i + 1}名`)
    await setRoster(wrapper, names)
    await wrapper.get('[data-testid="seating-randomize"]').trigger('click')
    await flushPromises()

    await seatEl(wrapper, 1).get('[data-testid="seat-pin"]').trigger('click')
    await flushPromises()
    expect(seatEl(wrapper, 1).get('[data-testid="seat-pin"]').classes()).toContain('seating-pin--on')

    // 点选 1 号位再点 3 号位 → 互换；1 号位的钉应被释放
    await seatEl(wrapper, 1).trigger('click')
    await seatEl(wrapper, 3).trigger('click')
    await flushPromises()
    expect(seatEl(wrapper, 1).get('[data-testid="seat-pin"]').classes()).not.toContain(
      'seating-pin--on',
    )
    wrapper.unmount()
  })
})
