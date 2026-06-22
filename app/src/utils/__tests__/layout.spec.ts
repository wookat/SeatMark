import { describe, expect, it } from 'vitest'

import { defaultTemplates } from '@/data/defaultTemplates'
import {
  centerLayout,
  chunkRows,
  cloneTemplate,
  cutLines,
  fitToPaper,
  labelPosition,
  labelsPerPage,
  layoutOverflow,
} from '@/utils/layout'

const standard = defaultTemplates[0]!

describe('labelsPerPage / labelPosition', () => {
  it('标准模板每页 3×8=24 枚', () => {
    expect(labelsPerPage(standard)).toBe(24)
  })

  it('第 0 枚位于左上边距处', () => {
    expect(labelPosition(standard, 0)).toEqual({ left: 11, top: 10 })
  })

  it('同一行相邻标签相距 标签宽+横向间距', () => {
    const a = labelPosition(standard, 0)
    const b = labelPosition(standard, 1)
    expect(b.left - a.left).toBeCloseTo(60 + 4, 5)
    expect(b.top).toBe(a.top)
  })

  it('换行后回到首列', () => {
    const pos = labelPosition(standard, 3)
    expect(pos.left).toBe(11)
    expect(pos.top).toBeCloseTo(10 + 32 + 3.857, 5)
  })
})

describe('cutLines', () => {
  it('线条数量 = (cols+1) + (rows+1)', () => {
    expect(cutLines(standard)).toHaveLength(4 + 9)
  })

  it('首尾竖线贴住标签阵列的左右边缘', () => {
    const lines = cutLines(standard)
    const verticals = lines.filter((l) => l.orientation === 'v')
    expect(verticals[0]!.left).toBe(11)
    expect(verticals.at(-1)!.left).toBeCloseTo(11 + 3 * 60 + 2 * 4, 5)
  })

  it('首尾横线贴住标签阵列的上下边缘', () => {
    const lines = cutLines(standard)
    const horizontals = lines.filter((l) => l.orientation === 'h')
    expect(horizontals[0]!.top).toBe(10)
    expect(horizontals.at(-1)!.top).toBeCloseTo(10 + 8 * 32 + 7 * 3.857, 5)
  })
})

describe('chunkRows', () => {
  it('按每页容量分页，末页可不满', () => {
    const rows = Array.from({ length: 50 }, (_, i) => i)
    const pages = chunkRows(rows, 24)
    expect(pages.map((p) => p.length)).toEqual([24, 24, 2])
  })

  it('容量非法时返回空数组', () => {
    expect(chunkRows([1, 2, 3], 0)).toEqual([])
  })
})

describe('layoutOverflow', () => {
  it('内置模板不应报超界', () => {
    for (const t of defaultTemplates) {
      const overflow = layoutOverflow(t)
      expect(overflow.x).toBeLessThanOrEqual(0)
      expect(overflow.y).toBeLessThanOrEqual(0)
    }
  })

  it('行数过多时报纵向超界', () => {
    const t = cloneTemplate(standard)
    t.page.rows = 10
    expect(layoutOverflow(t).y).toBeGreaterThan(0)
  })
})

describe('centerLayout', () => {
  it('按内容尺寸均分四周边距', () => {
    const t = cloneTemplate(standard)
    centerLayout(t)
    // 内容宽 188 → 左右各 11；内容高约 283 → 上下各约 7
    expect(t.page.marginLeft).toBe(11)
    expect(t.page.marginRight).toBe(11)
    expect(t.page.marginTop).toBeCloseTo(7, 0)
    expect(t.page.marginTop).toBe(t.page.marginBottom)
  })
})

describe('fitToPaper', () => {
  it('A4 切到 A5 纵向：行列自动缩减且不超界', () => {
    const t = cloneTemplate(standard) // 60×32 标签，gap 4 / 3.857
    t.page.paperWidth = 148
    t.page.paperHeight = 210
    fitToPaper(t)
    expect(t.page.cols).toBe(2)
    expect(t.page.rows).toBe(5)
    expect(layoutOverflow(t).x).toBeLessThanOrEqual(0)
    expect(layoutOverflow(t).y).toBeLessThanOrEqual(0)
    expect(t.page.marginLeft).toBe(t.page.marginRight)
    expect(t.page.marginTop).toBe(t.page.marginBottom)
  })

  it('A4 切到 A3 纵向：行列自动扩充', () => {
    const t = cloneTemplate(standard)
    t.page.paperWidth = 297
    t.page.paperHeight = 420
    fitToPaper(t)
    expect(t.page.cols).toBe(4)
    expect(t.page.rows).toBe(11)
    expect(layoutOverflow(t).x).toBeLessThanOrEqual(0)
    expect(layoutOverflow(t).y).toBeLessThanOrEqual(0)
  })

  it('横竖向切换后同样不超界', () => {
    const t = cloneTemplate(standard)
    t.page.paperWidth = 297
    t.page.paperHeight = 210
    fitToPaper(t)
    expect(layoutOverflow(t).x).toBeLessThanOrEqual(0)
    expect(layoutOverflow(t).y).toBeLessThanOrEqual(0)
  })

  it('标签大于纸面时保持 1×1，边距不为负', () => {
    const t = cloneTemplate(standard)
    t.label.width = 200
    t.label.height = 300
    t.page.paperWidth = 148
    t.page.paperHeight = 210
    fitToPaper(t)
    expect(t.page.cols).toBe(1)
    expect(t.page.rows).toBe(1)
    expect(t.page.marginLeft).toBeGreaterThanOrEqual(0)
    expect(t.page.marginTop).toBeGreaterThanOrEqual(0)
  })
})
