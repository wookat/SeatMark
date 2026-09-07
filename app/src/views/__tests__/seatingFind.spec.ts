// @vitest-environment jsdom
/**
 * 第 355 轮：/seating 查找学生——findSeatsByName 纯函数（精确 / 部分 / 重名多命中 / 空查询）
 * + SeatingView 输入框：命中座位加高亮、提示「第 X 排 第 Y 列 · 座位号 N」、无命中「未找到」、Esc / 清空恢复。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setLocale } from '@/i18n'
import { buildSeats, findSeatsByName } from '@/utils/seating'
import SeatingView from '@/views/SeatingView.vue'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const ROSTER = ['张伟', '李娜', '王芳', '李明', '刘洋', '李娜', '陈静', '杨帆']

describe('findSeatsByName（纯函数）', () => {
  // 2 排 × 4 列按行填充：座位号 1..8，第 6 位「李娜」被 suffix 区分前先按原名单构造
  const seats = buildSeats(
    ROSTER.map((name) => ({ name })),
    2,
    4,
    'rows',
  )

  it('精确匹配返回唯一座位并带行列座位号', () => {
    const hits = findSeatsByName(seats, '王芳')
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ name: '王芳', row: 1, col: 3, seatNo: 3 })
  })

  it('部分匹配（单字）多命中，按座位号升序', () => {
    const hits = findSeatsByName(seats, '李')
    expect(hits.map((s) => s.name)).toEqual(['李娜', '李明', '李娜'])
    expect(hits.map((s) => s.seatNo)).toEqual([2, 4, 6])
  })

  it('重名多命中：两个「李娜」都返回', () => {
    const hits = findSeatsByName(seats, '李娜')
    expect(hits.map((s) => s.seatNo)).toEqual([2, 6])
  })

  it('空查询 / 仅空白返回空数组；空座位不参与匹配', () => {
    expect(findSeatsByName(seats, '')).toEqual([])
    expect(findSeatsByName(seats, '   ')).toEqual([])
    const sparse = buildSeats([{ name: '张伟' }], 1, 3, 'rows')
    expect(sparse.some((s) => !s.name)).toBe(true)
    expect(findSeatsByName(sparse, '—')).toEqual([])
  })

  it('无命中返回空数组；拼音首字母可命中（口径同宴会搜索）', () => {
    expect(findSeatsByName(seats, '赵')).toEqual([])
    expect(findSeatsByName(seats, 'zw').map((s) => s.name)).toEqual(['张伟'])
  })
})

describe('SeatingView 查找学生输入框', () => {
  async function mountView() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
    })
    await router.push('/seating')
    await router.isReady()
    const wrapper = mount(SeatingView, {
      global: { plugins: [router], stubs: { Teleport: true, Transition: true } },
      attachTo: document.body,
    })
    await wrapper.vm.$nextTick()
    await wrapper.get('textarea').setValue(ROSTER.join('\n'))
    await flushPromises()
    return wrapper
  }

  beforeEach(async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    )
    Element.prototype.scrollIntoView = vi.fn()
    localStorage.clear()
    sessionStorage.clear()
    setActivePinia(createPinia())
    await setLocale('zh')
  })

  it('输入「李」：多座位高亮、提示含命中数与行列座位号，首个命中滚入视图', async () => {
    const wrapper = await mountView()
    const scrollSpy = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>
    scrollSpy.mockClear()
    await wrapper.get('[data-testid="seating-find-input"]').setValue('李')
    await flushPromises()
    await wrapper.vm.$nextTick()

    const found = wrapper.findAll('.seating-seat--found')
    // 默认合并重名：两个「李娜」合并为一座，加「李明」共 2 个命中
    expect(found.length).toBe(2)
    expect(found.map((el) => el.attributes('data-seat-no'))).toEqual(['2', '4'])
    const hint = wrapper.get('[data-testid="seating-find-hint"]').text()
    expect(hint).toContain('命中 2 个座位')
    expect(hint).toContain('李娜：第 1 排 第 2 列 · 座位号 2')
    expect(hint).toContain('李明：第 1 排 第 4 列 · 座位号 4')
    expect(scrollSpy).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('精确姓名单命中：提示只显示位置；无命中显示「未找到」且无高亮', async () => {
    const wrapper = await mountView()
    const input = wrapper.get('[data-testid="seating-find-input"]')
    await input.setValue('王芳')
    await flushPromises()
    expect(wrapper.findAll('.seating-seat--found')).toHaveLength(1)
    expect(wrapper.get('[data-testid="seating-find-hint"]').text()).toBe('王芳：第 1 排 第 3 列 · 座位号 3')

    await input.setValue('赵')
    await flushPromises()
    expect(wrapper.findAll('.seating-seat--found')).toHaveLength(0)
    expect(wrapper.get('[data-testid="seating-find-hint"]').text()).toBe('未找到')
    wrapper.unmount()
  })

  it('Esc 与清除按钮都恢复：输入清空、高亮与提示消失', async () => {
    const wrapper = await mountView()
    const input = wrapper.get('[data-testid="seating-find-input"]')
    await input.setValue('李')
    await flushPromises()
    expect(wrapper.findAll('.seating-seat--found').length).toBeGreaterThan(0)

    await input.trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect((input.element as HTMLInputElement).value).toBe('')
    expect(wrapper.findAll('.seating-seat--found')).toHaveLength(0)
    expect(wrapper.find('[data-testid="seating-find-hint"]').exists()).toBe(false)

    await input.setValue('张')
    await flushPromises()
    expect(wrapper.findAll('.seating-seat--found')).toHaveLength(1)
    await wrapper.get('[data-testid="seating-find-clear"]').trigger('click')
    await flushPromises()
    expect((input.element as HTMLInputElement).value).toBe('')
    expect(wrapper.findAll('.seating-seat--found')).toHaveLength(0)
    wrapper.unmount()
  })

  it('名单为空时不显示查找框', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
    })
    await router.push('/seating')
    await router.isReady()
    const wrapper = mount(SeatingView, {
      global: { plugins: [router], stubs: { Teleport: true, Transition: true } },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="seating-find"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
