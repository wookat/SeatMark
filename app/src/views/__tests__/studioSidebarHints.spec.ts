// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import StudioView from '@/views/StudioView.vue'
import { findLabelPaper } from '@/data/labelPapers'
import { setLocale } from '@/i18n'
import { useTemplateLibrary } from '@/stores/templateLibrary'
import { useWorkspaceStore } from '@/stores/workspace'
import { studioGuideDismissed } from '@/utils/firstVisit'
import { applyLabelPaper } from '@/utils/labelPaper'
import { evaluatePaperFit } from '@/utils/paperFit'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

async function makeRouter(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push(path)
  await router.isReady()
  return router
}

/** 把工作区切到一张与当前模板「勉强/不适配」的纸型，触发 FitSuggestionBanner */
function forceMismatch() {
  const workspace = useWorkspaceStore()
  const library = useTemplateLibrary()
  const tiny = findLabelPaper('a4-65up-round')!
  const design = library.allTemplates.find((tpl) => {
    const level = evaluatePaperFit(tpl, tiny).level
    return level === 'marginal' || level === 'incompatible'
  })
  expect(design).toBeTruthy()
  workspace.selectTemplate(design!, { silent: true })
  applyLabelPaper(workspace.template, tiny)
}

async function mountStudio() {
  const router = await makeRouter('/studio')
  const wrapper = mount(StudioView, {
    global: {
      plugins: [router],
      stubs: {
        PreviewArea: true,
        TemplateDesigner: true,
        DataImportPanel: true,
        MappingPanel: true,
        LayoutPanel: true,
        TemplatePickerPanel: true,
      },
    },
  })
  await wrapper.vm.$nextTick()
  return wrapper
}

describe('第 346 轮：Studio 侧栏提示层收敛（FirstVisitGuide × FitSuggestionBanner）', () => {
  beforeEach(async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    )
    localStorage.clear()
    setActivePinia(createPinia())
    studioGuideDismissed.value = false
    await setLocale('zh')
  })

  it('无错配：只有完整新手引导，没有错配条', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    const wrapper = await mountStudio()
    expect(wrapper.find('[data-testid="first-visit-guide"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="first-visit-guide-compact"]').exists()).toBe(false)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('同屏两提示 → 仅错配条一条完整展开，新手引导折叠为单行；错配消失后自动恢复完整引导', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    forceMismatch()
    const wrapper = await mountStudio()

    const banner = wrapper.find('[role="status"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('适配度')
    expect(wrapper.find('[data-testid="first-visit-guide-compact"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="first-visit-guide"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('新手四步引导')

    // 点错配条的「换成推荐纸型」→ mismatch 消失 → 引导恢复完整态
    const switchBtn = banner.findAll('button').find((b) => b.text().includes('推荐纸型'))
    expect(switchBtn).toBeTruthy()
    await switchBtn!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="first-visit-guide"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="first-visit-guide-compact"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('第 352 轮：Studio 手机端首屏引导默认折叠', () => {
  beforeEach(async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(max-width: 767px)',
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    )
    localStorage.clear()
    setActivePinia(createPinia())
    studioGuideDismissed.value = false
    await setLocale('zh')
  })

  it('<md 且无错配：引导为单行折叠态并带演示数据按钮；点击演示按钮后导入数据、按钮消失、仍保持折叠', async () => {
    const wrapper = await mountStudio()
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="first-visit-guide-compact"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="first-visit-guide"]').exists()).toBe(false)
    const demo = wrapper.get('[data-testid="first-visit-guide-demo"]')
    await demo.trigger('click')
    await wrapper.vm.$nextTick()
    expect(useWorkspaceStore().excel.rows.length).toBeGreaterThan(0)
    expect(wrapper.find('[data-testid="first-visit-guide-demo"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="first-visit-guide-compact"]').exists()).toBe(true)
    wrapper.unmount()
  })
})

describe('第 355 轮：Studio 侧栏步骤编号 1-2-3-4 连续', () => {
  beforeEach(async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    )
    localStorage.clear()
    setActivePinia(createPinia())
    studioGuideDismissed.value = true
    await setLocale('zh')
  })

  it('无数据时渲染折叠占位「3 字段映射 · 导入名单后出现」；导入名单后占位消失、真正的 MappingPanel 出现', async () => {
    const wrapper = await mountStudio()
    const placeholder = wrapper.find('[data-testid="mapping-placeholder"]')
    expect(placeholder.exists()).toBe(true)
    expect(placeholder.text().replace(/\s+/g, ' ')).toBe('3字段映射 · 导入名单后出现')
    expect(placeholder.find('.step-chip').text()).toBe('3')
    expect(wrapper.findComponent({ name: 'MappingPanel' }).exists()).toBe(false)

    useWorkspaceStore().excel.rows = [{ 姓名: '张伟' }]
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="mapping-placeholder"]').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'MappingPanel' }).exists()).toBe(true)
    wrapper.unmount()
  })

  it('en：占位文案为英文', async () => {
    await setLocale('en')
    const wrapper = await mountStudio()
    const placeholder = wrapper.find('[data-testid="mapping-placeholder"]')
    expect(placeholder.text().replace(/\s+/g, ' ')).toBe('3Field mapping · appears after you import a list')
    wrapper.unmount()
  })
})
