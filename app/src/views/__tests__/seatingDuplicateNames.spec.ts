// @vitest-environment jsdom
/**
 * 第 349 轮：/seating 粘贴名单重名处理——完全重名默认合并（toast.info「已合并 N 个重复姓名」，
 * 同名学生不占两座），勾选「保留同名」后加 ①② 后缀各占一座。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useToastStore } from '@/stores/toast'
import SeatingView from '@/views/SeatingView.vue'

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

const ROSTER = ['宇文成都 男', '张伟 女', '李娜 女', '宇文成都 男', '王芳 女'].join('\n')

function seatNames(wrapper: Awaited<ReturnType<typeof mountSeating>>): string[] {
  return wrapper
    .findAll('.seating-seat-name')
    .map((c) => c.text().trim())
    .filter((n) => n && n !== '—')
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  Element.prototype.scrollIntoView = vi.fn()
  localStorage.clear()
  setActivePinia(createPinia())
  vi.restoreAllMocks()
})

describe('第 349 轮：SeatingView 名单重名', () => {
  it('粘贴含重名名单：默认合并、toast.info 提示、座位数按去重后计算', async () => {
    const wrapper = await mountSeating()
    const toast = useToastStore()
    await wrapper.get('textarea').setValue(ROSTER)
    await flushPromises()

    const info = toast.toasts.find((t) => t.type === 'info' && t.title.includes('已合并'))
    expect(info?.title).toBe('已合并 1 个重复姓名')

    const hint = wrapper.get('[data-testid="roster-duplicates-text"]').text()
    expect(hint).toContain('已合并 1 个重复姓名')
    expect(hint).toContain('宇文成都')
    expect(wrapper.text()).toMatch(/已输入\s*4\s*名学生/)
    const names = seatNames(wrapper)
    expect(names.filter((n) => n.startsWith('宇文成都'))).toHaveLength(1)
    wrapper.unmount()
  })

  it('勾选「保留同名」：两位同名各占一座并带 ①② 后缀，提示改为「已保留」，不再弹合并 toast', async () => {
    const wrapper = await mountSeating()
    const toast = useToastStore()
    await wrapper.get('textarea').setValue(ROSTER)
    await flushPromises()
    const before = toast.toasts.length

    await wrapper.get('[data-testid="roster-keep-duplicates"] input').setValue(true)
    await flushPromises()

    expect(wrapper.text()).toMatch(/已输入\s*5\s*名学生/)
    expect(wrapper.get('[data-testid="roster-duplicates-text"]').text()).toContain('已保留 1 个重复姓名')
    const names = seatNames(wrapper)
    expect(names).toContain('宇文成都①')
    expect(names).toContain('宇文成都②')
    expect(toast.toasts.length).toBe(before)
    // 开关持久化
    const persisted = JSON.parse(localStorage.getItem('seatmark.seating-state.v1')!) as {
      duplicatePolicy?: string
    }
    expect(persisted.duplicatePolicy).toBe('suffix')
    wrapper.unmount()
  })

  it('无重名时不显示重名提示条', async () => {
    const wrapper = await mountSeating()
    await wrapper.get('textarea').setValue('张三\n李四\n王五')
    await flushPromises()
    expect(wrapper.find('[data-testid="roster-duplicates"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
