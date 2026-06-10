/**
 * 字体目录（中文 + 英文）：系统本地字体 + 在线开源字体。
 * - 系统字体（cssUrls 为空）直接本机渲染，零网络请求；
 * - 在线字体样式表按需从公共 CDN 加载（首选 Google Fonts，备选国内镜像 / jsDelivr / unpkg），
 *   仅在用户主动选择某款字体时才发起网络请求，默认状态保持完全离线。
 *   所列在线字体均为开源授权（SIL OFL / Apache 2.0），可免费商用。
 */

export type FontLang = 'zh' | 'en'

export interface WebFont {
  id: string
  /** 选择器中的展示名 */
  name: string
  /** CSS font-family 名称 */
  family: string
  lang: FontLang
  /** 风格分类（黑体 / 宋体 / 楷体 / 手写 / Sans / Serif…） */
  category: string
  /** 候选样式表地址，按顺序尝试（应对网络环境差异）；为空表示系统本地字体 */
  cssUrls: string[]
  /** 选择器中的预览文字（也用于触发分包字体下载） */
  preview: string
  /** 回退字体栈 */
  fallback: string
  /** 系统本地字体：无需联网加载 */
  local?: boolean
}

/** 系统默认字体栈：宋体（正式考务文档风格，本机渲染，零网络） */
export const DEFAULT_FONT_STACK = "'SimSun', 'Songti SC', 'STSong', serif"

/** 系统默认西文字体栈：Times New Roman（与宋体搭配的经典考务组合，本机渲染） */
export const DEFAULT_FONT_STACK_EN = "'Times New Roman', Times, serif"

/** Google Fonts 官方源 + 国内可用镜像 */
const GOOGLE_CSS_HOSTS = ['https://fonts.googleapis.com', 'https://fonts.loli.net']

function googleCss(family: string, weights: number[] = [400, 700]): string[] {
  const fam = family.replace(/ /g, '+')
  const wght = weights.length ? `:wght@${weights.join(';')}` : ''
  return GOOGLE_CSS_HOSTS.map((host) => `${host}/css2?family=${fam}${wght}&display=swap`)
}

const ZH_SANS_FALLBACK = "'Microsoft YaHei', 'PingFang SC', sans-serif"
const ZH_SERIF_FALLBACK = "'SimSun', 'Songti SC', serif"
const ZH_KAI_FALLBACK = "'KaiTi', 'STKaiti', serif"

