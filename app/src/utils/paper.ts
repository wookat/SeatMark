import type { PrintCalibration } from '@/utils/calibration'
import { isCalibrationActive } from '@/utils/calibration'

import type { PageSpec } from '@/types/template'

export interface PaperPreset {
  id: string
  /** 展示名，如「A4 纵向」 */
  label: string
  width: number
  height: number
}

/** 支持的纸张规格（mm），均为常见打印纸 */
export const PAPER_PRESETS: PaperPreset[] = [
  { id: 'a4-portrait', label: 'A4 纵向', width: 210, height: 297 },
  { id: 'a4-landscape', label: 'A4 横向', width: 297, height: 210 },
  { id: 'a5-portrait', label: 'A5 纵向', width: 148, height: 210 },
  { id: 'a5-landscape', label: 'A5 横向', width: 210, height: 148 },
  { id: 'a3-portrait', label: 'A3 纵向', width: 297, height: 420 },
  { id: 'a3-landscape', label: 'A3 横向', width: 420, height: 297 },
]

/** 根据页面尺寸匹配预设 id；非标准尺寸返回 null */
export function matchPaperPreset(page: Pick<PageSpec, 'paperWidth' | 'paperHeight'>): PaperPreset | null {
  return (
    PAPER_PRESETS.find((p) => p.width === page.paperWidth && p.height === page.paperHeight) ?? null
  )
}

/** 纸张的人类可读名称，如「A4 纵向」或「210 × 297 mm」 */
export function paperLabel(page: Pick<PageSpec, 'paperWidth' | 'paperHeight'>): string {
  const preset = matchPaperPreset(page)
  return preset ? preset.label : `${page.paperWidth} × ${page.paperHeight} mm`
}

/** 应用纸张预设到页面规格（仅改变纸张尺寸，不动边距与行列） */
export function applyPaperPreset(page: PageSpec, preset: PaperPreset): void {
  page.paperWidth = preset.width
  page.paperHeight = preset.height
}

const PRINT_STYLE_ID = 'dynamic-print-page-size'

/**
 * 设置打印 @page 尺寸（浏览器打印走样式表，无法用内联样式控制）。
 * 每次模板纸张变化时调用，保证「打印」输出与所选纸张一致。
 * 传入校准参数时，对打印页面叠加全局偏移与缩放补偿。
 */
export function setPrintPageSize(
  widthMm: number,
  heightMm: number,
  calibration?: PrintCalibration,
): void {
  let style = document.getElementById(PRINT_STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = PRINT_STYLE_ID
    document.head.appendChild(style)
  }
  let css = `@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }`
  if (calibration && isCalibrationActive(calibration)) {
    const { offsetX, offsetY, scaleX, scaleY } = calibration
    css += `\n@media print { .offscreen-host .sheet-page { transform: translate(${offsetX}mm, ${offsetY}mm) scale(${scaleX}, ${scaleY}); transform-origin: top left; } }`
  }
  style.textContent = css
}
