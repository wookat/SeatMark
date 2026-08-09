import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ColorField from '@/components/ui/ColorField.vue'

function make(modelValue = '#123456') {
  return mount(ColorField, {
    props: {
      modelValue,
      'onUpdate:modelValue': async (v: string) => {
        await wrapperRef?.setProps({ modelValue: v })
      },
    },
  })
}

let wrapperRef: ReturnType<typeof make> | null = null

describe('ColorField HEX 文本输入', () => {
  it('键入 #RRGGBB 后失焦提交为小写规范值', async () => {
    wrapperRef = make()
    const text = wrapperRef.find('input[type="text"]')
    await text.setValue('#AABBCC')
    await text.trigger('blur')
    expect(wrapperRef.props('modelValue')).toBe('#aabbcc')
  })

  it('支持 #RGB 简写与省略 # 前缀', async () => {
    wrapperRef = make()
    const text = wrapperRef.find('input[type="text"]')
    await text.setValue('f0a')
    await text.trigger('blur')
    expect(wrapperRef.props('modelValue')).toBe('#ff00aa')
  })

  it('非法值不提交并回退显示当前色值', async () => {
    wrapperRef = make('#123456')
    const text = wrapperRef.find('input[type="text"]')
    await text.setValue('not-a-color')
    await text.trigger('blur')
    expect(wrapperRef.props('modelValue')).toBe('#123456')
    expect((text.element as HTMLInputElement).value).toBe('#123456')
  })

  it('保留原生取色器输入', () => {
    wrapperRef = make()
    expect(wrapperRef.find('input[type="color"]').exists()).toBe(true)
  })
})
