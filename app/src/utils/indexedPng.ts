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

/** 量化质量下限（PSNR，dB）：低于该值说明调色板不够表达页面颜色，放弃量化 */
export const MIN_QUANTIZE_PSNR = 40

/**
 * 局部（分块）量化质量下限：白底文字页上小面积照片/多向渐变
 * 会被整页 count 加权 PSNR 掩盖，按 ≤ BLOCK_SIZE 方块单独计误差，
 * 任一块低于该值即放弃量化（交回 JPEG / RGB PNG 回退通道）。
 */
export const MIN_QUANTIZE_BLOCK_PSNR = 33
export const QUANTIZE_BLOCK_SIZE = 64

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

/**
 * 在 PNG 字节流的 IHDR 之后插入 pHYs 物理分辨率块（像素/米），
 * 打印/看图软件据此换算物理尺寸；已有 pHYs 时原样返回
 */
export function withPngPhys(bytes: Uint8Array, pixelsPerMeter: number): Uint8Array {
  // 签名 8 字节 + IHDR 块 25 字节（长度 4 + 类型 4 + 载荷 13 + CRC 4）
  const insertAt = 33
  if (bytes.length < insertAt) return bytes
  if (findChunkType(bytes, 'pHYs') >= 0) return bytes
  const payload = new Uint8Array(9)
  const view = new DataView(payload.buffer)
  const ppm = Math.round(pixelsPerMeter)
  view.setUint32(0, ppm)
  view.setUint32(4, ppm)
  payload[8] = 1 // 单位：米
  const phys = pngChunk('pHYs', payload)
  const out = new Uint8Array(bytes.length + phys.length)
  out.set(bytes.subarray(0, insertAt), 0)
  out.set(phys, insertAt)
  out.set(bytes.subarray(insertAt), insertAt + phys.length)
  return out
}

function findChunkType(bytes: Uint8Array, type: string): number {
  let offset = 8
  while (offset + 8 <= bytes.length) {
    const length =
      (bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!
    const name = String.fromCharCode(
      bytes[offset + 4]!,
      bytes[offset + 5]!,
      bytes[offset + 6]!,
      bytes[offset + 7]!,
    )
    if (name === type) return offset
    if (name === 'IEND') return -1
    offset += 12 + (length >>> 0)
  }
  return -1
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

/** 按调色板实际色数选位深：≤2 色 1bit、≤4 色 2bit、≤16 色 4bit，否则 8bit */
export function paletteBitDepth(paletteSize: number): 1 | 2 | 4 | 8 {
  if (paletteSize <= 2) return 1
  if (paletteSize <= 4) return 2
  if (paletteSize <= 16) return 4
  return 8
}

/** 把一行索引按位深打包进扫描行字节（MSB 在前，末尾不足一字节补 0） */
export function packIndexRow(indices: Uint8Array, bitDepth: 1 | 2 | 4 | 8): Uint8Array {
  if (bitDepth === 8) return indices
  const perByte = 8 / bitDepth
  const out = new Uint8Array(Math.ceil(indices.length / perByte))
  for (let i = 0; i < indices.length; i++) {
    const shift = 8 - bitDepth - (i % perByte) * bitDepth
    out[Math.floor(i / perByte)] = out[Math.floor(i / perByte)]! | (indices[i]! << shift)
  }
  return out
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
  // 量化分支下每个颜色的平方误差，供分块局部质量检查使用；精确调色板分支零误差无需检查
  let quantErrOf: Map<number, number> | null = null
  if (colorList.length <= MAX_PALETTE_COLORS) {
    palette = colorList.map((c) => c.color)
    palette.forEach((color, i) => indexOf.set(color, i))
  } else {
    palette = medianCutPalette(colorList, MAX_PALETTE_COLORS)
    let sqErr = 0
    let pixels = 0
    quantErrOf = new Map<number, number>()
    for (const { color, count } of colorList) {
      const idx = nearestPaletteIndex(color, palette)
      indexOf.set(color, idx)
      const p = palette[idx]!
      const dr = ((color >> 16) & 255) - ((p >> 16) & 255)
      const dg = ((color >> 8) & 255) - ((p >> 8) & 255)
      const db = (color & 255) - (p & 255)
      const err = dr * dr + dg * dg + db * db
      quantErrOf.set(color, err)
      sqErr += err * count
      pixels += count
    }
    // 量化误差过大（细腻渐变/多向渐变超出 256 色表达力）时放弃，交回 JPEG / RGB PNG 通道
    const mse = pixels ? sqErr / (pixels * 3) : 0
    if (mse > 0 && 10 * Math.log10((255 * 255) / mse) < MIN_QUANTIZE_PSNR) return null
    if (mse === 0) quantErrOf = null
  }

  // 位深按实际色数自适应：黑白/双色模板 1bit，少色模板 2/4bit，压缩前体积直降 8/4/2 倍
  const bitDepth = paletteBitDepth(palette.length)
  const rowBytes = Math.ceil((width * bitDepth) / 8)
  // 每行前缀 filter 0（None）：索引数据没有像素间线性关系，预测滤波反而更差
  const raw = new Uint8Array(height * (rowBytes + 1))
  const rowIndices = new Uint8Array(width)
  // 分块局部误差：小面积照片/多向渐变会被整页加权 PSNR 掩盖，按方块单独累计
  const blocksX = Math.ceil(width / QUANTIZE_BLOCK_SIZE)
  const blockErr = quantErrOf ? new Float64Array(blocksX * Math.ceil(height / QUANTIZE_BLOCK_SIZE)) : null
  let src = 0
  let dst = 0
  for (let y = 0; y < height; y++) {
    raw[dst++] = 0
    const blockRow = (y / QUANTIZE_BLOCK_SIZE) | 0
    for (let x = 0; x < width; x++) {
      const key = (data[src]! << 16) | (data[src + 1]! << 8) | data[src + 2]!
      rowIndices[x] = indexOf.get(key)!
      if (blockErr) {
        const err = quantErrOf!.get(key)
        if (err) blockErr[blockRow * blocksX + ((x / QUANTIZE_BLOCK_SIZE) | 0)] += err
      }
      src += 4
    }
    raw.set(packIndexRow(rowIndices, bitDepth), dst)
    dst += rowBytes
  }
  if (blockErr) {
    // 末行/末列不满块按满块像素数计，只会把阈值判得更宽松，不会误报
    const blockPixels = QUANTIZE_BLOCK_SIZE * QUANTIZE_BLOCK_SIZE
    const maxBlockMse = 255 * 255 * Math.pow(10, -MIN_QUANTIZE_BLOCK_PSNR / 10)
    for (let b = 0; b < blockErr.length; b++) {
      if (blockErr[b]! / (blockPixels * 3) > maxBlockMse) return null
    }
  }
  const idat = await zlibDeflate(raw)
  if (!idat) return null

  const ihdr = new Uint8Array(13)
  const ihdrView = new DataView(ihdr.buffer)
  ihdrView.setUint32(0, width)
  ihdrView.setUint32(4, height)
  ihdr[8] = bitDepth
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
