// @vitest-environment jsdom
/**
 * 第 364 轮：/seating 超员时列出「谁没座」并可与选中座位互换；换座/整排/随机排座可撤销（toast 撤销 + Ctrl/Cmd+Z）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setLocale } from '@/i18n'
import { useToastStore } from '@/stores/toast'
import SeatingView from '@/views/SeatingView.vue'

const downloadBlob = vi.fn()
vi.mock('@/utils/pngExport', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/utils/pngExport')>()
  return {
    ...mod,
    downloadBlob: (...args: Parameters<typeof mod.downloadBlob>) => downloadBlob(...args),
  }
})

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

function seatNames(wrapper: Wrapper): string[] {
  return wrapper.findAll('[data-seat-no]').map((c) => c.get('.seating-seat-name').text().trim())
}

function filledNames(wrapper: Wrapper): string[] {
  return seatNames(wrapper).filter((n) => n && n !== '—')
}

async function setGrid(wrapper: Wrapper, rows: number, cols: number) {
  const inputs = wrapper.findAll('input[type="number"]')
  await inputs[0]!.setValue(String(rows))
  await inputs[1]!.setValue(String(cols))
  await flushPromises()
}

async function swapFirstTwo(wrapper: Wrapper) {
  const seats = wrapper.findAll('[data-seat-no]')
  await seats[0]!.trigger('click')
  await seats[1]!.trigger('click')
  await flushPromises()
}

function pressUndo(target: EventTarget = window, init: KeyboardEventInit = { ctrlKey: true }) {
  const event = new KeyboardEvent('keydown', { key: 'z', bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

const NAMES = Array.from({ length: 52 }, (_, i) => `学生${String(i + 1).padStart(2, '0')}`)
const SIX = ['张伟', '王芳', '李娜', '赵六', '周七', '吴八']

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

describe('第 364 轮 P1：超员时列出未排座名单', () => {
  it('52 人 / 48 座：按钮 aria-expanded 展开 4 个具体姓名；导出页脚含「另有 4 人未排座」', async () => {
    const wrapper = await mountSeating()
    await setGrid(wrapper, 6, 8)
    await wrapper.get('textarea').setValue(NAMES.join('\n'))
    await flushPromises()
    expect(filledNames(wrapper)).toHaveLength(48)

    const toggle = wrapper.get('[data-testid="seating-unseated-toggle"]')
    expect(toggle.text()).toContain('超出 4 人排不下')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[data-testid="seating-unseated-list"]').exists()).toBe(false)

    await toggle.trigger('click')
    await flushPromises()
    expect(toggle.attributes('aria-expanded')).toBe('true')
    const chips = wrapper.findAll('[data-testid="seating-unseated-chip"]')
    expect(chips.map((c) => c.text())).toEqual(['学生49', '学生50', '学生51', '学生52'])

    const footnote = wrapper.get('[data-testid="seating-preview-unseated"]')
    expect(footnote.text()).toBe('另有 4 人未排座：学生49、学生50、学生51、学生52')
    wrapper.unmount()
  })

  it('未选座位时点姓名只提示；选中座位后点姓名：该生入座、原座位学生变为未排座，Ctrl+Z 可撤销', async () => {
    const wrapper = await mountSeating()
    const toast = useToastStore()
    await setGrid(wrapper, 6, 8)
    await wrapper.get('textarea').setValue(NAMES.join('\n'))
    await flushPromises()
    await wrapper.get('[data-testid="seating-unseated-toggle"]').trigger('click')
    await flushPromises()

    await wrapper.findAll('[data-testid="seating-unseated-chip"]')[0]!.trigger('click')
    await flushPromises()
    expect(toast.toasts.some((t) => t.title === '先在预览中点选一个座位')).toBe(true)
    expect(seatNames(wrapper)[0]).toBe('学生01')

    await wrapper.findAll('[data-seat-no]')[0]!.trigger('click')
    await flushPromises()
    await wrapper.findAll('[data-testid="seating-unseated-chip"]')[0]!.trigger('click')
    await flushPromises()
    expect(seatNames(wrapper)[0]).toBe('学生49')
    expect(wrapper.findAll('.seating-seat--selected')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="seating-unseated-chip"]').map((c) => c.text())).toEqual([
      '学生01',
      '学生50',
      '学生51',
      '学生52',
    ])
    expect(wrapper.get('[data-testid="seating-unseated-toggle"]').text()).toContain('超出 4 人排不下')
    expect(toast.toasts.some((t) => t.title === '学生49 已排到座位 1')).toBe(true)

    pressUndo()
    await flushPromises()
    expect(seatNames(wrapper)[0]).toBe('学生01')
    expect(wrapper.findAll('[data-testid="seating-unseated-chip"]').map((c) => c.text())).toEqual([
      '学生49',
      '学生50',
      '学生51',
      '学生52',
    ])
    wrapper.unmount()
  })

  it('超员时下载 CSV 含「未排座」段；不超员时无按钮、无页脚', async () => {
    const wrapper = await mountSeating()
    await setGrid(wrapper, 6, 8)
    await wrapper.get('textarea').setValue(NAMES.join('\n'))
    await flushPromises()

    downloadBlob.mockClear()
    await wrapper.get('[data-testid="seating-roster-csv"]').trigger('click')
    await flushPromises()
    expect(downloadBlob).toHaveBeenCalledTimes(1)
    const blob = downloadBlob.mock.calls[0]![0] as Blob
    const csv = await blob.text()
    expect(csv).toContain('\r\n\r\n未排座\r\n序号,姓名\r\n1,学生49\r\n2,学生50\r\n3,学生51\r\n4,学生52\r\n')

    await wrapper.get('textarea').setValue(SIX.join('\n'))
    await flushPromises()
    expect(wrapper.find('[data-testid="seating-unseated-toggle"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="seating-preview-unseated"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

/** 用鼠标 Pointer 事件把第 from 座拖到第 to 座（elementFromPoint 指向目标座） */
async function dragSeat(wrapper: Wrapper, from: number, to: number) {
  const seats = wrapper.findAll('[data-seat-no]')
  const target = seats[to]!.element as HTMLElement
  document.elementFromPoint = vi.fn(() => target)
  const down = new MouseEvent('pointerdown', { button: 0, clientX: 0, clientY: 0, bubbles: true, cancelable: true })
  Object.defineProperty(down, 'pointerType', { value: 'mouse' })
  seats[from]!.element.dispatchEvent(down)
  window.dispatchEvent(new MouseEvent('pointermove', { clientX: 60, clientY: 60 }))
  window.dispatchEvent(new MouseEvent('pointerup'))
  await flushPromises()
}

