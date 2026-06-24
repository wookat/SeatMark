/**
 * 矢量 PDF 导出（pdf-lib）——文字可选、可复制、无限缩放清晰。
 *
 * 与 pdfExport.ts 的栅格化方案互补：
 * - 栅格化（html2canvas → jsPDF）：视觉效果与浏览器预览 100% 一致，但文字为图片
 * - 矢量化（pdf-lib）：文字为真矢量，可选可复制，字体从 CDN 加载开源思源字体
 *
 * 坐标系换算：模板用 mm / 左上角原点 / Y 向下；pdf-lib 用 pt / 左下角原点 / Y 向上。
 */

import {
  PDFDocument,
  PDFFont,
  PDFPage,
  rgb,
  type RGB,
} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

import type { DataRow, LabelTemplate, TemplateField } from '@/types/template'
import { cutLines, labelPosition } from '@/utils/layout'

/** 1mm → 1pt（72 / 25.4） */
const MM_TO_PT = 72 / 25.4

// ── 字体加载 ──────────────────────────────────────────────

type FontType = 'sans' | 'serif'

interface FontSet {
  regular: PDFFont
  bold: PDFFont
}

/** CDN 字体源（按优先级排列） */
const FONT_SOURCES: Record<FontType, { regular: string[]; bold: string[] }> = {
  sans: {
    regular: [
      'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5.1.0/files/noto-sans-sc-chinese-simplified-400-normal.woff',
      'https://fastly.jsdelivr.net/npm/@fontsource/noto-sans-sc@5.1.0/files/noto-sans-sc-chinese-simplified-400-normal.woff',
      'https://unpkg.com/@fontsource/noto-sans-sc@5.1.0/files/noto-sans-sc-chinese-simplified-400-normal.woff',
    ],
    bold: [
      'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5.1.0/files/noto-sans-sc-chinese-simplified-700-normal.woff',
      'https://fastly.jsdelivr.net/npm/@fontsource/noto-sans-sc@5.1.0/files/noto-sans-sc-chinese-simplified-700-normal.woff',
      'https://unpkg.com/@fontsource/noto-sans-sc@5.1.0/files/noto-sans-sc-chinese-simplified-700-normal.woff',
    ],
  },
  serif: {
    regular: [
      'https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-sc@5.1.0/files/noto-serif-sc-chinese-simplified-400-normal.woff',
      'https://fastly.jsdelivr.net/npm/@fontsource/noto-serif-sc@5.1.0/files/noto-serif-sc-chinese-simplified-400-normal.woff',
      'https://unpkg.com/@fontsource/noto-serif-sc@5.1.0/files/noto-serif-sc-chinese-simplified-400-normal.woff',
    ],
    bold: [
      'https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-sc@5.1.0/files/noto-serif-sc-chinese-simplified-700-normal.woff',
      'https://fastly.jsdelivr.net/npm/@fontsource/noto-serif-sc@5.1.0/files/noto-serif-sc-chinese-simplified-700-normal.woff',
      'https://unpkg.com/@fontsource/noto-serif-sc@5.1.0/files/noto-serif-sc-chinese-simplified-700-normal.woff',
    ],
  },
}

/** 内存字体缓存：同一 URL 的字体文件只下载一次 */
const fontBufferCache = new Map<string, ArrayBuffer>()

async function fetchFontBuffer(urls: string[]): Promise<ArrayBuffer> {
  for (const url of urls) {
    const cached = fontBufferCache.get(url)
    if (cached) return cached
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const buf = await res.arrayBuffer()
      fontBufferCache.set(url, buf)
      return buf
    } catch {
      // 尝试下一个 URL
    }
  }
  throw new Error('字体下载失败，请检查网络连接后重试')
}

/** 根据模板字体栈判断使用衬线还是无衬线开源字体 */
function determineFontType(fontFamily: string | undefined): FontType {
  if (!fontFamily) return 'serif' // 默认模板用宋体→衬线
  const lower = fontFamily.toLowerCase()
  const serifKeywords = ['simsun', 'songti', 'stsong', 'fangsong', 'serif', 'noto serif']
  return serifKeywords.some((kw) => lower.includes(kw)) ? 'serif' : 'sans'
}

