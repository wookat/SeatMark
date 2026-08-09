import type { LabelTemplate } from '@/types/template'

import { DEFAULT_FONT_STACK, DEFAULT_FONT_STACK_EN } from './fonts'
import { fixed, gridPage, INK_MUTED, INK_SOFT, text } from './templateFactory'

/**
 * 模板库扩充 · 质感篇（会议桌牌 / 席卡 / 婚礼 / 年会）。
 * 每款均带 decorSvg 背景装饰层：SVG 内联渐变、几何底纹、线条花边与角饰，
 * 不引用任何外部图片资源，保持离线可用；配色兼顾黑白打印的灰度层次。
 * decorSvg 的 viewBox 用户单位 = mm，与标签物理尺寸一致。
 */

const FONT = DEFAULT_FONT_STACK
const FONT_EN = DEFAULT_FONT_STACK_EN
const SERIF_ZH = "'Songti SC', 'SimSun', 'STSong', serif"

const base = {
  builtin: true as const,
  fontFamily: FONT,
  fontFamilyEn: FONT_EN,
  showLabelBorder: false,
}

/** 装饰模板默认不描边（由 decorSvg 自带边框语言），圆角可选 */
const decorLabel = (width: number, height: number, decorSvg: string, radius = 0) => ({
  width,
  height,
  radius,
  borderWidth: 0,
  background: '#ffffff',
  decorSvg,
})

const svg = (w: number, h: number, body: string) =>
  `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${body}</svg>`

