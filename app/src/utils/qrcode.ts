/**
 * 轻量 QR 码生成器（无第三方依赖，约 3KB gzip）。
 * 移植自 Project Nayuki 的 QR Code generator（MIT License），
 * 精简为字节模式 + 自动选择最小版本，输出布尔模块矩阵与 SVG path。
 * https://www.nayuki.io/page/qr-code-generator-library
 */

type Ecc = 'L' | 'M' | 'Q' | 'H'

const ECC_FORMAT_BITS: Record<Ecc, number> = { L: 1, M: 0, Q: 3, H: 2 }

/** [version-1][ecc] -> 纠错码字数/块 */
const ECC_CODEWORDS_PER_BLOCK: Record<Ecc, number[]> = {
  L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
}

const NUM_ERROR_CORRECTION_BLOCKS: Record<Ecc, number[]> = {
  L: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
}

function getNumRawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2
    result -= (25 * numAlign - 10) * numAlign - 55
    if (ver >= 7) result -= 36
  }
  return result
}

function getNumDataCodewords(ver: number, ecc: Ecc): number {
  return (
    Math.floor(getNumRawDataModules(ver) / 8) -
    ECC_CODEWORDS_PER_BLOCK[ecc][ver - 1]! * NUM_ERROR_CORRECTION_BLOCKS[ecc][ver - 1]!
  )
}

// ---------- Reed-Solomon (GF 256, 0x11D) ----------
function reedSolomonComputeDivisor(degree: number): number[] {
  const result: number[] = []
  for (let i = 0; i < degree - 1; i++) result.push(0)
  result.push(1)
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j]!, root)
      if (j + 1 < result.length) result[j]! ^= result[j + 1]!
    }
    root = gfMultiply(root, 0x02)
  }
  return result
}

function reedSolomonComputeRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const result = divisor.map(() => 0)
  for (const b of data) {
    const factor = b ^ result.shift()!
    result.push(0)
    divisor.forEach((coef, i) => {
      result[i]! ^= gfMultiply(coef, factor)
    })
  }
  return result
}

function gfMultiply(x: number, y: number): number {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z
}

// ---------- 主编码流程 ----------
class BitBuffer {
  bits: number[] = []
  appendBits(val: number, len: number): void {
    for (let i = len - 1; i >= 0; i--) this.bits.push((val >>> i) & 1)
  }
}

function getAlignmentPatternPositions(ver: number): number[] {
  if (ver === 1) return []
  const numAlign = Math.floor(ver / 7) + 2
  const size = ver * 4 + 17
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2
  const result = [6]
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos)
  return result
}

