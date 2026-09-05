// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import LabelCard from '@/components/label/LabelCard.vue'
import MappingPanel from '@/components/studio/MappingPanel.vue'
import TemplatePickerPanel from '@/components/studio/TemplatePickerPanel.vue'
import { defaultTemplates } from '@/data/defaultTemplates'
import { demoExcelFor, localizeDemoExcel } from '@/data/demoDatasets'
import { labelPapers } from '@/data/labelPapers'
import { TEMPLATE_SUBCATEGORIES } from '@/data/templateTaxonomy'
import { setLocale, t } from '@/i18n'
import { createAppRouter } from '@/router'
import { useWorkspaceStore } from '@/stores/workspace'

const CJK = /[\u4e00-\u9fff]/

function mountWithRouter(component: typeof TemplatePickerPanel | typeof MappingPanel) {
  const router = createAppRouter()
  return mount(component, {
    global: { plugins: [router], stubs: { TemplateThumb: true, RouterLink: true } },
  })
}

describe('en 工坊：模板选择器与字段映射面板不含 CJK', () => {
  beforeEach(async () => {
    localStorage.clear()
    sessionStorage.clear()
    setActivePinia(createPinia())
    await setLocale('en')
  })

  afterEach(async () => {
    await setLocale('zh')
  })

  it('内置模板 name / description / scenario、纸型名、分类名全部有英文映射', () => {
    const untranslated = (list: string[]) =>
      [...new Set(list)].filter((s) => CJK.test(s) && CJK.test(t(s)))
    expect(untranslated(defaultTemplates.map((x) => x.name))).toEqual([])
    expect(untranslated(defaultTemplates.map((x) => x.description))).toEqual([])
    expect(untranslated(defaultTemplates.map((x) => x.scenario ?? ''))).toEqual([])
    expect(
      untranslated(defaultTemplates.flatMap((x) => x.fields.map((f) => f.label || f.id))),
    ).toEqual([])
    expect(untranslated(labelPapers.map((p) => p.name))).toEqual([])
    expect(
      untranslated(Object.values(TEMPLATE_SUBCATEGORIES).flat().map((s) => s.name)),
    ).toEqual([])
  })

  it('TemplatePickerPanel（含浏览全部弹窗的分类与卡片）渲染文本无 CJK', async () => {
    const wrapper = mountWithRouter(TemplatePickerPanel)
    expect(wrapper.text(), wrapper.text()).not.toMatch(CJK)
    const browseAll = wrapper.findAll('button').find((b) => b.text().includes('Browse all'))
    expect(browseAll, 'browse-all button').toBeTruthy()
    await browseAll!.trigger('click')
    await wrapper.vm.$nextTick()
    const modalText = document.body.textContent ?? ''
    expect(modalText).toContain('All templates')
    expect(modalText, modalText.slice(0, 400)).not.toMatch(CJK)
    wrapper.unmount()
  })

  it('MappingPanel 在载入演示数据后字段名、表头与示例值均为英文', async () => {
    const workspace = useWorkspaceStore()
    workspace.useDemoData()
    const wrapper = mountWithRouter(MappingPanel)
    await wrapper.vm.$nextTick()
    expect(wrapper.text(), wrapper.text()).not.toMatch(CJK)
    for (const opt of wrapper.findAll('option')) expect(opt.text(), opt.text()).not.toMatch(CJK)
    expect(workspace.excel.headers.join(' ')).not.toMatch(CJK)
    // 映射必须指向翻译后的表头，否则预览会变空
    for (const header of Object.values(workspace.mapping)) {
      if (header) expect(workspace.excel.headers).toContain(header)
    }
    wrapper.unmount()
  })

  it('所有内置模板的演示数据在 en 下表头与单元格均无 CJK', () => {
    const offenders: string[] = []
    for (const template of defaultTemplates) {
      const demo = localizeDemoExcel(demoExcelFor(template), t)
      for (const h of demo.headers) if (CJK.test(h)) offenders.push(`${template.id} header ${h}`)
      for (const row of demo.rows) {
        for (const v of Object.values(row)) if (CJK.test(v)) offenders.push(`${template.id} ${v}`)
      }
      if (CJK.test(demo.sheetName)) offenders.push(`${template.id} sheet ${demo.sheetName}`)
      if (CJK.test(demo.fileName)) offenders.push(`${template.id} file ${demo.fileName}`)
    }
    expect([...new Set(offenders)]).toEqual([])
  })

  it('模板缩略图（LabelCard sample-mode）在 en 下样例文字无 CJK（模板自带固定文字除外）', () => {
    const offenders: string[] = []
    for (const template of defaultTemplates) {
      const wrapper = mount(LabelCard, { props: { template, sampleMode: true } })
      let text = wrapper.text()
      for (const f of template.fields) if (f.fixedText) text = text.split(f.fixedText).join(' ')
      if (CJK.test(text)) offenders.push(`${template.id}: ${text.slice(0, 60)}`)
      wrapper.unmount()
    }
    expect([...new Set(offenders)]).toEqual([])
  })
})
