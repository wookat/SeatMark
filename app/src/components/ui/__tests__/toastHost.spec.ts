// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import ToastHost from '@/components/ui/ToastHost.vue'
import { useToastStore } from '@/stores/toast'

describe('ToastHost 与底部操作条安全区', () => {
  it('容器带 has-next-step-bar 让位 class：默认 bottom-20，操作条可见时上移到反馈按钮顶部之上', () => {
    setActivePinia(createPinia())
    const wrapper = mount(ToastHost)
    const host = wrapper.get('[role="status"]')
    expect(host.classes()).toContain('bottom-20')
    expect(host.classes()).toContain('[.has-next-step-bar_&]:bottom-[8rem]')
    expect(host.classes()).toContain('max-w-80')
    wrapper.unmount()
  })

  it('有 toast 时渲染在同一容器内（堆叠整体随容器上移）', async () => {
    setActivePinia(createPinia())
    const wrapper = mount(ToastHost, { global: { stubs: { TransitionGroup: false } } })
    useToastStore().success('已导入')
    await wrapper.vm.$nextTick()
    const host = wrapper.get('[role="status"]')
    expect(host.text()).toContain('已导入')
    wrapper.unmount()
  })
})
