// @vitest-environment jsdom
/**
 * 第 350 轮：/en/seating 术语——考场语境的人数单位用 students，不再复用宴会语境的共享键「人」→ guests；
 * 中文页仍显示「人」。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setLocale } from '@/i18n'
import SeatingView from '@/views/SeatingView.vue'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

async function mountSeating(path: '/seating' | '/en/seating') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/seating', component: SeatingView },
      { path: '/en/seating', component: SeatingView },
      { path: '/studio', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(SeatingView, {
    global: { plugins: [router], stubs: { Teleport: true, Transition: true } },
    attachTo: document.body,
  })
  await wrapper.vm.$nextTick()
  return wrapper
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  Element.prototype.scrollIntoView = vi.fn()
  localStorage.clear()
  setActivePinia(createPinia())
})

afterEach(async () => {
  document.body.innerHTML = ''
  await setLocale('zh')
})

describe('第 350 轮：/en/seating 术语 students', () => {
  it('英文页渲染文本不含 guest（不区分大小写），人数单位为 students', async () => {
    await setLocale('en')
    const wrapper = await mountSeating('/en/seating')
    await wrapper.get('textarea').setValue(['Alice', 'Bob', 'Carol'].join('\n'))
    await wrapper.vm.$nextTick()
    const text = wrapper.text()
    expect(text).not.toMatch(/guest/i)
    expect(text).toMatch(/\b3 students\b/)
    wrapper.unmount()
  })

  it('中文页人数单位仍为「人」', async () => {
    const wrapper = await mountSeating('/seating')
    await wrapper.get('textarea').setValue(['张伟', '李娜', '王芳'].join('\n'))
    await wrapper.vm.$nextTick()
    const text = wrapper.text()
    expect(text).toMatch(/3 人/)
    expect(text).not.toContain('名单人数单位')
    expect(text).not.toMatch(/students/i)
    wrapper.unmount()
  })

  it('第 372 轮：英文页底部操作条文案为「Go to: …」，主按钮带 data-next-step-primary 标记', async () => {
    await setLocale('en')
    const wrapper = await mountSeating('/en/seating')
    const action = wrapper.find('[data-testid="next-step-action"]')
    expect(action.exists()).toBe(true)
    expect(action.text()).toBe('Go to: Import roster')
    expect(action.text()).not.toMatch(/^Next:/)
    expect(wrapper.find('[data-testid="seating-upload-roster"]').attributes('data-next-step-primary')).toBeDefined()
    expect(wrapper.find('[data-testid="seating-randomize"]').attributes('data-next-step-primary')).toBeDefined()
    expect(wrapper.find('[data-testid="seating-export-png"]').attributes('data-next-step-primary')).toBeDefined()
    expect(wrapper.find('[data-testid="next-step-progress"]').text()).toBe('0 students / 48 seats')
    wrapper.unmount()
  })
})
