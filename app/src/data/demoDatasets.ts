import type { DataRow, FieldMapping, LabelTemplate, TemplateCategory } from '@/types/template'
import { autoMapFields } from '@/utils/autoMap'

/**
 * 场景演示数据集：不同使用场景（考场 / 会议 / 婚宴 / 幼儿园 / 年会 / 医院 /
 * 物品档案 / 展会）对应不同的表头与数据；多款模板可共用同一套数据集。
 * 「先用演示数据体验」按当前模板解析到对应场景数据集载入。
 */
export interface DemoDataset {
  id: string
  /** 场景名，如「考场座位」 */
  name: string
  fileName: string
  headers: string[]
  rows: DataRow[]
}

const NAMES = [
  '张伟', '王芳', '李娜', '刘洋', '陈静', '杨帆', '赵磊', '黄敏',
  '周杰', '吴霞', '徐强', '孙丽', '马超', '朱琳', '胡军', '郭颖',
  '何平', '高翔', '林芳', '罗斌', '郑爽', '梁波', '谢宇', '宋健',
]

const pad2 = (n: number) => String(n).padStart(2, '0')

function buildRows(count: number, make: (i: number) => DataRow): DataRow[] {
  return Array.from({ length: count }, (_, i) => make(i))
}

const SCHOOL = '市第一中学'

/** 考场考务：考场布置 / 考号贴 / 监考巡考等 */
const examDataset: DemoDataset = {
  id: 'exam',
  name: '考场座位',
  fileName: '考场演示数据.xlsx',
  headers: ['姓名', '性别', '考场', '座位号', '准考证号', '班级', '学号', '学校', '身份证号'],
  rows: buildRows(24, (i) => ({
    姓名: NAMES[i % NAMES.length]!,
    性别: i % 2 === 0 ? '男' : '女',
    考场: `第${Math.floor(i / 12) + 1}考场`,
    座位号: pad2((i % 12) + 1),
    准考证号: String(2026061001 + i),
    班级: `高三（${(i % 6) + 1}）班`,
    学号: String(2023010101 + i),
    学校: SCHOOL,
    身份证号: `1101012008${pad2((i % 12) + 1)}${pad2((i % 28) + 1)}${String(17 + i * 2).padStart(4, '0')}`,
  })),
}

/** 班级教学：课桌姓名贴 / 班牌 / 小组桌牌等 */
const classroomDataset: DemoDataset = {
  id: 'classroom',
  name: '班级教学',
  fileName: '班级演示数据.xlsx',
  headers: ['姓名', '班级', '学号', '小组', '座位号', '科目', '老师', '学校'],
  rows: buildRows(24, (i) => ({
    姓名: NAMES[i % NAMES.length]!,
    班级: `五年级（${(i % 4) + 1}）班`,
    学号: String(2023050101 + i),
    小组: `第${(i % 6) + 1}组`,
    座位号: pad2(i + 1),
    科目: ['语文', '数学', '英语', '科学'][i % 4]!,
    老师: ['王老师', '李老师', '张老师', '刘老师'][i % 4]!,
    学校: '市实验小学',
  })),
}

/** 幼儿园：姓名贴 / 接送卡 / 床位贴 / 水杯贴等 */
const kindergartenDataset: DemoDataset = {
  id: 'kindergarten',
  name: '幼儿园',
  fileName: '幼儿园演示数据.xlsx',
  headers: ['姓名', '班级', '学号', '老师', '家长', '电话', '生日'],
  rows: buildRows(18, (i) => ({
    姓名: ['乐乐', '朵朵', '果果', '苗苗', '壮壮', '妞妞', '豆豆', '甜甜', '安安'][i % 9]! + (i >= 9 ? '·' + NAMES[i % NAMES.length]!.slice(0, 1) : ''),
    班级: ['小一班', '小二班', '中一班', '中二班', '大一班', '大二班'][i % 6]!,
    学号: pad2(i + 1),
    老师: ['陈老师', '林老师', '周老师'][i % 3]!,
    家长: NAMES[i % NAMES.length]!,
    电话: `138${String(10010000 + i * 137)}`,
    生日: `2021-${pad2((i % 12) + 1)}-${pad2((i % 28) + 1)}`,
  })),
}

/** 会议 / 办公：会议桌牌 / 工作证 / 工位牌等 */
const meetingDataset: DemoDataset = {
  id: 'meeting',
  name: '会议桌牌',
  fileName: '会议演示数据.xlsx',
  headers: ['姓名', '单位', '职务', '部门', '工号', '桌号', '座位号'],
  rows: buildRows(18, (i) => ({
    姓名: NAMES[i % NAMES.length]!,
    单位: ['星汉智能科技有限公司', '华建集团', '云启数据研究院', '中新传媒中心'][i % 4]!,
    职务: ['首席技术官', '总经理', '市场总监', '产品负责人', '高级顾问', '研究员'][i % 6]!,
    部门: ['技术部', '市场部', '战略发展部', '人力资源部'][i % 4]!,
    工号: `HZ${1001 + i}`,
    桌号: String(Math.floor(i / 6) + 1),
    座位号: pad2((i % 6) + 1),
  })),
}

