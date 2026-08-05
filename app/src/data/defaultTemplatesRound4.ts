import type { LabelTemplate } from '@/types/template'

import { DEFAULT_FONT_STACK, DEFAULT_FONT_STACK_EN } from './fonts'
import { bar, fixed, gridPage, hairline, INK_FAINT, INK_MUTED, INK_SOFT, text } from './templateFactory'

/**
 * 模板库扩充 · 新类型篇（第四轮）。
 * 覆盖此前空白或稀缺的真实场景：酒店住宿、KTV 包厢、宠物寄养、
 * 月子中心、驾校培训、剧组场记、直播间设备、档案管理、绿植认养、
 * 课后托管、研学营队、社区网格、义诊活动、文体比赛（书法/棋类/电竞）、
 * 募捐义卖、失物招领、样板间标价与共享工位等。
 */

const FONT = DEFAULT_FONT_STACK
const FONT_EN = DEFAULT_FONT_STACK_EN

const base = {
  builtin: true as const,
  fontFamily: FONT,
  fontFamilyEn: FONT_EN,
  showLabelBorder: true,
}

const plainLabel = (width: number, height: number, borderColor = '#334155') => ({
  width,
  height,
  radius: 0,
  borderWidth: 0.25,
  borderColor,
  background: '#ffffff',
})

