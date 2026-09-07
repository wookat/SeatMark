// @vitest-environment jsdom
/**
 * 第 351 轮：「小技巧：单张覆写」引导气泡时序——预览首帧后 4s 才出现、10s 后自动收起、
 * 用户滚动 / 点击预览即收起、<1024px 视口不展示；已关闭过（localStorage）不再出现。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import PreviewArea from '@/components/studio/PreviewArea.vue'
import { useWorkspaceStore } from '@/stores/workspace'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const HINT = '[data-testid="edit-one-hint"]'
const SCROLL = '[data-testid="preview-scroll"]'
const HINT_KEY = 'seatmark.edit-one-hint-dismissed.v1'

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
}

async function mountPreview() {
  const wrapper = mount(PreviewArea, {
    global: {
      stubs: {
        LabelSheet: true,
        CalibrationDialog: true,
        DuplexGuideDialog: true,
        Teleport: true,
        Transition: true,
      },
    },
    attachTo: document.body,
  })
  await wrapper.vm.$nextTick()
  return wrapper
}

async function advance(wrapper: Awaited<ReturnType<typeof mountPreview>>, ms: number) {
  await vi.advanceTimersByTimeAsync(ms)
  await wrapper.vm.$nextTick()
}

describe('第 351 轮：PreviewArea 单张覆写引导气泡时序', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    localStorage.clear()
    sessionStorage.clear()
    setActivePinia(createPinia())
    setViewportWidth(1280)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('有名单时默认不可见，4s 后出现，再过 10s 自动收起并记住已关闭', async () => {
    useWorkspaceStore().useDemoData()
    const wrapper = await mountPreview()
    expect(wrapper.find(HINT).exists()).toBe(false)

    await advance(wrapper, 3999)
    expect(wrapper.find(HINT).exists()).toBe(false)
    await advance(wrapper, 1)
    expect(wrapper.find(HINT).exists()).toBe(true)
    expect(wrapper.get(HINT).text()).toContain('小技巧：单张覆写')

    await advance(wrapper, 9999)
    expect(wrapper.find(HINT).exists()).toBe(true)
    await advance(wrapper, 1)
    expect(wrapper.find(HINT).exists()).toBe(false)
    expect(localStorage.getItem(HINT_KEY)).toBe('1')
    wrapper.unmount()
  })

  it('气泡展示后用户滚动预览即收起；展示前的滚动不影响定时出现', async () => {
    useWorkspaceStore().useDemoData()
    const wrapper = await mountPreview()
    await advance(wrapper, 1000)
    await wrapper.get(SCROLL).trigger('scroll')
    await advance(wrapper, 3000)
    expect(wrapper.find(HINT).exists()).toBe(true)

    await wrapper.get(SCROLL).trigger('scroll')
    await wrapper.vm.$nextTick()
    expect(wrapper.find(HINT).exists()).toBe(false)
    expect(localStorage.getItem(HINT_KEY)).toBe('1')
    wrapper.unmount()
  })

  it('点击预览区同样收起', async () => {
    useWorkspaceStore().useDemoData()
    const wrapper = await mountPreview()
    await advance(wrapper, 4000)
    expect(wrapper.find(HINT).exists()).toBe(true)
    await wrapper.get(SCROLL).trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find(HINT).exists()).toBe(false)
    wrapper.unmount()
  })

  it('<1024px 视口不展示', async () => {
    setViewportWidth(1023)
    useWorkspaceStore().useDemoData()
    const wrapper = await mountPreview()
    await advance(wrapper, 20000)
    expect(wrapper.find(HINT).exists()).toBe(false)
    expect(localStorage.getItem(HINT_KEY)).toBeNull()
    wrapper.unmount()
  })

  it('无名单时不排期；导入名单（首帧）后才开始计时', async () => {
    const workspace = useWorkspaceStore()
    const wrapper = await mountPreview()
    await advance(wrapper, 20000)
    expect(wrapper.find(HINT).exists()).toBe(false)

    workspace.useDemoData()
    await wrapper.vm.$nextTick()
    await advance(wrapper, 3999)
    expect(wrapper.find(HINT).exists()).toBe(false)
    await advance(wrapper, 1)
    expect(wrapper.find(HINT).exists()).toBe(true)
    wrapper.unmount()
  })

  it('已关闭过（localStorage 标记）不再出现', async () => {
    localStorage.setItem(HINT_KEY, '1')
    useWorkspaceStore().useDemoData()
    const wrapper = await mountPreview()
    await advance(wrapper, 20000)
    expect(wrapper.find(HINT).exists()).toBe(false)
    wrapper.unmount()
  })
})