/** 年会庆典：席位卡 / 抽奖号 / 颁奖席签等 */
const annualDataset: DemoDataset = {
  id: 'annual',
  name: '年会庆典',
  fileName: '年会演示数据.xlsx',
  headers: ['姓名', '部门', '桌号', '职务', '单位', '奖项', '编号'],
  rows: buildRows(24, (i) => ({
    姓名: NAMES[i % NAMES.length]!,
    部门: ['研发中心', '销售一部', '客服部', '运营部', '财务部', '行政部'][i % 6]!,
    桌号: String(Math.floor(i / 8) + 1),
    职务: ['工程师', '客户经理', '主管', '专员'][i % 4]!,
    单位: '星汉智能科技有限公司',
    奖项: ['年度优秀员工', '最佳新人奖', '卓越团队奖', '突出贡献奖'][i % 4]!,
    编号: pad2(i + 1),
  })),
}

/** 婚宴喜宴：席位卡 / 桌号牌 / 迎宾牌等 */
const weddingDataset: DemoDataset = {
  id: 'wedding',
  name: '婚宴席卡',
  fileName: '婚宴演示数据.xlsx',
  headers: ['姓名', '桌号', '桌名', '新人', '日期', '关系'],
  rows: buildRows(18, (i) => ({
    姓名: NAMES[i % NAMES.length]!,
    桌号: String(Math.floor(i / 6) + 1),
    桌名: ['同心桌', '花好桌', '月圆桌'][Math.floor(i / 6) % 3]!,
    新人: '陈嘉铭 ♥ 林晚晴',
    日期: '2026年10月1日',
    关系: ['亲属', '同学', '同事', '挚友'][i % 4]!,
  })),
}

/** 医院病区：床头卡 / 科室门牌 / 诊室牌等 */
const hospitalDataset: DemoDataset = {
  id: 'hospital',
  name: '医院床头',
  fileName: '医院演示数据.xlsx',
  headers: ['姓名', '床号', '科室', '病房号', '医生', '护士', '护理等级'],
  rows: buildRows(18, (i) => ({
    姓名: NAMES[i % NAMES.length]!,
    床号: pad2(i + 1),
    科室: ['呼吸内科', '骨科', '心内科', '普外科'][i % 4]!,
    病房号: `${3 + Math.floor(i / 6)}0${(i % 6) + 1}`,
    医生: ['王医生', '李医生', '赵医生'][i % 3]!,
    护士: ['刘护士', '陈护士', '杨护士'][i % 3]!,
    护理等级: ['一级护理', '二级护理', '三级护理'][i % 3]!,
  })),
}

/** 物品 / 档案标签：资产 / 仓储 / 档案盒等 */
const assetDataset: DemoDataset = {
  id: 'asset',
  name: '物品档案',
  fileName: '物品档案演示数据.xlsx',
  headers: ['品名', '编号', '位置', '类别', '负责人', '规格', '日期'],
  rows: buildRows(18, (i) => ({
    品名: ['激光打印机', '投影仪', '会议音响', '办公桌', '文件柜', '路由器'][i % 6]!,
    编号: `ZC-2026-${String(101 + i).padStart(4, '0')}`,
    位置: `${Math.floor(i / 6) + 1}楼${['东', '西', '南'][i % 3]!}区${pad2((i % 6) + 1)}架`,
    类别: ['电子设备', '办公家具', '网络设备'][i % 3]!,
    负责人: NAMES[i % NAMES.length]!,
    规格: ['A4 双面', '4K 高清', '标准款'][i % 3]!,
    日期: `2026-${pad2((i % 12) + 1)}-${pad2((i % 28) + 1)}`,
  })),
}

/** 展会活动：胸卡 / 展位牌 / 工作证等 */
const expoDataset: DemoDataset = {
  id: 'expo',
  name: '展会胸卡',
  fileName: '展会演示数据.xlsx',
  headers: ['姓名', '公司', '职务', '编号', '展位', '角色'],
  rows: buildRows(18, (i) => ({
    姓名: NAMES[i % NAMES.length]!,
    公司: ['星汉智能科技', '云启数据', '中新传媒', '华建集团'][i % 4]!,
    职务: ['销售总监', '产品经理', '解决方案架构师', '市场专员'][i % 4]!,
    编号: `E${String(1001 + i)}`,
    展位: `${['A', 'B', 'C'][i % 3]!}馆-${pad2((i % 9) + 1)}`,
    角色: ['参展商', '嘉宾', '工作人员', '媒体'][i % 4]!,
  })),
}

