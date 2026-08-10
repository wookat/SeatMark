import type { PrintCalibration } from '@/utils/calibration'
import { encodeIndexedPng } from '@/utils/indexedPng'

export interface PdfExportOptions {
  /** html2canvas 渲染倍率，4 约等于 384dpi；未指定时按页数自动选取 */
  scale?: number
  /**
   * 栅格格式：auto 按每页内容自适应（大面积纯色页走无损 PNG 深度压缩，
   * 渐变/照片页走 JPEG）；也可强制指定 png / jpeg
   */
  imageFormat?: 'png' | 'jpeg' | 'auto'
  /** 产物去向：save 直接触发下载（默认）；blob 返回 Blob（移动端分享/打印通道用） */
  output?: 'save' | 'blob'
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
  /**
   * 重建离屏渲染容器：长会话（多次模板切换）后容器可能劣化，
   * 单页「重试仍失败」时调用一次并做最后一次重渲，仍失败才报错
   */
  rebuildHost?: () => Promise<void> | void
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

/** 就绪等待属于尽力而为：给 Promise 加“到时即放行”的兜底，防止其永不落定拖死导出 */
export function settleWithin<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([
    promise.catch(() => undefined),
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms)),
  ])
}

/** 字体就绪等待上限：在线字体加载卡死时 document.fonts.ready 可能永不落定 */
export const FONTS_READY_WAIT_MS = 3_000
/** 图片 decode / load 等待上限：失效的图片源不应拖死整次导出 */
export const IMAGES_READY_WAIT_MS = 5_000

/**
 * 等待页面节点真正就绪再截图：字体加载完成（document.fonts.ready）
 * + 节点内图片全部 decode + 双 requestAnimationFrame 确保完成布局与绘制。
 * 各项等待均有时间上限：就绪等待只能拖慢截图，不允许永久挂起导出。
 */
export async function waitForElementReady(el: HTMLElement): Promise<void> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    await settleWithin(document.fonts.ready.then(() => undefined), FONTS_READY_WAIT_MS)
  }
  const images = Array.from(el.querySelectorAll('img'))
  await settleWithin(
    Promise.all(
      images.map((img) =>
        img.complete
          ? img.decode().catch(() => undefined)
          : new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true })
              img.addEventListener('error', () => resolve(), { once: true })
            }),
      ),
    ),
    IMAGES_READY_WAIT_MS,
  )
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
}

/**
 * 栅格化引擎不支持 -webkit-line-clamp 多行裁剪：预览中被省略号截断的
 * 超长文本会以全部行绘制并相互叠压。截图前把被裁剪字段的文本物理截断为
 * 「可见前缀 + 省略号」，与预览显示保持一致（所见即所得）。
 * 只处理确实溢出的字段；宿主每次导出都会重新挂载，改动不会泄漏到预览。
 */
export function truncateClampedText(root: HTMLElement): void {
  const overflows = (body: HTMLElement) => body.scrollHeight > body.clientHeight + 1
  for (const body of Array.from(root.querySelectorAll<HTMLElement>('.label-field__body'))) {
    if (!overflows(body)) continue
    const content = body.querySelector<HTMLElement>('.label-field__content')
    if (!content) continue
    // 按码点切分：不劈开 emoji / 增补平面字符
    const chars = Array.from(content.textContent ?? '')
    if (!chars.length) continue
    // 二分找最长能放下的前缀（含省略号）
    let lo = 0
    let hi = chars.length
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      content.textContent = `${chars.slice(0, mid).join('')}…`
      if (overflows(body)) hi = mid - 1
      else lo = mid
    }
    content.textContent = `${chars.slice(0, lo).join('')}…`
  }
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

/**
 * 按标签物理尺寸自适应渲染倍率：在按页数选档的基础上，
 * 大尺寸标签（桌牌/席卡，观看距离远）限制上限档位避免过采样：
 * 短边 ≥120mm 限 240dpi，≥80mm 限 ≈269dpi；小标签（小字多）不降档。
 */