/** 生成 QR 模块矩阵：true = 深色模块 */
export function encodeQr(text: string, ecc: Ecc = 'M'): boolean[][] {
  const data = Array.from(new TextEncoder().encode(text))

  // 选择能容纳数据的最小版本（1–40）
  let version = 1
  for (; version <= 40; version++) {
    const capacityBits = getNumDataCodewords(version, ecc) * 8
    const headerBits = 4 + (version <= 9 ? 8 : 16)
    if (headerBits + data.length * 8 <= capacityBits) break
    if (version === 40) throw new Error('QR 数据过长')
  }

  // 字节模式段
  const bb = new BitBuffer()
  bb.appendBits(0x4, 4)
  bb.appendBits(data.length, version <= 9 ? 8 : 16)
  for (const b of data) bb.appendBits(b, 8)

  // 终止符与填充
  const dataCapacityBits = getNumDataCodewords(version, ecc) * 8
  bb.appendBits(0, Math.min(4, dataCapacityBits - bb.bits.length))
  bb.appendBits(0, (8 - (bb.bits.length % 8)) % 8)
  for (let padByte = 0xec; bb.bits.length < dataCapacityBits; padByte ^= 0xec ^ 0x11) {
    bb.appendBits(padByte, 8)
  }
  const dataCodewords: number[] = []
  bb.bits.forEach((bit, i) => {
    if (i % 8 === 0) dataCodewords.push(0)
    dataCodewords[dataCodewords.length - 1]! |= bit << (7 - (i % 8))
  })

  // 分块 + Reed-Solomon 纠错 + 交织
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecc][version - 1]!
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecc][version - 1]!
  const rawCodewords = Math.floor(getNumRawDataModules(version) / 8)
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks)
  const shortBlockLen = Math.floor(rawCodewords / numBlocks)
  const blocks: number[][] = []
  const rsDiv = reedSolomonComputeDivisor(blockEccLen)
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = dataCodewords.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1))
    k += dat.length
    const eccBytes = reedSolomonComputeRemainder(dat, rsDiv)
    if (i < numShortBlocks) dat.push(0)
    blocks.push(dat.concat(eccBytes))
  }
  const allCodewords: number[] = []
  for (let i = 0; i < blocks[0]!.length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) allCodewords.push(block[i]!)
    })
  }

  // 画功能图形
  const size = version * 4 + 17
  const modules: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false))
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false))

  function setFunctionModule(x: number, y: number, isDark: boolean): void {
    modules[y]![x] = isDark
    isFunction[y]![x] = true
  }

  // 时序图形
  for (let i = 0; i < size; i++) {
    setFunctionModule(6, i, i % 2 === 0)
    setFunctionModule(i, 6, i % 2 === 0)
  }
  // 定位图形
  function drawFinderPattern(x: number, y: number): void {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy))
        const xx = x + dx
        const yy = y + dy
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) {
          setFunctionModule(xx, yy, dist !== 2 && dist !== 4)
        }
      }
    }
  }
  drawFinderPattern(3, 3)
  drawFinderPattern(size - 4, 3)
  drawFinderPattern(3, size - 4)
  // 对齐图形
  const alignPos = getAlignmentPatternPositions(version)
  const numAlign = alignPos.length
  for (let i = 0; i < numAlign; i++) {
    for (let j = 0; j < numAlign; j++) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === numAlign - 1) ||
        (i === numAlign - 1 && j === 0)
      ) {
        continue
      }
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          setFunctionModule(
            alignPos[i]! + dx,
            alignPos[j]! + dy,
            Math.max(Math.abs(dx), Math.abs(dy)) !== 1,
          )
        }
      }
    }
  }
  // 格式信息占位（后面按掩码重画）
  function drawFormatBits(mask: number): void {
    const fmtData = (ECC_FORMAT_BITS[ecc] << 3) | mask
    let rem = fmtData
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const bits = ((fmtData << 10) | rem) ^ 0x5412
    for (let i = 0; i <= 5; i++) setFunctionModule(8, i, ((bits >>> i) & 1) !== 0)
    setFunctionModule(8, 7, ((bits >>> 6) & 1) !== 0)
    setFunctionModule(8, 8, ((bits >>> 7) & 1) !== 0)
    setFunctionModule(7, 8, ((bits >>> 8) & 1) !== 0)
    for (let i = 9; i < 15; i++) setFunctionModule(14 - i, 8, ((bits >>> i) & 1) !== 0)
    for (let i = 0; i < 8; i++) setFunctionModule(size - 1 - i, 8, ((bits >>> i) & 1) !== 0)
    for (let i = 8; i < 15; i++) setFunctionModule(8, size - 15 + i, ((bits >>> i) & 1) !== 0)
    setFunctionModule(8, size - 8, true)
  }
  drawFormatBits(0)
  // 版本信息（version >= 7）
  if (version >= 7) {
    let rem = version
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const bits = (version << 12) | rem
    for (let i = 0; i < 18; i++) {
      const isDark = ((bits >>> i) & 1) !== 0
      const a = size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      setFunctionModule(a, b, isDark)
      setFunctionModule(b, a, isDark)
    }
  }

  // 铺数据位（Z 字回旋）
  let bitIndex = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const upward = ((right + 1) & 2) === 0
        const y = upward ? size - 1 - vert : vert
        if (!isFunction[y]![x] && bitIndex < allCodewords.length * 8) {
          modules[y]![x] =
            ((allCodewords[bitIndex >>> 3]! >>> (7 - (bitIndex & 7))) & 1) !== 0
          bitIndex++
        }
      }
    }
  }

  // 应用掩码并选惩罚分最低者
  function applyMask(mask: number): void {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let invert: boolean
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break
          case 1: invert = y % 2 === 0; break
          case 2: invert = x % 3 === 0; break
          case 3: invert = (x + y) % 3 === 0; break
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break
          default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break
        }
        if (!isFunction[y]![x] && invert) modules[y]![x] = !modules[y]![x]
      }
    }
  }

  function getPenaltyScore(): number {
    let result = 0
    // 行/列连续同色
    for (let y = 0; y < size; y++) {
      let runColor = false
      let runX = 0
      for (let x = 0; x < size; x++) {
        if (modules[y]![x] === runColor) {
          runX++
          if (runX === 5) result += 3
          else if (runX > 5) result++
        } else {
          runColor = modules[y]![x]!
          runX = 1
        }
      }
    }
    for (let x = 0; x < size; x++) {
      let runColor = false
      let runY = 0
      for (let y = 0; y < size; y++) {
        if (modules[y]![x] === runColor) {
          runY++
          if (runY === 5) result += 3
          else if (runY > 5) result++
        } else {
          runColor = modules[y]![x]!
          runY = 1
        }
      }
    }
    // 2×2 同色块
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const c = modules[y]![x]
        if (c === modules[y]![x + 1] && c === modules[y + 1]![x] && c === modules[y + 1]![x + 1]) {
          result += 3
        }
      }
    }
    // 深色比例
    let dark = 0
    for (const row of modules) for (const cell of row) if (cell) dark++
    const total = size * size
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1
    result += k * 10
    return result
  }

  let minPenalty = Infinity
  let bestMask = 0
  for (let mask = 0; mask < 8; mask++) {
    applyMask(mask)
    drawFormatBits(mask)
    const penalty = getPenaltyScore()
    if (penalty < minPenalty) {
      minPenalty = penalty
      bestMask = mask
    }
    applyMask(mask) // 掩码为异或运算，再次应用即撤销
  }
  applyMask(bestMask)
  drawFormatBits(bestMask)

  return modules
}

/** 把模块矩阵渲染为 SVG 字符串（含 4 模块静区，深色 #0f172a 白底） */
export function qrToSvg(text: string, ecc: Ecc = 'M'): string {
  const modules = encodeQr(text, ecc)
  const size = modules.length
  const border = 4
  const dim = size + border * 2
  let path = ''
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y]![x]) path += `M${x + border},${y + border}h1v1h-1z`
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">` +
    `<rect width="${dim}" height="${dim}" fill="#ffffff"/>` +
    `<path d="${path}" fill="#0f172a"/></svg>`
  )
}