// ── 颜色解析 ──────────────────────────────────────────────

function hexToRgb(hex: string): RGB {
  const cleaned = hex.replace('#', '').trim()
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0]! + cleaned[0], 16) / 255
    const g = parseInt(cleaned[1]! + cleaned[1], 16) / 255
    const b = parseInt(cleaned[2]! + cleaned[2], 16) / 255
    return rgb(r, g, b)
  }
  const r = parseInt(cleaned.slice(0, 2), 16) / 255
  const g = parseInt(cleaned.slice(2, 4), 16) / 255
  const b = parseInt(cleaned.slice(4, 6), 16) / 255
  return rgb(r, g, b)
}

function parseColor(color: string | undefined, fallback: RGB): RGB {
  if (!color) return fallback
  try {
    return hexToRgb(color)
  } catch {
    return fallback
  }
}

// ── 文本处理 ──────────────────────────────────────────────

/** 截断文本并添加省略号 */
function truncateText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, fontSize) <= maxWidth) return text
  const ellipsis = '…'
  const ellipsisWidth = font.widthOfTextAtSize(ellipsis, fontSize)
  let truncated = text
  while (truncated.length > 0 && font.widthOfTextAtSize(truncated + ellipsis, fontSize) > maxWidth - ellipsisWidth) {
    truncated = truncated.slice(0, -1)
  }
  return truncated + ellipsis
}

/** 按字符换行（中文 word-break: break-all 语义） */
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number, maxLines: number): string[] {
  if (!text) return []
  const lines: string[] = []
  let current = ''
  for (const char of text) {
    const test = current + char
    if (font.widthOfTextAtSize(test, fontSize) <= maxWidth) {
      current = test
    } else {
      if (current) lines.push(current)
      current = char
      if (lines.length >= maxLines) {
        // 已达最大行数，丢弃剩余内容
        current = ''
        break
      }
    }
  }
  if (current) lines.push(current)

  // 如果超出 maxLines，截断最后一行
  if (lines.length > maxLines) {
    lines.length = maxLines
    lines[maxLines - 1] = truncateText(lines[maxLines - 1]!, font, fontSize, maxWidth)
  }

  return lines
}

// ── 图片处理 ──────────────────────────────────────────────

/** 将 data URL 转为 Image 元素 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = src
  })
}

/**
 * 用 Canvas 将图片裁剪/缩放到目标尺寸，输出 JPEG Uint8Array。
 * cover = 填满裁切，contain = 等比完整显示。
 */
async function rasterizeImage(
  dataUrl: string,
  widthPt: number,
  heightPt: number,
  fit: 'cover' | 'contain',
): Promise<Uint8Array> {
  const img = await loadImage(dataUrl)
  const dpi = 300
  const wPx = Math.max(1, Math.round((widthPt / 72) * dpi))
  const hPx = Math.max(1, Math.round((heightPt / 72) * dpi))

  const canvas = document.createElement('canvas')
  canvas.width = wPx
  canvas.height = hPx
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, wPx, hPx)

  const imgAspect = img.width / img.height
  const canvasAspect = wPx / hPx

  let sx: number, sy: number, sw: number, sh: number
  if (fit === 'cover') {
    if (imgAspect > canvasAspect) {
      sh = img.height
      sw = img.height * canvasAspect
      sx = (img.width - sw) / 2
      sy = 0
    } else {
      sw = img.width
      sh = img.width / canvasAspect
      sx = 0
      sy = (img.height - sh) / 2
    }
  } else {
    if (imgAspect > canvasAspect) {
      sw = img.width
      sh = img.width / canvasAspect
      sx = 0
      sy = (img.height - sh) / 2
    } else {
      sh = img.height
      sw = img.height * canvasAspect
      sx = (img.width - sw) / 2
      sy = 0
    }
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, wPx, hPx)

  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92),
  )
  return new Uint8Array(await blob.arrayBuffer())
}

