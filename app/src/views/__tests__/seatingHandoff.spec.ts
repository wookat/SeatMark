// @vitest-environment jsdom
/**
 * 第 351 轮：座位表 → 标签工坊字段带入补全——
 * handoff 行新增「考场」列，标准考场版自动映射 姓名/座位号/考场 三项命中，
 * 第 354 轮：「考场」列来自可选的考场号输入（不再 = 标题），为空时省略该列；「班级」仍 = 标题。
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
import LabelCard from '@/components/label/LabelCard.vue'
import { autoMapFields } from '@/utils/autoMap'
import { pickHandoffTemplate } from '@/utils/handoffTemplate'
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
  async function mountSeating() {
    const router = await makeRouter('/seating')
    const wrapper = mount(SeatingView, {
      global: { plugins: [router], stubs: { Teleport: true, Transition: true } },
      attachTo: document.body,
    })
    await wrapper.vm.$nextTick()
    await wrapper.get('textarea').setValue(['张伟', '李娜', '王芳'].join('\n'))
    await flushPromises()
    return { router, wrapper }
  }

  async function clickHandoff(wrapper: ReturnType<typeof mount>) {
    const button = wrapper.findAll('button').find((b) => b.text().includes('一键生成对应桌贴'))
    expect(button).toBeTruthy()
    await button!.trigger('click')
    await flushPromises()
    const raw = localStorage.getItem(SEATING_HANDOFF_KEY)
    expect(raw).toBeTruthy()
    return JSON.parse(raw!) as SeatingHandoff
  }

  it('填了考场号：handoff 每行 考场 = 考场号，班级 = 标题', async () => {
    const { router, wrapper } = await mountSeating()
    await wrapper.get('[data-testid="seating-room-no"]').setValue(' 03 ')

    const handoff = await clickHandoff(wrapper)
    expect(handoff.roomNo).toBe('03')
    expect(handoff.rows).toHaveLength(3)
    expect(Object.keys(handoff.rows[0]!)).toEqual(HANDOFF_HEADERS)
    for (const row of handoff.rows) {
      expect(row['考场']).toBe('03')
      expect(row['班级']).toBe(handoff.title)
      expect(row['考场']).not.toBe(handoff.title)
      expect(row['姓名']).toBeTruthy()
    }
    expect(router.currentRoute.value.fullPath).toBe('/studio?from=seating')
    wrapper.unmount()
  })

  it('考场号为空（默认）：handoff 省略 考场 列，班级 仍 = 标题', async () => {
    const { wrapper } = await mountSeating()
    expect((wrapper.get('[data-testid="seating-room-no"]').element as HTMLInputElement).value).toBe('')

    const handoff = await clickHandoff(wrapper)
    expect(handoff.roomNo).toBeUndefined()
    expect(Object.keys(handoff.rows[0]!)).toEqual(['姓名', '座位号', '排', '列', '班级'])
    for (const row of handoff.rows) {
      expect('考场' in row).toBe(false)
      expect(row['班级']).toBe(handoff.title)
    }
    wrapper.unmount()
  })

  it('考场号随 seating 本地状态持久化', async () => {
    const { wrapper } = await mountSeating()
    await wrapper.get('[data-testid="seating-room-no"]').setValue('12')
    await flushPromises()
    const state = JSON.parse(localStorage.getItem('seatmark.seating-state.v1')!) as { roomNo?: string }
    expect(state.roomNo).toBe('12')
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

  // 第 364 轮：考场号为空时标准考场版只能对上 2/4，改为换到能全部对上的座位号贴（原 r354 用例断言为不切模板、考场位留空）
  it('考场号为空的 handoff（无 考场 列）带入标准考场版：切到座位号贴，字段全部对上、无未映射 toast，预览无「（空）」', async () => {
    const handoff: SeatingHandoff = {
      title: '高三(2)班 期末考试',
      rows: [{ 姓名: '张伟', 座位号: '1', 排: '1', 列: '1', 班级: '高三(2)班 期末考试' }],
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
    expect(workspace.template.id).toBe('seatOnly')
    expect(workspace.mapping.name).toBe('姓名')
    expect(workspace.mapping.seatNo).toBe('座位号')
    expect(workspace.unmappedFields).toHaveLength(0)
    expect(toast.toasts.some((t) => t.title === '已切换到「座位号贴」：2 个字段全部对上名单列')).toBe(true)
    expect(toast.toasts.some((t) => t.title === '已切换到课桌贴模板')).toBe(false)
    expect(toast.toasts.some((t) => t.title.includes('未映射'))).toBe(false)

    const card = mount(LabelCard, {
      props: {
        template: workspace.template,
        texts: Object.fromEntries(
          workspace.template.fields
            .filter((f) => f.type === 'text')
            .map((f) => [f.id, workspace.fieldText(workspace.excel.rows[0]!, f.id)]),
        ),
        unmappedFields: new Set(workspace.unmappedFields.map((f) => f.id)),
      },
    })
    expect(card.text()).not.toContain('（空）')
    expect(card.text()).toContain('张伟')
    card.unmount()
    wrapper.unmount()
  })

  it('考场号非空：标准考场版 姓名/座位号/考场 3 项对上（仅准考证号空）时不退到座位号贴（不丢考场列）', async () => {
    const handoff: SeatingHandoff = {
      title: '高三(2)班',
      rows: [{ 姓名: '张伟', 座位号: '1', 排: '1', 列: '1', 班级: '高三(2)班', 考场: '03' }],
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
    expect(workspace.mapping.room).toBe('考场')
    expect(toast.toasts.some((t) => t.title.startsWith('已切换到'))).toBe(false)
    wrapper.unmount()
  })

  it('pickHandoffTemplate：当前全映射不切；候选需全映射且不少于当前已对上的列数，取 mappable 最多者', () => {
    const byId = (id: string) => defaultTemplates.find((t) => t.id === id)!
    const standard = byId('standard')
    const seatOnly = byId('seatOnly')
    const desk = byId('deskName')
    const noRoom = ['姓名', '座位号', '排', '列', '班级']
    // 无考场列：standard 2/4 → seatOnly 2/2；deskName 学号对不上不入选
    expect(pickHandoffTemplate([standard, seatOnly, desk], noRoom)?.template.id).toBe('seatOnly')
    expect(pickHandoffTemplate([standard, desk], noRoom)).toBeNull()
    // 有考场列：standard 3/4，seatOnly 只能对 2 列 → 不切
    expect(pickHandoffTemplate([standard, seatOnly, desk, standard], [...noRoom, '考场'])).toBeNull()
    // 当前已全映射 → null
    expect(pickHandoffTemplate([seatOnly, standard, desk], noRoom)).toBeNull()
    // 当前 deskName（学号空）→ seatOnly；若名单含学号与考场、准考证号则 standard 4/4 最多
    expect(pickHandoffTemplate([desk, seatOnly, standard], noRoom)?.template.id).toBe('seatOnly')
    expect(pickHandoffTemplate([seatOnly, desk, standard], ['姓名', '座位号', '考场', '准考证号', '学号'])).toBeNull()
    expect(
      pickHandoffTemplate([desk, seatOnly, standard], ['姓名', '座位号', '考场', '准考证号'])?.template.id,
    ).toBe('standard')
    expect(pickHandoffTemplate([], noRoom)).toBeNull()
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
