// @vitest-environment jsdom
/**
 * 第 352 轮：无水印额度前置到 /seating 与 /banquet 的导出按钮——
 * 两页与工坊共用 useQuotaBadge + 同一 quota store，打开导出弹窗前即显示同一余额；
 * 额度用完后改为「带水印免费」。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setLocale } from '@/i18n'
import { QUOTA_ANON_DAILY, useQuotaStore } from '@/stores/quota'
import BanquetView from '@/views/BanquetView.vue'
import SeatingView from '@/views/SeatingView.vue'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

async function mountView(component: typeof SeatingView | typeof BanquetView, path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(component, {
    global: { plugins: [router], stubs: { Teleport: true, Transition: true } },
  })
  await wrapper.vm.$nextTick()
  return wrapper
}

beforeEach(async () => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  )
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
  await setLocale('zh')
})

describe('导出按钮额度角标（/seating 与 /banquet）', () => {
  it('匿名首次访问：两页导出按钮角标同为「今日剩余 N 次」，且 N 来自同一 quota store', async () => {
    const quota = useQuotaStore()
    expect(quota.remaining).toBe(QUOTA_ANON_DAILY)

    const seating = await mountView(SeatingView, '/seating')
    const seatingBadge = seating.find('[data-testid="export-quota-badge"]')
    expect(seatingBadge.exists()).toBe(true)
    expect(seatingBadge.text()).toBe(`今日剩余 ${QUOTA_ANON_DAILY} 次`)
    expect(seatingBadge.classes()).toContain('bg-emerald-100')
    // 第 355 轮：额度文字改为按钮内联次要文字（不再绝对定位骑压按钮边缘）
    const seatingBtn = seating.find('[data-testid="seating-export-png"]')
    expect(seatingBtn.text()).toBe(`导出 PNG 今日剩余 ${QUOTA_ANON_DAILY} 次`)
    expect(seatingBtn.element.contains(seatingBadge.element)).toBe(true)
    expect(seatingBadge.classes()).not.toContain('absolute')

    const banquet = await mountView(BanquetView, '/banquet')
    const banquetBadge = banquet.find('[data-testid="export-quota-badge"]')
    expect(banquetBadge.text()).toBe(seatingBadge.text())
    const banquetBtn = banquet.find('[data-testid="banquet-export-png"]')
    expect(banquetBtn.text()).toBe(`导出高清 PNG 今日剩余 ${QUOTA_ANON_DAILY} 次`)
    expect(banquetBtn.element.contains(banquetBadge.element)).toBe(true)
    expect(banquetBadge.classes()).not.toContain('absolute')
    seating.unmount()
    banquet.unmount()
  })

  it('额度用完后两页角标同步变为「带水印免费」', async () => {
    const quota = useQuotaStore()
    const seating = await mountView(SeatingView, '/seating')
    const banquet = await mountView(BanquetView, '/banquet')

    for (let i = 0; i < QUOTA_ANON_DAILY; i++) expect(await quota.tryConsume()).toEqual({ ok: true })
    expect(quota.remaining).toBe(0)
    await seating.vm.$nextTick()
    await banquet.vm.$nextTick()

    expect(seating.find('[data-testid="export-quota-badge"]').text()).toBe('带水印免费')
    expect(seating.find('[data-testid="export-quota-badge"]').classes()).toContain('bg-sky-100')
    expect(banquet.find('[data-testid="export-quota-badge"]').text()).toBe('带水印免费')
    seating.unmount()
    banquet.unmount()
  })
})
