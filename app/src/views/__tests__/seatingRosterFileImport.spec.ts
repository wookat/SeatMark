// @vitest-environment jsdom
/**
 * 第 348 轮：/seating 名单文件上传入口（TXT/CSV/Excel）——与 /banquet 共用 useGuestFileImport，
 * 全程浏览器本地解析、不触发任何网络请求；Excel 有表头/无表头两种输入都映射到座位名单。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import * as XLSX from 'xlsx'

import { readGuestFile } from '@/composables/useGuestFileImport'
import SeatingView from '@/views/SeatingView.vue'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function xlsxFile(matrix: string[][], name = 'roster.xlsx'): File {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(matrix), 'Sheet1')
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new File([bytes], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

async function mountSeating() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/seating', component: SeatingView },
      { path: '/studio', component: { template: '<div />' } },
    ],
  })
  await router.push('/seating')
  await router.isReady()
  const wrapper = mount(SeatingView, {
    global: { plugins: [router], stubs: { Teleport: true, Transition: true } },
    attachTo: document.body,
  })
  await wrapper.vm.$nextTick()
  return wrapper
}

async function uploadFile(wrapper: Awaited<ReturnType<typeof mountSeating>>, file: File) {
  const input = wrapper.get('[data-testid="seating-roster-file"]').element as HTMLInputElement
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  await wrapper.get('[data-testid="seating-roster-file"]').trigger('change')
  await flushPromises()
  await flushPromises()
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  Element.prototype.scrollIntoView = vi.fn()
  localStorage.clear()
  setActivePinia(createPinia())
  vi.restoreAllMocks()
})

describe('readGuestFile', () => {
  it('.xlsx 走表格解析，.txt/.csv 走文本解码（UTF-8 BOM 去除）', async () => {
    const table = await readGuestFile(xlsxFile([['姓名', '性别'], ['张三', '男']]))
    expect(table.kind).toBe('table')
    if (table.kind === 'table') {
      expect(table.headers).toEqual(['姓名', '性别'])
      expect(table.rows).toEqual([{ 姓名: '张三', 性别: '男' }])
    }
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('张三 男\n李四 女')])
    const text = await readGuestFile(new File([bom], 'roster.txt', { type: 'text/plain' }))
    expect(text).toEqual({ kind: 'text', text: '张三 男\n李四 女' })
  })
})

describe('第 348 轮：SeatingView 名单文件上传', () => {
  it('名单区有且仅有 1 个 file input，accept 与宴会页同规格，并有「上传名单文件」按钮', async () => {
    const wrapper = await mountSeating()
    const inputs = wrapper.findAll('input[type="file"]')
    expect(inputs).toHaveLength(1)
    expect(inputs[0]!.attributes('accept')).toBe('.txt,.csv,.xlsx,.xls,text/plain,text/csv')
    expect(wrapper.get('[data-testid="seating-upload-roster"]').text()).toBe('上传名单文件')
    const clickSpy = vi.spyOn(inputs[0]!.element as HTMLInputElement, 'click')
    await wrapper.get('[data-testid="seating-upload-roster"]').trigger('click')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('上传 30 行带表头 .xlsx：名单行数 30、性别列被识别，且不发出任何网络请求', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const wrapper = await mountSeating()
    const matrix: string[][] = [['学号', '姓名', '性别']]
    for (let i = 1; i <= 30; i++) {
      matrix.push([`2024${String(i).padStart(3, '0')}`, `学生${i}`, i % 2 ? '男' : '女'])
    }
    await uploadFile(wrapper, xlsxFile(matrix))

    const textarea = wrapper.get('textarea').element as HTMLTextAreaElement
    expect(textarea.value.split('\n')).toHaveLength(31)
    expect(wrapper.text()).toMatch(/已输入\s*30\s*名学生/)
    expect(wrapper.get('[data-testid="roster-hints"]').text()).toContain('识别到性别列')
    expect(fetchSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('上传无表头 .xlsx（首行即数据）：首行不丢，全部计入名单', async () => {
    const wrapper = await mountSeating()
    await uploadFile(wrapper, xlsxFile([['张三', '男'], ['李四', '女'], ['王五', '男']]))
    expect(wrapper.text()).toMatch(/已输入\s*3\s*名学生/)
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe(
      '张三\t男\n李四\t女\n王五\t男',
    )
    wrapper.unmount()
  })

  it('上传 .txt：文本追加到已有名单后面', async () => {
    const wrapper = await mountSeating()
    await wrapper.get('textarea').setValue('赵六 男')
    const bytes = new TextEncoder().encode('张三 男\n李四 女\n')
    await uploadFile(wrapper, new File([bytes], 'roster.txt', { type: 'text/plain' }))
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe(
      '赵六 男\n张三 男\n李四 女',
    )
    expect(wrapper.text()).toMatch(/已输入\s*3\s*名学生/)
    wrapper.unmount()
  })
})
