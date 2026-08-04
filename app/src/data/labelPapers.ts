/**
 * 国产常见 A4 不干胶分切纸型库（单一数据源）：
 * - /studio 纸张设置「按纸型选择」：选型号自动锁定行列/尺寸/边距/间距；
 * - /papers 与 /papers/:slug SEO 落地页：规格参数 + 适用模板推荐；
 * - 几何换算见 src/utils/labelPaper.ts（边距由居中排版推导，单测覆盖）。
 *
 * 规格说明：均为 A4（210 × 297 mm）整张分切；直角规格多为无间距满切，
 * 圆角规格参照国内电商与 Avery 兼容模切的通行尺寸。
 */

export type PaperCorner = 'square' | 'rounded'

export interface LabelPaperSpec {
  /** 路由 slug，如 a4-8up */
  slug: string
  /** 展示名，如「A4 8格（2 列 × 4 行）」 */
  name: string
  /** 常见电商叫法 / 别名 */
  aliases: string[]
  cols: number
  rows: number
  /** 单枚标签尺寸（mm） */
  labelWidth: number
  labelHeight: number
  /** 标签间距（mm），满切规格为 0 */
  gapX: number
  gapY: number
  corner: PaperCorner
  /** 圆角半径（mm），仅圆角规格 */
  cornerRadius?: number
  /** 一句话描述（列表卡片与 meta description 用） */
  description: string
  /** 典型用途 */
  uses: string[]
  /** 适用内置模板 id（对应 /templates/:slug） */
  recommendedTemplates: string[]
}

export const LABEL_PAPER_SHEET = { width: 210, height: 297 } as const

