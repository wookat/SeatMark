// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import ColorField from '@/components/ui/ColorField.vue'
import NumberField from '@/components/ui/NumberField.vue'
import SelectField from '@/components/ui/SelectField.vue'
import ShareWelcomeBanner from '@/components/ui/ShareWelcomeBanner.vue'
import ToastHost from '@/components/ui/ToastHost.vue'
import { setLocale } from '@/i18n'
import { createPinia, setActivePinia } from 'pinia'
import { useToastStore } from '@/stores/toast'

const CJK = /[\u4e00-\u9fff]/

function ariaLabels(html: string): string[] {
  return [...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!)
}

function makeRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  return router
}

describe('第 341 轮：壳层基础组件 en 下无 CJK', () => {
  afterEach(async () => {
    await setLocale('zh')
  })

  it('NumberField：en 下增大/减小 aria-label 为英文；zh 保持「增大/减小」', async () => {
    await setLocale('en')
    const en = mount(NumberField, { props: { modelValue: 3 } })
    const labelsEn = ariaLabels(en.html())
    expect(labelsEn).toEqual(expect.arrayContaining(['Increase', 'Decrease']))
    expect(labelsEn.join(' ')).not.toMatch(CJK)
    expect(en.text()).not.toMatch(CJK)

    await setLocale('zh')
    const zh = mount(NumberField, { props: { modelValue: 3 } })
    expect(ariaLabels(zh.html())).toEqual(expect.arrayContaining(['增大', '减小']))
  })

  it('SelectField：en 下默认 placeholder 为英文；zh 保持「请选择」；显式非字典 placeholder 原样透传', async () => {
    const options = [{ value: 'a', label: 'Alpha' }]
    await setLocale('en')
    const en = mount(SelectField, { props: { modelValue: undefined, options } })
    expect(en.text()).toContain('Select…')
    expect(en.text()).not.toMatch(CJK)

    const custom = mount(SelectField, {
      props: { modelValue: undefined, options, placeholder: 'Pick one' },
    })
    expect(custom.text()).toContain('Pick one')

    await setLocale('zh')
    const zh = mount(SelectField, { props: { modelValue: undefined, options } })
    expect(zh.text()).toContain('请选择')
  })

  it('ColorField：en 下取色器/HEX aria-label 为英文', async () => {
    await setLocale('en')
    const w = mount(ColorField, { props: { modelValue: '#123456' } })
    const labels = ariaLabels(w.html())
    expect(labels).toEqual(expect.arrayContaining(['Open color picker', 'HEX color value']))
    expect(labels.join(' ')).not.toMatch(CJK)
  })

  it('ShareWelcomeBanner：en 下文本与 aria-label 无 CJK，CTA 指向 /en/studio?demo=1；zh 文案与现状一致', async () => {
    await setLocale('en')
    const router = makeRouter()
    await router.push('/en')
    await router.isReady()
    const en = mount(ShareWelcomeBanner, { props: { open: true }, global: { plugins: [router] } })
    expect(en.text()).not.toMatch(CJK)
    expect(ariaLabels(en.html()).join(' ')).not.toMatch(CJK)
    expect(en.text()).toContain('A colleague recommended SeatMark to you')
    expect(en.find('a').attributes('href')).toBe('/en/studio?demo=1')

    await setLocale('zh')
    const zh = mount(ShareWelcomeBanner, { props: { open: true }, global: { plugins: [router] } })
    expect(zh.text()).toContain('同事向你推荐了 SeatMark 座签')
    expect(zh.text()).toContain('一键开始（含演示数据）')
    expect(zh.find('a').attributes('href')).toBe('/studio?demo=1')
    expect(ariaLabels(zh.html())).toEqual(expect.arrayContaining(['同事推荐欢迎信息', '关闭欢迎提示']))
  })

  it('ToastHost：en 下区域与关闭按钮 aria-label 为英文', async () => {
    setActivePinia(createPinia())
    await setLocale('en')
    const toast = useToastStore()
    toast.info('Hello')
    const w = mount(ToastHost)
    await w.vm.$nextTick()
    const labels = ariaLabels(w.html())
    expect(labels).toEqual(expect.arrayContaining(['Notifications', 'Dismiss notification']))
    expect(labels.join(' ')).not.toMatch(CJK)
  })
})