// ── 绘制函数 ──────────────────────────────────────────────

/** 绘制单枚标签卡片（边框 + 背景） */
function drawLabelCard(
  page: PDFPage,
  template: LabelTemplate,
  idx: number,
  pageHeightMm: number,
): void {
  const { label, showLabelBorder } = template
  const pos = labelPosition(template, idx)

  const xPt = pos.left * MM_TO_PT
  const wPt = label.width * MM_TO_PT
  const hPt = label.height * MM_TO_PT
  const yPt = (pageHeightMm - pos.top - label.height) * MM_TO_PT

  // 背景
  if (label.background && label.background !== '#ffffff' && label.background !== '#fff') {
    page.drawRectangle({
      x: xPt,
      y: yPt,
      width: wPt,
      height: hPt,
      color: parseColor(label.background, rgb(1, 1, 1)),
    })
  }

  // 边框
  if (showLabelBorder) {
    const borderWidthPt = (label.borderWidth ?? 0.2) * MM_TO_PT
    page.drawRectangle({
      x: xPt,
      y: yPt,
      width: wPt,
      height: hPt,
      borderColor: parseColor(label.borderColor ?? '#334155', rgb(0.2, 0.25, 0.33)),
      borderWidth: borderWidthPt,
    })
  }
}

/** 绘制文本字段 */
function drawTextField(
  page: PDFPage,
  field: TemplateField,
  text: string,
  fonts: FontSet,
  labelXMm: number,
  labelYMm: number,
  pageHeightMm: number,
): void {
  if (!text && !field.background) return

  const padMm = field.padding ?? 0.8
  const padPt = padMm * MM_TO_PT

  // 字段在页面上的绝对位置（mm，左上角原点）
  const fieldXMm = labelXMm + field.x
  const fieldYMm = labelYMm + field.y
  const fieldWMm = field.width
  const fieldHMm = field.height

  // 转 PDF 坐标（pt，左下角原点）
  const xPt = fieldXMm * MM_TO_PT
  const wPt = fieldWMm * MM_TO_PT
  const hPt = fieldHMm * MM_TO_PT
  const yTopPt = (pageHeightMm - fieldYMm) * MM_TO_PT // 字段顶边
  const yBottomPt = (pageHeightMm - fieldYMm - fieldHMm) * MM_TO_PT // 字段底边

  // 背景（色块 / 分隔线）
  if (field.background) {
    page.drawRectangle({
      x: xPt,
      y: yBottomPt,
      width: wPt,
      height: hPt,
      color: parseColor(field.background, rgb(0.8, 0.83, 0.88)),
    })
  }

  // 边框
  if (field.border) {
    const bwPt = (field.borderWidth ?? 0.2) * MM_TO_PT
    page.drawRectangle({
      x: xPt,
      y: yBottomPt,
      width: wPt,
      height: hPt,
      borderColor: parseColor(field.borderColor ?? '#64748b', rgb(0.39, 0.45, 0.55)),
      borderWidth: bwPt,
    })
  }

  if (!text) return

  // 字体选择
  const isBold = field.fontWeight === 'bold' || field.emphasis === 'hero'
  const font = isBold ? fonts.bold : fonts.regular

  // 字号
  let fontSize = field.fontSize ?? 12
  if (field.emphasis === 'hero') {
    // hero 在 CSS 中仅加重不放大；但模板设计器可能已设大字号
  }

  // 字距
  let letterSpacingPt: number | undefined
  if (field.letterSpacing != null) {
    letterSpacingPt = field.letterSpacing * fontSize
  }
  if (field.emphasis === 'hero') {
    // hero CSS: letter-spacing -0.02em
    letterSpacingPt = (field.letterSpacing ?? -0.02) * fontSize
  }

  // 文字颜色
  const textColor = parseColor(
    field.color ?? (isBold ? '#0f172a' : '#334155'),
    rgb(0.06, 0.09, 0.16),
  )

  // 拼接 caption + content
  let fullText = text
  if (field.caption) {
    fullText = `${field.caption} ${text}`
  }

  // 行高
  const lineHeightMultiplier = field.lineHeight ?? 1.15
  const maxLines = field.maxLines ?? 1

  // 可用宽度（减去左右 padding）
  const availWidthPt = wPt - 2 * padPt
  if (availWidthPt <= 0) return

  // 换行
  const lines = wrapText(fullText, font, fontSize, availWidthPt, maxLines)
  if (!lines.length) return

  // 计算行高
  const lineHeightPt = fontSize * lineHeightMultiplier
  const totalTextHeight = lines.length * lineHeightPt

  // 垂直对齐：计算第一行基线 Y
  const vAlign = field.verticalAlign ?? 'middle'
  let firstBaselineY: number
  if (vAlign === 'top') {
    firstBaselineY = yTopPt - padPt - fontSize * 0.8
  } else if (vAlign === 'bottom') {
    firstBaselineY = yBottomPt + padPt + fontSize * 0.2 + (totalTextHeight - lineHeightPt)
  } else {
    // middle
    const fieldMidPt = (yTopPt + yBottomPt) / 2
    firstBaselineY = fieldMidPt + (totalTextHeight / 2) - fontSize * 0.8
  }

  // 水平对齐
  const hAlign = field.align ?? 'center'

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const lineWidth = font.widthOfTextAtSize(line, fontSize)
    let textXPt: number
    if (hAlign === 'left') {
      textXPt = xPt + padPt
    } else if (hAlign === 'right') {
      textXPt = xPt + wPt - padPt - lineWidth
    } else {
      // center
      textXPt = xPt + (wPt - lineWidth) / 2
    }

    const baselineY = firstBaselineY - i * lineHeightPt

    page.drawText(line, {
      x: textXPt,
      y: baselineY,
      size: fontSize,
      font,
      color: textColor,
      ...(letterSpacingPt != null ? { characterSpacing: letterSpacingPt } : {}),
    })
  }
}

