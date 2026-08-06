import {
  createPageRenderer,
  defaultRasterScale,
  EXPORT_CANCELLED_MESSAGE,
} from '@/utils/pdfExport'
import { evaluateFieldTemplate } from '@/utils/fieldTemplate'
import type { DataRow } from '@/types/template'

/** CSS 像素密度：96 px/in ÷ 25.4 mm/in */
export const CSS_PX_PER_MM = 96 / 25.4

/** 精确像素输出的目标宽度上限（防误输入超大值导致内存爆掉） */
export const MAX_EXACT_PIXEL_WIDTH = 4096
/** 精确像素输出的目标宽度下限（低于此值文字不可读） */
export const MIN_EXACT_PIXEL_WIDTH = 100

/** 按模板设计尺寸（mm）把目标像素宽度映射为 html2canvas 渲染倍率 */
export function exactPixelScale(targetWidthPx: number, pageWidthMm: number): number {
  return targetWidthPx / (pageWidthMm * CSS_PX_PER_MM)
}

/** 按模板宽高比推导目标像素高度（宽度给定时高度四舍五入） */
export function exactPixelHeight(
  targetWidthPx: number,
  pageWidthMm: number,
  pageHeightMm: number,
): number {
  return Math.round((targetWidthPx * pageHeightMm) / pageWidthMm)
}

/** 校验精确像素宽度输入：整数且在 [100, 4096] 范围内 */
export function isValidExactPixelWidth(width: number): boolean {
  return (
    Number.isInteger(width) && width >= MIN_EXACT_PIXEL_WIDTH && width <= MAX_EXACT_PIXEL_WIDTH
  )
}

/**
 * RGBA 像素二值化（就地修改）：按感知亮度阈值把每个像素改为纯黑或纯白。
 * 电子墨水屏只认纯黑纯白，缩放产生的抗锯齿灰边会被墨水屏抖动成噪点。
 */
export function binarizePixelData(data: Uint8ClampedArray, threshold = 160): void {
  for (let i = 0; i + 3 < data.length; i += 4) {
    const luma = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!
    const v = luma >= threshold ? 255 : 0
    data[i] = v
    data[i + 1] = v
    data[i + 2] = v
    data[i + 3] = 255
  }
}

/** 多页 zip 内的单页文件名：前缀-001.png（三位页码，数百页名单排序稳定） */
export function pngPageFileName(prefix: string, pageIndex: number): string {
  return `${prefix}-${String(pageIndex + 1).padStart(3, '0')}.png`
}

/** 文件名单段最大长度（含中文按字符计），防超长字段撑爆解压工具 */
export const MAX_FILE_NAME_PART_LENGTH = 80

/**
 * 清洗文件名片段：去掉 Windows/macOS/Linux 均非法或危险的字符
 * （\ / : * ? " < > | 与控制字符），折叠空白，去首尾点号，限制长度。
 */
export function sanitizeFileNamePart(name: string): string {
  return name
    .replace(/\s+/g, ' ')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .slice(0, MAX_FILE_NAME_PART_LENGTH)
}

/**
 * 按名单字段模板串批量生成 zip 内文件名（含 .png 扩展名）：
 * - {列名} 占位符按该页对应行求值后清洗非法字符；
 * - 求值/清洗后为空（空行、空字段、纯非法字符）回退为 前缀-001 序号命名；
 * - 重名追加 -2、-3… 递增直至唯一（追加后再撞名继续递增）。
 */
export function buildFieldFileNames(options: {
  template: string
  rows: (DataRow | null)[]
  fallbackPrefix: string
}): string[] {
  const taken = new Set<string>()
  return options.rows.map((row, i) => {
    const raw = row ? evaluateFieldTemplate(options.template, row) : ''
    let base = sanitizeFileNamePart(raw)
    if (!base) base = `${options.fallbackPrefix}-${String(i + 1).padStart(3, '0')}`
    let name = base
    for (let n = 2; taken.has(name); n++) name = `${base}-${n}`
    taken.add(name)
    return `${name}.png`
  })
}

