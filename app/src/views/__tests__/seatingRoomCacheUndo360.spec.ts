// @vitest-environment jsdom
/**
 * 第 360 轮：/seating 按考场缓存手工排座（切场往返不丢）+ 破坏性操作 10 秒撤销 + roomOptions 不重复前缀。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setLocale } from '@/i18n'
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

function seatNames(wrapper: Wrapper): string[] {
  return wrapper.findAll('[data-seat-no]').map((c) => c.get('.seating-seat-name').text().trim())
}

function filledNames(wrapper: Wrapper): string[] {
  return seatNames(wrapper).filter((n) => n && n !== '—')
}

interface Persisted {
  arranged: Array<{ name: string }> | null
  arrangedByRoom?: Record<string, Array<{ name: string }>>
  duplicatePolicy?: string
}

function persisted(): Persisted {
  return JSON.parse(localStorage.getItem(STATE_KEY)!) as Persisted
}

async function pickRoom(wrapper: Wrapper, label: string) {
  const filter = wrapper.get('[data-testid="seating-room-filter"]')
  await filter.get('button').trigger('click')
  await filter.findAll('[role="option"]').find((o) => o.text().includes(label))!.trigger('click')
  await flushPromises()
}

async function swapFirstTwo(wrapper: Wrapper) {
  const seats = wrapper.findAll('[data-seat-no]')
  await seats[0]!.trigger('click')
  await seats[1]!.trigger('click')
  await flushPromises()
}

async function clickButton(wrapper: Wrapper, text: string) {
  await wrapper.findAll('button').filter((b) => b.text().includes(text))[0]!.trigger('click')
  await flushPromises()
}

const ROOM_ROSTER = [
  '姓名\t考场',
  '张伟\t01',
  '王芳\t01',
  '李娜\t01',
  '赵六\t02',
  '周七\t02',
  '吴八\t02',
].join('\n')

beforeEach(async () => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  Element.prototype.scrollIntoView = vi.fn()
  localStorage.clear()
  setActivePinia(createPinia())
  vi.restoreAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  await setLocale('zh')
})

afterEach(async () => {
  vi.useRealTimers()
  await setLocale('zh')
})

/** 手工换座后 arranged 会补齐到座位数，只看有名字的座位 */
function cachedNames(room: string): string[] | undefined {
  return persisted().arrangedByRoom?.[room]?.map((e) => e.name).filter(Boolean)
}

