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

describe('第 364 轮 P3：换座 / 整排交换 / 随机排座可撤销', () => {
  it('点选换座后 Ctrl+Z 恢复原座次并提示；再按一次无快照不再变化', async () => {
    const wrapper = await mountSeating()
    const toast = useToastStore()
    await wrapper.get('textarea').setValue(SIX.join('\n'))
    await flushPromises()
    const before = toast.toasts.length
    await swapFirstTwo(wrapper)
    expect(filledNames(wrapper).slice(0, 2)).toEqual(['王芳', '张伟'])
    // 点选换座不弹新 toast
    expect(toast.toasts.length).toBe(before)

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
