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
  /** 取消信号：在页与页之间检查，中止后抛出「已取消导出」 */
  signal?: AbortSignal
  /** 单页渲染看门狗超时（毫秒），超时自动重试一次，仍超时则报错中止 */
  pageTimeoutMs?: number
}

/** 用户主动取消导出时抛出的错误文案（用于上层区分取消与真实失败） */
export const EXPORT_CANCELLED_MESSAGE = '已取消导出'

/**
 * 开发注入：强制指定页渲染失败的 localStorage 开关（仅 DEV 生效）。
 * 值为页码（1 起）时仅该页失败，其他真值视为第 1 页；
 * 用于回归验收「导出失败不扣配额」路径。
 */
export const DEV_FORCE_EXPORT_FAIL_KEY = 'seatmark.dev.force-export-fail'

export function devForcedExportFailure(pageIndex: number): Error | null {
  if (!import.meta.env.DEV) return null
  try {
    const raw = localStorage.getItem(DEV_FORCE_EXPORT_FAIL_KEY)
    if (raw == null) return null
    const failAt = Number(raw)
    const targetIndex = Number.isFinite(failAt) && failAt >= 1 ? failAt - 1 : 0
    return pageIndex === targetIndex ? new Error('开发注入：强制页面渲染失败') : null
  } catch {
    return null
  }
}

/** 单页渲染看门狗默认超时：移动端慢 CPU 下渲染一页 A4@2x 通常 <10s，30s 视为挂起 */
export const DEFAULT_PAGE_TIMEOUT_MS = 30_000

/** 给 Promise 加看门狗超时：超时以指定文案 reject，防止 html2canvas 无限挂起 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

/**
 * 像素采样非空检测（纯函数，便于单测）：
 * RGBA 数组按步长采样，全部像素都接近白色（且不透明或全透明）视为空白。
 */
export function isPixelDataBlank(
  data: Uint8ClampedArray | number[],
  sampleStep = 1,
  whiteThreshold = 250,
): boolean {
  const step = Math.max(1, Math.floor(sampleStep)) * 4
  for (let i = 0; i + 3 < data.length; i += step) {
    const r = data[i]!
    const g = data[i + 1]!
    const b = data[i + 2]!
    const a = data[i + 3]!
    // 有可见的非白像素即认为非空
    if (a > 0 && (r < whiteThreshold || g < whiteThreshold || b < whiteThreshold)) return false
  }
  return true
}

/**
 * canvas 快速非空检测：整幅缩到小画布后采样像素，
 * 全白视为空白页（DOM 未渲染完成就截图的典型症状）。
 * 环境不支持 2D 上下文时返回 false（宁可放过也不误杀）。
 */
export function isCanvasBlank(canvas: HTMLCanvasElement): boolean {
  if (!canvas.width || !canvas.height) return true
  try {
    const sampleW = Math.min(canvas.width, 96)
    const sampleH = Math.min(canvas.height, 128)
    const probe = document.createElement('canvas')
    probe.width = sampleW
    probe.height = sampleH
    const ctx = probe.getContext('2d', { willReadFrequently: true })
    if (!ctx) return false
    ctx.drawImage(canvas, 0, 0, sampleW, sampleH)
    const { data } = ctx.getImageData(0, 0, sampleW, sampleH)
    return isPixelDataBlank(data)
  } catch {
    return false
  }
}

/**
 * 等待页面节点真正就绪再截图：字体加载完成（document.fonts.ready）
 * + 节点内图片全部 decode + 双 requestAnimationFrame 确保完成布局与绘制。
 */
export async function waitForElementReady(el: HTMLElement): Promise<void> {
  try {
    await document.fonts.ready
  } catch {
    /* 旧浏览器无 fonts API：跳过 */
  }
  const images = Array.from(el.querySelectorAll('img'))
  await Promise.all(
    images.map((img) =>
      img.complete
        ? img.decode().catch(() => undefined)
        : new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true })
            img.addEventListener('error', () => resolve(), { once: true })
          }),
    ),
  )
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
}

