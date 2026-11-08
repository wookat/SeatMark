import { describe, expect, it } from 'vitest'

import { defaultTemplates } from '@/data/defaultTemplates'
import type { WatermarkRect } from '@/utils/watermark'
import { estimateContentWidth, estimateWatermarkWidth, watermarkPlacement } from '@/utils/watermark'

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
        seed: t.id,
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

  it('全部内置模板：边带内容宽度不超出带长 70%（含图标宽度估算）', () => {
    for (const t of defaultTemplates) {
      const p = watermarkPlacement({
        width: t.label.width,
        height: t.label.height,
        fields: t.fields,
        seed: t.id,
      })
      if (p.variant === 'diagonal') continue
      const span =
        p.variant === 'left' || p.variant === 'right' ? t.label.height : t.label.width
      expect(
        estimateContentWidth(p.content, p.fontSizeMm),
        `${t.id} ${p.variant} ${p.content.kind} 内容超宽`,
      ).toBeLessThanOrEqual(span * 0.7 + 1e-9)
    }
  })

  it('内容形态在模板目录中呈多样化分布（非单一「名称+域名」）', () => {
    const kinds = new Set<string>()
    for (const t of defaultTemplates) {
      const p = watermarkPlacement({
        width: t.label.width,
        height: t.label.height,
        fields: t.fields,
        seed: t.id,
      })
      kinds.add(`${p.variant}:${p.content.kind}`)
    }
    // 至少覆盖 图标 / 图标+文字 / 纯文字 三类，且斜向出现多行或图标形态
    expect(kinds.size).toBeGreaterThanOrEqual(4)
    expect([...kinds].some((k) => k.endsWith(':icon'))).toBe(true)
    expect([...kinds].some((k) => k.endsWith(':iconLine'))).toBe(true)
  })

  it('同一模板 id 每次得到相同形态（确定性轮换）', () => {
    const a = watermarkPlacement({ width: 180, height: 128, fields: [], seed: 'examNo' })
    const b = watermarkPlacement({ width: 180, height: 128, fields: [], seed: 'examNo' })
    const c = watermarkPlacement({ width: 180, height: 128, fields: [], seed: 'other' })
    expect(a.content).toEqual(b.content)
    // 空 seed 恒取候选池首个（最丰富）
    const noSeed = watermarkPlacement({ width: 180, height: 128, fields: [] })
    expect(noSeed.content).toEqual({ kind: 'iconLine', text: 'SeatMark 座签 · seatmark.cn' })
    expect(c.content).toBeDefined()
  })

  it('底边空的模板用底边签名', () => {
    const p = watermarkPlacement({
      width: 180,
      height: 128,
      fields: [{ x: 10, y: 10, width: 160, height: 40 }],
    })
    expect(p.variant).toBe('bottom')
    expect(p.topMm).toBeCloseTo(122.16, 6)
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
      seed: examNo.id,
    })
    expect(p.variant).toBe('diagonal')
    expect(p.rotateDeg).toBeGreaterThan(0)
    expect(p.rotateDeg).toBeLessThan(90)
    expect(p.fontSizeMm).toBeGreaterThan(2)
  })

  it('斜向兜底文本类内容宽度不超过对角线', () => {
    for (const t of defaultTemplates) {
      const p = watermarkPlacement({
        width: t.label.width,
        height: t.label.height,
        fields: t.fields,
        seed: t.id,
      })
      if (p.variant !== 'diagonal' || p.content.kind === 'icon') continue
      expect(estimateContentWidth(p.content, p.fontSizeMm)).toBeLessThanOrEqual(
        Math.hypot(t.label.width, t.label.height) * 0.73,
      )
    }
  })

  it('小标签退回短域名或纯图标', () => {
    const p = watermarkPlacement({ width: 40, height: 20, fields: [] })
    const w = estimateContentWidth(p.content, p.fontSizeMm)
    expect(w).toBeLessThanOrEqual(40 * 0.7)
  })

  it('estimateContentWidth：图标 + 文字计入图标与间隙', () => {
    const iconLine = estimateContentWidth({ kind: 'iconLine', text: '座签' }, 10)
    const line = estimateContentWidth({ kind: 'line', text: '座签' }, 10)
    expect(iconLine - line).toBeCloseTo(15.5, 1)
    expect(estimateContentWidth({ kind: 'icon' }, 10)).toBeCloseTo(10.5, 1)
    const stacked = estimateContentWidth({ kind: 'stacked', line1: 'SeatMark 座签', line2: 'seatmark.cn' }, 10)
    expect(stacked).toBeGreaterThanOrEqual(estimateWatermarkWidth('seatmark.cn', 10))
  })
})
