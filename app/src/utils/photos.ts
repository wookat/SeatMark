export interface PhotoLoadResult {
  photos: Map<string, string>
  matched: number
  unmatched: number
  errors: string[]
}

/** 由文件头魔数识别出的图片类型 */
export type PhotoKind = 'jpeg' | 'png' | 'gif' | 'bmp' | 'webp' | 'heif' | 'svg'

/** 导入照片长边上限（px）。54×86mm 证卡照片区按 300dpi 约 640×1016，1000px 仍充裕 */
export const PHOTO_MAX_EDGE = 1000
/** 降采样后 JPEG 输出质量 */
export const PHOTO_JPEG_QUALITY = 0.9

/**
 * 可替换的降采样实现：返回降采样后的 dataURL；返回 null 表示无需/无法降采样（沿用原文件）。
 * 抛错同样视为失败，由调用方回退到原 dataURL。
 */
export type PhotoResizer = (file: File, kind: PhotoKind) => Promise<string | null>

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('读取失败'))
    reader.readAsDataURL(file)
  })
}

/** 根据文件头魔数判断图片格式（JPEG/PNG/GIF/WebP/BMP/HEIC系/SVG），不可识别返回 null */
export async function detectPhotoKind(file: File): Promise<PhotoKind | null> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  if (head.length < 4) return null
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg'
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'png'
  if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x38) return 'gif'
  if (head[0] === 0x42 && head[1] === 0x4d) return 'bmp'
  if (
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  )
    return 'webp' // RIFF....WEBP
  if (head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) return 'heif' // ftyp（HEIC/AVIF 等）
  // SVG：文本开头为 "<"（允许 BOM/空白前缀）
  const text = new TextDecoder().decode(head).replace(/^\ufeff/, '').trimStart()
  return text.startsWith('<') ? 'svg' : null
}

/** 矢量 / 动图不降采样，保留原文件 */
export function shouldDownsample(kind: PhotoKind): boolean {
  return kind !== 'svg' && kind !== 'gif'
}

/** 长边超过 maxEdge 时等比缩至上限；不超过返回 null */
export function fitWithinMaxEdge(
  width: number,
  height: number,
  maxEdge = PHOTO_MAX_EDGE,
): { width: number; height: number } | null {
  const longEdge = Math.max(width, height)
  if (!(longEdge > maxEdge) || width <= 0 || height <= 0) return null
  const scale = maxEdge / longEdge
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** 输出格式：PNG（可能含透明）保持 PNG，其余统一 JPEG */
export function pickOutputFormat(kind: PhotoKind): { mime: string; quality?: number } {
  return kind === 'png' ? { mime: 'image/png' } : { mime: 'image/jpeg', quality: PHOTO_JPEG_QUALITY }
}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void }

async function decodeWithImageBitmap(file: File): Promise<Decoded> {
  const bitmap = await createImageBitmap(file)
  return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
}

function decodeWithImageElement(file: File): Promise<Decoded> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () =>
      resolve({
        source: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        release: () => URL.revokeObjectURL(url),
      })
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片解码失败'))
    }
    img.src = url
  })
}

async function decodePhoto(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await decodeWithImageBitmap(file)
    } catch {
      // 部分浏览器对 HEIC/WebP 等格式 createImageBitmap 失败，回退 <img> 解码
    }
  }
  return decodeWithImageElement(file)
}

/** 默认降采样：createImageBitmap（不支持回退 Image + objectURL）绘到 canvas，长边 ≤ PHOTO_MAX_EDGE */
export const resizePhoto: PhotoResizer = async (file, kind) => {
  if (typeof document === 'undefined') return null
  // 先确认解码与 2d canvas 能力可用（不可用的环境直接沿用原图，不做解码）
  if (typeof createImageBitmap !== 'function' && typeof URL.createObjectURL !== 'function') return null
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const decoded = await decodePhoto(file)
  try {
    const target = fitWithinMaxEdge(decoded.width, decoded.height)
    if (!target) return null
    canvas.width = target.width
    canvas.height = target.height
    ctx.drawImage(decoded.source, 0, 0, target.width, target.height)
    const { mime, quality } = pickOutputFormat(kind)
    const dataUrl = canvas.toDataURL(mime, quality)
    return dataUrl.startsWith(`data:${mime}`) ? dataUrl : null
  } finally {
    decoded.release()
  }
}

/**
 * 读取单张照片为 dataURL：位图格式先降采样（长边 ≤ 1000px），SVG/GIF 保留原文件；
 * 降采样失败或无需降采样时回退原文件 dataURL，保证不丢照片。
 */
export async function loadPhotoDataUrl(
  file: File,
  kind: PhotoKind,
  resize: PhotoResizer = resizePhoto,
): Promise<string> {
  if (shouldDownsample(kind)) {
    try {
      const resized = await resize(file, kind)
      if (resized) return resized
    } catch {
      // 解码/绘制失败：回退原图
    }
  }
  return readAsDataURL(file)
}

/** 包含匹配时要求值至少 2 个字符，避免「1」「A」这类短值大面积误命中 */
const MIN_FUZZY_LENGTH = 2

/**
 * 文件名（去扩展名）匹配数据值：
 * 1. 完全一致优先；
 * 2. 否则取文件名中「包含」的最长值（如 张伟2023010101.jpg 同时包含姓名与学号，
 *    以姓名列匹配命中“张伟”，以学号列匹配命中“2023010101”）。
 */
function findMatch(
  baseName: string,
  matchValues: Set<string>,
): { key: string; exact: boolean } | null {
  if (matchValues.has(baseName)) return { key: baseName, exact: true }
  let best: string | null = null
  for (const value of matchValues) {
    if (value.length < MIN_FUZZY_LENGTH) continue
    if (!baseName.includes(value)) continue
    if (!best || value.length > best.length) best = value
  }
  return best ? { key: best, exact: false } : null
}

/**
 * 按匹配规则批量读取照片；同一数据值命中多个文件时，完全一致的文件优先。
 * 不匹配的文件会被跳过并记录原因。逐张串行处理以控制解码峰值内存。
 */
export async function loadPhotoFiles(
  files: File[],
  matchValues: Set<string>,
  options: { resize?: PhotoResizer } = {},
): Promise<PhotoLoadResult> {
  const result: PhotoLoadResult = { photos: new Map(), matched: 0, unmatched: 0, errors: [] }
  /** key -> 是否由完全一致命中（用于决定能否被后续文件覆盖） */
  const exactKeys = new Set<string>()

  const loadOne = async (file: File) => {
    const baseName = file.name.replace(/\.[^.]+$/, '')
    const match = findMatch(baseName, matchValues)
    if (!match) {
      result.unmatched++
      result.errors.push(`${file.name} - 未找到匹配的数据行（文件名需等于或包含匹配列的值）`)
      return
    }
    // 已有完全一致的照片时，不被包含匹配的文件覆盖
    if (exactKeys.has(match.key) && !match.exact) {
      result.matched++
      return
    }
    try {
      const kind = await detectPhotoKind(file)
      if (!kind) {
        result.unmatched++
        result.errors.push(`${file.name} - 不是有效的图片文件（内容无法识别，可能是改名或损坏的文件）`)
        return
      }
      result.photos.set(match.key, await loadPhotoDataUrl(file, kind, options.resize))
      if (match.exact) exactKeys.add(match.key)
      result.matched++
    } catch {
      result.unmatched++
      result.errors.push(`${file.name} - 读取失败`)
    }
  }

  for (const file of files) await loadOne(file)

  return result
}
