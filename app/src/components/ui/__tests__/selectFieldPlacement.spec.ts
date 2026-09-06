// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import SelectField from '@/components/ui/SelectField.vue'

const options = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
  { value: 'c', label: 'C' },
]

function mockTriggerRect(top: number, bottom: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    top,
    bottom,
    left: 0,
    right: 100,
    width: 100,
    height: bottom - top,
    x: 0,
    y: top,
    toJSON: () => ({}),
  })
}

async function openList(placement?: 'auto' | 'down' | 'up') {
  const wrapper = mount(SelectField, {
    props: { modelValue: 'a', options, size: 'sm', placement },
    global: { stubs: { Transition: false } },
  })
  await wrapper.get('button[aria-haspopup="listbox"]').trigger('click')
  return wrapper
}

describe('SelectField 展开方向', () => {
  afterEach(() => vi.restoreAllMocks())

  it('默认（auto）在视口中部向下展开', async () => {
    mockTriggerRect(100, 130)
    const wrapper = await openList()
    const list = wrapper.get('[role="listbox"]')
    expect(list.attributes('data-placement')).toBe('down')
    expect(list.classes()).toContain('top-full')
    wrapper.unmount()
  })

  it('auto：触发按钮贴近视口底部且下方放不下时向上展开', async () => {
    const h = window.innerHeight
    mockTriggerRect(h - 40, h - 10)
    const wrapper = await openList()
    const list = wrapper.get('[role="listbox"]')
    expect(list.attributes('data-placement')).toBe('up')
    expect(list.classes()).toContain('bottom-full')
    wrapper.unmount()
  })

  it('placement="up" 固定向上展开（底部固定工具条场景）', async () => {
    mockTriggerRect(100, 130)
    const wrapper = await openList('up')
    const list = wrapper.get('[role="listbox"]')
    expect(list.attributes('data-placement')).toBe('up')
    expect(list.classes()).toContain('bottom-full')
    expect(list.classes()).not.toContain('mt-1.5')
    wrapper.unmount()
  })

  it('placement="down" 即使贴底也向下展开', async () => {
    const h = window.innerHeight
    mockTriggerRect(h - 40, h - 10)
    const wrapper = await openList('down')
    expect(wrapper.get('[role="listbox"]').attributes('data-placement')).toBe('down')
    wrapper.unmount()
  })
})