export const DEMO_DATASETS: readonly DemoDataset[] = [
  examDataset,
  classroomDataset,
  kindergartenDataset,
  meetingDataset,
  annualDataset,
  weddingDataset,
  hospitalDataset,
  assetDataset,
  expoDataset,
]

const DATASET_BY_ID = new Map(DEMO_DATASETS.map((d) => [d.id, d]))

/** 六大分类的默认数据集映射；特殊模板用 demoDataset 或覆写表指定 */
export const CATEGORY_DEMO_DATASET: Record<TemplateCategory, string> = {
  exam: 'exam',
  teaching: 'classroom',
  kids: 'kindergarten',
  event: 'meeting',
  wedding: 'wedding',
  life: 'meeting',
}

/** 分类默认之外的特殊模板覆写（按模板 id） */
export const TEMPLATE_DEMO_DATASET_OVERRIDES: Record<string, string> = {
  // 年会庆典
  lotteryNo: 'annual',
  annualDinner: 'annual',
  awardSeat: 'annual',
  retroAwardSeat: 'annual',
  retroHonorCard: 'annual',
  deluxeAnnualStar: 'annual',
  deluxeAnnualRibbon: 'annual',
  redGoldAnnual: 'annual',
  staffMealTicket: 'annual',
  // 展会活动
  expoBadgeH: 'expo',
  expoBadgeV: 'expo',
  eventBadge: 'expo',
  navyBadge: 'expo',
  techBadge: 'expo',
  boothNumber: 'expo',
  seminarSticker: 'expo',
  volunteerCard: 'expo',
  // 医院医疗
  wardBed: 'hospital',
  clinicDoor: 'hospital',
  clinicQueue: 'hospital',
  medCabinet: 'hospital',
  sampleRack: 'hospital',
  postpartumBed: 'hospital',
  freeClinicDesk: 'hospital',
  // 物品 / 档案 / 仓储
  bookLabel: 'asset',
  warehouseShelf: 'asset',
  assetTag: 'asset',
  inventoryCount: 'asset',
  archiveBoxSpine: 'asset',
  toolCabinet: 'asset',
  parcelShelf: 'asset',
  lostFoundShelf: 'asset',
  streamGearTag: 'asset',
  showroomPrice: 'asset',
}

/** 解析模板对应的演示数据集：模板显式指定 > 覆写表 > 分类默认 > 会议 */
export function resolveDemoDataset(template: LabelTemplate): DemoDataset {
  const id =
    template.demoDataset ??
    TEMPLATE_DEMO_DATASET_OVERRIDES[template.id] ??
    (template.category ? CATEGORY_DEMO_DATASET[template.category] : undefined) ??
    'meeting'
  return DATASET_BY_ID.get(id) ?? meetingDataset
}

/** 将示例值中最后一段数字随行号递增（保留补零位数），让编号类字段逐行变化 */
function varySequence(base: string, index: number): string {
  const m = /^(.*?)(\d+)(\D*)$/.exec(base)
  if (!m) return base
  const num = String(Number(m[2]) + index).padStart(m[2]!.length, '0')
  return `${m[1]}${num}${m[3]}`
}

export interface DemoExcel {
  fileName: string
  sheetName: string
  headers: string[]
  rows: DataRow[]
  /** 字段 id -> 表头 的完整映射（含数据集列与模板专属补充列） */
  mapping: FieldMapping
}

/**
 * 为模板生成可直接载入工作区的演示数据：
 * 以场景数据集为底，数据集覆盖不到的模板专属字段（如「奖项」「护理等级」之外的
 * 个别槽位）以模板自带示例值补充成列，保证每个可映射字段都有数据。
 */
export function demoExcelFor(template: LabelTemplate): DemoExcel {
  const dataset = resolveDemoDataset(template)
  const mappable = template.fields.filter(
    (f) => f.type === 'text' && f.fixedText == null && f.mirrorOf == null,
  )
  const mapping = autoMapFields(mappable, dataset.headers)
  const headers = [...dataset.headers]
  const rows = dataset.rows.map((r) => ({ ...r }))
  for (const field of mappable) {
    if (mapping[field.id]) continue
    let header = field.label || field.id
    if (headers.includes(header)) header = `${header}·${field.id}`
    headers.push(header)
    mapping[field.id] = header
    const base =
      template.sampleData?.[field.id] ??
      (field.sample && field.sample !== 'photo' ? field.sample : '') ??
      ''
    const value = base || field.label || field.id
    rows.forEach((row, i) => {
      row[header] = varySequence(value, i)
    })
  }
  return {
    fileName: dataset.fileName,
    sheetName: dataset.name,
    headers,
    rows,
    mapping,
  }
}
