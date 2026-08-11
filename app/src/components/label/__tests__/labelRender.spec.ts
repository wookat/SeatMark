import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import LabelCard from '@/components/label/LabelCard.vue'
import LabelSheet from '@/components/label/LabelSheet.vue'
import { defaultTemplates } from '@/data/defaultTemplates'
import type { DataRow } from '@/types/template'
import { cloneTemplate } from '@/utils/layout'

const standard = defaultTemplates.find((t) => t.id === 'standard')!
const withPhoto = defaultTemplates.find((t) => t.id === 'withPhoto')!
const contrast = defaultTemplates.find((t) => t.id === 'contrast')!
const signage = defaultTemplates.find((t) => t.id === 'signage')!

describe('LabelCard', () => {
  it('渲染映射后的文本内容', () => {
    const wrapper = mount(LabelCard, {
      props: {
        template: standard,
        texts: { seatNo: '7', name: '测试考生', room: '一考场', examId: 'X001' },
      },
    })
    expect(wrapper.text()).toContain('7')
    expect(wrapper.text()).toContain('测试考生')
    expect(wrapper.text()).toContain('X001')
  })

  it('sampleMode 使用模板示例数据', () => {
    const wrapper = mount(LabelCard, { props: { template: standard, sampleMode: true } })
    expect(wrapper.text()).toContain('谢跃平')
  })

  it('highlightMissing 高亮空字段与缺失照片', () => {
    const wrapper = mount(LabelCard, {
      props: {
        template: withPhoto,
        texts: { seatNo: '1', name: '', room: 'A', examId: 'B' },
        photoSrc: null,
        highlightMissing: true,
      },
    })
    expect(wrapper.find('.label-field--empty').exists()).toBe(true)
    expect(wrapper.find('.label-field--photo-missing').exists()).toBe(true)
  })

  it('有照片时渲染 img', () => {
    const wrapper = mount(LabelCard, {
      props: {
        template: withPhoto,
        texts: { seatNo: '1', name: 'n', room: 'r', examId: 'e' },
        photoSrc: 'data:image/png;base64,xxx',
      },
    })
    expect(wrapper.find('.label-field--image img').exists()).toBe(true)
  })

  it('固定文本字段在数据模式与示例模式都渲染固定内容', () => {
    const dataMode = mount(LabelCard, {
      props: { template: signage, texts: { name: '甲', seatNo: '1', room: '', examId: '' } },
    })
    expect(dataMode.text()).toContain('请对号入座')

    const sample = mount(LabelCard, { props: { template: signage, sampleMode: true } })
    expect(sample.text()).toContain('请对号入座')
  })

  it('固定文本字段不参与缺失高亮', () => {
    const wrapper = mount(LabelCard, {
      props: {
        template: signage,
        texts: { name: 'x', seatNo: 'y', room: 'z', examId: 'w' },
        highlightMissing: true,
      },
    })
    expect(wrapper.find('.label-field--empty').exists()).toBe(false)
  })

  it('分散对齐：单行保持 justify，折成多行回退居中', async () => {
    const { adjustJustify } = await import('@/components/label/LabelCard.vue')
    const el = document.createElement('div')
    el.dataset.justify = '1'
    el.style.fontSize = '12pt'
    const body = document.createElement('span')
    body.className = 'label-field__body'
    el.appendChild(body)
    document.body.appendChild(el)

    adjustJustify(el)
    expect(el.style.textAlign).toBe('justify')
    expect(el.style.textAlignLast).toBe('justify')

    // 模拟内容折成两行（scrollHeight 超过 1.5 倍行高）
    Object.defineProperty(body, 'scrollHeight', { value: 999, configurable: true })
    adjustJustify(el)
    expect(el.style.textAlign).toBe('center')
    expect(el.style.textAlignLast).toBe('center')
    el.remove()
  })

  it('字段背景色生效（黑白对比版座位号色块）', () => {
    const wrapper = mount(LabelCard, { props: { template: contrast, sampleMode: true } })
    const hero = wrapper.find('.label-field--hero')
    expect(hero.attributes('style')).toContain('background: rgb(15, 23, 42)')
  })

  it('固定图片（Logo）在示例模式也渲染', () => {
    const t = cloneTemplate(withPhoto)
    t.fields.find((f) => f.type === 'image')!.imageSrc = 'data:image/png;base64,logo'
    const wrapper = mount(LabelCard, { props: { template: t, sampleMode: true } })
    expect(wrapper.find('.label-field--image img').exists()).toBe(true)
  })

  it('caption 标签名前缀与内容一同渲染', () => {
    const t = cloneTemplate(standard)
    t.fields.push({
      id: 'gender',
      label: '性别',
      type: 'text',
      x: 0,
      y: 0,
      width: 20,
      height: 6,
      caption: '性别',
    })
    const wrapper = mount(LabelCard, {
      props: {
        template: t,
        texts: { seatNo: '1', name: 'n', room: 'r', examId: 'e', gender: '男' },
      },
    })
    expect(wrapper.find('.label-field__caption').text()).toBe('性别')
    expect(wrapper.text()).toContain('男')
  })

  it('watermark 开启时在标签内渲染品牌水印', () => {
    const wrapper = mount(LabelCard, {
      props: {
        template: standard,
        texts: { seatNo: '1', name: 'n', room: 'r', examId: 'e' },
        watermark: true,
      },
    })
    const wm = wrapper.find('.label-watermark')
    expect(wm.exists()).toBe(true)
    expect(wm.text()).toContain('seatmark.cn')
    expect(wm.attributes('style')).toMatch(/font-size: [\d.]+mm/)
  })

  it('底部有空位的大标签使用品牌全称水印', () => {
    const t = cloneTemplate(standard)
    t.label.width = 180
    t.label.height = 128
    // 只保留顶部一个字段，底部留空
    t.fields = [{ id: 'name', label: '姓名', type: 'text', x: 10, y: 10, width: 160, height: 40 }]
    const wrapper = mount(LabelCard, {
      props: { template: t, texts: { name: '测试' }, watermark: true },
    })
    expect(wrapper.find('.label-watermark').text()).toBe('SeatMark 座签 · seatmark.cn')
  })

  it('小标签水印退回短版域名', () => {
    const t = cloneTemplate(standard)
    t.label.width = 40
    const wrapper = mount(LabelCard, {
      props: {
        template: t,
        texts: { seatNo: '1', name: 'n', room: 'r', examId: 'e' },
        watermark: true,
      },
    })
    expect(wrapper.find('.label-watermark').text()).toBe('seatmark.cn')
  })

  it('watermark 关闭时不渲染水印', () => {
    const wrapper = mount(LabelCard, {
      props: { template: standard, texts: { seatNo: '1', name: 'n', room: 'r', examId: 'e' } },
    })
    expect(wrapper.find('.label-watermark').exists()).toBe(false)
  })

  it('decorSvg 内部 id 每个实例唯一化，url(#) 同步改写', () => {
    const aurora = defaultTemplates.find((t) => t.id === 'deluxeConfAurora')!
    const a = mount(LabelCard, { props: { template: aurora, sampleMode: true } })
    const b = mount(LabelCard, { props: { template: aurora, sampleMode: true } })
    const htmlA = a.find('.label-decor').html()
    const htmlB = b.find('.label-decor').html()
    // 原始 id 不再原样出现（已加实例后缀）
    expect(htmlA).not.toContain('id="dxaur-a"')
    expect(htmlA).toMatch(/id="dxaur-a-u\d+"/)
    // url(#) 引用与新 id 一致
    const id = /id="(dxaur-a-u\d+)"/.exec(htmlA)![1]!
    expect(htmlA).toContain(`url(#${id})`)
    // 两个实例的 id 不冲突
    const idB = /id="(dxaur-a-u\d+)"/.exec(htmlB)![1]!
    expect(idB).not.toBe(id)
  })
})

