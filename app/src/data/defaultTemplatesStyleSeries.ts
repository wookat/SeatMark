import type { LabelTemplate } from '@/types/template'

import { DEFAULT_FONT_STACK, DEFAULT_FONT_STACK_EN } from './fonts'
import { fixed, gridPage, INK_MUTED, INK_SOFT, text } from './templateFactory'

/**
 * 模板库扩充 · 风格系列篇（第四轮）。
 * 为高频场景提供多风格可选的样式系列，全部基于 decorSvg 装饰层：
 * - 极简黑白（mono）：纯线条黑白灰，任何打印机零损失；
 * - 商务深蓝（navy）：深蓝色带与细金线，政企商务通用；
 * - 中式红金（redGold）：朱红鎏金回纹祥云，婚庆年会喜庆庄重；
 * - 清新马卡龙（macaron）：低饱和粉彩圆角波浪，幼儿园专属；
 * - 科技渐变（tech）：青紫渐变光带与电路角饰，发布会电竞；
 * - 手写温暖（warm）：奶油底虚线手账风，家长会寄语场景；
 * - 复古证书（retro）：双线花框绶带，颁奖典礼仪式感；
 * - 森系自然（forest）：橄榄绿枝叶线描，森系婚礼与绿植。
 * decorSvg viewBox 用户单位 = mm；配色均验证过黑白打印灰阶不脏。
 */

const FONT = DEFAULT_FONT_STACK
const FONT_EN = DEFAULT_FONT_STACK_EN

const base = {
  builtin: true as const,
  fontFamily: FONT,
  fontFamilyEn: FONT_EN,
  showLabelBorder: false,
}

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