describe('第 365 轮 P1：点选 / 拖拽换座弹可撤销 toast', () => {
  it('点选两座：toast 标题含座位号与两人姓名，点「撤销」恢复原座次；之后 Ctrl+Z 无快照不再变化', async () => {
    const wrapper = await mountSeating()
    const toast = useToastStore()
    await wrapper.get('textarea').setValue(SIX.join('\n'))
    await flushPromises()
    await swapFirstTwo(wrapper)
    expect(filledNames(wrapper).slice(0, 2)).toEqual(['王芳', '张伟'])

    const swapped = toast.toasts.find((t) => t.title.startsWith('已交换座位'))
    expect(swapped?.title).toBe('已交换座位 1 ↔ 2：张伟 ⇄ 王芳')
    expect(swapped?.text).toBe('10 秒内可撤销（Ctrl/Cmd+Z）')
    expect(swapped?.action?.label).toBe('撤销')

    toast.runAction(swapped!.id)
    await flushPromises()
    expect(filledNames(wrapper)).toEqual(SIX)
    // toast 撤销已清空 lastUndo：Ctrl+Z 不再重复撤销
    const event = pressUndo()
    await flushPromises()
    expect(event.defaultPrevented).toBe(false)
    expect(filledNames(wrapper)).toEqual(SIX)
    wrapper.unmount()
  })

  it('拖拽换座：同样弹含姓名的 toast，点「撤销」恢复；再拖一次后 Ctrl+Z 也恢复，textarea 内 Ctrl+Z 不触发', async () => {
    const wrapper = await mountSeating()
    const toast = useToastStore()
    await setGrid(wrapper, 2, 3)
    await wrapper.get('textarea').setValue(SIX.join('\n'))
    await flushPromises()

    await dragSeat(wrapper, 0, 5)
    expect(filledNames(wrapper)).toEqual(['吴八', '王芳', '李娜', '赵六', '周七', '张伟'])
    const swapped = toast.toasts.find((t) => t.title.startsWith('已交换座位'))
    expect(swapped?.title).toBe('已交换座位 1 ↔ 6：张伟 ⇄ 吴八')
    expect(swapped?.action?.label).toBe('撤销')
    toast.runAction(swapped!.id)
    await flushPromises()
    expect(filledNames(wrapper)).toEqual(SIX)

    await dragSeat(wrapper, 1, 2)
    expect(filledNames(wrapper).slice(0, 3)).toEqual(['张伟', '李娜', '王芳'])
    const textarea = wrapper.get('textarea').element
    textarea.focus()
    expect(pressUndo(textarea).defaultPrevented).toBe(false)
    await flushPromises()
    expect(filledNames(wrapper).slice(0, 3)).toEqual(['张伟', '李娜', '王芳'])
    expect(pressUndo().defaultPrevented).toBe(true)
    await flushPromises()
    expect(filledNames(wrapper)).toEqual(SIX)
    wrapper.unmount()
  })

  it('拖到空座：toast 中空座显示为「空座」', async () => {
    const wrapper = await mountSeating()
    const toast = useToastStore()
    await setGrid(wrapper, 2, 4)
    await wrapper.get('textarea').setValue(SIX.join('\n'))
    await flushPromises()
    await dragSeat(wrapper, 0, 7)
    expect(toast.toasts.at(-1)?.title).toBe('已交换座位 1 ↔ 8：张伟 ⇄ 空座')
    wrapper.unmount()
  })

  it('未排座名单点姓名入座：仍只有自己的 success toast，不重复弹「已交换座位」', async () => {
    const wrapper = await mountSeating()
    const toast = useToastStore()
    await setGrid(wrapper, 6, 8)
    await wrapper.get('textarea').setValue(NAMES.join('\n'))
    await flushPromises()
    await wrapper.get('[data-testid="seating-unseated-toggle"]').trigger('click')
    await flushPromises()
    await wrapper.findAll('[data-seat-no]')[0]!.trigger('click')
    await flushPromises()
    const before = toast.toasts.length
    await wrapper.findAll('[data-testid="seating-unseated-chip"]')[0]!.trigger('click')
    await flushPromises()
    expect(toast.toasts.length).toBe(before + 1)
    expect(toast.toasts.at(-1)?.title).toBe('学生49 已排到座位 1')
    expect(toast.toasts.some((t) => t.title.startsWith('已交换座位'))).toBe(false)
    wrapper.unmount()
  })
})

