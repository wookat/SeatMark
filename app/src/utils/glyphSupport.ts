/**
 * 生僻字字体覆盖检测：中日韩扩展区（扩A/扩B及以上）的生僻汉字在多数
 * 设备字体中缺字，预览与导出会显示为方块（豆腐块）。导入名单时提前
 * 检测并提醒用户，而不是等打印出来才发现。
 *
 * 判定方法：把待测字符与一个保证无字形的非字符码位（U+FFFF）分别画到
 * 离屏 canvas 上，像素完全一致即认为当前环境没有该字的字形。
 */

import { RARE_CJK_FAMILY } from '@/data/fonts'

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
const tofuCache = new Map<string, string>()
const cache = new Map<string, boolean>()

function renderPixels(context: CanvasRenderingContext2D, char: string, font: string): string {
  context.clearRect(0, 0, SIZE, SIZE)
  context.font = font
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
  } catch {
    ctx = null
  }
  return ctx ?? null
}

function tofuPixelsFor(context: CanvasRenderingContext2D, font: string): string {
  let pixels = tofuCache.get(font)
  if (pixels === undefined) {
    pixels = renderPixels(context, '\uffff', font)
    tofuCache.set(font, pixels)
  }
  return pixels
}

/** 当前环境是否有该字符的字形；检测不可用（如无 canvas）时按「有」处理 */
export function isGlyphSupported(char: string, font: string = FONT): boolean {
  const key = `${font}\u0000${char}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached
  const context = getContext()
  let supported = true
  if (context) {
    try {
      supported = renderPixels(context, char, font) !== tofuPixelsFor(context, font)
    } catch {
      supported = true
    }
  }
  cache.set(key, supported)
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

/**
 * 触发文本中生僻字对应扩展字库分包的下载并等待完成：截图/栅格化前调用，
 * 避免分包在渲染中途才就绪导致字形缺失或整枚标签渲染为空白。
 */
export async function loadRareGlyphFonts(text: string): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load) return
  const rare = new Set<string>()
  for (const char of text) {
    const cp = char.codePointAt(0)
    if (cp != null && isRareCodePoint(cp)) rare.add(char)
  }
  if (!rare.size) return
  try {
    const font = `32px '${RARE_CJK_FAMILY}'`
    await Promise.all([...rare].map((char) => document.fonts.load(font, char)))
  } catch {
    // 加载失败不阻塞调用方：字形缺失由检测/警告链路兜底
  }
}

/**
 * 尝试用生僻字扩展字库（遍黑体分包，unicode-range 按需下载）兜底一批
 * 缺字形字符：触发对应分包下载后重新检测，返回扩展字库也覆盖不了的字符
 * （如离线/下载失败时返回全部，调用方据此降级为原有警告）。
 */
export async function resolveWithExtendedFont(chars: string[]): Promise<string[]> {
  if (!chars.length) return []
  const font = `32px '${RARE_CJK_FAMILY}'`
  try {
    if (typeof document === 'undefined' || !document.fonts?.load) return chars
    await Promise.all(chars.map((char) => document.fonts.load(font, char)))
    return chars.filter((char) => !isGlyphSupported(char, font))
  } catch {
    return chars
  }
}
