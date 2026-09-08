// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import SelectField from '@/components/ui/SelectField.vue'

const options = [
  { value: 'keep', label: '尽量不拆组（默认）', hint: '同组尽量同桌，可能留空位' },
  { value: 'fill', label: '优先坐满', hint: '按桌顺序依次坐满，空桌最少；可能把同组拆到不同桌' },
  { value: 'plain', label: '无提示' },
]

describe('SelectField 选项提示', () => {
  it('第 370 轮：带 hint 的选项窄屏下提示另起一行（order-last + basis-full），选项名不被挤成省略号', async () => {
    const wrapper = mount(SelectField, {
      props: { modelValue: 'keep', options },
      global: { stubs: { Transition: false } },
    })
    await wrapper.get('button[aria-haspopup="listbox"]').trigger('click')
    const items = wrapper.findAll('[role="option"]')
    expect(items).toHaveLength(3)

    const fill = items[1]!
    expect(fill.classes()).toContain('max-sm:flex-wrap')
    const hint = fill.get('[data-testid="select-option-hint"]')
    expect(hint.text()).toBe('按桌顺序依次坐满，空桌最少；可能把同组拆到不同桌')
    for (const cls of ['max-sm:order-last', 'max-sm:basis-full', 'max-sm:min-w-0']) {
      expect(hint.classes()).toContain(cls)
    }
    expect(fill.get('span').classes()).toContain('truncate')

    expect(items[2]!.classes()).not.toContain('max-sm:flex-wrap')
    expect(items[2]!.find('[data-testid="select-option-hint"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
