// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setLocale } from '@/i18n'
import AboutView from '@/views/AboutView.vue'

const CJK = /[\u4e00-\u9fff]/

async function mountAbout() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: AboutView }],
  })
  await router.push('/')
  await router.isReady()
  return mount(AboutView, { global: { plugins: [router] } })
}

describe('AboutView 产品介绍页', () => {
  afterEach(async () => {
    await setLocale('zh')
  })

  it('zh：定位、能力、场景、收费/隐私、联系方式齐全', async () => {
    const w = await mountAbout()
    const text = w.text()
    expect(text).toContain('关于 SeatMark')
    expect(text).toContain('226 款内置模板')
    expect(text).toContain('联系我们')
    expect(text).toContain('wookat@qq.com')
    expect(text).toContain('HERUOZAI')
    expect(w.find('a[href="mailto:wookat@qq.com"]').exists()).toBe(true)
    w.unmount()
  })

  it('en：全英文正文无 CJK，联系方式同构', async () => {
    await setLocale('en')
    const w = await mountAbout()
    const text = w.text()
    expect(text).toContain('About SeatMark')
    expect(text).toContain('226 built-in templates')
    expect(text).toContain('WeChat')
    expect(text).not.toMatch(CJK)
    w.unmount()
  })
})
