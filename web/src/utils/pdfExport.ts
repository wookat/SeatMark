export interface PdfExportOptions {
  /** html2canvas 渲染倍率，3 约等于 288dpi */
  scale?: number
  fileName?: string
  /** 页面宽度（mm），默认 A4 纵向 */
  pageWidth?: number
  /** 页面高度（mm），默认 A4 纵向 */
  pageHeight?: number
  onProgress?: (done: number, total: number) => void
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

  const scale = options.scale ?? 3
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
    const imgData = canvas.toDataURL('image/jpeg', 0.95)
    doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight)
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
