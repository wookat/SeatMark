// @vitest-environment jsdom
/**
 * 第 369 轮：/seating「用演示名单」的性别列按姓名标注池给定，不再按行号奇偶交替。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { demoGenderOf, NAME_GENDERS } from '@/data/demoDatasets'
import { setLocale } from '@/i18n'
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

type Wrapper = Awaited<ReturnType<typeof mountSeating>>

async function setGrid(wrapper: Wrapper, rows: number, cols: number) {
  const inputs = wrapper.findAll('input[type="number"]')
  await inputs[0]!.setValue(String(rows))
  await inputs[1]!.setValue(String(cols))
  await flushPromises()
}

async function loadDemo(wrapper: Wrapper): Promise<Array<[name: string, gender: string]>> {
  const btn = wrapper
    .findAll('button')
    .find((b) => /用演示名单|Use demo roster/.test(b.text()))
  expect(btn).toBeTruthy()
  await btn!.trigger('click')
  await flushPromises()
  const text = (wrapper.get('textarea').element as HTMLTextAreaElement).value
  return text.split('\n').map((line) => {
    const [name, gender] = line.split('\t')
    return [name!, gender ?? '']
  })
}

beforeEach(async () => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  Element.prototype.scrollIntoView = vi.fn()
  localStorage.clear()
  setActivePinia(createPinia())
  await setLocale('zh')
})

afterEach(async () => {
  await setLocale('zh')
})

describe('第 369 轮 P2：演示名单性别按姓名标注', () => {
  it('6×8 演示名单 48 人：李娜 / 陈静 / 林芳 均为女，每行性别与 NAME_GENDERS 一致', async () => {
    const wrapper = await mountSeating()
    await setGrid(wrapper, 6, 8)
    const rows = await loadDemo(wrapper)
    expect(rows).toHaveLength(48)
    const byName = new Map(rows)
    expect(byName.get('李娜')).toBe('女')
    expect(byName.get('陈静')).toBe('女')
    expect(byName.get('林芳')).toBe('女')
    const annotated = new Map(NAME_GENDERS)
    for (const [name, gender] of rows) {
      expect(annotated.get(name), `${name} 应来自标注池`).toBeDefined()
      expect(gender, name).toBe(annotated.get(name))
    }
    const female = rows.filter(([, g]) => g === '女').length
    expect(female).toBeGreaterThan(0)
    expect(female).toBeLessThan(rows.length)
    wrapper.unmount()
  })

  it('en 环境：性别列为 M/F，且与中文标注一致（LI Na → F）', async () => {
    await setLocale('en')
    const wrapper = await mountSeating()
    await setGrid(wrapper, 2, 3)
    const rows = await loadDemo(wrapper)
    expect(rows).toHaveLength(6)
    const byName = new Map(rows)
    expect(byName.get('LI Na')).toBe('F')
    expect(byName.get('ZHANG Wei')).toBe('M')
    for (const [name, gender] of rows) {
      expect(['M', 'F']).toContain(gender)
      expect(gender).toBe(demoGenderOf(name) === '女' ? 'F' : 'M')
    }
    wrapper.unmount()
  })
})
