import type { LabelTemplate, TemplateField } from '@/types/template'

import { fixed, INK_MUTED, INK_SOFT, text } from './templateFactory'
import { pp, spec, svg } from './defaultTemplatesPaperSeries'

/**
 * 纸型专用模板系列（第二批）：
 * 按用户群体分风格设计——幼儿园宝妈（圆润卡通）、中小学教师（清晰大字）、
 * 行政办公（商务灰蓝）、零售烘焙手作（暖色素雅）、仓储档案（编号功能）。
 * 版式用参数化构造器按单格实际尺寸生成，同族设计在不同纸型上保持一致的比例关系。
 */

interface Layout {
  fields: TemplateField[]
  decor?: string
}

/** 纸型单格尺寸（rotated 时宽高互换） */
function dims(slug: string, rotated = false): { w: number; h: number } {
  const s = spec(slug)
  return rotated
    ? { w: s.labelHeight, h: s.labelWidth }
    : { w: s.labelWidth, h: s.labelHeight }
}

const px = (w: number) => Math.max(3.5, w * 0.075)

/** 姓名贴·顶条款：顶部色条、大字姓名、副行（班级/单位/日期） */
function nsBar(w: number, h: number, accent: string, subSample: string, subLabel = '班级', subId = 'sub'): Layout {
  const pad = px(w)
  const barH = Math.max(2.2, h * 0.09)
  return {
    fields: [
      text('name', '姓名', { x: pad, y: barH + h * 0.05, width: w - pad * 2, height: h * 0.52 }, '王小明', {
        fontSize: h * 0.36,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text(subId, subLabel, { x: pad, y: h * 0.7, width: w - pad * 2, height: h * 0.2 }, subSample, {
        fontSize: h * 0.155,
        color: INK_SOFT,
      }),
    ],
    decor: svg(
      w,
      h,
      `<rect x="0" y="0" width="${w}" height="${barH}" fill="${accent}"/>` +
        `<rect x="${pad}" y="${h * 0.655}" width="${w - pad * 2}" height="0.3" fill="${accent}" opacity="0.35"/>`,
    ),
  }
}

/** 姓名贴·圆点款：描边框、双角圆点，幼儿园感 */
function nsDots(w: number, h: number, accent: string, subSample: string, nameSample = '乐乐'): Layout {
  const pad = px(w)
  const inset = Math.max(2, w * 0.035)
  const r = Math.min(4, h * 0.12)
  const d = Math.max(2.4, h * 0.085)
  return {
    fields: [
      text('name', '姓名', { x: pad, y: h * 0.14, width: w - pad * 2, height: h * 0.5 }, nameSample, {
        fontSize: h * 0.34,
        fontWeight: 'bold',
        color: accent,
        emphasis: 'hero',
      }),
      text('sub', '班级', { x: pad, y: h * 0.66, width: w - pad * 2, height: h * 0.2 }, subSample, {
        fontSize: h * 0.15,
        color: INK_SOFT,
      }),
    ],
    decor: svg(
      w,
      h,
      `<rect x="${inset}" y="${inset}" width="${w - inset * 2}" height="${h - inset * 2}" rx="${r}" fill="none" stroke="${accent}" stroke-width="0.7"/>` +
        `<circle cx="${inset + d}" cy="${inset + d}" r="${d * 0.55}" fill="${accent}"/>` +
        `<circle cx="${w - inset - d}" cy="${h - inset - d}" r="${d * 0.55}" fill="${accent}" opacity="0.55"/>`,
    ),
  }
}

/** 迷你姓名贴（h<24）：单行大字、底部色条 */
function nsMini(w: number, h: number, accent: string, nameSample = '王小明'): Layout {
  const pad = Math.max(2, w * 0.05)
  const stripH = Math.max(1.4, h * 0.1)
  return {
    fields: [
      text('name', '姓名', { x: pad, y: h * 0.08, width: w - pad * 2, height: h * 0.74 }, nameSample, {
        fontSize: h * 0.52,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
    ],
    decor: svg(w, h, `<rect x="0" y="${h - stripH}" width="${w}" height="${stripH}" fill="${accent}"/>`),
  }
}

/** 左块右文：左侧色块（图标字）+ 主行、副行——物品/货架/收纳标签 */
function rowTag(
  w: number,
  h: number,
  accent: string,
  blockText: string,
  mainSample: string,
  subSample: string,
  mainLabel = '物品名',
  subLabel = '类别',
): Layout {
  const pad = Math.max(3, w * 0.05)
  const blockW = Math.max(9, w * 0.17)
  const tx = pad + blockW + pad * 0.6
  const tw = w - tx - pad
  return {
    fields: [
      fixed('blockIcon', '标记', { x: pad, y: h * 0.2, width: blockW, height: h * 0.6 }, blockText, {
        fontSize: h * 0.3,
        fontWeight: 'bold',
        color: '#ffffff',
      }),
      text('item', mainLabel, { x: tx, y: h * 0.14, width: tw, height: h * 0.44 }, mainSample, {
        fontSize: h * 0.26,
        fontWeight: 'bold',
        align: 'left',
      }),
      text('sub', subLabel, { x: tx, y: h * 0.6, width: tw, height: h * 0.28 }, subSample, {
        fontSize: h * 0.17,
        color: INK_SOFT,
        align: 'left',
      }),
    ],
    decor: svg(w, h, `<rect x="${pad}" y="${h * 0.2}" width="${blockW}" height="${h * 0.6}" rx="${Math.min(2.5, h * 0.08)}" fill="${accent}"/>`),
  }
}

/** 价签：左商品名、右超大价格 */
function priceTag(w: number, h: number, accent: string): Layout {
  const pad = px(w)
  const pw = w * 0.42
  return {
    fields: [
      text('item', '商品名', { x: pad, y: h * 0.16, width: w - pw - pad, height: h * 0.4 }, '手作曲奇', {
        fontSize: h * 0.22,
        fontWeight: 'bold',
        align: 'left',
      }),
      text('spec', '规格', { x: pad, y: h * 0.6, width: w - pw - pad, height: h * 0.26 }, '200g / 盒', {
        fontSize: h * 0.15,
        color: INK_MUTED,
        align: 'left',
      }),
      fixed('yen', '币符', { x: w - pw, y: h * 0.2, width: pw * 0.22, height: h * 0.34 }, '¥', {
        fontSize: h * 0.26,
        fontWeight: 'bold',
        color: accent,
      }),
      text('price', '价格', { x: w - pw + pw * 0.2, y: h * 0.1, width: pw * 0.78, height: h * 0.62 }, '19.9', {
        fontSize: h * 0.46,
        fontWeight: 'bold',
        color: accent,
        emphasis: 'hero',
      }),
      text('unit', '计价单位', { x: w - pw, y: h * 0.72, width: pw, height: h * 0.18 }, '元 / 盒', {
        fontSize: h * 0.13,
        color: INK_MUTED,
      }),
    ],
    decor: svg(w, h, `<rect x="0" y="${h - 1.6}" width="${w}" height="1.6" fill="${accent}"/>`),
  }
}

/** 桌牌：单位小字、姓名超大字、底部色带 */
function deskCard(w: number, h: number, accent: string): Layout {
  const pad = px(w)
  const bandH = Math.max(2.4, h * 0.1)
  return {
    fields: [
      text('org', '单位', { x: pad, y: h * 0.1, width: w - pad * 2, height: h * 0.18 }, '云杉科技', {
        fontSize: h * 0.15,
        color: INK_SOFT,
      }),
      text('name', '姓名', { x: pad, y: h * 0.3, width: w - pad * 2, height: h * 0.5 }, '王小明', {
        fontSize: h * 0.38,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('role', '职务', { x: pad, y: h * 0.78, width: w - pad * 2, height: h * 0.14 }, '产品总监', {
        fontSize: h * 0.12,
        color: accent,
      }),
    ],
    decor: svg(w, h, `<rect x="0" y="${h - bandH}" width="${w}" height="${bandH}" fill="${accent}"/>`),
  }
}

/** 考场座贴：眉题、座位号超大、姓名/考号两行 */
function examTag(w: number, h: number, accent: string): Layout {
  const pad = px(w)
  return {
    fields: [
      text('room', '考场', { x: pad, y: h * 0.07, width: w - pad * 2, height: h * 0.16 }, '第 03 考场', {
        fontSize: h * 0.13,
        color: INK_SOFT,
      }),
      text('seat', '座位号', { x: pad, y: h * 0.24, width: w - pad * 2, height: h * 0.42 }, '08', {
        fontSize: h * 0.34,
        fontWeight: 'bold',
        color: accent,
        emphasis: 'hero',
      }),
      text('name', '姓名', { x: pad, y: h * 0.68, width: w * 0.42, height: h * 0.22 }, '王小明', {
        fontSize: h * 0.17,
        fontWeight: 'bold',
        align: 'left',
      }),
      text('examId', '准考证号', { x: pad, y: h * 0.68, width: w - pad * 2 - w * 0.42, height: h * 0.22 }, '2026061008', {
        fontSize: h * 0.13,
        color: INK_MUTED,
        align: 'right',
      }),
    ],
    decor: svg(w, h, `<rect x="${pad}" y="${h * 0.655}" width="${w - pad * 2}" height="0.3" fill="${accent}" opacity="0.4"/>`),
  }
}

/** 地址贴：收件人、地址、电话三行 */
function addrLines(w: number, h: number, accent: string): Layout {
  const pad = px(w)
  const capW = w * 0.16
  return {
    fields: [
      fixed('capTo', '收件标记', { x: pad, y: h * 0.12, width: capW, height: h * 0.22 }, '收件', {
        fontSize: h * 0.15,
        color: accent,
        fontWeight: 'bold',
      }),
      text('name', '收件人', { x: pad + capW, y: h * 0.1, width: w - pad * 2 - capW, height: h * 0.26 }, '王小明 收', {
        fontSize: h * 0.2,
        fontWeight: 'bold',
        align: 'left',
      }),
      text('addr', '地址', { x: pad, y: h * 0.4, width: w - pad * 2, height: h * 0.3 }, '上海市浦东新区世纪大道 100 号 3 栋 502', {
        fontSize: h * 0.145,
        color: INK_SOFT,
        align: 'left',
      }),
      text('phone', '电话', { x: pad, y: h * 0.72, width: w - pad * 2, height: h * 0.2 }, '138 0000 0000', {
        fontSize: h * 0.15,
        color: INK_MUTED,
        align: 'left',
      }),
    ],
    decor: svg(w, h, `<rect x="${pad}" y="${h * 0.37}" width="${w - pad * 2}" height="0.3" fill="#e7e5e4"/>`),
  }
}

/** 日期/开封贴：品名、日期大字、限期 */
function dateTag(w: number, h: number, accent: string, capText: string): Layout {
  const pad = px(w)
  return {
    fields: [
      fixed('cap', '标签', { x: pad, y: h * 0.1, width: w - pad * 2, height: h * 0.16 }, capText, {
        fontSize: h * 0.13,
        color: INK_MUTED,
        letterSpacing: 0.2,
      }),
      text('name', '品名', { x: pad, y: h * 0.28, width: w - pad * 2, height: h * 0.24 }, '草莓果酱', {
        fontSize: h * 0.17,
        fontWeight: 'bold',
        align: 'left',
      }),
      text('date', '日期', { x: pad, y: h * 0.52, width: w - pad * 2, height: h * 0.26 }, '2026-11-08', {
        fontSize: h * 0.2,
        fontWeight: 'bold',
        color: accent,
        align: 'left',
      }),
      text('note', '限期', { x: pad, y: h * 0.78, width: w - pad * 2, height: h * 0.16 }, '冷藏 30 天内食用', {
        fontSize: h * 0.12,
        color: INK_MUTED,
        align: 'left',
      }),
    ],
    decor: svg(w, h, `<rect x="0" y="0" width="${w}" height="${Math.max(1.8, h * 0.07)}" fill="${accent}"/>`),
  }
}

/** 圆贴：外圈环、中心名、底部小字 */
function sealC(d: number, accent: string, nameSample: string, subSample: string): Layout {
  const ring = d * 0.06
  return {
    fields: [
      text('name', '名称', { x: d * 0.15, y: d * 0.28, width: d * 0.7, height: d * 0.3 }, nameSample, {
        fontSize: d * 0.17,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('sub', '副标', { x: d * 0.15, y: d * 0.58, width: d * 0.7, height: d * 0.16 }, subSample, {
        fontSize: d * 0.09,
        color: INK_SOFT,
      }),
      text('date', '日期', { x: d * 0.15, y: d * 0.74, width: d * 0.7, height: d * 0.12 }, '2026-11-08', {
        fontSize: d * 0.075,
        color: INK_MUTED,
      }),
    ],
    decor: svg(
      d,
      d,
      `<circle cx="${d / 2}" cy="${d / 2}" r="${d / 2 - ring / 2}" fill="none" stroke="${accent}" stroke-width="${ring}"/>` +
        `<circle cx="${d / 2}" cy="${d / 2}" r="${d * 0.36}" fill="none" stroke="${accent}" stroke-width="0.4" opacity="0.4"/>`,
    ),
  }
}

/** 序号/编号贴：编号超大、名称小字 */
function codeTag(w: number, h: number, accent: string): Layout {
  const pad = px(w)
  return {
    fields: [
      text('code', '编号', { x: pad, y: h * 0.08, width: w - pad * 2, height: h * 0.56 }, 'ZC-0158', {
        fontSize: h * 0.4,
        fontWeight: 'bold',
        color: accent,
        emphasis: 'hero',
      }),
      text('item', '名称', { x: pad, y: h * 0.66, width: w - pad * 2, height: h * 0.24 }, '激光打印机', {
        fontSize: h * 0.16,
        color: INK_SOFT,
      }),
    ],
    decor: svg(w, h, `<rect x="${pad}" y="${h * 0.62}" width="${w - pad * 2}" height="0.3" fill="${accent}" opacity="0.35"/>`),
  }
}

/** 名牌/胸卡：单位行、姓名大字、职务 */
function badgeC(w: number, h: number, accent: string): Layout {
  const pad = px(w)
  return {
    fields: [
      text('org', '单位', { x: pad, y: h * 0.12, width: w - pad * 2, height: h * 0.18 }, '云杉科技', {
        fontSize: h * 0.14,
        color: INK_SOFT,
      }),
      text('name', '姓名', { x: pad, y: h * 0.32, width: w - pad * 2, height: h * 0.42 }, '王小明', {
        fontSize: h * 0.32,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('role', '职务', { x: pad, y: h * 0.74, width: w - pad * 2, height: h * 0.16 }, '参会嘉宾', {
        fontSize: h * 0.13,
        color: accent,
      }),
    ],
    decor: svg(w, h, `<rect x="0" y="0" width="${w}" height="${Math.max(2, h * 0.07)}" fill="${accent}"/>`),
  }
}

/** 告示：标题、正文、落款（整版/大格通用） */
function noticeL(w: number, h: number, accent: string): Layout {
  const pad = Math.max(10, w * 0.075)
  return {
    fields: [
      text('title', '标题', { x: pad, y: h * 0.14, width: w - pad * 2, height: h * 0.16 }, '图书漂流角启用通知', {
        fontSize: h * 0.11,
        fontWeight: 'bold',
        align: 'left',
        emphasis: 'hero',
      }),
      text('body', '正文', { x: pad, y: h * 0.36, width: w - pad * 2, height: h * 0.5 }, '本周五起三楼图书漂流角正式开放，请借阅的同学登记姓名与班级，每次限借两本，两周内归还。', {
        fontSize: h * 0.045,
        color: INK_SOFT,
        align: 'left',
        verticalAlign: 'top',
        maxLines: 10,
        lineHeight: 1.7,
      }),
      text('org', '落款', { x: pad, y: h * 0.88, width: w - pad * 2, height: h * 0.06 }, '三年级组 宣', {
        fontSize: h * 0.04,
        color: INK_MUTED,
        align: 'right',
      }),
    ],
    decor: svg(
      w,
      h,
      `<rect x="0" y="0" width="${w}" height="${h * 0.045}" fill="${accent}"/>` +
        `<rect x="${pad}" y="${h * 0.32}" width="${w - pad * 2}" height="0.5" fill="${accent}" opacity="0.3"/>`,
    ),
  }
}

/** 卡片：主标题大字、副信息（门牌/分区牌/标语通用） */
function cardC(w: number, h: number, accent: string, sample: string): Layout {
  const pad = Math.max(8, w * 0.07)
  return {
    fields: [
      text('name', '标题', { x: pad, y: h * 0.2, width: w - pad * 2, height: h * 0.4 }, sample, {
        fontSize: h * 0.2,
        fontWeight: 'bold',
        align: 'center',
        emphasis: 'hero',
      }),
      text('sub', '副标', { x: pad, y: h * 0.68, width: w - pad * 2, height: h * 0.12 }, '班主任：李老师', {
        fontSize: h * 0.07,
        color: INK_SOFT,
        align: 'center',
      }),
      text('tag', '标语', { x: pad, y: h * 0.84, width: w - pad * 2, height: h * 0.08 }, '入室即静 入座即学', {
        fontSize: h * 0.055,
        color: INK_MUTED,
        align: 'center',
      }),
    ],
    decor: svg(
      w,
      h,
      `<rect x="0" y="0" width="${w}" height="${h * 0.045}" fill="${accent}"/>` +
        `<rect x="${pad}" y="${h * 0.63}" width="${w - pad * 2}" height="0.5" fill="${accent}" opacity="0.35"/>`,
    ),
  }
}

/** 由版式构造结果组装模板字段与 label 装饰 */
function lay(l: Layout): { fields: TemplateField[]; decorSvg?: string } {
  return l.decor ? { fields: l.fields, decorSvg: l.decor } : { fields: l.fields }
}

type PtMeta = Omit<
  LabelTemplate,
  'label' | 'page' | 'designedForPaper' | 'builtin' | 'fontFamily' | 'fontFamilyEn' | 'showLabelBorder'
> & { decorSvg?: string }

/** pp 便捷封装：slug + rotated + 模板元数据（decorSvg 会转入 label 规格） */
function pt(slug: string, rotated: boolean, tpl: PtMeta): LabelTemplate {
  const { decorSvg, ...rest } = tpl
  return pp(slug, rest, decorSvg ? { decorSvg } : {}, rotated)
}

// ================================================================
// 第一批：零覆盖纸型补齐（每种 2 款）
// ================================================================

export const paperSeries2Templates: LabelTemplate[] = [
  // ---- a4-2up-v（105×280 竖条 ×2）----
  pt('a4-2up-v', false, {
    id: 'ppTallCard2v',
    name: '对半竖条·席位竖卡',
    category: 'event',
    description: '105×280 mm 竖条格，单位、姓名、职务竖向排列，插立牌或贴门柱作席位引导。',
    scenario: 'A4 对半竖条不干胶专用',
    accent: '#1d4ed8',
    sampleData: { name: '王小明', org: '云杉科技', role: '产品总监' },
    demoDataset: 'meeting',
    ...lay(deskCard(dims('a4-2up-v').w, dims('a4-2up-v').h, '#1d4ed8')),
  }),
  pt('a4-2up-v', false, {
    id: 'ppTallGuide2v',
    name: '对半竖条·楼层指引贴',
    category: 'life',
    description: '105×280 mm 竖条格，区域名、方向说明，贴电梯旁与楼道转角做动线指引。',
    scenario: 'A4 对半竖条不干胶专用',
    accent: '#0f766e',
    sampleData: { name: '三楼 会议室区', sub: '← 301–310 直行' },
    demoDataset: 'meeting',
    ...lay(nsBar(dims('a4-2up-v').w, dims('a4-2up-v').h, '#0f766e', '← 301–310 直行', '方向', 'sub')),
  }),

  // ---- a4-2up-round（200×144 大圆角对开）----
  pt('a4-2up-round', false, {
    id: 'ppZoneCard2r',
    name: '圆角对开·仓库分区牌',
    category: 'life',
    description: '200×144 mm 圆角对开大格，区域名特大号、编号，贴仓库货架端头与分区墙面。',
    scenario: 'A4 圆角对开不干胶专用',
    accent: '#b45309',
    sampleData: { name: 'B 区 · 耗材', sub: '货架 B01–B12' },
    demoDataset: 'asset',
    ...lay(nsBar(dims('a4-2up-round').w, dims('a4-2up-round').h, '#b45309', '货架 B01–B12', '范围', 'sub')),
  }),
  pt('a4-2up-round', false, {
    id: 'ppClassDoor2r',
    name: '圆角对开·班级门牌',
    category: 'teaching',
    description: '200×144 mm 圆角对开大格，班级名大字、班主任信息，贴教室门与功能室门口。',
    scenario: 'A4 圆角对开不干胶专用',
    accent: '#7c3aed',
    sampleData: { name: '三（2）班', sub: '班主任：李老师' },
    demoDataset: 'classroom',
    ...lay(nsDots(dims('a4-2up-round').w, dims('a4-2up-round').h, '#7c3aed', '班主任：李老师', '三（2）班')),
  }),

  // ---- a4-6up-round（99.1×93.1 圆角六格）----
  pt('a4-6up-round', false, {
    id: 'ppToyBin6r',
    name: '圆角六·玩具筐标签',
    category: 'kids',
    description: '99.1×93.1 mm 圆角六格，图标块、物品名、归类提示，贴幼儿园玩具筐与收纳柜。',
    scenario: 'A4 圆角六格不干胶专用',
    accent: '#f97316',
    sampleData: { item: '积木区', sub: '玩完送回家' },
    demoDataset: 'kindergarten',
    ...lay(rowTag(dims('a4-6up-round').w, dims('a4-6up-round').h, '#f97316', '积', '积木区', '玩完送回家', '物品名', '提示')),
  }),
  pt('a4-6up-round', false, {
    id: 'ppBookZone6r',
    name: '圆角六·图书分类贴',
    category: 'teaching',
    description: '99.1×93.1 mm 圆角六格，分类名、编号区间，贴图书角书架与阅览室分类架。',
    scenario: 'A4 圆角六格不干胶专用',
    accent: '#0f766e',
    sampleData: { item: '绘本故事', sub: 'A01–A40' },
    demoDataset: 'classroom',
    ...lay(rowTag(dims('a4-6up-round').w, dims('a4-6up-round').h, '#0f766e', '书', '绘本故事', 'A01–A40', '分类名', '编号区间')),
  }),

  // ---- a4-14up（105×42.4 十四格）----
  pt('a4-14up', false, {
    id: 'ppName14',
    name: '十四·班级姓名贴',
    category: 'teaching',
    description: '105×42.4 mm 十四格，顶条款姓名、班级，课桌、作业本与储物柜都能贴。',
    scenario: 'A4 十四格不干胶专用',
    accent: '#2563eb',
    sampleData: { name: '王小明', sub: '三（2）班' },
    demoDataset: 'classroom',
    ...lay(nsBar(dims('a4-14up').w, dims('a4-14up').h, '#2563eb', '三（2）班')),
  }),
  pt('a4-14up', false, {
    id: 'ppItemTag14',
    name: '十四·物品分类标签',
    category: 'life',
    description: '105×42.4 mm 十四格，左块右文：物品名、类别编号，贴收纳盒与办公用品架。',
    scenario: 'A4 十四格不干胶专用',
    accent: '#44403c',
    sampleData: { item: '订书钉', sub: '办公耗材 · A-12' },
    demoDataset: 'asset',
    ...lay(rowTag(dims('a4-14up').w, dims('a4-14up').h, '#44403c', '耗', '订书钉', '办公耗材 · A-12', '物品名', '类别')),
  }),

  // ---- a4-15up（70×50.8 十五格）----
  pt('a4-15up', false, {
    id: 'ppName15',
    name: '十五·班级姓名贴',
    category: 'teaching',
    description: '70×50.8 mm 十五格，圆点款姓名、班级，低年级课桌与课本正合适。',
    scenario: 'A4 十五格不干胶专用',
    accent: '#e11d48',
    sampleData: { name: '王小明', sub: '三（2）班' },
    demoDataset: 'classroom',
    ...lay(nsDots(dims('a4-15up').w, dims('a4-15up').h, '#e11d48', '三（2）班', '王小明')),
  }),
  pt('a4-15up', false, {
    id: 'ppExam15',
    name: '十五·考场座贴',
    category: 'exam',
    description: '70×50.8 mm 十五格，考场、座位号、姓名考号，小型考场桌面粘贴。',
    scenario: 'A4 十五格不干胶专用',
    accent: '#1d4ed8',
    sampleData: { room: '第 03 考场', seat: '08', name: '王小明', examId: '2026061008' },
    demoDataset: 'exam',
    ...lay(examTag(dims('a4-15up').w, dims('a4-15up').h, '#1d4ed8')),
  }),

  // ---- a4-16up（105×37.1 十六格）----
  pt('a4-16up', false, {
    id: 'ppName16',
    name: '十六·横版姓名贴',
    category: 'teaching',
    description: '105×37.1 mm 十六格长条，顶条款姓名、班级，贴课桌前沿与作业本封面。',
    scenario: 'A4 十六格不干胶专用',
    accent: '#0891b2',
    sampleData: { name: '王小明', sub: '三（2）班' },
    demoDataset: 'classroom',
    ...lay(nsBar(dims('a4-16up').w, dims('a4-16up').h, '#0891b2', '三（2）班')),
  }),
  pt('a4-16up', false, {
    id: 'ppShelfTag16',
    name: '十六·货架层板标签',
    category: 'life',
    description: '105×37.1 mm 十六格长条，左块右文：品类名、编号，贴货架层板与抽屉面。',
    scenario: 'A4 十六格不干胶专用',
    accent: '#0f766e',
    sampleData: { item: '文具区', sub: 'W-01–W-20' },
    demoDataset: 'asset',
    ...lay(rowTag(dims('a4-16up').w, dims('a4-16up').h, '#0f766e', '文', '文具区', 'W-01–W-20', '品类名', '编号区间')),
  }),

  // ---- a4-20up（97×28 二十格窄条）----
  pt('a4-20up', false, {
    id: 'ppName20',
    name: '二十·窄条姓名贴',
    category: 'teaching',
    description: '97×28 mm 二十格窄条，姓名、班级一行排，贴铅笔盒、水杯与课本脊。',
    scenario: 'A4 二十格不干胶专用',
    accent: '#7c3aed',
    sampleData: { name: '王小明', sub: '三（2）班' },
    demoDataset: 'classroom',
    ...lay(nsBar(dims('a4-20up').w, dims('a4-20up').h, '#7c3aed', '三（2）班')),
  }),
  pt('a4-20up', false, {
    id: 'ppFileTab20',
    name: '二十·文件夹索引贴',
    category: 'life',
    description: '97×28 mm 二十格窄条，左块右文：类目、年度编号，贴文件夹侧签与档案盒面。',
    scenario: 'A4 二十格不干胶专用',
    accent: '#44403c',
    sampleData: { item: '合同档案', sub: '2026 · HT-01' },
    demoDataset: 'asset',
    ...lay(rowTag(dims('a4-20up').w, dims('a4-20up').h, '#44403c', '档', '合同档案', '2026 · HT-01', '类目', '编号')),
  }),

  // ---- a4-24up（70×37.1 二十四格）----
  pt('a4-24up', false, {
    id: 'ppName24',
    name: '二四·班级姓名贴',
    category: 'teaching',
    description: '70×37.1 mm 二十四格，顶条款姓名、班级，与圆角版同版式的方格选择。',
    scenario: 'A4 二十四格不干胶专用',
    accent: '#2563eb',
    sampleData: { name: '王小明', sub: '三（2）班' },
    demoDataset: 'classroom',
    ...lay(nsBar(dims('a4-24up').w, dims('a4-24up').h, '#2563eb', '三（2）班')),
  }),
  pt('a4-24up', false, {
    id: 'ppAddr24',
    name: '二四·回邮地址贴',
    category: 'life',
    description: '70×37.1 mm 二十四格，收件人、地址、电话三行，作回邮地址与包裹寄件贴。',
    scenario: 'A4 二十四格不干胶专用',
    accent: '#44403c',
    sampleData: { name: '王小明 收', addr: '上海市浦东新区世纪大道 100 号 3 栋 502', phone: '138 0000 0000' },
    demoDataset: 'asset',
    ...lay(addrLines(dims('a4-24up').w, dims('a4-24up').h, '#44403c')),
  }),

  // ---- a4-24up-narrow（64.5×33.8 窄二十四格）----
  pt('a4-24up-narrow', false, {
    id: 'ppPencil24n',
    name: '窄二四·铅笔姓名贴',
    category: 'kids',
    description: '64.5×33.8 mm 窄格，圆点款姓名、班级，细长贴面正好缠铅笔与尺子上。',
    scenario: 'A4 窄二十四格不干胶专用',
    accent: '#f97316',
    sampleData: { name: '乐乐', sub: '小（1）班' },
    demoDataset: 'kindergarten',
    ...lay(nsDots(dims('a4-24up-narrow').w, dims('a4-24up-narrow').h, '#f97316', '小（1）班')),
  }),
  pt('a4-24up-narrow', false, {
    id: 'ppCode24n',
    name: '窄二四·序号标签',
    category: 'life',
    description: '64.5×33.8 mm 窄格，编号大字、名称小字，作资产序号、样品编号与货架位贴。',
    scenario: 'A4 窄二十四格不干胶专用',
    accent: '#0f766e',
    sampleData: { code: 'ZC-0158', item: '激光打印机' },
    demoDataset: 'asset',
    ...lay(codeTag(dims('a4-24up-narrow').w, dims('a4-24up-narrow').h, '#0f766e')),
  }),

  // ---- a4-27up（70×31.5 二十七格）----
  pt('a4-27up', false, {
    id: 'ppName27',
    name: '二七·班级姓名贴',
    category: 'teaching',
    description: '70×31.5 mm 二十七格，顶条款姓名、班级，比二十四格更省纸的中等密度选择。',
    scenario: 'A4 二十七格不干胶专用',
    accent: '#0891b2',
    sampleData: { name: '王小明', sub: '三（2）班' },
    demoDataset: 'classroom',
    ...lay(nsBar(dims('a4-27up').w, dims('a4-27up').h, '#0891b2', '三（2）班')),
  }),
  pt('a4-27up', false, {
    id: 'ppItemTag27',
    name: '二七·小物品标签',
    category: 'life',
    description: '70×31.5 mm 二十七格，左块右文物品名、类别，贴调料罐、文具盒与小件收纳。',
    scenario: 'A4 二十七格不干胶专用',
    accent: '#b45309',
    sampleData: { item: '花椒', sub: '调料 · 2026-11' },
    demoDataset: 'restaurant',
    ...lay(rowTag(dims('a4-27up').w, dims('a4-27up').h, '#b45309', '调', '花椒', '调料 · 2026-11', '物品名', '类别')),
  }),

  // ---- a4-30up-round（63.5×28 圆角三十格）----
  pt('a4-30up-round', false, {
    id: 'ppName30r',
    name: '圆角三十·幼儿姓名贴',
    category: 'kids',
    description: '63.5×28 mm 圆角格，圆点款姓名、班级，幼儿园入园大批量姓名贴。',
    scenario: 'A4 圆角三十格不干胶专用',
    accent: '#ec4899',
    sampleData: { name: '乐乐', sub: '小（1）班' },
    demoDataset: 'kindergarten',
    ...lay(nsDots(dims('a4-30up-round').w, dims('a4-30up-round').h, '#ec4899', '小（1）班')),
  }),
  pt('a4-30up-round', false, {
    id: 'ppBookTag30r',
    name: '圆角三十·图书标签',
    category: 'teaching',
    description: '63.5×28 mm 圆角格，书名、编号两行，班级图书角与个人藏书贴。',
    scenario: 'A4 圆角三十格不干胶专用',
    accent: '#0f766e',
    sampleData: { item: '《夏洛的网》', sub: '图书角 · B-023' },
    demoDataset: 'classroom',
    ...lay(rowTag(dims('a4-30up-round').w, dims('a4-30up-round').h, '#0f766e', '书', '《夏洛的网》', '图书角 · B-023', '书名', '编号')),
  }),

  // ---- a4-32up-round（47×33 圆角三十二格）----
  pt('a4-32up-round', false, {
    id: 'ppName32r',
    name: '圆角三二·迷你姓名贴',
    category: 'kids',
    description: '47×33 mm 小圆角格，姓名居中大字，迷你尺寸贴文具、餐具与小物件。',
    scenario: 'A4 圆角三十二格不干胶专用',
    accent: '#8b5cf6',
    sampleData: { name: '乐乐' },
    demoDataset: 'kindergarten',
    ...lay(nsMini(dims('a4-32up-round').w, dims('a4-32up-round').h, '#8b5cf6', '乐乐')),
  }),
  pt('a4-32up-round', false, {
    id: 'ppSid32r',
    name: '圆角三二·学号标签',
    category: 'teaching',
    description: '47×33 mm 小圆角格，学号、姓名两行，贴作业本角与考勤表。',
    scenario: 'A4 圆角三十二格不干胶专用',
    accent: '#2563eb',
    sampleData: { code: '08', item: '王小明' },
    demoDataset: 'classroom',
    ...lay(codeTag(dims('a4-32up-round').w, dims('a4-32up-round').h, '#2563eb')),
  }),

  // ---- a4-33up（70×25.4 三十三格窄条）----
  pt('a4-33up', false, {
    id: 'ppName33',
    name: '三三·窄条姓名贴',
    category: 'teaching',
    description: '70×25.4 mm 窄条格，姓名、班级紧凑排布，贴文具与课本的小面积位置。',
    scenario: 'A4 三十三格不干胶专用',
    accent: '#2563eb',
    sampleData: { name: '王小明', sub: '三（2）班' },
    demoDataset: 'classroom',
    ...lay(nsBar(dims('a4-33up').w, dims('a4-33up').h, '#2563eb', '三（2）班')),
  }),
  pt('a4-33up', false, {
    id: 'ppAddr33',
    name: '三三·回邮地址贴',
    category: 'life',
    description: '70×25.4 mm 窄条格，收件人、地址两行，作信封回邮地址与批量寄件贴。',
    scenario: 'A4 三十三格不干胶专用',
    accent: '#44403c',
    sampleData: { name: '王小明 收', addr: '上海市浦东新区世纪大道 100 号 3 栋 502', phone: '138 0000 0000' },
    demoDataset: 'asset',
    ...lay(addrLines(dims('a4-33up').w, dims('a4-33up').h, '#44403c')),
  }),

  // ---- a4-40up-round（45.7×25.4 圆角四十格）----
  pt('a4-40up-round', false, {
    id: 'ppName40r',
    name: '圆角四十·迷你姓名贴',
    category: 'kids',
    description: '45.7×25.4 mm 小圆角格，姓名居中大字，高密度批量出的入园姓名贴。',
    scenario: 'A4 圆角四十格不干胶专用',
    accent: '#f97316',
    sampleData: { name: '乐乐' },
    demoDataset: 'kindergarten',
    ...lay(nsMini(dims('a4-40up-round').w, dims('a4-40up-round').h, '#f97316', '乐乐')),
  }),
  pt('a4-40up-round', false, {
    id: 'ppItemTag40r',
    name: '圆角四十·文具标签',
    category: 'kids',
    description: '45.7×25.4 mm 小圆角格，物品名、班级，贴蜡笔、剪刀、胶棒等共用文具。',
    scenario: 'A4 圆角四十格不干胶专用',
    accent: '#0f766e',
    sampleData: { item: '蜡笔', sub: '小（1）班' },
    demoDataset: 'kindergarten',
    ...lay(rowTag(dims('a4-40up-round').w, dims('a4-40up-round').h, '#0f766e', '文', '蜡笔', '小（1）班', '物品名', '班级')),
  }),

  // ---- a4-68up（48×16.9 六十八格迷你）----
  pt('a4-68up', false, {
    id: 'ppName68',
    name: '六八·迷你姓名贴',
    category: 'kids',
    description: '48×16.9 mm 超小格，单行大字姓名，一张 A4 出 68 枚的极限密度。',
    scenario: 'A4 六十八格不干胶专用',
    accent: '#2563eb',
    sampleData: { name: '乐乐' },
    demoDataset: 'kindergarten',
    ...lay(nsMini(dims('a4-68up').w, dims('a4-68up').h, '#2563eb', '乐乐')),
  }),
  pt('a4-68up', false, {
    id: 'ppCode68',
    name: '六八·序号标签',
    category: 'life',
    description: '48×16.9 mm 超小格，编号大字一行，作流水号、样品码与迷你资产标签。',
    scenario: 'A4 六十八格不干胶专用',
    accent: '#44403c',
    sampleData: { code: 'ZC-0158', item: '激光打印机' },
    demoDataset: 'asset',
    ...lay(codeTag(dims('a4-68up').w, dims('a4-68up').h, '#44403c')),
  }),

  // ---- avery-5390（88.9×56.36 徽章内页 8-up）----
  pt('avery-5390', false, {
    id: 'ppBadge5390a',
    name: '5390·会议名牌',
    category: 'event',
    description: '88.9×56.36 mm 徽章内页，单位、姓名、职务，打印后装入标准名牌卡套。',
    scenario: 'Avery 5390 徽章内页专用',
    accent: '#1d4ed8',
    sampleData: { name: '王小明', org: '云杉科技', role: '参会嘉宾' },
    demoDataset: 'meeting',
    ...lay(badgeC(dims('avery-5390').w, dims('avery-5390').h, '#1d4ed8')),
  }),
  pt('avery-5390', false, {
    id: 'ppVisitor5390',
    name: '5390·访客证',
    category: 'event',
    description: '88.9×56.36 mm 徽章内页，访客单位、姓名、日期，前台批量打印访客胸卡。',
    scenario: 'Avery 5390 徽章内页专用',
    accent: '#0f766e',
    sampleData: { name: '王小明', org: '访客 · 云杉科技', role: '2026-11-08' },
    demoDataset: 'meeting',
    ...lay(badgeC(dims('avery-5390').w, dims('avery-5390').h, '#0f766e')),
  }),

  // ---- avery-5392（101.6×76.2 大徽章 6-up）----
  pt('avery-5392', false, {
    id: 'ppBadge5392a',
    name: '5392·大会名牌',
    category: 'event',
    description: '101.6×76.2 mm 大徽章内页，姓名特大号、单位职务，展会与年会主视觉胸牌。',
    scenario: 'Avery 5392 大徽章专用',
    accent: '#b45309',
    sampleData: { name: '王小明', org: '云杉科技', role: '演讲嘉宾' },
    demoDataset: 'meeting',
    ...lay(badgeC(dims('avery-5392').w, dims('avery-5392').h, '#b45309')),
  }),
  pt('avery-5392', false, {
    id: 'ppStaff5392',
    name: '5392·工作胸牌',
    category: 'event',
    description: '101.6×76.2 mm 大徽章内页，部门、姓名、工号，临时工作证与活动工作人员胸牌。',
    scenario: 'Avery 5392 大徽章专用',
    accent: '#7c3aed',
    sampleData: { name: '王小明', org: '会务组', role: '工号 A-108' },
    demoDataset: 'meeting',
    ...lay(badgeC(dims('avery-5392').w, dims('avery-5392').h, '#7c3aed')),
  }),

  // ================================================================
  // 第二批：头部纸型按用户群体补风格
  // ================================================================

  // ---- a4-8up（105×74.25 八分格）----
  pt('a4-8up', false, {
    id: 'ppTraining8',
    name: '八分·商务培训桌牌',
    category: 'event',
    description: '105×74.25 mm 八分格，单位、姓名、职务商务版式，企业内训与研讨会桌牌。',
    scenario: 'A4 八分格不干胶专用',
    accent: '#334155',
    sampleData: { name: '王小明', org: '云杉科技', role: '产品总监' },
    demoDataset: 'meeting',
    ...lay(deskCard(dims('a4-8up').w, dims('a4-8up').h, '#334155')),
  }),
  pt('a4-8up', false, {
    id: 'ppToyTag8',
    name: '八分·卡通物品贴',
    category: 'kids',
    description: '105×74.25 mm 八分格，图标块、物品名、提示语，贴玩具柜、图书袋与植物角。',
    scenario: 'A4 八分格不干胶专用',
    accent: '#f97316',
    sampleData: { item: '积木区', sub: '玩完送回家' },
    demoDataset: 'kindergarten',
    ...lay(rowTag(dims('a4-8up').w, dims('a4-8up').h, '#f97316', '玩', '积木区', '玩完送回家', '物品名', '提示')),
  }),
  pt('a4-8up', false, {
    id: 'ppExamDesk8r',
    name: '八分·考场桌贴红版',
    category: 'exam',
    description: '105×74.25 mm 八分格，红色考场、座位号、姓名考号，巡考一眼可辨的醒目版式。',
    scenario: 'A4 八分格不干胶专用',
    accent: '#dc2626',
    sampleData: { room: '第 03 考场', seat: '08', name: '王小明', examId: '2026061008' },
    demoDataset: 'exam',
    ...lay(examTag(dims('a4-8up').w, dims('a4-8up').h, '#dc2626')),
  }),
  pt('a4-8up', false, {
    id: 'ppBoxTag8',
    name: '八分·库房储物箱贴',
    category: 'life',
    description: '105×74.25 mm 八分格，物品名、类别编号，贴库房周转箱、档案箱与搬迁纸箱。',
    scenario: 'A4 八分格不干胶专用',
    accent: '#44403c',
    sampleData: { item: '冬季被褥', sub: '客房备品 · BX-07' },
    demoDataset: 'asset',
    ...lay(rowTag(dims('a4-8up').w, dims('a4-8up').h, '#44403c', '箱', '冬季被褥', '客房备品 · BX-07', '物品名', '类别')),
  }),

  // ---- a4-8up-round（99.1×67.7 圆角八格）----
  pt('a4-8up-round', false, {
    id: 'ppExamDesk8ro',
    name: '圆角八·考场座贴',
    category: 'exam',
    description: '99.1×67.7 mm 圆角格，考场、座位号、姓名考号，圆角边不易卷翘的桌贴。',
    scenario: 'A4 圆角八格不干胶专用',
    accent: '#1d4ed8',
    sampleData: { room: '第 03 考场', seat: '08', name: '王小明', examId: '2026061008' },
    demoDataset: 'exam',
    ...lay(examTag(dims('a4-8up-round').w, dims('a4-8up-round').h, '#1d4ed8')),
  }),
  pt('a4-8up-round', false, {
    id: 'ppItemTag8ro',
    name: '圆角八·物品标签',
    category: 'life',
    description: '99.1×67.7 mm 圆角格，图标块、物品名、类别，贴收纳箱、教具筐与药箱。',
    scenario: 'A4 圆角八格不干胶专用',
    accent: '#0f766e',
    sampleData: { item: '急救药品', sub: '常备 · 检查日期' },
    demoDataset: 'asset',
    ...lay(rowTag(dims('a4-8up-round').w, dims('a4-8up-round').h, '#0f766e', '药', '急救药品', '常备 · 检查日期', '物品名', '备注')),
  }),

  // ---- a4-8up-round-90（90×72 圆角八格）----
  pt('a4-8up-round-90', false, {
    id: 'ppDeskCard8r90',
    name: '圆角八·会议桌牌',
    category: 'event',
    description: '90×72 mm 近方格，单位、姓名、职务居中版式，小型研讨会与面试桌牌。',
    scenario: 'A4 圆角八格（90×72）专用',
    accent: '#7c3aed',
    sampleData: { name: '王小明', org: '云杉科技', role: '面试官' },
    demoDataset: 'meeting',
    ...lay(deskCard(dims('a4-8up-round-90').w, dims('a4-8up-round-90').h, '#7c3aed')),
  }),

  // ---- a4-10up（105×59.4 十格）----
  pt('a4-10up', false, {
    id: 'ppPrice10g',
    name: '十格·零售价签绿版',
    category: 'life',
    description: '105×59.4 mm 十格，商品名、规格、大号价格，生鲜、烘焙与便利店货架价签。',
    scenario: 'A4 十格价签专用',
    accent: '#16a34a',
    sampleData: { item: '手作曲奇', spec: '200g / 盒', price: '19.9', unit: '元 / 盒' },
    demoDataset: 'retail',
    ...lay(priceTag(dims('a4-10up').w, dims('a4-10up').h, '#16a34a')),
  }),
  pt('a4-10up', false, {
    id: 'ppWeddingCard10',
    name: '十格·婚宴席位卡',
    category: 'wedding',
    description: '105×59.4 mm 十格，姓名、桌号简洁版式，婚宴签到台平卡席位指引。',
    scenario: 'A4 十格不干胶专用',
    accent: '#be123c',
    sampleData: { name: '王小明', sub: '第 6 桌' },
    demoDataset: 'wedding',
    ...lay(nsBar(dims('a4-10up').w, dims('a4-10up').h, '#be123c', '第 6 桌', '桌号', 'sub')),
  }),
  pt('a4-10up', false, {
    id: 'ppNameStrip10',
    name: '十格·姓名胸条',
    category: 'event',
    description: '105×59.4 mm 十格，姓名大字、单位，培训胸条与志愿者识别贴。',
    scenario: 'A4 十格不干胶专用',
    accent: '#1d4ed8',
    sampleData: { name: '王小明', sub: '云杉科技' },
    demoDataset: 'meeting',
    ...lay(nsBar(dims('a4-10up').w, dims('a4-10up').h, '#1d4ed8', '云杉科技', '单位', 'sub')),
  }),

  // ---- a4-10up-round（99.1×57.7 圆角十格）----
  pt('a4-10up-round', false, {
    id: 'ppPrice10ro',
    name: '圆角十·烘焙价签',
    category: 'life',
    description: '99.1×57.7 mm 圆角格，品名、大号价格，面包房与手作摊位的暖色价签。',
    scenario: 'A4 圆角十格不干胶专用',
    accent: '#b45309',
    sampleData: { item: '手作曲奇', spec: '200g / 盒', price: '19.9', unit: '元 / 盒' },
    demoDataset: 'retail',
    ...lay(priceTag(dims('a4-10up-round').w, dims('a4-10up-round').h, '#b45309')),
  }),

  // ---- a4-12up（105×49.5 十二格）----
  pt('a4-12up', false, {
    id: 'ppFileBox12b',
    name: '十二·文件盒标签',
    category: 'life',
    description: '105×49.5 mm 十二格，类目、年度编号，贴文件盒正面与档案柜抽屉。',
    scenario: 'A4 十二格不干胶专用',
    accent: '#44403c',
    sampleData: { item: '财务凭证', sub: '2026 年度 · CW-01' },
    demoDataset: 'asset',
    ...lay(rowTag(dims('a4-12up').w, dims('a4-12up').h, '#44403c', '档', '财务凭证', '2026 年度 · CW-01', '类目', '编号')),
  }),
  pt('a4-12up', false, {
    id: 'ppItemTag12',
    name: '十二·班级物品标签',
    category: 'teaching',
    description: '105×49.5 mm 十二格，物品名、归属班级，贴教具箱、体育器材与实验器材。',
    scenario: 'A4 十二格不干胶专用',
    accent: '#0f766e',
    sampleData: { item: '跳绳', sub: '三（2）班器材' },
    demoDataset: 'classroom',
    ...lay(rowTag(dims('a4-12up').w, dims('a4-12up').h, '#0f766e', '器', '跳绳', '三（2）班器材', '物品名', '归属')),
  }),

  // ---- a4-12up-3x4（70×67.7 近方十二格）----
  pt('a4-12up-3x4', false, {
    id: 'ppBinTag12sq',
    name: '方十二·物品筐标签',
    category: 'life',
    description: '70×67.7 mm 近方格，图标块、物品名、类别，贴收纳筐与层板分类。',
    scenario: 'A4 方格十二格不干胶专用',
    accent: '#b45309',
    sampleData: { item: '冬季用品', sub: '换季收纳' },
    demoDataset: 'asset',
    ...lay(rowTag(dims('a4-12up-3x4').w, dims('a4-12up-3x4').h, '#b45309', '收', '冬季用品', '换季收纳', '物品名', '类别')),
  }),

  // ---- a4-12up-narrow（96.5×42.3 窄十二格）----
  pt('a4-12up-narrow', false, {
    id: 'ppName12n',
    name: '窄十二·姓名贴',
    category: 'teaching',
    description: '96.5×42.3 mm 窄格，顶条款姓名、班级，课桌侧沿与置物柜都贴得下。',
    scenario: 'A4 窄十二格不干胶专用',
    accent: '#7c3aed',
    sampleData: { name: '王小明', sub: '三（2）班' },
    demoDataset: 'classroom',
    ...lay(nsBar(dims('a4-12up-narrow').w, dims('a4-12up-narrow').h, '#7c3aed', '三（2）班')),
  }),

  // ---- a4-14up-round（99.1×38.1 圆角十四格）----
  pt('a4-14up-round', false, {
    id: 'ppName14r',
    name: '圆角十四·班级姓名贴',
    category: 'teaching',
    description: '99.1×38.1 mm 圆角格，顶条款姓名、班级，圆角边更耐撕的课桌姓名贴。',
    scenario: 'A4 圆角十四格不干胶专用',
    accent: '#2563eb',
    sampleData: { name: '王小明', sub: '三（2）班' },
    demoDataset: 'classroom',
    ...lay(nsBar(dims('a4-14up-round').w, dims('a4-14up-round').h, '#2563eb', '三（2）班')),
  }),

  // ---- a4-16up-round（99.1×33.8 圆角十六格）----
  pt('a4-16up-round', false, {
    id: 'ppName16r',
    name: '圆角十六·姓名贴',
    category: 'teaching',
    description: '99.1×33.8 mm 圆角格，姓名、班级，中高密度姓名贴的圆角版本。',
    scenario: 'A4 圆角十六格不干胶专用',
    accent: '#0891b2',
    sampleData: { name: '王小明', sub: '三（2）班' },
    demoDataset: 'classroom',
    ...lay(nsBar(dims('a4-16up-round').w, dims('a4-16up-round').h, '#0891b2', '三（2）班')),
  }),

  // ---- a4-18up-round（63.5×46.6 圆角十八格）----
  pt('a4-18up-round', false, {
    id: 'ppSpiceDate18',
    name: '圆角十八·调料日期贴',
    category: 'life',
    description: '63.5×46.6 mm 圆角格，品名、日期、限期，贴调料罐、干货罐与冰箱收纳盒。',
    scenario: 'A4 圆角十八格不干胶专用',
    accent: '#b45309',
    sampleData: { name: '花椒', date: '2026-11-08', note: '阴凉保存' },
    demoDataset: 'restaurant',
    ...lay(dateTag(dims('a4-18up-round').w, dims('a4-18up-round').h, '#b45309', '装罐日期')),
  }),
  pt('a4-18up-round', false, {
    id: 'ppOpenDate18b',
    name: '圆角十八·护肤品开封贴',
    category: 'life',
    description: '63.5×46.6 mm 圆角格，品名、开封日期、限用期，贴护肤品与化妆品瓶罐。',
    scenario: 'A4 圆角十八格不干胶专用',
    accent: '#ec4899',
    sampleData: { name: '精华液', date: '2026-11-08', note: '12 个月内用完' },
    demoDataset: 'asset',
    ...lay(dateTag(dims('a4-18up-round').w, dims('a4-18up-round').h, '#ec4899', '开封日期')),
  }),
  pt('a4-18up-round', false, {
    id: 'ppName18r',
    name: '圆角十八·姓名贴',
    category: 'teaching',
    description: '63.5×46.6 mm 圆角格，顶条款姓名、班级，中等尺寸的课本与课桌通用款。',
    scenario: 'A4 圆角十八格不干胶专用',
    accent: '#2563eb',
    sampleData: { name: '王小明', sub: '三（2）班' },
    demoDataset: 'classroom',
    ...lay(nsBar(dims('a4-18up-round').w, dims('a4-18up-round').h, '#2563eb', '三（2）班')),
  }),

  // ---- a4-21up（70×42.4 二十一格）----
  pt('a4-21up', false, {
    id: 'ppSidName21',
    name: '二一·学号姓名双行贴',
    category: 'teaching',
    description: '70×42.4 mm 二十一格，左学号色块、姓名，点名与作业收发两用的高频款。',
    scenario: 'A4 二十一格不干胶专用',
    accent: '#1d4ed8',
    sampleData: { item: '王小明', sub: '08' },
    demoDataset: 'classroom',
    ...lay(rowTag(dims('a4-21up').w, dims('a4-21up').h, '#1d4ed8', '号', '王小明', '学号 08', '姓名', '学号')),
  }),
  pt('a4-21up', false, {
    id: 'ppNameCart21',
    name: '二一·卡通姓名贴',
    category: 'kids',
    description: '70×42.4 mm 二十一格，圆点描边、彩色姓名，低年级课本与物品通用。',
    scenario: 'A4 二十一格不干胶专用',
    accent: '#ec4899',
    sampleData: { name: '乐乐', sub: '小（1）班' },
    demoDataset: 'kindergarten',
    ...lay(nsDots(dims('a4-21up').w, dims('a4-21up').h, '#ec4899', '小（1）班')),
  }),
  pt('a4-21up', false, {
    id: 'ppAddr21',
    name: '二一·回邮地址贴',
    category: 'life',
    description: '70×42.4 mm 二十一格，收件人、地址、电话，信封回邮地址与店铺寄件贴。',
    scenario: 'A4 二十一格不干胶专用',
    accent: '#44403c',
    sampleData: { name: '王小明 收', addr: '上海市浦东新区世纪大道 100 号 3 栋 502', phone: '138 0000 0000' },
    demoDataset: 'asset',
    ...lay(addrLines(dims('a4-21up').w, dims('a4-21up').h, '#44403c')),
  }),
  pt('a4-21up', false, {
    id: 'ppSpice21',
    name: '二一·调料罐标签',
    category: 'life',
    description: '70×42.4 mm 二十一格，品名、日期、限期，厨房调料罐与储物罐的规整标签。',
    scenario: 'A4 二十一格不干胶专用',
    accent: '#b45309',
    sampleData: { name: '花椒', date: '2026-11-08', note: '阴凉保存' },
    demoDataset: 'restaurant',
    ...lay(dateTag(dims('a4-21up').w, dims('a4-21up').h, '#b45309', '装罐日期')),
  }),

  // ---- a4-21up-round（63.5×38.1 圆角二十一格）----
  pt('a4-21up-round', false, {
    id: 'ppName21r',
    name: '圆角二一·班级姓名贴',
    category: 'teaching',
    description: '63.5×38.1 mm 圆角格，顶条款姓名、班级，圆角边不易卷边的课桌款。',
    scenario: 'A4 圆角二十一格不干胶专用',
    accent: '#2563eb',
    sampleData: { name: '王小明', sub: '三（2）班' },
    demoDataset: 'classroom',
    ...lay(nsBar(dims('a4-21up-round').w, dims('a4-21up-round').h, '#2563eb', '三（2）班')),
  }),
  pt('a4-21up-round', false, {
    id: 'ppDate21r',
    name: '圆角二一·烘焙日期贴',
    category: 'life',
    description: '63.5×38.1 mm 圆角格，品名、制作日期、食用期限，烘焙与鲜食店后厨标签。',
    scenario: 'A4 圆角二十一格不干胶专用',
    accent: '#b45309',
    sampleData: { name: '草莓果酱', date: '2026-11-08', note: '冷藏 30 天内' },
    demoDataset: 'restaurant',
    ...lay(dateTag(dims('a4-21up-round').w, dims('a4-21up-round').h, '#b45309', '制作日期')),
  }),

  // ---- a4-22up-round（96×25.5 圆角二十二格）----
  pt('a4-22up-round', false, {
    id: 'ppName22r',
    name: '圆角二二·窄条姓名贴',
    category: 'teaching',
    description: '96×25.5 mm 圆角窄条，姓名、班级，贴在课桌前沿刚好露出名字的尺寸。',
    scenario: 'A4 圆角二十二格专用',
    accent: '#0891b2',
    sampleData: { name: '王小明', sub: '三（2）班' },
    demoDataset: 'classroom',
    ...lay(nsBar(dims('a4-22up-round').w, dims('a4-22up-round').h, '#0891b2', '三（2）班')),
  }),

  // ---- a4-24up-round（63.5×33.9 圆角二十四格）----
  pt('a4-24up-round', false, {
    id: 'ppNameCart24r',
    name: '圆角二四·卡通姓名贴',
    category: 'kids',
    description: '63.5×33.9 mm 圆角格，圆点描边、彩色姓名，幼儿园入园与低年级课本通用。',
    scenario: 'A4 圆角二十四格不干胶专用',
    accent: '#ec4899',
    sampleData: { name: '乐乐', sub: '小（1）班' },
    demoDataset: 'kindergarten',
    ...lay(nsDots(dims('a4-24up-round').w, dims('a4-24up-round').h, '#ec4899', '小（1）班')),
  }),
  pt('a4-24up-round', false, {
    id: 'ppClassTag24r',
    name: '圆角二四·值日姓名贴',
    category: 'teaching',
    description: '63.5×33.9 mm 圆角格，姓名、值日岗位，班级值日表与小组分工标签。',
    scenario: 'A4 圆角二十四格不干胶专用',
    accent: '#0f766e',
    sampleData: { name: '王小明', sub: '图书管理员' },
    demoDataset: 'classroom',
    ...lay(nsBar(dims('a4-24up-round').w, dims('a4-24up-round').h, '#0f766e', '图书管理员', '岗位', 'sub')),
  }),
  pt('a4-24up-round', false, {
    id: 'ppEngName24r',
    name: '圆角二四·英文姓名贴',
    category: 'teaching',
    description: '63.5×33.9 mm 圆角格，英文姓名大字、中文名小字，双语课堂与国际班都适用。',
    scenario: 'A4 圆角二十四格不干胶专用',
    accent: '#7c3aed',
    sampleData: { name: 'Emma', sub: '王小明' },
    demoDataset: 'classroom',
    ...lay(nsBar(dims('a4-24up-round').w, dims('a4-24up-round').h, '#7c3aed', '王小明', '中文名', 'sub')),
  }),
  pt('a4-24up-round', false, {
    id: 'ppDate24r',
    name: '圆角二四·开封日期贴',
    category: 'life',
    description: '63.5×33.9 mm 圆角格，品名、开封日期、限期，贴护肤品、奶粉罐与药品盒。',
    scenario: 'A4 圆角二十四格不干胶专用',
    accent: '#b45309',
    sampleData: { name: '奶粉', date: '2026-11-08', note: '开封后 4 周内' },
    demoDataset: 'asset',
    ...lay(dateTag(dims('a4-24up-round').w, dims('a4-24up-round').h, '#b45309', '开封日期')),
  }),

  // ---- a4-30up（70×29.7 三十格）----
  pt('a4-30up', false, {
    id: 'ppPencil30',
    name: '三十·文具姓名贴',
    category: 'kids',
    description: '70×29.7 mm 三十格，圆点款姓名、班级，铅笔、尺子、水彩笔上的细长姓名贴。',
    scenario: 'A4 三十格不干胶专用',
    accent: '#f97316',
    sampleData: { name: '乐乐', sub: '小（1）班' },
    demoDataset: 'kindergarten',
    ...lay(nsDots(dims('a4-30up').w, dims('a4-30up').h, '#f97316', '小（1）班')),
  }),
  pt('a4-30up', false, {
    id: 'ppBookTag30',
    name: '三十·图书标签',
    category: 'teaching',
    description: '70×29.7 mm 三十格，书名、索书编号两行，班级图书角与个人藏书管理。',
    scenario: 'A4 三十格不干胶专用',
    accent: '#0f766e',
    sampleData: { item: '《夏洛的网》', sub: '图书角 · B-023' },
    demoDataset: 'classroom',
    ...lay(rowTag(dims('a4-30up').w, dims('a4-30up').h, '#0f766e', '书', '《夏洛的网》', '图书角 · B-023', '书名', '编号')),
  }),
  pt('a4-30up', false, {
    id: 'ppEngName30',
    name: '三十·英文姓名贴',
    category: 'teaching',
    description: '70×29.7 mm 三十格，英文姓名大字、中文小字，英语课堂与外教班常用。',
    scenario: 'A4 三十格不干胶专用',
    accent: '#7c3aed',
    sampleData: { name: 'Emma', sub: '王小明' },
    demoDataset: 'classroom',
    ...lay(nsBar(dims('a4-30up').w, dims('a4-30up').h, '#7c3aed', '王小明', '中文名', 'sub')),
  }),

  // ---- a4-40up（52.5×29.7 四十格）----
  pt('a4-40up', false, {
    id: 'ppName40',
    name: '四十·迷你姓名贴',
    category: 'kids',
    description: '52.5×29.7 mm 小格，姓名居中大字，高密度批量出的文具与物品贴。',
    scenario: 'A4 四十格不干胶专用',
    accent: '#2563eb',
    sampleData: { name: '乐乐' },
    demoDataset: 'kindergarten',
    ...lay(nsMini(dims('a4-40up').w, dims('a4-40up').h, '#2563eb', '乐乐')),
  }),
  pt('a4-40up', false, {
    id: 'ppCode40',
    name: '四十·资产序号贴',
    category: 'life',
    description: '52.5×29.7 mm 小格，编号大字、名称小字，行政资产盘点与样品编号。',
    scenario: 'A4 四十格不干胶专用',
    accent: '#44403c',
    sampleData: { code: 'ZC-0158', item: '激光打印机' },
    demoDataset: 'asset',
    ...lay(codeTag(dims('a4-40up').w, dims('a4-40up').h, '#44403c')),
  }),
  pt('a4-40up', false, {
    id: 'ppNameCart40',
    name: '四十·卡通姓名贴',
    category: 'kids',
    description: '52.5×29.7 mm 小格，圆点描边姓名，幼儿园小件物品与小奖品标签。',
    scenario: 'A4 四十格不干胶专用',
    accent: '#ec4899',
    sampleData: { name: '乐乐', sub: '小（1）班' },
    demoDataset: 'kindergarten',
    ...lay(nsDots(dims('a4-40up').w, dims('a4-40up').h, '#ec4899', '小（1）班')),
  }),

  // ---- a4-44up-round（48.5×25.4 圆角四十四格）----
  pt('a4-44up-round', false, {
    id: 'ppName44r',
    name: '圆角四四·迷你姓名贴',
    category: 'kids',
    description: '48.5×25.4 mm 小圆角格，姓名居中大字，一版 44 枚的高密度入园姓名贴。',
    scenario: 'A4 圆角四十四格专用',
    accent: '#2563eb',
    sampleData: { name: '乐乐' },
    demoDataset: 'kindergarten',
    ...lay(nsMini(dims('a4-44up-round').w, dims('a4-44up-round').h, '#2563eb', '乐乐')),
  }),
  pt('a4-44up-round', false, {
    id: 'ppCode44r',
    name: '圆角四四·序号贴',
    category: 'life',
    description: '48.5×25.4 mm 小圆角格，编号大字一行，作流水号与迷你资产标签。',
    scenario: 'A4 圆角四十四格专用',
    accent: '#0f766e',
    sampleData: { code: 'ZC-0158', item: '激光打印机' },
    demoDataset: 'asset',
    ...lay(codeTag(dims('a4-44up-round').w, dims('a4-44up-round').h, '#0f766e')),
  }),

  // ---- a4-48up-round（45.7×21.2 圆角四十八格）----
  pt('a4-48up-round', false, {
    id: 'ppName48r',
    name: '圆角四八·迷你姓名贴',
    category: 'kids',
    description: '45.7×21.2 mm 小圆角格，单行大字姓名，一张出 48 枚的紧凑姓名贴。',
    scenario: 'A4 圆角四十八格专用',
    accent: '#f97316',
    sampleData: { name: '乐乐' },
    demoDataset: 'kindergarten',
    ...lay(nsMini(dims('a4-48up-round').w, dims('a4-48up-round').h, '#f97316', '乐乐')),
  }),
  pt('a4-48up-round', false, {
    id: 'ppPencil48r',
    name: '圆角四八·文具姓名贴',
    category: 'kids',
    description: '45.7×21.2 mm 小圆角格，圆点描边姓名，缠铅笔与贴文具盒都合适。',
    scenario: 'A4 圆角四十八格专用',
    accent: '#8b5cf6',
    sampleData: { name: '乐乐', sub: '小（1）班' },
    demoDataset: 'kindergarten',
    ...lay(nsDots(dims('a4-48up-round').w, dims('a4-48up-round').h, '#8b5cf6', '小（1）班')),
  }),

  // ---- a4-56up（52.5×21.2 五十六格）----
  pt('a4-56up', false, {
    id: 'ppName56m',
    name: '五六·迷你姓名贴',
    category: 'kids',
    description: '52.5×21.2 mm 窄格，单行大字姓名，一张出 56 枚的批量姓名贴。',
    scenario: 'A4 五十六格不干胶专用',
    accent: '#2563eb',
    sampleData: { name: '乐乐' },
    demoDataset: 'kindergarten',
    ...lay(nsMini(dims('a4-56up').w, dims('a4-56up').h, '#2563eb', '乐乐')),
  }),
  pt('a4-56up', false, {
    id: 'ppCode56',
    name: '五六·序号标签',
    category: 'life',
    description: '52.5×21.2 mm 窄格，编号大字一行，样品码、考位号与流水序号。',
    scenario: 'A4 五十六格不干胶专用',
    accent: '#44403c',
    sampleData: { code: 'ZC-0158', item: '激光打印机' },
    demoDataset: 'asset',
    ...lay(codeTag(dims('a4-56up').w, dims('a4-56up').h, '#44403c')),
  }),

  // ---- a4-65up-round（38.1×21.2 圆角六十五格）----
  pt('a4-65up-round', false, {
    id: 'ppName65r',
    name: '圆角六五·迷你姓名贴',
    category: 'kids',
    description: '38.1×21.2 mm 迷你格，单行大字姓名，防水材质常用规格的极限密度。',
    scenario: 'A4 圆角六十五格不干胶专用',
    accent: '#ec4899',
    sampleData: { name: '乐乐' },
    demoDataset: 'kindergarten',
    ...lay(nsMini(dims('a4-65up-round').w, dims('a4-65up-round').h, '#ec4899', '乐乐')),
  }),
  pt('a4-65up-round', false, {
    id: 'ppPencil65r',
    name: '圆角六五·铅笔姓名贴',
    category: 'kids',
    description: '38.1×21.2 mm 迷你格，姓名、班级两点排布，贴铅笔与细杆文具。',
    scenario: 'A4 圆角六十五格不干胶专用',
    accent: '#f97316',
    sampleData: { name: '乐乐', sub: '小（1）班' },
    demoDataset: 'kindergarten',
    ...lay(nsDots(dims('a4-65up-round').w, dims('a4-65up-round').h, '#f97316', '小（1）班')),
  }),

  // ---- 圆形 Φ60 / Φ119 ----
  pt('a4-circle-60', false, {
    id: 'ppBakerySeal60',
    name: '圆贴六零·烘焙封口贴',
    category: 'life',
    description: 'Φ60 mm 圆贴，店名环排感、日期，贴面包袋口、果酱瓶与手作包装封口。',
    scenario: 'A4 圆形不干胶专用',
    accent: '#b45309',
    sampleData: { name: '手作烘焙', sub: 'HANDMADE', date: '2026-11-08' },
    demoDataset: 'restaurant',
    ...lay(sealC(dims('a4-circle-60').w, '#b45309', '手作烘焙', 'HANDMADE')),
  }),
  pt('a4-circle-60', false, {
    id: 'ppCandySeal60',
    name: '圆贴六零·喜糖封口贴',
    category: 'wedding',
    description: 'Φ60 mm 圆贴，喜字感中心、日期，贴喜糖盒、伴手礼与请柬封口。',
    scenario: 'A4 圆形不干胶专用',
    accent: '#dc2626',
    sampleData: { name: '囍', sub: 'THANK YOU', date: '2026-11-08' },
    demoDataset: 'wedding',
    ...lay(sealC(dims('a4-circle-60').w, '#dc2626', '囍', 'THANK YOU')),
  }),
  pt('a4-circle-119', false, {
    id: 'ppBrandSeal119',
    name: '大圆贴·品牌封口贴',
    category: 'life',
    description: 'Φ119 mm 大圆贴，品牌名环中、标语、日期，贴礼盒、罐盖与产品外包装。',
    scenario: 'A4 大圆贴不干胶专用',
    accent: '#0f766e',
    sampleData: { name: '云杉手作', sub: 'SINCE 2020', date: '2026-11-08' },
    demoDataset: 'retail',
    ...lay(sealC(dims('a4-circle-119').w, '#0f766e', '云杉手作', 'SINCE 2020')),
  }),
  pt('a4-circle-119', false, {
    id: 'ppDateSeal119',
    name: '大圆贴·生产日期贴',
    category: 'life',
    description: 'Φ119 mm 大圆贴，品名、生产日期大字，贴大罐、桶装与批量包装。',
    scenario: 'A4 大圆贴不干胶专用',
    accent: '#b45309',
    sampleData: { name: '蜂蜜', date: '2026-11-08', note: '常温保存' },
    demoDataset: 'restaurant',
    ...lay(dateTag(dims('a4-circle-119').w, dims('a4-circle-119').h, '#b45309', '生产日期')),
  }),

  // ---- 大格与横竖条 ----
  pt('a4-2up', false, {
    id: 'ppDoorSignA4h',
    name: '半页·教室门牌',
    category: 'teaching',
    description: '210×148.5 mm 半页格，班级大字、班主任、标语，贴教室门与功能室门口。',
    scenario: 'A4 半页不干胶专用',
    accent: '#1d4ed8',
    sampleData: { name: '三（2）班', sub: '班主任：李老师', tag: '入室即静 入座即学' },
    demoDataset: 'classroom',
    ...lay(cardC(dims('a4-2up').w, dims('a4-2up').h, '#1d4ed8', '三（2）班')),
  }),
  pt('a4-4up', false, {
    id: 'ppZoneCard4',
    name: '四格·会场分区牌',
    category: 'event',
    description: '105×148.5 mm 四分之一格，分区名、范围说明，贴会场入口与桌区引导。',
    scenario: 'A4 四格不干胶专用',
    accent: '#7c3aed',
    sampleData: { name: 'A 区', sub: '签到与资料领取' },
    demoDataset: 'meeting',
    ...lay(cardC(dims('a4-4up').w, dims('a4-4up').h, '#7c3aed', 'A 区')),
  }),
  pt('a4-5up', false, {
    id: 'ppSlogan5',
    name: '五格·标语横条',
    category: 'teaching',
    description: '192×54 mm 横条，标语大字、小字落款，贴教室后墙、图书角与走廊展板。',
    scenario: 'A4 横五格不干胶专用',
    accent: '#b45309',
    sampleData: { name: '读书破万卷', sub: '班级共读角' },
    demoDataset: 'classroom',
    ...lay(nsBar(dims('a4-5up').w, dims('a4-5up').h, '#b45309', '班级共读角', '落款', 'sub')),
  }),
  pt('a4-6up', false, {
    id: 'ppShelfCat6',
    name: '六格·货架类目标签',
    category: 'life',
    description: '105×99 mm 六格，类目名、编号区间，贴货架端头与库房分区。',
    scenario: 'A4 六格不干胶专用',
    accent: '#0f766e',
    sampleData: { name: '清洁用品', sub: '货位 A-01 ~ A-12' },
    demoDataset: 'retail',
    ...lay(rowTag(dims('a4-6up').w, dims('a4-6up').h, '#0f766e', '类', '清洁用品', '货位 A-01 ~ A-12', '品类名', '编号区间')),
  }),
  pt('a4-6up-strip', false, {
    id: 'ppShelfStrip6',
    name: '横六格·货架标价条',
    category: 'life',
    description: '210×48 mm 长横条，品名、规格、价格，贴货架层板前沿的统一标价条。',
    scenario: 'A4 横六格不干胶专用',
    accent: '#dc2626',
    sampleData: { item: '手作曲奇', spec: '200g / 盒', price: '19.9', unit: '元 / 盒' },
    demoDataset: 'retail',
    ...lay(priceTag(dims('a4-6up-strip').w, dims('a4-6up-strip').h, '#dc2626')),
  }),
  pt('a4-8up-spine', false, {
    id: 'ppSpine120b',
    name: '竖条·卷宗脊贴',
    category: 'life',
    description: '40×120 mm 竖条格，类目、年度、编号，卷宗、合同盒与资料册的脊背贴。',
    scenario: 'A4 竖条不干胶专用',
    accent: '#7c3aed',
    sampleData: { cat: '合同档案', year: '2026', code: 'HT-018' },
    demoDataset: 'asset',
    ...lay(rowTag(dims('a4-8up-spine').w, dims('a4-8up-spine').h, '#7c3aed', '卷', '合同档案', '2026 · HT-018', '类目', '编号')),
  }),

  // ---- 整版 ----
  pt('a4-1up', false, {
    id: 'ppEventPosterA4',
    name: '整版·活动海报贴',
    category: 'event',
    description: '210×297 mm 整版格，标题、正文、落款，活动预告、招新与社团宣传海报。',
    scenario: 'A4 整版不干胶专用',
    accent: '#7c3aed',
    sampleData: { name: '社团招新季', body: '9 月 1 日起至 9 月 15 日，各社团在活动中心集中招新。', org: '校团委 · 学生会' },
    demoDataset: 'expo',
    ...lay(noticeL(dims('a4-1up').w, dims('a4-1up').h, '#7c3aed')),
  }),
  pt('a3-1up', false, {
    id: 'ppNoticeA3b',
    name: 'A3·公告栏海报',
    category: 'life',
    description: '297×420 mm A3 整版，标题、正文、落款，社区公告栏与厂区通知的大字版。',
    scenario: 'A3 整版不干胶专用',
    accent: '#0f766e',
    sampleData: { name: '停水通知', body: '10 月 12 日 9:00-17:00 本楼暂停供水，请提前储水。', org: '物业服务中心' },
    demoDataset: 'asset',
    ...lay(noticeL(dims('a3-1up').w, dims('a3-1up').h, '#0f766e')),
  }),
  pt('a5-1up', false, {
    id: 'ppNoticeA5b',
    name: 'A5·门贴通知',
    category: 'life',
    description: '148×210 mm A5 整版，标题、正文、落款，贴门店玻璃、电梯与住户门的小告示。',
    scenario: 'A5 整版不干胶专用',
    accent: '#b45309',
    sampleData: { name: '营业时间调整', body: '国庆起营业时间调整为 9:00-21:00，望周知。', org: '店长' },
    demoDataset: 'retail',
    ...lay(noticeL(dims('a5-1up').w, dims('a5-1up').h, '#b45309')),
  }),

  // ---- Avery ----
  pt('avery-5160', false, {
    id: 'ppAddrEn5160',
    name: '5160·英文地址贴',
    category: 'life',
    description: '66.68×25.4 mm 三十格，英文收件人、地址、城市，跨境包裹与英文信件地址贴。',
    scenario: 'Avery 5160 地址贴专用',
    accent: '#44403c',
    sampleData: { name: 'Ming Wang', addr: '100 Century Ave, Pudong', phone: 'Shanghai 200120' },
    demoDataset: 'asset',
    ...lay(addrLines(dims('avery-5160').w, dims('avery-5160').h, '#44403c')),
  }),
  pt('avery-5160', false, {
    id: 'ppReturn5160',
    name: '5160·回邮地址贴',
    category: 'life',
    description: '66.68×25.4 mm 三十格，发件人、地址、电话，电商批量发货的统一回邮贴。',
    scenario: 'Avery 5160 地址贴专用',
    accent: '#0f766e',
    sampleData: { name: '云杉手作 退件部', addr: '上海市浦东新区世纪大道 100 号', phone: '021-0000 0000' },
    demoDataset: 'retail',
    ...lay(addrLines(dims('avery-5160').w, dims('avery-5160').h, '#0f766e')),
  }),
  pt('avery-5163', false, {
    id: 'ppShipping5163',
    name: '5163·运输标签',
    category: 'life',
    description: '101.6×50.8 mm 十格，收件人、地址、电话大字，快递包裹与周转箱的运输贴。',
    scenario: 'Avery 5163 运输标签专用',
    accent: '#dc2626',
    sampleData: { name: '王小明 收', addr: '上海市浦东新区世纪大道 100 号 3 栋 502', phone: '138 0000 0000' },
    demoDataset: 'asset',
    ...lay(addrLines(dims('avery-5163').w, dims('avery-5163').h, '#dc2626')),
  }),
  pt('avery-5164', false, {
    id: 'ppStorage5164',
    name: '5164·储物箱标签',
    category: 'life',
    description: '101.6×84.67 mm 六格，物品名、类别、编号，贴搬家箱、库房周转箱与防潮箱。',
    scenario: 'Avery 5164 储物标签专用',
    accent: '#44403c',
    sampleData: { item: '冬季被褥', sub: '客房备品 · BX-07' },
    demoDataset: 'asset',
    ...lay(rowTag(dims('avery-5164').w, dims('avery-5164').h, '#44403c', '箱', '冬季被褥', '客房备品 · BX-07', '物品名', '类别')),
  }),
  pt('avery-5302', false, {
    id: 'ppTent5302b',
    name: '5302·会议桌牌',
    category: 'event',
    description: '88.9×101.6 mm 对折桌牌，单位、姓名、职务，打印对折即立的会议桌牌。',
    scenario: 'Avery 5302 对折桌牌专用',
    accent: '#1d4ed8',
    sampleData: { name: '王小明', org: '云杉科技', role: '产品总监' },
    demoDataset: 'meeting',
    ...lay(deskCard(dims('avery-5302').w, dims('avery-5302').h, '#1d4ed8')),
  }),
  pt('avery-5302', false, {
    id: 'ppTentWedding5302',
    name: '5302·婚宴席卡',
    category: 'wedding',
    description: '88.9×101.6 mm 对折桌牌，姓名、桌号，婚礼宴席对折立式席位卡。',
    scenario: 'Avery 5302 对折桌牌专用',
    accent: '#be123c',
    sampleData: { name: '王小明', org: '亲友席', role: '第 6 桌' },
    demoDataset: 'wedding',
    ...lay(deskCard(dims('avery-5302').w, dims('avery-5302').h, '#be123c')),
  }),
  pt('avery-5305', false, {
    id: 'ppTent5305b',
    name: '5305·大会桌牌',
    category: 'event',
    description: '215.9×127 mm 大对折桌牌，姓名特大号、单位职务，主席台与嘉宾席桌牌。',
    scenario: 'Avery 5305 大桌牌专用',
    accent: '#b45309',
    sampleData: { name: '王小明', org: '云杉科技', role: '演讲嘉宾' },
    demoDataset: 'meeting',
    ...lay(deskCard(dims('avery-5305').w, dims('avery-5305').h, '#b45309')),
  }),
  pt('avery-5309', false, {
    id: 'ppTent5309b',
    name: '5309·竖折长条桌牌',
    category: 'event',
    description: '177.8×279.4 mm 竖折长条桌牌，姓名、单位纵向版式，发布会与签约仪式桌签。',
    scenario: 'Avery 5309 长条桌牌专用',
    accent: '#7c3aed',
    sampleData: { name: '王小明', org: '云杉科技', role: '签约代表' },
    demoDataset: 'meeting',
    ...lay(deskCard(dims('avery-5309').w, dims('avery-5309').h, '#7c3aed')),
  }),
  pt('avery-5395', false, {
    id: 'ppBadge5395b',
    name: '5395·展会名牌',
    category: 'event',
    description: '85.72×59.27 mm 八格名牌内页，单位、姓名、职务，展会与招聘会胸卡。',
    scenario: 'Avery 5395 名牌内页专用',
    accent: '#0f766e',
    sampleData: { name: '王小明', org: '云杉科技', role: '参会嘉宾' },
    demoDataset: 'meeting',
    ...lay(badgeC(dims('avery-5395').w, dims('avery-5395').h, '#0f766e')),
  }),
  pt('avery-5395', false, {
    id: 'ppBadge5395staff',
    name: '5395·工作胸卡',
    category: 'event',
    description: '85.72×59.27 mm 八格名牌内页，部门、姓名、工号，活动工作人员临时胸卡。',
    scenario: 'Avery 5395 名牌内页专用',
    accent: '#7c3aed',
    sampleData: { name: '王小明', org: '会务组', role: '工号 A-108' },
    demoDataset: 'meeting',
    ...lay(badgeC(dims('avery-5395').w, dims('avery-5395').h, '#7c3aed')),
  }),

  // ================================================================
  // 第三批：高频纸型第三设计（婚宴/零售/教学/食品）
  // ================================================================

  // ---- a4-8up（105×74.25 ×8）第三款：考号色块座贴 ----
  pt('a4-8up', false, {
    id: 'ppExamSeat8b',
    name: '八分·考号色块座贴',
    category: 'exam',
    description: '105×74.25 mm 八分格，考场、科目、座位号与姓名四要素，大字号考号区便于巡视核对。',
    scenario: 'A4 八分格不干胶专用',
    accent: '#b91c1c',
    sampleData: { name: '王小明', item: '2026 期末联考', sub: '第 12 考场 · 座号 08' },
    demoDataset: 'exam',
    ...lay(examTag(dims('a4-8up').w, dims('a4-8up').h, '#b91c1c')),
  }),

  // ---- a4-10up（99.1×57 ×10）第三款：促销价签 ----
  pt('a4-10up', false, {
    id: 'ppPrice10amber',
    name: '十格·促销价签橙版',
    category: 'life',
    description: '105×59.4 mm 十格价签，商品名与规格居左、大号价格居右，促销档橙色系吸引视线。',
    scenario: 'A4 十格价签专用',
    accent: '#ea580c',
    sampleData: { item: '手作曲奇', spec: '200g / 盒', price: '9.9', unit: '元 / 盒' },
    demoDataset: 'retail',
    ...lay(priceTag(dims('a4-10up').w, dims('a4-10up').h, '#ea580c')),
  }),

  // ---- a4-21up（63.5×38.1 ×21）第三款：值日生岗位贴 ----
  pt('a4-21up', false, {
    id: 'ppDutyTag21',
    name: '二一·值日生岗位贴',
    category: 'teaching',
    description: '70×42.4 mm 二十一格，顶部色条配岗位名称与姓名，值日表、课代表、小组长标识用。',
    scenario: 'A4 二十一格不干胶专用',
    accent: '#0d9488',
    sampleData: { name: '王小明', sub: '图书管理员' },
    demoDataset: 'classroom',
    ...lay(nsBar(dims('a4-21up').w, dims('a4-21up').h, '#0d9488', '图书管理员', '岗位', 'sub')),
  }),

  // ---- a4-24up（66×33.9 ×24 圆角）第三款：学号姓名贴 ----
  pt('a4-24up', false, {
    id: 'ppSidName24',
    name: '二四·学号姓名贴',
    category: 'teaching',
    description: '70×37.1 mm 二四格圆角，圆点描边风格，学号与姓名双行排版，课本作业本统一标识。',
    scenario: 'A4 二十四格不干胶专用',
    accent: '#0d9488',
    sampleData: { name: '王小明', sub: '学号 08' },
    demoDataset: 'classroom',
    ...lay(nsDots(dims('a4-24up').w, dims('a4-24up').h, '#0d9488', '学号 08', '王小明')),
  }),

  // ---- a4-circle-60（Φ60 圆 ×? 格）第三款：生产日期贴 ----
  pt('a4-circle-60', false, {
    id: 'ppDateSeal60',
    name: '圆贴六零·生产日期贴',
    category: 'life',
    description: 'Φ60 mm 圆形封口贴，品名环形排布、生产日期居中，糕点酱料罐装出货标记。',
    scenario: 'A4 圆形不干胶专用',
    accent: '#334155',
    sampleData: { name: '手作烘焙', sub: '生产日期', date: '2026-11-08' },
    demoDataset: 'restaurant',
    ...lay(sealC(dims('a4-circle-60').w, '#334155', '生产日期', '2026-11-08')),
  }),

  // ---- avery-5302 第三款：嘉宾席桌牌 ----
  pt('avery-5302', false, {
    id: 'ppTentGuest5302',
    name: '5302·嘉宾席桌牌',
    category: 'event',
    description: '对折三角桌牌，居中大字排布嘉宾与席位信息，论坛发布会的来宾席标识。',
    scenario: 'Avery 5302 对折桌牌专用',
    accent: '#7c3aed',
    sampleData: { name: '王小明', org: '云杉科技', role: '特邀嘉宾' },
    demoDataset: 'meeting',
    ...lay(cardC(dims('avery-5302').w, dims('avery-5302').h, '#7c3aed', '嘉宾')),
  }),

  // ================================================================
  // 第四批：高频纸型第三/四设计（收纳/姓名/厨房/运输/档案）
  // ================================================================

  // ---- a4-12up（105×49.5 ×12）----
  pt('a4-12up', false, {
    id: 'ppStorageTag12',
    name: '十二·储物间分类贴',
    category: 'life',
    description: '105×49.5 mm 十二格，顶部色条配物品名与类别，储物间、地下室与库房的分类标识。',
    scenario: 'A4 十二格不干胶专用',
    accent: '#b45309',
    sampleData: { name: '换季衣物', sub: '储物间 A 区' },
    demoDataset: 'asset',
    ...lay(nsBar(dims('a4-12up').w, dims('a4-12up').h, '#b45309', '储物间 A 区', '类别', 'sub')),
  }),

  // ---- a4-30up（70×29.7 ×30）----
  pt('a4-30up', false, {
    id: 'ppWaterName30',
    name: '三十·防水姓名贴',
    category: 'kids',
    description: '70×29.7 mm 三十格圆点描边姓名贴，水杯餐具与文具的高频防水标识。',
    scenario: 'A4 三十格不干胶专用',
    accent: '#0284c7',
    sampleData: { name: '乐乐', sub: '小（1）班' },
    demoDataset: 'kindergarten',
    ...lay(nsDots(dims('a4-30up').w, dims('a4-30up').h, '#0284c7', '小（1）班', '乐乐')),
  }),

  // ---- a4-6up（105×99 ×6）----
  pt('a4-6up', false, {
    id: 'ppStorageBox6c',
    name: '六格·收纳箱大字贴',
    category: 'life',
    description: '105×99 mm 六格大字收纳箱贴，物品名与存放位置两行，搬家箱与库房箱的箱面标识。',
    scenario: 'A4 六格不干胶专用',
    accent: '#b45309',
    sampleData: { name: '冬季被褥', sub: '储藏室顶层' },
    demoDataset: 'asset',
    ...lay(nsBar(dims('a4-6up').w, dims('a4-6up').h, '#b45309', '储藏室顶层', '类别', 'sub')),
  }),

  // ---- a4-18up-round（63.5×46.6 ×18 圆角）----
  pt('a4-18up-round', false, {
    id: 'ppSpice18c',
    name: '一八·厨房调料贴',
    category: 'life',
    description: '63.5×46.6 mm 圆角十八格，圆点描边配调料名与备注，厨房调味罐的统一标识。',
    scenario: 'A4 圆角十八格不干胶专用',
    accent: '#b45309',
    sampleData: { name: '食盐', sub: '低钠' },
    demoDataset: 'restaurant',
    ...lay(nsDots(dims('a4-18up-round').w, dims('a4-18up-round').h, '#b45309', '低钠', '食盐')),
  }),

  // ---- avery-5163（101.6×50.8 ×10）----
  pt('avery-5163', false, {
    id: 'ppFragile5163',
    name: '5163·易碎运输贴',
    category: 'life',
    description: '101.6×50.8 mm 十格易碎运输贴，顶部警示色条配易碎提示，玻璃陶瓷与精密件的发货标识。',
    scenario: 'Avery 5163 运输标签专用',
    accent: '#dc2626',
    sampleData: { name: '易碎品', sub: '请轻放 · 此面朝上' },
    demoDataset: 'asset',
    ...lay(nsBar(dims('avery-5163').w, dims('avery-5163').h, '#dc2626', '请轻放 · 此面朝上', '类别', 'sub')),
  }),

  // ---- a4-16up（105×37.1 ×16）----
  pt('a4-16up', false, {
    id: 'ppFileTag16',
    name: '十六·文件盒分类贴',
    category: 'life',
    description: '105×37.1 mm 十六格，顶部色条配档案名与类别，文件盒、卷宗盒与票据盒的盒面标识。',
    scenario: 'A4 十六格不干胶专用',
    accent: '#334155',
    sampleData: { name: '2025 年度合同', sub: '财务档案' },
    demoDataset: 'asset',
    ...lay(nsBar(dims('a4-16up').w, dims('a4-16up').h, '#334155', '财务档案', '类别', 'sub')),
  }),

  // ================================================================
  // 第五批：小格纸型第三设计（教学分组/图书/货架/序号/迷你姓名）
  // ================================================================

  // ---- a4-14up（105×42.4 ×14）----
  pt('a4-14up', false, {
    id: 'ppClassTag14',
    name: '十四·小组编号贴',
    category: 'teaching',
    description: '105×42.4 mm 十四格，顶部色条配小组名与科目，课堂分组与小组竞赛的编号标识。',
    scenario: 'A4 十四格不干胶专用',
    accent: '#7c3aed',
    sampleData: { name: '第三小组', sub: '语文阅读' },
    demoDataset: 'classroom',
    ...lay(nsBar(dims('a4-14up').w, dims('a4-14up').h, '#7c3aed', '语文阅读', '类别', 'sub')),
  }),

  // ---- a4-15up（70×50.8 ×15）----
  pt('a4-15up', false, {
    id: 'ppBookTag15',
    name: '十五·图书借阅贴',
    category: 'teaching',
    description: '70×50.8 mm 十五格，顶部色条配姓名与班级，班级图书角借阅登记与归还标识。',
    scenario: 'A4 十五格不干胶专用',
    accent: '#0d9488',
    sampleData: { name: '王小明', sub: '三（2）班' },
    demoDataset: 'classroom',
    ...lay(nsBar(dims('a4-15up').w, dims('a4-15up').h, '#0d9488', '三（2）班', '班级', 'sub')),
  }),

  // ---- a4-20up（97×28 ×20）----
  pt('a4-20up', false, {
    id: 'ppShelfTag20',
    name: '二十·货架层板贴',
    category: 'life',
    description: '97×28 mm 二十格窄条，顶部色条配品类名与分区，便利店与文具店的层板分类标。',
    scenario: 'A4 二十格不干胶专用',
    accent: '#b45309',
    sampleData: { name: '手作曲奇', sub: '烘焙区' },
    demoDataset: 'retail',
    ...lay(nsBar(dims('a4-20up').w, dims('a4-20up').h, '#b45309', '烘焙区', '类别', 'sub')),
  }),

  // ---- a4-27up（70×31.5 ×27）----
  pt('a4-27up', false, {
    id: 'ppColorTag27',
    name: '二七·彩色分组贴',
    category: 'kids',
    description: '70×31.5 mm 二十七格圆点描边分组贴，队名与姓名双行，运动会与夏令营的分组标识。',
    scenario: 'A4 二十七格不干胶专用',
    accent: '#ec4899',
    sampleData: { name: '乐乐', sub: '红队' },
    demoDataset: 'kindergarten',
    ...lay(nsDots(dims('a4-27up').w, dims('a4-27up').h, '#ec4899', '红队', '乐乐')),
  }),

  // ---- a4-33up（70×25.4 ×33）----
  pt('a4-33up', false, {
    id: 'ppSeqTag33',
    name: '三三·序号标记贴',
    category: 'teaching',
    description: '70×25.4 mm 三十三格小贴，顶部色条配序号与学号，试卷分拣与座位编号的密排标。',
    scenario: 'A4 三十三格不干胶专用',
    accent: '#334155',
    sampleData: { name: '08', sub: '学号' },
    demoDataset: 'classroom',
    ...lay(nsBar(dims('a4-33up').w, dims('a4-33up').h, '#334155', '学号', '类别', 'sub')),
  }),

  // ---- a4-40up-round（45.7×25.4 ×40 圆角）----
  pt('a4-40up-round', false, {
    id: 'ppMiniName40',
    name: '四十·迷你姓名贴',
    category: 'kids',
    description: '45.7×25.4 mm 圆角四十格迷你姓名贴，圆点描边配姓名班级，铅笔橡皮的小面积标识。',
    scenario: 'A4 圆角四十格不干胶专用',
    accent: '#0284c7',
    sampleData: { name: '乐乐', sub: '小（1）班' },
    demoDataset: 'kindergarten',
    ...lay(nsDots(dims('a4-40up-round').w, dims('a4-40up-round').h, '#0284c7', '小（1）班', '乐乐')),
  }),
]
