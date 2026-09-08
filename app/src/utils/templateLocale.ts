import type { Locale } from '@/i18n'
import type { LabelTemplate } from '@/types/template'

/** 模板内固定文案 / 小注的 zh → en 映射；未命中原样保留 */
export const TEMPLATE_FIXED_TEXT_EN: Record<string, string> = {
  '座位号 SEAT': 'SEAT NO.',
  '座位号 SEAT NO.': 'SEAT NO.',
  'SEAT 座位': 'SEAT',
  '准考证号 EXAM NO.': 'EXAM NO.',
  '核验照片 PHOTO': 'PHOTO',
  '请对号入座 · PLEASE BE SEATED': 'PLEASE BE SEATED',
  姓名: 'NAME',
  考场: 'ROOM',
  准考证号: 'EXAM ID',
  班级: 'CLASS',
  学号: 'STUDENT ID',
  性别: 'GENDER',
  学校: 'SCHOOL',
  请对号入座: 'Please sit in your assigned seat',
  入场请核对照片与准考证信息是否一致: 'Please check the photo and exam ID at the entrance',
  入场请出示准考证与有效身份证件: 'Please show your exam ID and a valid photo ID',
  凭准考证与身份证入座: 'Seat with exam ID and photo ID',
  诚信应考: 'Exam with integrity',
  '诚信应考 · 遵守考场规则': 'Exam with integrity · Follow the rules',
  '请保持安静 · 听候叫号依次入场': 'Please keep quiet and wait to be called',
  全国硕士研究生招生考试: 'National Postgraduate Entrance Exam',
  'CET 大学英语四六级考试': 'CET-4 / CET-6',
  '艺术类专业考试 · 面试号码牌': 'Art Exam · Interview Number',
  '敬备喜宴 · 恭候光临': 'Welcome to our wedding',
  '喜结良缘 · 敬备喜筵': 'Welcome to our wedding',
  '囍 · 恭候光临': 'Welcome',
  '囍 · 我们结婚啦': 'We are getting married',
  欢迎您莅临我们的婚礼: 'Welcome to our wedding',
  '欢迎您 · 家校同心 静待花开': 'Welcome, parents',
  '欢迎您，亲爱的家长': 'Welcome, dear parents',
  同学家长席位: 'Parent seat',
  '欢聚一堂 · 共启新程': 'Together for a new journey',
  '文明宿舍 · 从我做起': 'Keep our dorm tidy',
  '好好学习 · 天天向上': 'Study hard, improve every day',
  '便民义诊 · 免费服务': 'Free clinic',
  '凭卡用餐 · 每卡限一人': 'One card per person',
  '凭卡接送 · 请妥善保管': 'Show this card at pickup',
  凭有效证件认领: 'Claim with a valid ID',
  '凭证入场 · 全程佩戴': 'Wear this pass at all times',
  '凭证巡查 · 全程佩戴': 'Wear this pass at all times',
  '你好，我是': 'Hello, I am',
  今天我是小寿星: 'Today is my birthday',
  今日小助手: "Today's helper",
  '小小新朋友 · 你好': 'Hello, new friend',
  小小嘉宾: 'Little guest',
  参赛编号: 'ENTRY NO.',
  面试序号: 'INTERVIEW NO.',
  检录号: 'CHECK-IN NO.',
  房号: 'ROOM',
  房间号: 'ROOM',
  号窗口: 'WINDOW',
  已预订: 'RESERVED',
  巡考证: 'INVIGILATOR',
  监考证: 'INVIGILATOR',
  志愿者: 'VOLUNTEER',
  访客: 'VISITOR',
  媒体: 'MEDIA',
  '接 送 卡': 'PICKUP CARD',
  '实验用样 · 请勿触碰': 'Lab sample · Do not touch',
  '沿此线对折 · 成 V 型立于桌面': 'Fold along this line',
  '底座 · 沿两条折线向内折，立成三角形': 'Base · Fold inward along both lines to form a triangle',
  '粘贴边 · 涂胶后与顶边内侧贴合': 'Glue tab · Apply glue and attach to the inside of the top edge',
  '日期：____________': 'Date: ____________',
  '保持安静 · 离座请带走随身物品': 'Keep quiet · Take your belongings when leaving',
  '先进先出 · 近效期先用': 'First in, first out · Use nearest expiry first',
  '分类存放 · 取用登记': 'Store by category · Sign out when taking',
  '取阅后请放回原分类 · 爱护图书': 'Return books to their shelf',
  '启封前请核对科目与份数 · 骑缝处加盖密封章': 'Check subject and count before opening',
  '奉献 · 友爱 · 互助 · 进步': 'Dedication · Friendship · Mutual aid · Progress',
  实盘数: 'ACTUAL COUNT',
  实验台位: 'LAB BENCH',
  岗位服务公示: 'SERVICE NOTICE',
  幸运抽奖: 'LUCKY DRAW',
  '愿前程似锦 · 未来可期': 'Wishing you a bright future',
  操作考位: 'PRACTICAL STATION',
  教学层级: 'LEVEL',
  '日拱一卒 · 功不唐捐': 'Little by little, every effort counts',
  '晨检：一摸 · 二看 · 三问 · 四查': 'Morning check: touch · look · ask · inspect',
  用毕归位: 'Return after use',
  监督签名: 'SUPERVISOR',
  社区便民服务: 'COMMUNITY SERVICE',
  '考试材料 · 启封前保密': 'Exam materials · Confidential until opened',
  '请出示邀请函或身份证件 · 感谢您的耐心等候': 'Please show your invitation or ID · Thank you for waiting',
  '请在一米线外等候 · 依次办理': 'Please wait behind the line',
  输液座: 'INFUSION SEAT',
  // 字段小注（caption）
  座位号: 'SEAT NO.',
  身份证号: 'ID NO.',
  编号: 'NO.',
  工号: 'STAFF ID',
  部门: 'DEPT.',
  职务: 'TITLE',
  岗位: 'POSITION',
  场次: 'SESSION',
  单位: 'ORG.',
  组别: 'GROUP',
  组次: 'HEAT',
  项目: 'EVENT',
  桌号: 'TABLE',
  专业: 'MAJOR',
  格号: 'CUBBY',
  楼栋: 'BUILDING',
  成员: 'MEMBERS',
  班主任: 'HOMEROOM TEACHER',
  课代表: 'CLASS REP',
  考生: 'CANDIDATE',
  宾客: 'GUEST',
  主讲人: 'SPEAKER',
  负责人: 'OWNER',
  负责教师: 'TEACHER',
  带队老师: 'LEAD TEACHER',
  驻室教师: 'TEACHER',
  教练: 'COACH',
  接待: 'HOST',
  接送人: 'GUARDIAN',
  认养人: 'ADOPTER',
  网格员: 'OFFICER',
  首席代表: 'CHIEF',
  坐诊: 'DOCTOR',
  出诊: 'DOCTOR',
  主管医生: 'DOCTOR',
  责任护士: 'NURSE',
  护理师: 'NURSE',
  执红: 'RED',
  执黑: 'BLACK',
  战队: 'TEAM',
  发起: 'BY',
  规格: 'SPEC',
  品名: 'ITEM',
  品种: 'BREED',
  产地: 'ORIGIN',
  主人: 'OWNER',
  主人电话: 'OWNER TEL',
  喂食: 'FEEDING',
  忌口: 'AVOID',
  过敏史: 'ALLERGIES',
  辣度: 'SPICY',
  宝宝: 'BABY',
  当前使用: 'IN USE BY',
  时段: 'TIME SLOT',
  时间: 'TIME',
  日期: 'DATE',
  有效期: 'VALID UNTIL',
  开放时间: 'OPEN HOURS',
  电话: 'TEL',
  内线: 'EXT.',
  监督电话: 'HOTLINE',
  区域: 'AREA',
  站点: 'STATION',
  目标: 'GOAL',
  本周目标: 'GOAL THIS WEEK',
  口令: 'MOTTO',
  关系: 'RELATION',
  到访: 'VISITING',
  值日: 'ON DUTY',
  值守: 'ON DUTY',
  管理: 'MANAGER',
  管理人: 'MANAGER',
  盘点人: 'COUNTED BY',
  经手: 'HANDLED BY',
  经办人: 'HANDLED BY',
  接收: 'RECEIVED BY',
  记者: 'REPORTER',
  纳新对象: 'RECRUITING',
  货位: 'SLOT',
  货位编号: 'SLOT NO.',
  账面: 'ON RECORD',
  封箱人: 'SEALED BY',
  密封人: 'SEALED BY',
  启封: 'OPENED',
  同时进区: 'MAX INSIDE',
  语文: 'CHINESE',
  数学: 'MATH',
  英语: 'ENGLISH',
  周一: 'MON',
  周二: 'TUE',
  周三: 'WED',
  周四: 'THU',
  周五: 'FRI',
}