export const WEB_FONTS: WebFont[] = [
  // ---------- 中文 · 系统字体（本机渲染，无需联网） ----------
  {
    id: 'sys-songti',
    name: '宋体',
    family: 'SimSun',
    lang: 'zh',
    category: '宋体',
    cssUrls: [],
    preview: '考场座位签 12号',
    fallback: "'Songti SC', 'STSong', serif",
    local: true,
  },
  {
    id: 'sys-heiti',
    name: '黑体（微软雅黑）',
    family: 'Microsoft YaHei',
    lang: 'zh',
    category: '黑体',
    cssUrls: [],
    preview: '考场座位签 12号',
    fallback: "'PingFang SC', 'Heiti SC', sans-serif",
    local: true,
  },
  {
    id: 'sys-kaiti',
    name: '楷体',
    family: 'KaiTi',
    lang: 'zh',
    category: '楷体',
    cssUrls: [],
    preview: '考场座位签 12号',
    fallback: "'STKaiti', 'Kaiti SC', serif",
    local: true,
  },
  {
    id: 'sys-fangsong',
    name: '仿宋',
    family: 'FangSong',
    lang: 'zh',
    category: '仿宋',
    cssUrls: [],
    preview: '考场座位签 12号',
    fallback: "'STFangsong', 'FangSong_GB2312', serif",
    local: true,
  },

  // ---------- 英文 · 系统字体（本机渲染，无需联网） ----------
  {
    id: 'sys-times',
    name: 'Times New Roman',
    family: 'Times New Roman',
    lang: 'en',
    category: 'Serif',
    cssUrls: [],
    preview: 'Seat No.12 AaBb',
    fallback: 'Times, serif',
    local: true,
  },
  {
    id: 'sys-georgia',
    name: 'Georgia',
    family: 'Georgia',
    lang: 'en',
    category: 'Serif',
    cssUrls: [],
    preview: 'Seat No.12 AaBb',
    fallback: "'Times New Roman', serif",
    local: true,
  },
  {
    id: 'sys-arial',
    name: 'Arial',
    family: 'Arial',
    lang: 'en',
    category: 'Sans',
    cssUrls: [],
    preview: 'Seat No.12 AaBb',
    fallback: "'Helvetica Neue', Helvetica, sans-serif",
    local: true,
  },
  {
    id: 'sys-courier',
    name: 'Courier New',
    family: 'Courier New',
    lang: 'en',
    category: 'Mono',
    cssUrls: [],
    preview: 'Seat No.12 0123',
    fallback: 'Courier, monospace',
    local: true,
  },

  // ---------- 中文 ----------
  {
    id: 'noto-sans-sc',
    name: '思源黑体',
    family: 'Noto Sans SC',
    lang: 'zh',
    category: '黑体',
    cssUrls: googleCss('Noto Sans SC'),
    preview: '考场座位签 12号',
    fallback: ZH_SANS_FALLBACK,
  },
  {
    id: 'noto-serif-sc',
    name: '思源宋体',
    family: 'Noto Serif SC',
    lang: 'zh',
    category: '宋体',
    cssUrls: googleCss('Noto Serif SC'),
    preview: '考场座位签 12号',
    fallback: ZH_SERIF_FALLBACK,
  },
  {
    id: 'lxgw-wenkai',
    name: '霞鹜文楷',
    family: 'LXGW WenKai',
    lang: 'zh',
    category: '楷体',
    cssUrls: [
      'https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css',
      'https://fastly.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css',
      'https://unpkg.com/lxgw-wenkai-webfont@1.7.0/style.css',
    ],
    preview: '考场座位签 12号',
    fallback: ZH_KAI_FALLBACK,
  },
  {
    id: 'zcool-xiaowei',
    name: '站酷小薇',
    family: 'ZCOOL XiaoWei',
    lang: 'zh',
    category: '标题',
    cssUrls: googleCss('ZCOOL XiaoWei', [400]),
    preview: '考场座位签 12号',
    fallback: ZH_SERIF_FALLBACK,
  },
  {
    id: 'zcool-huangyou',
    name: '站酷庆科黄油体',
    family: 'ZCOOL QingKe HuangYou',
    lang: 'zh',
    category: '标题',
    cssUrls: googleCss('ZCOOL QingKe HuangYou', [400]),
    preview: '考场座位签 12号',
    fallback: ZH_SANS_FALLBACK,
  },
  {
    id: 'ma-shan-zheng',
    name: '马善政楷书',
    family: 'Ma Shan Zheng',
    lang: 'zh',
    category: '手写',
    cssUrls: googleCss('Ma Shan Zheng', [400]),
    preview: '考场座位签 12号',
    fallback: ZH_KAI_FALLBACK,
  },
  {
    id: 'zhi-mang-xing',
    name: '志莽行书',
    family: 'Zhi Mang Xing',
    lang: 'zh',
    category: '手写',
    cssUrls: googleCss('Zhi Mang Xing', [400]),
    preview: '考场座位签 12号',
    fallback: ZH_KAI_FALLBACK,
  },
  {
    id: 'long-cang',
    name: '龙藏手书',
    family: 'Long Cang',
    lang: 'zh',
    category: '手写',
    cssUrls: googleCss('Long Cang', [400]),
    preview: '考场座位签 12号',
    fallback: ZH_KAI_FALLBACK,
  },

  // ---------- 英文 ----------
  {
    id: 'inter',
    name: 'Inter',
    family: 'Inter',
    lang: 'en',
    category: 'Sans',
    cssUrls: googleCss('Inter'),
    preview: 'Seat No.12 AaBb',
    fallback: 'sans-serif',
  },
  {
    id: 'roboto',
    name: 'Roboto',
    family: 'Roboto',
    lang: 'en',
    category: 'Sans',
    cssUrls: googleCss('Roboto'),
    preview: 'Seat No.12 AaBb',
    fallback: 'sans-serif',
  },
  {
    id: 'open-sans',
    name: 'Open Sans',
    family: 'Open Sans',
    lang: 'en',
    category: 'Sans',
    cssUrls: googleCss('Open Sans'),
    preview: 'Seat No.12 AaBb',
    fallback: 'sans-serif',
  },
  {
    id: 'montserrat',
    name: 'Montserrat',
    family: 'Montserrat',
    lang: 'en',
    category: 'Sans',
    cssUrls: googleCss('Montserrat'),
    preview: 'Seat No.12 AaBb',
    fallback: 'sans-serif',
  },
  {
    id: 'oswald',
    name: 'Oswald',
    family: 'Oswald',
    lang: 'en',
    category: 'Display',
    cssUrls: googleCss('Oswald'),
    preview: 'Seat No.12 AaBb',
    fallback: 'sans-serif',
  },
  {
    id: 'bebas-neue',
    name: 'Bebas Neue',
    family: 'Bebas Neue',
    lang: 'en',
    category: 'Display',
    cssUrls: googleCss('Bebas Neue', [400]),
    preview: 'SEAT NO.12',
    fallback: 'sans-serif',
  },
  {
    id: 'playfair-display',
    name: 'Playfair Display',
    family: 'Playfair Display',
    lang: 'en',
    category: 'Serif',
    cssUrls: googleCss('Playfair Display'),
    preview: 'Seat No.12 AaBb',
    fallback: 'serif',
  },
  {
    id: 'merriweather',
    name: 'Merriweather',
    family: 'Merriweather',
    lang: 'en',
    category: 'Serif',
    cssUrls: googleCss('Merriweather'),
    preview: 'Seat No.12 AaBb',
    fallback: 'serif',
  },
  {
    id: 'jetbrains-mono',
    name: 'JetBrains Mono',
    family: 'JetBrains Mono',
    lang: 'en',
    category: 'Mono',
    cssUrls: googleCss('JetBrains Mono'),
    preview: 'Seat No.12 0123',
    fallback: 'monospace',
  },
  {
    id: 'caveat',
    name: 'Caveat',
    family: 'Caveat',
    lang: 'en',
    category: 'Script',
    cssUrls: googleCss('Caveat'),
    preview: 'Seat No.12 AaBb',
    fallback: 'cursive',
  },
  {
    id: 'pacifico',
    name: 'Pacifico',
    family: 'Pacifico',
    lang: 'en',
    category: 'Script',
    cssUrls: googleCss('Pacifico', [400]),
    preview: 'Seat No.12 AaBb',
    fallback: 'cursive',
  },
]

