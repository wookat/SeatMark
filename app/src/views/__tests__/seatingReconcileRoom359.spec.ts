// @vitest-environment jsdom
/**
 * 第 359 轮 P1/P2：/seating 名单修改后不再静默清空手工排座（对齐 + toast 明示）；
 * 名单含「考场」列时出现考场筛选下拉、按考场筛选座位并影响导出文件名。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useToastStore } from '@/stores/toast'
import SeatingView from '@/views/SeatingView.vue'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const STATE_KEY = 'seatmark.seating-state.v1'

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

/** 每个座位的姓名（空座为 —），按座位号顺序 */
function seatNames(wrapper: Wrapper): string[] {
  return wrapper.findAll('[data-seat-no]').map((c) => c.get('.seating-seat-name').text().trim())
}

function filledNames(wrapper: Wrapper): string[] {
  return seatNames(wrapper).filter((n) => n && n !== '—')
}

function persistedArranged(): Array<{ name: string }> | null {
  const raw = localStorage.getItem(STATE_KEY)
  return raw ? (JSON.parse(raw) as { arranged: Array<{ name: string }> | null }).arranged : null
}

const NAMES = ['张伟', '王芳', '李娜', '赵六', '周七', '吴八']

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  Element.prototype.scrollIntoView = vi.fn()
  localStorage.clear()
  setActivePinia(createPinia())
  vi.restoreAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('第 359 轮 P1：名单修改保留手工座位', () => {
  it('随机后追加 1 人：原座位不变、新人在末尾、toast 明示且 arranged 不为 null', async () => {
    const wrapper = await mountSeating()
    const toast = useToastStore()
    await wrapper.get('textarea').setValue(NAMES.join('\n'))
    await flushPromises()
    const buttons = wrapper.findAll('button').filter((b) => b.text().includes('完全随机'))
    await buttons[0]!.trigger('click')
    await flushPromises()
    const before = filledNames(wrapper)
    expect(before).toHaveLength(6)
    expect(persistedArranged()).not.toBeNull()

    await wrapper.get('textarea').setValue([...NAMES, '郑九'].join('\n'))
    await flushPromises()
    vi.advanceTimersByTime(700)
    await flushPromises()

    const after = filledNames(wrapper)
    expect(after.slice(0, 6)).toEqual(before)
    expect(after[6]).toBe('郑九')
    expect(persistedArranged()?.map((e) => e.name)).toEqual([...before, '郑九'])
    const info = toast.toasts.find((t) => t.title.includes('已保留 6 人的手工座位'))
    expect(info?.type).toBe('info')
    expect(info?.text).toContain('新增 1 人')
    wrapper.unmount()
  })

  it('删除中间 1 人：其余座位号不变、原位留空、toast 报移除人数', async () => {
    const wrapper = await mountSeating()
    const toast = useToastStore()
    await wrapper.get('textarea').setValue(NAMES.join('\n'))
    await flushPromises()
    await wrapper.findAll('button').filter((b) => b.text().includes('完全随机'))[0]!.trigger('click')
    await flushPromises()
    const before = seatNames(wrapper)

    await wrapper.get('textarea').setValue(NAMES.filter((n) => n !== '李娜').join('\n'))
    await flushPromises()
    vi.advanceTimersByTime(700)
    await flushPromises()

    const after = seatNames(wrapper)
    const removedAt = before.indexOf('李娜')
    expect(after[removedAt]).toBe('—')
    before.forEach((name, i) => {
      if (i !== removedAt && name !== '—') expect(after[i]).toBe(name)
    })
    expect(toast.toasts.some((t) => t.title.includes('已保留 5 人的手工座位') && t.text?.includes('移除 1 人'))).toBe(
      true,
    )
    wrapper.unmount()
  })

  it('整份替换：还原为名单顺序并 toast「已整体更换」；切换保留同名同样 toast', async () => {
    const wrapper = await mountSeating()
    const toast = useToastStore()
    await wrapper.get('textarea').setValue(NAMES.join('\n'))
    await flushPromises()
    await wrapper.findAll('button').filter((b) => b.text().includes('完全随机'))[0]!.trigger('click')
    await flushPromises()

    await wrapper.get('textarea').setValue(['甲', '乙', '丙', '乙'].join('\n'))
    await flushPromises()
    expect(filledNames(wrapper)).toEqual(['甲', '乙', '丙'])
    expect(persistedArranged()).toBeNull()
    expect(toast.toasts.some((t) => t.title === '名单已整体更换，座位已按名单顺序重排')).toBe(true)

    await wrapper.findAll('button').filter((b) => b.text().includes('完全随机'))[0]!.trigger('click')
    await flushPromises()
    expect(persistedArranged()).not.toBeNull()
    await wrapper.get('[data-testid="roster-keep-duplicates"] input').setValue(true)
    await flushPromises()
    expect(persistedArranged()).toBeNull()
    expect(toast.toasts.some((t) => t.title === '重名处理已切换，座位已按名单顺序重排')).toBe(true)
    wrapper.unmount()
  })
})