export function adaptiveRasterScale(
  pageCount: number,
  label?: { width: number; height: number },
): number {
  const base = defaultRasterScale(pageCount)
  if (!label) return base
  const minSide = Math.min(label.width, label.height)
  const cap = minSide >= 120 ? 2.5 : minSide >= 80 ? 2.8 : Infinity
  return Math.min(base, cap)
}

/** JPEG 压缩质量：0.9 档在文字标签页上肉眼无损且体积约为 PNG 的 1/10 */
export const JPEG_QUALITY = 0.92

/** 渐变/照片页的 JPEG 质量随页数自适应：页多时适度降档控制总体积 */
export function jpegQualityFor(pageCount: number): number {
  if (pageCount <= 12) return JPEG_QUALITY
  if (pageCount <= 30) return 0.9
  return 0.87
}

/** 栅格格式默认自适应：纯色为主的页走无损 PNG（Flate 深度压缩），富色彩页走 JPEG */
export function defaultImageFormat(_pageCount: number): 'png' | 'jpeg' | 'auto' {
  return 'auto'
}

/**
 * 页面内容分类：flat = 大面积纯色（典型文字标签页，适合调色板级 Flate 压缩），
 * rich = 渐变 / 照片等富色彩内容（适合 JPEG）。
 */
export type PageContentKind = 'flat' | 'rich'

/** 分类采样参数：主色 TOP N 覆盖率达到阈值即视为纯色为主 */
export const CLASSIFY_TOP_COLORS = 24
export const CLASSIFY_FLAT_COVERAGE = 0.9

/**
 * RGBA 像素分类（纯函数，便于单测）：颜色量化到 5bit/通道后统计直方图，
 * 出现最多的 TOP N 个颜色覆盖比例 ≥ 阈值则视为 flat。
 * 文字反锯齿产生的过渡色像素占比很小，不影响判定；
 * 渐变 / 照片的颜色分布分散，覆盖率显著偏低。
 */
export function classifyPixelColors(data: Uint8ClampedArray | number[]): PageContentKind {
  const counts = new Map<number, number>()
  let total = 0
  for (let i = 0; i + 3 < data.length; i += 4) {
    const key = ((data[i]! >> 3) << 10) | ((data[i + 1]! >> 3) << 5) | (data[i + 2]! >> 3)
    counts.set(key, (counts.get(key) ?? 0) + 1)
    total++
  }
  if (!total) return 'flat'
  const sorted = [...counts.values()].sort((a, b) => b - a)
  let covered = 0
  for (let i = 0; i < Math.min(CLASSIFY_TOP_COLORS, sorted.length); i++) covered += sorted[i]!
  return covered / total >= CLASSIFY_FLAT_COVERAGE ? 'flat' : 'rich'
}

/**
 * canvas 内容分类：整幅缩到小画布后取像素做直方图判定。
 * 环境不支持 2D 上下文时按 rich 处理（JPEG 永远安全，只是体积略大）。
 */
export function classifyCanvasContent(canvas: HTMLCanvasElement): PageContentKind {
  if (!canvas.width || !canvas.height) return 'flat'
  try {
    const w = Math.min(canvas.width, 256)
    const h = Math.max(1, Math.round((canvas.height * w) / canvas.width))
    const probe = document.createElement('canvas')
    probe.width = w
    probe.height = h
    const ctx = probe.getContext('2d', { willReadFrequently: true })
    if (!ctx) return 'rich'
    ctx.drawImage(canvas, 0, 0, w, h)
    return classifyPixelColors(ctx.getImageData(0, 0, w, h).data)
  } catch {
    return 'rich'
  }
}

/** 经验字节率（字节/像素）：auto 为纯色页 Flate + 富彩页 JPEG 混合后的典型值 */
const BYTES_PER_PIXEL: Record<'png' | 'jpeg' | 'auto', number> = {
  png: 0.35,
  jpeg: 0.09,
  auto: 0.05,
}

