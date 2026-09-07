// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { nextTick } from 'vue'
import { setLocale } from '@/i18n'
import { defaultTemplates } from '@/data/defaultTemplates'
import AiDesignDialog from '@/components/designer/AiDesignDialog.vue'
import TemplateDesigner from '@/components/designer/TemplateDesigner.vue'

const CJK_RE = /[\u4e00-\u9fff]/

function visibleText(el: Element) {
  return Array.from(el.querySelectorAll('*'))
    .map((node) => [
      node.textContent ?? '',
      node.getAttribute('placeholder') ?? '',
      node.getAttribute('aria-label') ?? '',
      node.getAttribute('title') ?? '',
    ])
    .flat()
    .join('\n')
}

function stubBrowserApis() {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', RO)
  vi.stubGlobal('IntersectionObserver', RO)
  if (!('matchMedia' in window)) {
    vi.stubGlobal(
      'matchMedia',
      () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    )
  }
  if (!('PointerEvent' in window)) {
    vi.stubGlobal('PointerEvent', MouseEvent)
  }
}

async function mountDesigner() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  const wrapper = mount(TemplateDesigner, {
    attachTo: document.body,
    props: { initial: defaultTemplates[0]! },
    global: { plugins: [router], stubs: { Transition: true, TransitionGroup: true } },
  })
  await nextTick()
  return wrapper
}

describe('r358 P1-2 · designer EN locale', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    stubBrowserApis()
    await setLocale('en')
  })

  afterEach(async () => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    await setLocale('zh')
  })

  it('renders AiDesignDialog with no CJK visible text in EN', async () => {
    const wrapper = mount(AiDesignDialog, {
      attachTo: document.body,
      props: { open: true, labelWidth: 90, labelHeight: 54 },
      global: { stubs: { Transition: true } },
    })
    await nextTick()
    const text = visibleText(document.body)
    expect(text).toContain('AI label design')
    expect(text).toContain('Generate design')
    expect(text).toContain('Cancel')
    const textarea = document.body.querySelector('textarea')
    expect(textarea?.textContent ?? '').not.toMatch(CJK_RE)
    expect(text).not.toMatch(CJK_RE)
    wrapper.unmount()
  })

  it('renders designer toolbar + field properties + EN notice without CJK', async () => {
    const wrapper = await mountDesigner()
    const notice = wrapper.find('[data-testid="designer-en-notice"]')
    expect(notice.exists()).toBe(true)
    expect(notice.text()).toBe('Some advanced designer panels are still in Chinese.')

    const header = wrapper.find('[data-testid="designer-header"]')
    expect(header.exists()).toBe(true)
    expect(visibleText(header.element)).not.toMatch(CJK_RE)
    expect(visibleText(header.element)).toContain('Save')

    const toolbar = wrapper.find('[data-testid="designer-toolbar"]')
    expect(toolbar.exists()).toBe(true)
    expect(visibleText(toolbar.element)).not.toMatch(CJK_RE)
    expect(visibleText(toolbar.element)).toContain('AI design')

    const props = wrapper.find('[data-testid="designer-field-props-title"]')
    expect(props.exists()).toBe(true)
    // 标题形如「Field properties · <字段名>」，字段名来自模板数据，只校验控件文案
    expect(props.text().split('·')[0]).toContain('Field properties')
    expect(props.text().split('·')[0]).not.toMatch(CJK_RE)

    const fieldList = wrapper.find('[data-testid="designer-field-list"]')
    expect(fieldList.exists()).toBe(true)
    // 字段列表里的字段名来自模板数据（中文示例模板），只断言控件文案
    const controls = Array.from(fieldList.element.querySelectorAll('h2, button, p'))
      .map((el) => `${el.getAttribute('aria-label') ?? ''}\n${el.getAttribute('title') ?? ''}`)
      .join('\n')
    expect(controls).not.toMatch(CJK_RE)
    wrapper.unmount()
  })

  it('shows the EN-only notice only in EN locale', async () => {
    await setLocale('zh')
    const wrapper = await mountDesigner()
    expect(wrapper.find('[data-testid="designer-en-notice"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="designer-header"]').text()).toContain('保存')
    wrapper.unmount()
  })
})
