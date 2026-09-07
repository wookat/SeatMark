// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import ModalDialog from '@/components/ui/ModalDialog.vue'

function mountModal(open: boolean) {
  return mount(ModalDialog, {
    props: { open, title: 't' },
    global: { stubs: { Teleport: true, Transition: true } },
    attachTo: document.body,
  })
}

async function flush(w: ReturnType<typeof mountModal>) {
  await w.vm.$nextTick()
  await w.vm.$nextTick()
}

describe('ModalDialog 哨兵回收定时器生命周期', () => {
  let back: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
  })

  afterEach(() => {
    back.mockRestore()
    vi.useRealTimers()
  })

  it('Esc 关闭后 50ms 内回收哨兵：恰好调用一次 history.back', async () => {
    const w = mountModal(false)
    await w.setProps({ open: true })
    await flush(w)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('close')).toHaveLength(1)
    await w.setProps({ open: false })
    await flush(w)
    expect(back).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60)
    expect(back).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('关闭后立刻卸载：50ms 内不再调用 history.back（定时器已清理）', async () => {
    const w = mountModal(false)
    await w.setProps({ open: true })
    await flush(w)
    await w.setProps({ open: false })
    await flush(w)
    w.unmount()
    vi.advanceTimersByTime(60)
    expect(back).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('仍有其他弹窗实例挂载时，卸载其中一个不打断另一个的哨兵回收', async () => {
    const a = mountModal(false)
    const b = mountModal(false)
    await a.setProps({ open: true })
    await flush(a)
    await a.setProps({ open: false })
    await flush(a)
    b.unmount()
    vi.advanceTimersByTime(60)
    expect(back).toHaveBeenCalledTimes(1)
    a.unmount()
  })
})