describe('第 360 轮 P2：考场切换缓存各场手工排座', () => {
  it('01 手工换座 → 切 02 并排座 → 切回 01 仍是手工座次、02 亦保留；持久化含 arrangedByRoom', async () => {
    const wrapper = await mountSeating()
    const toast = useToastStore()
    await wrapper.get('textarea').setValue(ROOM_ROSTER)
    await flushPromises()

    await pickRoom(wrapper, '考场 01')
    expect(filledNames(wrapper)).toEqual(['张伟', '王芳', '李娜'])
    await swapFirstTwo(wrapper)
    expect(filledNames(wrapper)).toEqual(['王芳', '张伟', '李娜'])

    await pickRoom(wrapper, '考场 02')
    // 02 无缓存：按名单顺序并保留既有 toast 文案
    expect(filledNames(wrapper)).toEqual(['赵六', '周七', '吴八'])
    expect(toast.toasts.some((t) => t.title === '已切换考场，座位已按名单顺序重排')).toBe(true)
    expect(persisted().arranged).toBeNull()
    expect(cachedNames('01')).toEqual(['王芳', '张伟', '李娜'])
    await swapFirstTwo(wrapper)
    expect(filledNames(wrapper)).toEqual(['周七', '赵六', '吴八'])

    await pickRoom(wrapper, '考场 01')
    expect(filledNames(wrapper)).toEqual(['王芳', '张伟', '李娜'])
    expect(toast.toasts.some((t) => t.title === '已切换到 考场 01，已恢复该场上次排座')).toBe(true)
    expect(cachedNames('02')).toEqual(['周七', '赵六', '吴八'])
    expect(persisted().arrangedByRoom?.['01']).toBeUndefined()

    await pickRoom(wrapper, '考场 02')
    expect(filledNames(wrapper)).toEqual(['周七', '赵六', '吴八'])
    wrapper.unmount()
  })

  it('刷新（重新 mount 读 localStorage）后两场均恢复', async () => {
    const wrapper = await mountSeating()
    await wrapper.get('textarea').setValue(ROOM_ROSTER)
    await flushPromises()
    await pickRoom(wrapper, '考场 01')
    await swapFirstTwo(wrapper)
    await pickRoom(wrapper, '考场 02')
    await swapFirstTwo(wrapper)
    wrapper.unmount()

    const again = await mountSeating()
    await flushPromises()
    expect(filledNames(again)).toEqual(['周七', '赵六', '吴八'])
    await pickRoom(again, '考场 01')
    expect(filledNames(again)).toEqual(['王芳', '张伟', '李娜'])
    again.unmount()
  })

  it('旧版 localStorage 无 arrangedByRoom 字段时兼容加载', async () => {
    localStorage.setItem(
      STATE_KEY,
      JSON.stringify({
        title: 'T',
        rows: 6,
        cols: 8,
        podium: 'top',
        fillOrder: 'rows',
        aisles: [],
        namesText: ROOM_ROSTER,
        arranged: null,
        roomFilter: '02',
      }),
    )
    const wrapper = await mountSeating()
    await flushPromises()
    expect(filledNames(wrapper)).toEqual(['赵六', '周七', '吴八'])
    await pickRoom(wrapper, '考场 01')
    expect(filledNames(wrapper)).toEqual(['张伟', '王芳', '李娜'])
    wrapper.unmount()
  })

  it('名单删除 01 场某人后切回 01：其余人座次保留、原位留空；某场无人保留则缓存删除', async () => {
    const wrapper = await mountSeating()
    await wrapper.get('textarea').setValue(ROOM_ROSTER)
    await flushPromises()
    await pickRoom(wrapper, '考场 01')
    await swapFirstTwo(wrapper) // 王芳 张伟 李娜
    await pickRoom(wrapper, '考场 02')

    await wrapper.get('textarea').setValue(ROOM_ROSTER.replace('张伟\t01\n', ''))
    await flushPromises()
    vi.advanceTimersByTime(700)
    await flushPromises()
    expect(persisted().arrangedByRoom?.['01']?.slice(0, 3).map((e) => e.name)).toEqual(['王芳', '', '李娜'])

    await pickRoom(wrapper, '考场 01')
    expect(seatNames(wrapper).slice(0, 3)).toEqual(['王芳', '—', '李娜'])

    // 02 场整体换人：该场缓存 kept=0 → 删除
    await pickRoom(wrapper, '考场 02')
    await swapFirstTwo(wrapper)
    await pickRoom(wrapper, '考场 01')
    expect(persisted().arrangedByRoom?.['02']).toBeDefined()
    await wrapper.get('textarea').setValue(
      ['姓名\t考场', '王芳\t01', '李娜\t01', '甲\t02', '乙\t02'].join('\n'),
    )
    await flushPromises()
    vi.advanceTimersByTime(700)
    await flushPromises()
    expect(persisted().arrangedByRoom?.['02']).toBeUndefined()
    wrapper.unmount()
  })

  it('「还原名单顺序」只清当前场；其它场缓存保留', async () => {
    const wrapper = await mountSeating()
    await wrapper.get('textarea').setValue(ROOM_ROSTER)
    await flushPromises()
    await pickRoom(wrapper, '考场 01')
    await swapFirstTwo(wrapper)
    await pickRoom(wrapper, '考场 02')
    await swapFirstTwo(wrapper)
    await clickButton(wrapper, '还原名单顺序')
    expect(filledNames(wrapper)).toEqual(['赵六', '周七', '吴八'])
    expect(persisted().arranged).toBeNull()
    expect(cachedNames('01')).toEqual(['王芳', '张伟', '李娜'])
    wrapper.unmount()
  })

  it('roomOptions：原始单元格已带「考场」时不重复前缀（zh / en）', async () => {
    const wrapper = await mountSeating()
    await wrapper.get('textarea').setValue('姓名\t考场\n张伟\t考场01\n王芳\t考场02')
    await flushPromises()
    const filter = wrapper.get('[data-testid="seating-room-filter"]')
    await filter.get('button').trigger('click')
    let labels = filter.findAll('[role="option"]').map((o) => o.findAll('span')[0]!.text())
    expect(labels).toEqual(['全部 2 人', '考场01', '考场02'])
    expect(labels.some((l) => /考场 考场/.test(l))).toBe(false)
    await filter.get('button').trigger('click')

    await setLocale('en')
    await flushPromises()
    await wrapper.get('textarea').setValue('Name\tRoom\nAmy\tRoom 1\nBob\tRoom 2')
    await flushPromises()
    await filter.get('button').trigger('click')
    labels = filter.findAll('[role="option"]').map((o) => o.findAll('span')[0]!.text())
    expect(labels.slice(1)).toEqual(['Room 1', 'Room 2'])
    expect(labels.some((l) => /Exam room Room/.test(l))).toBe(false)
    wrapper.unmount()
  })
})