export const round4Templates: LabelTemplate[] = [
  // ---------- 酒店住宿 ----------
  {
    ...base,
    id: 'hotelDoorHanger',
    name: '酒店房门牌',
    category: 'life',
    description: '2 列 × 4 行，房号反白大字 + 房型与入住宾客信息，团队入住批量布房一步到位。',
    scenario: '酒店 / 民宿房门牌',
    accent: '#0e7490',
    sampleData: { roomNo: '1208', roomType: '高级大床房', guest: '接待：研学一团', date: '8 月 12 日—8 月 15 日' },
    label: plainLabel(90, 60, '#155e75'),
    page: gridPage('A4', 2, 4, 90, 60, 8, 6),
    fields: [
      bar('top', { x: 0, y: 0, width: 90, height: 20 }, '#0e7490'),
      text('roomNo', '房号', { x: 4, y: 2, width: 56, height: 16 }, '1208', {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#ffffff',
        background: 'transparent',
        emphasis: 'hero',
        align: 'left',
      }),
      text('roomType', '房型', { x: 60, y: 5, width: 27, height: 10 }, '高级大床房', {
        fontSize: 7,
        color: '#e0f2fe',
        background: 'transparent',
        align: 'right',
      }),
      text('guest', '接待信息', { x: 6, y: 26, width: 78, height: 12 }, '接待：研学一团', {
        fontSize: 12,
        fontWeight: 'bold',
      }),
      hairline('ln', { x: 6, y: 43, width: 78, height: 0.3 }),
      text('date', '日期', { x: 6, y: 46, width: 78, height: 9 }, '8 月 12 日—8 月 15 日', {
        fontSize: 9,
        color: INK_MUTED,
      }),
    ],
  },
  {
    ...base,
    id: 'breakfastVoucher',
    name: '早餐券位卡',
    category: 'life',
    description: '2 列 × 6 行小券式排版，房号 + 姓名 + 用餐日期，配「凭卡用餐」提示条。',
    scenario: '酒店早餐 / 团餐券位',
    accent: '#b45309',
    sampleData: { roomNo: '1208', name: '沈知遥', date: '8 月 13 日早餐' },
    label: plainLabel(90, 40, '#92400e'),
    page: gridPage('A4', 2, 6, 90, 40, 8, 4),
    fields: [
      bar('side', { x: 0, y: 0, width: 26, height: 40 }, '#b45309'),
      text('roomNo', '房号', { x: 0, y: 8, width: 26, height: 14 }, '1208', {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#ffffff',
        background: 'transparent',
        emphasis: 'hero',
      }),
      fixed('roomCap', '标注', { x: 0, y: 25, width: 26, height: 6 }, '房号', {
        fontSize: 6,
        color: '#fde68a',
        background: 'transparent',
      }),
      text('name', '姓名', { x: 30, y: 7, width: 56, height: 12 }, '沈知遥', {
        fontSize: 13,
        fontWeight: 'bold',
        align: 'left',
      }),
      text('date', '用餐日期', { x: 30, y: 21, width: 56, height: 8 }, '8 月 13 日早餐', {
        fontSize: 8.5,
        color: INK_MUTED,
        align: 'left',
      }),
      fixed('note', '提示', { x: 30, y: 31, width: 56, height: 6 }, '凭卡用餐 · 每卡限一人', {
        fontSize: 6,
        color: INK_FAINT,
        align: 'left',
      }),
    ],
  },
  // ---------- KTV / 包厢 ----------
  {
    ...base,
    id: 'ktvRoomDoor',
    name: 'KTV 包厢牌',
    category: 'life',
    description: 'A4 一页 3 枚横向门牌，包厢名大字 + 编号与容纳人数，深色底条醒目分区。',
    scenario: 'KTV / 棋牌室包厢门牌',
    accent: '#7c3aed',
    sampleData: { roomName: '星空大包', roomNo: 'V08', capacity: '建议 10–15 人' },
    label: plainLabel(180, 70, '#5b21b6'),
    page: gridPage('A4', 1, 3, 180, 70, 0, 8),
    fields: [
      bar('side', { x: 0, y: 0, width: 40, height: 70 }, '#7c3aed'),
      text('roomNo', '编号', { x: 0, y: 20, width: 40, height: 24 }, 'V08', {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#ffffff',
        background: 'transparent',
        emphasis: 'hero',
      }),
      fixed('noCap', '标注', { x: 0, y: 48, width: 40, height: 7 }, 'ROOM', {
        fontSize: 7,
        color: '#ddd6fe',
        background: 'transparent',
        letterSpacing: 0.3,
      }),
      text('roomName', '包厢名', { x: 46, y: 14, width: 128, height: 26 }, '星空大包', {
        fontSize: 30,
        fontWeight: 'bold',
        align: 'left',
        emphasis: 'hero',
      }),
      text('capacity', '容纳人数', { x: 46, y: 46, width: 128, height: 10 }, '建议 10–15 人', {
        fontSize: 11,
        color: INK_MUTED,
        align: 'left',
      }),
    ],
  },
  // ---------- 宠物寄养 ----------
  {
    ...base,
    id: 'petCageCard',
    name: '宠物寄养笼牌',
    category: 'life',
    description: '2 列 × 4 行，宠物名大字 + 品种/主人电话/喂食要点三行信息，交接不出错。',
    scenario: '宠物店 / 宠物医院寄养',
    accent: '#ea580c',
    sampleData: {
      petName: '豆豆',
      breed: '柯基 · 3 岁 · 公',
      owner: '主人：李女士 138****6688',
      feeding: '早晚各一次 · 对鸡肉过敏',
    },
    label: plainLabel(90, 55, '#c2410c'),
    page: gridPage('A4', 2, 4, 90, 55, 8, 6),
    fields: [
      bar('top', { x: 0, y: 0, width: 90, height: 3 }, '#ea580c'),
      text('petName', '宠物名', { x: 6, y: 6, width: 50, height: 16 }, '豆豆', {
        fontSize: 19,
        fontWeight: 'bold',
        align: 'left',
        emphasis: 'hero',
      }),
      text('breed', '品种信息', { x: 56, y: 10, width: 30, height: 8 }, '柯基 · 3 岁 · 公', {
        fontSize: 7,
        color: INK_MUTED,
        align: 'right',
      }),
      hairline('ln1', { x: 6, y: 25, width: 78, height: 0.3 }),
      text('owner', '主人联系', { x: 6, y: 28, width: 78, height: 9 }, '主人：李女士 138****6688', {
        fontSize: 8.5,
        color: INK_SOFT,
        align: 'left',
      }),
      text('feeding', '喂食要点', { x: 6, y: 39, width: 78, height: 11 }, '早晚各一次 · 对鸡肉过敏', {
        fontSize: 8.5,
        fontWeight: 'bold',
        color: '#c2410c',
        align: 'left',
        maxLines: 2,
      }),
    ],
  },
  // ---------- 月子中心 ----------
  {
    ...base,
    id: 'postpartumBed',
    name: '月子中心床位卡',
    category: 'life',
    description: '2 列 × 5 行，房间号色条 + 宝妈姓名、宝宝信息与责任护理师，温馨低饱和配色。',
    scenario: '月子中心 / 产后护理',
    accent: '#db2777',
    sampleData: {
      roomNo: 'B12',
      name: '陈静怡',
      baby: '宝宝：女 · 8 月 2 日出生',
      nurse: '护理师：王老师',
    },
    label: plainLabel(90, 50, '#be185d'),
    page: gridPage('A4', 2, 5, 90, 50, 8, 5),
    fields: [
      bar('side', { x: 0, y: 0, width: 22, height: 50 }, '#fbcfe8'),
      text('roomNo', '房间号', { x: 0, y: 14, width: 22, height: 16 }, 'B12', {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#9d174d',
        background: 'transparent',
        emphasis: 'hero',
      }),
      text('name', '宝妈姓名', { x: 26, y: 6, width: 60, height: 12 }, '陈静怡', {
        fontSize: 14,
        fontWeight: 'bold',
        align: 'left',
      }),
      text('baby', '宝宝信息', { x: 26, y: 21, width: 60, height: 9 }, '宝宝：女 · 8 月 2 日出生', {
        fontSize: 8,
        color: INK_SOFT,
        align: 'left',
      }),
      text('nurse', '责任护理师', { x: 26, y: 33, width: 60, height: 9 }, '护理师：王老师', {
        fontSize: 8,
        color: INK_MUTED,
        align: 'left',
      }),
    ],
  },
  // ---------- 驾校 ----------
  {
    ...base,
    id: 'drivingStudentPlate',
    name: '驾校学员车贴',
    category: 'life',
    description: '2 列 × 3 行大字车贴，教练车编号超大字 + 教练与学员批次，训练场一眼认车。',
    scenario: '驾校教练车 / 训练场',
    accent: '#16a34a',
    sampleData: { carNo: '12 号车', coach: '教练：张国强', batch: '八月 C1 周末班' },
    label: plainLabel(95, 70, '#15803d'),
    page: gridPage('A4', 2, 3, 95, 70, 6, 6),
    fields: [
      bar('top', { x: 0, y: 0, width: 95, height: 5 }, '#16a34a'),
      text('carNo', '车号', { x: 6, y: 9, width: 83, height: 32 }, '12 号车', {
        fontSize: 32,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      hairline('ln', { x: 12, y: 46, width: 71, height: 0.3 }),
      text('coach', '教练', { x: 6, y: 49, width: 83, height: 9 }, '教练：张国强', {
        fontSize: 10,
        color: INK_SOFT,
      }),
      text('batch', '批次', { x: 6, y: 59, width: 83, height: 8 }, '八月 C1 周末班', {
        fontSize: 8.5,
        color: INK_MUTED,
      }),
    ],
  },
  // ---------- 剧组场记 ----------
  {
    ...base,
    id: 'filmSlateCard',
    name: '剧组场记牌',
    category: 'event',
    description: 'A4 一页 2 枚大牌，场次/镜次超大分栏 + 片名与导演摄影信息，片场打板即用。',
    scenario: '剧组 / 短片拍摄场记',
    accent: '#111827',
    sampleData: {
      title: '《春潮再起》',
      scene: '场 24',
      shot: '镜 3',
      take: '次 7',
      crew: '导演：周野 · 摄影：陆一帆',
    },
    label: plainLabel(180, 120, '#111827'),
    page: gridPage('A4', 1, 2, 180, 120, 0, 6),
    fields: [
      bar('top', { x: 0, y: 0, width: 180, height: 22 }, '#111827'),
      text('title', '片名', { x: 8, y: 4, width: 164, height: 14 }, '《春潮再起》', {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#ffffff',
        background: 'transparent',
      }),
      text('scene', '场', { x: 8, y: 32, width: 52, height: 40 }, '场 24', {
        fontSize: 26,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('shot', '镜', { x: 64, y: 32, width: 52, height: 40 }, '镜 3', {
        fontSize: 26,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('take', '次', { x: 120, y: 32, width: 52, height: 40 }, '次 7', {
        fontSize: 26,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      hairline('lnA', { x: 60, y: 34, width: 0.3, height: 36 }),
      hairline('lnB', { x: 116, y: 34, width: 0.3, height: 36 }),
      hairline('ln', { x: 8, y: 84, width: 164, height: 0.3 }),
      text('crew', '主创', { x: 8, y: 92, width: 164, height: 12 }, '导演：周野 · 摄影：陆一帆', {
        fontSize: 11,
        color: INK_SOFT,
      }),
    ],
  },
  // ---------- 直播间设备 ----------
  {
    ...base,
    id: 'streamGearTag',
    name: '直播间设备标签',
    category: 'life',
    description: '3 列 × 8 行密排小标签，设备名 + 编号/负责人，直播间与摄影棚器材管理。',
    scenario: '直播间 / 摄影棚器材',
    accent: '#4f46e5',
    sampleData: { gear: '主机位相机', gearNo: 'CAM-01', owner: '负责人：阿凯' },
    label: plainLabel(60, 30, '#4338ca'),
    page: gridPage('A4', 3, 8, 60, 30, 4, 4),
    fields: [
      bar('side', { x: 0, y: 0, width: 3, height: 30 }, '#4f46e5'),
      text('gear', '设备名', { x: 6, y: 3, width: 50, height: 10 }, '主机位相机', {
        fontSize: 9.5,
        fontWeight: 'bold',
        align: 'left',
      }),
      text('gearNo', '编号', { x: 6, y: 15, width: 26, height: 8 }, 'CAM-01', {
        fontSize: 8,
        color: '#4338ca',
        fontWeight: 'bold',
        align: 'left',
      }),
      text('owner', '负责人', { x: 32, y: 15, width: 24, height: 8 }, '负责人：阿凯', {
        fontSize: 6,
        color: INK_MUTED,
        align: 'right',
      }),
    ],
  },
  // ---------- 档案盒脊标 ----------
  {
    ...base,
    id: 'archiveBoxSpine',
    name: '档案盒脊标',
    category: 'life',
    description: '4 列 × 2 行竖长脊标，全宗号/年度/盒号纵向排布，档案室上架整齐划一。',
    scenario: '档案盒 / 资料盒侧脊',
    accent: '#334155',
    sampleData: { fonds: '行政人事类', year: '2025 年度', boxNo: '第 018 盒', range: '卷 121—卷 136' },
    label: plainLabel(40, 120, '#1e293b'),
    page: gridPage('A4', 4, 2, 40, 120, 6, 8),
    fields: [
      bar('top', { x: 0, y: 0, width: 40, height: 6 }, '#334155'),
      text('fonds', '类别', { x: 3, y: 12, width: 34, height: 20 }, '行政人事类', {
        fontSize: 10,
        fontWeight: 'bold',
        maxLines: 2,
      }),
      hairline('ln1', { x: 6, y: 36, width: 28, height: 0.3 }),
      text('year', '年度', { x: 3, y: 42, width: 34, height: 12 }, '2025 年度', {
        fontSize: 9,
        color: INK_SOFT,
      }),
      text('boxNo', '盒号', { x: 3, y: 62, width: 34, height: 22 }, '第 018 盒', {
        fontSize: 12,
        fontWeight: 'bold',
        emphasis: 'hero',
        maxLines: 2,
      }),
      text('range', '卷号范围', { x: 3, y: 94, width: 34, height: 16 }, '卷 121—卷 136', {
        fontSize: 7,
        color: INK_MUTED,
        maxLines: 2,
      }),
    ],
  },
  // ---------- 绿植认养 ----------
  {
    ...base,
    id: 'plantAdoptTag',
    name: '绿植认养牌',
    category: 'life',
    description: '2 列 × 5 行，植物名 + 认养人与养护提示，校园班级与办公室绿植认养行动。',
    scenario: '校园 / 办公室绿植认养',
    accent: '#15803d',
    sampleData: { plant: '龟背竹', adopter: '认养人：高一（3）班 林小满', care: '每周浇水 1 次 · 散射光' },
    label: plainLabel(70, 45, '#166534'),
    page: gridPage('A4', 2, 5, 70, 45, 6, 4),
    fields: [
      bar('top', { x: 0, y: 0, width: 70, height: 3 }, '#15803d'),
      text('plant', '植物名', { x: 4, y: 6, width: 62, height: 14 }, '龟背竹', {
        fontSize: 15,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('adopter', '认养人', { x: 4, y: 23, width: 62, height: 9 }, '认养人：高一（3）班 林小满', {
        fontSize: 7.5,
        color: INK_SOFT,
      }),
      text('care', '养护提示', { x: 4, y: 34, width: 62, height: 8 }, '每周浇水 1 次 · 散射光', {
        fontSize: 6.5,
        color: INK_MUTED,
      }),
    ],
  },
  // ---------- 课后托管 ----------
  {
    ...base,
    id: 'afterSchoolPickup',
    name: '托管接送卡',
    category: 'teaching',
    description: '2 列 × 4 行接送凭证，学生姓名大字 + 班级、接送人与联系电话，离园核对更安心。',
    scenario: '课后托管 / 晚辅接送',
    accent: '#0891b2',
    sampleData: {
      name: '唐乐然',
      className: '托管 B 班',
      guardian: '接送人：唐先生（爸爸）',
      phone: '139****2266',
    },
    label: plainLabel(90, 55, '#0e7490'),
    page: gridPage('A4', 2, 4, 90, 55, 8, 6),
    fields: [
      bar('side', { x: 0, y: 0, width: 4, height: 55 }, '#0891b2'),
      text('name', '姓名', { x: 8, y: 6, width: 52, height: 16 }, '唐乐然', {
        fontSize: 18,
        fontWeight: 'bold',
        align: 'left',
        emphasis: 'hero',
      }),
      text('className', '班级', { x: 60, y: 10, width: 26, height: 8 }, '托管 B 班', {
        fontSize: 7.5,
        color: INK_MUTED,
        align: 'right',
      }),
      hairline('ln', { x: 8, y: 26, width: 78, height: 0.3 }),
      text('guardian', '接送人', { x: 8, y: 30, width: 78, height: 9 }, '接送人：唐先生（爸爸）', {
        fontSize: 9,
        color: INK_SOFT,
        align: 'left',
      }),
      text('phone', '联系电话', { x: 8, y: 41, width: 78, height: 9 }, '139****2266', {
        fontSize: 9,
        color: INK_MUTED,
        align: 'left',
      }),
    ],
  },
  // ---------- 研学营队 ----------
  {
    ...base,
    id: 'studyCampTeam',
    name: '研学营队牌',
    category: 'teaching',
    description: 'A4 一页 3 枚横牌，营队名大字 + 带队老师与集合口令，研学出行分队集合醒目。',
    scenario: '研学营 / 夏令营分队',
    accent: '#d97706',
    sampleData: { team: '飞鹰二队', leader: '带队老师：赵原', slogan: '口令：向阳而行' },
    label: plainLabel(140, 90, '#b45309'),
    page: gridPage('A4', 1, 3, 140, 90, 0, 8),
    fields: [
      bar('top', { x: 0, y: 0, width: 140, height: 8 }, '#d97706'),
      text('team', '营队名', { x: 10, y: 16, width: 120, height: 34 }, '飞鹰二队', {
        fontSize: 36,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      hairline('ln', { x: 30, y: 58, width: 80, height: 0.3 }),
      text('leader', '带队老师', { x: 10, y: 63, width: 120, height: 10 }, '带队老师：赵原', {
        fontSize: 11,
        color: INK_SOFT,
      }),
      text('slogan', '集合口令', { x: 10, y: 75, width: 120, height: 9 }, '口令：向阳而行', {
        fontSize: 9.5,
        color: INK_MUTED,
      }),
    ],
  },
  // ---------- 社区网格 ----------
  {
    ...base,
    id: 'communityGrid',
    name: '社区网格公示牌',
    category: 'life',
    description: '2 列 × 4 行，网格编号色块 + 网格员姓名与联系电话，楼栋单元公示规范清晰。',
    scenario: '社区网格化管理公示',
    accent: '#dc2626',
    sampleData: {
      gridNo: '第 6 网格',
      area: '海棠苑 7—9 栋',
      officer: '网格员：马晓芸',
      phone: '135****5577',
    },
    label: plainLabel(90, 60, '#b91c1c'),
    page: gridPage('A4', 2, 4, 90, 60, 8, 6),
    fields: [
      bar('top', { x: 0, y: 0, width: 90, height: 16 }, '#dc2626'),
      text('gridNo', '网格编号', { x: 4, y: 2, width: 82, height: 12 }, '第 6 网格', {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#ffffff',
        background: 'transparent',
        emphasis: 'hero',
      }),
      text('area', '管辖范围', { x: 6, y: 21, width: 78, height: 10 }, '海棠苑 7—9 栋', {
        fontSize: 10.5,
        fontWeight: 'bold',
      }),
      hairline('ln', { x: 6, y: 35, width: 78, height: 0.3 }),
      text('officer', '网格员', { x: 6, y: 39, width: 78, height: 8 }, '网格员：马晓芸', {
        fontSize: 8.5,
        color: INK_SOFT,
      }),
      text('phone', '联系电话', { x: 6, y: 49, width: 78, height: 8 }, '135****5577', {
        fontSize: 8.5,
        color: INK_MUTED,
      }),
    ],
  },
  // ---------- 义诊登记 ----------
  {
    ...base,
    id: 'freeClinicDesk',
    name: '义诊登记台牌',
    category: 'life',
    description: 'A4 一页 3 枚横向台牌，科室名大字 + 坐诊医生与服务内容，义诊现场分台引导。',
    scenario: '义诊 / 健康服务活动',
    accent: '#0284c7',
    sampleData: { dept: '心内科咨询', doctor: '坐诊：吴主任医师', service: '量血压 · 心电初筛 · 用药咨询' },
    label: plainLabel(180, 90, '#0369a1'),
    page: gridPage('A4', 1, 3, 180, 90, 0, 5),
    fields: [
      bar('top', { x: 0, y: 0, width: 180, height: 10 }, '#0284c7'),
      fixed('cap', '标注', { x: 10, y: 1.5, width: 160, height: 7 }, '便民义诊 · 免费服务', {
        fontSize: 7,
        color: '#e0f2fe',
        background: 'transparent',
        letterSpacing: 0.2,
      }),
      text('dept', '科室', { x: 10, y: 18, width: 160, height: 30 }, '心内科咨询', {
        fontSize: 32,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('doctor', '坐诊医生', { x: 10, y: 54, width: 160, height: 11 }, '坐诊：吴主任医师', {
        fontSize: 12,
        color: INK_SOFT,
      }),
      text('service', '服务内容', { x: 10, y: 68, width: 160, height: 10 }, '量血压 · 心电初筛 · 用药咨询', {
        fontSize: 9.5,
        color: INK_MUTED,
      }),
    ],
  },
  // ---------- 文体比赛 ----------
  {
    ...base,
    id: 'calligraphySeat',
    name: '书法比赛席签',
    category: 'event',
    description: '2 列 × 4 行，参赛编号 + 姓名大字与组别，宋体气质契合书法赛事氛围。',
    scenario: '书法 / 绘画比赛席位',
    accent: '#991b1b',
    sampleData: { entryNo: '032', name: '顾砚秋', group: '少年组 · 毛笔' },
    label: plainLabel(95, 60, '#7f1d1d'),
    page: gridPage('A4', 2, 4, 95, 60, 6, 6),
    fields: [
      bar('side', { x: 0, y: 0, width: 24, height: 60 }, '#991b1b'),
      text('entryNo', '编号', { x: 0, y: 16, width: 24, height: 20 }, '032', {
        fontSize: 17,
        fontWeight: 'bold',
        color: '#ffffff',
        background: 'transparent',
        emphasis: 'hero',
      }),
      fixed('noCap', '标注', { x: 0, y: 40, width: 24, height: 6 }, '参赛编号', {
        fontSize: 6,
        color: '#fecaca',
        background: 'transparent',
      }),
      text('name', '姓名', { x: 28, y: 10, width: 62, height: 22 }, '顾砚秋', {
        fontSize: 22,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('group', '组别', { x: 28, y: 38, width: 62, height: 10 }, '少年组 · 毛笔', {
        fontSize: 9.5,
        color: INK_MUTED,
      }),
    ],
  },
  {
    ...base,
    id: 'chessTableNo',
    name: '棋类比赛台号牌',
    category: 'event',
    description: '2 列 × 4 行台号牌，台号超大字 + 红黑双方姓名分列，象棋围棋赛场对局分台。',
    scenario: '象棋 / 围棋 / 国际象棋赛',
    accent: '#1f2937',
    sampleData: { tableNo: '台 08', playerA: '执红：程亦白', playerB: '执黑：孟千帆' },
    label: plainLabel(90, 60, '#111827'),
    page: gridPage('A4', 2, 4, 90, 60, 8, 6),
    fields: [
      text('tableNo', '台号', { x: 6, y: 4, width: 78, height: 26 }, '台 08', {
        fontSize: 26,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      hairline('ln', { x: 10, y: 34, width: 70, height: 0.3 }),
      text('playerA', '甲方', { x: 6, y: 38, width: 38, height: 16 }, '执红：程亦白', {
        fontSize: 8.5,
        color: INK_SOFT,
        maxLines: 2,
      }),
      hairline('lnV', { x: 45, y: 38, width: 0.3, height: 16 }),
      text('playerB', '乙方', { x: 46, y: 38, width: 38, height: 16 }, '执黑：孟千帆', {
        fontSize: 8.5,
        color: INK_SOFT,
        maxLines: 2,
      }),
    ],
  },
  {
    ...base,
    id: 'esportsSeat',
    name: '电竞赛位牌',
    category: 'event',
    description: 'A4 一页 3 枚横牌，选手 ID 大字 + 战队与位置，深色块碰撞排版电竞氛围拉满。',
    scenario: '电竞比赛 / 网吧赛事',
    accent: '#0f172a',
    sampleData: { playerId: 'FrostBlade', team: '战队：夜枭电子竞技俱乐部', role: '打野位 · 3 号位' },
    label: plainLabel(180, 70, '#0f172a'),
    page: gridPage('A4', 1, 3, 180, 70, 0, 8),
    fields: [
      bar('side', { x: 0, y: 0, width: 8, height: 70 }, '#0f172a'),
      bar('accentBar', { x: 8, y: 0, width: 2.5, height: 70 }, '#22d3ee'),
      text('playerId', '选手 ID', { x: 16, y: 10, width: 158, height: 30 }, 'FrostBlade', {
        fontSize: 32,
        fontWeight: 'bold',
        align: 'left',
        emphasis: 'hero',
      }),
      text('team', '战队', { x: 16, y: 44, width: 158, height: 10 }, '战队：夜枭电子竞技俱乐部', {
        fontSize: 10.5,
        color: INK_SOFT,
        align: 'left',
      }),
      text('role', '位置', { x: 16, y: 56, width: 158, height: 8 }, '打野位 · 3 号位', {
        fontSize: 8.5,
        color: INK_MUTED,
        align: 'left',
      }),
    ],
  },
  // ---------- 募捐义卖 ----------
  {
    ...base,
    id: 'donationDesk',
    name: '募捐台牌',
    category: 'event',
    description: 'A4 一页 3 枚横向台牌，项目名大字 + 发起单位与说明，义卖募捐现场庄重可信。',
    scenario: '公益募捐 / 校园义卖',
    accent: '#b91c1c',
    sampleData: {
      project: '山区图书角共建',
      org: '发起：春晖公益服务中心',
      note: '募集图书与文具 · 现场登记开具凭证',
    },
    label: plainLabel(180, 90, '#991b1b'),
    page: gridPage('A4', 1, 3, 180, 90, 0, 5),
    fields: [
      bar('top', { x: 0, y: 0, width: 180, height: 8 }, '#b91c1c'),
      bar('bottom', { x: 0, y: 84, width: 180, height: 6 }, '#b91c1c'),
      text('project', '项目名', { x: 10, y: 16, width: 160, height: 30 }, '山区图书角共建', {
        fontSize: 30,
        fontWeight: 'bold',
        emphasis: 'hero',
      }),
      text('org', '发起单位', { x: 10, y: 52, width: 160, height: 11 }, '发起：春晖公益服务中心', {
        fontSize: 12,
        color: INK_SOFT,
      }),
      text('note', '说明', { x: 10, y: 66, width: 160, height: 10 }, '募集图书与文具 · 现场登记开具凭证', {
        fontSize: 9,
        color: INK_MUTED,
      }),
    ],
  },
  // ---------- 失物招领 ----------
  {
    ...base,
    id: 'lostFoundShelf',
    name: '失物招领架标签',
    category: 'life',
    description: '2 列 × 6 行，物品名 + 拾获时间地点与认领编号，前台失物架分格管理。',
    scenario: '失物招领架 / 前台保管',
    accent: '#475569',
    sampleData: { item: '黑色折叠雨伞', found: '8 月 3 日 · 三楼阅览区', claimNo: 'LF-0812' },
    label: plainLabel(90, 40, '#334155'),
    page: gridPage('A4', 2, 6, 90, 40, 8, 4),
    fields: [
      bar('side', { x: 0, y: 0, width: 3, height: 40 }, '#475569'),
      text('item', '物品名', { x: 6, y: 4, width: 78, height: 12 }, '黑色折叠雨伞', {
        fontSize: 11,
        fontWeight: 'bold',
        align: 'left',
      }),
      text('found', '拾获信息', { x: 6, y: 18, width: 78, height: 8 }, '8 月 3 日 · 三楼阅览区', {
        fontSize: 7.5,
        color: INK_SOFT,
        align: 'left',
      }),
      text('claimNo', '认领编号', { x: 6, y: 28, width: 50, height: 8 }, 'LF-0812', {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#334155',
        align: 'left',
      }),
      fixed('note', '提示', { x: 50, y: 28, width: 34, height: 8 }, '凭有效证件认领', {
        fontSize: 6,
        color: INK_FAINT,
        align: 'right',
      }),
    ],
  },
  // ---------- 样板间标价 ----------
  {
    ...base,
    id: 'showroomPrice',
    name: '样板间标价牌',
    category: 'life',
    description: 'A4 一页 3 枚横牌，商品名 + 价格超大字与规格材质说明，家居卖场样板间体面标价。',
    scenario: '家居卖场 / 样板间标价',
    accent: '#0f766e',
    sampleData: {
      product: '云朵三人位布艺沙发',
      price: '¥ 4,980',
      spec: '规格：2.2 m · 科技布 · 含抱枕 4 只',
    },
    label: plainLabel(140, 90, '#115e59'),
    page: gridPage('A4', 1, 3, 140, 90, 0, 8),
    fields: [
      bar('top', { x: 0, y: 0, width: 140, height: 4 }, '#0f766e'),
      text('product', '商品名', { x: 8, y: 10, width: 124, height: 13 }, '云朵三人位布艺沙发', {
        fontSize: 13,
        fontWeight: 'bold',
      }),
      text('price', '价格', { x: 8, y: 28, width: 124, height: 32 }, '¥ 4,980', {
        fontSize: 38,
        fontWeight: 'bold',
        color: '#0f766e',
        emphasis: 'hero',
      }),
      hairline('ln', { x: 24, y: 68, width: 92, height: 0.3 }),
      text('spec', '规格', { x: 8, y: 72, width: 124, height: 10 }, '规格：2.2 m · 科技布 · 含抱枕 4 只', {
        fontSize: 8.5,
        color: INK_MUTED,
      }),
    ],
  },
  // ---------- 共享工位 ----------
  {
    ...base,
    id: 'sharedDesk',
    name: '共享工位轮用牌',
    category: 'life',
    description: '2 列 × 4 行，工位号大字 + 当前使用人与预约时段，灵活办公工位轮转清晰。',
    scenario: '共享办公 / 灵活工位',
    accent: '#2563eb',
    sampleData: { deskNo: 'D-16', user: '当前使用：韩梅', slot: '时段：9:00—13:00' },
    label: plainLabel(90, 55, '#1d4ed8'),
    page: gridPage('A4', 2, 4, 90, 55, 8, 6),
    fields: [
      bar('top', { x: 0, y: 0, width: 90, height: 18 }, '#2563eb'),
      text('deskNo', '工位号', { x: 4, y: 2, width: 82, height: 14 }, 'D-16', {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#ffffff',
        background: 'transparent',
        emphasis: 'hero',
      }),
      text('user', '使用人', { x: 6, y: 24, width: 78, height: 11 }, '当前使用：韩梅', {
        fontSize: 11,
        fontWeight: 'bold',
        align: 'left',
      }),
      text('slot', '时段', { x: 6, y: 38, width: 78, height: 9 }, '时段：9:00—13:00', {
        fontSize: 8.5,
        color: INK_MUTED,
        align: 'left',
      }),
    ],
  },
]
