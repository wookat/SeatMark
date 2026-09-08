// @vitest-environment jsdom
/**
 * 第 367 轮：粘贴弹窗 —— 首行像列名但未被关键词识别时显示 amber 警示；
 * 有数据态出现「重新粘贴」入口并复用同一弹窗。
 */
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import DataImportPanel from '@/components/studio/DataImportPanel.vue'
import { createAppRouter } from '@/router'
import { useWorkspaceStore } from '@/stores/workspace'
import { PASTE_PARSE_DEBOUNCE_MS } from '@/utils/importLimits'

describe('第 367 轮：粘贴表头 amber 警示 / 重新粘贴', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  function mountPanel() {
    const wrapper = mount(DataImportPanel, {
      attachTo: document.body,
      global: { plugins: [createAppRouter()], stubs: { RouterLink: true } },
    })
    return wrapper
  }

  async function openPasteVia(wrapper: ReturnType<typeof mountPanel>, label: string) {
    const btn = wrapper.findAll('button').find((b) => b.text().includes(label))!
    expect(btn, `button ${label}`).toBeTruthy()
    await btn.trigger('click')
    await wrapper.vm.$nextTick()
    return document.body.querySelector<HTMLTextAreaElement>('textarea[aria-label="粘贴名单内容"]')!
  }

  async function type(textarea: HTMLTextAreaElement, value: string) {
    textarea.value = value
    textarea.dispatchEvent(new Event('input'))
    await vi.advanceTimersByTimeAsync(PASTE_PARSE_DEBOUNCE_MS + 10)
  }

  it('首行是不在关键词表内的短词（来宾/身份/备注）→ 出现 amber 警示并列出首行内容', async () => {
    const wrapper = mountPanel()
    const textarea = await openPasteVia(wrapper, '粘贴名单')
    await type(textarea, '来宾\t身份\t备注\n张伟\t校友\t无\n王芳\t家长\t无')
    await wrapper.vm.$nextTick()
    const hint = document.body.querySelector('[data-testid="paste-header-hint"]')
    expect(hint).toBeTruthy()
    expect(hint!.textContent).toContain('来宾、身份、备注')
    expect(hint!.className).toContain('amber')
    wrapper.unmount()
  })

  it('首行被关键词识别为表头，或首行是普通数据行 → 不出现警示', async () => {
    const wrapper = mountPanel()
    const textarea = await openPasteVia(wrapper, '粘贴名单')
    await type(textarea, '与会人员\t头衔\t公司\n张伟\t总监\t甲公司')
    await wrapper.vm.$nextTick()
    expect(document.body.querySelector('[data-testid="paste-header-hint"]')).toBeNull()

    await type(textarea, '张伟\t高三（1）班\t01\n王芳\t高三（1）班\t02')
    await wrapper.vm.$nextTick()
    expect(document.body.querySelector('[data-testid="paste-header-hint"]')).toBeNull()
    wrapper.unmount()
  })

  it('有数据态显示「重新粘贴」，点击打开同一粘贴弹窗，导入按钮提示覆盖', async () => {
    const workspace = useWorkspaceStore()
    workspace.applyDataset('旧名单', ['姓名'], [{ 姓名: '旧人' }])
    const wrapper = mountPanel()
    await wrapper.vm.$nextTick()
    const textarea = await openPasteVia(wrapper, '重新粘贴')
    expect(textarea).toBeTruthy()
    const importBtn = [...document.body.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('导入并覆盖当前名单'),
    )
    expect(importBtn).toBeTruthy()
    wrapper.unmount()
  })
})
