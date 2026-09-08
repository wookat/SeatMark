// @vitest-environment jsdom
/**
 * 第 359 轮：模板库橱窗缩略图按 locale 本地化——en 下固定文案（座位号 SEAT→SEAT NO.）不再外泄中文，
 * 仍含中文示例值的缩略图外层标 lang="zh"；zh 下缩略图吃原模板且不带 lang。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, type PropType } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { defaultTemplates } from '@/data/defaultTemplates'
import { setLocale } from '@/i18n'
import type { LabelTemplate } from '@/types/template'
import TemplatesView from '@/views/TemplatesView.vue'

const CJK = /[\u4e00-\u9fff]/

const ThumbStub = defineComponent({
  props: { template: { type: Object as PropType<LabelTemplate>, required: true }, defer: Boolean },
  setup(props) {
    return () =>
      h(
        'div',
        { 'data-testid': 'thumb-stub', 'data-id': props.template.id },
        props.template.fields.map((f) => f.fixedText ?? '').join('|'),
      )
  },
})

async function mountView(path: string) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/templates', component: TemplatesView },
      { path: '/en/templates', component: TemplatesView },
      { path: '/:rest(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(TemplatesView, { global: { plugins: [router], stubs: { TemplateThumb: ThumbStub } } })
  await flushPromises()
  return wrapper
}

describe('第 359 轮：TemplatesView 缩略图 en 本地化 + lang="zh" 标注', () => {
  afterEach(async () => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
    await setLocale('zh')
  })

  it('en：缩略图固定文案不含中文；含中文示例值的缩略图外层带 lang="zh"', async () => {
    await setLocale('en')
    const wrapper = await mountView('/en/templates')
    const thumbs = wrapper.findAll('[data-testid="thumb-stub"]')
    expect(thumbs.length).toBeGreaterThan(20)
    for (const thumb of thumbs) expect(thumb.text(), thumb.attributes('data-id')).not.toMatch(CJK)
    const standard = thumbs.find((t) => t.attributes('data-id') === 'standard')!
    expect(standard.text()).toContain('SEAT NO.')
    expect(standard.text()).not.toContain('座位号')
    // 标准考场版示例值已全部英文化 → 不带 lang；仍含中文示例（如人名/口号）的模板带 lang="zh"
    expect(standard.attributes('lang')).toBeUndefined()
    expect(thumbs.some((t) => t.attributes('lang') === 'zh')).toBe(true)
  })

  it('zh：缩略图吃原模板（固定文案保持中文），不设置 lang', async () => {
    const wrapper = await mountView('/templates')
    const standard = wrapper.findAll('[data-testid="thumb-stub"]').find((t) => t.attributes('data-id') === 'standard')!
    const original = defaultTemplates.find((t) => t.id === 'standard')!
    expect(standard.text()).toContain('座位号 SEAT')
    expect(standard.text()).toBe(original.fields.map((f) => f.fixedText ?? '').join('|'))
    expect(standard.attributes('lang')).toBeUndefined()
  })
})
