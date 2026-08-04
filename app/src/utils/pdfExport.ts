import type { PrintCalibration } from '@/utils/calibration'

export interface PdfExportOptions {
  /** html2canvas 渲染倍率，4 约等于 384dpi；未指定时按页数自动选取 */
  scale?: number
  /** 栅格格式：PNG 无损（默认，文字边缘更锐利）；JPEG 体积更小 */
  imageFormat?: 'png' | 'jpeg'
  fileName?: string
  /** 页面宽度（mm），默认 A4 纵向 */
  pageWidth?: number
  /** 页面高度（mm），默认 A4 纵向 */
  pageHeight?: number
  /** 打印校准补偿（全局偏移 mm + 缩放），未设置时不补偿 */
  calibration?: PrintCalibration
  onProgress?: (done: number, total: number) => void
}

/** 按页数选取渲染倍率：页少时可更高清，页多时控制体积与耗时 */
export function defaultRasterScale(pageCount: number): number {
  if (pageCount <= 2) return 5
  if (pageCount <= 6) return 4
  return 3
}

/** 近似 DPI（96 CSS px/in × scale） */
export function rasterDpi(scale: number): number {
  return Math.round(96 * scale)
}

/**
 * 将一组页面节点逐页栅格化后写入 PDF 并触发下载，
 * 页面尺寸跟随模板纸张（A4 / A5 / A3、横竖向）。
 * 依赖按需加载，避免拖慢首屏。
 */
export async function exportPagesToPdf(
  pages: HTMLElement[],
  options: PdfExportOptions = {},
): Promise<void> {
  if (!pages.length) throw new Error('没有可导出的页面')

  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas-pro'),
  ])

  const scale = options.scale ?? defaultRasterScale(pages.length)
  const imageFormat = options.imageFormat ?? 'png'
  const pageWidth = options.pageWidth ?? 210
  const pageHeight = options.pageHeight ?? 297
  const doc = new jsPDF({
    orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [pageWidth, pageHeight],
  })

  for (let i = 0; i < pages.length; i++) {
    if (i > 0) doc.addPage([pageWidth, pageHeight], pageWidth > pageHeight ? 'landscape' : 'portrait')
    const canvas = await html2canvas(pages[i]!, {
      scale,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    })
    const imgData =
      imageFormat === 'png'
        ? canvas.toDataURL('image/png')
        : canvas.toDataURL('image/jpeg', 0.96)
    const cal = options.calibration
    const x = cal?.offsetX ?? 0
    const y = cal?.offsetY ?? 0
    const w = pageWidth * (cal?.scaleX ?? 1)
    const h = pageHeight * (cal?.scaleY ?? 1)
    doc.addImage(imgData, imageFormat === 'png' ? 'PNG' : 'JPEG', x, y, w, h)
    options.onProgress?.(i + 1, pages.length)
  }

  doc.save(options.fileName ?? defaultPdfFileName())
}

export function defaultPdfFileName(prefix = '考场座位标签'): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `${prefix}-${stamp}.pdf`
}
