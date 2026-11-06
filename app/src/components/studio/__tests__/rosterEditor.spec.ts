// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import RosterEditorDialog from '@/components/studio/RosterEditorDialog.vue'
import { setLocale } from '@/i18n'
import { useWorkspaceStore } from '@/stores/workspace'

const CJK = /[\u4e00-\u9fff]/

function queryAll<T extends Element = HTMLElement>(sel: string): T[] {
  return Array.from(document.body.querySelectorAll<T>(sel))
}

async function setInput(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input'))
  await Promise.resolve()
}

async function mountEditor() {
  const wrapper = mount(RosterEditorDialog, {
    props: { open: true },
    attachTo: document.body,
  })
  await wrapper.vm.$nextTick()
  return wrapper
}

describe('RosterEditorDialog 在线编辑名单', () => {
  beforeEach(async () => {
    localStorage.clear()
    setActivePinia(createPinia())
    await setLocale('zh')
  })

  afterEach(async () => {
    document.body.innerHTML = ''
    await setLocale('zh')
  })

  it('空数据打开：按当前模板可映射字段预置列名 + 5 个空行', async () => {
    const workspace = useWorkspaceStore()
    const wrapper = await mountEditor()
    const seed = [...new Set(workspace.mappableFields.map((f) => f.label))].slice(0, 8)
    const headerInputs = queryAll<HTMLInputElement>('thead input')
    expect(headerInputs.length).toBe(seed.length)
    expect(headerInputs.map((i) => i.value)).toEqual(seed)
    expect(queryAll('tbody tr').length).toBe(5)
    wrapper.unmount()
  })

  it('已有名单打开：载入现有表头与行，可整体修改', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    const wrapper = await mountEditor()
    const headerInputs = queryAll<HTMLInputElement>('thead input')
    expect(headerInputs.map((i) => i.value)).toEqual(workspace.excel.headers)
    expect(queryAll('tbody tr').length).toBe(workspace.excel.rows.length)
    wrapper.unmount()
  })

  it('保存：写入 workspace.excel；空行被丢弃、重名列自动加后缀', async () => {
    const workspace = useWorkspaceStore()
    const wrapper = await mountEditor()
    const firstRowInputs = queryAll<HTMLInputElement>('tbody tr')[0]!.querySelectorAll('input')
    await setInput(firstRowInputs[0]!, '测试甲')
    const headerInputs = queryAll<HTMLInputElement>('thead input')
    const firstHeader = headerInputs[0]!.value
    if (headerInputs.length > 1) await setInput(headerInputs[1]!, firstHeader)
    document.body.querySelector<HTMLButtonElement>('[data-testid="roster-save"]')!.click()
    await wrapper.vm.$nextTick()
    expect(workspace.excel.fileName).toBe('在线编辑名单')
    expect(workspace.excel.rows.length).toBe(1)
    expect(workspace.excel.rows[0]![firstHeader]).toBe('测试甲')
    expect(new Set(workspace.excel.headers).size).toBe(workspace.excel.headers.length)
    wrapper.unmount()
  })

  it('加行/删行/加列保持网格一致', async () => {
    const wrapper = await mountEditor()
    const btnByText = (s: string) =>
      queryAll<HTMLButtonElement>('button').find((b) => b.textContent?.includes(s))!
    btnByText('添加行').click()
    await wrapper.vm.$nextTick()
    expect(queryAll('tbody tr').length).toBe(6)
    btnByText('添加列').click()
    await wrapper.vm.$nextTick()
    const colCount = queryAll('thead input').length
    expect(queryAll<HTMLTableRowElement>('tbody tr')[0]!.querySelectorAll('input').length).toBe(colCount)
    const lastRow = queryAll<HTMLTableRowElement>('tbody tr').at(-1)!
    const lastRowButtons = Array.from(lastRow.querySelectorAll('button'))
    lastRowButtons.at(-1)!.click()
    await wrapper.vm.$nextTick()
    expect(queryAll('tbody tr').length).toBe(5)
    wrapper.unmount()
  })

  it('全空行保存被拒绝，workspace 未变', async () => {
    const workspace = useWorkspaceStore()
    const wrapper = await mountEditor()
    document.body.querySelector<HTMLButtonElement>('[data-testid="roster-save"]')!.click()
    await wrapper.vm.$nextTick()
    expect(workspace.excel.rows.length).toBe(0)
    wrapper.unmount()
  })

  it('en：界面词无 CJK 残留', async () => {
    await setLocale('en')
    const wrapper = await mountEditor()
    for (const b of queryAll<HTMLElement>('button')) expect(CJK.test(b.textContent ?? '')).toBe(false)
    expect(document.body.textContent).toContain('Online roster editor')
    wrapper.unmount()
  })
})