/** 电子墨水屏常见分辨率预设（主流会议电子桌牌与电子价签规格） */
export interface EinkPreset {
  id: string
  label: string
  width: number
  height: number
}

export const EINK_PRESETS: EinkPreset[] = [
  { id: 'eink-800x480', label: '800×480（7.5 英寸，主流会议桌牌）', width: 800, height: 480 },
  { id: 'eink-1280x720', label: '1280×720（10.2 英寸大尺寸桌牌）', width: 1280, height: 720 },
  { id: 'eink-648x480', label: '648×480（5.83 英寸）', width: 648, height: 480 },
  { id: 'eink-640x384', label: '640×384（7.5 英寸旧款）', width: 640, height: 384 },
  { id: 'eink-400x300', label: '400×300（4.2 英寸电子价签）', width: 400, height: 300 },
  { id: 'eink-296x128', label: '296×128（2.9 英寸电子价签）', width: 296, height: 128 },
]

export function findEinkPreset(id: string): EinkPreset | undefined {
  return EINK_PRESETS.find((p) => p.id === id)
}

/**
 * 预设宽高比与模板设计区域宽高比是否明显不一致（默认容差 2%）：
 * 不一致时输出会被拉伸，UI 据此提示换模板或改自定义宽度。
 */
export function presetAspectMismatch(
  preset: { width: number; height: number },
  designWidthMm: number,
  designHeightMm: number,
  tolerance = 0.02,
): boolean {
  const presetRatio = preset.width / preset.height
  const designRatio = designWidthMm / designHeightMm
  return Math.abs(presetRatio - designRatio) / designRatio > tolerance
}

export function defaultPngExportName(prefix = '考场座位标签'): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `${prefix}-${stamp}`
}

/** 精确像素模式的超采样倍数：先按 2 倍渲染再高质量缩到目标尺寸，文字边缘更平滑 */
export const EXACT_PIXEL_SUPERSAMPLE = 2

export interface PngExportOptions {
  pageCount: number
  /** 逐页取节点：仅在轮到该页时才要求其挂载（与 PDF 导出同一约定） */
  getPage: (index: number) => Promise<HTMLElement> | HTMLElement
  /** 模板页面宽度（mm），精确像素映射与文件命名需要 */
  pageWidth: number
  /** 模板页面高度（mm） */
  pageHeight: number
  /** 标准模式渲染倍率；未指定时按页数自动选取（与 PDF 一致） */
  scale?: number
  /** 精确像素输出：每页缩放到该宽高（如电子墨水屏 800×480） */
  exactPixels?: { width: number; height: number }
  /**
   * 精确像素模式的裁剪区域（mm，相对页面左上角）：
   * 每页 1 枚的模板（如电子座签）只取标签本体，不含纸张留白边距；
   * 未指定时缩放整页
   */
  cropRect?: { x: number; y: number; width: number; height: number }
  /** 纯黑白输出：按亮度阈值二值化（电子墨水屏黑白模板） */
  monochrome?: boolean
  /**
   * 纯黑白模式的水印文案：页面内的半透明水印会被二值化抹成纯白，
   * 改为二值化后在底部盖纯黑小字；非纯黑白模式由页面自身渲染，无需传入
   */
  watermarkText?: string
  /** 文件名（不含扩展名）；单页存为 .png，多页打包为 .zip */
  fileName?: string
  /**
   * 多页 zip 内逐页文件名（含 .png 扩展名，调用方保证唯一）；
   * 未指定时按 前缀-001.png 序号命名
   */
  pageFileNames?: string[]
  signal?: AbortSignal
  pageTimeoutMs?: number
  rebuildHost?: () => Promise<void> | void
  onProgress?: (done: number, total: number) => void
}

