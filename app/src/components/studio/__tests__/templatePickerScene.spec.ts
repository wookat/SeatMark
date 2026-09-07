// @vitest-environment jsdom
/**
 * 第 346 轮：模板面板场景快速入口——弹窗外常驻 6 个场景 chips，点击即打开全部模板弹窗并预选分类；
 * StudioView 支持 ?scene=<TemplateCategory> 深链（合法值预选分类打开弹窗，非法值忽略）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import TemplatePickerPanel from '@/components/studio/TemplatePickerPanel.vue'
import StudioView from '@/views/StudioView.vue'
import { TEMPLATE_CATEGORIES } from '@/data/defaultTemplates'
import { setLocale } from '@/i18n'
import { studioGuideDismissed } from '@/utils/firstVisit'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const SCENES = ['exam', 'teaching', 'kids', 'event', 'wedding', 'life'] as const

async function makeRouter(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push(path)
  await router.isReady()
  return router
}

function dialog(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('[role="dialog"]')
}

/** 弹窗内被选中（高亮）的分类 chip 文案 */
function activeCategoryLabel(): string {
  const active = dialog()?.querySelector<HTMLElement>('button.bg-brand-600')
  return active?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

function categoryName(id: (typeof SCENES)[number]): string {
  return TEMPLATE_CATEGORIES.find((c) => c.id === id)!.name
}

async function mountStudio(path: string) {
  const router = await makeRouter(path)
  const wrapper = mount(StudioView, {
    global: {
      plugins: [router],
      stubs: {
        PreviewArea: true,
        TemplateDesigner: true,
        DataImportPanel: true,
        MappingPanel: true,
        LayoutPanel: true,
        FirstVisitGuide: true,
        FitSuggestionBanner: true,
      },
    },
  })
  await wrapper.vm.$nextTick()
  return wrapper
}

describe('第 346 轮：TemplatePickerPanel 场景 chips + ?scene= 深链', () => {
  beforeEach(async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    )
    localStorage.clear()
    setActivePinia(createPinia())
    studioGuideDismissed.value = true
    await setLocale('zh')
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('弹窗外常驻 6 个场景 chip；点击「婚宴」打开全部模板弹窗并预选婚庆喜宴分类', async () => {
    const router = await makeRouter('/studio')
    const wrapper = mount(TemplatePickerPanel, { global: { plugins: [router] } })
    const chips = wrapper.findAll('[data-testid="scene-chips"] button')
    expect(chips.map((c) => c.attributes('data-scene'))).toEqual([...SCENES])
    expect(chips.map((c) => c.text())).toEqual(['考场', '教学', '幼儿园', '会议活动', '婚宴', '生活'])
    expect(dialog()).toBeNull()

    await wrapper.find('[data-scene="wedding"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(dialog()).not.toBeNull()
    expect(activeCategoryLabel()).toContain(categoryName('wedding'))
    // 弹窗内模板列表全部属于婚庆分类（每张卡片带分类名或模板名，至少列表非空）
    expect(dialog()!.textContent).toContain('婚')

    wrapper.unmount()
  })

  it('en：chip 文案无 CJK', async () => {
    await setLocale('en')
    const router = await makeRouter('/studio')
    const wrapper = mount(TemplatePickerPanel, { global: { plugins: [router] } })
    const text = wrapper.find('[data-testid="scene-chips"]').text()
    expect(text).not.toMatch(/[\u4e00-\u9fff]/)
    expect(text).toContain('Wedding')
    wrapper.unmount()
  })

  it('/studio?scene=event 打开即弹出全部模板并预选会议活动分类', async () => {
    const wrapper = await mountStudio('/studio?scene=event')
    await wrapper.vm.$nextTick()
    expect(dialog()).not.toBeNull()
    expect(activeCategoryLabel()).toContain(categoryName('event'))
    wrapper.unmount()
  })

  it('/studio?scene=bogus 非法值忽略：不弹窗', async () => {
    const wrapper = await mountStudio('/studio?scene=bogus')
    await wrapper.vm.$nextTick()
    expect(dialog()).toBeNull()
    expect(wrapper.find('[data-testid="scene-chips"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
