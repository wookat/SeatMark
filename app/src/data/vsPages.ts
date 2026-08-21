/**
 * /vs 对比页矩阵内容库。
 * 对比结论全部取自仓库竞品实测记录（docs/competitive-round3.md、docs/competitive-analysis.md），
 * 措辞客观：如实标注对方领先/持平项，不贬损、不编造对方功能。
 */

export interface VsDimension {
  /** 对比维度名 */
  dimension: string
  /** 对方表现（实测结论原样陈述） */
  competitor: string
  /** SeatMark 表现 */
  seatmark: string
}

export interface VsFaq {
  q: string
  a: string
}

export interface VsPage {
  slug: string
  /** 对方产品名（表头与正文用） */
  competitorName: string
  /** 页面 H1 */
  heading: string
  /** <title>（不含站名后缀） */
  seoTitle: string
  seoDescription: string
  /** 引言：一段话说明两者各自适合谁 */
  intro: string
  /** 对方的长处（如实致意，放在对照表之前） */
  competitorStrengths: string[]
  dimensions: VsDimension[]
  faqs: VsFaq[]
  /** 相关教程内链 */
  relatedGuides: { label: string; to: string }[]
  /** 调研时间（数据口径披露用） */
  researchDate: string
}

/** 全部对比页共用的 SeatMark 差异化亮点 */
export const SEATMARK_HIGHLIGHTS = [
  { title: '打印校准 ≤0.35mm', text: '打印一张标尺校准页、量两条线，全局偏移自动补偿，实测误差不超过 0.35mm。' },
  { title: '17 款纸型双向适配', text: '选纸型自动锁定行列与边距，选模板也能反查可用纸型，打印即对版。' },
  { title: 'Excel 格式保真', text: '多 sheet 导入，文本型数字、日期、前导零不被破坏，表头自动匹配字段。' },
  { title: '照片批量匹配', text: '照片按文件名自动对应到名单，人证核验标签一次生成。' },
  { title: '生僻字扩展字库', text: '内置生僻字检测与扩展字库，名单里的冷僻姓名不缺字。' },
  { title: '名单不出浏览器', text: 'Excel 名单与照片全部在浏览器本地解析排版，不上传任何服务器。' },
] as const

