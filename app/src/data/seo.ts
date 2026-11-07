/**
 * 全站 SEO 单一数据源：
 * - 每个路由的 title / description / canonical / JSON-LD 在此集中定义；
 * - 客户端导航时由 router.afterEach 应用到 document head；
 * - 构建期预渲染脚本用同一份数据生成每个路由的静态 HTML head。
 */


export const SITE_ORIGIN = 'https://www.seatmark.cn'
export const SITE_NAME = 'SeatMark 座签'

export interface PageSeo {
  /** 完整 <title> */
  title: string
  description: string
  /** 规范路径（以 / 开头，不含域名） */
  path: string
  /** 页面级 JSON-LD 对象列表 */
  jsonLd: Record<string, unknown>[]
  /** robots 指令（账号/管理页 noindex），未设置时不输出 robots meta */
  robots?: string
  /** html lang（默认 zh-CN） */
  lang?: 'en'
  /** hreflang 备选链接（含自身与 x-default） */
  alternates?: { hreflang: string; path: string }[]
  /** 页面级 og:image / twitter:image 路径（以 / 开头），默认 /og-image.png */
  image?: string
}

/** 从教程正文 HTML 提取全部 /guides/ 配图路径（供 Article image、og:image、image sitemap 使用） */
export function guideBodyImages(body: string): string[] {
  return [...body.matchAll(/src="(\/guides\/[^"]+)"/g)].map((m) => m[1])
}

/** 已提供英文版内容的中文路径（/en 前缀镜像可被索引并互挂 hreflang） */
const EN_LOCALIZED_BASES = ['/', '/studio', '/pricing', '/seating', '/banquet', '/about', '/terms', '/privacy', '/refund'] as const

function enPathOf(base: string): string {
  return base === '/' ? '/en' : `/en${base}`
}

/**
 * 内容站索引页的 /en 外壳：预渲染供静态托管直达不 404，提供英文 title/description，
 * 但正文尚未英文化，故 noindex 且 canonical 指回中文原页，不进 sitemap。
 */
const EN_INDEX_SHELL_SEO: Record<string, { title: string; description: string }> = {
  '/templates': {
    title: 'Label Templates: Place Cards, Table Tents & Badges | SeatMark',
    description:
      'Free built-in templates for place cards, table tents, seat labels, name badges and ID cards. Pick one, upload your spreadsheet and batch-print with mm-accurate layout.',
  },
  '/papers': {
    title: 'A4 Label Sheet Library: Auto-Fit Layouts | SeatMark',
    description:
      'Common A4 self-adhesive label sheet sizes (2×4, 3×7, 3×10, rounded corners). Pick a sheet and rows, columns, margins and gaps lock in automatically for aligned printing.',
  },
}

/** /en/guides 索引与 /en/vs 索引的英文 SEO（正文为英文原生内容，可索引，canonical 为自身） */
const EN_GUIDES_INDEX_SEO = {
  title: 'Guides: Print Place Cards, Seat Labels & Name Tags | SeatMark',
  description:
    'Step-by-step tutorials on batch-printing place cards, exam seat labels, table tents and name badges from a spreadsheet, plus print calibration and label-paper tips.',
}
const EN_VS_INDEX_SEO = {
  title: 'Compare: SeatMark vs Other Place Card Tools | SeatMark',
  description:
    'Side-by-side comparisons of SeatMark with common place card and table tent workflows: batch generation from a list, print imposition, calibration, privacy and price.',
}

/** /en 下的内容站索引外壳路径（预渲染但 noindex，不进 sitemap） */
export function enIndexShellPaths(): string[] {
  return Object.keys(EN_INDEX_SHELL_SEO).map((base) => enPathOf(base))
}

/** 预渲染页是否应进 sitemap（noindex 页不进） */
export function isSitemapEligible(seo: PageSeo): boolean {
  return !/noindex/i.test(seo.robots ?? '')
}

function hreflangFor(base: string): { hreflang: string; path: string }[] {
  return [
    { hreflang: 'zh-CN', path: base },
    { hreflang: 'en', path: enPathOf(base) },
    { hreflang: 'x-default', path: base },
  ]
}

const SOFTWARE_APP_JSONLD_EN: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'SeatMark',
  alternateName: 'Seating chart, place card & name tag batch generator',
  url: `${SITE_ORIGIN}/en`,
  description:
    'Free online seating chart maker and place card generator: upload an Excel guest list to batch-create wedding seating charts, place cards, table tent cards, name tags, badges and classroom seating labels. Millimetre-accurate print layouts (A4/A5/A3), visual template designer, PDF export — all data processed locally in your browser, no sign-up required.',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  inLanguage: 'en',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
}

const SOFTWARE_APP_JSONLD: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  alternateName: '座签·桌牌席卡·门贴证卡批量生成',
  url: `${SITE_ORIGIN}/`,
  description:
    '免费的 Excel 批量标签生成工具：上传名单即可制作考场座签、课桌桌贴、考号贴、会议桌牌、桌签、台签、席卡、门贴门牌、学生证、工作证、胸卡和出入证等，支持照片核验、可视化模板设计与 PDF 导出，数据全程本地处理。',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  inLanguage: 'zh-CN',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
}