export const styleSeriesTemplates: LabelTemplate[] = [
  // ================= 极简黑白系列 =================
  {
    ...base,
    id: 'monoConfCard',
    name: '黑白系·会议桌牌',
    category: 'event',
    description: '180×90 mm 桌牌，单侧粗黑竖线 + 底部细线收边，极简黑白任何打印机零损失。',
    scenario: '极简风会议桌牌',
    accent: '#111827',
    sampleData: { name: '费临舟', org: '临舟设计事务所', title: '创始合伙人' },
    label: decorLabel(
      180,
      90,
      svg(
        180,
        90,
        '<rect x="10" y="14" width="1.6" height="62" fill="#111827"/>' +
          '<rect x="14" y="14" width="0.35" height="62" fill="#9ca3af"/>' +
          '<rect x="10" y="80" width="160" height="0.35" fill="#d1d5db"/>',
      ),
    ),
    page: gridPage('A4', 1, 3, 180, 90, 0, 5),
    fields: [
      text('org', '单位', { x: 22, y: 16, width: 148, height: 9 }, '临舟设计事务所', {
        fontSize: 10,
        color: INK_MUTED,
        align: 'left',
        letterSpacing: 0.1,
      }),
      text('name', '姓名', { x: 22, y: 30, width: 148, height: 32 }, '费临舟', {
        fontSize: 42,
        fontWeight: 'bold',
        align: 'left',
        emphasis: 'hero',
        letterSpacing: 0.12,
      }),
      text('title', '职务', { x: 22, y: 66, width: 148, height: 10 }, '创始合伙人', {
        fontSize: 12,
        color: INK_SOFT,
        align: 'left',
        letterSpacing: 0.25,
      }),
    ],
  },
  {
    ...base,
    id: 'monoSeatCard',
    name: '黑白系·考场座签',
    category: 'exam',
    description: '60×32 mm 一页 24 枚，右侧黑块反白座位号 + 左侧信息列，黑白打印锐利醒目。',
    scenario: '极简风考场座签',
    accent: '#111827',
    sampleData: { seatNo: '18', name: '宁远舟', room: '第 03 考场' },
    label: decorLabel(
      60,
      32,
      svg(
        60,
        32,
        '<rect x="0" y="0" width="60" height="32" fill="none" stroke="#111827" stroke-width="0.5"/>' +
          '<rect x="41" y="0" width="19" height="32" fill="#111827"/>',
      ),
    ),
    page: gridPage('A4', 3, 8, 60, 32, 4, 4),
    fields: [
      text('name', '姓名', { x: 3, y: 4, width: 36, height: 13 }, '宁远舟', {
        fontSize: 12.5,
        fontWeight: 'bold',
        align: 'left',
      }),
      text('room', '考场', { x: 3, y: 20, width: 36, height: 8 }, '第 03 考场', {
        fontSize: 7,
        color: INK_MUTED,
        align: 'left',
      }),
      text('seatNo', '座位号', { x: 41, y: 6, width: 19, height: 20 }, '18', {
        fontSize: 17,
        fontWeight: 'bold',
        color: '#ffffff',
        emphasis: 'hero',
      }),
    ],
  },
  {
    ...base,
    id: 'monoDeskName',
    name: '黑白系·姓名桌贴',
    category: 'teaching',
    description: '90×45 mm 一页 10 枚，四角极细角标框住大字姓名，克制留白出版物气质。',
    scenario: '极简风课桌姓名贴',
    accent: '#111827',
    sampleData: { name: '苏晚晴', className: '高二（6）班' },
    label: decorLabel(
      90,
      45,
      svg(
        90,
        45,
        '<g stroke="#111827" stroke-width="0.5" fill="none">' +
          '<path d="M6 11 L6 6 L11 6"/><path d="M84 11 L84 6 L79 6"/>' +
          '<path d="M6 34 L6 39 L11 39"/><path d="M84 34 L84 39 L79 39"/></g>',
      ),
    ),
    page: gridPage('A4', 2, 5, 90, 45, 6, 5),
    fields: [
      text('name', '姓名', { x: 10, y: 8, width: 70, height: 22 }, '苏晚晴', {
        fontSize: 26,
        fontWeight: 'bold',
        emphasis: 'hero',
        letterSpacing: 0.15,
      }),
      text('className', '班级', { x: 10, y: 32, width: 70, height: 7 }, '高二（6）班', {
        fontSize: 8,
        color: INK_MUTED,
      }),
    ],
  },
  // ================= 商务深蓝系列 =================
  {
    ...base,
    id: 'navyConfCard',
    name: '深蓝系·会议桌牌',
    category: 'event',
    description: '180×90 mm 桌牌，藏青色底带金色细线收边，姓名反白大字，政企商务稳重大气。',
    scenario: '商务深蓝会议桌牌',
    accent: '#1e3a5f',
    sampleData: { name: '霍云峥', org: '华瀚控股集团', title: '副总裁' },
    label: decorLabel(
      180,
      90,
      svg(
        180,
        90,
        '<rect x="0" y="0" width="180" height="90" fill="#1e3a5f"/>' +
          '<rect x="6" y="6" width="168" height="78" fill="none" stroke="#c9a86a" stroke-width="0.4"/>' +
          '<rect x="0" y="0" width="180" height="3" fill="#c9a86a"/>' +
          '<rect x="0" y="87" width="180" height="3" fill="#c9a86a"/>',
      ),
    ),
    page: gridPage('A4', 1, 3, 180, 90, 0, 5),
    fields: [
      text('org', '单位', { x: 15, y: 15, width: 150, height: 9 }, '华瀚控股集团', {
        fontSize: 10,
        color: '#c9d6e8',
        letterSpacing: 0.15,
      }),
      text('name', '姓名', { x: 15, y: 29, width: 150, height: 32 }, '霍云峥', {
        fontSize: 42,
        fontWeight: 'bold',
        color: '#ffffff',
        emphasis: 'hero',
        letterSpacing: 0.15,
      }),
      text('title', '职务', { x: 15, y: 66, width: 150, height: 10 }, '副总裁', {
        fontSize: 12,
        color: '#c9a86a',
        letterSpacing: 0.3,
      }),
    ],
  },
  {
    ...base,
    id: 'navyBadge',
    name: '深蓝系·参会胸牌',
    category: 'event',
    description: '90×55 mm 胸牌，藏青顶带 + 金线分隔，姓名大字与单位职务分层，别针挂绳皆宜。',
    scenario: '商务深蓝参会证',
    accent: '#1e3a5f',
    sampleData: { name: '祁明萱', org: '中环资本', role: '嘉宾 GUEST' },
    label: decorLabel(
      90,
      55,
      svg(
        90,
        55,
        '<rect x="0" y="0" width="90" height="14" fill="#1e3a5f"/>' +
          '<rect x="0" y="14" width="90" height="0.6" fill="#c9a86a"/>' +
          '<rect x="0" y="0" width="90" height="55" fill="none" stroke="#1e3a5f" stroke-width="0.5"/>',
      ),
    ),
    page: gridPage('A4', 2, 4, 90, 55, 8, 6),
    fields: [
      text('role', '类别', { x: 5, y: 3, width: 80, height: 8 }, '嘉宾 GUEST', {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#ffffff',
        letterSpacing: 0.25,
      }),
      text('name', '姓名', { x: 5, y: 19, width: 80, height: 18 }, '祁明萱', {
        fontSize: 20,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('org', '单位', { x: 5, y: 41, width: 80, height: 9 }, '中环资本', {
        fontSize: 9,
        color: INK_MUTED,
      }),
    ],
  },
  {
    ...base,
    id: 'navyLectern',
    name: '深蓝系·讲台台签',
    category: 'event',
    description: '140×90 mm 台签，深蓝底金色双线框，讲者姓名与议程角色反白居中，讲台庄重压场。',
    scenario: '商务深蓝讲台台签',
    accent: '#1e3a5f',
    sampleData: { name: '温子昂', topic: '宏观经济与资产配置展望' },
    label: decorLabel(
      140,
      90,
      svg(
        140,
        90,
        '<rect x="0" y="0" width="140" height="90" fill="#1e3a5f"/>' +
          '<rect x="5" y="5" width="130" height="80" fill="none" stroke="#c9a86a" stroke-width="0.5"/>' +
          '<rect x="7.5" y="7.5" width="125" height="75" fill="none" stroke="#c9a86a" stroke-width="0.25"/>',
      ),
    ),
    page: gridPage('A4', 1, 3, 140, 90, 0, 8),
    fields: [
      text('name', '讲者', { x: 12, y: 22, width: 116, height: 26 }, '温子昂', {
        caption: '主讲人',
        fontSize: 25,
        fontWeight: 'bold',
        color: '#ffffff',
        emphasis: 'hero',
      }),
      text('topic', '议题', { x: 12, y: 56, width: 116, height: 12 }, '宏观经济与资产配置展望', {
        fontSize: 11,
        color: '#c9d6e8',
      }),
    ],
  },
  // ================= 中式红金系列 =================
  {
    ...base,
    id: 'redGoldWedPlace',
    name: '红金系·婚礼席位卡',
    category: 'wedding',
    description: '90×55 mm 席位卡，朱红底鎏金双线与回纹角饰，宾客姓名金字，中式婚礼喜庆隆重。',
    scenario: '中式婚礼席位卡',
    accent: '#9f1239',
    sampleData: { name: '陆呈之 先生', tableNo: '第 6 桌' },
    label: decorLabel(
      90,
      55,
      svg(
        90,
        55,
        '<rect x="0" y="0" width="90" height="55" fill="#9f1239"/>' +
          '<rect x="4" y="4" width="82" height="47" fill="none" stroke="#e7c873" stroke-width="0.5"/>' +
          '<rect x="6" y="6" width="78" height="43" fill="none" stroke="#e7c873" stroke-width="0.25"/>' +
          '<g stroke="#e7c873" stroke-width="0.4" fill="none">' +
          '<path d="M10 10 h4 v4 M10 10 v4 h4" opacity="0.9"/>' +
          '<path d="M80 10 h-4 v4 M80 10 v4 h-4" opacity="0.9"/>' +
          '<path d="M10 45 h4 v-4 M10 45 v-4 h4" opacity="0.9"/>' +
          '<path d="M80 45 h-4 v-4 M80 45 v-4 h-4" opacity="0.9"/></g>',
      ),
    ),
    page: gridPage('A4', 2, 4, 90, 55, 8, 6),
    fields: [
      fixed('cap', '标注', { x: 10, y: 10, width: 70, height: 7 }, '囍 · 恭候光临', {
        fontSize: 7,
        color: '#e7c873',
        letterSpacing: 0.3,
      }),
      text('name', '姓名', { x: 10, y: 20, width: 70, height: 18 }, '陆呈之 先生', {
        fontSize: 17,
        fontWeight: 'bold',
        color: '#ffffff',
        emphasis: 'hero',
      }),
      text('tableNo', '桌号', { x: 10, y: 41, width: 70, height: 8 }, '第 6 桌', {
        fontSize: 9,
        color: '#e7c873',
      }),
    ],
  },
  {
    ...base,
    id: 'redGoldTableNo',
    name: '红金系·喜宴桌号牌',
    category: 'wedding',
    description: '140×90 mm 桌号牌，桌号金色超大字配朱红底纹与对角祥云线，宴会厅远看即辨。',
    scenario: '中式喜宴桌号牌',
    accent: '#9f1239',
    sampleData: { tableNo: '陆', tableName: '花好月圆桌' },
    label: decorLabel(
      140,
      90,
      svg(
        140,
        90,
        '<rect x="0" y="0" width="140" height="90" fill="#9f1239"/>' +
          '<rect x="5" y="5" width="130" height="80" fill="none" stroke="#e7c873" stroke-width="0.5"/>' +
          '<g stroke="#e7c873" stroke-width="0.35" fill="none" opacity="0.85">' +
          '<path d="M12 16 q4 -6 8 0 q4 6 8 0"/>' +
          '<path d="M112 74 q4 -6 8 0 q4 6 8 0"/></g>',
      ),
    ),
    page: gridPage('A4', 1, 3, 140, 90, 0, 8),
    fields: [
      text('tableNo', '桌号', { x: 20, y: 14, width: 100, height: 44 }, '陆', {
        fontSize: 52,
        fontWeight: 'bold',
        color: '#e7c873',
        emphasis: 'hero',
      }),
      text('tableName', '桌名', { x: 20, y: 64, width: 100, height: 12 }, '花好月圆桌', {
        fontSize: 12,
        color: '#ffffff',
        letterSpacing: 0.3,
      }),
    ],
  },
  {
    ...base,
    id: 'redGoldAnnual',
    name: '红金系·年会桌牌',
    category: 'event',
    description: '180×90 mm 年会桌牌，白底朱红宽边与鎏金内线，姓名墨字部门红字，年会颁奖两相宜。',
    scenario: '中式红金年会桌牌',
    accent: '#b91c1c',
    sampleData: { name: '安若飞', dept: '销售一部 · 年度冠军团队' },
    label: decorLabel(
      180,
      90,
      svg(
        180,
        90,
        '<rect x="0" y="0" width="180" height="90" fill="none" stroke="#b91c1c" stroke-width="3"/>' +
          '<rect x="5" y="5" width="170" height="80" fill="none" stroke="#e7c873" stroke-width="0.6"/>' +
          '<path d="M20 12 h140" stroke="#b91c1c" stroke-width="0.4"/>' +
          '<path d="M20 78 h140" stroke="#b91c1c" stroke-width="0.4"/>' +
          '<circle cx="90" cy="12" r="1.6" fill="#e7c873"/>' +
          '<circle cx="90" cy="78" r="1.6" fill="#e7c873"/>',
      ),
    ),
    page: gridPage('A4', 1, 3, 180, 90, 0, 5),
    fields: [
      text('name', '姓名', { x: 15, y: 22, width: 150, height: 34 }, '安若飞', {
        fontSize: 44,
        fontWeight: 'bold',
        emphasis: 'hero',
        letterSpacing: 0.18,
      }),
      text('dept', '部门', { x: 15, y: 62, width: 150, height: 11 }, '销售一部 · 年度冠军团队', {
        fontSize: 11,
        color: '#b91c1c',
        letterSpacing: 0.15,
      }),
    ],
  },
  {
    ...base,
    id: 'redGoldWelcome',
    name: '红金系·迎宾牌',
    category: 'wedding',
    description: '180×120 mm 迎宾牌，朱红底鎏金大框，新人姓名金色大字与婚期，签到迎宾仪式满格。',
    scenario: '中式婚礼迎宾牌',
    accent: '#9f1239',
    sampleData: { couple: '沈聿 & 顾念', date: '2026 年 10 月 6 日', hall: '朝阳厅 · 恭迎亲临' },
    label: decorLabel(
      180,
      120,
      svg(
        180,
        120,
        '<rect x="0" y="0" width="180" height="120" fill="#9f1239"/>' +
          '<rect x="6" y="6" width="168" height="108" fill="none" stroke="#e7c873" stroke-width="0.7"/>' +
          '<rect x="9" y="9" width="162" height="102" fill="none" stroke="#e7c873" stroke-width="0.3"/>' +
          '<g stroke="#e7c873" stroke-width="0.4" fill="none" opacity="0.9">' +
          '<path d="M74 22 q8 -8 16 0 q8 8 16 0" transform="translate(-16 0)"/></g>',
      ),
    ),
    page: gridPage('A4', 1, 2, 180, 120, 0, 6),
    fields: [
      fixed('cap', '标注', { x: 20, y: 26, width: 140, height: 8 }, '囍 · 我们结婚啦', {
        fontSize: 8,
        color: '#e7c873',
        letterSpacing: 0.4,
      }),
      text('couple', '新人', { x: 15, y: 40, width: 150, height: 30 }, '沈聿 & 顾念', {
        fontSize: 34,
        fontWeight: 'bold',
        color: '#e7c873',
        emphasis: 'hero',
      }),
      text('date', '婚期', { x: 15, y: 78, width: 150, height: 10 }, '2026 年 10 月 6 日', {
        fontSize: 11,
        color: '#ffffff',
      }),
      text('hall', '厅名', { x: 15, y: 92, width: 150, height: 9 }, '朝阳厅 · 恭迎亲临', {
        fontSize: 9,
        color: '#f3d9a4',
      }),
    ],
  },
  // ================= 清新马卡龙系列 =================
  {
    ...base,
    id: 'macaronName',
    name: '马卡龙·宝贝姓名贴',
    category: 'kids',
    description: '70×40 mm 一页 12 枚，蜜桃粉波浪顶边 + 薄荷圆点，圆角可爱幼儿园姓名贴。',
    scenario: '马卡龙风姓名贴',
    accent: '#f9a8d4',
    sampleData: { name: '乐乐', className: '小三班' },
    label: decorLabel(
      70,
      40,
      svg(
        70,
        40,
        '<rect x="0" y="0" width="70" height="40" rx="4" fill="#fff7fa"/>' +
          '<path d="M0 8 Q8.75 3 17.5 8 T35 8 T52.5 8 T70 8 L70 0 L0 0 Z" fill="#f9a8d4"/>' +
          '<circle cx="8" cy="33" r="1.6" fill="#99e2d0"/>' +
          '<circle cx="62" cy="33" r="1.6" fill="#fcd34d"/>' +
          '<rect x="0.4" y="0.4" width="69.2" height="39.2" rx="3.6" fill="none" stroke="#f9a8d4" stroke-width="0.5"/>',
      ),
      4,
    ),
    page: gridPage('A4', 2, 6, 70, 40, 6, 4),
    fields: [
      text('name', '姓名', { x: 8, y: 12, width: 54, height: 17 }, '乐乐', {
        fontSize: 19,
        fontWeight: 'bold',
        color: '#be185d',
        emphasis: 'hero',
      }),
      text('className', '班级', { x: 8, y: 31, width: 54, height: 6 }, '小三班', {
        fontSize: 6.5,
        color: '#d97706',
      }),
    ],
  },
  {
    ...base,
    id: 'macaronCubby',
    name: '马卡龙·收纳格贴',
    category: 'kids',
    description: '60×30 mm 密排小贴，薄荷绿圆角框 + 柠檬黄圆点，书包柜水杯格茶杯架都能贴。',
    scenario: '马卡龙风收纳格标签',
    accent: '#99e2d0',
    sampleData: { name: '朵朵', item: '书包柜' },
    label: decorLabel(
      60,
      30,
      svg(
        60,
        30,
        '<rect x="0.4" y="0.4" width="59.2" height="29.2" rx="3.6" fill="#f2fbf8" stroke="#99e2d0" stroke-width="0.6"/>' +
          '<circle cx="7" cy="15" r="3.4" fill="#fcd34d" opacity="0.85"/>' +
          '<circle cx="53" cy="15" r="3.4" fill="#f9a8d4" opacity="0.85"/>',
      ),
      3.5,
    ),
    page: gridPage('A4', 3, 8, 60, 30, 4, 4),
    fields: [
      text('name', '姓名', { x: 12, y: 4, width: 36, height: 15 }, '朵朵', {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#0f766e',
        emphasis: 'hero',
      }),
      text('item', '物品', { x: 12, y: 20, width: 36, height: 6 }, '书包柜', {
        fontSize: 6,
        color: INK_MUTED,
      }),
    ],
  },
  {
    ...base,
    id: 'macaronBirthday',
    name: '马卡龙·生日主角牌',
    category: 'kids',
    description: '90×55 mm 生日牌，三色气球与彩旗线描，宝贝姓名大字 + 生日日期，班级生日会主角感。',
    scenario: '马卡龙风生日会',
    accent: '#fcd34d',
    sampleData: { name: '安安', birthday: '8 月 20 日 · 5 岁生日' },
    label: decorLabel(
      90,
      55,
      svg(
        90,
        55,
        '<rect x="0.4" y="0.4" width="89.2" height="54.2" rx="4" fill="#fffbeb" stroke="#fcd34d" stroke-width="0.6"/>' +
          '<path d="M6 6 L20 12 L34 6 L48 12 L62 6 L76 12 L84 8" stroke="#f9a8d4" stroke-width="0.5" fill="none"/>' +
          '<ellipse cx="11" cy="40" rx="3.5" ry="4.5" fill="#f9a8d4" opacity="0.9"/>' +
          '<path d="M11 44.5 q1 3 0 6" stroke="#f9a8d4" stroke-width="0.4" fill="none"/>' +
          '<ellipse cx="79" cy="40" rx="3.5" ry="4.5" fill="#99e2d0" opacity="0.9"/>' +
          '<path d="M79 44.5 q-1 3 0 6" stroke="#99e2d0" stroke-width="0.4" fill="none"/>',
      ),
      4,
    ),
    page: gridPage('A4', 2, 4, 90, 55, 8, 6),
    fields: [
      fixed('cap', '标注', { x: 15, y: 14, width: 60, height: 7 }, '今天我是小寿星', {
        fontSize: 7,
        color: '#d97706',
        letterSpacing: 0.2,
      }),
      text('name', '姓名', { x: 18, y: 23, width: 54, height: 18 }, '安安', {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#be185d',
        emphasis: 'hero',
      }),
      text('birthday', '生日', { x: 15, y: 44, width: 60, height: 7 }, '8 月 20 日 · 5 岁生日', {
        fontSize: 7,
        color: INK_MUTED,
      }),
    ],
  },
  {
    ...base,
    id: 'macaronMeal',
    name: '马卡龙·餐点座位贴',
    category: 'kids',
    description: '90×40 mm 餐位贴，奶黄底波浪分隔 + 姓名与餐点提示（过敏忌口），分餐对号不出错。',
    scenario: '马卡龙风餐点座位',
    accent: '#fcd34d',
    sampleData: { name: '果果', meal: '牛奶过敏 · 换豆浆' },
    label: decorLabel(
      90,
      40,
      svg(
        90,
        40,
        '<rect x="0.4" y="0.4" width="89.2" height="39.2" rx="3.6" fill="#fffdf5" stroke="#fcd34d" stroke-width="0.6"/>' +
          '<path d="M0 26 Q11.25 22 22.5 26 T45 26 T67.5 26 T90 26 L90 40 L0 40 Z" fill="#fef3c7"/>',
      ),
      3.5,
    ),
    page: gridPage('A4', 2, 6, 90, 40, 8, 4),
    fields: [
      text('name', '姓名', { x: 10, y: 4, width: 70, height: 17 }, '果果', {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#b45309',
        emphasis: 'hero',
      }),
      text('meal', '餐点提示', { x: 10, y: 27, width: 70, height: 9 }, '牛奶过敏 · 换豆浆', {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#dc2626',
      }),
    ],
  },
  // ================= 科技渐变系列 =================
  {
    ...base,
    id: 'techLaunchCard',
    name: '科技系·发布会桌牌',
    category: 'event',
    description: '180×90 mm 桌牌，深空底青紫极光斜切光带，姓名反白大字，新品发布会未来感十足。',
    scenario: '科技渐变发布会桌牌',
    accent: '#0ea5e9',
    sampleData: { name: '钟无衍', org: '深流科技 DeepFlow', title: '首席产品官' },
    label: decorLabel(
      180,
      90,
      svg(
        180,
        90,
        '<defs><linearGradient id="tlc-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs>' +
          '<rect x="0" y="0" width="180" height="90" fill="#0b1220"/>' +
          '<path d="M0 90 L60 90 L110 0 L86 0 Z" fill="url(#tlc-a)" opacity="0.22"/>' +
          '<path d="M96 90 L104 90 L140 0 L132 0 Z" fill="url(#tlc-a)" opacity="0.35"/>' +
          '<rect x="0" y="86.5" width="180" height="3.5" fill="url(#tlc-a)"/>',
      ),
    ),
    page: gridPage('A4', 1, 3, 180, 90, 0, 5),
    fields: [
      text('org', '单位', { x: 15, y: 14, width: 150, height: 9 }, '深流科技 DeepFlow', {
        fontSize: 10,
        color: '#7dd3fc',
        letterSpacing: 0.2,
      }),
      text('name', '姓名', { x: 15, y: 28, width: 150, height: 33 }, '钟无衍', {
        fontSize: 43,
        fontWeight: 'bold',
        color: '#ffffff',
        emphasis: 'hero',
        letterSpacing: 0.15,
      }),
      text('title', '职务', { x: 15, y: 65, width: 150, height: 10 }, '首席产品官', {
        fontSize: 12,
        color: '#c4b5fd',
        letterSpacing: 0.3,
      }),
    ],
  },
  {
    ...base,
    id: 'techEsportsSeat',
    name: '科技系·电竞选手席',
    category: 'event',
    description: '180×70 mm 选手席牌，霓虹描边斜杠底纹，选手 ID 反白大字 + 战队位次，赛场氛围灯感。',
    scenario: '科技渐变电竞席',
    accent: '#22d3ee',
    sampleData: { playerId: 'Nova·凌', team: '赤霄战队 · 中单' },
    label: decorLabel(
      180,
      70,
      svg(
        180,
        70,
        '<defs><linearGradient id="tes-a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs>' +
          '<rect x="0" y="0" width="180" height="70" fill="#0b1220"/>' +
          '<g stroke="#1f2b45" stroke-width="1.2"><path d="M130 70 L160 0"/><path d="M142 70 L172 0"/><path d="M154 70 L184 0"/></g>' +
          '<rect x="0" y="0" width="180" height="1.8" fill="url(#tes-a)"/>' +
          '<rect x="0" y="68.2" width="180" height="1.8" fill="url(#tes-a)"/>' +
          '<rect x="0" y="0" width="4" height="70" fill="url(#tes-a)"/>',
      ),
    ),
    page: gridPage('A4', 1, 3, 180, 70, 0, 8),
    fields: [
      text('playerId', '选手 ID', { x: 14, y: 12, width: 152, height: 28 }, 'Nova·凌', {
        fontSize: 30,
        fontWeight: 'bold',
        color: '#ffffff',
        align: 'left',
        emphasis: 'hero',
        letterSpacing: 0.1,
      }),
      text('team', '战队位次', { x: 14, y: 46, width: 152, height: 10 }, '赤霄战队 · 中单', {
        fontSize: 10.5,
        color: '#67e8f9',
        align: 'left',
        letterSpacing: 0.15,
      }),
    ],
  },
  {
    ...base,
    id: 'techBadge',
    name: '科技系·参会证',
    category: 'event',
    description: '90×55 mm 参会证，深空底渐变光带过肩，姓名反白 + 单位与类别，科技峰会统一视觉。',
    scenario: '科技渐变参会证',
    accent: '#0ea5e9',
    sampleData: { name: '路远歌', org: 'AI Infra 大会', role: '开发者 DEV' },
    label: decorLabel(
      90,
      55,
      svg(
        90,
        55,
        '<defs><linearGradient id="tbg-a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs>' +
          '<rect x="0" y="0" width="90" height="55" fill="#0b1220"/>' +
          '<path d="M0 14 L90 8 L90 11 L0 17 Z" fill="url(#tbg-a)" opacity="0.9"/>' +
          '<rect x="0" y="52" width="90" height="3" fill="url(#tbg-a)"/>',
      ),
    ),
    page: gridPage('A4', 2, 4, 90, 55, 8, 6),
    fields: [
      text('role', '类别', { x: 5, y: 2.5, width: 80, height: 8 }, '开发者 DEV', {
        fontSize: 7.5,
        fontWeight: 'bold',
        color: '#67e8f9',
        align: 'left',
        letterSpacing: 0.3,
      }),
      text('name', '姓名', { x: 5, y: 20, width: 80, height: 17 }, '路远歌', {
        fontSize: 19,
        fontWeight: 'bold',
        color: '#ffffff',
        emphasis: 'hero',
      }),
      text('org', '单位', { x: 5, y: 40, width: 80, height: 8 }, 'AI Infra 大会', {
        fontSize: 8,
        color: '#94a3b8',
      }),
    ],
  },
  // ================= 手写温暖系列 =================
  {
    ...base,
    id: 'warmParentSeat',
    name: '温暖系·家长会桌贴',
    category: 'teaching',
    description: '90×55 mm 桌贴，奶油底手账虚线框 + 爱心角饰，「XX 的爸爸/妈妈」称呼大字更亲切。',
    scenario: '手写风家长会',
    accent: '#f59e0b',
    sampleData: { student: '周依依', parent: '依依妈妈的座位', className: '三年级（2）班' },
    label: decorLabel(
      90,
      55,
      svg(
        90,
        55,
        '<rect x="0" y="0" width="90" height="55" fill="#fffbf2"/>' +
          '<rect x="4" y="4" width="82" height="47" rx="3" fill="none" stroke="#f59e0b" stroke-width="0.5" stroke-dasharray="2 1.4"/>' +
          '<path d="M10 9 c-1.4 -1.8 -4 -0.6 -4 1.2 c0 1.6 2.4 3 4 4 c1.6 -1 4 -2.4 4 -4 c0 -1.8 -2.6 -3 -4 -1.2 Z" fill="#fda4af"/>',
      ),
      3,
    ),
    page: gridPage('A4', 2, 4, 90, 55, 8, 6),
    fields: [
      text('className', '班级', { x: 18, y: 8, width: 60, height: 7 }, '三年级（2）班', {
        fontSize: 7,
        color: INK_MUTED,
      }),
      text('parent', '称呼', { x: 10, y: 19, width: 70, height: 18 }, '依依妈妈的座位', {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#92400e',
        emphasis: 'hero',
      }),
      text('student', '学生', { x: 10, y: 41, width: 70, height: 7 }, '周依依', {
        fontSize: 7.5,
        color: INK_SOFT,
      }),
    ],
  },
  {
    ...base,
    id: 'warmDeskName',
    name: '温暖系·手账姓名贴',
    category: 'teaching',
    description: '90×45 mm 姓名贴，奶油底胶带贴纸装饰 + 手账虚线，低年级课桌暖意十足。',
    scenario: '手写风课桌姓名贴',
    accent: '#f59e0b',
    sampleData: { name: '何小满', motto: '今天也要加油鸭' },
    label: decorLabel(
      90,
      45,
      svg(
        90,
        45,
        '<rect x="0" y="0" width="90" height="45" fill="#fffbf2"/>' +
          '<rect x="3" y="3" width="84" height="39" rx="2.5" fill="none" stroke="#fbbf24" stroke-width="0.45" stroke-dasharray="2 1.4"/>' +
          '<rect x="36" y="0.5" width="18" height="5" rx="1" fill="#fde68a" opacity="0.9" transform="rotate(-3 45 3)"/>',
      ),
      3,
    ),
    page: gridPage('A4', 2, 5, 90, 45, 6, 5),
    fields: [
      text('name', '姓名', { x: 10, y: 9, width: 70, height: 20 }, '何小满', {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#92400e',
        emphasis: 'hero',
      }),
      text('motto', '寄语', { x: 10, y: 32, width: 70, height: 7 }, '今天也要加油鸭', {
        fontSize: 7,
        color: '#d97706',
      }),
    ],
  },
  {
    ...base,
    id: 'warmMessage',
    name: '温暖系·寄语卡',
    category: 'teaching',
    description: '90×60 mm 寄语卡，信纸横线 + 邮票角饰，老师给学生的期末寄语一人一句暖心话。',
    scenario: '手写风寄语卡片',
    accent: '#f59e0b',
    sampleData: { name: '致 江晓白', message: '愿你眼里有光，脚下有路，一路生花。', from: '—— 班主任 林老师' },
    label: decorLabel(
      90,
      60,
      svg(
        90,
        60,
        '<rect x="0" y="0" width="90" height="60" fill="#fffdf8"/>' +
          '<rect x="0.4" y="0.4" width="89.2" height="59.2" fill="none" stroke="#fbbf24" stroke-width="0.5"/>' +
          '<g stroke="#fde68a" stroke-width="0.35"><path d="M10 28 h70"/><path d="M10 36 h70"/><path d="M10 44 h70"/></g>' +
          '<rect x="76" y="5" width="9" height="11" fill="none" stroke="#fda4af" stroke-width="0.4" stroke-dasharray="1 0.8"/>',
      ),
    ),
    page: gridPage('A4', 2, 4, 90, 60, 8, 6),
    fields: [
      text('name', '收信人', { x: 8, y: 7, width: 62, height: 10 }, '致 江晓白', {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#92400e',
        align: 'left',
      }),
      text('message', '寄语', { x: 10, y: 23, width: 70, height: 24 }, '愿你眼里有光，脚下有路，一路生花。', {
        fontSize: 9,
        color: '#78350f',
        align: 'left',
        maxLines: 3,
        lineHeight: 1.7,
        verticalAlign: 'top',
      }),
      text('from', '署名', { x: 10, y: 50, width: 70, height: 7 }, '—— 班主任 林老师', {
        fontSize: 7,
        color: INK_MUTED,
        align: 'right',
      }),
    ],
  },
  // ================= 复古证书系列 =================
  {
    ...base,
    id: 'retroAwardSeat',
    name: '复古系·颁奖席签',
    category: 'event',
    description: '180×90 mm 席签，米色底双线花框与桂枝角饰，获奖人姓名大字 + 奖项名，典礼仪式感。',
    scenario: '复古证书风颁奖席',
    accent: '#8a6d3b',
    sampleData: { name: '穆清和', award: '年度杰出贡献奖' },
    label: decorLabel(
      180,
      90,
      svg(
        180,
        90,
        '<rect x="0" y="0" width="180" height="90" fill="#fdfaf3"/>' +
          '<rect x="4" y="4" width="172" height="82" fill="none" stroke="#8a6d3b" stroke-width="0.8"/>' +
          '<rect x="7" y="7" width="166" height="76" fill="none" stroke="#8a6d3b" stroke-width="0.3"/>' +
          '<g stroke="#8a6d3b" stroke-width="0.4" fill="none" opacity="0.85">' +
          '<path d="M14 45 q6 -10 0 -20 M14 45 q-2 -8 4 -14 M14 45 q6 10 0 20 M14 45 q-2 8 4 14"/>' +
          '<path d="M166 45 q-6 -10 0 -20 M166 45 q2 -8 -4 -14 M166 45 q-6 10 0 20 M166 45 q2 8 -4 14"/></g>',
      ),
    ),
    page: gridPage('A4', 1, 3, 180, 90, 0, 5),
    fields: [
      fixed('cap', '标注', { x: 25, y: 13, width: 130, height: 8 }, 'AWARD · 荣誉表彰', {
        fontSize: 8,
        color: '#8a6d3b',
        letterSpacing: 0.4,
      }),
      text('name', '姓名', { x: 25, y: 26, width: 130, height: 32 }, '穆清和', {
        fontSize: 40,
        fontWeight: 'bold',
        color: '#3f3222',
        emphasis: 'hero',
        letterSpacing: 0.2,
      }),
      text('award', '奖项', { x: 25, y: 64, width: 130, height: 11 }, '年度杰出贡献奖', {
        fontSize: 12,
        color: '#8a6d3b',
        letterSpacing: 0.25,
      }),
    ],
  },
  {
    ...base,
    id: 'retroHonorCard',
    name: '复古系·荣誉桌牌',
    category: 'event',
    description: '140×90 mm 桌牌，牛皮纸色绶带徽章角饰 + 细线框，表彰会先进个人桌牌沉稳有分量。',
    scenario: '复古证书风表彰会',
    accent: '#8a6d3b',
    sampleData: { name: '柏景行', honor: '三十年工龄 · 匠心传承奖' },
    label: decorLabel(
      140,
      90,
      svg(
        140,
        90,
        '<rect x="0" y="0" width="140" height="90" fill="#faf6ec"/>' +
          '<rect x="4" y="4" width="132" height="82" fill="none" stroke="#8a6d3b" stroke-width="0.6"/>' +
          '<circle cx="120" cy="18" r="6" fill="none" stroke="#8a6d3b" stroke-width="0.5"/>' +
          '<circle cx="120" cy="18" r="4" fill="none" stroke="#8a6d3b" stroke-width="0.3"/>' +
          '<path d="M117 23 L115 31 L120 28 L125 31 L123 23" fill="none" stroke="#8a6d3b" stroke-width="0.4"/>',
      ),
    ),
    page: gridPage('A4', 1, 3, 140, 90, 0, 8),
    fields: [
      text('name', '姓名', { x: 12, y: 24, width: 116, height: 28 }, '柏景行', {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#3f3222',
        emphasis: 'hero',
        letterSpacing: 0.2,
      }),
      text('honor', '荣誉', { x: 12, y: 58, width: 116, height: 11 }, '三十年工龄 · 匠心传承奖', {
        fontSize: 11,
        color: '#8a6d3b',
      }),
    ],
  },
  {
    ...base,
    id: 'retroCertLabel',
    name: '复古系·证书姓名标签',
    category: 'teaching',
    description: '90×55 mm 标签，米底双线框 + 中缝丝带结，获奖学生姓名与奖项，贴证书袋奖品盒。',
    scenario: '复古证书风奖品标签',
    accent: '#8a6d3b',
    sampleData: { name: '尹初晴', award: '校园书香少年 · 一等奖' },
    label: decorLabel(
      90,
      55,
      svg(
        90,
        55,
        '<rect x="0" y="0" width="90" height="55" fill="#fdfaf3"/>' +
          '<rect x="3" y="3" width="84" height="49" fill="none" stroke="#8a6d3b" stroke-width="0.6"/>' +
          '<rect x="5" y="5" width="80" height="45" fill="none" stroke="#8a6d3b" stroke-width="0.25"/>' +
          '<path d="M45 3 l-3 5 h6 Z" fill="#8a6d3b" opacity="0.8"/>',
      ),
    ),
    page: gridPage('A4', 2, 4, 90, 55, 8, 6),
    fields: [
      text('name', '姓名', { x: 10, y: 13, width: 70, height: 18 }, '尹初晴', {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#3f3222',
        emphasis: 'hero',
      }),
      text('award', '奖项', { x: 10, y: 36, width: 70, height: 9 }, '校园书香少年 · 一等奖', {
        fontSize: 8.5,
        color: '#8a6d3b',
      }),
    ],
  },
  // ================= 森系自然系列 =================
  {
    ...base,
    id: 'forestWedPlace',
    name: '森系·婚礼席位卡',
    category: 'wedding',
    description: '90×55 mm 席位卡，橄榄绿枝叶线描环抱姓名，森系户外婚礼与草坪晚宴清新雅致。',
    scenario: '森系婚礼席位卡',
    accent: '#4d7c0f',
    sampleData: { name: '阮青栀 小姐', tableNo: '橄榄桌' },
    label: decorLabel(
      90,
      55,
      svg(
        90,
        55,
        '<rect x="0" y="0" width="90" height="55" fill="#fbfdf7"/>' +
          '<rect x="0.4" y="0.4" width="89.2" height="54.2" fill="none" stroke="#4d7c0f" stroke-width="0.4"/>' +
          '<g stroke="#4d7c0f" stroke-width="0.4" fill="none" opacity="0.9">' +
          '<path d="M8 12 q14 -6 28 -2"/><path d="M12 11 q0 -3 -2 -4 M17 9.5 q0 -3 -2 -4 M22 8.8 q1 -3 -1 -4.5 M28 8.6 q1 -3 -1 -4.5"/>' +
          '<path d="M82 43 q-14 6 -28 2"/><path d="M78 44 q0 3 2 4 M73 45.5 q0 3 2 4 M68 46.2 q-1 3 1 4.5 M62 46.4 q-1 3 1 4.5"/></g>',
      ),
    ),
    page: gridPage('A4', 2, 4, 90, 55, 8, 6),
    fields: [
      text('name', '姓名', { x: 10, y: 17, width: 70, height: 17 }, '阮青栀 小姐', {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#365314',
        emphasis: 'hero',
      }),
      text('tableNo', '桌号', { x: 10, y: 37, width: 70, height: 8 }, '橄榄桌', {
        fontSize: 8.5,
        color: '#4d7c0f',
      }),
    ],
  },
  {
    ...base,
    id: 'forestPlantTag',
    name: '森系·植物铭牌',
    category: 'life',
    description: '70×45 mm 铭牌，叶脉角饰 + 学名俗名双行与养护要点，植物园研学与阳台花园都好用。',
    scenario: '森系植物铭牌',
    accent: '#4d7c0f',
    sampleData: { plant: '鹤望兰', latin: 'Strelitzia reginae', care: '喜光 · 盆土见干见湿' },
    label: decorLabel(
      70,
      45,
      svg(
        70,
        45,
        '<rect x="0" y="0" width="70" height="45" fill="#fbfdf7"/>' +
          '<rect x="0.4" y="0.4" width="69.2" height="44.2" fill="none" stroke="#4d7c0f" stroke-width="0.4"/>' +
          '<g stroke="#4d7c0f" stroke-width="0.35" fill="none" opacity="0.9">' +
          '<path d="M6 40 q6 -12 16 -16 M8 36 q3 0 5 2 M10 31.5 q3 0 5 2 M13 27.5 q3 0 5 2"/></g>',
      ),
    ),
    page: gridPage('A4', 2, 5, 70, 45, 6, 4),
    fields: [
      text('plant', '植物名', { x: 6, y: 6, width: 58, height: 14 }, '鹤望兰', {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#365314',
        emphasis: 'hero',
      }),
      text('latin', '学名', { x: 6, y: 22, width: 58, height: 7 }, 'Strelitzia reginae', {
        fontSize: 6.5,
        color: INK_MUTED,
      }),
      text('care', '养护', { x: 6, y: 32, width: 58, height: 8 }, '喜光 · 盆土见干见湿', {
        fontSize: 7,
        color: '#4d7c0f',
      }),
    ],
  },
]