const CJK_RE = /[\u4e00-\u9fff]/

/** 中英并排的固定文案（如「考试出入证 · EXAM PASS」）：去掉中文段只留英文段 */
const CJK_RUN_RE = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]+/g
const LATIN_WORD_RE = /[A-Za-z]{2,}/

function stripCjkFromBilingual(text: string): string | null {
  if (!CJK_RE.test(text) || !LATIN_WORD_RE.test(text)) return null
  const latin = text
    .replace(CJK_RUN_RE, ' ')
    .replace(/\s*·\s*/g, ' · ')
    .replace(/\s+/g, ' ')
    .replace(/^(?:\s*·\s*)+|(?:\s*·\s*)+$/g, '')
    .trim()
  return LATIN_WORD_RE.test(latin) ? latin : null
}

function localizeText(text: string): string {
  const key = text.trim()
  return TEMPLATE_FIXED_TEXT_EN[key] ?? stripCjkFromBilingual(key) ?? text
}

const ROOM_SAMPLE_RE = /^(?:考场-(\d+)|第\s*(\d+)\s*考场)$/
const TABLE_SAMPLE_RE = /^第\s*(\d+)\s*桌$/
const GROUP_SAMPLE_RE = /^第\s*(\d+)\s*组$/
/** 英文预览的占位姓名：仅用于模板橱窗示例，与用户名单无关 */
export const SAMPLE_NAME_EN = 'Alex Chen'
/** 按字段 id 的英文占位示例值：仅在原示例含中文时替换 */
export const SAMPLE_BY_FIELD_EN: Record<string, string> = {
  name: SAMPLE_NAME_EN,
  className: 'Class 9-5',
  gender: 'F',
  school: 'No. 1 High School',
  org: 'Example Institute',
  company: 'Example Co., Ltd.',
  department: 'R&D Center',
  position: 'Senior Engineer',
  teacher: 'Ms. Li',
}
/** 会议类模板的会场示例值（不走考场编号规则） */
export const SAMPLE_VALUE_EN: Record<string, string> = {
  '主会场 A 区': 'Main Hall A',
  主会场: 'Main Hall',
  面试一组: 'Interview Group 1',
  工作人员: 'STAFF',
  '嘉宾 GUEST': 'GUEST',
  '开发者 DEV': 'DEV',
  上午场: 'Morning session',
  亲友席: 'Family & friends',
  特邀贵宾: 'VIP guest',
  年度优秀员工: 'Employee of the Year',
  '教授 · 博士生导师': 'Professor',
  首席技术官: 'CTO',
  首席产品官: 'CPO',
  总经理: 'General Manager',
  副总裁: 'Vice President',
  董事长: 'Chairman',
  '院长 · 特邀报告人': 'Dean · Keynote Speaker',
  副院长: 'Vice Dean',
  创始合伙人: 'Founding Partner',
}