/** 绘制图片字段 */
async function drawImageField(
  pdfDoc: PDFDocument,
  page: PDFPage,
  field: TemplateField,
  imageSrc: string,
  labelXMm: number,
  labelYMm: number,
  pageHeightMm: number,
): Promise<void> {
  const fieldXMm = labelXMm + field.x
  const fieldYMm = labelYMm + field.y
  const wPt = field.width * MM_TO_PT
  const hPt = field.height * MM_TO_PT
  const xPt = fieldXMm * MM_TO_PT
  const yPt = (pageHeightMm - fieldYMm - field.height) * MM_TO_PT

  // SVG 矢量图标：跳过（pdf-lib 不支持 SVG）
  if (imageSrc.startsWith('data:image/svg')) return

  // 背景
  if (field.background) {
    page.drawRectangle({
      x: xPt,
      y: yPt,
      width: wPt,
      height: hPt,
      color: parseColor(field.background, rgb(0.97, 0.98, 0.99)),
    })
  }

  try {
    const isVector = imageSrc.startsWith('data:image/svg')
    const fit: 'cover' | 'contain' = isVector ? 'contain' : 'cover'
    const jpegBytes = await rasterizeImage(imageSrc, wPt, hPt, fit)
    const img = await pdfDoc.embedJpg(jpegBytes)
    page.drawImage(img, { x: xPt, y: yPt, width: wPt, height: hPt })
  } catch {
    // 图片加载失败：绘制占位
  }

  // 边框
  if (field.border) {
    const bwPt = (field.borderWidth ?? 0.2) * MM_TO_PT
    page.drawRectangle({
      x: xPt,
      y: yPt,
      width: wPt,
      height: hPt,
      borderColor: parseColor(field.borderColor ?? '#64748b', rgb(0.39, 0.45, 0.55)),
      borderWidth: bwPt,
    })
  }
}

