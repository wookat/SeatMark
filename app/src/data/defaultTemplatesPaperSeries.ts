import type { LabelSpec, LabelTemplate } from '@/types/template'

import { DEFAULT_FONT_STACK, DEFAULT_FONT_STACK_EN } from './fonts'
import { findLabelPaper } from './labelPapers'
import { fixed, hairline, INK, INK_FAINT, INK_MUTED, INK_SOFT, text } from './templateFactory'
import { paperLabelForTemplate, paperPageForTemplate } from '@/utils/labelPaper'

/**
 * 纸型专用模板系列：
 * 每款模板的 label/page 几何由 labelPapers 中的纸型规格直接生成
 * （单格尺寸、行列、间距、边距与实物模切严格一致），配合
 * designedForPaper 字段在纸型详情页、模板选择器里做双向标记。
 * 市场调研对应的用途覆盖：公告门贴、区域指示、收纳箱贴、
 * 考场座贴、姓名贴、物品标签、价签、调料/日期贴、档案脊贴、
 * 圆形封口贴、地址/运输标签与对折桌牌席卡。
 */

const FONT = DEFAULT_FONT_STACK
const FONT_EN = DEFAULT_FONT_STACK_EN

const base = {
  builtin: true as const,
  fontFamily: FONT,
  fontFamilyEn: FONT_EN,
  showLabelBorder: false,
}

const svg = (w: number, h: number, body: string) =>
  `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${body}</svg>`

function spec(slug: string) {
  const s = findLabelPaper(slug)
  if (!s) throw new Error(`defaultTemplatesPaperSeries: 未知纸型 ${slug}`)
  return s
}

/** 纸型专用模板构造：几何随纸型库规格生成，规格修订自动生效。
 * rotated=true 生成横向进纸版式（纸型旋转 90°，单格宽高互换） */
function pp(
  paperSlug: string,
  template: Omit<
    LabelTemplate,
    'label' | 'page' | 'designedForPaper' | keyof typeof base
  >,
  labelExtra: Partial<LabelSpec> = {},
  rotated = false,
): LabelTemplate {
  const s = spec(paperSlug)
  return {
    ...base,
    ...template,
    designedForPaper: paperSlug,
    label: {
      borderWidth: 0,
      background: '#ffffff',
      ...paperLabelForTemplate(s, rotated),
      ...labelExtra,
    },
    page: paperPageForTemplate(s, rotated),
  }
}