describe('第 365 轮 P1：多考场「全部」视图不再假溢出', () => {
  const roster59 = `姓名\t考场\n${Array.from({ length: 59 }, (_, i) => {
    const room = i < 20 ? '考场01' : i < 40 ? '考场02' : '考场03'
    return `学生${String(i + 1).padStart(2, '0')}\t${room}`
  }).join('\n')}`

  it('59 人×3 考场 vs 6×8：无「超出 11 人排不下」，出引导文案；点击后进入第一考场、人数 ≤ 48 无溢出且有 toast', async () => {
    const wrapper = await mountSeating()
    const toast = useToastStore()
    await setGrid(wrapper, 6, 8)
    await wrapper.get('textarea').setValue(roster59)
    await flushPromises()

    expect(wrapper.find('[data-testid="seating-unseated-toggle"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="seating-unseated-list"]').exists()).toBe(false)
    const guide = wrapper.get('[data-testid="seating-rooms-guide"]')
    expect(guide.text()).toBe('「全部」把 3 个考场合排在一张图；各考场单独都坐得下，先选考场再排座')
    expect(guide.text()).not.toContain('排不下')

    await guide.trigger('click')
    await flushPromises()
    expect(filledNames(wrapper)).toHaveLength(20)
    expect(filledNames(wrapper)[0]).toBe('学生01')
    expect(wrapper.find('[data-testid="seating-rooms-guide"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="seating-unseated-toggle"]').exists()).toBe(false)
    expect(toast.toasts.at(-1)?.title).toBe('已切到 考场01，可在下方下拉切换')
    wrapper.unmount()
  })

  it('单考场 60 人 / 某考场单独也排不下：保留真实溢出提示与未排座名单，页脚不变', async () => {
    const wrapper = await mountSeating()
    await setGrid(wrapper, 6, 8)
    const single60 = `姓名\t考场\n${Array.from({ length: 60 }, (_, i) => `学生${String(i + 1).padStart(2, '0')}\t考场01`).join('\n')}`
    await wrapper.get('textarea').setValue(single60)
    await flushPromises()
    expect(wrapper.find('[data-testid="seating-rooms-guide"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="seating-unseated-toggle"]').text()).toContain('超出 12 人排不下')
    expect(wrapper.get('[data-testid="seating-preview-unseated"]').text()).toContain('另有 12 人未排座')

    const big = `姓名\t考场\n${Array.from({ length: 59 }, (_, i) => `学生${String(i + 1).padStart(2, '0')}\t${i < 50 ? '考场01' : '考场02'}`).join('\n')}`
    await wrapper.get('textarea').setValue(big)
    await flushPromises()
    expect(wrapper.find('[data-testid="seating-rooms-guide"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="seating-unseated-toggle"]').text()).toContain('超出 11 人排不下')
    wrapper.unmount()
  })
})