const ROOM_ROSTER = [
  '姓名\t考场\t性别',
  '张伟\t01\t男',
  '王芳\t01\t女',
  '李娜\t01\t女',
  '赵六\t02\t男',
  '周七\t02\t男',
].join('\n')

describe('第 359 轮 P2：名单含「考场」列', () => {
  it('纯姓名名单不出现考场下拉；含两个考场时出现且人数正确', async () => {
    const wrapper = await mountSeating()
    await wrapper.get('textarea').setValue(NAMES.join('\n'))
    await flushPromises()
    expect(wrapper.find('[data-testid="seating-room-filter"]').exists()).toBe(false)

    await wrapper.get('textarea').setValue(ROOM_ROSTER)
    await flushPromises()
    const filter = wrapper.get('[data-testid="seating-room-filter"]')
    expect(filter.get('button').text()).toContain('全部 5')
    await filter.get('button').trigger('click')
    const options = filter.findAll('[role="option"]').map((o) => o.findAll('span').map((s) => s.text()))
    expect(options).toEqual([['全部 5 人'], ['考场 01', '3 人'], ['考场 02', '2 人']])
    wrapper.unmount()
  })

  it('单一考场不出现下拉', async () => {
    const wrapper = await mountSeating()
    await wrapper.get('textarea').setValue('姓名\t考场\n张伟\t01\n王芳\t01')
    await flushPromises()
    expect(wrapper.find('[data-testid="seating-room-filter"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('选中考场后只排该考场、考场号自动带入、切换时清空手工座位并 toast、筛选值持久化', async () => {
    const wrapper = await mountSeating()
    const toast = useToastStore()
    await wrapper.get('textarea').setValue(ROOM_ROSTER)
    await flushPromises()
    await wrapper.findAll('button').filter((b) => b.text().includes('完全随机'))[0]!.trigger('click')
    await flushPromises()
    expect(persistedArranged()).not.toBeNull()

    const pickRoom = async (label: string) => {
      const filter = wrapper.get('[data-testid="seating-room-filter"]')
      await filter.get('button').trigger('click')
      await filter.findAll('[role="option"]').find((o) => o.text().includes(label))!.trigger('click')
      await flushPromises()
    }
    await pickRoom('考场 02')
    expect(filledNames(wrapper).sort()).toEqual(['周七', '赵六'])
    expect((wrapper.get('[data-testid="seating-room-no"]').element as HTMLInputElement).value).toBe('02')
    expect(persistedArranged()).toBeNull()
    expect(toast.toasts.some((t) => t.title === '已切换考场，座位已按名单顺序重排')).toBe(true)
    expect((JSON.parse(localStorage.getItem(STATE_KEY)!) as { roomFilter: string }).roomFilter).toBe('02')

    // 用户手填的考场号不被覆盖
    await wrapper.get('[data-testid="seating-room-no"]').setValue('自定义')
    await pickRoom('考场 01')
    expect((wrapper.get('[data-testid="seating-room-no"]').element as HTMLInputElement).value).toBe('自定义')
    expect(filledNames(wrapper)).toEqual(['张伟', '王芳', '李娜'])
    wrapper.unmount()
  })
})
