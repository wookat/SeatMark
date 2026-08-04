/**
 * 全站 SEO 单一数据源：
 * - 每个路由的 title / description / canonical / JSON-LD 在此集中定义；
 * - 客户端导航时由 router.afterEach 应用到 document head；
 * - 构建期预渲染脚本用同一份数据生成每个路由的静态 HTML head。
 */

import { defaultTemplates } from '@/data/defaultTemplates'
import { findGuide, guides } from '@/data/guides'
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
    q: 'Beta 期间免费到什么时候？',
    a: 'Beta 期间所有档位限时免费开放，全部功能不设限制。正式收费前会提前在站内公告，Beta 期间生成的模板与文件永久归你所有。',
  },
  {
    q: '免费使用需要注册账号吗？',
    a: '不需要。打开网页即可使用全部功能，无需注册、无需登录，也不收集任何个人信息。',
  },
  {
    q: '我的名单数据安全吗？',
    a: 'Excel 名单与照片全部在你的浏览器本地解析和排版，不会上传到任何服务器，页面关闭后即清空，可完全离线使用。',
  },
  {
    q: '商用（学校/公司/机构）可以用吗？',
    a: '可以。Beta 期间机构使用同样免费，内置开源字体均可免费商用；生成的 PDF 与打印页版权归你所有。',
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
      title: '标签工坊 - SeatMark 座签',
      description:
        '在线标签工坊：选择模板、上传 Excel 名单、批量照片核验，批量生成座签、桌牌、证卡打印页，支持 A4/A5/A3 与 PDF 导出，数据全程在浏览器本地处理。',
      path: '/studio',
      jsonLd: [SOFTWARE_APP_JSONLD],
    }
  }

  if (p === '/pricing') {
    return {
      title: '定价：Beta 期间限时免费 - SeatMark 座签',
      description:
        'SeatMark 座签定价：免费版、专业版（原价 ¥29/月）、团队版（原价 ¥99/月）Beta 期间全部限时免费体验，无需注册即可使用全部功能，数据不出浏览器。',
      path: '/pricing',
      jsonLd: [
        {
          ...SOFTWARE_APP_JSONLD,
          offers: [
            { '@type': 'Offer', name: '免费版', price: '0', priceCurrency: 'CNY' },
            {
              '@type': 'Offer',
              name: '专业版（Beta 限时免费）',
              price: '0',
              priceCurrency: 'CNY',
              description: '原价 ¥29/月，Beta 期间限时免费体验',
            },
            {
              '@type': 'Offer',
              name: '团队版（Beta 限时免费）',
              price: '0',
              priceCurrency: 'CNY',
              description: '原价 ¥99/月，Beta 期间限时免费体验',
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
          breadcrumb([
            { name: '首页', path: '/' },
            { name: '模板库', path: '/templates' },
            { name: template.name, path: `/templates/${slug}` },
          ]),
        ],
      }
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

  // 未知路径回落到首页 meta（SPA 内部会重定向到 /）
  return resolveSeo('/')
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
    '/terms',
    '/privacy',
  ]
}
