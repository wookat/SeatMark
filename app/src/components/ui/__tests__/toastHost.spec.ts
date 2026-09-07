// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import ModalDialog, { MODAL_OPEN_CLASS } from '@/components/ui/ModalDialog.vue'
import ToastHost from '@/components/ui/ToastHost.vue'
import {
  STICKY_ACTIONS_CLASS,
  STUDIO_TOOLBAR_BOTTOM_VAR,
  useStickyActions,
} from '@/composables/useStickyActions'
import { useToastStore } from '@/stores/toast'

describe('ToastHost 与底部操作条安全区', () => {
  it('容器带 has-next-step-bar / has-sticky-actions 让位 class：默认 bottom-20，操作条可见时上移到反馈按钮顶部之上并叠加底部安全区', () => {
    setActivePinia(createPinia())
    const wrapper = mount(ToastHost)
    const host = wrapper.get('[role="status"]')
    expect(host.classes()).toContain('bottom-20')
    expect(host.classes()).toContain('[.has-next-step-bar_&]:bottom-[calc(8rem_+_env(safe-area-inset-bottom,0px))]')
    expect(host.classes()).toContain('[.has-sticky-actions_&]:bottom-[calc(8rem_+_env(safe-area-inset-bottom,0px))]')
    expect(host.classes()).toContain('max-w-80')
    wrapper.unmount()
  })

  it('≥sm 定位到右上（top-20 right-4），带吸底按钮栏的页面 sm–lg 走右下车道、≥lg 回到右上但落在工坊工具栏下方', () => {
    setActivePinia(createPinia())
    const wrapper = mount(ToastHost)
    const host = wrapper.get('[role="status"]')
    expect(host.classes()).toContain('sm:top-20')
    expect(host.classes()).toContain('sm:right-4')
    expect(host.classes()).toContain('sm:bottom-auto')
    expect(host.classes()).toContain('[.has-sticky-actions_&]:sm:top-auto')
    // ≥lg：top 跟随 PreviewArea 写入的 --studio-toolbar-bottom（工具栏实际底边）+ 0.5rem；无变量时回退 4.5rem + 0.5rem = top-20
    expect(host.classes()).not.toContain('[.has-sticky-actions_&]:lg:top-20')
    expect(host.classes()).toContain(
      `[.has-sticky-actions_&]:lg:top-[calc(var(${STUDIO_TOOLBAR_BOTTOM_VAR},4.5rem)_+_0.5rem)]`,
    )
    expect(host.classes()).toContain('[.has-sticky-actions_&]:lg:bottom-auto')
    expect(host.classes()).toContain('[.has-sticky-actions_&]:lg:flex-col')
    wrapper.unmount()
  })

  it('第 353 轮：弹窗打开期间（html.has-modal）窄屏改落顶部：带 [.has-modal_&]:max-sm:top-16 / bottom-auto，≥sm 定位 class 不变', () => {
    setActivePinia(createPinia())
    const wrapper = mount(ToastHost)
    const host = wrapper.get('[role="status"]')
    expect(host.classes()).toContain('[.has-modal_&]:max-sm:top-16')
    expect(host.classes()).toContain('[.has-modal_&]:max-sm:bottom-auto')
    expect(host.classes()).toContain('sm:top-20')
    expect(host.classes()).toContain('sm:bottom-auto')
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

describe('第 353 轮：ModalDialog 打开期间在 <html> 标记 has-modal（多弹窗计数）', () => {
  afterEach(() => {
    document.documentElement.classList.remove(MODAL_OPEN_CLASS)
    document.body.innerHTML = ''
  })

  function mountModal(open: boolean) {
    return mount(ModalDialog, {
      props: { open, title: 't' },
      global: { stubs: { Teleport: true, Transition: true } },
      attachTo: document.body,
    })
  }

  it('open 时添加，两个弹窗叠加时关掉一个仍保留，全部关闭/卸载后移除', async () => {
    expect(document.documentElement.classList.contains(MODAL_OPEN_CLASS)).toBe(false)
    const a = mountModal(true)
    expect(document.documentElement.classList.contains(MODAL_OPEN_CLASS)).toBe(true)
    const b = mountModal(true)
    expect(document.documentElement.classList.contains(MODAL_OPEN_CLASS)).toBe(true)

    await a.setProps({ open: false })
    expect(document.documentElement.classList.contains(MODAL_OPEN_CLASS)).toBe(true)
    await b.setProps({ open: false })
    expect(document.documentElement.classList.contains(MODAL_OPEN_CLASS)).toBe(false)

    await b.setProps({ open: true })
    expect(document.documentElement.classList.contains(MODAL_OPEN_CLASS)).toBe(true)
    b.unmount()
    expect(document.documentElement.classList.contains(MODAL_OPEN_CLASS)).toBe(false)
    a.unmount()
  })
})

describe('useStickyActions：页面挂载期间在 <html> 标记 has-sticky-actions', () => {
  afterEach(() => {
    document.documentElement.classList.remove(STICKY_ACTIONS_CLASS)
  })

  it('挂载时添加、卸载时移除', () => {
    const Page = defineComponent({
      setup() {
        useStickyActions()
        return () => h('div')
      },
    })
    expect(document.documentElement.classList.contains(STICKY_ACTIONS_CLASS)).toBe(false)
    const wrapper = mount(Page)
    expect(document.documentElement.classList.contains(STICKY_ACTIONS_CLASS)).toBe(true)
    wrapper.unmount()
    expect(document.documentElement.classList.contains(STICKY_ACTIONS_CLASS)).toBe(false)
  })
})
