import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import AnnouncementBar from '@/components/ui/AnnouncementBar.vue'
import AppHeader from '@/components/ui/AppHeader.vue'
import { setLocale } from '@/i18n'
import { useAuthStore } from '@/stores/auth'

const TAP = ['max-md:min-h-11', 'max-md:min-w-11']

async function mountHeader() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/:rest(.*)*', name: 'any', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(AppHeader, { global: { plugins: [router] } })
  return wrapper
}

describe('AppHeader 移动端触控热区（<md 时 ≥44×44）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('logo / 模板 / 教程 / 语言切换 / 登录 均带 44px 最小热区类', async () => {
    const wrapper = await mountHeader()
    const links = wrapper.findAll('a')
    const byText = (text: string) => links.find((a) => a.text() === text)
    const logo = links[0]!
    const lang = links.find((a) => a.attributes('aria-label') === 'Switch to English')!

    for (const el of [logo, byText('模板')!, byText('教程')!, lang, byText('登录')!]) {
      for (const cls of TAP) expect(el.classes()).toContain(cls)
    }
    expect(logo.attributes('aria-label')).toBe('返回首页')
    expect(lang.attributes('aria-label')).toBe('Switch to English')
  })

  it('已登录时账号菜单按钮带 44px 热区，头像视觉仍为 32px 圆形', async () => {
    const auth = useAuthStore()
    auth.user = {
      email: 'demo@example.com',
      createdAt: '',
      lastLoginAt: '',
      loginCount: 1,
      templateCount: 0,
      templateUpdatedAt: null,
      betaMember: false,
      pro: { active: false, until: null },
      isAdmin: false,
      quota: { date: '', used: 0, limit: 3, bonus: 0, remaining: 3 },
      share: {
        code: 'abcd',
        totalVisits: 0,
        totalBonus: 0,
        bonusToday: 0,
        bonusDailyCap: 0,
        bonusPerVisit: 0,
      },
    }
    const wrapper = await mountHeader()
    const btn = wrapper.find('button[aria-label="账号菜单"]')
    expect(btn.exists()).toBe(true)
    for (const cls of TAP) expect(btn.classes()).toContain(cls)
    expect(btn.find('span').classes()).toContain('size-8')
    expect(btn.text()).toBe('D')
  })
})

describe('AppHeader 「排座」场景下拉', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('点击展开后含 /seating 与 /banquet 两个链接，≥sm 才显示', async () => {
    const wrapper = await mountHeader()
    const nav = wrapper.get('[data-testid="nav-seating"]')
    expect(nav.classes()).toEqual(expect.arrayContaining(['hidden', 'sm:block']))
    const toggle = nav.get('button')
    expect(toggle.text()).toContain('排座')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(nav.find('[role="menu"]').exists()).toBe(false)

    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    const hrefs = nav.findAll('a[role="menuitem"]').map((a) => a.attributes('href'))
    expect(hrefs).toEqual(['/seating', '/banquet'])
    expect(nav.text()).toContain('教室座位表')
    expect(nav.text()).toContain('宴会排桌')

    await nav.trigger('mouseleave')
    expect(nav.find('[role="menu"]').exists()).toBe(false)
  })

  it('悬停展开后首次点击触发按钮不关闭（钉住），再次点击才关闭', async () => {
    const wrapper = await mountHeader()
    const nav = wrapper.get('[data-testid="nav-seating"]')
    const toggle = nav.get('button')
    await nav.trigger('mouseenter')
    expect(nav.find('[role="menu"]').exists()).toBe(true)
    await toggle.trigger('click')
    expect(nav.find('[role="menu"]').exists()).toBe(true)
    await toggle.trigger('click')
    expect(nav.find('[role="menu"]').exists()).toBe(false)
  })
})