/** 该字体写入模板时使用的完整 font-family 栈 */
export function fontStackOf(font: WebFont): string {
  return `'${font.family}', ${font.fallback}`
}

export function findFontById(id: string): WebFont | undefined {
  return WEB_FONTS.find((f) => f.id === id)
}

/**
 * 从 CSS font-family 栈中识别目录里的字体（用于打开旧模板 / 分享模板时补载字体）。
 * 多款字体同时命中时（回退栈常含系统字体名），取在栈中位置最靠前者，即主字体。
 */
export function findFontByStack(stack: string | undefined): WebFont | undefined {
  if (!stack) return undefined
  const lower = stack.toLowerCase()
  let best: WebFont | undefined
  let bestIndex = Infinity
  for (const font of WEB_FONTS) {
    const index = lower.indexOf(font.family.toLowerCase())
    if (index !== -1 && index < bestIndex) {
      best = font
      bestIndex = index
    }
  }
  return best
}

/** CSS 通用字族关键字（合并字体栈时需从西文栈中剔除，避免拦截中文字形回退） */
const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
])

/**
 * 合并西文与中文字体栈：西文字体在前（仅覆盖英文/数字等拉丁字形），
 * 中文字体在后兜底汉字。西文栈中的通用字族会被剔除，
 * 否则它会先于中文字体命中所有字符，使中文字体永远不生效。
 */
export function combineFontStacks(
  en: string | undefined,
  zh: string | undefined,
): string | undefined {
  if (!en?.trim()) return zh
  if (!zh?.trim()) return en
  const concrete = en
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !GENERIC_FAMILIES.has(part.replace(/['"]/g, '').toLowerCase()))
  return concrete.length ? `${concrete.join(', ')}, ${zh}` : zh
}