function breadcrumb(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE_ORIGIN}${item.path}`,
    })),
  }
}

function faqJsonLd(faqs: { q: string; a: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }
}

function howToJsonLd(
  name: string,
  steps: readonly { name: string; text: string }[],
  inLanguage = 'zh-CN',
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    inLanguage,
    step: steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  }
}

/** 定价页 FAQ（页面与 JSON-LD 共用） */
export const PRICING_FAQS = [
  {
    q: '带水印和无水印导出有什么区别？',
    a: '带水印导出与打印完全不限次数，水印仅为每张标签底边一条细线 + seatmark.cn 小字，不遮挡任何标签内容；无水印导出未登录每天 1 次，登录后每天 3 次，每日 0 点自动恢复，预览、排版、模板设计始终不限次数。',
  },
  {
    q: '无水印次数用完了怎么办？',
    a: '可以随时选择带水印导出继续使用，不受任何限制；也可以登录（每天 3 次）或分享专属链接——每被点开 1 次即得 1 次无水印导出（服务端去重防刷，每日上限 10 次）。',
  },
  {
    q: '使用需要注册账号吗？',
    a: '不登录也能使用全部功能（带水印不限次，无水印每日 1 次）。邮箱注册即送 7 天专业版试用：无水印导出不限次、自定义模板云端同步与跨设备找回；邀请好友注册双方各再送 7 天，可累计叠加。',
  },
  {
    q: '我的名单数据安全吗？',
    a: 'Excel 名单与照片全部在你的浏览器本地解析和排版，不发送到任何服务器。登录只用于配额与模板结构同步，不收集也不上传任何标签内容数据。',
  },
  {
    q: '专业版怎么开通？',
    a: '专业版 ¥5.9/30 天（原价 ¥19/月），定价页支持支付宝在线支付，个人中心也可用兑换码开通，天数可叠加。新用户注册即送 7 天试用；邀请好友注册双方各送 7 天，可累计叠加。',
  },
  {
    q: '团队版怎么购买？',
    a: '团队版 ¥19.9/30 天（原价 ¥49/月），定价页支持支付宝在线支付，支付成功后 30 天会员天数发放到当前登录账号。',
  },
]

/**
 * FAQ 答案是否含依赖账号服务的赠送承诺：「注册（即）送 N 天」或「分享…送 / 得 / +1 次」
 * （账号服务维护期间需追加弱提示）
 */
export function faqMentionsAccountBonus(answer: string): boolean {
  return /注册(即)?送/.test(answer) || /分享.*?(送|得|\+1)/.test(answer)
}

const guideListDescription =
  '考场座位标签怎么批量打印？Excel 怎么生成桌牌？SeatMark 教程中心提供座签、桌牌、席位卡、证卡制作与打印的完整中文教程，问答式讲解，免费实用。'

// 模板/教程/纸型大数据按路由分支懒加载，避免非相关页面（如首页）拉取全量数据 chunk
export async function resolveSeo(path: string): Promise<PageSeo> {
  // 归一化：去掉尾斜杠（根路径除外）与查询参数
  const clean = path.split('?')[0]!.split('#')[0]!
  const p = clean !== '/' && clean.endsWith('/') ? clean.slice(0, -1) : clean

  // /en 前缀路由：已英文化的核心页返回英文 meta + 互挂 hreflang；
  // 其余未翻译镜像页 noindex 且 canonical 指回中文原页，避免重复内容被索引。
  if (p === '/en' || p.startsWith('/en/')) {
    const base = p === '/en' ? '/' : p.slice(3)
    const enSeo = resolveEnSeo(base)
    if (enSeo) return enSeo
    const enContent = await resolveEnContentSeo(p)
    if (enContent) return enContent
    const seo = await resolveSeo(base)
    return { ...seo, lang: 'en', robots: 'noindex, follow' }
  }

  if ((EN_LOCALIZED_BASES as readonly string[]).includes(p)) {
    const seo = await resolveZhSeo(p)
    return { ...seo, alternates: hreflangFor(p) }
  }

  return resolveZhSeo(p)
}

/**
 * /en 下有独立英文正文的内容站详情页（如 /en/vs/prismm-alternative）：可索引、canonical 为自身，
 * 无中文对应页，故 hreflang 仅挂 en + x-default。
 */
async function resolveEnContentSeo(p: string): Promise<PageSeo | null> {
  if (p === '/en/guides') {
    const { enGuides } = await import('@/data/guidesEn')
    return {
      title: EN_GUIDES_INDEX_SEO.title,
      description: EN_GUIDES_INDEX_SEO.description,
      path: '/en/guides',
      lang: 'en',
      alternates: [
        { hreflang: 'en', path: '/en/guides' },
        { hreflang: 'x-default', path: '/en/guides' },
      ],
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'SeatMark Guides',
          url: `${SITE_ORIGIN}/en/guides`,
          inLanguage: 'en',
          description: EN_GUIDES_INDEX_SEO.description,
          hasPart: enGuides.map((g) => ({
            '@type': 'Article',
            headline: g.title,
            url: `${SITE_ORIGIN}/en/guides/${g.slug}`,
          })),
        },
        breadcrumb([
          { name: 'Home', path: '/en' },
          { name: 'Guides', path: '/en/guides' },
        ]),
      ],
    }
  }

  if (p.startsWith('/en/guides/')) {
    const { findEnGuide } = await import('@/data/guidesEn')
    const guide = findEnGuide(p.slice('/en/guides/'.length))
    if (!guide) return null
    const path = `/en/guides/${guide.slug}`
    const firstImage = guideBodyImages(guide.body)[0]
    const jsonLd: Record<string, unknown>[] = [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: guide.title,
        description: guide.description,
        inLanguage: 'en',
        datePublished: guide.datePublished,
        dateModified: guide.dateModified,
        author: { '@type': 'Organization', name: 'SeatMark', url: `${SITE_ORIGIN}/en` },
        publisher: { '@type': 'Organization', name: 'SeatMark', url: `${SITE_ORIGIN}/en` },
        mainEntityOfPage: `${SITE_ORIGIN}${path}`,
        keywords: guide.keywords.join(','),
        ...(firstImage ? { image: `${SITE_ORIGIN}${firstImage}` } : {}),
      },
      breadcrumb([
        { name: 'Home', path: '/en' },
        { name: 'Guides', path: '/en/guides' },
        { name: guide.title, path },
      ]),
    ]
    if (guide.howTo) jsonLd.push(howToJsonLd(guide.howTo.name, guide.howTo.steps, 'en'))
    if (guide.faqs.length) jsonLd.push(faqJsonLd(guide.faqs))
    return {
      title: `${guide.title} | SeatMark`,
      description: guide.description,
      path,
      lang: 'en',
      alternates: [
        { hreflang: 'en', path },
        { hreflang: 'x-default', path },
      ],
      image: firstImage,
      jsonLd,
    }
  }

  if (p === '/en/vs') {
    const { vsPagesFor } = await import('@/data/vsPages')
    const enPages = vsPagesFor('en')
    return {
      title: EN_VS_INDEX_SEO.title,
      description: EN_VS_INDEX_SEO.description,
      path: '/en/vs',
      lang: 'en',
      alternates: [
        { hreflang: 'en', path: '/en/vs' },
        { hreflang: 'x-default', path: '/en/vs' },
      ],
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'SeatMark Comparisons',
          url: `${SITE_ORIGIN}/en/vs`,
          inLanguage: 'en',
          description: EN_VS_INDEX_SEO.description,
          hasPart: enPages.map((v) => ({
            '@type': 'Article',
            headline: v.heading,
            url: `${SITE_ORIGIN}/en/vs/${v.slug}`,
          })),
        },
        breadcrumb([
          { name: 'Home', path: '/en' },
          { name: 'Compare', path: '/en/vs' },
        ]),
      ],
    }
  }

  if (p.startsWith('/en/vs/')) {
    const { findVsPage } = await import('@/data/vsPages')
    const page = findVsPage(p.slice('/en/vs/'.length), 'en')
    if (page) {
      const path = `/en/vs/${page.slug}`
      return {
        title: `${page.seoTitle} | SeatMark`,
        description: page.seoDescription,
        path,
        lang: 'en',
        alternates: [
          { hreflang: 'en', path },
          { hreflang: 'x-default', path },
        ],
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: page.heading,
            description: page.seoDescription,
            inLanguage: 'en',
            author: { '@type': 'Organization', name: 'SeatMark', url: `${SITE_ORIGIN}/en` },
            publisher: { '@type': 'Organization', name: 'SeatMark', url: `${SITE_ORIGIN}/en` },
            mainEntityOfPage: `${SITE_ORIGIN}${path}`,
          },
          faqJsonLd(page.faqs),
          breadcrumb([
            { name: 'Home', path: '/en' },
            { name: 'Compare', path: '/en/vs' },
            { name: `vs ${page.competitorName}`, path },
          ]),
        ],
      }
    }
  }

  // 英文长尾词专题落地页（/en/place-card-generator 等）：英文原生，可索引，无中文对应页
  {
    const { findTopicPage } = await import('@/data/topicPages')
    const topic = findTopicPage(p)
    if (topic?.lang === 'en') {
      return {
        title: `${topic.seoTitle} | SeatMark`,
        description: topic.seoDescription,
        path: topic.path,
        lang: 'en',
        alternates: [
          { hreflang: 'en', path: topic.path },
          { hreflang: 'x-default', path: topic.path },
        ],
        jsonLd: [
          SOFTWARE_APP_JSONLD,
          howToJsonLd(topic.howToName, topic.steps, 'en'),
          faqJsonLd(topic.faqs),
          breadcrumb([
            { name: 'Home', path: '/en' },
            { name: topic.shortName, path: topic.path },
          ]),
        ],
      }
    }
  }

  return null
}

/** 已英文化核心页的英文 SEO 数据；内容站索引外壳与账号/管理壳页仅提供英文 title（noindex） */
function resolveEnSeo(base: string): PageSeo | null {
  const indexShell = EN_INDEX_SHELL_SEO[base]
  if (indexShell) {
    return {
      ...indexShell,
      path: base,
      lang: 'en',
      robots: 'noindex, follow',
      jsonLd: [],
    }
  }

  if (base === '/account') {
    return {
      title: 'My Account - SeatMark',
      description:
        'Sign in to SeatMark to sync your custom templates, check your daily watermark-free export quota and manage your Pro plan.',
      path: base,
      lang: 'en',
      robots: 'noindex, nofollow',
      jsonLd: [],
    }
  }

  if (base === '/admin') {
    return {
      title: 'Admin Console - SeatMark',
      description: 'SeatMark admin console for redemption codes and site announcements. Staff only.',
      path: base,
      lang: 'en',
      robots: 'noindex, nofollow',
      jsonLd: [],
    }
  }

  if (!(EN_LOCALIZED_BASES as readonly string[]).includes(base)) return null
  const path = enPathOf(base)
  const common = { path, lang: 'en' as const, alternates: hreflangFor(base) }

  if (base === '/') {
    return {
      ...common,
      title: 'Seating Chart Maker & Place Card Generator | SeatMark',
      description:
        'Free seating chart maker & place card generator. Upload an Excel list to batch-print wedding seating charts, place cards and name tags. Data stays in your browser.',
      jsonLd: [SOFTWARE_APP_JSONLD_EN],
    }
  }

  if (base === '/studio') {
    return {
      ...common,
      title: 'Make Place Cards, Table Tents & Name Tags Online | SeatMark',
      description:
        'Pick a template, upload your Excel list and batch-generate print-ready place cards, table tents and name tags. A4/A5/A3, PDF export, all local in your browser.',
      jsonLd: [SOFTWARE_APP_JSONLD_EN],
    }
  }

  if (base === '/pricing') {
    return {
      ...common,
      title: 'Pricing: Pro ¥5.9 / 30 Days | SeatMark',
      description:
        'Unlimited watermarked export; daily free quota for watermark-free export. Pro ¥5.9/30 days, Team ¥19.9/30 days. Data stays in your browser.',
      jsonLd: [
        SOFTWARE_APP_JSONLD_EN,
        breadcrumb([
          { name: 'Home', path: '/en' },
          { name: 'Pricing', path: '/en/pricing' },
        ]),
      ],
    }
  }

  if (base === '/seating') {
    return {
      ...common,
      title: 'Classroom Seating Chart Maker — Free & Printable | SeatMark',
      description:
        'Paste your student roster, set rows, columns and aisles, then print an A4 classroom seating chart. One click turns the roster into desk labels. All in your browser.',
      jsonLd: [
        SOFTWARE_APP_JSONLD_EN,
        howToJsonLd(
          'Make and print a classroom seating chart online',
          [
            { name: 'Paste the roster', text: 'Paste student names into the list box, one per line.' },
            { name: 'Set the room layout', text: 'Set rows and columns, click column gaps to add aisles, and mark the podium.' },
            { name: 'Preview and print', text: 'Check the A4 landscape seating chart, then print or save as PDF.' },
            { name: 'Generate desk labels', text: 'Carry the same roster into the Studio to batch-generate desk name labels.' },
          ],
          'en',
        ),
        breadcrumb([
          { name: 'Home', path: '/en' },
          { name: 'Classroom Seating Chart', path: '/en/seating' },
        ]),
      ],
    }
  }

  if (base === '/about') {
    return {
      ...common,
      title: 'About SeatMark — Browser-based Label & Badge Generator',
      description:
        'What SeatMark does: roster to mm-accurate print layouts, 226 templates, paper imposition, seating planners, AI-assisted design — all processed locally in your browser.',
      jsonLd: [
        breadcrumb([
          { name: 'Home', path: '/en' },
          { name: 'About', path: '/en/about' },
        ]),
      ],
    }
  }

  if (base === '/terms') {
    return {
      ...common,
      title: 'Terms of Service (English Summary) | SeatMark',
      description:
        'English summary of the SeatMark Terms of Service: what the service does, your responsibilities, IP and liability. The Chinese version is the legally binding text.',
      jsonLd: [
        breadcrumb([
          { name: 'Home', path: '/en' },
          { name: 'Terms of Service', path: '/en/terms' },
        ]),
      ],
    }
  }

  if (base === '/privacy') {
    return {
      ...common,
      title: 'Privacy Policy (English Summary) | SeatMark',
      description:
        'English summary of the SeatMark Privacy Policy: rosters and photos are processed locally in your browser, never uploaded. The Chinese version is the legally binding text.',
      jsonLd: [
        breadcrumb([
          { name: 'Home', path: '/en' },
          { name: 'Privacy Policy', path: '/en/privacy' },
        ]),
      ],
    }
  }

  if (base === '/refund') {
    return {
      ...common,
      title: 'Refund Policy (English Summary) | SeatMark',
      description:
        'English summary of the SeatMark Refund Policy: 14-day refunds for paid plans, returned via the original payment method. The Chinese version is legally binding.',
      jsonLd: [
        breadcrumb([
          { name: 'Home', path: '/en' },
          { name: 'Refund Policy', path: '/en/refund' },
        ]),
      ],
    }
  }

  // base === '/banquet'
  return {
    ...common,
    title: 'Wedding Seating Chart Maker — Free Table Plan Tool | SeatMark',
    description:
      'Paste your guest list, group guests, pick round or long table layouts, auto-assign seats and export a print-ready A4/A3 seating chart. Guest list stays in your browser.',
    jsonLd: [
      SOFTWARE_APP_JSONLD_EN,
      howToJsonLd(
        'Make and print a banquet seating chart online',
        [
          { name: 'Paste the guest list', text: 'Paste or upload names line by line with auto-deduplication; group guests and color-code the groups.' },
          { name: 'Pick a venue layout', text: 'Choose round tables, long tables, head table or U-shape presets; drag tables and add entrance, stage or dance-floor markers.' },
          { name: 'Auto-assign seats', text: 'One click seats guests, keeping groups at the same table; drag names between tables to fine-tune.' },
          { name: 'Check and export', text: 'Automatic checks for unassigned guests, empty tables and overlaps; export a high-res A4/A3 PNG or PDF to print.' },
        ],
        'en',
      ),
      breadcrumb([
        { name: 'Home', path: '/en' },
        { name: 'Wedding Seating Chart', path: '/en/banquet' },
      ]),
    ],
  }
}

async function resolveZhSeo(p: string): Promise<PageSeo> {

  if (p === '/' || p === '') {
    return {
      title: '座签·桌牌席卡·门贴证卡批量生成 - SeatMark 座签 | Excel 批量打印',
      description:
        'SeatMark 座签是一款免费的 Excel 批量标签生成工具：上传名单即可制作考场座签、课桌桌贴、考号贴、会议桌牌、桌签、台签、席卡、门贴门牌、学生证、工作证、胸卡和出入证等，支持照片核验、可视化模板设计、裁切线与 PDF 导出，A4/A5/A3 精准排版。数据全程本地处理，无需注册安装。',
      path: '/',
      jsonLd: [SOFTWARE_APP_JSONLD],
    }
  }

  if (p === '/studio') {
    return {
      title: '标签工坊：座签·台签·席卡·桌签在线制作 - SeatMark 座签',
      description:
        '免费在线制作台签、席卡、桌签、座签与证卡：选择模板、上传 Excel 名单即批量生成打印页，坐席卡、座位背签也能做，支持 A4/A5/A3 与 PDF 导出，数据全程在浏览器本地处理。',
      path: '/studio',
      jsonLd: [SOFTWARE_APP_JSONLD],
    }
  }

  if (p === '/pricing') {
    return {
      title: '定价：专业版 ¥5.9/30 天，带水印导出不限次 - SeatMark 座签',
      description:
        'SeatMark 座签定价：带水印导出/打印不限次数；无水印导出每日有免费次数；专业版 ¥5.9/30 天（原价 ¥19/月）、团队版 ¥19.9/30 天（原价 ¥49/月），支持支付宝在线支付；专业版还支持兑换码开通。数据不出浏览器。',
      path: '/pricing',
      jsonLd: [
        {
          ...SOFTWARE_APP_JSONLD,
          offers: [
            {
              '@type': 'Offer',
              name: '免费版',
              price: '0',
              priceCurrency: 'CNY',
              description: '带水印导出/打印不限次数；无水印导出每日 1 次，登录后 3 次，分享可再送次数',
            },
            {
              '@type': 'Offer',
              name: '专业版',
              price: '5.9',
              priceCurrency: 'CNY',
              description: '¥5.9/30 天（原价 ¥19/月），支持支付宝在线支付与兑换码开通',
            },
            {
              '@type': 'Offer',
              name: '团队版',
              price: '19.9',
              priceCurrency: 'CNY',
              description: '¥19.9/30 天（原价 ¥49/月），支持支付宝在线支付',
            },
          ],
        },
        faqJsonLd(PRICING_FAQS),
        breadcrumb([
          { name: '首页', path: '/' },
          { name: '定价', path: '/pricing' },
        ]),
      ],
    }
  }

  if (p === '/account') {
    return {
      title: '个人中心 - SeatMark 座签',
      description: 'SeatMark 个人中心：云端模板同步、使用统计、邀请好友双方各送 7 天专业版与兑换码开通。',
      path: '/account',
      jsonLd: [],
      robots: 'noindex, nofollow',
    }
  }

  if (p === '/admin') {
    return {
      title: '管理后台 - SeatMark 座签',
      description: 'SeatMark 管理后台。',
      path: '/admin',
      jsonLd: [],
      robots: 'noindex, nofollow',
    }
  }

  if (p === '/pay/result') {
    return {
      title: '支付结果 - SeatMark 座签',
      description: 'SeatMark 订单支付结果查询。',
      path: '/pay/result',
      jsonLd: [],
      robots: 'noindex, nofollow',
    }
  }

  if (p === '/guides') {
    const { guides } = await import('@/data/guides')
    return {
      title: '教程中心：座签·桌牌·标签打印教程 - SeatMark 座签',
      description: guideListDescription,
      path: '/guides',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: '教程中心 - SeatMark 座签',
          url: `${SITE_ORIGIN}/guides`,
          inLanguage: 'zh-CN',
          description: guideListDescription,
          hasPart: guides.map((g) => ({
            '@type': 'Article',
            headline: g.title,
            url: `${SITE_ORIGIN}/guides/${g.slug}`,
          })),
        },
        breadcrumb([
          { name: '首页', path: '/' },
          { name: '教程中心', path: '/guides' },
        ]),
      ],
    }
  }

  if (p.startsWith('/guides/')) {
    const { findGuide } = await import('@/data/guides')
    const slug = p.slice('/guides/'.length)
    const guide = findGuide(slug)
    if (guide) {
      const firstImage = guideBodyImages(guide.body)[0]
      const jsonLd: Record<string, unknown>[] = [
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: guide.title,
          description: guide.description,
          inLanguage: 'zh-CN',
          datePublished: guide.datePublished,
          dateModified: guide.dateModified,
          author: { '@type': 'Organization', name: SITE_NAME, url: `${SITE_ORIGIN}/` },
          publisher: { '@type': 'Organization', name: SITE_NAME, url: `${SITE_ORIGIN}/` },
          mainEntityOfPage: `${SITE_ORIGIN}/guides/${guide.slug}`,
          keywords: guide.keywords.join(','),
          ...(firstImage ? { image: `${SITE_ORIGIN}${firstImage}` } : {}),
        },
        breadcrumb([
          { name: '首页', path: '/' },
          { name: '教程中心', path: '/guides' },
          { name: guide.title, path: `/guides/${guide.slug}` },
        ]),
      ]
      if (guide.howTo) jsonLd.push(howToJsonLd(guide.howTo.name, guide.howTo.steps))
      if (guide.faqs.length) jsonLd.push(faqJsonLd(guide.faqs))
      return {
        title: `${guide.title} - SeatMark 座签`,
        description: guide.description,
        path: `/guides/${guide.slug}`,
        image: firstImage,
        jsonLd,
      }
    }
  }

  if (p === '/templates') {
    const { templateDetails } = await import('@/data/templateDetails')
    return {
      title: '标签模板库：座签·桌牌·证卡免费模板 - SeatMark 座签',
      description: `SeatMark 内置 ${templateDetails.length} 款免费标签模板：考场座签、考号贴、课桌姓名贴、会议桌牌、出入证、学生证、工作证等，毫米级排版，选择模板上传 Excel 即可批量生成打印页。`,
      path: '/templates',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: '标签模板库 - SeatMark 座签',
          url: `${SITE_ORIGIN}/templates`,
          inLanguage: 'zh-CN',
          hasPart: templateDetails.map((t) => ({
            '@type': 'WebPage',
            name: t.seoTitle,
            url: `${SITE_ORIGIN}/templates/${t.slug}`,
          })),
        },
        breadcrumb([
          { name: '首页', path: '/' },
          { name: '模板库', path: '/templates' },
        ]),
      ],
    }
  }

  if (p.startsWith('/templates/')) {
    const [{ findTemplateDetail, TEMPLATE_STEPS }, { defaultTemplates }] = await Promise.all([
      import('@/data/templateDetails'),
      import('@/data/defaultTemplates'),
    ])
    const slug = p.slice('/templates/'.length)
    const detail = findTemplateDetail(slug)
    const template = defaultTemplates.find((t) => t.id === slug)
    if (detail && template) {
      return {
        title: `${detail.seoTitle} - SeatMark 座签`,
        description: detail.seoDescription,
        path: `/templates/${slug}`,
        jsonLd: [
          SOFTWARE_APP_JSONLD,
          howToJsonLd(`使用「${template.name}」模板批量生成标签`, TEMPLATE_STEPS),
          ...(detail.faqs?.length ? [faqJsonLd(detail.faqs)] : []),
          breadcrumb([
            { name: '首页', path: '/' },
            { name: '模板库', path: '/templates' },
            { name: template.name, path: `/templates/${slug}` },
          ]),
        ],
      }
    }
  }

  if (p === '/papers') {
    const { labelPapers } = await import('@/data/labelPapers')
    return {
      title: '不干胶纸型库：选型号自动对版 - SeatMark 座签',
      description: `收录 ${labelPapers.length} 种不干胶分切规格：国产常见 A4 版式与美标 Letter 的 Avery 兼容纸型。选好纸型，行列数、边距与间距自动锁定，标签打印即对版免调参。`,
      path: '/papers',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: '不干胶纸型库 - SeatMark 座签',
          url: `${SITE_ORIGIN}/papers`,
          inLanguage: 'zh-CN',
          hasPart: labelPapers.map((paper) => ({
            '@type': 'WebPage',
            name: paper.name,
            url: `${SITE_ORIGIN}/papers/${paper.slug}`,
          })),
        },
        breadcrumb([
          { name: '首页', path: '/' },
          { name: '纸型库', path: '/papers' },
        ]),
      ],
    }
  }

  if (p.startsWith('/papers/')) {
    const { findLabelPaper, sheetKeyOf, sheetOf } = await import('@/data/labelPapers')
    const slug = p.slice('/papers/'.length)
    const paper = findLabelPaper(slug)
    if (paper) {
      const sheet = sheetOf(paper)
      return {
        title: `${paper.name}：规格参数与打印模板 - SeatMark 座签`,
        description: `${paper.description}单枚 ${paper.labelWidth}×${paper.labelHeight} mm，${paper.cols} 列×${paper.rows} 行每页 ${paper.cols * paper.rows} 枚。在线选此纸型自动对版，上传 Excel 即可批量打印。`,
        path: `/papers/${slug}`,
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: paper.name,
            alternateName: paper.aliases,
            description: paper.description,
            url: `${SITE_ORIGIN}/papers/${paper.slug}`,
            additionalProperty: [
              {
                '@type': 'PropertyValue',
                name: '整张纸',
                value: `${sheetKeyOf(paper)} ${sheet.width}×${sheet.height} mm`,
              },
              {
                '@type': 'PropertyValue',
                name: '单枚标签',
                value: `${paper.labelWidth}×${paper.labelHeight} mm`,
              },
              {
                '@type': 'PropertyValue',
                name: '排列',
                value: `${paper.cols} 列 × ${paper.rows} 行，每页 ${paper.cols * paper.rows} 枚`,
              },
              {
                '@type': 'PropertyValue',
                name: '切角',
                value: paper.corner === 'rounded' ? '圆角' : '直角',
              },
            ],
          },
          breadcrumb([
            { name: '首页', path: '/' },
            { name: '纸型库', path: '/papers' },
            { name: paper.name, path: `/papers/${paper.slug}` },
          ]),
        ],
      }
    }
  }

  if (p === '/vs') {
    const { vsPagesFor } = await import('@/data/vsPages')
    const vsPages = vsPagesFor('zh')
    return {
      title: '工具对比：SeatMark 与常见桌牌席卡做法逐项对照 - SeatMark 座签',
      description:
        'SeatMark 与创客贴、WPS 邮件合并、placecard.us、Canva 可画做桌牌席卡的实测对比合集：名单批量生成、打印拼版、校准精度、隐私与价格逐项对照，帮你按场景选对工具。',
      path: '/vs',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: '工具对比 - SeatMark 座签',
          url: `${SITE_ORIGIN}/vs`,
          inLanguage: 'zh-CN',
          hasPart: vsPages.map((v) => ({
            '@type': 'Article',
            headline: v.seoTitle,
            url: `${SITE_ORIGIN}/vs/${v.slug}`,
          })),
        },
        breadcrumb([
          { name: '首页', path: '/' },
          { name: '工具对比', path: '/vs' },
        ]),
      ],
    }
  }

  if (p.startsWith('/vs/')) {
    const { findVsPage } = await import('@/data/vsPages')
    const page = findVsPage(p.slice('/vs/'.length), 'zh')
    if (page) {
      return {
        title: `${page.seoTitle} - SeatMark 座签`,
        description: page.seoDescription,
        path: `/vs/${page.slug}`,
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: page.heading,
            description: page.seoDescription,
            inLanguage: 'zh-CN',
            author: { '@type': 'Organization', name: SITE_NAME, url: `${SITE_ORIGIN}/` },
            publisher: { '@type': 'Organization', name: SITE_NAME, url: `${SITE_ORIGIN}/` },
            mainEntityOfPage: `${SITE_ORIGIN}/vs/${page.slug}`,
          },
          faqJsonLd(page.faqs),
          breadcrumb([
            { name: '首页', path: '/' },
            { name: '工具对比', path: '/vs' },
            { name: `vs ${page.competitorName}`, path: `/vs/${page.slug}` },
          ]),
        ],
      }
    }
  }

  {
    const { findTopicPage } = await import('@/data/topicPages')
    const topic = findTopicPage(p)
    if (topic) {
      return {
        title: `${topic.seoTitle} - SeatMark 座签`,
        description: topic.seoDescription,
        path: topic.path,
        jsonLd: [
          SOFTWARE_APP_JSONLD,
          howToJsonLd(topic.howToName, topic.steps),
          faqJsonLd(topic.faqs),
          breadcrumb([
            { name: '首页', path: '/' },
            { name: topic.shortName, path: topic.path },
          ]),
        ],
      }
    }
  }

  if (p === '/seating') {
    return {
      title: '班级座位表在线制作打印，同名单生成桌贴 - SeatMark 座签',
      description:
        '免费在线生成教室座位表：粘贴学生名单、设置排列与过道、标注讲台，生成 A4 教室平面座位表直接打印；还能一键把同一份名单带入标签工坊批量生成课桌桌贴。数据不出浏览器。',
      path: '/seating',
      jsonLd: [
        SOFTWARE_APP_JSONLD,
        howToJsonLd('在线制作班级座位表并打印', [
          { name: '粘贴名单', text: '把学生姓名粘贴进名单框，每行一人，支持逗号、顿号分隔。' },
          { name: '设置教室布局', text: '设置排数与列数，点击列间隙添加过道，可标注讲台位置。' },
          { name: '预览并打印', text: '确认 A4 横向座位表效果后直接打印，或另存为 PDF。' },
          { name: '生成对应桌贴', text: '同一份名单带入标签工坊，选模板即可批量生成课桌桌贴。' },
        ]),
        breadcrumb([
          { name: '首页', path: '/' },
          { name: '座位表打印', path: '/seating' },
        ]),
      ],
    }
  }

  if (p === '/banquet') {
    return {
      title: '婚宴/宴会座位表在线制作，圆桌布局自动排座 - SeatMark 座签',
      description:
        '免费在线生成婚宴、年会宴会座位表：粘贴宾客名单自动去重、按亲友/同事分组标色，选圆桌、长桌、U 形等场地布局，一键自动分配尽量不拆组、拖拽微调，导出 A4/A3 高清 PNG/PDF 直接打印。名单不出浏览器。',
      path: '/banquet',
      jsonLd: [
        SOFTWARE_APP_JSONLD,
        howToJsonLd('在线制作宴会座位表并打印', [
          { name: '粘贴宾客名单', text: '逐行粘贴或上传 TXT 名单，自动去重；可按男方亲友、女方亲友、同事等分组并标色。' },
          { name: '选场地布局', text: '选圆桌、长桌、主桌、U 形或教室课桌预设，拖动餐桌位置，添加入口、舞台、舞池标记。' },
          { name: '自动分配座位', text: '一键自动分配，同组宾客尽量同桌；拖拽宾客姓名在桌间移动微调。' },
          { name: '检查并导出', text: '自动检查未安排宾客、空桌与餐桌重叠，导出 A4/A3 高清 PNG 或 PDF 直接打印。' },
        ]),
        breadcrumb([
          { name: '首页', path: '/' },
          { name: '宴会座位表', path: '/banquet' },
        ]),
      ],
    }
  }

  if (p === '/about') {
    return {
      title: '产品介绍 - SeatMark 座签',
      description:
        'SeatMark 座签产品介绍：名单到毫米级打印排版、226 款内置模板、纸张实际尺寸排版、排座工具与 AI 辅助设计，名单与照片全部在浏览器本地处理。',
      path: '/about',
      jsonLd: [
        breadcrumb([
          { name: '首页', path: '/' },
          { name: '产品介绍', path: '/about' },
        ]),
      ],
    }
  }

  if (p === '/terms') {
    return {
      title: '用户协议 - SeatMark 座签',
      description:
        'SeatMark 座签用户协议：服务内容、用户权利义务、知识产权与免责声明。核心功能全程在浏览器本地运行，Beta 期间限时免费。',
      path: '/terms',
      jsonLd: [
        breadcrumb([
          { name: '首页', path: '/' },
          { name: '用户协议', path: '/terms' },
        ]),
      ],
    }
  }

  if (p === '/privacy') {
    return {
      title: '隐私政策 - SeatMark 座签',
      description:
        'SeatMark 座签隐私政策：Excel 名单与照片全部在浏览器本地解析排版，不上传任何服务器，页面关闭即清空，可完全离线使用。',
      path: '/privacy',
      jsonLd: [
        breadcrumb([
          { name: '首页', path: '/' },
          { name: '隐私政策', path: '/privacy' },
        ]),
      ],
    }
  }

  if (p === '/refund') {
    return {
      title: '退款政策 - SeatMark 座签',
      description:
        'SeatMark 座签退款政策：付费方案 14 天内未实质使用可全额退款，支付宝与国际收单均原路退回，邮件申请即可。',
      path: '/refund',
      jsonLd: [
        breadcrumb([
          { name: '首页', path: '/' },
          { name: '退款政策', path: '/refund' },
        ]),
      ],
    }
  }

  // 未知路径：品牌化 404 页（noindex，预渲染为静态托管的 404.html）
  return {
    title: '页面不存在 - SeatMark 座签',
    description:
      '你访问的页面不存在或已被移动。可从首页、标签工坊、模板库与教程中心继续使用 SeatMark 座签。',
    path: '/404',
    jsonLd: [],
    robots: 'noindex, follow',
  }
}

/**
 * 需要预渲染但不进 sitemap 的应用壳路径（账号/管理页，noindex）：
 * 预渲染仅为了静态托管下直接访问路径时能命中 HTML 文件。
 */
export function appShellPaths(): string[] {
  return ['/account', '/admin', '/pay/result', '/en/account', '/en/admin', '/en/pay/result']
}

/** 需要构建期预渲染的全部路径（同时是 sitemap 的路径清单）；仅构建脚本使用 */
export async function prerenderPaths(): Promise<string[]> {
  const [{ guides }, { enGuides }, { templateDetails }, { labelPapers }, { vsPagesFor }, { topicPages }] =
    await Promise.all([
      import('@/data/guides'),
      import('@/data/guidesEn'),
      import('@/data/templateDetails'),
      import('@/data/labelPapers'),
      import('@/data/vsPages'),
      import('@/data/topicPages'),
    ])
  return [
    '/',
    '/studio',
    '/pricing',
    '/guides',
    ...guides.map((g) => `/guides/${g.slug}`),
    '/templates',
    ...templateDetails.map((t) => `/templates/${t.slug}`),
    '/papers',
    ...labelPapers.map((paper) => `/papers/${paper.slug}`),
    '/vs',
    ...vsPagesFor('zh').map((v) => `/vs/${v.slug}`),
    // /en 下有独立英文正文的内容页（可索引，进 sitemap）
    '/en/guides',
    ...enGuides.map((g) => `/en/guides/${g.slug}`),
    '/en/vs',
    ...vsPagesFor('en').map((v) => `/en/vs/${v.slug}`),
    ...topicPages.map((t) => t.path),
    '/seating',
    '/banquet',
    '/about',
    '/terms',
    '/privacy',
    '/refund',
    ...EN_LOCALIZED_BASES.map((base) => enPathOf(base)),
    // /en 内容站索引外壳：noindex，预渲染防 404 但由 isSitemapEligible 排除出 sitemap
    ...enIndexShellPaths(),
  ]
}
