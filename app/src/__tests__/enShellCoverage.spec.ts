// @vitest-environment jsdom
/**
 * 第 341 轮：/en 壳层 i18n 覆盖回归护栏。
 * 以真实路由挂载 App 壳（跳转链接、AnnouncementBar、AppHeader、ToastHost、FeedbackButton 按钮态、
 * NotFoundView、AppFooter），在 en 下断言可见文本、aria-label、placeholder、title 均无 CJK。
 * 白名单：¥、ICP 备案号、语言切换「中文 / 切换到中文」。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import App from '@/App.vue'
import { createAppRouter } from '@/router'
import { setLocale } from '@/i18n'

const CJK = /[\u4e00-\u9fff]/

/** 允许残留的中文：语言切换入口与 ICP 备案号 */
function stripWhitelist(text: string): string {
  return text
    .replace(/切换到中文/g, '')
    .replace(/中文/g, '')
    .replace(/[\u4e00-\u9fff]ICP备\s*\d+号(-\d+)?/g, '')
    .replace(/[\u4e00-\u9fff]{1,2}ICP[^\s<]*/g, '')
}

function attrValues(html: string, attr: string): string[] {
  const re = new RegExp(`\\s${attr}="([^"]*)"`, 'g')
  return [...html.matchAll(re)].map((m) => m[1]!)
}

async function mountApp(path: string) {
  const router = createAppRouter()
  await router.push(path)
  await router.isReady()
  const w = mount(App, {
    global: { plugins: [router], stubs: { Teleport: true, Transition: true, TransitionGroup: true } },
    attachTo: document.body,
  })
  await flushPromises()
  await w.vm.$nextTick()
  return { w, router }
}

describe('第 341 轮：/en 壳层 CJK 回归护栏', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    setActivePinia(createPinia())
    vi.stubGlobal('scrollTo', vi.fn())
    // 壳层挂载会触发 /api/auth/me、/api/announcement 等只读请求，一律拦截为 404，不出网
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: 'not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
  })
  afterEach(async () => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
    await setLocale('zh')
  })

  it('/en/does-not-exist：壳层 + 404 视图文本、aria-label、placeholder、title 均无 CJK（白名单除外）', async () => {
    const { w } = await mountApp('/en/does-not-exist')
    const html = w.html()

    expect(w.text()).toContain('Skip to main content')
    expect(w.text()).toContain('Page not found or moved')
    expect(stripWhitelist(w.text())).not.toMatch(CJK)
    for (const attr of ['aria-label', 'placeholder', 'title', 'alt']) {
      expect(stripWhitelist(attrValues(html, attr).join(' ')), attr).not.toMatch(CJK)
    }

    // 404 内链全部带 /en 前缀
    const notFoundLinks = w
      .findAll('main a')
      .map((a) => a.attributes('href'))
      .filter((h): h is string => Boolean(h) && !/^https?:/.test(h!))
    expect(notFoundLinks.length).toBeGreaterThan(0)
    for (const h of notFoundLinks) expect(h).toMatch(/^\/en(\/|\?|$)/)

    // 反馈按钮态：aria-label 为英文
    const feedback = w.find('button[aria-label="Feedback"]')
    expect(feedback.exists()).toBe(true)

    w.unmount()
  })

  it('/does-not-exist：中文壳层文案与现状一致', async () => {
    const { w } = await mountApp('/does-not-exist')
    expect(w.text()).toContain('跳到主内容')
    expect(w.text()).toContain('页面不存在或已被移动')
    expect(w.find('button[aria-label="反馈"]').exists()).toBe(true)
    w.unmount()
  })
})