/** 中文字体名 → /en 展示别名（仅影响展示，不改实际 font-family 值） */
export const FONT_NAME_EN: Record<string, string> = {
  宋体: 'SimSun',
  黑体: 'SimHei',
  '黑体（微软雅黑）': 'Microsoft YaHei',
  楷体: 'KaiTi',
  仿宋: 'FangSong',
  思源黑体: 'Noto Sans SC',
  思源宋体: 'Noto Serif SC',
  霞鹜文楷: 'LXGW WenKai',
  站酷小薇: 'ZCOOL XiaoWei',
  站酷庆科黄油体: 'ZCOOL QingKe HuangYou',
  马善政楷书: 'Ma Shan Zheng',
  志莽行书: 'Zhi Mang Xing',
  龙藏手书: 'Long Cang',
}

/** 字体展示名：en 下有别名用别名，否则原名 */
export function fontDisplayName(name: string, locale: Locale): string {
  if (locale !== 'en') return name
  return FONT_NAME_EN[name.trim()] ?? name
}

/** 模板经本地化后是否仍有中文示例 / 固定文案（用于给橱窗预览外层加 lang="zh"） */
export function templateHasCjk(template: LabelTemplate): boolean {
  for (const f of template.fields) {
    if (CJK_RE.test(f.fixedText ?? '') || CJK_RE.test(f.caption ?? '') || CJK_RE.test(f.sample ?? '')) {
      return true
    }
  }
  return Object.values(template.sampleData ?? {}).some((v) => CJK_RE.test(v))
}