export const deluxeTemplates: LabelTemplate[] = [
  // ================= 会议桌牌 =================
  {
    ...base,
    id: 'deluxeConfAurora',
    name: '会议桌牌·极光渐变',
    category: 'event',
    description: '180×90 mm 平放桌牌，靛紫极光渐变色带上下呼应，名字居中大字，现代科技感会议首选。',
    scenario: '峰会 / 发布会桌牌',
    accent: '#6366f1',
    sampleData: { name: '欧阳晨曦', org: '星汉智能科技（深圳）有限公司', title: '首席技术官' },
    label: decorLabel(
      180,
      90,
      svg(
        180,
        90,
        '<defs><linearGradient id="dxaur-a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4f46e5"/><stop offset="0.55" stop-color="#7c3aed"/><stop offset="1" stop-color="#2563eb"/></linearGradient><linearGradient id="dxaur-b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c7d2fe"/><stop offset="1" stop-color="#ddd6fe"/></linearGradient></defs>' +
          '<rect x="0" y="0" width="180" height="8" fill="url(#dxaur-a)"/>' +
          '<path d="M0 8 L180 8 L180 11 Q90 16 0 11 Z" fill="url(#dxaur-b)" opacity="0.6"/>' +
          '<rect x="0" y="84" width="180" height="6" fill="url(#dxaur-a)"/>' +
          '<path d="M0 84 Q90 78 180 84 L180 84 L0 84 Z" fill="url(#dxaur-b)" opacity="0.6"/>',
      ),
    ),
    page: gridPage('A4', 1, 3, 180, 90, 0, 5),
    fields: [
      text('org', '单位', { x: 15, y: 16, width: 150, height: 9 }, '星汉智能科技（深圳）有限公司', {
        fontSize: 10,
        color: INK_MUTED,
        letterSpacing: 0.08,
      }),
      text('name', '姓名', { x: 15, y: 30, width: 150, height: 34 }, '欧阳晨曦', {
        fontSize: 44,
        fontWeight: 'bold',
        emphasis: 'hero',
        letterSpacing: 0.18,
      }),
      text('title', '职务', { x: 15, y: 68, width: 150, height: 10 }, '首席技术官', {
        fontSize: 12,
        color: INK_SOFT,
        letterSpacing: 0.3,
      }),
    ],
  },
  {
    ...base,
    id: 'deluxeConfLines',
    name: '会议桌牌·建筑线条',
    category: 'event',
    description: '180×90 mm 桌牌，四角建筑感细线角饰 + 顶部双细线，克制的黑白灰设计，黑白打印同样干净。',
    scenario: '董事会 / 商务会议',
    accent: '#0f172a',
    sampleData: { name: '司徒文渊', org: '华建集团战略发展部', title: '总经理' },
    label: decorLabel(
      180,
      90,
      svg(
        180,
        90,
        '<g stroke="#0f172a" stroke-width="0.5" fill="none">' +
          '<path d="M8 16 L8 8 L16 8"/><path d="M172 16 L172 8 L164 8"/>' +
          '<path d="M8 74 L8 82 L16 82"/><path d="M172 74 L172 82 L164 82"/>' +
          '</g>' +
          '<g stroke="#94a3b8" stroke-width="0.25" fill="none">' +
          '<path d="M11 19 L11 11 L19 11"/><path d="M169 19 L169 11 L161 11"/>' +
          '<path d="M11 71 L11 79 L19 79"/><path d="M169 71 L169 79 L161 79"/>' +
          '<line x1="60" y1="24" x2="120" y2="24"/><line x1="70" y1="26.5" x2="110" y2="26.5"/>' +
          '</g>',
      ),
    ),
    page: gridPage('A4', 1, 3, 180, 90, 0, 5),
    fields: [
      text('org', '单位', { x: 20, y: 13, width: 140, height: 8 }, '华建集团战略发展部', {
        fontSize: 9.5,
        color: INK_MUTED,
        letterSpacing: 0.2,
      }),
      text('name', '姓名', { x: 20, y: 31, width: 140, height: 32 }, '司徒文渊', {
        fontSize: 42,
        fontWeight: 'bold',
        emphasis: 'hero',
        letterSpacing: 0.22,
        fontFamily: SERIF_ZH,
      }),
      text('title', '职务', { x: 20, y: 67, width: 140, height: 9 }, '总经理', {
        fontSize: 11.5,
        color: INK_SOFT,
        letterSpacing: 0.5,
      }),
    ],
  },
  {
    ...base,
    id: 'deluxeConfGeo',
    name: '会议桌牌·几何底纹',
    category: 'event',
    description: '180×90 mm 桌牌，左右两侧低饱和三角几何底纹渐隐，信息区留白充足，适合科技论坛与行业峰会。',
    scenario: '科技论坛 / 行业峰会',
    accent: '#0e7490',
    sampleData: { name: '慕容雪松', org: '青云数据研究院', title: '院长 · 特邀报告人' },
    label: decorLabel(
      180,
      90,
      svg(
        180,
        90,
        '<defs><linearGradient id="dxgeo-f" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0e7490" stop-opacity="0.16"/><stop offset="1" stop-color="#0e7490" stop-opacity="0"/></linearGradient><linearGradient id="dxgeo-g" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#0e7490" stop-opacity="0.16"/><stop offset="1" stop-color="#0e7490" stop-opacity="0"/></linearGradient></defs>' +
          '<g fill="url(#dxgeo-f)"><path d="M0 0 L34 0 L0 34 Z"/><path d="M0 26 L26 52 L0 78 Z" opacity="0.7"/><path d="M0 90 L30 90 L0 60 Z"/></g>' +
          '<g fill="url(#dxgeo-g)"><path d="M180 0 L146 0 L180 34 Z"/><path d="M180 26 L154 52 L180 78 Z" opacity="0.7"/><path d="M180 90 L150 90 L180 60 Z"/></g>' +
          '<rect x="0" y="86.5" width="180" height="3.5" fill="#0e7490"/>',
      ),
    ),
    page: gridPage('A4', 1, 3, 180, 90, 0, 5),
    fields: [
      text('org', '单位', { x: 30, y: 14, width: 120, height: 8.5 }, '青云数据研究院', {
        fontSize: 10,
        color: INK_MUTED,
        letterSpacing: 0.14,
      }),
      text('name', '姓名', { x: 30, y: 29, width: 120, height: 33 }, '慕容雪松', {
        fontSize: 43,
        fontWeight: 'bold',
        emphasis: 'hero',
        letterSpacing: 0.18,
        color: '#134e4a',
      }),
      text('title', '职务', { x: 30, y: 66, width: 120, height: 9.5 }, '院长 · 特邀报告人', {
        fontSize: 11.5,
        color: INK_SOFT,
        letterSpacing: 0.24,
      }),
    ],
  },
  {
    ...base,
    id: 'deluxeConfGold',
    name: '会议桌牌·鎏金雅框',
    category: 'event',
    description: '180×90 mm 桌牌，内外双线鎏金边框 + 菱形角饰，庄重典雅，政企年度会议与颁奖典礼皆宜。',
    scenario: '年度大会 / 颁奖典礼',
    accent: '#a16207',
    sampleData: { name: '上官澜庭', org: '金桥控股集团有限公司', title: '董事长' },
    label: decorLabel(
      180,
      90,
      svg(
        180,
        90,
        '<defs><linearGradient id="dxgold-l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a16207"/><stop offset="0.5" stop-color="#d4a017"/><stop offset="1" stop-color="#a16207"/></linearGradient></defs>' +
          '<rect x="3" y="3" width="174" height="84" fill="none" stroke="url(#dxgold-l)" stroke-width="0.9"/>' +
          '<rect x="6" y="6" width="168" height="78" fill="none" stroke="url(#dxgold-l)" stroke-width="0.3"/>' +
          '<g fill="url(#dxgold-l)"><path d="M90 3 L93 6 L90 9 L87 6 Z" transform="translate(0,3)"/><path d="M90 78 L93 81 L90 84 L87 81 Z"/></g>' +
          '<g stroke="url(#dxgold-l)" stroke-width="0.4" fill="none"><line x1="55" y1="9" x2="84" y2="9" transform="translate(0,-2.9)"/><line x1="96" y1="6.1" x2="125" y2="6.1"/><line x1="55" y1="83.9" x2="84" y2="83.9"/><line x1="96" y1="83.9" x2="125" y2="83.9"/></g>',
      ),
    ),
    page: gridPage('A4', 1, 3, 180, 90, 0, 5),
    fields: [
      text('org', '单位', { x: 25, y: 14, width: 130, height: 8.5 }, '金桥控股集团有限公司', {
        fontSize: 10,
        color: '#78550f',
        letterSpacing: 0.16,
        fontFamily: SERIF_ZH,
      }),
      text('name', '姓名', { x: 25, y: 29, width: 130, height: 33 }, '上官澜庭', {
        fontSize: 43,
        fontWeight: 'bold',
        emphasis: 'hero',
        letterSpacing: 0.24,
        fontFamily: SERIF_ZH,
        color: '#1c1917',
      }),
      text('title', '职务', { x: 25, y: 66, width: 130, height: 9 }, '董事长', {
        fontSize: 11.5,
        color: '#a16207',
        letterSpacing: 0.6,
        fontFamily: SERIF_ZH,
      }),
    ],
  },
  {
    ...base,
    id: 'deluxeForumWave',
    name: '论坛席卡·青屿波纹',
    category: 'event',
    description: '100×65 mm 席卡 A4 一页 8 枚，底部三层青色波纹渐变叠浪，清爽学术气质，论坛研讨会席位标识。',
    scenario: '学术论坛 / 圆桌研讨',
    accent: '#0891b2',
    sampleData: { name: '闻人静姝', org: '东湖大学经济学院' },
    label: decorLabel(
      96,
      62,
      svg(
        100,
        65,
        '<defs><linearGradient id="dxwav-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22d3ee" stop-opacity="0.5"/><stop offset="1" stop-color="#0891b2" stop-opacity="0.8"/></linearGradient></defs>' +
          '<path d="M0 50 Q25 44 50 50 T100 50 L100 65 L0 65 Z" fill="#a5f3fc" opacity="0.55"/>' +
          '<path d="M0 54 Q25 48 50 54 T100 54 L100 65 L0 65 Z" fill="url(#dxwav-a)" opacity="0.7"/>' +
          '<path d="M0 58 Q25 53 50 58 T100 58 L100 65 L0 65 Z" fill="#0e7490"/>' +
          '<line x1="30" y1="14.5" x2="70" y2="14.5" stroke="#67e8f9" stroke-width="0.4"/>',
      ),
    ),
    page: gridPage('A4', 2, 4, 96, 62, 4, 5),
    fields: [
      text('name', '姓名', { x: 8, y: 17, width: 84, height: 22 }, '闻人静姝', {
        fontSize: 27,
        fontWeight: 'bold',
        emphasis: 'hero',
        letterSpacing: 0.14,
        color: '#155e75',
      }),
      text('org', '单位', { x: 8, y: 40, width: 84, height: 7.5 }, '东湖大学经济学院', {
        fontSize: 9,
        color: INK_MUTED,
        letterSpacing: 0.1,
      }),
      fixed('cap', '席卡小注', { x: 8, y: 8, width: 84, height: 5.5 }, 'FORUM GUEST', {
        fontSize: 6,
        color: '#0891b2',
        letterSpacing: 0.7,
      }),
    ],
  },
  {
    ...base,
    id: 'deluxeVipMarble',
    name: '贵宾席卡·云石纹理',
    category: 'event',
    description: '100×65 mm 贵宾席卡，浅灰云石脉络纹理铺底 + 炭金双线框，低调高级，酒会晚宴贵宾席位。',
    scenario: '贵宾席 / 晚宴酒会',
    accent: '#57534e',
    sampleData: { name: '皇甫云舒', title: '特邀贵宾' },
    label: decorLabel(
      96,
      62,
      svg(
        100,
        65,
        '<g stroke="#d6d3d1" stroke-width="0.35" fill="none" opacity="0.9">' +
          '<path d="M-5 12 Q20 6 38 16 T80 14 T108 20"/><path d="M-5 30 Q30 22 55 32 T105 28"/>' +
          '<path d="M-5 48 Q25 42 50 50 T105 46"/><path d="M12 -4 Q18 20 10 40 T16 70"/>' +
          '<path d="M78 -4 Q72 18 82 38 T74 70"/>' +
          '</g>' +
          '<rect x="4" y="4" width="92" height="57" fill="none" stroke="#44403c" stroke-width="0.5"/>' +
          '<rect x="6" y="6" width="88" height="53" fill="none" stroke="#b8a26a" stroke-width="0.3"/>',
      ),
    ),
    page: gridPage('A4', 2, 4, 96, 62, 4, 5),
    fields: [
      fixed('cap', '席别', { x: 12, y: 10, width: 76, height: 6 }, 'VIP GUEST · 贵宾席', {
        fontSize: 6.5,
        color: '#a16207',
        letterSpacing: 0.6,
      }),
      text('name', '姓名', { x: 12, y: 20, width: 76, height: 22 }, '皇甫云舒', {
        fontSize: 26,
        fontWeight: 'bold',
        emphasis: 'hero',
        letterSpacing: 0.2,
        fontFamily: SERIF_ZH,
        color: '#292524',
      }),
      text('title', '身份', { x: 12, y: 45, width: 76, height: 7.5 }, '特邀贵宾', {
        fontSize: 9.5,
        color: '#57534e',
        letterSpacing: 0.4,
        fontFamily: SERIF_ZH,
      }),
    ],
  },
  // ================= 年会 =================
  {
    ...base,
    id: 'deluxeAnnualStar',
    name: '年会桌牌·星辉鎏金',
    category: 'event',
    description: '180×90 mm 年会桌牌，四角金色星芒放射线与散点星光，白底金饰黑白打印不发闷，年会颁奖两相宜。',
    scenario: '公司年会 / 表彰晚会',
    accent: '#b45309',
    sampleData: { name: '夏侯明玥', org: '晨风网络 2026 年度盛典', title: '年度优秀员工' },
    label: decorLabel(
      180,
      90,
      svg(
        180,
        90,
        '<defs><linearGradient id="dxstar-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d4a017"/><stop offset="1" stop-color="#b45309"/></linearGradient></defs>' +
          '<g stroke="url(#dxstar-g)" stroke-width="0.45" fill="none">' +
          '<path d="M4 22 L4 4 L26 4"/><path d="M176 22 L176 4 L154 4"/><path d="M4 68 L4 86 L26 86"/><path d="M176 68 L176 86 L154 86"/>' +
          '<path d="M10 16 L20 6 M8 24 L22 10 M16 8 L24 16" opacity="0.7"/><path d="M170 16 L160 6 M172 24 L158 10 M164 8 L156 16" opacity="0.7"/>' +
          '</g>' +
          '<g fill="url(#dxstar-g)">' +
          '<path d="M36 12 l1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1 Z"/>' +
          '<path d="M144 74 l1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1 Z"/>' +
          '<circle cx="150" cy="14" r="0.9"/><circle cx="158" cy="20" r="0.6"/><circle cx="30" cy="76" r="0.9"/><circle cx="24" cy="70" r="0.6"/>' +
          '</g>',
      ),
    ),
    page: gridPage('A4', 1, 3, 180, 90, 0, 5),
    fields: [
      text('org', '活动名称', { x: 30, y: 13, width: 120, height: 8.5 }, '晨风网络 2026 年度盛典', {
        fontSize: 10,
        color: '#92400e',
        letterSpacing: 0.16,
      }),
      text('name', '姓名', { x: 30, y: 29, width: 120, height: 33 }, '夏侯明玥', {
        fontSize: 43,
        fontWeight: 'bold',
        emphasis: 'hero',
        letterSpacing: 0.2,
        color: '#1c1917',
      }),
      text('title', '荣誉 / 职务', { x: 30, y: 66, width: 120, height: 9.5 }, '年度优秀员工', {
        fontSize: 11.5,
        color: '#b45309',
        letterSpacing: 0.4,
      }),
    ],
  },
  {
    ...base,
    id: 'deluxeAnnualRibbon',
    name: '年会席卡·红绶飘带',
    category: 'event',
    description: '100×65 mm 年会席卡，左上角中国红绶带斜披 + 底部红金渐变线，喜庆而不俗，年会答谢宴通用。',
    scenario: '年会晚宴 / 答谢会',
    accent: '#b91c1c',
    sampleData: { name: '独孤若飞', org: '销售一部' },
    label: decorLabel(
      96,
      62,
      svg(
        100,
        65,
        '<defs><linearGradient id="dxrib-r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dc2626"/><stop offset="1" stop-color="#991b1b"/></linearGradient><linearGradient id="dxrib-b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b91c1c"/><stop offset="0.5" stop-color="#d4a017"/><stop offset="1" stop-color="#b91c1c"/></linearGradient></defs>' +
          '<path d="M0 10 L14 0 L22 0 L0 16 Z" fill="url(#dxrib-r)"/>' +
          '<path d="M0 19 L26 0 L30 0 L0 22 Z" fill="#d4a017" opacity="0.75"/>' +
          '<path d="M100 55 L86 65 L78 65 L100 49 Z" fill="url(#dxrib-r)" opacity="0.85"/>' +
          '<rect x="0" y="62.6" width="100" height="2.4" fill="url(#dxrib-b)"/>',
      ),
    ),
    page: gridPage('A4', 2, 4, 96, 62, 4, 5),
    fields: [
      fixed('cap', '席卡小注', { x: 14, y: 8, width: 72, height: 5.5 }, '欢聚一堂 · 共启新程', {
        fontSize: 6.5,
        color: '#b91c1c',
        letterSpacing: 0.5,
      }),
      text('name', '姓名', { x: 10, y: 18, width: 80, height: 23 }, '独孤若飞', {
        fontSize: 27,
        fontWeight: 'bold',
        emphasis: 'hero',
        letterSpacing: 0.16,
        color: '#7f1d1d',
      }),
      text('org', '部门', { x: 10, y: 43, width: 80, height: 7.5 }, '销售一部', {
        fontSize: 9.5,
        color: INK_MUTED,
        letterSpacing: 0.2,
      }),
    ],
  },
  // ================= 婚礼 =================
  {
    ...base,
    id: 'deluxeWedBotanic',
    name: '婚礼席位卡·青枝花语',
    category: 'wedding',
    description: '90×55 mm 席位卡 A4 一页 10 枚，对角橄榄绿枝叶花边手绘质感，森系户外婚礼与草坪宴首选。',
    scenario: '森系婚礼 / 草坪宴',
    accent: '#4d7c0f',
    sampleData: { name: '苏浅语', table: '第 3 桌' },
    label: decorLabel(
      90,
      55,
      svg(
        90,
        55,
        '<g stroke="#65a30d" stroke-width="0.4" fill="none">' +
          '<path d="M2 14 Q10 4 24 3"/><path d="M88 41 Q80 51 66 52"/>' +
          '</g>' +
          '<g fill="#84cc16" opacity="0.75">' +
          '<ellipse cx="7" cy="9.5" rx="3" ry="1.3" transform="rotate(-42 7 9.5)"/><ellipse cx="13" cy="5.8" rx="2.7" ry="1.2" transform="rotate(-24 13 5.8)"/><ellipse cx="20" cy="3.8" rx="2.5" ry="1.1" transform="rotate(-10 20 3.8)"/>' +
          '<ellipse cx="83" cy="45.5" rx="3" ry="1.3" transform="rotate(-42 83 45.5)"/><ellipse cx="77" cy="49.2" rx="2.7" ry="1.2" transform="rotate(-24 77 49.2)"/><ellipse cx="70" cy="51.2" rx="2.5" ry="1.1" transform="rotate(-10 70 51.2)"/>' +
          '</g>' +
          '<g fill="#4d7c0f" opacity="0.8"><circle cx="26" cy="6" r="0.8"/><circle cx="29" cy="4" r="0.55"/><circle cx="64" cy="49" r="0.8"/><circle cx="61" cy="51" r="0.55"/></g>',
      ),
    ),
    page: gridPage('A4', 2, 5, 90, 55, 6, 2.5),
    fields: [
      text('name', '宾客姓名', { x: 8, y: 16, width: 74, height: 20 }, '苏浅语', {
        fontSize: 24,
        fontWeight: 'bold',
        emphasis: 'hero',
        letterSpacing: 0.16,
        fontFamily: SERIF_ZH,
        color: '#365314',
      }),
      text('table', '桌号', { x: 8, y: 38, width: 74, height: 7 }, '第 3 桌', {
        fontSize: 9.5,
        color: '#4d7c0f',
        letterSpacing: 0.3,
      }),
      fixed('cap', '席位小注', { x: 8, y: 9, width: 74, height: 4.8 }, 'WITH LOVE', {
        fontSize: 5.5,
        color: '#a3b18a',
        letterSpacing: 0.8,
      }),
    ],
  },
  {
    ...base,
    id: 'deluxeWedArch',
    name: '婚礼席位卡·拱门月色',
    category: 'wedding',
    description: '90×55 mm 席位卡，杏金拱门线条 + 弦月弧与星点，极简法式浪漫，室内仪式感婚宴适用。',
    scenario: '法式婚礼 / 室内婚宴',
    accent: '#b8860b',
    sampleData: { name: '沈知微', table: 'Table 6' },
    label: decorLabel(
      90,
      55,
      svg(
        90,
        55,
        '<g stroke="#c8a24b" stroke-width="0.45" fill="none">' +
          '<path d="M20 55 L20 26 Q20 8 45 8 Q70 8 70 26 L70 55" opacity="0.9"/>' +
          '<path d="M24 55 L24 27 Q24 11.5 45 11.5 Q66 11.5 66 27 L66 55" stroke-width="0.25" opacity="0.8"/>' +
          '</g>' +
          '<path d="M45 3.2 A2.4 2.4 0 1 0 46.8 6.9 A3.1 3.1 0 1 1 45 3.2 Z" fill="#c8a24b" opacity="0.9"/>' +
          '<g fill="#c8a24b" opacity="0.7"><circle cx="34" cy="5" r="0.5"/><circle cx="56" cy="5" r="0.5"/><circle cx="12" cy="16" r="0.6"/><circle cx="78" cy="16" r="0.6"/></g>',
      ),
    ),
    page: gridPage('A4', 2, 5, 90, 55, 6, 2.5),
    fields: [
      text('name', '宾客姓名', { x: 22, y: 20, width: 46, height: 18 }, '沈知微', {
        fontSize: 21,
        fontWeight: 'bold',
        emphasis: 'hero',
        letterSpacing: 0.14,
        fontFamily: SERIF_ZH,
        color: '#57534e',
      }),
      text('table', '桌号', { x: 22, y: 40, width: 46, height: 6.5 }, 'Table 6', {
        fontSize: 8.5,
        color: '#b8860b',
        letterSpacing: 0.4,
      }),
    ],
  },
  {
    ...base,
    id: 'deluxeWedRing',
    name: '婚礼桌号牌·同心双环',
    category: 'wedding',
    description: '100×100 mm 方形桌号牌 A4 一页 4 枚，金色交叠双环象征缔结，桌号特大字居中，摆台即有仪式感。',
    scenario: '婚宴桌号 / 台位牌',
    accent: '#a16207',
    sampleData: { table: '8', note: '亲友席' },
    label: decorLabel(
      96,
      96,
      svg(
        100,
        100,
        '<defs><linearGradient id="dxring-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d4a017"/><stop offset="1" stop-color="#92400e"/></linearGradient></defs>' +
          '<g stroke="url(#dxring-g)" fill="none">' +
          '<circle cx="44" cy="22" r="10" stroke-width="0.7"/><circle cx="56" cy="22" r="10" stroke-width="0.7"/>' +
          '</g>' +
          '<rect x="5" y="5" width="90" height="90" rx="3" fill="none" stroke="#d6c08a" stroke-width="0.4"/>' +
          '<g stroke="#c8a24b" stroke-width="0.35" fill="none"><line x1="26" y1="86" x2="74" y2="86"/><path d="M47 86 l3 -2.4 3 2.4 -3 2.4 Z" fill="#c8a24b"/></g>',
      ),
    ),
    page: gridPage('A4', 2, 2, 96, 96, 6, 6),
    fields: [
      text('table', '桌号', { x: 15, y: 34, width: 70, height: 40 }, '8', {
        fontSize: 88,
        fontWeight: 'bold',
        emphasis: 'hero',
        lineHeight: 1,
        padding: 0,
        color: '#78350f',
        fontFamily: SERIF_ZH,
      }),
      text('note', '席区说明', { x: 15, y: 76, width: 70, height: 7.5 }, '亲友席', {
        fontSize: 10,
        color: INK_SOFT,
        letterSpacing: 0.5,
        fontFamily: SERIF_ZH,
      }),
    ],
  },
  {
    ...base,
    id: 'deluxeWedBlush',
    name: '婚礼席位卡·绯雾晕染',
    category: 'wedding',
    description: '90×55 mm 席位卡，四角绯粉水彩晕染渐隐 + 细金内框，柔和甜美，酒店婚宴席位卡百搭款。',
    scenario: '酒店婚宴 / 订婚宴',
    accent: '#be185d',
    sampleData: { name: '林晚晴', table: '第 12 桌' },
    label: decorLabel(
      90,
      55,
      svg(
        90,
        55,
        '<defs><radialGradient id="dxblush-a" cx="0" cy="0" r="1"><stop offset="0" stop-color="#f9a8d4" stop-opacity="0.65"/><stop offset="1" stop-color="#f9a8d4" stop-opacity="0"/></radialGradient><radialGradient id="dxblush-b" cx="1" cy="1" r="1"><stop offset="0" stop-color="#fbcfe8" stop-opacity="0.8"/><stop offset="1" stop-color="#fbcfe8" stop-opacity="0"/></radialGradient></defs>' +
          '<rect x="0" y="0" width="46" height="30" fill="url(#dxblush-a)"/>' +
          '<rect x="44" y="25" width="46" height="30" fill="url(#dxblush-b)"/>' +
          '<rect x="4" y="4" width="82" height="47" fill="none" stroke="#d4a017" stroke-width="0.3"/>',
      ),
    ),
    page: gridPage('A4', 2, 5, 90, 55, 6, 2.5),
    fields: [
      text('name', '宾客姓名', { x: 9, y: 15, width: 72, height: 20 }, '林晚晴', {
        fontSize: 24,
        fontWeight: 'bold',
        emphasis: 'hero',
        letterSpacing: 0.16,
        fontFamily: SERIF_ZH,
        color: '#831843',
      }),
      text('table', '桌号', { x: 9, y: 38, width: 72, height: 7 }, '第 12 桌', {
        fontSize: 9.5,
        color: '#be185d',
        letterSpacing: 0.3,
      }),
      fixed('cap', '席位小注', { x: 9, y: 8.5, width: 72, height: 4.8 }, '喜结良缘 · 敬备喜筵', {
        fontSize: 5.8,
        color: '#d48aa8',
        letterSpacing: 0.5,
      }),
    ],
  },
  {
    ...base,
    id: 'deluxeWedLace',
    name: '婚礼迎宾牌·蕾丝纹章',
    category: 'wedding',
    description: 'A4 竖向整页迎宾牌，顶部蕾丝扇形花边 + 中央纹章框，新人姓名与婚期居中，摆放于迎宾区易拉架。',
    scenario: '迎宾区 / 签到台',
    accent: '#9d174d',
    sampleData: { couple: '陈屿 ♥ 顾念', date: '2026 年 10 月 1 日', venue: '碧湖万豪酒店 · 三层宴会厅' },
    label: decorLabel(
      190,
      277,
      svg(
        190,
        277,
        '<g stroke="#c8a24b" stroke-width="0.4" fill="none">' +
          '<path d="M0 18 Q10 18 10 8 M190 18 Q180 18 180 8"/>' +
          '<path d="M20 6 A8 8 0 0 1 36 6 A8 8 0 0 1 52 6 A8 8 0 0 1 68 6 A8 8 0 0 1 84 6 A8 8 0 0 1 100 6 A8 8 0 0 1 116 6 A8 8 0 0 1 132 6 A8 8 0 0 1 148 6 A8 8 0 0 1 164 6" opacity="0.85"/>' +
          '<path d="M0 259 Q10 259 10 269 M190 259 Q180 259 180 269"/>' +
          '</g>' +
          '<g fill="#c8a24b" opacity="0.8"><circle cx="28" cy="10" r="0.7"/><circle cx="60" cy="10" r="0.7"/><circle cx="92" cy="10" r="0.7"/><circle cx="124" cy="10" r="0.7"/><circle cx="156" cy="10" r="0.7"/></g>' +
          '<ellipse cx="95" cy="128" rx="62" ry="88" fill="none" stroke="#d6c08a" stroke-width="0.5"/>' +
          '<ellipse cx="95" cy="128" rx="58" ry="84" fill="none" stroke="#e7d9b0" stroke-width="0.3"/>',
      ),
    ),
    page: gridPage('A4', 1, 1, 190, 277, 0, 0),
    fields: [
      fixed('cap', '标语', { x: 30, y: 62, width: 130, height: 9 }, 'WELCOME TO OUR WEDDING', {
        fontSize: 9,
        color: '#b8860b',
        letterSpacing: 0.7,
      }),
      text('couple', '新人姓名', { x: 30, y: 100, width: 130, height: 46 }, '陈屿 ♥ 顾念', {
        fontSize: 40,
        fontWeight: 'bold',
        emphasis: 'hero',
        letterSpacing: 0.14,
        fontFamily: SERIF_ZH,
        color: '#7f1d1d',
        maxLines: 2,
      }),
      text('date', '婚期', { x: 30, y: 156, width: 130, height: 11 }, '2026 年 10 月 1 日', {
        fontSize: 13,
        color: '#9d174d',
        letterSpacing: 0.3,
        fontFamily: SERIF_ZH,
      }),
      text('venue', '地点', { x: 30, y: 172, width: 130, height: 10 }, '碧湖万豪酒店 · 三层宴会厅', {
        fontSize: 10.5,
        color: INK_MUTED,
        letterSpacing: 0.16,
      }),
    ],
  },
  {
    ...base,
    id: 'deluxeWedGoldDot',
    name: '婚礼席位卡·金雨流苏',
    category: 'wedding',
    description: '90×55 mm 席位卡，顶部金色雨点渐次垂落如流苏，简洁不抢戏，与香槟色系婚礼布置天然相配。',
    scenario: '香槟色系婚宴',
    accent: '#b45309',
    sampleData: { name: '温以宁', table: 'F 区 · 第 5 桌' },
    label: decorLabel(
      90,
      55,
      svg(
        90,
        55,
        '<defs><linearGradient id="dxdot-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4a017"/><stop offset="1" stop-color="#d4a017" stop-opacity="0"/></linearGradient></defs>' +
          '<g fill="#d4a017"><circle cx="8" cy="4" r="1"/><circle cx="18" cy="7" r="0.7"/><circle cx="28" cy="3.5" r="0.85"/><circle cx="38" cy="6.5" r="0.6"/><circle cx="48" cy="3" r="1"/><circle cx="58" cy="6" r="0.7"/><circle cx="68" cy="3.5" r="0.85"/><circle cx="78" cy="6.5" r="0.6"/><circle cx="86" cy="4" r="0.8"/></g>' +
          '<g stroke="url(#dxdot-g)" stroke-width="0.35"><line x1="8" y1="5" x2="8" y2="13"/><line x1="28" y1="4.5" x2="28" y2="10"/><line x1="48" y1="4" x2="48" y2="14"/><line x1="68" y1="4.5" x2="68" y2="10"/><line x1="86" y1="5" x2="86" y2="12"/></g>' +
          '<line x1="30" y1="46" x2="60" y2="46" stroke="#d4a017" stroke-width="0.35"/>',
      ),
    ),
    page: gridPage('A4', 2, 5, 90, 55, 6, 2.5),
    fields: [
      text('name', '宾客姓名', { x: 9, y: 18, width: 72, height: 20 }, '温以宁', {
        fontSize: 24,
        fontWeight: 'bold',
        emphasis: 'hero',
        letterSpacing: 0.16,
        fontFamily: SERIF_ZH,
        color: '#713f12',
      }),
      text('table', '桌号', { x: 9, y: 47.5, width: 72, height: 6 }, 'F 区 · 第 5 桌', {
        fontSize: 8.5,
        color: '#b45309',
        letterSpacing: 0.3,
      }),
    ],
  },
  {
    ...base,
    id: 'deluxeAnnivDeco',
    name: '周年庆桌牌·装饰艺术',
    category: 'wedding',
    description: '180×90 mm 桌牌，Art Deco 扇形放射与阶梯角饰，摩登复古，金婚银婚纪念宴与主题派对出彩之选。',
    scenario: '结婚纪念 / 主题派对',
    accent: '#155e75',
    sampleData: { name: '赵与澜 · 秦书悦', note: '结婚三十周年纪念' },
    label: decorLabel(
      180,
      90,
      svg(
        180,
        90,
        '<defs><linearGradient id="dxdeco-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e7490"/><stop offset="1" stop-color="#155e75"/></linearGradient></defs>' +
          '<g stroke="url(#dxdeco-g)" stroke-width="0.5" fill="none">' +
          '<path d="M90 0 L90 6 M78 0 L80 6 M102 0 L100 6 M66 0 L70 6 M114 0 L110 6 M54 0 L60 6.5 M126 0 L120 6.5"/>' +
          '<path d="M62 8.5 Q90 13 118 8.5"/>' +
          '<path d="M4 90 L4 74 L8 74 L8 78 L12 78 L12 82 L16 82 L16 86 L20 86 L20 90"/>' +
          '<path d="M176 90 L176 74 L172 74 L172 78 L168 78 L168 82 L164 82 L164 86 L160 86 L160 90"/>' +
          '</g>' +
          '<g fill="#b8a26a"><path d="M90 80 l2.4 3 -2.4 3 -2.4 -3 Z"/><circle cx="80" cy="83" r="0.6"/><circle cx="100" cy="83" r="0.6"/></g>',
      ),
    ),
    page: gridPage('A4', 1, 3, 180, 90, 0, 5),
    fields: [
      text('name', '主人公', { x: 25, y: 25, width: 130, height: 30 }, '赵与澜 · 秦书悦', {
        fontSize: 33,
        fontWeight: 'bold',
        emphasis: 'hero',
        letterSpacing: 0.14,
        fontFamily: SERIF_ZH,
        color: '#134e4a',
      }),
      text('note', '纪念主题', { x: 25, y: 59, width: 130, height: 10 }, '结婚三十周年纪念', {
        fontSize: 12,
        color: '#155e75',
        letterSpacing: 0.4,
        fontFamily: SERIF_ZH,
      }),
      fixed('cap', '小注', { x: 25, y: 15, width: 130, height: 6.5 }, 'ANNIVERSARY CELEBRATION', {
        fontSize: 7,
        color: '#0e7490',
        letterSpacing: 0.8,
      }),
    ],
  },
  {
    ...base,
    id: 'deluxeBanquetFrame',
    name: '宴会席卡·墨兰雅框',
    category: 'wedding',
    description: '100×65 mm 席卡，墨蓝色内框配兰草笔触角饰，端庄含蓄，中式喜宴与商务宴请均不违和。',
    scenario: '中式喜宴 / 商务宴请',
    accent: '#1e3a8a',
    sampleData: { name: '容景行', table: '兰厅 · 第 2 桌' },
    label: decorLabel(
      96,
      62,
      svg(
        100,
        65,
        '<rect x="5" y="5" width="90" height="55" fill="none" stroke="#1e3a8a" stroke-width="0.55"/>' +
          '<rect x="7.5" y="7.5" width="85" height="50" fill="none" stroke="#93a5cf" stroke-width="0.25"/>' +
          '<g stroke="#3b5998" stroke-width="0.45" fill="none" opacity="0.85">' +
          '<path d="M10 60 Q16 50 14 42 M13 60 Q20 54 22 46 M16 60 Q24 57 28 52"/>' +
          '<path d="M90 5 Q84 15 86 23 M87 5 Q80 11 78 19 M84 5 Q76 8 72 13"/>' +
          '</g>',
      ),
    ),
    page: gridPage('A4', 2, 4, 96, 62, 4, 5),
    fields: [
      text('name', '宾客姓名', { x: 12, y: 17, width: 76, height: 22 }, '容景行', {
        fontSize: 26,
        fontWeight: 'bold',
        emphasis: 'hero',
        letterSpacing: 0.22,
        fontFamily: SERIF_ZH,
        color: '#1e3a8a',
      }),
      text('table', '桌号', { x: 12, y: 42, width: 76, height: 7.5 }, '兰厅 · 第 2 桌', {
        fontSize: 9.5,
        color: INK_SOFT,
        letterSpacing: 0.3,
        fontFamily: SERIF_ZH,
      }),
    ],
  },
  // ================= 提示词库风格系列（docs/design-prompts.md） =================
  {
    ...base,
    id: 'deluxeWedFoil',
    name: '婚礼席位卡·鎏金水彩',
    category: 'wedding',
    description: '90×55 mm 席位卡 A4 一页 10 枚，腮红粉水彩晕染 + 鎏金细枝角饰，柔美高级的宴会厅婚礼质感。',
    scenario: '宴会厅婚礼 / 订婚宴',
    accent: '#b45309',
    sampleData: { name: '沈疏影', table: '第 6 桌' },
    label: decorLabel(
      90,
      55,
      svg(
        90,
        55,
        '<defs><radialGradient id="dxwf-a" cx="0.12" cy="0.1" r="0.75"><stop offset="0" stop-color="#fda4af" stop-opacity="0.4"/><stop offset="0.55" stop-color="#fecdd3" stop-opacity="0.18"/><stop offset="1" stop-color="#fecdd3" stop-opacity="0"/></radialGradient><radialGradient id="dxwf-b" cx="0.9" cy="0.95" r="0.7"><stop offset="0" stop-color="#fbcfe8" stop-opacity="0.35"/><stop offset="1" stop-color="#fbcfe8" stop-opacity="0"/></radialGradient></defs>' +
          '<rect x="0" y="0" width="90" height="55" fill="url(#dxwf-a)"/>' +
          '<rect x="0" y="0" width="90" height="55" fill="url(#dxwf-b)"/>' +
          '<g stroke="#b45309" stroke-width="0.38" fill="none">' +
          '<path d="M3 12 Q9 4 20 3"/><path d="M87 43 Q81 51 70 52"/>' +
          '</g>' +
          '<g fill="#d97706" opacity="0.85">' +
          '<circle cx="8" cy="7.4" r="0.7"/><circle cx="13" cy="4.6" r="0.55"/><circle cx="18" cy="3.4" r="0.45"/>' +
          '<circle cx="82" cy="47.6" r="0.7"/><circle cx="77" cy="50.4" r="0.55"/><circle cx="72" cy="51.6" r="0.45"/>' +
          '</g>' +
          '<g stroke="#f59e0b" stroke-width="0.22" fill="none" opacity="0.7"><path d="M30 51 L60 51"/><path d="M36 52.6 L54 52.6"/></g>',
      ),
    ),
    page: gridPage('A4', 2, 5, 90, 55, 6, 2.5),
    fields: [
      fixed('cap', '席位小注', { x: 8, y: 9, width: 74, height: 4.8 }, 'FOREVER · TOGETHER', {
        fontSize: 5.5,
        color: '#d6a05a',
        letterSpacing: 0.9,
      }),
      text('name', '宾客姓名', { x: 8, y: 17, width: 74, height: 18 }, '沈疏影', {
        fontSize: 24,
        fontWeight: 'bold',
        emphasis: 'hero',
        letterSpacing: 0.24,
        fontFamily: SERIF_ZH,
        color: '#7c2d12',
      }),
      text('table', '桌号', { x: 8, y: 38, width: 74, height: 7 }, '第 6 桌', {
        fontSize: 9.5,
        color: '#b45309',
        letterSpacing: 0.3,
      }),
    ],
  },
  {
    ...base,
    id: 'deluxeGovGuilloche',
    name: '政务窗口牌·纹章藏蓝',
    category: 'life',
    description: '180×70 mm 宽幅窗口牌，藏蓝底金色扭索纹样条 + 衬线窗口号大字，庄重可信的政务服务窗口气质。',
    scenario: '政务大厅 / 服务窗口',
    accent: '#1e3a8a',
    sampleData: { winNo: '03', service: '不动产登记', staff: '李文清' },
    label: decorLabel(
      180,
      70,
      svg(
        180,
        70,
        '<rect x="0" y="0" width="180" height="70" fill="#1e3a8a"/>' +
          '<rect x="0" y="0" width="52" height="70" fill="#172d6e"/>' +
          '<g stroke="#c8a44d" stroke-width="0.3" fill="none" opacity="0.8">' +
          '<path d="M0 6 Q11.25 2 22.5 6 T45 6 T67.5 6 T90 6 T112.5 6 T135 6 T157.5 6 T180 6"/>' +
          '<path d="M0 9 Q11.25 13 22.5 9 T45 9 T67.5 9 T90 9 T112.5 9 T135 9 T157.5 9 T180 9"/>' +
          '<path d="M0 61 Q11.25 57 22.5 61 T45 61 T67.5 61 T90 61 T112.5 61 T135 61 T157.5 61 T180 61"/>' +
          '<path d="M0 64 Q11.25 68 22.5 64 T45 64 T67.5 64 T90 64 T112.5 64 T135 64 T157.5 64 T180 64"/>' +
          '</g>' +
          '<line x1="52" y1="14" x2="52" y2="56" stroke="#c8a44d" stroke-width="0.5"/>',
      ),
    ),
    page: gridPage('A4', 1, 3, 180, 70, 0, 8),
    fields: [
      fixed('winCap', '窗口小注', { x: 6, y: 16, width: 40, height: 6 }, '窗口 WINDOW', {
        fontSize: 6.5,
        color: '#c8a44d',
        letterSpacing: 0.8,
      }),
      text('winNo', '窗口号', { x: 6, y: 24, width: 40, height: 26 }, '03', {
        fontSize: 34,
        fontWeight: 'bold',
        emphasis: 'hero',
        color: '#ffffff',
        fontFamily: SERIF_ZH,
      }),
      text('service', '业务名称', { x: 62, y: 20, width: 110, height: 20 }, '不动产登记', {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#ffffff',
        align: 'left',
        letterSpacing: 0.3,
        fontFamily: SERIF_ZH,
      }),
      text('staff', '姓名', { x: 62, y: 46, width: 110, height: 8 }, '李文清', {
        caption: '首席代表',
        fontSize: 10,
        color: '#c7d2fe',
        align: 'left',
        letterSpacing: 0.25,
      }),
    ],
  },
  {
    ...base,
    id: 'deluxeKidsPastel',
    name: '幼儿姓名贴·奶油云朵',
    category: 'kids',
    description: '64×38 mm 姓名贴 A4 一页 21 枚，奶油马卡龙撞色圆角云朵与小太阳，软萌治愈的幼儿园开学装备。',
    scenario: '幼儿园姓名贴 / 物品贴',
    accent: '#f472b6',
    sampleData: { name: '朵朵', className: '小二班' },
    label: decorLabel(
      64,
      38,
      svg(
        64,
        38,
        '<rect x="1.2" y="1.2" width="61.6" height="35.6" rx="6" fill="#fff7ed"/>' +
          '<rect x="1.2" y="1.2" width="61.6" height="35.6" rx="6" fill="none" stroke="#fdba74" stroke-width="0.6"/>' +
          '<g fill="#bae6fd"><ellipse cx="11" cy="7.6" rx="5" ry="2.5"/><ellipse cx="7.8" cy="8.8" rx="3.2" ry="1.9"/><ellipse cx="14.4" cy="8.8" rx="3" ry="1.8"/></g>' +
          '<g fill="#fde68a"><circle cx="54" cy="8.2" r="3"/></g>' +
          '<g stroke="#f59e0b" stroke-width="0.5" fill="none"><path d="M54 3.2 L54 1.7 M54 13.2 L54 14.7 M49 8.2 L47.5 8.2 M59 8.2 L60.5 8.2 M50.5 4.7 L49.4 3.6 M57.5 11.7 L58.6 12.8 M50.5 11.7 L49.4 12.8 M57.5 4.7 L58.6 3.6"/></g>' +
          '<g fill="#f9a8d4"><circle cx="6.5" cy="31.5" r="1.3"/><circle cx="57.5" cy="31.5" r="1.3"/><circle cx="10.6" cy="33.4" r="0.85"/><circle cx="53.4" cy="33.4" r="0.85"/></g>',
      ),
    ),
    page: gridPage('A4', 3, 7, 64, 38, 2, 2.5),
    fields: [
      text('name', '姓名', { x: 7, y: 12, width: 50, height: 14.5 }, '朵朵', {
        fontSize: 18,
        fontWeight: 'bold',
        emphasis: 'hero',
        color: '#db2777',
        letterSpacing: 0.3,
      }),
      text('className', '班级', { x: 7, y: 28.5, width: 50, height: 5.5 }, '小二班', {
        fontSize: 7.5,
        color: '#f97316',
        letterSpacing: 0.4,
      }),
    ],
  },
  {
    ...base,
    id: 'deluxeExamFocus',
    name: '考场桌贴·极简高对比',
    category: 'exam',
    description: '90×50 mm 桌贴 A4 一页 10 枚，顶部黑色信息条 + 座位号反白大字，机构感网格排版，远看一目了然。',
    scenario: '统一考试 / 校考桌贴',
    accent: '#111827',
    sampleData: { name: '苏沐宸', room: '第3考场', seatNo: '11', examId: '2026061011' },
    label: decorLabel(
      90,
      50,
      svg(
        90,
        50,
        '<rect x="0" y="0" width="90" height="12" fill="#111827"/>' +
          '<rect x="0" y="12" width="90" height="0.6" fill="#111827"/>' +
          '<line x1="26" y1="0" x2="26" y2="12" stroke="#4b5563" stroke-width="0.4"/>' +
          '<line x1="6" y1="42" x2="84" y2="42" stroke="#111827" stroke-width="0.5"/>' +
          '<rect x="0" y="48.6" width="90" height="1.4" fill="#111827"/>',
      ),
    ),
    page: gridPage('A4', 2, 5, 90, 50, 6, 2.5),
    fields: [
      text('seatNo', '座位号', { x: 2, y: 1.5, width: 22, height: 9 }, '11', {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#ffffff',
      }),
      text('room', '考场', { x: 28, y: 2.5, width: 58, height: 7 }, '第3考场', {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#ffffff',
        align: 'left',
        letterSpacing: 0.4,
      }),
      text('name', '姓名', { x: 8, y: 17, width: 74, height: 20 }, '苏沐宸', {
        fontSize: 26,
        fontWeight: 'bold',
        emphasis: 'hero',
        letterSpacing: 0.3,
      }),
      text('examId', '准考证号', { x: 8, y: 43, width: 74, height: 5.5 }, '2026061011', {
        fontSize: 8,
        color: INK_MUTED,
        letterSpacing: 0.6,
      }),
    ],
  },
  {
    ...base,
    id: 'deluxeClassChalk',
    name: '班级门牌·黑板报风',
    category: 'teaching',
    description: '190×88 mm 班级门牌，墨绿黑板底 + 粉笔手绘边框与星星点缀，班级名粉笔白大字，教室门口的温暖仪式感。',
    scenario: '教室门牌 / 班级标识',
    accent: '#14532d',
    sampleData: { className: '五年级（1）班', teacher: '李文静' },
    label: decorLabel(
      190,
      88,
      svg(
        190,
        88,
        '<rect x="0" y="0" width="190" height="88" fill="#1a4731"/>' +
          '<rect x="5" y="5" width="180" height="78" rx="3" fill="none" stroke="#f8fafc" stroke-width="0.7" stroke-dasharray="5 2.4" opacity="0.9"/>' +
          '<g fill="#fde68a" opacity="0.9">' +
          '<path d="M16 14 l1 2.4 2.4 0.3 -1.8 1.7 0.5 2.4 -2.1-1.2 -2.1 1.2 0.5-2.4 -1.8-1.7 2.4-0.3 Z"/>' +
          '<path d="M172 68 l0.9 2.1 2.1 0.3 -1.6 1.5 0.4 2.1 -1.8-1 -1.8 1 0.4-2.1 -1.6-1.5 2.1-0.3 Z"/>' +
          '</g>' +
          '<g stroke="#f8fafc" stroke-width="0.4" fill="none" opacity="0.75">' +
          '<path d="M158 18 q4 -4 8 0 q4 4 8 0"/><path d="M18 70 q4 -4 8 0 q4 4 8 0"/>' +
          '</g>',
      ),
    ),
    page: gridPage('A4', 1, 3, 190, 88, 0, 5),
    fields: [
      text('className', '班级', { x: 20, y: 22, width: 150, height: 30 }, '五年级（1）班', {
        fontSize: 34,
        fontWeight: 'bold',
        emphasis: 'hero',
        color: '#f8fafc',
        letterSpacing: 0.3,
      }),
      text('teacher', '老师', { x: 20, y: 58, width: 150, height: 9 }, '李文静', {
        fontSize: 11,
        color: '#d9f99d',
        letterSpacing: 0.35,
        caption: '班主任',
      }),
      fixed('motto', '班训', { x: 20, y: 70, width: 150, height: 6.5 }, '好好学习 · 天天向上', {
        fontSize: 8.5,
        color: '#fde68a',
        letterSpacing: 0.6,
      }),
    ],
  },
  {
    ...base,
    id: 'deluxeConfFret',
    name: '会议桌牌·朱砂回纹',
    category: 'event',
    description: '180×90 mm 桌牌，朱砂红回纹样条上下呼应 + 鎏金细线，取意传统纹样的国风会议桌牌，宋体大字庄重大气。',
    scenario: '国风论坛 / 文化交流会',
    accent: '#9f1239',
    sampleData: { name: '林听澜', org: '国风文化研究院', title: '副院长' },
    label: decorLabel(
      180,
      90,
      svg(
        180,
        90,
        '<rect x="0" y="0" width="180" height="10" fill="#9f1239"/>' +
          '<rect x="0" y="80" width="180" height="10" fill="#9f1239"/>' +
          '<g stroke="#fbbf24" stroke-width="0.55" fill="none">' +
          '<path d="M4 5 h4 v-2 h-2 v1 h4 m4 1 h4 v-2 h-2 v1 h4 m4 1 h4 v-2 h-2 v1 h4 m4 1 h4 v-2 h-2 v1 h4 m4 1 h4 v-2 h-2 v1 h4 m4 1 h4 v-2 h-2 v1 h4 m4 1 h4 v-2 h-2 v1 h4 m4 1 h4 v-2 h-2 v1 h4 m4 1 h4 v-2 h-2 v1 h4 m4 1 h4 v-2 h-2 v1 h4 m4 1 h4 v-2 h-2 v1 h4 m4 1 h4 v-2 h-2 v1 h4"/>' +
          '<path d="M4 85 h4 v2 h-2 v-1 h4 m4 -1 h4 v2 h-2 v-1 h4 m4 -1 h4 v2 h-2 v-1 h4 m4 -1 h4 v2 h-2 v-1 h4 m4 -1 h4 v2 h-2 v-1 h4 m4 -1 h4 v2 h-2 v-1 h4 m4 -1 h4 v2 h-2 v-1 h4 m4 -1 h4 v2 h-2 v-1 h4 m4 -1 h4 v2 h-2 v-1 h4 m4 -1 h4 v2 h-2 v-1 h4 m4 -1 h4 v2 h-2 v-1 h4 m4 -1 h4 v2 h-2 v-1 h4"/>' +
          '</g>' +
          '<line x1="20" y1="13.5" x2="160" y2="13.5" stroke="#d4a373" stroke-width="0.3"/>' +
          '<line x1="20" y1="76.5" x2="160" y2="76.5" stroke="#d4a373" stroke-width="0.3"/>',
      ),
    ),
    page: gridPage('A4', 1, 3, 180, 90, 0, 5),
    fields: [
      text('org', '单位', { x: 15, y: 18, width: 150, height: 9 }, '国风文化研究院', {
        fontSize: 10.5,
        color: '#7f1d1d',
        letterSpacing: 0.3,
        fontFamily: SERIF_ZH,
      }),
      text('name', '姓名', { x: 15, y: 31, width: 150, height: 33 }, '林听澜', {
        fontSize: 42,
        fontWeight: 'bold',
        emphasis: 'hero',
        letterSpacing: 0.28,
        fontFamily: SERIF_ZH,
      }),
      text('title', '职务', { x: 15, y: 67, width: 150, height: 9 }, '副院长', {
        fontSize: 12,
        color: '#9f1239',
        letterSpacing: 0.5,
        fontFamily: SERIF_ZH,
      }),
    ],
  },
]