export const vsPages: VsPage[] = [
  {
    slug: 'chuangkit',
    competitorName: '创客贴',
    heading: 'SeatMark 与创客贴怎么选？桌牌台签制作对比',
    seoTitle: 'SeatMark 和创客贴哪个适合做桌牌台签？批量生成对比',
    seoDescription:
      'SeatMark 座签与创客贴做会议桌牌/台签的实测对比：名单批量生成、登录门槛、打印拼版与裁切线、隐私处理、价格逐项对照，帮你按场景选对工具。',
    intro:
      '创客贴是国民级在线设计平台，桌牌台签模板设计质感高，还有设计到印刷下单的一站式闭环；SeatMark 则专注「名单 → 批量标签」的打印场景。如果你要为整份名单批量出桌牌并自行打印，两者的差异集中在批量能力与打印精度上。',
    competitorStrengths: [
      '桌牌台签品类模板数十款，整体设计质感高',
      '支持在线印刷下单，设计到成品一站式（其独有闭环）',
      '通用设计能力强，海报、封面等其他物料也能做',
    ],
    dimensions: [
      {
        dimension: 'Excel 名单批量生成',
        competitor: '无名单批量功能，一次编辑一张',
        seatmark: 'Excel/CSV 多 sheet 导入、表头自动匹配，整份名单一键生成',
      },
      {
        dimension: '使用门槛',
        competitor: '进入编辑器需微信扫码登录',
        seatmark: '免登录可用全部功能（带水印导出不限次）',
      },
      {
        dimension: '打印拼版与裁切',
        competitor: '桌牌品类无 A4 多枚拼版概念，自行打印无裁切线支持',
        seatmark: 'A4/A5/A3 毫米级拼版、裁切线，17 款不干胶纸型自动对版',
      },
      {
        dimension: '打印校准',
        competitor: '无校准工具',
        seatmark: '校准向导补偿打印机偏移，实测 ≤0.35mm',
      },
      {
        dimension: '数据隐私',
        competitor: '云端处理',
        seatmark: '名单与照片全程在浏览器本地处理，不上传',
      },
      {
        dimension: '价格',
        competitor: '免费导出带水印；个人会员约 ¥139 起/年',
        seatmark: '带水印导出免费不限次；专业版原价 ¥19/月，限时 0 折免费',
      },
    ],
    faqs: [
      {
        q: '什么情况下更适合用创客贴？',
        a: '只做一两张对设计感要求高的桌牌、或希望设计完直接在线下单印刷时，创客贴的模板质感与印刷闭环更合适。',
      },
      {
        q: '什么情况下更适合用 SeatMark？',
        a: '手里有一份 Excel 名单（考场、会议、活动），需要批量生成几十上百张桌牌/席卡并自行打印时，SeatMark 的名单批量、拼版裁切与打印校准是为此设计的，且免登录免费可用。',
      },
      {
        q: '对比数据从哪里来？',
        a: '来自我们 2026 年 8 月对创客贴公开页面与编辑器的实际上手记录。产品会持续迭代，具体功能以对方官网最新版本为准。',
      },
    ],
    relatedGuides: [
      { label: '会议桌牌尺寸怎么选？', to: '/guides/meeting-desk-card-size-guide' },
      { label: '在线标签工具横评', to: '/guides/online-label-tools-review' },
      { label: 'Excel 批量生成桌牌教程', to: '/guides/excel-generate-desk-cards' },
    ],
    researchDate: '2026-08',
  },
  {
    slug: 'wps-mail-merge',
    competitorName: 'WPS 邮件合并',
    heading: 'SeatMark 与 WPS 邮件合并做桌牌，哪个更省事？',
    seoTitle: 'WPS 邮件合并做桌牌 vs SeatMark 在线批量生成对比',
    seoDescription:
      '用 WPS 邮件合并批量做桌牌要建模板、走多步向导，名单一改就得重来。对比 SeatMark 在线批量生成：上传 Excel 即出打印页、改名单即时重渲、毫米级拼版与打印校准。',
    intro:
      'WPS/Word 邮件合并是老师和行政人员批量做桌牌的传统主流做法：本地处理、不依赖网络、几乎人人电脑上都有。SeatMark 把同样的「名单 → 批量桌牌」流程搬到浏览器里做成了专用工具，差异集中在操作步数与排版精度上。',
    competitorStrengths: [
      'WPS/Office 装机量大，无需了解新工具',
      '文档在本机处理，同样不需要上传名单',
      '邮件合并是通用能力，信函、证书等场景也能复用',
    ],
    dimensions: [
      {
        dimension: '操作流程',
        competitor: '先手动做模板（行高列宽、旋转文字），再走邮件合并向导多步操作',
        seatmark: '选内置模板、上传 Excel，即时预览打印页',
      },
      {
        dimension: '名单修改',
        competitor: '名单批量调整需重新走合并流程（WPS 官方社区亦如此说明）',
        seatmark: '改名单即时重新渲染，不用重来',
      },
      {
        dimension: '排版精度',
        competitor: '手动调行高列宽与缩放打印，容易跑偏',
        seatmark: '毫米级拼版 + 裁切线，校准向导实测 ≤0.35mm',
      },
      {
        dimension: '照片插入',
        competitor: '邮件合并批量插入照片步骤繁琐',
        seatmark: '照片按文件名自动匹配名单，批量带图生成',
      },
      {
        dimension: '模板资源',
        competitor: '稻壳模板库桌牌类模板量少，优质模板多需会员（约 ¥179 起/年）',
        seatmark: '222+ 款免费中文场景模板（考务/会议/校园/婚庆等）',
      },
      {
        dimension: '数据隐私',
        competitor: '本地文档处理，名单不上传',
        seatmark: '浏览器本地处理，名单同样不上传（两者持平）',
      },
    ],
    faqs: [
      {
        q: '已经很熟悉邮件合并了，有必要换吗？',
        a: '如果你的模板已经调好、名单也稳定，邮件合并完全够用。名单经常增删改、需要裁切线对版、或要批量带照片时，换 SeatMark 能省下重走向导和手动调版的时间。',
      },
      {
        q: 'SeatMark 需要联网，名单会上传吗？',
        a: '不会。页面加载后名单与照片全部在浏览器本地解析排版，和 WPS 一样数据不出你的电脑，支持 PWA 离线使用。',
      },
      {
        q: '邮件合并的详细步骤哪里有？',
        a: '我们写了一篇 WPS 邮件合并做桌牌的完整步骤教程（见下方相关教程），两种方法都讲清楚，你可以对照选择。',
      },
    ],
    relatedGuides: [
      { label: 'WPS 邮件合并做桌牌完整步骤', to: '/guides/wps-mail-merge-desk-card-steps' },
      { label: 'WPS/Word 邮件合并与在线工具对比', to: '/guides/wps-word-mail-merge-vs-online' },
      { label: 'Excel 批量生成桌牌教程', to: '/guides/excel-generate-desk-cards' },
    ],
    researchDate: '2026-08',
  },
  {
    slug: 'placecard-us',
    competitorName: 'placecard.us',
    heading: 'SeatMark 与 placecard.us（中文站）席位卡工具对比',
    seoTitle: 'SeatMark 和 placecard.us 哪个好？席位卡在线制作对比',
    seoDescription:
      'placecard.us 中文站与 SeatMark 座签实测对比：Excel 导入、纸型与裁切线、打印校准、模板场景、水印与价格逐项对照。婚礼欧美风选前者，中文考务会务批量打印选 SeatMark。',
    intro:
      'placecard.us 是海外席位卡（place card）在线生成工具，已推出完整中文站，同样主打 Excel 批量导入与浏览器本地处理。两者模式相近，差异集中在模板场景、打印校准与付费方式上。',
    competitorStrengths: [
      '完整中文本地化站点，含博客、指南与帮助中心',
      'Excel/CSV/Google Sheets 导入 + 字段映射，宣称在浏览器本地读取',
      '支持 US Letter/A4/Avery 等多种纸型布局与裁切线样式',
    ],
    dimensions: [
      {
        dimension: '名单导入',
        competitor: 'Excel/CSV/Google Sheets 导入 + 字段映射',
        seatmark: 'Excel/CSV 多 sheet 导入、格式保真（无 Google Sheets 直连）',
      },
      {
        dimension: '模板场景',
        competitor: '约 100+ 款，以欧美婚礼风为主',
        seatmark: '222+ 款中文场景模板：考场座签、会议桌牌、校园证卡等',
      },
      {
        dimension: '打印校准',
        competitor: '纸型与裁切线样式可选，无校准向导',
        seatmark: '17 款纸型双向适配 + 校准向导（实测 ≤0.35mm）',
      },
      {
        dimension: '照片 / 电子墨水屏 / 座位表',
        competitor: '无照片匹配、无 eink 导出、无座位表联动',
        seatmark: '照片按文件名匹配、eink 精确像素导出、座位表一键联动桌贴',
      },
      {
        dimension: '离线使用',
        competitor: '在线使用',
        seatmark: 'PWA 支持离线使用',
      },
      {
        dimension: '价格与水印',
        competitor: '带全页水印的预览 PDF 免费；无水印导出需登录，一次性套餐 $12.9 起',
        seatmark: '带水印导出免登录免费不限次（水印仅页边小字角标）；无水印每日限次，专业版原价 ¥19/月限时 0 折免费',
      },
    ],
    faqs: [
      {
        q: '两者都说「数据在浏览器本地处理」，有区别吗？',
        a: 'placecard.us 宣称 Excel 和 CSV 在浏览器本地读取；SeatMark 则是名单、照片与排版全流程本地处理，并以此作为产品承诺写入隐私政策，且支持完全离线使用。',
      },
      {
        q: '做婚礼席位卡应该选哪个？',
        a: '偏好欧美婚礼风模板可以试 placecard.us；要中文排版、生僻字姓名不缺字、按桌分组批量打印并精确裁切，SeatMark 的婚宴席卡模板与打印校准更贴合中文婚礼场景。',
      },
      {
        q: '对比数据从哪里来？',
        a: '来自我们 2026 年 8 月对 placecard.us 中文站的实际上手记录。对方产品迭代较快，具体功能与价格以其官网最新信息为准。',
      },
    ],
    relatedGuides: [
      { label: '婚礼席位卡制作指南', to: '/guides/wedding-place-card-guide' },
      { label: '免费席位卡打印模板', to: '/guides/free-place-card-print-template' },
      { label: 'A4 座位卡尺寸与排版', to: '/guides/a4-seat-card-size-layout' },
    ],
    researchDate: '2026-08',
  },
  {
    slug: 'canva',
    competitorName: 'Canva 可画',
    heading: 'SeatMark 与 Canva 可画做会议桌牌对比',
    seoTitle: 'Canva 可画做桌牌 vs SeatMark：批量生成与打印对比',
    seoDescription:
      'Canva 可画有约 196 款会议牌模板与成熟拖拽编辑器，但无名单批量与 A4 拼版概念。对比 SeatMark：Excel 一键批量、毫米级拼版裁切、打印校准 ≤0.35mm、名单不出浏览器。',
    intro:
      'Canva 可画是国际化通用设计平台，拖拽编辑器成熟、素材库庞大，做单张精美桌牌很顺手。SeatMark 是专门的批量标签打印工具。当任务从「设计一张」变成「按名单打印一批」时，两者的差异就体现出来了。',
    competitorStrengths: [
      '会议牌模板专区约 196 款，素材库庞大，拖拽编辑器成熟',
      '通用设计平台，演示文稿、海报等其他设计需求可一站满足',
      '免费版可用，高级版 ¥168/年',
    ],
    dimensions: [
      {
        dimension: 'Excel 名单批量生成',
        competitor: '国际版有 Bulk Create（CSV 批量），中文站该能力受限且需付费',
        seatmark: '上传 Excel 名单一键批量生成，免费可用',
      },
      {
        dimension: 'A4 拼版与裁切',
        competitor: '导出 PDF 按整画布，无一页多枚拼版、裁切线、对折线概念',
        seatmark: 'A4/A5/A3 一页多枚自动拼版，裁切线与对折线齐备',
      },
      {
        dimension: '物理尺寸精度',
        competitor: '以像素为单位，无毫米级打印精度概念',
        seatmark: '毫米单位贯穿排版，校准向导实测 ≤0.35mm',
      },
      {
        dimension: '中文考务/校园场景',
        competitor: '针对中国考务、校园场景的模板极少',
        seatmark: '222+ 款中文场景模板，考场座签、课桌贴、证卡成套覆盖',
      },
      {
        dimension: '数据隐私',
        competitor: '云端处理，名单需上传',
        seatmark: '名单与照片全程浏览器本地处理，不上传',
      },
      {
        dimension: '价格',
        competitor: '免费版可用；高级版 ¥168/年',
        seatmark: '带水印导出免费不限次；专业版原价 ¥19/月，限时 0 折免费',
      },
    ],
    faqs: [
      {
        q: '什么情况下更适合用 Canva 可画？',
        a: '做单张对视觉素材要求高的桌牌、或同时还有海报/PPT 等其他设计需求时，Canva 的素材库与编辑器体验更强。',
      },
      {
        q: '什么情况下更适合用 SeatMark？',
        a: '需要按 Excel 名单批量生成几十上百张桌牌/座签并精确打印裁切时，SeatMark 的批量、拼版、校准与本地隐私是为此设计的。',
      },
      {
        q: '对比数据从哪里来？',
        a: '来自我们 2026 年 8 月对 canva.cn 公开页面的调研记录（部分页面存在访问限制，以可核实信息为准）。具体功能与价格以对方官网最新版本为准。',
      },
    ],
    relatedGuides: [
      { label: '在线标签工具横评', to: '/guides/online-label-tools-review' },
      { label: '会议桌牌尺寸怎么选？', to: '/guides/meeting-desk-card-size-guide' },
      { label: 'Excel 批量生成桌牌教程', to: '/guides/excel-generate-desk-cards' },
    ],
    researchDate: '2026-08',
  },
]

export function findVsPage(slug: string): VsPage | undefined {
  return vsPages.find((p) => p.slug === slug)
}
