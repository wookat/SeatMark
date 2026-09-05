// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import { BATCH_SIZE } from '@/composables/useBatchedList'
import { guides } from '@/data/guides'
import { templateDetails } from '@/data/templateDetails'
import GuidesView from '@/views/GuidesView.vue'
import TemplatesView from '@/views/TemplatesView.vue'

async function mountView(component: typeof GuidesView | typeof TemplatesView, path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/guides', component: GuidesView },
      { path: '/templates', component: TemplatesView },
      { path: '/:rest(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(component, {
    global: { plugins: [router], stubs: { TemplateThumb: true } },
  })
  await flushPromises()
  return wrapper
}

const cardLinks = (wrapper: ReturnType<typeof mount>, prefix: string) =>
  wrapper.findAll(`a[href^="${prefix}"]`).filter((a) => a.classes().includes('group'))

describe('TemplatesView 分批加载', () => {
  it('首屏 ≤24 张卡片，加载更多后增加，筛选时重置', async () => {
    expect(templateDetails.length).toBeGreaterThan(BATCH_SIZE * 2)
    const wrapper = await mountView(TemplatesView, '/templates')
    expect(cardLinks(wrapper, '/templates/').length).toBe(BATCH_SIZE)

    await wrapper.find('[data-testid="load-more"]').trigger('click')
    await flushPromises()
    expect(cardLinks(wrapper, '/templates/').length).toBe(BATCH_SIZE * 2)

    const chips = wrapper.find('[data-testid="templates-filter-bar"]').findAll('button')
    await chips[1]!.trigger('click')
    await flushPromises()
    expect(cardLinks(wrapper, '/templates/').length).toBeLessThanOrEqual(BATCH_SIZE)
    expect(wrapper.text()).toContain('已显示')
  })

  it('筛选栏在移动端 sticky 且保留白底细边框', async () => {
    const wrapper = await mountView(TemplatesView, '/templates')
    const bar = wrapper.find('[data-testid="templates-filter-bar"]')
    expect(bar.classes()).toEqual(
      expect.arrayContaining(['sticky', 'top-14', 'bg-white', 'border-b', 'border-slate-200', 'md:static']),
    )
  })
})

describe('GuidesView 分批加载', () => {
  it('首屏 ≤24 篇，加载更多后增加，切换筛选时重置', async () => {
    expect(guides.length).toBeGreaterThan(BATCH_SIZE)
    const wrapper = await mountView(GuidesView, '/guides')
    expect(cardLinks(wrapper, '/guides/').length).toBe(BATCH_SIZE)

    await wrapper.find('[data-testid="load-more"]').trigger('click')
    await flushPromises()
    expect(cardLinks(wrapper, '/guides/').length).toBe(Math.min(guides.length, BATCH_SIZE * 2))

    const input = wrapper.find('input[type="search"]')
    await input.setValue('打印')
    await flushPromises()
    expect(cardLinks(wrapper, '/guides/').length).toBeLessThanOrEqual(BATCH_SIZE)

    const bar = wrapper.find('[data-testid="guides-filter-bar"]')
    expect(bar.classes()).toEqual(expect.arrayContaining(['sticky', 'top-14', 'bg-white', 'border-b']))
  })
})
