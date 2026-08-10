/**
 * 生僻字字体覆盖检测：中日韩扩展区（扩A/扩B及以上）的生僻汉字在多数
 * 设备字体中缺字，预览与导出会显示为方块（豆腐块）。导入名单时提前
 * 检测并提醒用户，而不是等打印出来才发现。
 *
 * 判定方法：把待测字符与一个保证无字形的非字符码位（U+FFFF）分别画到
 * 离屏 canvas 上，像素完全一致即认为当前环境没有该字的字形。
 */

/** 命中才值得上 canvas 检测的码位区间（常用汉字/字母数字不检测） */
function isRareCodePoint(cp: number): boolean {
  return (
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK 扩展 A
    (cp >= 0x20000 && cp <= 0x3ffff) || // CJK 扩展 B–H
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK 兼容表意文字
    (cp >= 0x2f800 && cp <= 0x2fa1f) // CJK 兼容表意文字补充
  )
}

const FONT = '32px system-ui, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif'
const SIZE = 40

let ctx: CanvasRenderingContext2D | null | undefined
let tofuPixels: string | null = null
const cache = new Map<string, boolean>()

function renderPixels(context: CanvasRenderingContext2D, char: string): string {
  context.clearRect(0, 0, SIZE, SIZE)
  context.font = FONT
  context.textBaseline = 'top'
  context.fillText(char, 2, 2)
  return String.fromCharCode(...new Uint8Array(context.getImageData(0, 0, SIZE, SIZE).data.buffer))
}

function getContext(): CanvasRenderingContext2D | null {
  if (ctx !== undefined) return ctx
  try {
    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE
    ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (ctx) tofuPixels = renderPixels(ctx, '\uffff')
  } catch {
    ctx = null
  }
  return ctx ?? null
}

/** 当前环境是否有该字符的字形；检测不可用（如无 canvas）时按「有」处理 */
export function isGlyphSupported(char: string): boolean {
  const cached = cache.get(char)
  if (cached !== undefined) return cached
  const context = getContext()
  let supported = true
  if (context && tofuPixels != null) {
    try {
      supported = renderPixels(context, char) !== tofuPixels
    } catch {
      supported = true
    }
  }
  cache.set(char, supported)
  return supported
}

/**
 * 扫描一批文本，返回当前环境缺字形的生僻字（去重，最多 limit 个）。
 * 只检测扩展区/兼容区码位，常用文本零开销。
 */
export function findUnsupportedChars(values: Iterable<unknown>, limit = 5): string[] {
  const seen = new Set<string>()
  const missing: string[] = []
  for (const value of values) {
    if (typeof value !== 'string') continue
    for (const char of value) {
      const cp = char.codePointAt(0)
      if (cp == null || !isRareCodePoint(cp) || seen.has(char)) continue
      seen.add(char)
      if (!isGlyphSupported(char)) {
        missing.push(char)
        if (missing.length >= limit) return missing
      }
    }
  }
  return missing
}