/** 示例值（sample / sampleData）本地化：考场编号→No. N（小注已是 ROOM，不再重复 Room），含中文的姓名/班级等→英文占位值，其余原样保留 */
function localizeSample(fieldId: string, value: string): string {
  const trimmed = value.trim()
  const room = ROOM_SAMPLE_RE.exec(trimmed)
  if (room) return `No. ${room[1] ?? room[2]}`
  const table = TABLE_SAMPLE_RE.exec(trimmed)
  if (table) return `Table ${table[1]}`
  const group = GROUP_SAMPLE_RE.exec(trimmed)
  if (group) return `Group ${group[1]}`
  const exact = SAMPLE_VALUE_EN[value.trim()]
  if (exact) return exact
  const fallback = SAMPLE_BY_FIELD_EN[fieldId]
  if (fallback && CJK_RE.test(value)) return fallback
  return value
}

function localizeSampleData(
  sampleData: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!sampleData) return sampleData
  let changed = false
  const next: Record<string, string> = {}
  for (const [id, value] of Object.entries(sampleData)) {
    const localized = localizeSample(id, value)
    if (localized !== value) changed = true
    next[id] = localized
  }
  return changed ? next : sampleData
}

/**
 * 按 locale 本地化模板中随每枚标签重复渲染的固定文案（fixedText）、字段小注（caption）
 * 以及橱窗预览的示例值（sample / sampleData）。
 * 纯函数：zh 或无命中时返回原对象；有命中时返回浅拷贝，不修改入参。
 */
export function localizeTemplateForLocale(template: LabelTemplate, locale: Locale): LabelTemplate {
  if (locale !== 'en') return template
  let changed = false
  const fields = template.fields.map((field) => {
    const fixedText = field.fixedText != null ? localizeText(field.fixedText) : field.fixedText
    const caption = field.caption != null ? localizeText(field.caption) : field.caption
    const sample = field.sample != null ? localizeSample(field.id, field.sample) : field.sample
    if (fixedText === field.fixedText && caption === field.caption && sample === field.sample) {
      return field
    }
    changed = true
    return { ...field, fixedText, caption, sample }
  })
  const sampleData = localizeSampleData(template.sampleData)
  if (sampleData !== template.sampleData) changed = true
  return changed ? { ...template, fields, sampleData } : template
}