export const labelPapers: LabelPaperSpec[] = [
  {
    slug: 'a4-1up',
    name: 'A4 整版不干胶（1 格）',
    aliases: ['A4 整张不干胶', 'A4 全页标签纸', 'A4 背胶打印纸'],
    cols: 1,
    rows: 1,
    labelWidth: 210,
    labelHeight: 297,
    gapX: 0,
    gapY: 0,
    corner: 'square',
    description: 'A4 整版不裁切背胶纸，自由裁剪任意尺寸，适合海报贴、超大座位表与门贴。',
    uses: ['整页门贴 / 告示', '自由裁切任意尺寸', '教室座位表张贴'],
    recommendedTemplates: ['fullPage', 'examDoor', 'classDoor'],
  },
  {
    slug: 'a4-2up',
    name: 'A4 2格不干胶（1 列 × 2 行）',
    aliases: ['A4 二分之一切', 'A4 对开标签纸', '210×148.5 标签'],
    cols: 1,
    rows: 2,
    labelWidth: 210,
    labelHeight: 148.5,
    gapX: 0,
    gapY: 0,
    corner: 'square',
    description: 'A4 对半分切（210×148.5 mm），相当于 A5 大小，适合大门贴、场地指示与巨型桌牌。',
    uses: ['考场门贴', '场地分区指示', '大幅桌面标识'],
    recommendedTemplates: ['examDoor', 'signage', 'a5compact'],
  },
  {
    slug: 'a4-4up',
    name: 'A4 4格不干胶（2 列 × 2 行）',
    aliases: ['A4 四分切', 'A4 4枚标签纸', '105×148.5 标签'],
    cols: 2,
    rows: 2,
    labelWidth: 105,
    labelHeight: 148.5,
    gapX: 0,
    gapY: 0,
    corner: 'square',
    description: 'A4 四等分（105×148.5 mm），A6 大小，适合门牌、物资箱贴与大字告示贴。',
    uses: ['宿舍/教室门牌', '物资箱标签', '大字远视标识'],
    recommendedTemplates: ['dormDoor', 'examBag', 'large'],
  },
  {
    slug: 'a4-6up',
    name: 'A4 6格不干胶（2 列 × 3 行）',
    aliases: ['A4 六分切', 'A4 6枚标签纸', '105×99 标签'],
    cols: 2,
    rows: 3,
    labelWidth: 105,
    labelHeight: 99,
    gapX: 0,
    gapY: 0,
    corner: 'square',
    description: 'A4 六等分（105×99 mm），适合大号桌贴、货架分区与签到分区贴。',
    uses: ['大号课桌贴', '货架分区标签', '签到分区指示'],
    recommendedTemplates: ['large', 'warehouseShelf', 'checkinZone'],
  },
  {
    slug: 'a4-8up',
    name: 'A4 8格不干胶（2 列 × 4 行）',
    aliases: ['A4 8格标签纸', 'A4 八分切', '105×74 标签'],
    cols: 2,
    rows: 4,
    labelWidth: 105,
    labelHeight: 74.25,
    gapX: 0,
    gapY: 0,
    corner: 'square',
    description: '最常见的 A4 8格分切（105×74.25 mm），大字清晰，考场桌贴与培训桌牌首选。',
    uses: ['中高考考场桌贴', '培训班桌牌', '家长会桌贴'],
    recommendedTemplates: ['gaokaoDesk', 'large', 'trainingDesk'],
  },
  {
    slug: 'a4-8up-round',
    name: 'A4 8格圆角不干胶（99.1×67.7）',
    aliases: ['8格圆角标签', 'Avery L7165 兼容', '99.1×67.7 标签'],
    cols: 2,
    rows: 4,
    labelWidth: 99.1,
    labelHeight: 67.7,
    gapX: 2.5,
    gapY: 0,
    corner: 'rounded',
    cornerRadius: 3,
    description: '国际通行 99.1×67.7 mm 8格圆角模切，撕取顺手不伤边，快递面单同款版式。',
    uses: ['考场桌贴（免裁切）', '物流/资产标签', '大号姓名贴'],
    recommendedTemplates: ['standard', 'gaokaoDesk', 'assetTag'],
  },
  {
    slug: 'a4-10up',
    name: 'A4 10格不干胶（2 列 × 5 行）',
    aliases: ['A4 10格标签纸', 'A4 十分切', '105×59.4 标签'],
    cols: 2,
    rows: 5,
    labelWidth: 105,
    labelHeight: 59.4,
    gapX: 0,
    gapY: 0,
    corner: 'square',
    description: 'A4 十等分（105×59.4 mm），尺寸接近名片略宽，桌牌、储物格与窗口牌都合适。',
    uses: ['储物柜格口贴', '窗口岗位牌', '中号桌贴'],
    recommendedTemplates: ['cubbyLabel', 'windowCounter', 'standard'],
  },
  {
    slug: 'a4-12up',
    name: 'A4 12格不干胶（2 列 × 6 行）',
    aliases: ['A4 12格标签纸', '105×49.5 标签'],
    cols: 2,
    rows: 6,
    labelWidth: 105,
    labelHeight: 49.5,
    gapX: 0,
    gapY: 0,
    corner: 'square',
    description: 'A4 十二等分（105×49.5 mm），信息量与尺寸均衡，适合含照片位或多行信息的标签。',
    uses: ['照片核验标签', '多行信息桌贴', '床位牌'],
    recommendedTemplates: ['withPhoto', 'detailed', 'dormBed'],
  },
  {
    slug: 'a4-14up-round',
    name: 'A4 14格圆角不干胶（99.1×38.1）',
    aliases: ['14格圆角标签', 'Avery L7163 兼容', '99.1×38.1 标签'],
    cols: 2,
    rows: 7,
    labelWidth: 99.1,
    labelHeight: 38.1,
    gapX: 2.5,
    gapY: 0,
    corner: 'rounded',
    cornerRadius: 3,
    description: '国际通行 99.1×38.1 mm 14格圆角模切，地址标签经典版式，也常用于信息条与档案贴。',
    uses: ['信息条标签', '档案盒侧贴', '座位信息条'],
    recommendedTemplates: ['infoStrip', 'bookLabel', 'labeled'],
  },
  {
    slug: 'a4-16up',
    name: 'A4 16格不干胶（2 列 × 8 行）',
    aliases: ['A4 16格标签纸', '105×37.1 标签'],
    cols: 2,
    rows: 8,
    labelWidth: 105,
    labelHeight: 37.1,
    gapX: 0,
    gapY: 0,
    corner: 'square',
    description: 'A4 十六等分（105×37.1 mm），一页 16 枚，考号贴与图书标签的高性价比之选。',
    uses: ['考号贴', '图书角标签', '物品归位贴'],
    recommendedTemplates: ['examNo', 'bookLabel', 'shelfCategory'],
  },
  {
    slug: 'a4-21up',
    name: 'A4 21格不干胶（3 列 × 7 行）',
    aliases: ['A4 21格标签纸', '70×42.4 标签', 'Avery 3652 兼容'],
    cols: 3,
    rows: 7,
    labelWidth: 70,
    labelHeight: 42.4,
    gapX: 0,
    gapY: 0,
    corner: 'square',
    description: '经典 3×7 满切（70×42.4 mm），欧标通行规格，考场座签与姓名贴的黄金尺寸。',
    uses: ['考场座位贴', '姓名贴', '设备编号贴'],
    recommendedTemplates: ['standard', 'deskName', 'assetTag'],
  },
  {
    slug: 'a4-24up-round',
    name: 'A4 24格圆角不干胶（63.5×33.9）',
    aliases: ['24格圆角标签', 'Avery L7159 兼容', '63.5×33.9 标签'],
    cols: 3,
    rows: 8,
    labelWidth: 63.5,
    labelHeight: 33.9,
    gapX: 2.5,
    gapY: 0,
    corner: 'rounded',
    cornerRadius: 2.5,
    description: '国际通行 63.5×33.9 mm 24格圆角模切，撕取即用零裁切，批量座签效率之王。',
    uses: ['考场座位贴（免裁切）', '批量姓名贴', '地址标签'],
    recommendedTemplates: ['standard', 'minimal', 'deskName'],
  },
  {
    slug: 'a4-30up',
    name: 'A4 30格不干胶（3 列 × 10 行）',
    aliases: ['A4 30格标签纸', '70×29.7 标签'],
    cols: 3,
    rows: 10,
    labelWidth: 70,
    labelHeight: 29.7,
    gapX: 0,
    gapY: 0,
    corner: 'square',
    description: '3×10 满切（70×29.7 mm），一页 30 枚，小尺寸座位号贴与物品贴的经济版式。',
    uses: ['座位号贴', '学生物品贴', '钥匙/工具编号'],
    recommendedTemplates: ['seatOnly', 'kidsName', 'assetTag'],
  },
  {
    slug: 'a4-40up',
    name: 'A4 40格不干胶（4 列 × 10 行）',
    aliases: ['A4 40格标签纸', '52.5×29.7 标签'],
    cols: 4,
    rows: 10,
    labelWidth: 52.5,
    labelHeight: 29.7,
    gapX: 0,
    gapY: 0,
    corner: 'square',
    description: '4×10 满切（52.5×29.7 mm），一页 40 枚，大批量小标签场景的省纸首选。',
    uses: ['大批量座位号', '文具/教材贴', '仓储小标签'],
    recommendedTemplates: ['seatOnly', 'minimal', 'shelfCategory'],
  },
  {
    slug: 'a4-44up-round',
    name: 'A4 44格圆角不干胶（48.5×25.4）',
    aliases: ['44格圆角标签', 'Avery L7654 兼容', '48.5×25.4 标签'],
    cols: 4,
    rows: 11,
    labelWidth: 48.5,
    labelHeight: 25.4,
    gapX: 0,
    gapY: 0,
    corner: 'rounded',
    cornerRadius: 2,
    description: '48.5×25.4 mm 44格圆角模切，一页 44 枚，条码贴与迷你姓名贴常用版式。',
    uses: ['条码/编号贴', '迷你姓名贴', '试卷袋贴'],
    recommendedTemplates: ['minimal', 'kidsName', 'examBag'],
  },
  {
    slug: 'a4-65up-round',
    name: 'A4 65格圆角不干胶（38.1×21.2）',
    aliases: ['65格圆角标签', 'Avery L7651 兼容', '38.1×21.2 标签'],
    cols: 5,
    rows: 13,
    labelWidth: 38.1,
    labelHeight: 21.2,
    gapX: 2.5,
    gapY: 0,
    corner: 'rounded',
    cornerRadius: 2,
    description: '国际通行 38.1×21.2 mm 65格圆角模切，一页 65 枚，超小标签密度之最。',
    uses: ['小件物品贴', '价格/编号贴', '幼儿姓名小贴'],
    recommendedTemplates: ['kidsName', 'minimal', 'seatOnly'],
  },
]

export function findLabelPaper(slug: string): LabelPaperSpec | undefined {
  return labelPapers.find((p) => p.slug === slug)
}
