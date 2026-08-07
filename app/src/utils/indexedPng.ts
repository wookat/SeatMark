/**
 * 调色板量化 + 索引色 PNG 编码（零依赖，深度压缩纯色标签页专用）。
 *
 * 标签页特点是大面积纯色 + 文字：量化到 ≤256 色后每像素仅 1 字节，
 * 再经 Flate 压缩，体积远小于 RGB JPEG/PNG，且文字边缘零损失
 * （调色板保留反锯齿过渡色）。产物为标准 color type 3 PNG，
 * jsPDF 解码后以 /Indexed 色彩空间 + Flate 直接嵌入 PDF 图片流，不再二次有损编码。
 */

/** 调色板上限：PNG 索引色规范上限，也足够覆盖文字反锯齿过渡色 */
export const MAX_PALETTE_COLORS = 256

/** 页面不同颜色数超过该值视为照片类内容，放弃量化（交回 JPEG 通道） */
export const MAX_UNIQUE_COLORS = 60_000

interface ColorCount {
  color: number
  count: number
}

/** 统计 24bit 精确颜色直方图；颜色数超上限返回 null（照片类内容不适合量化） */
export function countExactColors(data: Uint8ClampedArray): Map<number, number> | null {
  const counts = new Map<number, number>()
  for (let i = 0; i + 3 < data.length; i += 4) {
    const key = (data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!
    const prev = counts.get(key)
    if (prev === undefined) {
      if (counts.size >= MAX_UNIQUE_COLORS) return null
      counts.set(key, 1)
    } else {
      counts.set(key, prev + 1)
    }
  }
  return counts
}

/**
 * 加权 median-cut 量化：把颜色按最长轴反复对半切盒，
 * 每盒取加权平均色，得到 ≤256 色调色板。
 */
export function medianCutPalette(colors: ColorCount[], maxColors: number): number[] {
  type Box = ColorCount[]
  let boxes: Box[] = [colors.slice()]
  while (boxes.length < maxColors) {
    // 取颜色数最多的可再分盒
    let target = -1
    let best = 1
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i]!.length > best) {
        best = boxes[i]!.length
        target = i
      }
    }
    if (target < 0) break
    const box = boxes[target]!
    // 找跨度最大的通道
    let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0
    for (const { color } of box) {
      const r = (color >> 16) & 255
      const g = (color >> 8) & 255
      const b = color & 255
      if (r < minR) minR = r
      if (r > maxR) maxR = r
      if (g < minG) minG = g
      if (g > maxG) maxG = g
      if (b < minB) minB = b
      if (b > maxB) maxB = b
    }
    const spanR = maxR - minR
    const spanG = maxG - minG
    const spanB = maxB - minB
    const shift = spanG >= spanR && spanG >= spanB ? 8 : spanR >= spanB ? 16 : 0
    box.sort((a, b) => ((a.color >> shift) & 255) - ((b.color >> shift) & 255))
    const mid = Math.max(1, Math.floor(box.length / 2))
    boxes[target] = box.slice(0, mid)
    boxes.push(box.slice(mid))
  }
  return boxes.map((box) => {
    let r = 0, g = 0, b = 0, w = 0
    for (const { color, count } of box) {
      r += ((color >> 16) & 255) * count
      g += ((color >> 8) & 255) * count
      b += (color & 255) * count
      w += count
    }
    if (!w) return 0
    return (Math.round(r / w) << 16) | (Math.round(g / w) << 8) | Math.round(b / w)
  })
}

function nearestPaletteIndex(color: number, palette: number[]): number {
  const r = (color >> 16) & 255
  const g = (color >> 8) & 255
  const b = color & 255
  let bestIdx = 0
  let bestDist = Infinity
  for (let i = 0; i < palette.length; i++) {
    const p = palette[i]!
    const dr = r - ((p >> 16) & 255)
    const dg = g - ((p >> 8) & 255)
    const db = b - (p & 255)
    const dist = dr * dr + dg * dg + db * db
    if (dist < bestDist) {
      bestDist = dist
      bestIdx = i
      if (dist === 0) break
    }
  }
  return bestIdx
}

// ---------- PNG 容器写出 ----------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 255]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + payload.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, payload.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(payload, 8)
  view.setUint32(8 + payload.length, crc32(out.subarray(4, 8 + payload.length)))
  return out
}

async function zlibDeflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null
  try {
    const stream = new Blob([bytes.slice().buffer])
      .stream()
      .pipeThrough(new CompressionStream('deflate'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    return null
  }
}

/**
 * 把 RGBA 像素量化为 ≤256 色索引 PNG（color type 3）。
 * 不适合量化（颜色数爆炸 / 环境不支持 CompressionStream）时返回 null，
 * 由调用方回退到 JPEG / RGB PNG 通道。
 */
export async function encodeIndexedPng(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<Uint8Array | null> {
  if (!width || !height || data.length < width * height * 4) return null
  const counts = countExactColors(data)
  if (!counts) return null

  const colorList: ColorCount[] = []
  for (const [color, count] of counts) colorList.push({ color, count })

  let palette: number[]
  const indexOf = new Map<number, number>()
  if (colorList.length <= MAX_PALETTE_COLORS) {
    palette = colorList.map((c) => c.color)
    palette.forEach((color, i) => indexOf.set(color, i))
  } else {
    palette = medianCutPalette(colorList, MAX_PALETTE_COLORS)
    for (const { color } of colorList) indexOf.set(color, nearestPaletteIndex(color, palette))
  }

  // 每行前缀 filter 0（None）：索引数据没有像素间线性关系，预测滤波反而更差
  const raw = new Uint8Array(height * (width + 1))
  let src = 0
  let dst = 0
  for (let y = 0; y < height; y++) {
    raw[dst++] = 0
    for (let x = 0; x < width; x++) {
      const key = (data[src]! << 16) | (data[src + 1]! << 8) | data[src + 2]!
      raw[dst++] = indexOf.get(key)!
      src += 4
    }
  }
  const idat = await zlibDeflate(raw)
  if (!idat) return null

  const ihdr = new Uint8Array(13)
  const ihdrView = new DataView(ihdr.buffer)
  ihdrView.setUint32(0, width)
  ihdrView.setUint32(4, height)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 3 // color type: indexed
  const plte = new Uint8Array(palette.length * 3)
  palette.forEach((color, i) => {
    plte[i * 3] = (color >> 16) & 255
    plte[i * 3 + 1] = (color >> 8) & 255
    plte[i * 3 + 2] = color & 255
  })

  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const chunks = [signature, pngChunk('IHDR', ihdr), pngChunk('PLTE', plte), pngChunk('IDAT', idat), pngChunk('IEND', new Uint8Array(0))]
  const total = chunks.reduce((sum, c) => sum + c.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}
