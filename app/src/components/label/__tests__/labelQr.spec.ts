import { mount } from '@vue/test-utils'
import jsQR from 'jsqr'
import { describe, expect, it } from 'vitest'

import LabelCard from '@/components/label/LabelCard.vue'
import LabelSheet from '@/components/label/LabelSheet.vue'
import { defaultTemplates } from '@/data/defaultTemplates'
import type { DataRow, LabelTemplate, TemplateField } from '@/types/template'
import { cloneTemplate } from '@/utils/layout'

const standard = defaultTemplates.find((t) => t.id === 'standard')!

/** 在标准考场模板上加一个绑定「准考证号」列的二维码字段（宽 > 高，验证取短边） */
function withQr(width = 24, height = 16): LabelTemplate {
  const tpl = cloneTemplate(standard)
  const qr: TemplateField = {
    id: 'qr',
    label: '二维码',
    type: 'qr',
    x: 2,
    y: 2,
    width,
    height,
    padding: 0.5,
  }
  tpl.fields.push(qr)
  return tpl
}

/**
 * 把 qrToSvg 输出的 SVG（每个深色模块一段 `M{x},{y}h1v1h-1z`）栅格化为 RGBA，
 * 用 jsQR 解码——不依赖 canvas，直接验证 SVG 内容可扫
 */
function decodeSvg(svg: string, scale = 4): string | null {
  const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(svg)
  if (!vb) return null
  const dim = Number(vb[1])
  const px = dim * scale
  const data = new Uint8ClampedArray(px * px * 4).fill(255)
  const re = /M(\d+),(\d+)h1v1h-1z/g
  let m: RegExpExecArray | null
  while ((m = re.exec(svg))) {
    const mx = Number(m[1])
    const my = Number(m[2])
    for (let y = my * scale; y < (my + 1) * scale; y++) {
      for (let x = mx * scale; x < (mx + 1) * scale; x++) {
        const i = (y * px + x) * 4
        data[i] = 0
        data[i + 1] = 0
        data[i + 2] = 0
      }
    }
  }
  return jsQR(data, px, px)?.data ?? null
}

describe('LabelCard · 二维码字段', () => {
  it('绑定列有值时渲染内联 <svg>，且按短边取方', () => {
    const wrapper = mount(LabelCard, {
      props: {
        template: withQr(24, 16),
        texts: { seatNo: '7', name: '张三', room: '一考场', examId: 'X001', qr: '2025053002' },
      },
    })
    const box = wrapper.find('.label-field--qr .label-field__qr')
    expect(box.exists()).toBe(true)
    expect(box.find('svg').exists()).toBe(true)
    // 短边 16mm − 内边距 0.5mm × 2 = 15mm 方形
    const style = (box.element as HTMLElement).style
    expect(style.width).toBe('15mm')
    expect(style.height).toBe('15mm')
    // 外框仍沿用字段原始尺寸/位置
    const outer = (wrapper.find('.label-field--qr').element as HTMLElement).style
    expect(outer.width).toBe('24mm')
    expect(outer.height).toBe('16mm')
    expect(outer.left).toBe('2mm')
  })

  it('二维码内容可解码回单元格文本（纠错 M）', () => {
    const wrapper = mount(LabelCard, {
      props: {
        template: withQr(),
        texts: { seatNo: '1', name: 'n', room: 'r', examId: 'e', qr: '2025053002' },
      },
    })
    const svg = wrapper.find('.label-field__qr').element.innerHTML
    expect(decodeSvg(svg)).toBe('2025053002')
  })

  it('空值 / 纯空白不渲染二维码', () => {
    for (const value of ['', '   ']) {
      const wrapper = mount(LabelCard, {
        props: {
          template: withQr(),
          texts: { seatNo: '1', name: 'n', room: 'r', examId: 'e', qr: value },
        },
      })
      expect(wrapper.find('.label-field--qr').exists()).toBe(true)
      expect(wrapper.find('.label-field--qr svg').exists()).toBe(false)
    }
  })

  it('未映射的二维码字段与文本字段一样显示（空）占位并参与缺失高亮', () => {
    const wrapper = mount(LabelCard, {
      props: {
        template: withQr(),
        texts: { seatNo: '1', name: 'n', room: 'r', examId: 'e' },
        unmappedFields: new Set(['qr']),
        highlightMissing: true,
      },
    })
    const qr = wrapper.find('.label-field--qr')
    expect(qr.classes()).toContain('label-field--unmapped')
    expect(qr.classes()).toContain('label-field--empty')
    expect(qr.text()).toContain('（空）')
  })

  it('sampleMode 用字段 sample 生成二维码', () => {
    const tpl = withQr()
    tpl.fields.find((f) => f.id === 'qr')!.sample = 'https://www.seatmark.cn/'
    const wrapper = mount(LabelCard, { props: { template: tpl, sampleMode: true } })
    const svg = wrapper.find('.label-field__qr').element.innerHTML
    expect(decodeSvg(svg)).toBe('https://www.seatmark.cn/')
  })

  it('超出二维码容量的超长文本不渲染、不抛错', () => {
    const wrapper = mount(LabelCard, {
      props: {
        template: withQr(),
        texts: { seatNo: '1', name: 'n', room: 'r', examId: 'e', qr: 'A'.repeat(5000) },
      },
    })
    expect(wrapper.find('.label-field--qr svg').exists()).toBe(false)
  })

  it('未知字段类型（旧分享 hash）不崩，落到图片占位分支', () => {
    const tpl = cloneTemplate(standard)
    tpl.fields.push({
      id: 'weird',
      label: '未知',
      type: 'barcode' as unknown as TemplateField['type'],
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    })
    const wrapper = mount(LabelCard, {
      props: { template: tpl, texts: { seatNo: '1', name: 'n', room: 'r', examId: 'e' } },
    })
    expect(wrapper.find('.label-field--image').exists()).toBe(true)
    expect(wrapper.find('.label-field--qr').exists()).toBe(false)
  })
})

describe('LabelSheet · 二维码字段走名单列取值', () => {
  it('每行按各自单元格生成不同二维码', () => {
    const rows: DataRow[] = [
      { 准考证号: '2025053001', 姓名: '甲' },
      { 准考证号: '2025053002', 姓名: '乙' },
    ]
    const wrapper = mount(LabelSheet, {
      props: {
        template: withQr(),
        rows,
        getText: (row: DataRow, fieldId: string) => {
          if (fieldId === 'qr' || fieldId === 'examId') return String(row['准考证号'] ?? '')
          if (fieldId === 'name') return String(row['姓名'] ?? '')
          return ''
        },
      },
    })
    const boxes = wrapper.findAll('.label-field__qr')
    expect(boxes).toHaveLength(2)
    expect(decodeSvg(boxes[0]!.element.innerHTML)).toBe('2025053001')
    expect(decodeSvg(boxes[1]!.element.innerHTML)).toBe('2025053002')
  })
})
