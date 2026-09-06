import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import AnnouncementBar from '@/components/ui/AnnouncementBar.vue'
import AppHeader from '@/components/ui/AppHeader.vue'
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
