/**
 * 全站 SEO 单一数据源：
 * - 每个路由的 title / description / canonical / JSON-LD 在此集中定义；
 * - 客户端导航时由 router.afterEach 应用到 document head；
 * - 构建期预渲染脚本用同一份数据生成每个路由的静态 HTML head。
 */

import { defaultTemplates } from '@/data/defaultTemplates'
import { findGuide, guides } from '@/data/guides'
import { findLabelPaper, labelPapers } from '@/data/labelPapers'
import { findTemplateDetail, TEMPLATE_STEPS, templateDetails } from '@/data/templateDetails'

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

function howToJsonLd(name: string, steps: readonly { name: string; text: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    inLanguage: 'zh-CN',
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
    a: '带水印导出与打印完全不限次数，仅在页脚页边距区域叠加「SeatMark 座签 · seatmark.cn」小字角标，不遮挡任何标签内容；无水印导出未登录每天 1 次，登录后每天 3 次，每日 0 点自动恢复，预览、排版、模板设计始终不限次数。',
  },
  {
    q: '无水印次数用完了怎么办？',
    a: '可以随时选择带水印导出继续使用，不受任何限制；也可以登录（每天 3 次）或分享专属链接——每被点开 1 次即得 1 次无水印导出（服务端去重防刷，每日上限 10 次）。',
  },
  {
    q: '使用需要注册账号吗？',
    a: '不登录也能使用全部功能（带水印不限次，无水印每日 1 次）。邮箱验证码登录即开通专业版 Beta 限时免费试用：每日 3 次无水印导出、自定义模板云端同步与跨设备找回。',
  },
  {
    q: '我的名单数据安全吗？',
    a: 'Excel 名单与照片全部在你的浏览器本地解析和排版，不会上传到任何服务器。登录只用于配额与模板结构同步，不收集也不上传任何标签内容数据。',
  },
  {
    q: '专业版怎么开通？',
    a: '专业版定价 ¥29/月，Beta 期间限时免费试用：注册登录即自动开通，无需支付。正式收费前会提前在站内显著位置公告。',
  },
  {
    q: '团队版怎么购买？',
    a: '团队版 ¥99/月，支付通道即将开通。现在可在定价页预订登记（留邮箱与团队规模），开通后我们会第一时间邮件通知，预订用户享首批优惠。',
  },
]

const guideListDescription =
  '考场座位标签怎么批量打印？Excel 怎么生成桌牌？SeatMark 教程中心提供座签、桌牌、席位卡、证卡制作与打印的完整中文教程，问答式讲解，免费实用。'

export function resolveSeo(path: string): PageSeo {
  // 归一化：去掉尾斜杠（根路径除外）与查询参数
  const clean = path.split('?')[0]!.split('#')[0]!
  const p = clean !== '/' && clean.endsWith('/') ? clean.slice(0, -1) : clean

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
      title: '定价：带水印免费不限次，专业版 Beta 限时免费试用 - SeatMark 座签',
      description:
        'SeatMark 座签定价：带水印导出/打印不限次数；无水印导出每日 1 次（登录后 3 次），分享每被点开 1 次再送 1 次；专业版 ¥29/月 Beta 期间限时免费试用；团队版 ¥99/月支持预订登记。数据不出浏览器。',
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
              name: '专业版（Beta 限时免费试用）',
              price: '29',
              priceCurrency: 'CNY',
              description: '定价 ¥29/月，Beta 期间限时免费试用，注册登录即开通',
            },
            {
              '@type': 'Offer',
              name: '团队版',
              price: '99',
              priceCurrency: 'CNY',
              description: '¥99/月，支付即将开通，现在可预订登记',
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
      description: 'SeatMark 个人中心：云端模板同步、使用统计、分享送无水印次数与专业版 Beta 限时免费试用。',
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

  if (p === '/guides') {
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
    const slug = p.slice('/guides/'.length)
    const guide = findGuide(slug)
    if (guide) {
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
        jsonLd,
      }
    }
  }

  if (p === '/templates') {
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
    return {
      title: 'A4 不干胶纸型库：选型号自动对版 - SeatMark 座签',
      description: `收录 ${labelPapers.length} 种国产常见 A4 不干胶分切规格：2×4、3×7、3×10、圆角模切等。选好纸型，行列数、边距与间距自动锁定，标签打印即对版免调参。`,
      path: '/papers',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'A4 不干胶纸型库 - SeatMark 座签',
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
    const slug = p.slice('/papers/'.length)
    const paper = findLabelPaper(slug)
    if (paper) {
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
              { '@type': 'PropertyValue', name: '整张纸', value: 'A4 210×297 mm' },
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

  if (p === '/seating') {
    return {
      title: '班级座位表在线制作打印，一键生成桌贴 - SeatMark 座签',
      description:
        '免费在线生成教室座位表：粘贴学生名单、设置排列与过道、标注讲台，生成 A4 教室平面座位表直接打印；还能一键把同一份名单带入标签工坊批量生成课桌桌贴。数据不出浏览器。',
      path: '/seating',
      jsonLd: [
        SOFTWARE_APP_JSONLD,
        howToJsonLd('在线制作班级座位表并打印', [
          { name: '粘贴名单', text: '把学生姓名粘贴进名单框，每行一人，支持逗号、顿号分隔。' },
          { name: '设置教室布局', text: '设置排数与列数，点击列间隙添加过道，可标注讲台位置。' },
          { name: '预览并打印', text: '确认 A4 横向座位表效果后直接打印，或另存为 PDF。' },
          { name: '一键生成桌贴', text: '同一份名单带入标签工坊，选模板即可批量生成课桌桌贴。' },
        ]),
        breadcrumb([
          { name: '首页', path: '/' },
          { name: '座位表打印', path: '/seating' },
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
  return ['/account', '/admin']
}

/** 需要构建期预渲染的全部路径（同时是 sitemap 的路径清单） */
export function prerenderPaths(): string[] {
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
    '/seating',
    '/terms',
    '/privacy',
  ]
}