/** 绘制裁切线 */
function drawCutLines(page: PDFPage, template: LabelTemplate, pageHeightMm: number): void {
  const lines = cutLines(template)
  const lineColor = rgb(0.47, 0.51, 0.59)
  const lineWidthPt = 0.35 * MM_TO_PT // 0.35mm

  for (const line of lines) {
    if (line.orientation === 'v') {
      const xPt = line.left * MM_TO_PT
      const yPt = (pageHeightMm - line.top - line.length) * MM_TO_PT
      page.drawLine({
        start: { x: xPt, y: yPt },
        end: { x: xPt, y: yPt + line.length * MM_TO_PT },
        thickness: lineWidthPt,
        color: lineColor,
        dashArray: [3, 2],
      })
    } else {
      const yPt = (pageHeightMm - line.top) * MM_TO_PT
      page.drawLine({
        start: { x: line.left * MM_TO_PT, y: yPt },
        end: { x: (line.left + line.length) * MM_TO_PT, y: yPt },
        thickness: lineWidthPt,
        color: lineColor,
        dashArray: [3, 2],
      })
    }
  }
}

// ── 下载触发 ──────────────────────────────────────────────

function downloadPdf(bytes: Uint8Array, fileName: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function defaultPdfFileName(prefix = '考场座位标签'): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `${prefix}-矢量-${stamp}.pdf`
}

// ── 主导出函数 ────────────────────────────────────────────

export interface VectorPdfOptions {
  showCutLines?: boolean
  fileName?: string
  onProgress?: (done: number, total: number) => void
}

export async function exportPagesToVectorPdf(
  template: LabelTemplate,
  pages: DataRow[][],
  getText: (row: DataRow, fieldId: string) => string,
  getPhoto: (row: DataRow) => string | null,
  options: VectorPdfOptions = {},
): Promise<void> {
  if (!pages.length) throw new Error('没有可导出的页面')

  // 1. 加载字体
  const fontType = determineFontType(template.fontFamily)
  const [regularBuf, boldBuf] = await Promise.all([
    fetchFontBuffer(FONT_SOURCES[fontType].regular),
    fetchFontBuffer(FONT_SOURCES[fontType].bold),
  ])

  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)

  const fonts: FontSet = {
    regular: await pdfDoc.embedFont(regularBuf, { subset: true }),
    bold: await pdfDoc.embedFont(boldBuf, { subset: true }),
  }

  const { paperWidth, paperHeight } = template.page
  const pageWidthPt = paperWidth * MM_TO_PT
  const pageHeightPt = paperHeight * MM_TO_PT

  // 2. 逐页绘制
  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pdfDoc.addPage([pageWidthPt, pageHeightPt])
    const rows = pages[pageIdx]!

    // 裁切线（绘制在最底层）
    if (options.showCutLines !== false) {
      drawCutLines(page, template, paperHeight)
    }

    // 逐枚标签
    for (let labelIdx = 0; labelIdx < rows.length; labelIdx++) {
      const row = rows[labelIdx]!
      const pos = labelPosition(template, labelIdx)

      // 标签卡片（边框 + 背景）
      drawLabelCard(page, template, labelIdx, paperHeight)

      // 字段
      for (const field of template.fields) {
        if (field.type === 'text') {
          const text = field.fixedText != null ? field.fixedText : getText(row, field.id)
          drawTextField(page, field, text, fonts, pos.left, pos.top, paperHeight)
        } else if (field.type === 'image') {
          let imageSrc: string | null = null
          if (field.imageSrc) {
            imageSrc = field.imageSrc
          } else {
            imageSrc = getPhoto(row)
          }
          if (imageSrc) {
            await drawImageField(pdfDoc, page, field, imageSrc, pos.left, pos.top, paperHeight)
          }
        }
      }
    }

    options.onProgress?.(pageIdx + 1, pages.length)
  }

  // 3. 保存并下载
  const pdfBytes = await pdfDoc.save()
  downloadPdf(pdfBytes, options.fileName ?? defaultPdfFileName())
}