const NAMES = ['张伟', '王芳', '李娜', '赵六', '周七', '吴八']

describe('第 360 轮 P3：破坏性操作 10 秒撤销', () => {
  it('还原名单顺序后 10 秒内点撤销：恢复手工座次与选中座位；toast 走 ToastAction', async () => {
    const wrapper = await mountSeating()
    const toast = useToastStore()
    await wrapper.get('textarea').setValue(NAMES.join('\n'))
    await flushPromises()
    await swapFirstTwo(wrapper) // 王芳 张伟 …
    const manual = filledNames(wrapper)
    expect(manual.slice(0, 2)).toEqual(['王芳', '张伟'])
    // 选中一个座位
    await wrapper.findAll('[data-seat-no]')[2]!.trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.seating-seat--selected')).toHaveLength(1)

    await clickButton(wrapper, '还原名单顺序')
    expect(filledNames(wrapper)).toEqual(NAMES)
    expect(wrapper.findAll('.seating-seat--selected')).toHaveLength(0)
    const undoToast = toast.toasts.find((t) => t.title === '已还原为名单原始顺序')
    expect(undoToast?.action?.label).toBe('撤销')
    expect(undoToast?.text).toContain('10 秒内可撤销')

    vi.advanceTimersByTime(5_000)
    toast.runAction(undoToast!.id)
    await flushPromises()
    expect(filledNames(wrapper)).toEqual(manual)
    expect(wrapper.findAll('.seating-seat--selected')).toHaveLength(1)
    expect(wrapper.get('.seating-seat--selected').attributes('data-seat-no')).toBe('3')
    expect(toast.toasts.find((t) => t.id === undoToast!.id)).toBeUndefined()
    wrapper.unmount()
  })

  it('切换重名开关后撤销：恢复开关值与座次，且不弹第二次「已切换」toast', async () => {
    const wrapper = await mountSeating()
    const toast = useToastStore()
    await wrapper.get('textarea').setValue([...NAMES, '张伟'].join('\n'))
    await flushPromises()
    await swapFirstTwo(wrapper)
    const manual = filledNames(wrapper)
    expect(manual.slice(0, 2)).toEqual(['王芳', '张伟'])

    const toggle = wrapper.get('[data-testid="roster-keep-duplicates"] input')
    await toggle.setValue(true)
    await flushPromises()
    expect((toggle.element as HTMLInputElement).checked).toBe(true)
    expect(filledNames(wrapper)).toContain('张伟①')
    const switched = toast.toasts.filter((t) => t.title === '重名处理已切换，座位已按名单顺序重排')
    expect(switched).toHaveLength(1)
    expect(switched[0]!.action?.label).toBe('撤销')
    expect(persisted().duplicatePolicy).toBe('suffix')

    toast.runAction(switched[0]!.id)
    await flushPromises()
    expect((toggle.element as HTMLInputElement).checked).toBe(false)
    expect(filledNames(wrapper)).toEqual(manual)
    expect(persisted().duplicatePolicy).toBe('merge')
    expect(toast.toasts.filter((t) => t.title === '重名处理已切换，座位已按名单顺序重排')).toHaveLength(0)
    wrapper.unmount()
  })

  it('超时后 toast 消失不可撤销', async () => {
    const wrapper = await mountSeating()
    const toast = useToastStore()
    await wrapper.get('textarea').setValue(NAMES.join('\n'))
    await flushPromises()
    await swapFirstTwo(wrapper)
    await clickButton(wrapper, '还原名单顺序')
    const undoToast = toast.toasts.find((t) => t.title === '已还原为名单原始顺序')
    expect(undoToast).toBeDefined()
    vi.advanceTimersByTime(10_001)
    await flushPromises()
    expect(toast.toasts.find((t) => t.id === undoToast!.id)).toBeUndefined()
    expect(filledNames(wrapper)).toEqual(NAMES)
    wrapper.unmount()
  })

  it('en：撤销文案走词典', async () => {
    await setLocale('en')
    const wrapper = await mountSeating()
    const toast = useToastStore()
    await wrapper.get('textarea').setValue(['Amy', 'Bob', 'Cid'].join('\n'))
    await flushPromises()
    await swapFirstTwo(wrapper)
    await clickButton(wrapper, 'Restore roster order')
    const undoToast = toast.toasts.find((t) => t.title === 'Restored original roster order')
    expect(undoToast?.action?.label).toBe('Undo')
    expect(undoToast?.text).toBe('Undo within 10 seconds to restore the manual seating')
    wrapper.unmount()
  })
})