/** 渲染画布 → 目标 PNG 画布：精确像素缩放（可选源区域裁剪）+ 可选二值化 */
export function toOutputCanvas(
  source: HTMLCanvasElement,
  options: {
    exactPixels?: { width: number; height: number }
    monochrome?: boolean
    watermarkText?: string
    /** 源画布上的裁剪区域（px）；未指定时取整幅 */
    sourceRect?: { x: number; y: number; width: number; height: number }
  },
): HTMLCanvasElement {
  let canvas = source
  if (options.exactPixels) {
    const { width, height } = options.exactPixels
    const src = options.sourceRect ?? { x: 0, y: 0, width: source.width, height: source.height }
    const target = document.createElement('canvas')
    target.width = width
    target.height = height
    const ctx = target.getContext('2d')
    if (!ctx) throw new Error('无法创建输出画布（2D 上下文不可用）')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(source, src.x, src.y, src.width, src.height, 0, 0, width, height)
    canvas = target
  }
  if (options.monochrome) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('无法读取画布像素（2D 上下文不可用）')
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
    binarizePixelData(image.data)
    ctx.putImageData(image, 0, 0)
    if (options.watermarkText) {
      const fontSize = Math.max(10, Math.round(canvas.height * 0.03))
      ctx.fillStyle = '#000000'
      ctx.font = `${fontSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(options.watermarkText, canvas.width / 2, canvas.height - fontSize * 0.5)
      // 文字抗锯齿会引入灰度像素，再二值化一次保持纯黑白（阈值放宽保住笔画）
      const stamped = ctx.getImageData(0, 0, canvas.width, canvas.height)
      binarizePixelData(stamped.data, 200)
      ctx.putImageData(stamped, 0, 0)
    }
  }
  return canvas
}

async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('页面栅格化失败（toBlob 返回空）'))),
      'image/png',
    )
  })
}

/** 触发浏览器下载并释放对象 URL */
function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  // 延迟释放：部分浏览器点击后立即 revoke 会中断下载
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * 分页分批导出 PNG：复用 PDF 的单页渲染链路（看门狗/空白检测/重试/重建容器/取消），
 * 单页直接下载 PNG，多页打包 zip（jszip 按需加载）。
 * 配额规则由调用方掌握：与 PDF 一致，成功后才扣无水印次数。
 */
export async function exportPagedPng(options: PngExportOptions): Promise<void> {
  const { pageCount } = options
  if (!pageCount) throw new Error('没有可导出的页面')

  const { default: html2canvas } = await import('html2canvas-pro')

  // 精确像素：按裁剪区域（未裁剪则整页）的设计宽度映射渲染倍率，
  // 先按 2 倍超采样渲染再高质量缩到目标尺寸，文字边缘更平滑
  const designWidthMm = options.cropRect?.width ?? options.pageWidth
  const scale = options.exactPixels
    ? exactPixelScale(options.exactPixels.width, designWidthMm) * EXACT_PIXEL_SUPERSAMPLE
    : (options.scale ?? defaultRasterScale(pageCount))
  const pxPerMm = CSS_PX_PER_MM * scale
  const sourceRect =
    options.exactPixels && options.cropRect
      ? {
          x: options.cropRect.x * pxPerMm,
          y: options.cropRect.y * pxPerMm,
          width: options.cropRect.width * pxPerMm,
          height: options.cropRect.height * pxPerMm,
        }
      : undefined
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

  const baseName = options.fileName ?? defaultPngExportName()

  if (pageCount === 1) {
    const canvas = await renderPage(0)
    const output = toOutputCanvas(canvas, { ...options, sourceRect })
    const blob = await canvasToPngBlob(output)
    canvas.width = 0
    canvas.height = 0
    throwIfCancelled()
    downloadBlob(blob, `${baseName}.png`)
    options.onProgress?.(1, 1)
    return
  }

  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  for (let i = 0; i < pageCount; i++) {
    throwIfCancelled()
    const canvas = await renderPage(i)
    const output = toOutputCanvas(canvas, { ...options, sourceRect })
    const blob = await canvasToPngBlob(output)
    // 释放大画布内存，避免大页数任务累计占用
    canvas.width = 0
    canvas.height = 0
    if (output !== canvas) {
      output.width = 0
      output.height = 0
    }
    zip.file(options.pageFileNames?.[i] ?? pngPageFileName(baseName, i), blob)
    options.onProgress?.(i + 1, pageCount)
  }
  throwIfCancelled()
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(zipBlob, `${baseName}.zip`)
}
