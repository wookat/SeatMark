// @vitest-environment jsdom
/**
 * 第 349 轮：/banquet 两列粘贴——有信号直接按列导入（4 人 3 桌、无假宾客、不报重名）；
 * 无信号但各行列数一致时弹解析预览确认对话框，可切换解析方式后再导入。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import BanquetView from '@/views/BanquetView.vue'
import { useToastStore } from '@/stores/toast'

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

async function pasteAndAdd(wrapper: Awaited<ReturnType<typeof mountBanquet>>, text: string) {
  await wrapper.find('textarea').setValue(text)
  await wrapper.find('button.btn-primary.btn-sm').trigger('click')
  await wrapper.vm.$nextTick()
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  Element.prototype.scrollIntoView = vi.fn()
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('BanquetView 两列粘贴解析', () => {
  it('「张三,主桌 / 李四,主桌 / 王五,亲友桌 / 赵六,同事桌」直接得 4 位宾客 3 桌，无假宾客、不提示重名', async () => {
    const wrapper = await mountBanquet()
    const toast = useToastStore()
    await pasteAndAdd(wrapper, '张三,主桌\n李四,主桌\n王五,亲友桌\n赵六,同事桌')

    expect(wrapper.find('[data-testid="parse-preview-modes"]').exists()).toBe(false)
    const names = wrapper.findAll<HTMLInputElement>('input[aria-label="宾客姓名"]').map((i) => i.element.value)
    expect(names).toEqual(['张三', '李四', '王五', '赵六'])
    const groupNames = wrapper.findAll<HTMLInputElement>('input[aria-label="分组名称"]').map((i) => i.element.value)
    expect(groupNames).toEqual(['主桌', '亲友桌', '同事桌'])
    expect(wrapper.text()).not.toContain('已合并')
    const last = toast.toasts[toast.toasts.length - 1]
    expect(last?.title).toContain('已导入 4 位宾客')
    expect(last?.text ?? '').not.toContain('重复')
    wrapper.unmount()
  })

  it('无信号两列（第二列也像人名）：弹解析预览，默认按列分组并列出分组人数，切「全部按姓名拆分」后确认导入 6 人', async () => {
    const wrapper = await mountBanquet()
    await pasteAndAdd(wrapper, '张伟,李娜\n王芳,赵强\n钱进,孙丽')

    // 未静默拆分：名单仍为空，对话框打开
    expect(wrapper.findAll('input[aria-label="宾客姓名"]')).toHaveLength(0)
    const modes = wrapper.find('[data-testid="parse-preview-modes"]')
    expect(modes.exists()).toBe(true)
    let summary = wrapper.find('[data-testid="parse-preview-summary"]')
    expect(summary.text()).toContain('将导入 3 位宾客、3 个分组')
    expect(summary.text()).toContain('李娜 · 1 人')

    const radios = modes.findAll<HTMLInputElement>('input[type="radio"]')
    expect(radios.map((r) => r.element.value)).toEqual(['column', 'nameOnly', 'tokens'])
    await radios[1]!.setValue(true)
    summary = wrapper.find('[data-testid="parse-preview-summary"]')
    expect(summary.text()).toContain('将导入 3 位宾客：张伟、王芳、钱进')
    expect(summary.text()).not.toContain('个分组')

    await radios[2]!.setValue(true)
    expect(wrapper.find('[data-testid="parse-preview-summary"]').text()).toContain('将导入 6 位宾客')

    await wrapper.find('[data-testid="parse-preview-confirm"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="parse-preview-modes"]').exists()).toBe(false)
    expect(wrapper.findAll('input[aria-label="宾客姓名"]')).toHaveLength(6)
    expect(wrapper.findAll('input[aria-label="分组名称"]')).toHaveLength(0)
    expect(wrapper.find('textarea').element.value).toBe('')
    wrapper.unmount()
  })

  it('取消解析预览：不导入、粘贴内容保留', async () => {
    const wrapper = await mountBanquet()
    await pasteAndAdd(wrapper, '张伟,李娜\n王芳,赵强')
    expect(wrapper.find('[data-testid="parse-preview-modes"]').exists()).toBe(true)
    const cancel = wrapper.findAll('button').find((b) => b.text() === '取消')
    await cancel!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="parse-preview-modes"]').exists()).toBe(false)
    expect(wrapper.findAll('input[aria-label="宾客姓名"]')).toHaveLength(0)
    expect(wrapper.find('textarea').element.value).toBe('张伟,李娜\n王芳,赵强')
    wrapper.unmount()
  })
})
