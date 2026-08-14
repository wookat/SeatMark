import type { TemplateCategory } from '@/types/template'

/**
 * 模板二级分类：在六大场景分类之下按用途细分，
 * 支撑 200+ 模板量级下的选择器与模板库筛选。
 * 每个内置模板 id 必须且只能出现在一个二级分类中（由单元测试保证）。
 */
export interface TemplateSubcategory {
  id: string
  name: string
  /** 归属该二级分类的内置模板 id 列表 */
  templateIds: string[]
}

export const TEMPLATE_SUBCATEGORIES: Record<TemplateCategory, TemplateSubcategory[]> = {
  exam: [
    {
      id: 'exam-desk',
      name: '考场布置',
      templateIds: [
        'standard',
        'seatOnly',
        'minimal',
        'contrast',
        'large',
        'a5compact',
        'detailed',
        'labeled',
        'multiSubject',
        'gaokaoDesk',
        'kaoyanDesk',
        'mockExamDesk',
        'examDoor',
        'listeningSeat',
        'practicalExam',
        'monoSeatCard',
        'deluxeExamFocus',
      ],
    },
    {
      id: 'exam-id',
      name: '考号与证件',
      templateIds: [
        'examNo',
        'withPhoto',
        'badge',
        'cetTicket',
        'artExamNo',
        'invigilatorCard',
        'patrolCard',
      ],
    },
    {
      id: 'exam-interview',
      name: '面试口试',
      templateIds: ['fullPage', 'interviewNo', 'sportsCheck', 'oralWaiting'],
    },
    {
      id: 'exam-material',
      name: '考务物料',
      templateIds: ['examBag', 'examItemShelf', 'sealedPaperBox'],
    },
  ],
  teaching: [
    {
      id: 'teaching-desk',
      name: '教室桌贴',
      templateIds: [
        'deskName',
        'infoStrip',
        'trainingDesk',
        'parentMeeting',
        'primaryDesk',
        'juniorDesk',
        'seniorDesk',
        'gradeGroupDesk',
        'stuGroupTable',
        'monoDeskName',
        'warmDeskName',
        'warmParentSeat',
      ],
    },
    {
      id: 'teaching-class',
      name: '班级管理',
      templateIds: [
        'studentCard',
        'studentIdCard',
        'classDoor',
        'deluxeClassChalk',
        'classBrand',
        'courseSchedule',
        'parentTent',
        'dutyRoster',
        'classPostCard',
        'podiumCard',
        'honorStrip',
        'clubBooth',
        'artworkLabel',
        'warmMessage',
        'retroCertLabel',
      ],
    },
    {
      id: 'teaching-office',
      name: '教师办公',
      templateIds: ['teacherDoor', 'teacherDesk', 'homeworkBin', 'funcRoomDoor'],
    },
    {
      id: 'teaching-library',
      name: '图书阅览',
      templateIds: ['shelfCategory', 'libraryCall', 'readingSeat', 'bookshelfRange'],
    },
    {
      id: 'teaching-lab',
      name: '实验机房',
      templateIds: ['labSample', 'labBench', 'reagentShelf', 'computerSeat'],
    },
    {
      id: 'teaching-dorm',
      name: '宿舍收纳',
      templateIds: ['cubbyLabel', 'dormBed'],
    },
    {
      id: 'teaching-care',
      name: '托管研学',
      templateIds: ['afterSchoolPickup', 'studyCampTeam'],
    },
  ],
  kids: [
    {
      id: 'kids-name',
      name: '姓名与物品',
      templateIds: ['kidsName', 'kidsAnimal', 'kidsCandy', 'kidsCup', 'kidsBagCubby', 'macaronName', 'macaronCubby', 'deluxeKidsPastel'],
    },
    {
      id: 'kids-daily',
      name: '一日流程',
      templateIds: ['kidsPickup', 'morningCheck', 'kidsBed', 'kidsBus', 'kidsMeal', 'macaronMeal'],
    },
    {
      id: 'kids-class',
      name: '班级环创',
      templateIds: ['kidsBirthday', 'kidsHelper', 'kidsCorner', 'kidsGrowth', 'macaronBirthday'],
    },
  ],
  event: [
    {
      id: 'event-tent',
      name: '桌牌席卡',
      templateIds: [
        'signage',
        'deskHalf',
        'meetingTent',
        'lectureGuest',
        'vTent',
        'tentBilingual',
        'eink800',
        'roundtableCard',
        'vipSeat',
        'mediaSeat',
        'awardSeat',
        'gradSeat',
        'annualDinner',
        'deluxeConfAurora',
        'deluxeConfLines',
        'deluxeConfFret',
        'deluxeConfGeo',
        'deluxeConfGold',
        'deluxeForumWave',
        'deluxeVipMarble',
        'deluxeAnnualStar',
        'deluxeAnnualRibbon',
        'monoConfCard',
        'navyConfCard',
        'navyLectern',
        'redGoldAnnual',
        'techLaunchCard',
        'retroAwardSeat',
        'retroHonorCard',
      ],
    },
    {
      id: 'event-badge',
      name: '证件胸牌',
      templateIds: ['eventBadge', 'expoBadgeH', 'expoBadgeV', 'volunteerCard', 'seminarSticker', 'navyBadge', 'techBadge'],
    },
    {
      id: 'event-guide',
      name: '签到引导',
      templateIds: ['checkinZone', 'checkinDesk', 'guideArrow', 'subvenueDoor', 'volunteerPoint'],
    },
    {
      id: 'event-ticket',
      name: '号牌票券',
      templateIds: [
        'lotteryNo',
        'lotteryTicket',
        'raceBib',
        'boothNumber',
        'parkingPass',
        'staffMealTicket',
        'teaBreakLabel',
      ],
    },
    {
      id: 'event-culture',
      name: '文体现场',
      templateIds: [
        'calligraphySeat',
        'chessTableNo',
        'esportsSeat',
        'techEsportsSeat',
        'filmSlateCard',
        'donationDesk',
      ],
    },
  ],
  wedding: [
    {
      id: 'wedding-seat',
      name: '席位桌号',
      templateIds: [
        'weddingPlace',
        'weddingTableNo',
        'tableNoStand',
        'weddingKidsSeat',
        'anniversarySeat',
        'deluxeWedBotanic',
        'deluxeWedFoil',
        'deluxeWedArch',
        'deluxeWedRing',
        'deluxeWedBlush',
        'deluxeWedGoldDot',
        'deluxeAnnivDeco',
        'deluxeBanquetFrame',
        'redGoldWedPlace',
        'redGoldTableNo',
        'forestWedPlace',
      ],
    },
    {
      id: 'wedding-welcome',
      name: '迎宾签到',
      templateIds: ['weddingWelcome', 'weddingCheckin', 'deluxeWedLace', 'redGoldWelcome'],
    },
    {
      id: 'wedding-gift',
      name: '礼品甜品',
      templateIds: ['dessertLabel', 'weddingCandy', 'weddingThanks'],
    },
  ],
  life: [
    {
      id: 'life-office',
      name: '办公职场',
      templateIds: [
        'staffIdCard',
        'officeDesk',
        'meetingRoomDoor',
        'visitorTemp',
        'assetTag',
        'windowCounter',
        'deluxeGovGuilloche',
        'archiveBoxSpine',
        'streamGearTag',
        'sharedDesk',
      ],
    },
    {
      id: 'life-medical',
      name: '医疗健康',
      templateIds: ['clinicDoor', 'wardBed', 'clinicQueue', 'medCabinet', 'sampleRack', 'postpartumBed', 'freeClinicDesk', 'infusionSeat'],
    },
    {
      id: 'life-gov',
      name: '政务窗口',
      templateIds: ['govWindowStaff', 'queueZone', 'serviceStar'],
    },
    {
      id: 'life-food',
      name: '餐饮门店',
      templateIds: ['reservedTable', 'privateRoomDoor', 'takeoutShelf', 'dishLabel', 'drinkCup', 'dinerReserve'],
    },
    {
      id: 'life-storage',
      name: '仓储物流',
      templateIds: ['warehouseShelf', 'inventoryCount', 'parcelShelf', 'pickupZone', 'toolCabinet', 'lostFoundShelf'],
    },
    {
      id: 'life-service',
      name: '生活服务',
      templateIds: [
        'gymLocker',
        'gymClassDoor',
        'spaHook',
        'hotelWelcome',
        'bnbRoomDoor',
        'petBoarding',
        'hotelDoorHanger',
        'breakfastVoucher',
        'ktvRoomDoor',
        'petCageCard',
        'drivingStudentPlate',
        'showroomPrice',
        'freshPrice',
      ],
    },
    {
      id: 'life-community',
      name: '社区家庭',
      templateIds: [
        'bookLabel',
        'dormDoor',
        'mailboxLabel',
        'parkingSpot',
        'communityBooth',
        'plantTag',
        'plantAdoptTag',
        'communityGrid',
        'forestPlantTag',
      ],
    },
  ],
}

const idToSubcategory = new Map<string, TemplateSubcategory>()
for (const subs of Object.values(TEMPLATE_SUBCATEGORIES)) {
  for (const sub of subs) {
    for (const id of sub.templateIds) idToSubcategory.set(id, sub)
  }
}

/** 查找模板所属的二级分类（仅内置模板有归属） */
export function subcategoryOf(templateId: string): TemplateSubcategory | undefined {
  return idToSubcategory.get(templateId)
}