describe('第 364 轮 P3：换座 / 整排交换 / 随机排座可撤销', () => {
  it('点选换座后 Ctrl+Z 恢复原座次并提示；再按一次无快照不再变化', async () => {
    const wrapper = await mountSeating()
    const toast = useToastStore()
    await wrapper.get('textarea').setValue(SIX.join('\n'))
    await flushPromises()
    const before = toast.toasts.length
    await swapFirstTwo(wrapper)
    expect(filledNames(wrapper).slice(0, 2)).toEqual(['王芳', '张伟'])
    // 第 365 轮：点选换座弹一条可撤销 toast（含座位号与两人姓名）
    expect(toast.toasts.length).toBe(before + 1)
    expect(toast.toasts.at(-1)?.title).toBe('已交换座位 1 ↔ 2：张伟 ⇄ 王芳')

    const event = pressUndo()
    await flushPromises()
    expect(event.defaultPrevented).toBe(true)
    expect(filledNames(wrapper)).toEqual(SIX)
    expect(toast.toasts.some((t) => t.title === '已撤销上一步换座')).toBe(true)

    const second = pressUndo()
    await flushPromises()
    expect(second.defaultPrevented).toBe(false)
    expect(filledNames(wrapper)).toEqual(SIX)
    wrapper.unmount()
  })

  it('Cmd+Z 同样生效；Ctrl+Shift+Z / 无修饰键 不触发', async () => {
    const wrapper = await mountSeating()
    await wrapper.get('textarea').setValue(SIX.join('\n'))
    await flushPromises()
    await swapFirstTwo(wrapper)
    pressUndo(window, { ctrlKey: true, shiftKey: true })
    pressUndo(window, {})
    await flushPromises()
    expect(filledNames(wrapper).slice(0, 2)).toEqual(['王芳', '张伟'])
    pressUndo(window, { metaKey: true })
    await flushPromises()
    expect(filledNames(wrapper)).toEqual(SIX)
    wrapper.unmount()
  })

  it('焦点在 textarea / input 时 Ctrl+Z 不触发撤销', async () => {
    const wrapper = await mountSeating()
    await wrapper.get('textarea').setValue(SIX.join('\n'))
    await flushPromises()
    await swapFirstTwo(wrapper)
    const textarea = wrapper.get('textarea').element
    textarea.focus()
    const event = pressUndo(textarea)
    await flushPromises()
    expect(event.defaultPrevented).toBe(false)
    expect(filledNames(wrapper).slice(0, 2)).toEqual(['王芳', '张伟'])
    pressUndo(wrapper.get('input').element)
    await flushPromises()
    expect(filledNames(wrapper).slice(0, 2)).toEqual(['王芳', '张伟'])
    wrapper.unmount()
  })

  it('整排交换 toast 带「撤销」action，点击后恢复；Ctrl+Z 也可恢复', async () => {
    const wrapper = await mountSeating()
    const toast = useToastStore()
    await setGrid(wrapper, 2, 3)
    await wrapper.get('textarea').setValue(SIX.join('\n'))
    await flushPromises()
    expect(filledNames(wrapper)).toEqual(SIX)

    const handles = wrapper.findAll('.seating-row-handle')
    expect(handles.length).toBeGreaterThanOrEqual(2)
    await handles[0]!.trigger('click')
    await handles[1]!.trigger('click')
    await flushPromises()
    expect(filledNames(wrapper)).toEqual(['赵六', '周七', '吴八', '张伟', '王芳', '李娜'])
    const swapped = toast.toasts.find((t) => t.title.startsWith('已交换排'))
    expect(swapped?.action?.label).toBe('撤销')
    expect(swapped?.text).toContain('10 秒内可撤销')

    toast.runAction(swapped!.id)
    await flushPromises()
    expect(filledNames(wrapper)).toEqual(SIX)
    // 撤销按钮已消费快照，Ctrl+Z 不再重复恢复
    pressUndo()
    await flushPromises()
    expect(filledNames(wrapper)).toEqual(SIX)

    await handles[0]!.trigger('click')
    await handles[1]!.trigger('click')
    await flushPromises()
    expect(filledNames(wrapper)).toEqual(['赵六', '周七', '吴八', '张伟', '王芳', '李娜'])
    pressUndo()
    await flushPromises()
    expect(filledNames(wrapper)).toEqual(SIX)
    wrapper.unmount()
  })

  it('随机排座 toast 带撤销 action，恢复到随机前座次', async () => {
    const wrapper = await mountSeating()
    const toast = useToastStore()
    await wrapper.get('textarea').setValue(SIX.join('\n'))
    await flushPromises()
    await swapFirstTwo(wrapper)
    const manual = filledNames(wrapper)
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    await wrapper.findAll('button').filter((b) => b.text().includes('完全随机'))[0]!.trigger('click')
    await flushPromises()
    const randomized = toast.toasts.find((t) => t.title === '已完全随机排座')
    expect(randomized?.action?.label).toBe('撤销')
    toast.runAction(randomized!.id)
    await flushPromises()
    expect(filledNames(wrapper)).toEqual(manual)
    wrapper.unmount()
  })

  it('卸载后移除监听：Ctrl+Z 不再报错也不触发', async () => {
    const wrapper = await mountSeating()
    const toast = useToastStore()
    await wrapper.get('textarea').setValue(SIX.join('\n'))
    await flushPromises()
    await swapFirstTwo(wrapper)
    wrapper.unmount()
    pressUndo()
    expect(toast.toasts.some((t) => t.title === '已撤销上一步换座')).toBe(false)
  })
})
