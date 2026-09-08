// @vitest-environment jsdom
/**
 * 第 360 轮：首页 PRIVACY PROOF 两张对比卡的 6 条 li 正文统一包 <span class="min-w-0">，
 * 避免裸文本 / <strong> 各自成为 flex item 把句子拆成多列；信任区精度口径与 vsPages 统一为 ≤0.35mm。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setLocale } from '@/i18n'
import HomeView from '@/views/HomeView.vue'

const io = class {
  observe() {}
  disconnect() {}
  unobserve() {}
}
let prevIO: typeof IntersectionObserver
let prevRO: typeof ResizeObserver
let prevMatchMedia: typeof window.matchMedia

beforeEach(() => {
  prevIO = globalThis.IntersectionObserver
  prevRO = globalThis.ResizeObserver
  prevMatchMedia = window.matchMedia
  globalThis.IntersectionObserver = io as unknown as typeof IntersectionObserver
  globalThis.ResizeObserver = io as unknown as typeof ResizeObserver
  window.matchMedia = (() => ({ matches: true, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
})

afterEach(async () => {
  globalThis.IntersectionObserver = prevIO
  globalThis.ResizeObserver = prevRO
  window.matchMedia = prevMatchMedia
  await setLocale('zh')
})

async function mountHome(path: '/' | '/en') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path, component: HomeView },
      { path: '/:rest(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  await setLocale(path === '/en' ? 'en' : 'zh')
  return mount(HomeView, {
    global: { plugins: [router], stubs: { TemplateThumb: true, LabelSheet: true } },
  })
}

function privacyItems(wrapper: VueWrapper) {
  return wrapper.findAll('#privacy ul li')
}

describe('第 360 轮：首页 PRIVACY PROOF li 排版', () => {
  it.each(['/', '/en'] as const)('%s：6 条 li 恰有 svg + span 两个子元素且 span 内是完整句子', async (path) => {
    const wrapper = await mountHome(path)
    const items = privacyItems(wrapper)
    expect(items).toHaveLength(6)
    for (const li of items) {
      const children = Array.from(li.element.children)
      expect(children.map((c) => c.tagName.toLowerCase())).toEqual(['svg', 'span'])
      const span = children[1]!
      expect(span.classList.contains('min-w-0')).toBe(true)
      // li 内除 svg 外的全部文本都在 span 里（无裸文本节点漂在外面）
      const bareText = Array.from(li.element.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent?.trim() ?? '')
        .join('')
      expect(bareText).toBe('')
      expect(span.textContent?.trim().length ?? 0).toBeGreaterThan(10)
      expect(span.textContent?.trim()).toBe(li.text().trim())
    }
    wrapper.unmount()
  })

  it('en：li 句子含 <strong> 强调且整句在同一 span 中', async () => {
    const wrapper = await mountHome('/en')
    const first = privacyItems(wrapper)[0]!
    const span = first.find('span.min-w-0')
    expect(span.find('strong').text()).toBe('zero network requests')
    expect(span.text()).toBe('Uploading a spreadsheet adds zero network requests: parsing runs in local JS')
    wrapper.unmount()
  })
})

describe('第 360 轮：首页信任区精度口径', () => {
  it('zh：显示 ≤0.35mm / 校准实测偏差，不再出现 0.1mm', async () => {
    const wrapper = await mountHome('/')
    const text = wrapper.text()
    expect(text).toContain('≤0.35mm')
    expect(text).toContain('校准实测偏差')
    expect(text).not.toContain('0.1mm')
    expect(text).not.toContain('排版精度')
    wrapper.unmount()
  })

  it('en：显示 ≤0.35mm / Calibrated deviation，无 CJK 残留', async () => {
    const wrapper = await mountHome('/en')
    const text = wrapper.text()
    expect(text).toContain('≤0.35mm')
    expect(text).toContain('Calibrated deviation')
    expect(text).not.toContain('0.1mm')
    expect(text).not.toContain('校准实测偏差')
    wrapper.unmount()
  })
})
