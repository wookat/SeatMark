// @vitest-environment jsdom
/**
 * 第 351 轮：座位表 → 标签工坊字段带入补全——
 * handoff 行新增「考场」列（= 座位表标题），标准考场版自动映射 姓名/座位号/考场 三项命中，
 * /studio?from=seating 带入后对仍未映射的字段（准考证号）追加 toast.info 提示。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { defaultTemplates } from '@/data/defaultTemplates'
import { setLocale } from '@/i18n'
import { useToastStore } from '@/stores/toast'
import { useWorkspaceStore } from '@/stores/workspace'
import { autoMapFields } from '@/utils/autoMap'
import { SEATING_HANDOFF_KEY, type SeatingHandoff } from '@/utils/seating'
import SeatingView from '@/views/SeatingView.vue'
import StudioView from '@/views/StudioView.vue'

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

const HANDOFF_HEADERS = ['姓名', '座位号', '排', '列', '班级', '考场']

beforeEach(async () => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  )
  Element.prototype.scrollIntoView = vi.fn()
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
  await setLocale('zh')
})

describe('第 351 轮：座位表 → 标签工坊字段带入', () => {
  it('SeatingView「一键生成对应桌贴」写入的 handoff 每行含 考场 列（= 标题）', async () => {
    const router = await makeRouter('/seating')
    const wrapper = mount(SeatingView, {
      global: { plugins: [router], stubs: { Teleport: true, Transition: true } },
      attachTo: document.body,
    })
    await wrapper.vm.$nextTick()
    await wrapper.get('textarea').setValue(['张伟', '李娜', '王芳'].join('\n'))
    await flushPromises()

    const button = wrapper.findAll('button').find((b) => b.text().includes('一键生成对应桌贴'))
    expect(button).toBeTruthy()
    await button!.trigger('click')
    await flushPromises()

    const raw = localStorage.getItem(SEATING_HANDOFF_KEY)
    expect(raw).toBeTruthy()
    const handoff = JSON.parse(raw!) as SeatingHandoff
    expect(handoff.rows).toHaveLength(3)
    expect(Object.keys(handoff.rows[0]!)).toEqual(HANDOFF_HEADERS)
    for (const row of handoff.rows) {
      expect(row['考场']).toBe(handoff.title)
      expect(row['班级']).toBe(handoff.title)
      expect(row['姓名']).toBeTruthy()
    }
    expect(router.currentRoute.value.fullPath).toBe('/studio?from=seating')
    wrapper.unmount()
  })

  it('标准考场版对 handoff 表头自动映射：name/seatNo/room 命中，examId 未映射', () => {
    const standard = defaultTemplates.find((t) => t.id === 'standard')!
    const mapping = autoMapFields(standard.fields, HANDOFF_HEADERS)
    expect(mapping.name).toBe('姓名')
    expect(mapping.seatNo).toBe('座位号')
    expect(mapping.room).toBe('考场')
    expect(mapping.examId).toBeUndefined()
  })

  it('/studio?from=seating 带入后：标准考场版 3/4 映射不自动切模板，并 toast.info 提示 1 个字段未映射（准考证号）', async () => {
    const handoff: SeatingHandoff = {
      title: '高三(2)班',
      rows: [
        { 姓名: '张伟', 座位号: '1', 排: '1', 列: '1', 班级: '高三(2)班', 考场: '高三(2)班' },
        { 姓名: '李娜', 座位号: '2', 排: '1', 列: '2', 班级: '高三(2)班', 考场: '高三(2)班' },
      ],
    }
    localStorage.setItem(SEATING_HANDOFF_KEY, JSON.stringify(handoff))
    const router = await makeRouter('/studio?from=seating')
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
    await flushPromises()

    const workspace = useWorkspaceStore()
    const toast = useToastStore()
    expect(workspace.template.id).toBe('standard')
    expect(workspace.mapping.name).toBe('姓名')
    expect(workspace.mapping.seatNo).toBe('座位号')
    expect(workspace.mapping.room).toBe('考场')
    expect(workspace.unmappedFields.map((f) => f.id)).toEqual(['examId'])
    expect(toast.toasts.some((t) => t.title === '已切换到课桌贴模板')).toBe(false)
    expect(toast.toasts.some((t) => t.title === '座位表名单已带入')).toBe(true)

    const info = toast.toasts.find((t) => t.type === 'info' && t.title.includes('未映射'))
    expect(info?.title).toBe('还有 1 个字段未映射：准考证号')
    expect(info?.text).toContain('「字段映射」')
    expect(localStorage.getItem(SEATING_HANDOFF_KEY)).toBeNull()
    wrapper.unmount()
  })

  it('全部字段命中时不弹未映射 toast', async () => {
    const handoff: SeatingHandoff = {
      title: '第 3 考场',
      rows: [{ 姓名: '张伟', 座位号: '1', 排: '1', 列: '1', 班级: '第 3 考场', 考场: '第 3 考场', 准考证号: 'A001' }],
    }
    localStorage.setItem(SEATING_HANDOFF_KEY, JSON.stringify(handoff))
    const router = await makeRouter('/studio?from=seating')
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
    await flushPromises()
    const workspace = useWorkspaceStore()
    const toast = useToastStore()
    expect(workspace.unmappedFields).toHaveLength(0)
    expect(toast.toasts.some((t) => t.title.includes('未映射'))).toBe(false)
    wrapper.unmount()
  })
})