describe('LabelSheet', () => {
  const rows: DataRow[] = [
    { 姓名: '甲', 座位号: '1' },
    { 姓名: '乙', 座位号: '2' },
    { 姓名: '丙', 座位号: '3' },
  ]
  const getText = (row: DataRow, fieldId: string) =>
    fieldId === 'name' ? (row['姓名'] ?? '') : fieldId === 'seatNo' ? (row['座位号'] ?? '') : ''

  it('每行数据渲染一枚标签', () => {
    const wrapper = mount(LabelSheet, {
      props: { template: standard, rows, getText },
    })
    expect(wrapper.findAll('.label-box')).toHaveLength(3)
    expect(wrapper.text()).toContain('甲')
    expect(wrapper.text()).toContain('丙')
  })

  it('裁切线数量正确且可关闭', async () => {
    const wrapper = mount(LabelSheet, {
      props: { template: standard, rows, getText, showCutLines: true },
    })
    expect(wrapper.findAll('.cut-line')).toHaveLength(13)
    await wrapper.setProps({ showCutLines: false })
    expect(wrapper.findAll('.cut-line')).toHaveLength(0)
  })

  it('标签按 mm 坐标绝对定位', () => {
    const wrapper = mount(LabelSheet, {
      props: { template: standard, rows, getText },
    })
    const second = wrapper.findAll('.label-box')[1]!
    expect(second.attributes('style')).toContain('left: 75mm')
    expect(second.attributes('style')).toContain('top: 10mm')
  })

  it('watermark 透传到每张标签内部', () => {
    const wrapper = mount(LabelSheet, {
      props: { template: standard, rows, getText, watermark: true },
    })
    expect(wrapper.findAll('.label-watermark')).toHaveLength(3)
    expect(wrapper.find('.sheet-watermark').exists()).toBe(true)
  })
})
