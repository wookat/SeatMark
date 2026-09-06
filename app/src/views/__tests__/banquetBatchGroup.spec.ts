// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import BanquetView from '@/views/BanquetView.vue'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

async function mountBanquet() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/banquet', component: BanquetView },
      { path: '/studio', component: { template: '<div />' } },
    ],
  })
  const wrapper = mount(BanquetView, {
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
  document.documentElement.classList.remove('has-next-step-bar')
})

describe('BanquetView 未安排池多选 + 批量分组', () => {
  it('开启多选后显示复选框与底部操作条，全选未分组 → 新建分组 → 应用后全部归组', async () => {
    const wrapper = await mountBanquet()
    const textarea = wrapper.find('textarea')
    await textarea.setValue('张伟\n李娜\n王芳\n赵强')
    await wrapper.find('button.btn-primary.btn-sm').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('input[aria-label="宾客姓名"]')).toHaveLength(4)

    expect(wrapper.find('[data-testid="batch-group-bar"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="next-step-bar"]').exists()).toBe(true)

    await wrapper.find('[data-testid="toggle-multi-select"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    const pool = wrapper.find('[data-guest-pool]')
    expect(pool.findAll('input[type="checkbox"]')).toHaveLength(4)
    expect(wrapper.find('[data-testid="batch-group-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="next-step-bar"]').exists()).toBe(false)
    expect(document.documentElement.classList.contains('has-next-step-bar')).toBe(true)

    const apply = wrapper.find<HTMLButtonElement>('[data-testid="batch-group-apply"]')
    expect(apply.element.disabled).toBe(true)

    await pool.findAll('input[type="checkbox"]')[0]!.setValue(true)
    expect(apply.text()).toContain('1 人')
    await wrapper.find('[data-testid="select-all-ungrouped"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(apply.text()).toContain('4 人')

    // 「新建分组…」立即建组并选中；仍需点应用才归组
    const select = wrapper.find('[data-testid="batch-group-select"]')
    await select.find('button').trigger('click')
    const newOption = select.findAll('[role="option"]').find((o) => o.text().includes('新建分组'))
    expect(newOption).toBeTruthy()
    await newOption!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('input[aria-label="分组名称"]')).toHaveLength(1)
    expect(apply.element.disabled).toBe(false)

    await apply.trigger('click')
    await wrapper.vm.$nextTick()
    const groupSelects = wrapper.findAll('[data-guest-pool] .banquet-pool-guest')
    expect(groupSelects).toHaveLength(4)
    // 应用后清空选中；宾客都已归入新分组（图例出现且「全选未分组」不再选中任何人）
    expect(apply.text()).toContain('0 人')
    await wrapper.find('[data-testid="select-all-ungrouped"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(apply.text()).toContain('0 人')

    // 清除分组：选一人 → 清除 → 该人回到未分组
    await pool.findAll('input[type="checkbox"]')[1]!.setValue(true)
    await wrapper.find('[data-testid="batch-group-clear"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="select-all-ungrouped"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(apply.text()).toContain('1 人')

    // 退出多选：操作条消失、NextStepBar 回来并按自身可见性接管标记
    await wrapper.find('[data-testid="toggle-multi-select"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="batch-group-bar"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="next-step-bar"]').exists()).toBe(true)
    expect(pool.findAll('input[type="checkbox"]')).toHaveLength(0)

    wrapper.unmount()
  })
})