/** 导出前的 PDF 体积预估（字节）：像素总量 × 经验字节率，供用户确认后再导出 */
export function estimatePdfBytes(options: {
  pageCount: number
  scale: number
  pageWidth: number
  pageHeight: number
  imageFormat?: 'png' | 'jpeg' | 'auto'
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
 * FNV-1a 字节哈希（hex）：作为 jsPDF addImage 的 alias——
 * 相同内容的页面图像字节一致，jsPDF 复用同一 XObject，
 * 模板页大量重复时只嵌一份图像数据。
 */
export function bytesAlias(bytes: Uint8Array): string {
  let h1 = 0x811c9dc5
  let h2 = 0x1000193
  for (let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i]!, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ bytes[i]!, 0x85ebca6b) >>> 0
  }
  return `img-${bytes.length.toString(36)}-${h1.toString(36)}-${h2.toString(36)}`
}

/** 整页取像素做调色板量化；不适合量化或环境不支持时返回 null（回退 JPEG / 原生 PNG） */
export async function rasterizeIndexedPng(canvas: HTMLCanvasElement): Promise<Uint8Array | null> {
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return await encodeIndexedPng(data, canvas.width, canvas.height)
  } catch {
    return null
  }
}

/**
 * canvas → 压缩图像字节（经 toBlob，避免 toDataURL 生成超长字符串
 * 触发 "Invalid string length"），jsPDF 直接接收 Uint8Array。
 */
async function canvasToImageBytes(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpeg',
  jpegQuality = JPEG_QUALITY,
): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('页面栅格化失败（toBlob 返回空）'))),
      format === 'png' ? 'image/png' : 'image/jpeg',
      format === 'png' ? undefined : jpegQuality,
    )
  })
  return new Uint8Array(await blob.arrayBuffer())
}

type Html2CanvasFn = (
  el: HTMLElement,
  options: { scale: number; useCORS: boolean; backgroundColor: string; logging: boolean },
) => Promise<HTMLCanvasElement>

export interface PageRendererOptions {
  pageCount: number
  getPage: (index: number) => Promise<HTMLElement> | HTMLElement
  scale: number
  signal?: AbortSignal
  pageTimeoutMs?: number
  rebuildHost?: () => Promise<void> | void
}

/**
 * 单页渲染链路（PDF 与 PNG 导出共用）：
 * 看门狗超时 + 空白检测 + 自动重试一次 + 重建容器兜底重渲，
 * 任一环节挂起或失败都会以「第 N/M 页渲染失败」报错，绝不静默输出空白页。
 */
