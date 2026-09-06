/**
 * 装饰层 SVG 白名单重建：模板可能来自分享链接 / 导入 JSON，只保留纯矢量标记，
 * 拒绝脚本、事件处理器、样式、外部引用与非 #id 的 url() 引用。
 */

const ALLOWED_ELEMENTS = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'defs',
  'linearGradient',
  'radialGradient',
  'stop',
  'clipPath',
  'mask',
  'pattern',
  'symbol',
  'use',
  'title',
  'desc',
])

const ALLOWED_ATTRS = new Set([
  // 根与结构
  'xmlns',
  'xmlns:xlink',
  'viewBox',
  'preserveAspectRatio',
  'id',
  'class',
  'width',
  'height',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'fx',
  'fy',
  'fr',
  'd',
  'points',
  'transform',
  'transform-origin',
  'href',
  'xlink:href',
  // 填充/描边/不透明度
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'opacity',
  'color',
  'paint-order',
  'vector-effect',
  'shape-rendering',
  // 渐变/图案/裁切/遮罩
  'stop-color',
  'stop-opacity',
  'offset',
  'gradientUnits',
  'gradientTransform',
  'spreadMethod',
  'patternUnits',
  'patternContentUnits',
  'patternTransform',
  'clipPathUnits',
  'maskUnits',
  'maskContentUnits',
  'clip-path',
  'clip-rule',
  'mask',
  'overflow',
])

const HREF_ATTRS = new Set(['href', 'xlink:href'])
const FRAGMENT_REF = /^#[A-Za-z_][\w.:-]*$/

function isSafeAttrValue(name: string, value: string): boolean {
  const v = value.trim()
  if (HREF_ATTRS.has(name)) return FRAGMENT_REF.test(v)
  // url(...) 只允许 url(#id)，其余（http/data/javascript）一律拒绝
  const urls = v.match(/url\(([^)]*)\)/gi)
  if (urls) {
    for (const u of urls) {
      const inner = u.slice(4, -1).trim().replace(/^['"]|['"]$/g, '')
      if (!FRAGMENT_REF.test(inner)) return false
    }
  }
  return !/javascript:|data:|expression\(|&#|<|>/i.test(v)
}

function sanitizeElement(el: Element): boolean {
  if (!ALLOWED_ELEMENTS.has(el.localName)) return false
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name
    const lower = name.toLowerCase()
    if (
      lower.startsWith('on') ||
      lower === 'style' ||
      !ALLOWED_ATTRS.has(name) ||
      !isSafeAttrValue(name, attr.value)
    ) {
      el.removeAttribute(name)
    }
  }
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      if (!sanitizeElement(child as Element)) el.removeChild(child)
    } else if (child.nodeType !== Node.TEXT_NODE) {
      // 注释 / CDATA / 处理指令一律移除
      el.removeChild(child)
    }
  }
  return true
}

/**
 * 返回重建后的 svg 字符串；非 svg 根、解析失败或运行环境无 DOMParser 时返回 null。
 * 结果仍需经 uniquifySvgIds 做 id 唯一化。
 */
export function sanitizeDecorSvg(svg: string): string | null {
  const s = svg.trim()
  if (!s.startsWith('<svg') || typeof DOMParser === 'undefined') return null
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(s, 'image/svg+xml')
  } catch {
    return null
  }
  const root = doc.documentElement
  if (!root || root.localName !== 'svg' || root.namespaceURI !== 'http://www.w3.org/2000/svg') {
    return null
  }
  if (doc.getElementsByTagName('parsererror').length > 0) return null
  if (!sanitizeElement(root)) return null
  return new XMLSerializer().serializeToString(root)
}
