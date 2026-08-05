import type { PrintCalibration } from '@/utils/calibration'

export interface PdfExportOptions {
  /** html2canvas 渲染倍率，4 约等于 384dpi；未指定时按页数自动选取 */
  scale?: number
  /** 栅格格式：PNG 无损（文字边缘更锐利）；JPEG 体积更小；未指定时按页数自动选取 */
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

export interface PagedPdfExportOptions extends PdfExportOptions {
  pageCount: number
  /**
   * 逐页取节点：仅在轮到该页时才要求其挂载，
   * 大页数任务无需一次性渲染全部页面，内存占用恒定
   */
  getPage: (index: number) => Promise<HTMLElement> | HTMLElement
}

/** 按页数选取渲染倍率：页少时可更高清，页多时控制体积、内存与耗时 */
export function defaultRasterScale(pageCount: number): number {
  if (pageCount <= 2) return 5
  if (pageCount <= 6) return 4
  if (pageCount <= 12) return 3
  if (pageCount <= 30) return 2.5
  return 2
}

/** 按页数选取栅格格式：页多时用 JPEG 控制单页体积与 PDF 总大小 */
export function defaultImageFormat(pageCount: number): 'png' | 'jpeg' {
  return pageCount <= 6 ? 'png' : 'jpeg'
}

/** 近似 DPI（96 CSS px/in × scale） */
export function rasterDpi(scale: number): number {
  return Math.round(96 * scale)
}

/**
 * canvas → 压缩图像字节（经 toBlob，避免 toDataURL 生成超长字符串
 * 触发 "Invalid string length"），jsPDF 直接接收 Uint8Array。
 */
async function canvasToImageBytes(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpeg',
): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('页面栅格化失败（toBlob 返回空）'))),
      format === 'png' ? 'image/png' : 'image/jpeg',
      format === 'png' ? undefined : 0.92,
    )
  })
  return new Uint8Array(await blob.arrayBuffer())
}

/**
 * 分页分批导出：逐页栅格化后立即写入 PDF 并释放画布内存，
 * 单页失败会抛错并附带页码；页面尺寸跟随模板纸张。
 * 依赖按需加载，避免拖慢首屏。
 */
export async function exportPagedPdf(options: PagedPdfExportOptions): Promise<void> {
  const { pageCount, getPage } = options
  if (!pageCount) throw new Error('没有可导出的页面')

  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas-pro'),
  ])

  const scale = options.scale ?? defaultRasterScale(pageCount)
  const imageFormat = options.imageFormat ?? defaultImageFormat(pageCount)
  const pageWidth = options.pageWidth ?? 210
  const pageHeight = options.pageHeight ?? 297
  const orientation = pageWidth > pageHeight ? 'landscape' : 'portrait'
  const doc = new jsPDF({ orientation, unit: 'mm', format: [pageWidth, pageHeight] })

  for (let i = 0; i < pageCount; i++) {
    if (i > 0) doc.addPage([pageWidth, pageHeight], orientation)
    let bytes: Uint8Array
    try {
      const el = await getPage(i)
      const canvas = await html2canvas(el, {
        scale,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      })
      bytes = await canvasToImageBytes(canvas, imageFormat)
      // 释放大画布内存，避免大页数任务累计占用
      canvas.width = 0
      canvas.height = 0
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      throw new Error(`第 ${i + 1}/${pageCount} 页渲染失败：${detail}`)
    }
    const cal = options.calibration
    const x = cal?.offsetX ?? 0
    const y = cal?.offsetY ?? 0
    const w = pageWidth * (cal?.scaleX ?? 1)
    const h = pageHeight * (cal?.scaleY ?? 1)
    doc.addImage(bytes, imageFormat === 'png' ? 'PNG' : 'JPEG', x, y, w, h)
    options.onProgress?.(i + 1, pageCount)
  }

  doc.save(options.fileName ?? defaultPdfFileName())
}

/**
 * 将一组已挂载的页面节点逐页栅格化后写入 PDF 并触发下载。
 */
export async function exportPagesToPdf(
  pages: HTMLElement[],
  options: PdfExportOptions = {},
): Promise<void> {
  await exportPagedPdf({
    ...options,
    pageCount: pages.length,
    getPage: (i) => pages[i]!,
  })
}

export function defaultPdfFileName(prefix = '考场座位标签'): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `${prefix}-${stamp}.pdf`
}