export function createPageRenderer(
  options: PageRendererOptions,
  html2canvas: Html2CanvasFn,
): (index: number) => Promise<HTMLCanvasElement> {
  const { pageCount, getPage, scale } = options
  const pageTimeoutMs = options.pageTimeoutMs ?? DEFAULT_PAGE_TIMEOUT_MS
  const throwIfCancelled = () => {
    if (options.signal?.aborted) throw new Error(EXPORT_CANCELLED_MESSAGE)
  }

  /** 渲染单页一次：等节点完全就绪后再截图，并做空白页检测 */
  function renderOnce(i: number): Promise<HTMLCanvasElement> {
    // 看门狗覆盖整条单页链路（挂载节点 + 就绪等待 + 栅格化），
    // 任一环节挂起都会在超时后报错，杜绝“无提示、无产物”的静默失败
    return withTimeout(
      (async () => {
        const injected = devForcedExportFailure(i)
        if (injected) throw injected
        const el = await getPage(i)
        await waitForElementReady(el)
        truncateClampedText(el)
        throwIfCancelled()
        const canvas = await html2canvas(el, {
          scale,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
        })
        if (isCanvasBlank(canvas)) throw new Error('页面渲染为空白')
        return canvas
      })(),
      pageTimeoutMs,
      `渲染超时（超过 ${Math.round(pageTimeoutMs / 1000)} 秒未完成）`,
    )
  }

  const isCancelError = (err: unknown) =>
    err instanceof Error && err.message === EXPORT_CANCELLED_MESSAGE

  return async function renderPage(i: number): Promise<HTMLCanvasElement> {
    try {
      try {
        return await renderOnce(i)
      } catch (firstErr) {
        // 超时或空白自动重试一次；用户取消不重试
        if (isCancelError(firstErr)) throw firstErr
        try {
          return await renderOnce(i)
        } catch (secondErr) {
          // 重试仍失败：重建离屏容器后做最后一次重渲（长会话容器劣化的兜底）
          if (isCancelError(secondErr) || !options.rebuildHost) throw secondErr
          await options.rebuildHost()
          return await renderOnce(i)
        }
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      if (detail === EXPORT_CANCELLED_MESSAGE) throw new Error(EXPORT_CANCELLED_MESSAGE)
      throw new Error(`第 ${i + 1}/${pageCount} 页渲染失败：${detail}`)
    }
  }
}

/**
 * 分页分批导出：逐页栅格化后立即写入 PDF 并释放画布内存，
 * 单页失败会抛错并附带页码；页面尺寸跟随模板纸张。
 * 依赖按需加载，避免拖慢首屏。
 */
export async function exportPagedPdf(options: PagedPdfExportOptions): Promise<Blob | undefined> {
  const { pageCount } = options
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
  const throwIfCancelled = () => {
    if (options.signal?.aborted) throw new Error(EXPORT_CANCELLED_MESSAGE)
  }
  const renderPage = createPageRenderer(
    {
      pageCount,
      getPage: options.getPage,
      scale,
      signal: options.signal,
      pageTimeoutMs: options.pageTimeoutMs,
      rebuildHost: options.rebuildHost,
    },
    html2canvas,
  )

  const jpegQuality = jpegQualityFor(pageCount)

  for (let i = 0; i < pageCount; i++) {
    throwIfCancelled()
    if (i > 0) doc.addPage([pageWidth, pageHeight], orientation)
    const canvas = await renderPage(i)
    // 页面栅格化耗时最长，期间的取消需在写入前再检一次，否则末页取消仍会落盘
    throwIfCancelled()
    const cal = options.calibration
    const x = cal?.offsetX ?? 0
    const y = cal?.offsetY ?? 0
    const w = pageWidth * (cal?.scaleX ?? 1)
    const h = pageHeight * (cal?.scaleY ?? 1)
    // 逐页自适应压缩：纯色为主的标签页调色板量化为索引色 PNG（jsPDF 以
    // /Indexed + Flate 嵌入，每像素 1 字节且文字边缘无损），
    // 渐变 / 照片页走 JPEG（质量随页数自适应，jsPDF 直接透传不二次编码）
    let embedded = false
    if (imageFormat === 'auto' && classifyCanvasContent(canvas) === 'flat') {
      const indexed = await rasterizeIndexedPng(canvas)
      if (indexed) {
        doc.addImage(indexed, 'PNG', x, y, w, h, bytesAlias(indexed), 'SLOW')
        embedded = true
      }
    }
    if (!embedded) {
      const format = imageFormat === 'png' ? 'png' : 'jpeg'
      const bytes = await canvasToImageBytes(canvas, format, jpegQuality)
      if (format === 'png') {
        doc.addImage(bytes, 'PNG', x, y, w, h, bytesAlias(bytes), 'SLOW')
      } else {
        doc.addImage(bytes, 'JPEG', x, y, w, h, bytesAlias(bytes))
      }
    }
    // 释放大画布内存，避免大页数任务累计占用
    canvas.width = 0
    canvas.height = 0
    options.onProgress?.(i + 1, pageCount)
  }

  throwIfCancelled()
  if (options.output === 'blob') return doc.output('blob')
  doc.save(options.fileName ?? defaultPdfFileName())
  return undefined
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
