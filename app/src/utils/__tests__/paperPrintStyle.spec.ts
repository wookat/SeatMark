import { describe, expect, it } from 'vitest'

import type { PrintCalibration } from '@/utils/calibration'
import { setPrintPageSize } from '@/utils/paper'

const CALIBRATION: PrintCalibration = { offsetX: 2, offsetY: -1.5, scaleX: 1, scaleY: 1 }

function printStyleText(): string {
  return document.getElementById('dynamic-print-page-size')?.textContent ?? ''
}

describe('setPrintPageSize', () => {
  it('无校准时只写 @page 尺寸', () => {
    setPrintPageSize(210, 297)
    const css = printStyleText()
    expect(css).toContain('@page { size: 210mm 297mm; margin: 0; }')
    expect(css).not.toContain('transform')
    expect(css).not.toContain('overflow')
  })

  it('校准时叠加页面变换', () => {
    setPrintPageSize(210, 297, CALIBRATION)
    expect(printStyleText()).toContain('transform: translate(2mm, -1.5mm) scale(1, 1)')
  })

  it('校准时约束宿主宽度并裁剪溢出（正偏移不触发打印 shrink-to-fit 缩水）', () => {
    setPrintPageSize(210, 297, CALIBRATION)
    const css = printStyleText()
    expect(css).toContain('.offscreen-host { width: 210mm; overflow: hidden !important; }')
  })
})