/**
 * 按页数选取渲染倍率（96 CSS px/in × scale ≈ DPI）：
 * 页少时 300dpi 足够打印清晰，页多时降到 150–200dpi 控制体积、内存与耗时
 */
export function defaultRasterScale(pageCount: number): number {
  if (pageCount <= 2) return 3.125 // 300dpi
  if (pageCount <= 6) return 2.5 // 240dpi
  if (pageCount <= 12) return 2.2 // ~211dpi
  if (pageCount <= 30) return 2 // 192dpi
  return 1.75 // 168dpi
}

/** JPEG 压缩质量：0.9 档在文字标签页上肉眼无损且体积约为 PNG 的 1/10 */
export const JPEG_QUALITY = 0.92

/** 栅格格式统一用 JPEG 有损压缩：标签页以文字为主，PNG 无损嵌入会导致体积失控 */
export function defaultImageFormat(_pageCount: number): 'png' | 'jpeg' {
  return 'jpeg'
}

/** 经验字节率（字节/像素）：文字为主的标签页在对应格式下的近似压缩比 */
const BYTES_PER_PIXEL: Record<'png' | 'jpeg', number> = { png: 0.35, jpeg: 0.09 }

/** 导出前的 PDF 体积预估（字节）：像素总量 × 经验字节率，供用户确认后再导出 */
export function estimatePdfBytes(options: {
  pageCount: number
  scale: number
  pageWidth: number
  pageHeight: number
  imageFormat?: 'png' | 'jpeg'
}): number {
  const { pageCount, scale, pageWidth, pageHeight } = options
  const format = options.imageFormat ?? defaultImageFormat(pageCount)
  const pxPerMm = (96 / 25.4) * scale
  const pixelsPerPage = pageWidth * pxPerMm * (pageHeight * pxPerMm)
  return Math.round(pageCount * pixelsPerPage * BYTES_PER_PIXEL[format])
}

/** 字节数 → 人类可读体积文案（如「12.3 MB」） */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
      format === 'png' ? undefined : JPEG_QUALITY,
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
  const pageTimeoutMs = options.pageTimeoutMs ?? DEFAULT_PAGE_TIMEOUT_MS
  const throwIfCancelled = () => {
    if (options.signal?.aborted) throw new Error(EXPORT_CANCELLED_MESSAGE)
  }

  /** 渲染单页一次：等节点完全就绪后再截图，并做空白页检测 */
  async function renderOnce(i: number): Promise<HTMLCanvasElement> {
    const injected = devForcedExportFailure(i)
    if (injected) throw injected
    const el = await getPage(i)
    await waitForElementReady(el)
    throwIfCancelled()
    const canvas = await withTimeout(
      html2canvas(el, {
        scale,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      }),
      pageTimeoutMs,
      `渲染超时（超过 ${Math.round(pageTimeoutMs / 1000)} 秒未完成）`,
    )
    if (isCanvasBlank(canvas)) throw new Error('页面渲染为空白')
    return canvas
  }

  for (let i = 0; i < pageCount; i++) {
    throwIfCancelled()
    if (i > 0) doc.addPage([pageWidth, pageHeight], orientation)
    let bytes: Uint8Array
    try {
      let canvas: HTMLCanvasElement
      try {
        canvas = await renderOnce(i)
      } catch (firstErr) {
        // 超时或空白自动重试一次；用户取消不重试
        const msg = firstErr instanceof Error ? firstErr.message : String(firstErr)
        if (msg === EXPORT_CANCELLED_MESSAGE) throw firstErr
        canvas = await renderOnce(i)
      }
      bytes = await canvasToImageBytes(canvas, imageFormat)
      // 释放大画布内存，避免大页数任务累计占用
      canvas.width = 0
      canvas.height = 0
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      if (detail === EXPORT_CANCELLED_MESSAGE) throw new Error(EXPORT_CANCELLED_MESSAGE)
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