export const paperSeriesTemplates: LabelTemplate[] = [
  // ================= 整版 / 大格 =================
  pp('a4-1up', {
    id: 'ppNoticeA4',
    name: '整版·温馨提示告示贴',
    category: 'life',
    description: '210×297 mm 整版背胶，大标题配多行正文与落款，适合公告栏、教室门与电梯间告示。',
    scenario: 'A4 整版不干胶专用',
    accent: '#b45309',
    sampleData: {
      title: '图书漂流角启用通知',
      body: '本周五起三楼图书漂流角正式开放，请借阅的同学登记姓名与班级，每次限借两本，两周内归还。',
      org: '三年级组 宣',
    },
    fields: [
      text('title', '标题', { x: 14, y: 34, width: 182, height: 26 }, '图书漂流角启用通知', {
        fontSize: 27,
        fontWeight: 'bold',
        align: 'left',
        emphasis: 'hero',
      }),
      text('body', '正文', { x: 14, y: 72, width: 182, height: 168 }, '本周五起三楼图书漂流角正式开放，请借阅的同学登记姓名与班级，每次限借两本，两周内归还。', {
        fontSize: 12,
        color: INK_SOFT,
        align: 'left',
        verticalAlign: 'top',
        maxLines: 11,
        lineHeight: 1.7,
      }),
      text('org', '落款', { x: 14, y: 256, width: 182, height: 12 }, '三年级组 宣', {
        fontSize: 11,
        color: INK_MUTED,
        align: 'right',
      }),
    ],
  }, {
    decorSvg: svg(
      210,
      297,
      '<rect x="0" y="0" width="210" height="14" fill="#b45309"/>' +
        '<rect x="14" y="64" width="182" height="0.5" fill="#d6d3d1"/>' +
        '<rect x="14" y="246" width="182" height="0.35" fill="#e7e5e4"/>',
    ),
  }),
  pp('a4-1up', {
    id: 'ppPosterA4',
    name: '整版·考场公示海报',
    category: 'exam',
    description: '210×297 mm 整版背胶，考场号超大字 + 科目时间 + 考生须知，撕下即贴考场门口。',
    scenario: 'A4 整版不干胶专用',
    accent: '#1d4ed8',
    sampleData: { room: '第 03 考场', subject: '数学 9:00–11:00', note: '请考生提前 15 分钟入场，对号入座；手机等电子设备关机后交监考员统一保管。' },
    demoDataset: 'exam',
    fields: [
      fixed('cap', '眉题', { x: 20, y: 20, width: 170, height: 10 }, '考场公示 · EXAM NOTICE', {
        fontSize: 10,
        color: INK_MUTED,
        letterSpacing: 0.3,
      }),
      text('room', '考场', { x: 20, y: 42, width: 170, height: 52 }, '第 03 考场', {
        fontSize: 52,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('subject', '科目时间', { x: 20, y: 102, width: 170, height: 18 }, '数学 9:00–11:00', {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1d4ed8',
      }),
      text('note', '考生须知', { x: 20, y: 136, width: 170, height: 110 }, '请考生提前 15 分钟入场，对号入座；手机等电子设备关机后交监考员统一保管。', {
        fontSize: 11,
        color: INK_SOFT,
        align: 'left',
        verticalAlign: 'top',
        maxLines: 8,
        lineHeight: 1.7,
      }),
    ],
  }, {
    decorSvg: svg(
      210,
      297,
      '<rect x="0" y="0" width="210" height="10" fill="#1d4ed8"/>' +
        '<rect x="20" y="126" width="170" height="0.5" fill="#bfdbfe"/>' +
        '<rect x="20" y="252" width="170" height="0.5" fill="#bfdbfe"/>',
    ),
  }),
  pp('a3-1up', {
    id: 'ppZoneA3',
    name: 'A3 整版·公示大海报',
    category: 'life',
    description: '297×420 mm A3 整版背胶，大标题配分栏正文与落款，适合大厅公示栏与活动背景板。',
    scenario: 'A3 整版不干胶专用',
    accent: '#0f766e',
    sampleData: {
      title: '社区运动会安排',
      body: '周六上午九点在社区广场集合，请先在各楼栋领队处签到，按号码布分组入场；自带水杯，注意防晒。',
      org: '社区居委会',
    },
    fields: [
      text('title', '标题', { x: 22, y: 48, width: 253, height: 40 }, '社区运动会安排', {
        fontSize: 42,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('body', '正文', { x: 22, y: 108, width: 253, height: 220 }, '周六上午九点在社区广场集合，请先在各楼栋领队处签到，按号码布分组入场；自带水杯，注意防晒。', {
        fontSize: 15,
        color: INK_SOFT,
        align: 'left',
        verticalAlign: 'top',
        maxLines: 11,
        lineHeight: 1.8,
      }),
      text('org', '落款', { x: 22, y: 356, width: 253, height: 16 }, '社区居委会', {
        fontSize: 14,
        color: INK_MUTED,
        align: 'right',
      }),
    ],
  }, {
    decorSvg: svg(
      297,
      420,
      '<rect x="0" y="0" width="297" height="18" fill="#0f766e"/>' +
        '<rect x="22" y="96" width="253" height="0.6" fill="#99f6e4"/>' +
        '<rect x="22" y="342" width="253" height="0.4" fill="#ccfbf1"/>',
    ),
  }),
  pp('a5-1up', {
    id: 'ppNoticeA5',
    name: 'A5 整版·提示告示贴',
    category: 'life',
    description: '148×210 mm A5 整版背胶，标题、短正文与落款齐全，适合设备旁、前台与小型公告位。',
    scenario: 'A5 整版不干胶专用',
    accent: '#b45309',
    sampleData: { title: '设备使用提示', body: '使用前请先登记，用后及时归位；耗材将尽请告知管理员补充。', org: '行政部' },
    fields: [
      text('title', '标题', { x: 12, y: 26, width: 124, height: 20 }, '设备使用提示', {
        fontSize: 21,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('body', '正文', { x: 12, y: 56, width: 124, height: 104 }, '使用前请先登记，用后及时归位；耗材将尽请告知管理员补充。', {
        fontSize: 10.5,
        color: INK_SOFT,
        align: 'left',
        verticalAlign: 'top',
        maxLines: 9,
        lineHeight: 1.65,
      }),
      text('org', '落款', { x: 12, y: 176, width: 124, height: 10 }, '行政部', {
        fontSize: 9.5,
        color: INK_MUTED,
        align: 'right',
      }),
    ],
  }, {
    decorSvg: svg(
      148,
      210,
      '<rect x="0" y="0" width="148" height="10" fill="#b45309"/>' +
        '<rect x="12" y="50" width="124" height="0.45" fill="#e7e5e4"/>',
    ),
  }),
  pp('a4-2up', {
    id: 'ppZoneA4x2',
    name: '对开·会场分区指示牌',
    category: 'event',
    description: '210×148.5 mm 对开大格，区域名超大字 + 说明行，贴会场入口、分会场门与签到桌。',
    scenario: 'A4 对开不干胶专用',
    accent: '#7c3aed',
    sampleData: { zone: 'A 区 · 签到处', desc: '请持参会证在此排队签到' },
    demoDataset: 'expo',
    fields: [
      text('zone', '区域', { x: 14, y: 44, width: 182, height: 44 }, 'A 区 · 签到处', {
        fontSize: 44,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('desc', '说明', { x: 14, y: 100, width: 182, height: 16 }, '请持参会证在此排队签到', {
        fontSize: 13,
        color: INK_SOFT,
      }),
      fixed('foot', '底部注', { x: 14, y: 128, width: 182, height: 8 }, '请听从现场工作人员引导', {
        fontSize: 8,
        color: INK_FAINT,
      }),
    ],
  }, {
    decorSvg: svg(
      210,
      148.5,
      '<rect x="0" y="0" width="210" height="12" fill="#7c3aed"/>' +
        '<rect x="14" y="122" width="182" height="0.5" fill="#ddd6fe"/>',
    ),
  }),
  pp('a4-4up', {
    id: 'ppDoorSign4',
    name: '四分·班级门牌',
    category: 'teaching',
    description: '105×148.5 mm 四分格，班级名大字配班主任与口号，贴教室前门或活动室门口。',
    scenario: 'A4 四分格不干胶专用',
    accent: '#0369a1',
    sampleData: { className: '三年级（2）班', teacher: '班主任：李华', motto: '团结 勤奋 求实 创新' },
    demoDataset: 'classroom',
    fields: [
      text('className', '班级', { x: 9, y: 40, width: 87, height: 34 }, '三年级（2）班', {
        fontSize: 30,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('teacher', '班主任', { x: 9, y: 82, width: 87, height: 14 }, '班主任：李华', {
        fontSize: 12,
        color: INK_SOFT,
      }),
      text('motto', '班级口号', { x: 9, y: 104, width: 87, height: 12 }, '团结 勤奋 求实 创新', {
        fontSize: 9.5,
        color: INK_MUTED,
        letterSpacing: 0.2,
      }),
    ],
  }, {
    decorSvg: svg(
      105,
      148.5,
      '<rect x="0" y="0" width="105" height="10" fill="#0369a1"/>' +
        '<rect x="9" y="98" width="87" height="0.4" fill="#bae6fd"/>',
    ),
  }),

  // ================= 横条 / 竖条 =================
  pp('a4-5up', {
    id: 'ppShelfStrip',
    name: '横条·货架类目标签',
    category: 'life',
    description: '192×54 mm 横条格，类目名大字配编号，贴货架层板、库房分区与展柜。',
    scenario: 'A4 横条不干胶专用',
    accent: '#334155',
    sampleData: { cat: '文具区', code: 'B-03' },
    demoDataset: 'asset',
    fields: [
      text('cat', '类目', { x: 10, y: 12, width: 120, height: 30 }, '文具区', {
        fontSize: 28,
        fontWeight: 'bold',
        align: 'left',
        emphasis: 'hero',
      }),
      text('code', '编号', { x: 138, y: 16, width: 44, height: 22 }, 'B-03', {
        fontSize: 17,
        fontWeight: 'bold',
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(192, 54, '<rect x="0" y="48" width="192" height="6" fill="#334155"/>'),
  }),
  pp('a4-6up-strip', {
    id: 'ppDrawerStrip',
    name: '横条·抽屉层板标签',
    category: 'life',
    description: '210×48 mm 宽横条，名称居左 + 编号居右，贴抽屉面板、层板前沿与文件架。',
    scenario: 'A4 横条不干胶专用',
    accent: '#334155',
    sampleData: { item: '办公耗材', code: 'D-12' },
    demoDataset: 'asset',
    fields: [
      text('item', '物品名', { x: 12, y: 11, width: 130, height: 26 }, '办公耗材', {
        fontSize: 24,
        fontWeight: 'bold',
        align: 'left',
        emphasis: 'hero',
      }),
      text('code', '编号', { x: 160, y: 14, width: 38, height: 20 }, 'D-12', {
        fontSize: 15,
        fontWeight: 'bold',
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(210, 48, '<rect x="150" y="9" width="0.5" height="30" fill="#cbd5e1"/>'),
  }),
  pp('a4-8up-spine', {
    id: 'ppSpine120',
    name: '竖条·档案脊贴',
    category: 'life',
    description: '40×120 mm 竖条格，类目 / 年度 / 编号自上而下排列，贴档案盒与文件夹脊背。',
    scenario: 'A4 竖条不干胶专用',
    accent: '#44403c',
    sampleData: { cat: '财务凭证', year: '2025', code: 'CW-018' },
    demoDataset: 'asset',
    fields: [
      text('cat', '类目', { x: 4, y: 10, width: 32, height: 52 }, '财务凭证', {
        fontSize: 11,
        fontWeight: 'bold',
        maxLines: 4,
        lineHeight: 1.25,
      }),
      text('year', '年度', { x: 4, y: 68, width: 32, height: 12 }, '2025', {
        fontSize: 10,
        color: INK_SOFT,
      }),
      text('code', '编号', { x: 4, y: 90, width: 32, height: 12 }, 'CW-018', {
        fontSize: 8.5,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(40, 120, '<rect x="4" y="64" width="32" height="0.4" fill="#d6d3d1"/><rect x="4" y="84" width="32" height="0.4" fill="#e7e5e4"/>'),
  }),

  // ================= 6 / 8 格：桌贴与物品标签 =================
  pp('a4-6up', {
    id: 'ppBinTag6',
    name: '六分·收纳箱标签',
    category: 'life',
    description: '105×99 mm 六分格，物品名大字 + 类别与编号，贴储物箱、玩具筐与库房周转箱。',
    scenario: 'A4 六分格不干胶专用',
    accent: '#0f766e',
    sampleData: { item: '冬季被褥', cat: '客房备品', code: 'BX-07' },
    demoDataset: 'asset',
    fields: [
      text('item', '物品名', { x: 10, y: 26, width: 85, height: 30 }, '冬季被褥', {
        fontSize: 26,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('cat', '类别', { x: 10, y: 62, width: 55, height: 12 }, '客房备品', {
        fontSize: 10,
        color: INK_SOFT,
      }),
      text('code', '编号', { x: 68, y: 60, width: 27, height: 14 }, 'BX-07', {
        fontSize: 11,
        fontWeight: 'bold',
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(105, 99, '<rect x="0" y="0" width="105" height="8" fill="#0f766e"/><rect x="10" y="80" width="85" height="0.4" fill="#99f6e4"/>'),
  }),
  pp('a4-8up', {
    id: 'ppExamDesk8',
    name: '八分·大字考场桌贴',
    category: 'exam',
    description: '105×74.25 mm 八分格，座位号反白超大字 + 姓名与考场，贴课桌角一眼可辨。',
    scenario: 'A4 八分格不干胶专用',
    accent: '#111827',
    sampleData: { seatNo: '18', name: '孙晓东', room: '第 03 考场' },
    demoDataset: 'exam',
    fields: [
      text('seatNo', '座位号', { x: 72, y: 14, width: 29, height: 46 }, '18', {
        fontSize: 40,
        fontWeight: 'bold',
        color: '#ffffff',
        emphasis: 'hero',
      }),
      text('name', '姓名', { x: 8, y: 16, width: 60, height: 24 }, '孙晓东', {
        fontSize: 20,
        fontWeight: 'bold',
        align: 'left',
      }),
      text('room', '考场', { x: 8, y: 46, width: 60, height: 10 }, '第 03 考场', {
        fontSize: 9,
        color: INK_MUTED,
        align: 'left',
      }),
    ],
  }, {
    decorSvg: svg(105, 74.25, '<rect x="70" y="0" width="35" height="74.25" fill="#111827"/>'),
  }),
  pp('a4-8up-round', {
    id: 'ppItemTag8r',
    name: '圆角·班级物品标签',
    category: 'teaching',
    description: '99.1×67.7 mm 圆角八格，物品名大字 + 归属班级与数量，贴教具箱、图书角与运动器材。',
    scenario: 'A4 圆角八格不干胶专用',
    accent: '#0d9488',
    sampleData: { item: '跳绳', className: '中一班', qty: '×30' },
    demoDataset: 'classroom',
    fields: [
      text('item', '物品名', { x: 8, y: 16, width: 83, height: 26 }, '跳绳', {
        fontSize: 24,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('className', '班级', { x: 8, y: 48, width: 50, height: 10 }, '中一班', {
        fontSize: 9.5,
        color: INK_SOFT,
      }),
      text('qty', '数量', { x: 66, y: 46, width: 25, height: 12 }, '×30', {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#0d9488',
      }),
    ],
  }, {
    decorSvg: svg(
      99.1,
      67.7,
      '<rect x="4" y="4" width="91.1" height="59.7" rx="4" fill="none" stroke="#0d9488" stroke-width="0.5"/>' +
        '<rect x="8" y="44" width="83" height="0.35" fill="#99f6e4"/>',
    ),
  }),
  pp('a4-8up-round-90', {
    id: 'ppProductTag8r90',
    name: '圆角·产品信息标签',
    category: 'life',
    description: '90×72 mm 圆角八格，品名、规格、生产日期与售价分区排布，适合手工产品与散装商品贴。',
    scenario: 'A4 圆角八格不干胶专用',
    accent: '#b45309',
    sampleData: { item: '手工曲奇', spec: '200g/盒', date: '2026-03-01', price: '¥28.00' },
    demoDataset: 'retail',
    fields: [
      text('item', '品名', { x: 7, y: 10, width: 76, height: 20 }, '手工曲奇', {
        fontSize: 18,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('spec', '规格', { x: 7, y: 33, width: 48, height: 9 }, '200g/盒', {
        fontSize: 8,
        color: INK_MUTED,
        align: 'left',
      }),
      text('date', '生产日期', { x: 7, y: 45, width: 48, height: 9 }, '2026-03-01', {
        fontSize: 8,
        color: INK_MUTED,
        align: 'left',
      }),
      text('price', '售价', { x: 58, y: 42, width: 27, height: 18 }, '¥28.00', {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#b45309',
      }),
    ],
  }, {
    decorSvg: svg(90, 72, '<rect x="4" y="4" width="82" height="64" rx="4" fill="none" stroke="#b45309" stroke-width="0.5"/><rect x="7" y="30" width="76" height="0.3" fill="#e7e5e4"/>'),
  }),

  // ================= 10 / 12 格：价签 / 名牌 / 文件与物品 =================
  pp('a4-10up', {
    id: 'ppPriceTag10',
    name: '满切·商品价格签',
    category: 'life',
    description: '105×59.4 mm 十分格，品名 + 大字售价 + 规格单位，贴货架、展柜与市集摊位。',
    scenario: 'A4 十分格不干胶专用',
    accent: '#b91c1c',
    sampleData: { item: '有机番茄', price: '¥12.80', spec: '500g/份' },
    demoDataset: 'retail',
    fields: [
      text('item', '品名', { x: 8, y: 8, width: 89, height: 14 }, '有机番茄', {
        fontSize: 12,
        fontWeight: 'bold',
        align: 'left',
      }),
      text('price', '价格', { x: 8, y: 26, width: 60, height: 24 }, '¥12.80', {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#b91c1c',
        align: 'left',
        emphasis: 'hero',
      }),
      text('spec', '规格', { x: 72, y: 34, width: 25, height: 10 }, '500g/份', {
        fontSize: 7.5,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(105, 59.4, '<rect x="8" y="23" width="89" height="0.4" fill="#e7e5e4"/>'),
  }),
  pp('a4-10up-round', {
    id: 'ppNameCard10r',
    name: '圆角·姓名大卡贴',
    category: 'event',
    description: '99.1×57.7 mm 圆角十格，姓名大字配单位职务，作签到贴纸名牌或席位平卡。',
    scenario: 'A4 圆角十格不干胶专用',
    accent: '#1d4ed8',
    sampleData: { name: '吴建平', org: '远见设计事务所', title: '创始合伙人' },
    demoDataset: 'meeting',
    fields: [
      fixed('cap', '眉题', { x: 8, y: 6, width: 83, height: 8 }, '你好，我是', {
        fontSize: 7.5,
        color: '#ffffff',
        letterSpacing: 0.25,
      }),
      text('name', '姓名', { x: 8, y: 16, width: 83, height: 24 }, '吴建平', {
        fontSize: 22,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('org', '单位', { x: 8, y: 42, width: 55, height: 9 }, '远见设计事务所', {
        fontSize: 8,
        color: INK_SOFT,
        align: 'left',
      }),
      text('title', '职务', { x: 66, y: 42, width: 25, height: 9 }, '创始合伙人', {
        fontSize: 7.5,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(99.1, 57.7, '<rect x="0" y="0" width="99.1" height="12" rx="6" fill="#1d4ed8"/>'),
  }),
  pp('a4-12up', {
    id: 'ppFileBox12',
    name: '满切·文件盒标签',
    category: 'life',
    description: '105×49.5 mm 十二格，类别、年度、编号三段式，贴文件盒侧面与资料袋。',
    scenario: 'A4 十二格不干胶专用',
    accent: '#334155',
    sampleData: { cat: '合同档案', year: '2025', code: 'HT-1024' },
    demoDataset: 'asset',
    fields: [
      text('cat', '类别', { x: 8, y: 8, width: 89, height: 18 }, '合同档案', {
        fontSize: 16,
        fontWeight: 'bold',
        align: 'left',
        emphasis: 'hero',
      }),
      text('year', '年度', { x: 8, y: 30, width: 30, height: 10 }, '2025', {
        fontSize: 9,
        color: INK_SOFT,
        align: 'left',
      }),
      text('code', '编号', { x: 60, y: 28, width: 37, height: 12 }, 'HT-1024', {
        fontSize: 10,
        fontWeight: 'bold',
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(105, 49.5, '<rect x="0" y="0" width="4" height="49.5" fill="#334155"/>'),
  }),
  pp('a4-12up-3x4', {
    id: 'ppCubbyTag12',
    name: '方格·班级物品筐标签',
    category: 'teaching',
    description: '70×67.7 mm 方格，物品名居中大字配归属班级，贴学具筐、美工区与图书角。',
    scenario: 'A4 方格不干胶专用',
    accent: '#0d9488',
    sampleData: { item: '水彩笔', className: '中一班' },
    demoDataset: 'classroom',
    fields: [
      text('item', '物品名', { x: 7, y: 20, width: 56, height: 24 }, '水彩笔', {
        fontSize: 21,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('className', '班级', { x: 7, y: 50, width: 56, height: 9 }, '中一班', {
        fontSize: 8.5,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(
      70,
      67.7,
      '<rect x="5" y="5" width="60" height="57.7" rx="5" fill="none" stroke="#0d9488" stroke-width="0.5"/>' +
        '<rect x="7" y="46" width="56" height="0.3" fill="#99f6e4"/>',
    ),
  }),
  pp('a4-12up-narrow', {
    id: 'ppBookLabel12n',
    name: '窄条·图书分类标签',
    category: 'teaching',
    description: '96.5×42.3 mm 窄格，分类号 + 书名 + 架位，贴班级图书角与资料室书脊底。',
    scenario: 'A4 窄条不干胶专用',
    accent: '#0f766e',
    sampleData: { callNo: 'I287.5', title: '草房子', shelf: 'B3-2' },
    demoDataset: 'asset',
    fields: [
      text('callNo', '分类号', { x: 7, y: 7, width: 34, height: 12 }, 'I287.5', {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#0f766e',
        align: 'left',
      }),
      text('title', '书名', { x: 44, y: 6, width: 45, height: 14 }, '草房子', {
        fontSize: 12,
        fontWeight: 'bold',
        align: 'left',
      }),
      text('shelf', '架位', { x: 7, y: 26, width: 82, height: 9 }, 'B3-2', {
        fontSize: 7.5,
        color: INK_MUTED,
        align: 'left',
      }),
    ],
  }, {
    decorSvg: svg(96.5, 42.3, '<rect x="7" y="21" width="82" height="0.3" fill="#99f6e4"/>'),
  }),

  // ================= 14–24 格：姓名贴 / 座贴 / 日期标签 =================
  pp('a4-14up-round', {
    id: 'ppNameSticker14r',
    name: '圆角·横版姓名贴',
    category: 'kids',
    description: '99.1×38.1 mm 圆角横贴，姓名大字 + 班级，贴课本封面、水杯与储物柜。',
    scenario: 'A4 圆角十四格不干胶专用',
    accent: '#db2777',
    sampleData: { name: '王小明', className: '中一班' },
    demoDataset: 'kindergarten',
    fields: [
      text('name', '姓名', { x: 8, y: 8, width: 56, height: 22 }, '王小明', {
        fontSize: 19,
        fontWeight: 'bold',
        align: 'left',
        emphasis: 'hero',
      }),
      text('className', '班级', { x: 66, y: 16, width: 26, height: 10 }, '中一班', {
        fontSize: 8.5,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(99.1, 38.1, '<rect x="0" y="30" width="99.1" height="8.1" rx="4" fill="#fce7f3"/><rect x="8" y="32.5" width="83" height="0.3" fill="#f9a8d4"/>'),
  }),
  pp('a4-16up-round', {
    id: 'ppKidsName16r',
    name: '圆角·班级姓名贴',
    category: 'kids',
    description: '99.1×33.8 mm 圆角十六格，左侧色块 + 姓名与班级，贴文具盒与幼儿物品。',
    scenario: 'A4 圆角十六格不干胶专用',
    accent: '#0d9488',
    sampleData: { name: '李小禾', className: '大二班' },
    demoDataset: 'kindergarten',
    fields: [
      text('name', '姓名', { x: 22, y: 6, width: 70, height: 14 }, '李小禾', {
        fontSize: 13,
        fontWeight: 'bold',
        align: 'left',
        emphasis: 'hero',
      }),
      text('className', '班级', { x: 22, y: 22, width: 70, height: 7 }, '大二班', {
        fontSize: 7,
        color: INK_MUTED,
        align: 'left',
      }),
    ],
  }, {
    decorSvg: svg(99.1, 33.8, '<rect x="6" y="6" width="12" height="21.8" rx="3" fill="#0d9488"/><circle cx="12" cy="16.9" r="3.4" fill="#ffffff"/>'),
  }),
  pp('a4-18up-round', {
    id: 'ppSpice18r',
    name: '圆角·调料罐标签',
    category: 'life',
    description: '63.5×46.6 mm 圆角格，品名、开封日期与备注，贴调料瓶罐与自制食品。',
    scenario: 'A4 圆角十八格不干胶专用',
    accent: '#a16207',
    sampleData: { item: '花椒粉', date: '2026-03-01', note: '开封后密封保存' },
    fields: [
      text('item', '品名', { x: 6, y: 8, width: 51.5, height: 14 }, '花椒粉', {
        fontSize: 13,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('date', '开封日期', { x: 6, y: 26, width: 51.5, height: 8 }, '2026-03-01', {
        fontSize: 6.5,
        color: INK_MUTED,
      }),
      text('note', '备注', { x: 6, y: 36, width: 51.5, height: 7 }, '开封后密封保存', {
        fontSize: 5.8,
        color: INK_FAINT,
      }),
    ],
  }, {
    decorSvg: svg(63.5, 46.6, '<rect x="4" y="4" width="55.5" height="38.6" rx="4" fill="none" stroke="#a16207" stroke-width="0.4"/><rect x="6" y="24" width="51.5" height="0.25" fill="#e7e5e4"/>'),
  }),
  pp('a4-21up', {
    id: 'ppDeskName21',
    name: '满切·课桌姓名贴',
    category: 'teaching',
    description: '70×42.4 mm 二十一格，姓名大字 + 学号与班级，开学贴课桌与储物柜。',
    scenario: 'A4 二十一格不干胶专用',
    accent: '#0369a1',
    sampleData: { name: '陈果', stuNo: '20240115', className: '三（2）班' },
    demoDataset: 'classroom',
    fields: [
      text('name', '姓名', { x: 6, y: 8, width: 58, height: 18 }, '陈果', {
        fontSize: 16,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('stuNo', '学号', { x: 6, y: 29, width: 32, height: 8 }, '20240115', {
        fontSize: 7,
        color: INK_MUTED,
        align: 'left',
      }),
      text('className', '班级', { x: 44, y: 28, width: 20, height: 9 }, '三（2）班', {
        fontSize: 7,
        color: INK_SOFT,
      }),
    ],
  }, {
    decorSvg: svg(70, 42.4, '<rect x="6" y="26.5" width="58" height="0.3" fill="#bae6fd"/>'),
  }),
  pp('a4-21up-round', {
    id: 'ppExamSeat21r',
    name: '圆角·考场座贴',
    category: 'exam',
    description: '63.5×38.1 mm 圆角二十一格，座号反白 + 姓名考场，标准考试密排桌贴。',
    scenario: 'A4 圆角二十一格不干胶专用',
    accent: '#111827',
    sampleData: { seatNo: '12', name: '孙晓东', room: '第 03 考场' },
    demoDataset: 'exam',
    fields: [
      text('seatNo', '座位号', { x: 43, y: 6, width: 17.5, height: 26 }, '12', {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#ffffff',
        emphasis: 'hero',
      }),
      text('name', '姓名', { x: 5, y: 8, width: 36, height: 12 }, '孙晓东', {
        fontSize: 11,
        fontWeight: 'bold',
        align: 'left',
      }),
      text('room', '考场', { x: 5, y: 23, width: 36, height: 8 }, '第 03 考场', {
        fontSize: 6,
        color: INK_MUTED,
        align: 'left',
      }),
    ],
  }, {
    decorSvg: svg(63.5, 38.1, '<rect x="41" y="0" width="22.5" height="38.1" rx="3" fill="#111827"/>'),
  }),
  pp('a4-22up-round', {
    id: 'ppBakingDate22r',
    name: '圆角·烘焙日期标签',
    category: 'life',
    description: '96×25.5 mm 圆角窄格，品名 + 制作日期一行排开，贴烘焙包装与果酱瓶。',
    scenario: 'A4 圆角窄格不干胶专用',
    accent: '#a16207',
    sampleData: { item: '蔓越莓司康', date: '2026-03-01' },
    demoDataset: 'restaurant',
    fields: [
      text('item', '品名', { x: 7, y: 7, width: 50, height: 12 }, '蔓越莓司康', {
        fontSize: 10.5,
        fontWeight: 'bold',
        align: 'left',
      }),
      text('date', '制作日期', { x: 60, y: 8, width: 30, height: 10 }, '2026-03-01', {
        fontSize: 6.8,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(96, 25.5, '<rect x="56" y="5" width="0.35" height="15.5" fill="#d6d3d1"/><rect x="7" y="20" width="83" height="0.3" fill="#e7e5e4"/>'),
  }),
  pp('a4-24up-round', {
    id: 'ppNameSticker24r',
    name: '圆角·马卡龙姓名贴',
    category: 'kids',
    description: '63.5×33.9 mm 圆角二十四格，粉彩底纹衬托姓名班级，贴水杯、蜡笔盒与书包牌。',
    scenario: 'A4 圆角二十四格不干胶专用',
    accent: '#db2777',
    sampleData: { name: '王小明', className: '中一班' },
    demoDataset: 'kindergarten',
    fields: [
      text('name', '姓名', { x: 6, y: 8, width: 51.5, height: 14 }, '王小明', {
        fontSize: 13,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('className', '班级', { x: 6, y: 24, width: 51.5, height: 7 }, '中一班', {
        fontSize: 6.5,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(
      63.5,
      33.9,
      '<circle cx="6" cy="4" r="6" fill="#fce7f3"/><circle cx="58" cy="31" r="7" fill="#dbeafe"/>' +
        '<rect x="6" y="22" width="51.5" height="0.3" fill="#f9a8d4"/>',
    ),
  }),

  // ================= 40–65 小格：幼儿姓名贴 / 序号贴 =================
  pp('a4-40up', {
    id: 'ppKidsName40',
    name: '满切·幼儿姓名贴',
    category: 'kids',
    description: '52.5×29.7 mm 四十格，姓名 + 班级两行，贴文具、餐具与幼儿日用品。',
    scenario: 'A4 四十格不干胶专用',
    accent: '#0d9488',
    sampleData: { name: '王小明', className: '中一班' },
    demoDataset: 'kindergarten',
    fields: [
      text('name', '姓名', { x: 4, y: 6, width: 44.5, height: 12 }, '王小明', {
        fontSize: 11,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('className', '班级', { x: 4, y: 20, width: 44.5, height: 6 }, '中一班', {
        fontSize: 5.8,
        color: INK_MUTED,
      }),
    ],
  }),
  pp('a4-30up', {
    id: 'ppKidsName30',
    name: '满切·文具姓名贴',
    category: 'kids',
    description: '70×29.7 mm 三十格，姓名 + 班级两行紧凑排版，贴铅笔盒、尺子与课本角。',
    scenario: 'A4 三十格不干胶专用',
    accent: '#0d9488',
    sampleData: { name: '王小明', className: '中一班' },
    demoDataset: 'kindergarten',
    fields: [
      text('name', '姓名', { x: 5, y: 6, width: 60, height: 12 }, '王小明', {
        fontSize: 11,
        fontWeight: 'bold',
        align: 'left',
        emphasis: 'hero',
      }),
      text('className', '班级', { x: 5, y: 20, width: 60, height: 6 }, '中一班', {
        fontSize: 5.8,
        color: INK_MUTED,
        align: 'left',
      }),
    ],
  }),
  pp('a4-44up-round', {
    id: 'ppMiniName44r',
    name: '圆角·迷你姓名贴',
    category: 'kids',
    description: '48.5×25.4 mm 圆角小贴，纯姓名大字，贴铅笔、橡皮与小件文具。',
    scenario: 'A4 圆角迷你格不干胶专用',
    accent: '#db2777',
    sampleData: { name: '王小明' },
    demoDataset: 'kindergarten',
    fields: [
      text('name', '姓名', { x: 4, y: 6, width: 40.5, height: 13 }, '王小明', {
        fontSize: 10.5,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
    ],
  }, {
    decorSvg: svg(48.5, 25.4, '<circle cx="5.5" cy="12.7" r="2.2" fill="#f9a8d4"/><rect x="12" y="20.5" width="30" height="0.3" fill="#fbcfe8"/>'),
  }),
  pp('a4-48up-round', {
    id: 'ppPencilName48r',
    name: '圆角·文具铅笔贴',
    category: 'kids',
    description: '45.7×21.2 mm 圆角密排小贴，纯姓名一行，适合铅笔杆、蜡笔与细窄物品。',
    scenario: 'A4 圆角密排格不干胶专用',
    accent: '#0d9488',
    sampleData: { name: '王小明' },
    demoDataset: 'kindergarten',
    fields: [
      text('name', '姓名', { x: 3, y: 5, width: 39.7, height: 11 }, '王小明', {
        fontSize: 9.5,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
    ],
  }),
  pp('a4-56up', {
    id: 'ppSerial56',
    name: '满切·资产序号贴',
    category: 'life',
    description: '52.5×21.2 mm 五十六格密排，编号大字配类别小字，贴设备、图书与资产卡片。',
    scenario: 'A4 五十六格不干胶专用',
    accent: '#334155',
    sampleData: { code: 'ZC-0241', cat: '固定资产' },
    demoDataset: 'asset',
    fields: [
      text('code', '编号', { x: 4, y: 5, width: 44.5, height: 10 }, 'ZC-0241', {
        fontSize: 9.5,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('cat', '类别', { x: 4, y: 16, width: 44.5, height: 4.5 }, '固定资产', {
        fontSize: 4.8,
        color: INK_MUTED,
      }),
    ],
  }),
  pp('a4-65up-round', {
    id: 'ppKidsName65r',
    name: '圆角·防水姓名贴',
    category: 'kids',
    description: '38.1×21.2 mm 圆角小贴，纯姓名紧凑排版，适合防水款贴水杯与餐具。',
    scenario: 'A4 圆角六十五格不干胶专用',
    accent: '#0369a1',
    sampleData: { name: '王小明' },
    demoDataset: 'kindergarten',
    fields: [
      text('name', '姓名', { x: 3, y: 5, width: 32.1, height: 11 }, '王小明', {
        fontSize: 9,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
    ],
  }),

  // ================= 圆形 =================
  pp('a4-circle-60', {
    id: 'ppSealThanks60',
    name: '圆形·手作封口贴',
    category: 'life',
    description: 'Φ60 mm 圆贴，「手工制作 · 谢谢品尝」环绕品名，封烘焙袋、果酱瓶与伴手礼。',
    scenario: 'A4 圆形不干胶专用',
    accent: '#b45309',
    sampleData: { item: '手作曲奇' },
    demoDataset: 'restaurant',
    fields: [
      fixed('cap', '顶部小字', { x: 15, y: 12, width: 30, height: 6 }, '手工制作', {
        fontSize: 6,
        color: '#b45309',
        letterSpacing: 0.3,
      }),
      text('item', '品名', { x: 12, y: 24, width: 36, height: 12 }, '手作曲奇', {
        fontSize: 10,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      fixed('thanks', '底部小字', { x: 15, y: 42, width: 30, height: 6 }, '谢谢品尝', {
        fontSize: 6,
        color: INK_MUTED,
        letterSpacing: 0.3,
      }),
    ],
  }, {
    decorSvg: svg(60, 60, '<circle cx="30" cy="30" r="27" fill="none" stroke="#b45309" stroke-width="0.4" stroke-dasharray="2 1.4"/><circle cx="30" cy="30" r="20" fill="none" stroke="#e7e5e4" stroke-width="0.25"/>'),
  }),
  pp('a4-circle-60', {
    id: 'ppSealDate60',
    name: '圆形·生产日期贴',
    category: 'life',
    description: 'Φ60 mm 圆贴，品名居中 + 制作日期与保质期，贴罐盖、餐盒与分装瓶。',
    scenario: 'A4 圆形不干胶专用',
    accent: '#0f766e',
    sampleData: { item: '草莓果酱', date: '2026-03-01', keep: '冷藏 30 天' },
    demoDataset: 'restaurant',
    fields: [
      text('item', '品名', { x: 12, y: 18, width: 36, height: 12 }, '草莓果酱', {
        fontSize: 10,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('date', '制作日期', { x: 12, y: 33, width: 36, height: 6.5 }, '2026-03-01', {
        fontSize: 5.8,
        color: INK_MUTED,
      }),
      text('keep', '保质期', { x: 12, y: 42, width: 36, height: 6.5 }, '冷藏 30 天', {
        fontSize: 5.8,
        color: INK_FAINT,
      }),
    ],
  }, {
    decorSvg: svg(60, 60, '<circle cx="30" cy="30" r="27" fill="none" stroke="#0f766e" stroke-width="0.5"/><circle cx="30" cy="30" r="14.5" fill="none" stroke="#99f6e4" stroke-width="0.25"/>'),
  }),
  pp('a4-circle-119', {
    id: 'ppSealWedding119',
    name: '圆形·喜糖贴',
    category: 'wedding',
    description: 'Φ119 mm 大圆贴，囍字居中 + 新人名与日期，贴喜糖盒、伴手礼与回礼包。',
    scenario: 'A4 大圆贴不干胶专用',
    accent: '#b91c1c',
    sampleData: { names: '林晓 & 苏然', date: '2026-05-20' },
    demoDataset: 'wedding',
    fields: [
      fixed('xi', '囍', { x: 34.5, y: 22, width: 50, height: 42 }, '囍', {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#b91c1c',
      }),
      text('names', '新人姓名', { x: 24.5, y: 70, width: 70, height: 12 }, '林晓 & 苏然', {
        fontSize: 11,
        fontWeight: 'bold',
      }),
      text('date', '日期', { x: 24.5, y: 86, width: 70, height: 9 }, '2026-05-20', {
        fontSize: 8,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(119, 119, '<circle cx="59.5" cy="59.5" r="56" fill="none" stroke="#b91c1c" stroke-width="0.6"/><circle cx="59.5" cy="59.5" r="50" fill="none" stroke="#fecaca" stroke-width="0.4" stroke-dasharray="3 2"/>'),
  }),

  // ================= 对折席卡（Letter） =================
  pp('avery-5305', {
    id: 'ppTent5305',
    name: 'Letter·对折会议桌牌',
    category: 'event',
    description: '215.9×127 mm 对折卡，下幅姓名大字 + 单位职务，上幅镜像印刷，对折后双面可读。',
    scenario: 'Avery 5305 对折纸型专用',
    accent: '#1d4ed8',
    sampleData: { name: '吴建平', org: '远见设计事务所 · 创始合伙人' },
    demoDataset: 'meeting',
    fields: [
      text('name', '姓名', { x: 18, y: 78, width: 180, height: 30 }, '吴建平', {
        fontSize: 30,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      { id: 'nameM', label: '姓名镜像', type: 'text', x: 18, y: 19, width: 180, height: 30, fontSize: 30, fontWeight: 'bold', align: 'center', verticalAlign: 'middle', color: INK, mirrorOf: 'name', rotate: 180 },
      text('org', '单位职务', { x: 18, y: 112, width: 180, height: 10 }, '远见设计事务所 · 创始合伙人', {
        fontSize: 10,
        color: INK_MUTED,
      }),
      { id: 'orgM', label: '单位镜像', type: 'text', x: 18, y: 5, width: 180, height: 10, fontSize: 10, align: 'center', verticalAlign: 'middle', color: INK_MUTED, mirrorOf: 'org', rotate: 180 },
      hairline('fold', { x: 18, y: 63, width: 180, height: 0.3 }, '#bfdbfe'),
    ],
  }),
  pp('avery-5302', {
    id: 'ppWedTent5302',
    name: 'Letter·婚宴对折席卡',
    category: 'wedding',
    description: '88.9×101.6 mm 对折小卡，下幅姓名 + 桌号，上幅镜像，每页四枚婚宴席卡。',
    scenario: 'Avery 5302 对折纸型专用',
    accent: '#b91c1c',
    sampleData: { name: '王小明', table: '第 8 桌' },
    demoDataset: 'wedding',
    fields: [
      text('name', '姓名', { x: 8, y: 64, width: 72.9, height: 16 }, '王小明', {
        fontSize: 15,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      { id: 'nameM', label: '姓名镜像', type: 'text', x: 8, y: 21.6, width: 72.9, height: 16, fontSize: 15, fontWeight: 'bold', align: 'center', verticalAlign: 'middle', color: INK, mirrorOf: 'name', rotate: 180 },
      text('table', '桌号', { x: 8, y: 84, width: 72.9, height: 9 }, '第 8 桌', {
        fontSize: 8.5,
        color: INK_MUTED,
      }),
      { id: 'tableM', label: '桌号镜像', type: 'text', x: 8, y: 8.6, width: 72.9, height: 9, fontSize: 8.5, align: 'center', verticalAlign: 'middle', color: INK_MUTED, mirrorOf: 'table', rotate: 180 },
      hairline('fold', { x: 8, y: 50.3, width: 72.9, height: 0.25 }, '#fecaca'),
    ],
  }),

  pp('avery-5309', {
    id: 'ppTent5309',
    name: 'Letter·竖折长条桌牌',
    category: 'event',
    description: '177.8×279.4 mm 竖折卡，沿纵向中线对折后成 279.4 mm 长条桌牌，姓名沿长边大字、双面可读。',
    scenario: 'Avery 5309 对折纸型专用',
    accent: '#1d4ed8',
    sampleData: { name: '吴建平', org: '远见设计事务所' },
    demoDataset: 'meeting',
    fields: [
      // 右半面（折后正面）：文字沿长边排，顶部朝折线 → rotate 90
      {
        id: 'name',
        label: '姓名',
        type: 'text',
        x: 33.35,
        y: 124.7,
        width: 200,
        height: 30,
        fontSize: 26,
        fontWeight: 'bold',
        align: 'center',
        verticalAlign: 'middle',
        color: INK,
        rotate: 90,
        emphasis: 'hero',
      },
      // 左半面镜像：同一内容旋转 270°，对折后另一面同样可读
      {
        id: 'nameM',
        label: '姓名镜像',
        type: 'text',
        x: -55.55,
        y: 124.7,
        width: 200,
        height: 30,
        fontSize: 26,
        fontWeight: 'bold',
        align: 'center',
        verticalAlign: 'middle',
        color: INK,
        mirrorOf: 'name',
        rotate: 270,
      },
      {
        id: 'org',
        label: '单位',
        type: 'text',
        x: 73.35,
        y: 134.7,
        width: 120,
        height: 10,
        fontSize: 10,
        align: 'center',
        verticalAlign: 'middle',
        color: INK_MUTED,
        rotate: 90,
      },
      {
        id: 'orgM',
        label: '单位镜像',
        type: 'text',
        x: -15.55,
        y: 134.7,
        width: 120,
        height: 10,
        fontSize: 10,
        align: 'center',
        verticalAlign: 'middle',
        color: INK_MUTED,
        mirrorOf: 'org',
        rotate: 270,
      },
      { id: 'foldLine', label: '折线', type: 'text', x: 88.65, y: 10, width: 0.5, height: 259.4, fixedText: '', background: '#bfdbfe', padding: 0, maxLines: 1 },
    ],
  }),

  // ================= Letter 多格 =================
  pp('avery-5160', {
    id: 'ppAddr5160',
    name: 'Letter·地址标签',
    category: 'life',
    description: '66.68×25.4 mm 三十格，收件人 + 地址 + 电话三行，贴信封、包裹与回邮。',
    scenario: 'Avery 5160 纸型专用',
    accent: '#334155',
    sampleData: { name: '王小明', addr: '阳光路 88 号 3-502', phone: '138-0000-0000' },
    fields: [
      text('name', '收件人', { x: 4, y: 4, width: 58.7, height: 6 }, '王小明', {
        fontSize: 6.5,
        fontWeight: 'bold',
        align: 'left',
      }),
      text('addr', '地址', { x: 4, y: 11, width: 58.7, height: 8 }, '阳光路 88 号 3-502', {
        fontSize: 6,
        color: INK_SOFT,
        align: 'left',
        maxLines: 2,
        lineHeight: 1.3,
      }),
      text('phone', '电话', { x: 4, y: 20, width: 58.7, height: 4.5 }, '138-0000-0000', {
        fontSize: 5,
        color: INK_MUTED,
        align: 'left',
      }),
    ],
  }),
  pp('avery-5163', {
    id: 'ppShip5163',
    name: 'Letter·运输标签',
    category: 'life',
    description: '101.6×50.8 mm 十格，收件人信息区 + 寄件人小字，贴包裹与外箱。',
    scenario: 'Avery 5163 纸型专用',
    accent: '#334155',
    sampleData: { name: '王小明', addr: '阳光路 88 号 3-502', phone: '138-0000-0000', from: '市图书馆' },
    fields: [
      fixed('to', '收件标记', { x: 8, y: 6, width: 20, height: 6 }, '收件 TO', {
        fontSize: 5.5,
        color: INK_FAINT,
        letterSpacing: 0.2,
      }),
      text('name', '收件人', { x: 8, y: 13, width: 85, height: 10 }, '王小明', {
        fontSize: 9.5,
        fontWeight: 'bold',
        align: 'left',
      }),
      text('addr', '地址', { x: 8, y: 25, width: 85, height: 9 }, '阳光路 88 号 3-502', {
        fontSize: 7.5,
        color: INK_SOFT,
        align: 'left',
        maxLines: 2,
        lineHeight: 1.3,
      }),
      text('phone', '电话', { x: 8, y: 36, width: 85, height: 6 }, '138-0000-0000', {
        fontSize: 6.5,
        color: INK_MUTED,
        align: 'left',
      }),
      text('from', '寄件人', { x: 8, y: 44.5, width: 85, height: 5 }, '市图书馆', {
        fontSize: 5,
        color: INK_FAINT,
        align: 'left',
      }),
    ],
  }, {
    decorSvg: svg(101.6, 50.8, '<rect x="8" y="42.5" width="85" height="0.3" fill="#cbd5e1"/>'),
  }),
  pp('avery-5164', {
    id: 'ppShip5164',
    name: 'Letter·储物箱大贴',
    category: 'life',
    description: '101.6×84.67 mm 六格大贴，物品名 + 类别 + 日期与备注，贴周转箱与搬家纸箱。',
    scenario: 'Avery 5164 纸型专用',
    accent: '#0f766e',
    sampleData: { item: '冬季衣物', cat: '卧室收纳', date: '2026-03-01', note: '轻放防潮' },
    demoDataset: 'asset',
    fields: [
      text('item', '物品名', { x: 9, y: 16, width: 83.6, height: 20 }, '冬季衣物', {
        fontSize: 18,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('cat', '类别', { x: 9, y: 42, width: 45, height: 9 }, '卧室收纳', {
        fontSize: 8,
        color: INK_SOFT,
        align: 'left',
      }),
      text('date', '日期', { x: 58, y: 42, width: 34.6, height: 9 }, '2026-03-01', {
        fontSize: 7.5,
        color: INK_MUTED,
      }),
      text('note', '备注', { x: 9, y: 58, width: 83.6, height: 9 }, '轻放防潮', {
        fontSize: 7.5,
        color: INK_FAINT,
        align: 'left',
      }),
    ],
  }, {
    decorSvg: svg(101.6, 84.67, '<rect x="9" y="38" width="83.6" height="0.3" fill="#99f6e4"/><rect x="9" y="54" width="83.6" height="0.25" fill="#ccfbf1"/>'),
  }),
  pp('avery-5395', {
    id: 'ppBadge5395',
    name: 'Letter·会议名牌贴',
    category: 'event',
    description: '85.72×59.27 mm 八格，顶部色带 + 姓名大字 + 单位职务，作会议签到贴纸名牌。',
    scenario: 'Avery 5395 纸型专用',
    accent: '#1d4ed8',
    sampleData: { name: '吴建平', org: '远见设计事务所', title: '创始合伙人' },
    demoDataset: 'meeting',
    fields: [
      fixed('cap', '眉题', { x: 8, y: 7, width: 69.7, height: 7 }, '你好，我是', {
        fontSize: 6.5,
        color: '#ffffff',
        letterSpacing: 0.3,
      }),
      text('name', '姓名', { x: 8, y: 19, width: 69.7, height: 20 }, '吴建平', {
        fontSize: 19,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('org', '单位', { x: 8, y: 42, width: 42, height: 8 }, '远见设计事务所', {
        fontSize: 7.5,
        color: INK_SOFT,
        align: 'left',
      }),
      text('title', '职务', { x: 54, y: 42, width: 23.7, height: 8 }, '创始合伙人', {
        fontSize: 7,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(85.72, 59.27, '<rect x="0" y="0" width="85.72" height="14" fill="#1d4ed8"/>'),
  }),

  // ================= 横向进纸版（纸型旋转 90°，单格宽高互换） =================
  pp('a4-1up', {
    id: 'ppNoticeA4H',
    name: '横版·整版公告栏贴',
    category: 'life',
    description: '297×210 mm 横向进纸整版背胶，宽幅标题与多行正文，适合走廊公告栏与横贴门幅。',
    scenario: 'A4 整版不干胶专用 · 横版',
    accent: '#b45309',
    sampleData: {
      title: '读书节活动安排',
      body: '本周三至周五为校园读书节，各班图书角全天开放，三楼阅览室增设午间导读，欢迎同学参加。',
      org: '教导处 宣',
    },
    fields: [
      text('title', '标题', { x: 18, y: 30, width: 261, height: 24 }, '读书节活动安排', {
        fontSize: 24,
        fontWeight: 'bold',
        align: 'left',
        emphasis: 'hero',
      }),
      text('body', '正文', { x: 18, y: 66, width: 261, height: 96 }, '本周三至周五为校园读书节，各班图书角全天开放，三楼阅览室增设午间导读，欢迎同学参加。', {
        fontSize: 11.5,
        color: INK_SOFT,
        align: 'left',
        verticalAlign: 'top',
        maxLines: 6,
        lineHeight: 1.7,
      }),
      text('org', '落款', { x: 18, y: 178, width: 261, height: 12 }, '教导处 宣', {
        fontSize: 10.5,
        color: INK_MUTED,
        align: 'right',
      }),
    ],
  }, {
    decorSvg: svg(297, 210, '<rect x="0" y="0" width="297" height="14" fill="#b45309"/><rect x="18" y="60" width="261" height="0.5" fill="#d6d3d1"/><rect x="18" y="168" width="261" height="0.35" fill="#e7e5e4"/>'),
  }, true),
  pp('a3-1up', {
    id: 'ppPosterA3H',
    name: '横版·A3 公示大海报',
    category: 'event',
    description: '420×297 mm 横向进纸 A3 整版，超大标题横贯版面，适合大厅公示栏与活动横幅背贴。',
    scenario: 'A3 整版背胶纸专用 · 横版',
    accent: '#1d4ed8',
    sampleData: { title: '春季运动会赛程', body: '径赛项目上午 8:30 起在田径场进行，田赛项目同步在体育馆分区开展；各班按秩序册指定区域候场。', org: '体育教研组' },
    fields: [
      text('title', '标题', { x: 30, y: 66, width: 360, height: 60 }, '春季运动会赛程', {
        fontSize: 54,
        fontWeight: 'bold',
        align: 'left',
        emphasis: 'hero',
      }),
      text('body', '正文', { x: 30, y: 150, width: 360, height: 92 }, '径赛项目上午 8:30 起在田径场进行，田赛项目同步在体育馆分区开展；各班按秩序册指定区域候场。', {
        fontSize: 14,
        color: INK_SOFT,
        align: 'left',
        verticalAlign: 'top',
        maxLines: 4,
        lineHeight: 1.8,
      }),
      text('org', '落款', { x: 30, y: 258, width: 360, height: 16 }, '体育教研组', {
        fontSize: 12,
        color: INK_MUTED,
        align: 'right',
      }),
    ],
  }, {
    decorSvg: svg(420, 297, '<rect x="0" y="0" width="420" height="26" fill="#1d4ed8"/><rect x="30" y="136" width="360" height="0.6" fill="#bfdbfe"/>'),
  }, true),
  pp('a5-1up', {
    id: 'ppNoticeA5H',
    name: '横版·A5 桌面提示贴',
    category: 'life',
    description: '210×148 mm 横向进纸 A5 整版，横幅小告示贴前台、收银台与设备旁。',
    scenario: 'A5 整版背胶纸专用 · 横版',
    accent: '#0f766e',
    sampleData: { title: '请节约用水', body: '洗手后请随手关紧水龙头，发现滴漏请联系总务处。', org: '总务处' },
    fields: [
      text('title', '标题', { x: 14, y: 26, width: 182, height: 22 }, '请节约用水', {
        fontSize: 21,
        fontWeight: 'bold',
        align: 'left',
        emphasis: 'hero',
      }),
      text('body', '正文', { x: 14, y: 60, width: 182, height: 52 }, '洗手后请随手关紧水龙头，发现滴漏请联系总务处。', {
        fontSize: 10.5,
        color: INK_SOFT,
        align: 'left',
        verticalAlign: 'top',
        maxLines: 4,
        lineHeight: 1.65,
      }),
      text('org', '落款', { x: 14, y: 122, width: 182, height: 10 }, '总务处', {
        fontSize: 9,
        color: INK_MUTED,
        align: 'right',
      }),
    ],
  }, {
    decorSvg: svg(210, 148, '<rect x="0" y="0" width="210" height="11" fill="#0f766e"/><rect x="14" y="54" width="182" height="0.4" fill="#99f6e4"/>'),
  }, true),
  pp('a4-2up', {
    id: 'ppDoorSignA4x2H',
    name: '竖版·区域门贴',
    category: 'event',
    description: '148.5×210 mm 竖向大格（横向进纸），区域名竖排大字 + 动线指引，贴门柱与墙面。',
    scenario: 'A4 对开不干胶专用 · 横版',
    accent: '#b91c1c',
    sampleData: { zone: 'B 区', guide: '参赛选手由此入场', floor: '三楼 · 东段' },
    demoDataset: 'meeting',
    fields: [
      text('zone', '区域', { x: 14, y: 52, width: 120.5, height: 60 }, 'B 区', {
        fontSize: 46,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('guide', '指引', { x: 14, y: 124, width: 120.5, height: 14 }, '参赛选手由此入场', {
        fontSize: 11,
        color: INK_SOFT,
      }),
      text('floor', '位置', { x: 14, y: 168, width: 120.5, height: 11 }, '三楼 · 东段', {
        fontSize: 9,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(148.5, 210, '<rect x="0" y="0" width="148.5" height="24" fill="#b91c1c"/><rect x="14" y="150" width="120.5" height="0.4" fill="#fecaca"/>'),
  }, true),
  pp('a4-4up', {
    id: 'ppDoorSign4H',
    name: '横版·班级门牌',
    category: 'teaching',
    description: '148.5×105 mm 横向大格（横向进纸），班名大字横贯门牌，贴教室门与功能室。',
    scenario: 'A4 四格不干胶专用 · 横版',
    accent: '#1d4ed8',
    sampleData: { className: '三年级二班', room: '301 教室', teacher: '班主任：李老师' },
    demoDataset: 'classroom',
    fields: [
      text('className', '班名', { x: 14, y: 22, width: 120.5, height: 40 }, '三年级二班', {
        fontSize: 30,
        fontWeight: 'bold',
        align: 'left',
        emphasis: 'hero',
      }),
      text('room', '教室', { x: 14, y: 66, width: 60, height: 12 }, '301 教室', {
        fontSize: 10,
        color: INK_SOFT,
        align: 'left',
      }),
      text('teacher', '班主任', { x: 78, y: 66, width: 56.5, height: 12 }, '班主任：李老师', {
        fontSize: 9,
        color: INK_MUTED,
        align: 'right',
      }),
    ],
  }, {
    decorSvg: svg(148.5, 105, '<rect x="0" y="0" width="8" height="105" fill="#1d4ed8"/>'),
  }, true),
  pp('a4-5up', {
    id: 'ppSlogan5H',
    name: '竖条·走廊标语贴',
    category: 'teaching',
    description: '54×192 mm 竖长条（横向进纸），竖排四字标语，贴走廊立柱、书架侧与门柱。',
    scenario: 'A4 五格横条专用 · 横版',
    accent: '#b45309',
    sampleData: { line: '轻声慢步' },
    fields: [
      text('line', '标语', { x: 16, y: 14, width: 22, height: 164 }, '轻声慢步', {
        fontSize: 20,
        fontWeight: 'bold',
        maxLines: 4,
        lineHeight: 1.35,
        emphasis: 'hero',
      }),
    ],
  }, {
    decorSvg: svg(54, 192, '<rect x="5" y="5" width="44" height="182" fill="none" stroke="#b45309" stroke-width="0.6"/>'),
  }, true),
  pp('a4-6up-strip', {
    id: 'ppShelfSide6H',
    name: '竖条·书架分类贴',
    category: 'teaching',
    description: '48×210 mm 竖长条（横向进纸），竖排类目名，贴书架侧面与文件柜立柱。',
    scenario: 'A4 六格横条专用 · 横版',
    accent: '#0f766e',
    sampleData: { cat: '教辅资料' },
    demoDataset: 'classroom',
    fields: [
      text('cat', '类目', { x: 13, y: 16, width: 22, height: 172 }, '教辅资料', {
        fontSize: 19,
        fontWeight: 'bold',
        maxLines: 5,
        lineHeight: 1.4,
        emphasis: 'hero',
      }),
    ],
  }, {
    decorSvg: svg(48, 210, '<rect x="4" y="4" width="40" height="202" fill="none" stroke="#0f766e" stroke-width="0.6"/><rect x="13" y="196" width="22" height="0.4" fill="#99f6e4"/>'),
  }, true),
  pp('a4-8up-spine', {
    id: 'ppBoxFront120H',
    name: '横版·档案盒面贴',
    category: 'life',
    description: '120×40 mm 横短条（横向进纸），档案题名 + 年度编号，贴档案盒正面。',
    scenario: 'A4 竖条档案脊贴专用 · 横版',
    accent: '#92400e',
    sampleData: { item: '教研活动记录', year: '2025–2026 学年', no: 'JY-012' },
    fields: [
      text('item', '题名', { x: 8, y: 6, width: 104, height: 14 }, '教研活动记录', {
        fontSize: 12,
        fontWeight: 'bold',
        align: 'left',
      }),
      text('year', '年度', { x: 8, y: 26, width: 66, height: 8 }, '2025–2026 学年', {
        fontSize: 7.5,
        color: INK_SOFT,
        align: 'left',
      }),
      text('no', '编号', { x: 80, y: 26, width: 32, height: 8 }, 'JY-012', {
        fontSize: 7.5,
        color: INK_MUTED,
        align: 'right',
      }),
    ],
  }, {
    decorSvg: svg(120, 40, '<rect x="8" y="22.5" width="104" height="0.3" fill="#fcd34d"/>'),
  }, true),
  pp('a4-6up', {
    id: 'ppBinTag6H',
    name: '竖版·收纳箱标签',
    category: 'life',
    description: '99×105 mm 竖向大格（横向进纸），物品名置顶大字，类别日期备注依次排列。',
    scenario: 'A4 六格不干胶专用 · 横版',
    accent: '#0d9488',
    sampleData: { item: '冬季被褥', cat: '卧室收纳', date: '2026-03-01', note: '抽真空存放' },
    demoDataset: 'asset',
    fields: [
      text('item', '物品名', { x: 9, y: 12, width: 81, height: 28 }, '冬季被褥', {
        fontSize: 22,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('cat', '类别', { x: 9, y: 48, width: 48, height: 10 }, '卧室收纳', {
        fontSize: 8.5,
        color: INK_SOFT,
        align: 'left',
      }),
      text('date', '日期', { x: 60, y: 48, width: 30, height: 10 }, '2026-03-01', {
        fontSize: 7.5,
        color: INK_MUTED,
        align: 'right',
      }),
      text('note', '备注', { x: 9, y: 66, width: 81, height: 10 }, '抽真空存放', {
        fontSize: 8,
        color: INK_FAINT,
        align: 'left',
      }),
    ],
  }, {
    decorSvg: svg(99, 105, '<rect x="9" y="44" width="81" height="0.35" fill="#99f6e4"/><rect x="9" y="62" width="81" height="0.3" fill="#ccfbf1"/>'),
  }, true),
  pp('a4-8up', {
    id: 'ppExamDesk8H',
    name: '竖版·考场座贴',
    category: 'exam',
    description: '74.25×105 mm 竖向单格（横向进纸），座位号反白置顶 + 姓名考场竖排，贴课桌中央。',
    scenario: 'A4 八分格不干胶专用 · 横版',
    accent: '#111827',
    sampleData: { seatNo: '18', name: '孙晓东', room: '第 03 考场' },
    demoDataset: 'exam',
    fields: [
      text('seatNo', '座位号', { x: 12, y: 8, width: 50.25, height: 34 }, '18', {
        fontSize: 30,
        fontWeight: 'bold',
        color: '#ffffff',
        emphasis: 'hero',
      }),
      text('name', '姓名', { x: 9, y: 52, width: 56.25, height: 22 }, '孙晓东', {
        fontSize: 18,
        fontWeight: 'bold',
      }),
      text('room', '考场', { x: 9, y: 82, width: 56.25, height: 10 }, '第 03 考场', {
        fontSize: 9,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(74.25, 105, '<rect x="0" y="0" width="74.25" height="46" fill="#111827"/>'),
  }, true),
  pp('a4-8up-round', {
    id: 'ppItemTag8rH',
    name: '竖版·班级物品标签',
    category: 'teaching',
    description: '67.7×99.1 mm 竖向圆角格（横向进纸），物品名置顶，班级与数量在下，贴教具柜与器材袋。',
    scenario: 'A4 圆角八格不干胶专用 · 横版',
    accent: '#0d9488',
    sampleData: { item: '水彩笔', className: '中一班', qty: '×24' },
    demoDataset: 'classroom',
    fields: [
      text('item', '物品名', { x: 8, y: 12, width: 51.7, height: 24 }, '水彩笔', {
        fontSize: 19,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('className', '班级', { x: 8, y: 48, width: 51.7, height: 10 }, '中一班', {
        fontSize: 9,
        color: INK_SOFT,
      }),
      text('qty', '数量', { x: 8, y: 66, width: 51.7, height: 10 }, '×24', {
        fontSize: 9,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(67.7, 99.1, '<rect x="0" y="82" width="67.7" height="17.1" fill="#0d9488"/><rect x="8" y="42" width="51.7" height="0.35" fill="#99f6e4"/>'),
  }, true),
  pp('a4-8up-round-90', {
    id: 'ppProductTag90H',
    name: '竖版·产品信息标签',
    category: 'life',
    description: '72×90 mm 竖向格（横向进纸），品名、规格、产地与价格纵向排布，贴包装与样品袋。',
    scenario: 'A4 圆角八格（90×72）专用 · 横版',
    accent: '#b45309',
    sampleData: { name: '手工曲奇', spec: '200g / 盒', place: '浙江 · 杭州', price: '¥38' },
    fields: [
      text('name', '品名', { x: 7, y: 10, width: 58, height: 18 }, '手工曲奇', {
        fontSize: 15,
        fontWeight: 'bold',
        align: 'left',
      }),
      text('spec', '规格', { x: 7, y: 36, width: 58, height: 9 }, '200g / 盒', {
        fontSize: 8,
        color: INK_SOFT,
        align: 'left',
      }),
      text('place', '产地', { x: 7, y: 50, width: 58, height: 9 }, '浙江 · 杭州', {
        fontSize: 8,
        color: INK_MUTED,
        align: 'left',
      }),
      text('price', '价格', { x: 7, y: 66, width: 58, height: 18 }, '¥38', {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#b45309',
        align: 'left',
      }),
    ],
  }, {
    decorSvg: svg(72, 90, '<rect x="7" y="32" width="58" height="0.3" fill="#fcd34d"/><rect x="7" y="62" width="58" height="0.3" fill="#fcd34d"/>'),
  }, true),
  pp('a4-10up', {
    id: 'ppPriceTag10H',
    name: '竖版·商品吊牌价签',
    category: 'life',
    description: '59.4×105 mm 竖长价签（横向进纸），品名置顶、价格居中超大字，作吊牌与展架竖签。',
    scenario: 'A4 十格价签专用 · 横版',
    accent: '#b91c1c',
    sampleData: { name: '有机苹果', price: '¥12.8', spec: '500g / 份', code: 'SKU-A102' },
    fields: [
      text('name', '品名', { x: 7, y: 10, width: 45.4, height: 18 }, '有机苹果', {
        fontSize: 13,
        fontWeight: 'bold',
      }),
      text('price', '价格', { x: 7, y: 38, width: 45.4, height: 30 }, '¥12.8', {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#b91c1c',
        emphasis: 'hero',
      }),
      text('spec', '规格', { x: 7, y: 76, width: 45.4, height: 9 }, '500g / 份', {
        fontSize: 8,
        color: INK_SOFT,
      }),
      text('code', '货号', { x: 7, y: 89, width: 45.4, height: 8 }, 'SKU-A102', {
        fontSize: 7,
        color: INK_FAINT,
      }),
    ],
  }, {
    decorSvg: svg(59.4, 105, '<rect x="7" y="32" width="45.4" height="0.35" fill="#fecaca"/><rect x="7" y="72" width="45.4" height="0.35" fill="#fecaca"/>'),
  }, true),
  pp('a4-10up-round', {
    id: 'ppNameCard10rH',
    name: '竖版·席位姓名签',
    category: 'event',
    description: '57.7×99.1 mm 竖向圆角格（横向进纸），姓名居中大字，单位桌次在下，作立式席位签。',
    scenario: 'A4 圆角十格不干胶专用 · 横版',
    accent: '#7c3aed',
    sampleData: { name: '陈静怡', org: '明德中学', table: '第 5 桌' },
    demoDataset: 'meeting',
    fields: [
      text('name', '姓名', { x: 7, y: 18, width: 43.7, height: 28 }, '陈静怡', {
        fontSize: 21,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('org', '单位', { x: 7, y: 54, width: 43.7, height: 10 }, '明德中学', {
        fontSize: 8.5,
        color: INK_SOFT,
      }),
      text('table', '桌次', { x: 7, y: 72, width: 43.7, height: 10 }, '第 5 桌', {
        fontSize: 9,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(57.7, 99.1, '<rect x="0" y="0" width="57.7" height="8" fill="#7c3aed"/><rect x="7" y="66" width="43.7" height="0.3" fill="#ddd6fe"/>'),
  }, true),
  pp('a4-12up', {
    id: 'ppFileTag12H',
    name: '竖版·档案分类标签',
    category: 'life',
    description: '49.5×105 mm 竖向格（横向进纸），类别题名 + 年度与编号，贴文件盒窄面与抽屉。',
    scenario: 'A4 十二格不干胶专用 · 横版',
    accent: '#92400e',
    sampleData: { item: '财务凭证', year: '2025 年度', no: 'CW-04' },
    fields: [
      text('item', '题名', { x: 6, y: 10, width: 37.5, height: 34 }, '财务凭证', {
        fontSize: 13,
        fontWeight: 'bold',
        maxLines: 2,
        lineHeight: 1.3,
        emphasis: 'hero',
      }),
      text('year', '年度', { x: 6, y: 52, width: 37.5, height: 9 }, '2025 年度', {
        fontSize: 7.5,
        color: INK_SOFT,
      }),
      text('no', '编号', { x: 6, y: 68, width: 37.5, height: 9 }, 'CW-04', {
        fontSize: 7.5,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(49.5, 105, '<rect x="0" y="0" width="49.5" height="6" fill="#92400e"/><rect x="6" y="86" width="37.5" height="0.3" fill="#fcd34d"/>'),
  }, true),
  pp('a4-12up-narrow', {
    id: 'ppBookTag12nH',
    name: '竖版·图书书目标签',
    category: 'teaching',
    description: '42.3×96.5 mm 竖窄格（横向进纸），书名竖向排布 + 著者分类号，贴图书封底。',
    scenario: 'A4 窄十二格不干胶专用 · 横版',
    accent: '#1d4ed8',
    sampleData: { book: '草房子', author: '曹文轩', code: 'I287.45' },
    demoDataset: 'classroom',
    fields: [
      text('book', '书名', { x: 5, y: 10, width: 32.3, height: 38 }, '草房子', {
        fontSize: 12,
        fontWeight: 'bold',
        maxLines: 2,
        lineHeight: 1.35,
        emphasis: 'hero',
      }),
      text('author', '著者', { x: 5, y: 54, width: 32.3, height: 9 }, '曹文轩', {
        fontSize: 7.5,
        color: INK_SOFT,
      }),
      text('code', '分类号', { x: 5, y: 70, width: 32.3, height: 9 }, 'I287.45', {
        fontSize: 7.5,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(42.3, 96.5, '<rect x="0" y="0" width="42.3" height="5" fill="#1d4ed8"/>'),
  }, true),
  pp('a4-14up-round', {
    id: 'ppNameSticker14rH',
    name: '竖版·姓名贴',
    category: 'kids',
    description: '38.1×99.1 mm 竖长格（横向进纸），姓名竖排居中，班级园名在底，贴水壶与储物柜侧面。',
    scenario: 'A4 圆角十四格不干胶专用 · 横版',
    accent: '#ea580c',
    sampleData: { name: '王小明', className: '三年级二班', school: '育才小学' },
    demoDataset: 'kids',
    fields: [
      text('name', '姓名', { x: 9, y: 12, width: 20, height: 52 }, '王小明', {
        fontSize: 15.5,
        fontWeight: 'bold',
        maxLines: 3,
        lineHeight: 1.2,
        emphasis: 'hero',
      }),
      text('className', '班级', { x: 5, y: 70, width: 28.1, height: 9 }, '三年级二班', {
        fontSize: 7.5,
        color: INK_SOFT,
      }),
      text('school', '学校', { x: 5, y: 84, width: 28.1, height: 9 }, '育才小学', {
        fontSize: 7,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(38.1, 99.1, '<rect x="0" y="0" width="38.1" height="6" fill="#ea580c"/>'),
  }, true),
  pp('a4-16up-round', {
    id: 'ppKidsName16rH',
    name: '竖版·幼儿姓名贴',
    category: 'kids',
    description: '33.8×99.1 mm 竖长格（横向进纸），姓名竖排醒目，贴幼儿书包侧袋与水杯。',
    scenario: 'A4 圆角十六格不干胶专用 · 横版',
    accent: '#e11d48',
    sampleData: { name: '李欣欣', className: '小一班', school: '阳光幼儿园' },
    demoDataset: 'kids',
    fields: [
      text('name', '姓名', { x: 8, y: 12, width: 18, height: 50 }, '李欣欣', {
        fontSize: 15,
        fontWeight: 'bold',
        maxLines: 3,
        lineHeight: 1.2,
        emphasis: 'hero',
      }),
      text('className', '班级', { x: 5, y: 70, width: 23.8, height: 9 }, '小一班', {
        fontSize: 7.5,
        color: INK_SOFT,
      }),
      text('school', '园名', { x: 5, y: 84, width: 23.8, height: 9 }, '阳光幼儿园', {
        fontSize: 6.5,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(33.8, 99.1, '<rect x="0" y="0" width="33.8" height="6" fill="#e11d48"/>'),
  }, true),
  pp('a4-18up-round', {
    id: 'ppSpice18rH',
    name: '竖版·调料日期标签',
    category: 'life',
    description: '46.6×63.5 mm 竖向格（横向进纸），品名置顶、开封与保质日期在下，贴调料瓶窄面。',
    scenario: 'A4 圆角十八格不干胶专用 · 横版',
    accent: '#b45309',
    sampleData: { name: '花椒粉', open: '开封 03-01', expiry: '6 个月内用完' },
    fields: [
      text('name', '品名', { x: 6, y: 8, width: 34.6, height: 20 }, '花椒粉', {
        fontSize: 14,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('open', '开封', { x: 6, y: 34, width: 34.6, height: 9 }, '开封 03-01', {
        fontSize: 7.5,
        color: INK_SOFT,
      }),
      text('expiry', '限期', { x: 6, y: 48, width: 34.6, height: 9 }, '6 个月内用完', {
        fontSize: 7,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(46.6, 63.5, '<rect x="6" y="30" width="34.6" height="0.3" fill="#fcd34d"/>'),
  }, true),
  pp('a4-21up', {
    id: 'ppDeskName21H',
    name: '竖版·课桌姓名贴',
    category: 'kids',
    description: '42.4×70 mm 竖向格（横向进纸），姓名竖排居中 + 班级在底，贴课桌侧边与文具盒。',
    scenario: 'A4 二十一格不干胶专用 · 横版',
    accent: '#0d9488',
    sampleData: { name: '王小明', className: '三年级二班' },
    demoDataset: 'kids',
    fields: [
      text('name', '姓名', { x: 11, y: 8, width: 20, height: 44 }, '王小明', {
        fontSize: 13,
        fontWeight: 'bold',
        maxLines: 3,
        lineHeight: 1.15,
        emphasis: 'hero',
      }),
      text('className', '班级', { x: 6, y: 56, width: 30.4, height: 9 }, '三年级二班', {
        fontSize: 7,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(42.4, 70, '<rect x="0" y="0" width="42.4" height="4.5" fill="#0d9488"/>'),
  }, true),
  pp('a4-21up-round', {
    id: 'ppExamSeat21rH',
    name: '竖版·考场座贴',
    category: 'exam',
    description: '38.1×63.5 mm 竖向圆角格（横向进纸），座位号色块置顶 + 姓名竖排，贴课桌角。',
    scenario: 'A4 圆角二十一格专用 · 横版',
    accent: '#111827',
    sampleData: { seatNo: '18', name: '孙晓东', room: '03' },
    demoDataset: 'exam',
    fields: [
      text('seatNo', '座位号', { x: 5, y: 4, width: 28.1, height: 18 }, '18', {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#ffffff',
        emphasis: 'hero',
      }),
      text('name', '姓名', { x: 9, y: 28, width: 20, height: 26 }, '孙晓东', {
        fontSize: 9.5,
        fontWeight: 'bold',
        maxLines: 3,
        lineHeight: 1.1,
      }),
      text('room', '考场', { x: 5, y: 56, width: 28.1, height: 7 }, '03', {
        fontSize: 6.5,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(38.1, 63.5, '<rect x="0" y="0" width="38.1" height="24" fill="#111827"/>'),
  }, true),
  pp('a4-22up-round', {
    id: 'ppDateTag22rH',
    name: '竖版·开封日期条',
    category: 'life',
    description: '25.5×96 mm 竖长条（横向进纸），品名与开封日期竖向排列，贴瓶身侧面与酱料罐。',
    scenario: 'A4 圆角二十二格专用 · 横版',
    accent: '#b45309',
    sampleData: { item: '草莓果酱', date: '2026-03' },
    fields: [
      fixed('cap', '标签', { x: 4, y: 8, width: 17.5, height: 8 }, '开封日期', {
        fontSize: 6.5,
      }),
      text('item', '品名', { x: 4, y: 24, width: 17.5, height: 26 }, '草莓果酱', {
        fontSize: 9,
        fontWeight: 'bold',
        maxLines: 4,
        lineHeight: 1.2,
      }),
      text('date', '日期', { x: 4, y: 58, width: 17.5, height: 30 }, '2026-03', {
        fontSize: 8.5,
        color: INK_SOFT,
        maxLines: 7,
        lineHeight: 1.2,
      }),
    ],
  }, {
    decorSvg: svg(25.5, 96, '<rect x="4" y="18" width="17.5" height="0.3" fill="#fcd34d"/><rect x="4" y="52" width="17.5" height="0.3" fill="#fcd34d"/>'),
  }, true),
  pp('a4-24up-round', {
    id: 'ppNameSticker24rH',
    name: '竖版·班级姓名贴',
    category: 'kids',
    description: '33.9×63.5 mm 竖向圆角格（横向进纸），姓名竖排 + 班级在底，贴课本侧边与笔袋。',
    scenario: 'A4 圆角二十四格专用 · 横版',
    accent: '#7c3aed',
    sampleData: { name: '王小明', className: '三年级二班' },
    demoDataset: 'kids',
    fields: [
      text('name', '姓名', { x: 9, y: 6, width: 16, height: 36 }, '王小明', {
        fontSize: 11.5,
        fontWeight: 'bold',
        maxLines: 3,
        lineHeight: 1.15,
        emphasis: 'hero',
      }),
      text('className', '班级', { x: 4, y: 46, width: 25.9, height: 9 }, '三年级二班', {
        fontSize: 7,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(33.9, 63.5, '<rect x="0" y="0" width="33.9" height="3.5" fill="#7c3aed"/>'),
  }, true),
  pp('a4-30up', {
    id: 'ppKidsName30H',
    name: '竖版·幼儿迷你姓名贴',
    category: 'kids',
    description: '29.7×70 mm 竖长格（横向进纸），姓名竖排 + 班级一行，贴水杯、蜡笔盒与小物件。',
    scenario: 'A4 三十格不干胶专用 · 横版',
    accent: '#e11d48',
    sampleData: { name: '李欣欣', className: '小一班' },
    demoDataset: 'kids',
    fields: [
      text('name', '姓名', { x: 8, y: 6, width: 14, height: 38 }, '李欣欣', {
        fontSize: 10.5,
        fontWeight: 'bold',
        maxLines: 3,
        lineHeight: 1.15,
        emphasis: 'hero',
      }),
      text('className', '班级', { x: 4, y: 48, width: 21.7, height: 9 }, '小一班', {
        fontSize: 6.5,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(29.7, 70, '<rect x="0" y="0" width="29.7" height="3.5" fill="#e11d48"/>'),
  }, true),
  pp('a4-40up', {
    id: 'ppKidsName40H',
    name: '竖版·迷你姓名贴',
    category: 'kids',
    description: '29.7×52.5 mm 竖向小格（横向进纸），姓名竖排简短醒目，贴铅笔盒与学具侧面。',
    scenario: 'A4 四十格不干胶专用 · 横版',
    accent: '#ea580c',
    sampleData: { name: '王小明', className: '三2' },
    demoDataset: 'kids',
    fields: [
      text('name', '姓名', { x: 8, y: 5, width: 14, height: 30 }, '王小明', {
        fontSize: 10,
        fontWeight: 'bold',
        maxLines: 3,
        lineHeight: 1.1,
        emphasis: 'hero',
      }),
      text('className', '班级', { x: 4, y: 39, width: 21.7, height: 8 }, '三2', {
        fontSize: 6.5,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(29.7, 52.5, '<rect x="0" y="0" width="29.7" height="3" fill="#ea580c"/>'),
  }, true),
  pp('a4-44up-round', {
    id: 'ppMiniName44rH',
    name: '竖版·迷你姓名贴',
    category: 'kids',
    description: '25.4×48.5 mm 竖向迷你格（横向进纸），姓名竖排贴橡皮、尺子与小文具。',
    scenario: 'A4 圆角四十四格专用 · 横版',
    accent: '#0d9488',
    sampleData: { name: '王小明', className: '三2' },
    demoDataset: 'kids',
    fields: [
      text('name', '姓名', { x: 7, y: 4, width: 11.5, height: 28 }, '王小明', {
        fontSize: 9.5,
        fontWeight: 'bold',
        maxLines: 3,
        lineHeight: 1.1,
        emphasis: 'hero',
      }),
      text('className', '班级', { x: 3, y: 36, width: 19.4, height: 8 }, '三2', {
        fontSize: 6,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(25.4, 48.5, '<rect x="0" y="0" width="25.4" height="2.5" fill="#0d9488"/>'),
  }, true),
  pp('a4-48up-round', {
    id: 'ppPencilName48rH',
    name: '竖版·铅笔姓名贴',
    category: 'kids',
    description: '21.2×45.7 mm 竖向细格（横向进纸），姓名竖排贴铅笔杆、水彩笔与细文具。',
    scenario: 'A4 圆角四十八格专用 · 横版',
    accent: '#1d4ed8',
    sampleData: { name: '王小明', className: '三2' },
    demoDataset: 'kids',
    fields: [
      text('name', '姓名', { x: 6, y: 4, width: 9.2, height: 26 }, '王小明', {
        fontSize: 8.5,
        fontWeight: 'bold',
        maxLines: 3,
        lineHeight: 1.05,
        emphasis: 'hero',
      }),
      text('className', '班级', { x: 3, y: 33, width: 15.2, height: 7 }, '三2', {
        fontSize: 5.5,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(21.2, 45.7, '<rect x="0" y="0" width="21.2" height="2.5" fill="#1d4ed8"/>'),
  }, true),
  pp('a4-56up', {
    id: 'ppSerial56H',
    name: '竖版·资产序号贴',
    category: 'life',
    description: '21.2×52.5 mm 竖向细格（横向进纸），编号竖排贴设备侧面与档案盒背脊。',
    scenario: 'A4 五十六格不干胶专用 · 横版',
    accent: '#475569',
    sampleData: { serial: 'A-018' },
    demoDataset: 'asset',
    fields: [
      fixed('cap', '前缀', { x: 4, y: 6, width: 13.2, height: 7 }, 'No.', {
        fontSize: 6.5,
      }),
      text('serial', '编号', { x: 4, y: 16, width: 13.2, height: 28 }, 'A-018', {
        fontSize: 9,
        fontWeight: 'bold',
        maxLines: 5,
        lineHeight: 1.1,
        emphasis: 'hero',
      }),
    ],
  }, {
    decorSvg: svg(21.2, 52.5, '<rect x="4" y="47" width="13.2" height="0.3" fill="#cbd5e1"/>'),
  }, true),
  pp('a4-65up-round', {
    id: 'ppKidsName65rH',
    name: '竖版·防水迷你姓名贴',
    category: 'kids',
    description: '21.2×38.1 mm 竖向迷你格（横向进纸），姓名竖排贴铅笔、橡皮与餐具柄。',
    scenario: 'A4 圆角六十五格专用 · 横版',
    accent: '#e11d48',
    sampleData: { name: '王小明' },
    demoDataset: 'kids',
    fields: [
      text('name', '姓名', { x: 5.5, y: 4, width: 10.2, height: 30 }, '王小明', {
        fontSize: 8.5,
        fontWeight: 'bold',
        maxLines: 3,
        lineHeight: 1.05,
        emphasis: 'hero',
      }),
    ],
  }, {
    decorSvg: svg(21.2, 38.1, '<rect x="0" y="0" width="21.2" height="2.5" fill="#e11d48"/>'),
  }, true),
  pp('avery-5160', {
    id: 'ppFileSide5160H',
    name: '竖版·文件侧签',
    category: 'life',
    description: '25.4×66.68 mm 竖长格（横向进纸），收件人或卷宗题名竖排，贴文件夹侧边。',
    scenario: 'Avery 5160 纸型专用 · 横版',
    accent: '#92400e',
    sampleData: { item: '会议纪要' },
    fields: [
      text('item', '题名', { x: 7, y: 6, width: 11.4, height: 54 }, '会议纪要', {
        fontSize: 9,
        fontWeight: 'bold',
        maxLines: 6,
        lineHeight: 1.2,
        emphasis: 'hero',
      }),
    ],
  }, {
    decorSvg: svg(25.4, 66.68, '<rect x="0" y="0" width="25.4" height="3" fill="#92400e"/>'),
  }, true),
  pp('avery-5163', {
    id: 'ppShip5163H',
    name: '竖版·包裹运输贴',
    category: 'life',
    description: '50.8×101.6 mm 竖向格（横向进纸），收件人姓名 + 地址电话竖排，贴包裹窄边。',
    scenario: 'Avery 5163 纸型专用 · 横版',
    accent: '#1d4ed8',
    sampleData: { name: '陈晓', addr: '杭州市西湖区文三路 100 号', phone: '13800000000' },
    fields: [
      text('name', '收件人', { x: 6, y: 10, width: 38.8, height: 16 }, '陈晓', {
        fontSize: 13,
        fontWeight: 'bold',
        align: 'left',
      }),
      text('addr', '地址', { x: 6, y: 34, width: 38.8, height: 32 }, '杭州市西湖区文三路 100 号', {
        fontSize: 8,
        color: INK_SOFT,
        align: 'left',
        verticalAlign: 'top',
        maxLines: 3,
        lineHeight: 1.4,
      }),
      text('phone', '电话', { x: 6, y: 74, width: 38.8, height: 9 }, '13800000000', {
        fontSize: 8,
        color: INK_MUTED,
        align: 'left',
      }),
    ],
  }, {
    decorSvg: svg(50.8, 101.6, '<rect x="6" y="28" width="38.8" height="0.3" fill="#bfdbfe"/><rect x="6" y="70" width="38.8" height="0.3" fill="#bfdbfe"/>'),
  }, true),
  pp('avery-5164', {
    id: 'ppShip5164H',
    name: '竖版·储物箱标签',
    category: 'life',
    description: '84.67×101.6 mm 竖向大格（横向进纸），物品名置顶，类别日期备注依次排列。',
    scenario: 'Avery 5164 纸型专用 · 横版',
    accent: '#0d9488',
    sampleData: { item: '冬季衣物', cat: '卧室收纳', date: '2026-03-01', note: '轻放防潮' },
    demoDataset: 'asset',
    fields: [
      text('item', '物品名', { x: 9, y: 12, width: 66.7, height: 24 }, '冬季衣物', {
        fontSize: 18,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('cat', '类别', { x: 9, y: 44, width: 40, height: 10 }, '卧室收纳', {
        fontSize: 8,
        color: INK_SOFT,
        align: 'left',
      }),
      text('date', '日期', { x: 52, y: 44, width: 23.7, height: 10 }, '2026-03-01', {
        fontSize: 7,
        color: INK_MUTED,
        align: 'right',
      }),
      text('note', '备注', { x: 9, y: 62, width: 66.7, height: 10 }, '轻放防潮', {
        fontSize: 7.5,
        color: INK_FAINT,
        align: 'left',
      }),
    ],
  }, {
    decorSvg: svg(84.67, 101.6, '<rect x="9" y="40" width="66.7" height="0.3" fill="#99f6e4"/><rect x="9" y="58" width="66.7" height="0.25" fill="#ccfbf1"/>'),
  }, true),
  pp('avery-5395', {
    id: 'ppBadge5395H',
    name: '竖版·会议名牌贴',
    category: 'event',
    description: '59.27×85.72 mm 竖向格（横向进纸），姓名居中大字 + 单位职务，作立式签到名牌。',
    scenario: 'Avery 5395 纸型专用 · 横版',
    accent: '#1d4ed8',
    sampleData: { name: '吴建平', org: '远见设计事务所', title: '创始合伙人' },
    demoDataset: 'meeting',
    fields: [
      text('name', '姓名', { x: 6, y: 18, width: 47.3, height: 26 }, '吴建平', {
        fontSize: 19,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('org', '单位', { x: 6, y: 50, width: 47.3, height: 9 }, '远见设计事务所', {
        fontSize: 7.5,
        color: INK_SOFT,
      }),
      text('title', '职务', { x: 6, y: 64, width: 47.3, height: 9 }, '创始合伙人', {
        fontSize: 7,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(59.27, 85.72, '<rect x="0" y="0" width="59.27" height="10" fill="#1d4ed8"/>'),
  }, true),

  // ================= 头部纸型补充设计 =================
  pp('a4-21up', {
    id: 'ppClassTag21',
    name: '二一·学号姓名贴',
    category: 'kids',
    description: '70×42.4 mm 二一格，左侧学号色块 + 姓名班级并列，贴课桌与作业本。',
    scenario: 'A4 二十一格不干胶专用',
    accent: '#7c3aed',
    sampleData: { no: '12', name: '王小明', className: '三年级二班' },
    demoDataset: 'kids',
    fields: [
      text('no', '学号', { x: 3, y: 12, width: 14, height: 18 }, '12', {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#ffffff',
      }),
      text('name', '姓名', { x: 20, y: 6, width: 46, height: 16 }, '王小明', {
        fontSize: 14,
        fontWeight: 'bold',
        align: 'left',
        emphasis: 'hero',
      }),
      text('className', '班级', { x: 20, y: 26, width: 46, height: 9 }, '三年级二班', {
        fontSize: 7.5,
        color: INK_MUTED,
        align: 'left',
      }),
    ],
  }, {
    decorSvg: svg(70, 42.4, '<rect x="0" y="8" width="19" height="26" fill="#7c3aed"/>'),
  }),
  pp('a4-8up', {
    id: 'ppTableCard8',
    name: '八分·培训桌牌',
    category: 'event',
    description: '105×74.25 mm 八分格，单位眉题 + 姓名大字 + 职务，作培训与会议桌面立牌。',
    scenario: 'A4 八分格不干胶专用',
    accent: '#0f766e',
    sampleData: { org: '教育局暑期研修班', name: '赵立新', title: '教研员' },
    demoDataset: 'meeting',
    fields: [
      text('org', '单位', { x: 10, y: 8, width: 85, height: 9 }, '教育局暑期研修班', {
        fontSize: 8,
        color: INK_MUTED,
        letterSpacing: 0.2,
      }),
      text('name', '姓名', { x: 10, y: 22, width: 85, height: 28 }, '赵立新', {
        fontSize: 23,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('title', '职务', { x: 10, y: 56, width: 85, height: 10 }, '教研员', {
        fontSize: 9,
        color: INK_SOFT,
      }),
    ],
  }, {
    decorSvg: svg(105, 74.25, '<rect x="0" y="0" width="105" height="3.5" fill="#0f766e"/><rect x="10" y="52.5" width="85" height="0.35" fill="#99f6e4"/>'),
  }),
  pp('a4-24up-round', {
    id: 'ppNameTag24r2',
    name: '二四·双色班级姓名贴',
    category: 'kids',
    description: '63.5×33.9 mm 圆角格，班级色条在左、姓名班级右排，贴课本封面与作业本。',
    scenario: 'A4 圆角二十四格专用',
    accent: '#0d9488',
    sampleData: { name: '王小明', className: '三2班' },
    demoDataset: 'kids',
    fields: [
      text('name', '姓名', { x: 18, y: 6, width: 42, height: 14 }, '王小明', {
        fontSize: 12.5,
        fontWeight: 'bold',
        align: 'left',
        emphasis: 'hero',
      }),
      text('className', '班级', { x: 18, y: 22, width: 42, height: 8 }, '三2班', {
        fontSize: 7,
        color: INK_SOFT,
        align: 'left',
      }),
    ],
  }, {
    decorSvg: svg(63.5, 33.9, '<rect x="0" y="0" width="14" height="33.9" fill="#0d9488"/>'),
  }),
  pp('a4-30up', {
    id: 'ppSupplyTag30',
    name: '三十·学具姓名贴',
    category: 'kids',
    description: '70×29.7 mm 三十格，姓名靠左 + 学号靠右 + 班级在下，贴文具盒与学具袋。',
    scenario: 'A4 三十格不干胶专用',
    accent: '#1d4ed8',
    sampleData: { name: '王小明', no: '12', className: '三年级二班' },
    demoDataset: 'kids',
    fields: [
      text('name', '姓名', { x: 5, y: 4, width: 42, height: 13 }, '王小明', {
        fontSize: 11,
        fontWeight: 'bold',
        align: 'left',
      }),
      text('no', '学号', { x: 50, y: 4, width: 15, height: 13 }, '12', {
        fontSize: 10,
        fontWeight: 'bold',
        color: INK_SOFT,
        align: 'right',
      }),
      text('className', '班级', { x: 5, y: 19, width: 60, height: 8 }, '三年级二班', {
        fontSize: 7,
        color: INK_MUTED,
        align: 'left',
      }),
    ],
  }, {
    decorSvg: svg(70, 29.7, '<rect x="0" y="0" width="70" height="2" fill="#1d4ed8"/>'),
  }),
  pp('avery-5160', {
    id: 'ppReceiver5160',
    name: '5160·收件人地址贴',
    category: 'life',
    description: '66.68×25.4 mm 三十格，收件人 + 地址 + 电话三行紧凑排，贴信封与包裹。',
    scenario: 'Avery 5160 纸型专用',
    accent: '#b45309',
    sampleData: { name: '陈晓', addr: '杭州市西湖区文三路 100 号', phone: '13800000000' },
    fields: [
      fixed('cap', '前缀', { x: 4, y: 3, width: 10, height: 7 }, '收件', {
        fontSize: 6,
      }),
      text('name', '收件人', { x: 16, y: 2, width: 46.7, height: 9 }, '陈晓', {
        fontSize: 9,
        fontWeight: 'bold',
        align: 'left',
      }),
      text('addr', '地址', { x: 4, y: 12, width: 58.7, height: 7 }, '杭州市西湖区文三路 100 号', {
        fontSize: 6.5,
        color: INK_SOFT,
        align: 'left',
      }),
      text('phone', '电话', { x: 4, y: 20, width: 58.7, height: 5 }, '13800000000', {
        fontSize: 6,
        color: INK_MUTED,
        align: 'left',
      }),
    ],
  }),
  pp('a4-6up', {
    id: 'ppLibZone6',
    name: '六格·图书角分区牌',
    category: 'teaching',
    description: '105×99 mm 六格，分区名超大字 + 规则一句话，贴图书角与教具柜格口。',
    scenario: 'A4 六格不干胶专用',
    accent: '#b91c1c',
    sampleData: { zone: '绘本区', rule: '看完请放回原处' },
    demoDataset: 'classroom',
    fields: [
      text('zone', '分区名', { x: 10, y: 22, width: 85, height: 36 }, '绘本区', {
        fontSize: 28,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('rule', '提示', { x: 10, y: 66, width: 85, height: 11 }, '看完请放回原处', {
        fontSize: 9.5,
        color: INK_SOFT,
      }),
    ],
  }, {
    decorSvg: svg(105, 99, '<rect x="0" y="0" width="105" height="10" fill="#b91c1c"/>'),
  }),
  pp('a4-10up', {
    id: 'ppSeatCard10',
    name: '十格·婚宴席位平卡',
    category: 'wedding',
    description: '105×59.4 mm 十格，姓名大字 + 桌次身份，平放于婚宴与宴会席位。',
    scenario: 'A4 十格价签专用',
    accent: '#be185d',
    sampleData: { name: '陈静怡', table: '第 5 桌', role: '新娘同事' },
    demoDataset: 'wedding',
    fields: [
      text('name', '姓名', { x: 10, y: 12, width: 85, height: 26 }, '陈静怡', {
        fontSize: 21,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('table', '桌次', { x: 10, y: 42, width: 40, height: 10 }, '第 5 桌', {
        fontSize: 9,
        color: INK_SOFT,
        align: 'left',
      }),
      text('role', '身份', { x: 55, y: 42, width: 40, height: 10 }, '新娘同事', {
        fontSize: 8,
        color: INK_MUTED,
        align: 'right',
      }),
    ],
  }, {
    decorSvg: svg(105, 59.4, '<rect x="10" y="39" width="85" height="0.3" fill="#f9a8d4"/>'),
  }),
  pp('a4-18up-round', {
    id: 'ppOpenDate18r',
    name: '十八·开封记录贴',
    category: 'life',
    description: '63.5×46.6 mm 圆角格，开封日期大字 + 限用期限，贴护肤品、药品与食品罐。',
    scenario: 'A4 圆角十八格不干胶专用',
    accent: '#0f766e',
    sampleData: { name: '精华液', open: '2026-03-01', expiry: '12 个月内' },
    fields: [
      fixed('cap', '标签', { x: 8, y: 6, width: 47.5, height: 8 }, '开封日期', {
        fontSize: 7,
        letterSpacing: 0.2,
      }),
      text('name', '品名', { x: 8, y: 15, width: 47.5, height: 11 }, '精华液', {
        fontSize: 9,
        fontWeight: 'bold',
        align: 'left',
      }),
      text('open', '开封', { x: 8, y: 28, width: 47.5, height: 10 }, '2026-03-01', {
        fontSize: 9.5,
        color: '#0f766e',
        fontWeight: 'bold',
      }),
      text('expiry', '限期', { x: 8, y: 39, width: 47.5, height: 7 }, '12 个月内', {
        fontSize: 6.5,
        color: INK_MUTED,
      }),
    ],
  }, {
    decorSvg: svg(63.5, 46.6, '<rect x="8" y="26" width="47.5" height="0.3" fill="#99f6e4"/>'),
  }),
]
