import { describe, expect, it } from 'vitest'

import { defaultTemplates } from '@/data/defaultTemplates'
import type { WatermarkRect } from '@/utils/watermark'
import { estimateWatermarkWidth, watermarkPlacement } from '@/utils/watermark'

const intersects = (a: WatermarkRect, b: WatermarkRect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

/** 边线签名带实际占据的屏幕矩形（left/right 为旋转后落位） */
function bandScreenRect(p: ReturnType<typeof watermarkPlacement>): WatermarkRect {
  if (p.variant === 'right')
    return { x: p.leftMm - p.heightMm, y: p.topMm, w: p.heightMm, h: p.widthMm }
  if (p.variant === 'left')
    return { x: p.leftMm, y: p.topMm - p.widthMm, w: p.heightMm, h: p.widthMm }
  return { x: p.leftMm, y: p.topMm, w: p.widthMm, h: p.heightMm }
}

describe('watermarkPlacement', () => {
  it('全部内置模板：边线签名带绝不与字段矩形相交（重叠 bug 回归守护）', () => {
    for (const t of defaultTemplates) {
      const p = watermarkPlacement({
        width: t.label.width,
        height: t.label.height,
        fields: t.fields,
      })
      if (p.variant === 'diagonal') continue
      const band = bandScreenRect(p)
      for (const f of t.fields) {
        // 与组件内同样的外扩间隙
        const size = Math.min(Math.max(Math.min(t.label.width, t.label.height * 2.4) * 0.032, 2), 3.2)
        const c = Math.max(0.6, size * 0.25)
        const rect = { x: f.x - c, y: f.y - c, w: f.width + 2 * c, h: f.height + 2 * c }
        expect(
          intersects(band, rect),
          `${t.id} ${p.variant} 边带与字段 ${f.id} 相交`,
        ).toBe(false)
      }
    }
  })

  it('底边空的模板用底边签名', () => {
    const p = watermarkPlacement({
      width: 180,
      height: 128,
      fields: [{ x: 10, y: 10, width: 160, height: 40 }],
    })
    expect(p.variant).toBe('bottom')
    expect(p.topMm).toBeCloseTo(122.16, 6)
    expect(p.text).toBe('SeatMark 座签 · seatmark.cn')
  })

  it('底边被占退到顶边', () => {
    const p = watermarkPlacement({
      width: 180,
      height: 128,
      fields: [{ x: 10, y: 80, width: 160, height: 47 }],
    })
    expect(p.variant).toBe('top')
    expect(p.topMm).toBeCloseTo(1.36, 6)
  })

  it('上下边都占满时用侧边竖排签名带', () => {
    // 字段占满上下边但右边留空
    const p = watermarkPlacement({
      width: 90,
      height: 40,
      fields: [
        { x: 4, y: 2, width: 70, height: 10 }, // 顶边
        { x: 4, y: 28, width: 70, height: 10 }, // 底边
        { x: 0, y: 0, width: 2, height: 40 }, // 左边装饰条
      ],
    })
    expect(p.variant).toBe('right')
    expect(p.rotateDeg).toBe(90)
  })

  it('四边都被占用时退回斜向浅水印', () => {
    // 复刻 examNo 的字段布局：顶边姓名/考场、底边小注、左右都被压住
    const examNo = defaultTemplates.find((t) => t.id === 'examNo')!
    const p = watermarkPlacement({
      width: examNo.label.width,
      height: examNo.label.height,
      fields: examNo.fields,
    })
    expect(p.variant).toBe('diagonal')
    expect(p.rotateDeg).toBeGreaterThan(0)
    expect(p.rotateDeg).toBeLessThan(90)
    expect(p.fontSizeMm).toBeGreaterThan(2)
  })

  it('斜向兜底文本宽度不超过对角线', () => {
    for (const t of defaultTemplates) {
      const p = watermarkPlacement({
        width: t.label.width,
        height: t.label.height,
        fields: t.fields,
      })
      if (p.variant !== 'diagonal') continue
      expect(estimateWatermarkWidth(p.text, p.fontSizeMm)).toBeLessThanOrEqual(
        Math.hypot(t.label.width, t.label.height) * 0.73,
      )
    }
  })

  it('小标签退回短域名', () => {
    const p = watermarkPlacement({ width: 40, height: 20, fields: [] })
    expect(p.text).toBe('seatmark.cn')
  })
})
