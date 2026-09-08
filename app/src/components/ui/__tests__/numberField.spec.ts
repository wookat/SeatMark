// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import NumberField from '@/components/ui/NumberField.vue'

describe('第 370 轮：NumberField precision 仅影响显示', () => {
  it('model=3.857 时 input 显示 3.86（默认 precision=2），且挂载不回写 update:modelValue', async () => {
    const wrapper = mount(NumberField, { props: { modelValue: 3.857, step: 0.5, min: 0, max: 50 } })
    await wrapper.vm.$nextTick()
    const input = wrapper.find('input').element as HTMLInputElement
    expect(input.value).toBe('3.86')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('precision 可配置：precision=1 → 3.9，precision=3 → 3.857；整数与常规值显示不变', () => {
    expect((mount(NumberField, { props: { modelValue: 3.857, precision: 1 } }).find('input').element as HTMLInputElement).value).toBe('3.9')
    expect((mount(NumberField, { props: { modelValue: 3.857, precision: 3 } }).find('input').element as HTMLInputElement).value).toBe('3.857')
    expect((mount(NumberField, { props: { modelValue: 8 } }).find('input').element as HTMLInputElement).value).toBe('8')
    expect((mount(NumberField, { props: { modelValue: 2.5 } }).find('input').element as HTMLInputElement).value).toBe('2.5')
  })

  it('用户输入 4 时正常回写 update:modelValue=4；越界输入按 min/max 夹取', async () => {
    const wrapper = mount(NumberField, { props: { modelValue: 3.857, step: 0.5, min: 0, max: 50 } })
    const input = wrapper.find('input')
    ;(input.element as HTMLInputElement).value = '4'
    await input.trigger('change')
    expect(wrapper.emitted('update:modelValue')).toEqual([[4]])

    ;(input.element as HTMLInputElement).value = '99'
    await input.trigger('change')
    expect(wrapper.emitted('update:modelValue')![1]).toEqual([50])
  })

  it('步进按钮仍基于模型原值（3.857 + 0.5 = 4.357），不受显示四舍五入影响', async () => {
    const wrapper = mount(NumberField, { props: { modelValue: 3.857, step: 0.5 } })
    await wrapper.find('button[aria-label="增大"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[4.357]])
  })
})
