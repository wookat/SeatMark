// @vitest-environment jsdom
/**
 * 第 353 轮：模板面板折叠张数按断点取值——<md 手机只渲染 1 张（已选模板），
 * 让「导入数据」面板进入 390 首屏；≥md 仍渲染 3 张；「浏览全部 N 款模板」按钮逻辑不变。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import TemplatePickerPanel from '@/components/studio/TemplatePickerPanel.vue'
import { setLocale } from '@/i18n'
import { useTemplateLibrary } from '@/stores/templateLibrary'
import { useWorkspaceStore } from '@/stores/workspace'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const PHONE_QUERY = '(max-width: 767px)'

function stubMatchMedia(phone: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: phone && query === PHONE_QUERY,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  )
}

async function mountPanel() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/studio')
  await router.isReady()
  const wrapper = mount(TemplatePickerPanel, { global: { plugins: [router] } })
  await wrapper.vm.$nextTick()
  return wrapper
}

/** 面板折叠区（非弹窗）渲染的模板卡 */
function collapsedCards(wrapper: Awaited<ReturnType<typeof mountPanel>>) {
  return wrapper.findAll('article')
}

beforeEach(async () => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  localStorage.clear()
  setActivePinia(createPinia())
  await setLocale('zh')
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('第 353 轮：TemplatePickerPanel 折叠张数按断点取值', () => {
  it('<md：只渲染 1 张 article 卡，且为当前已选模板；「浏览全部 N 款模板」按钮仍显示', async () => {
    stubMatchMedia(true)
    const wrapper = await mountPanel()
    const workspace = useWorkspaceStore()
    const library = useTemplateLibrary()

    const cards = collapsedCards(wrapper)
    expect(cards).toHaveLength(1)
    expect(cards[0]!.attributes('class')).toContain('border-brand-500')
    expect(cards[0]!.text()).toContain(workspace.template.name)

    const browseAll = wrapper.findAll('button').find((b) => b.text().includes('浏览全部'))
    expect(browseAll).toBeDefined()
    expect(browseAll!.text()).toContain(String(library.allTemplates.length))
    wrapper.unmount()
  })

  it('<md：切换到排序靠后的模板后，唯一一张卡随之换成新选中的模板', async () => {
    stubMatchMedia(true)
    const wrapper = await mountPanel()
    const workspace = useWorkspaceStore()
    const library = useTemplateLibrary()
    const target = library.allTemplates[library.allTemplates.length - 1]!
    workspace.selectTemplate(target)
    await wrapper.vm.$nextTick()

    const cards = collapsedCards(wrapper)
    expect(cards).toHaveLength(1)
    expect(cards[0]!.text()).toContain(target.name)
    wrapper.unmount()
  })

  it('≥md：仍渲染 3 张 article 卡', async () => {
    stubMatchMedia(false)
    const wrapper = await mountPanel()
    expect(collapsedCards(wrapper)).toHaveLength(3)
    wrapper.unmount()
  })
})