describe('第 347 轮：AppHeader <sm 汉堡抽屉导航', () => {
  const ZH_HREFS = ['/', '/templates', '/seating', '/banquet', '/guides', '/pricing', '/vs', '/papers', '/account', '/en']

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(async () => {
    await setLocale('zh')
  })

  it('汉堡按钮仅 <sm 渲染、带 44px 热区与 aria；点击展开含全部一级入口（zh）', async () => {
    const wrapper = await mountHeader()
    const drawer = wrapper.get('[data-testid="nav-drawer"]')
    expect(drawer.classes()).toContain('sm:hidden')
    const toggle = drawer.get('[data-testid="nav-drawer-toggle"]')
    expect(toggle.classes()).toEqual(expect.arrayContaining(['min-h-11', 'min-w-11']))
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(toggle.attributes('aria-controls')).toBe('mobile-nav-drawer')
    expect(toggle.attributes('aria-label')).toBe('打开菜单')
    expect(wrapper.find('#mobile-nav-drawer').exists()).toBe(false)

    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(toggle.attributes('aria-label')).toBe('关闭菜单')
    const nav = wrapper.get('#mobile-nav-drawer')
    expect(nav.findAll('a').map((a) => a.attributes('href'))).toEqual(ZH_HREFS)
    for (const label of ['首页', '模板', '教室座位表', '宴会排桌', '教程', '定价', '工具对比选型', '不干胶纸型库', '登录', 'English']) {
      expect(nav.text()).toContain(label)
    }
    // 品牌不再 truncate：<sm 中文只显示「座签」
    const brand = wrapper.get('[data-testid="brand-link"]')
    expect(brand.classes()).not.toContain('min-w-0')
    expect(brand.find('.truncate').exists()).toBe(false)
    expect(brand.find('.whitespace-nowrap').exists()).toBe(true)
    expect(brand.text()).toContain('座签')
  })

  it('英文站抽屉链接带 /en 前缀，语言切换指向中文路径', async () => {
    await setLocale('en')
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'home', component: { template: '<div />' } },
        { path: '/en', name: 'en-home', component: { template: '<div />' } },
        { path: '/:rest(.*)*', name: 'any', component: { template: '<div />' } },
      ],
    })
    await router.push('/en')
    await router.isReady()
    const wrapper = mount(AppHeader, { global: { plugins: [router] } })
    await wrapper.get('[data-testid="nav-drawer-toggle"]').trigger('click')
    const nav = wrapper.get('#mobile-nav-drawer')
    expect(nav.findAll('a').map((a) => a.attributes('href'))).toEqual([
      '/en',
      '/en/templates',
      '/en/seating',
      '/en/banquet',
      '/en/guides',
      '/en/pricing',
      '/en/vs',
      '/en/papers',
      '/en/account',
      '/',
    ])
    expect(nav.get('[data-testid="nav-drawer-locale"]').text()).toContain('中文')
    expect(nav.text()).toContain('Pricing')
  })

  it('点外部 / Esc / 路由切换 均关闭抽屉', async () => {
    const wrapper = await mountHeader()
    const toggle = wrapper.get('[data-testid="nav-drawer-toggle"]')

    await toggle.trigger('click')
    expect(wrapper.find('#mobile-nav-drawer').exists()).toBe(true)
    document.body.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('#mobile-nav-drawer').exists()).toBe(false)

    await toggle.trigger('click')
    expect(wrapper.find('#mobile-nav-drawer').exists()).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('#mobile-nav-drawer').exists()).toBe(false)

    await toggle.trigger('click')
    expect(wrapper.find('#mobile-nav-drawer').exists()).toBe(true)
    await wrapper.vm.$router.push('/pricing')
    await flushPromises()
    expect(wrapper.find('#mobile-nav-drawer').exists()).toBe(false)
    expect(toggle.attributes('aria-expanded')).toBe('false')
  })
})

describe('AnnouncementBar 关闭按钮热区', () => {
  it('关闭按钮 ≥44px（min-h-11/min-w-11），视觉图标容器保持 20px', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ announcement: { text: '公告', enabled: true, updatedAt: 'v1' } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    )
    localStorage.removeItem('seatmark.announcement-dismissed.v1')
    const wrapper = mount(AnnouncementBar)
    await flushPromises()
    const btn = wrapper.find('button[aria-label="关闭公告"]')
    expect(btn.exists()).toBe(true)
    expect(btn.classes()).toContain('min-h-11')
    expect(btn.classes()).toContain('min-w-11')
    expect(btn.find('span').classes()).toContain('size-5')
    vi.unstubAllGlobals()
  })
})
