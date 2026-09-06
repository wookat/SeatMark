// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import ChineseOnlyNotice from '@/components/ChineseOnlyNotice.vue'
import { setLocale } from '@/i18n'

const NOTICE =
  'This page is currently available in Chinese only. The label maker itself (/en/studio) is fully in English.'

function mountNotice(props: { hasEnglish?: boolean } = {}) {
  return mount(ChineseOnlyNotice, {
    props,
    global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
  })
}

describe('ChineseOnlyNotice', () => {
  afterEach(async () => {
    await setLocale('zh')
  })

  it('zh 下不渲染', async () => {
    await setLocale('zh')
    expect(mountNotice().find('[data-testid="chinese-only-notice"]').exists()).toBe(false)
  })

  it('en 下渲染单行提示并链接到 /en/studio', async () => {
    await setLocale('en')
    const wrapper = mountNotice()
    const notice = wrapper.find('[data-testid="chinese-only-notice"]')
    expect(notice.exists()).toBe(true)
    expect(notice.text().replace(/\s+/g, ' ')).toBe(NOTICE)
    expect(notice.find('a').attributes('href')).toBe('/en/studio')
    expect(notice.classes()).toContain('border-b')
    expect(notice.classes()).toContain('border-slate-200')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('内容自带英文字段时不渲染', async () => {
    await setLocale('en')
    expect(
      mountNotice({ hasEnglish: true }).find('[data-testid="chinese-only-notice"]').exists(),
    ).toBe(false)
  })
})
