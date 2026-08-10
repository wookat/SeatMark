/**
 * 长尾词专题落地页内容库（竞品第三轮 G1 获客动作）。
 * 每页承接一个高意图搜索词面：首屏直达生成器 CTA + 三步用法 + FAQ + 相关模板/教程内链。
 */

export interface TopicStep {
  name: string
  text: string
}

export interface TopicFaq {
  q: string
  a: string
}

export interface TopicPage {
  /** 顶级路由路径（以 / 开头） */
  path: string
  /** 面包屑与页脚内链用的短名 */
  shortName: string
  /** 页面 H1（命中搜索词） */
  heading: string
  /** 首屏副标题 */
  subheading: string
  /** <title>（不含站名后缀） */
  seoTitle: string
  seoDescription: string
  /** 首屏主 CTA */
  cta: { label: string; to: string }
  /** 首屏次 CTA（演示数据直达） */
  secondaryCta: { label: string; to: string }
  /** 三步用法（同时输出 HowTo JSON-LD） */
  howToName: string
  steps: TopicStep[]
  /** 能力要点（首屏下方九宫格/列表） */
  features: { title: string; text: string }[]
  faqs: TopicFaq[]
  relatedLinks: { label: string; to: string }[]
}

export const topicPages: TopicPage[] = [
  {
    path: '/desk-card-generator',
    shortName: '桌牌在线生成',
    heading: '桌牌在线生成：上传名单，批量出会议桌牌打印页',
    subheading:
      '免费在线生成会议桌牌、台签、席卡：选模板、上传 Excel 名单，几秒得到 A4 对折桌牌打印页，裁切线、对折线齐备。免登录，名单不出浏览器。',
    seoTitle: '桌牌在线生成：免费批量制作会议桌牌台签 | Excel 一键生成',
    seoDescription:
      '桌牌在线生成工具：上传 Excel 名单批量生成会议桌牌、台签、席卡打印页，A4 对折双面镜像、裁切线、毫米级排版与打印校准。免费免登录，名单全程在浏览器本地处理。',
    cta: { label: '立即在线生成桌牌', to: '/studio' },
    secondaryCta: { label: '先看演示效果', to: '/studio?demo=1' },
    howToName: '在线批量生成会议桌牌',
    steps: [
      {
        name: '选桌牌模板',
        text: '从会议桌牌、领导席卡、对折台签等 222+ 款免费模板中挑一款，尺寸精确到毫米，也可自定义。',
      },
      {
        name: '上传 Excel 名单',
        text: '姓名、职务、单位等表头自动匹配字段；没有名单也可以直接粘贴文本，一行一人。',
      },
      {
        name: '预览打印或导出 PDF',
        text: '逐页预览对折效果与裁切线，直接打印或导出 A4 PDF，按线裁开对折即可摆台。',
      },
    ],
    features: [
      { title: '对折双面镜像', text: '桌牌正反两面自动镜像排版，对折后两侧都能正着读。' },
      { title: '毫米级排版', text: 'A4/A5/A3 按毫米精确拼版，打印校准向导实测偏差 ≤0.35mm。' },
      { title: '批量不限量', text: '几人到上千人的名单一次生成，改名单即时重新渲染。' },
      { title: '生僻字不缺字', text: '内置生僻字检测与扩展字库，冷僻姓名照常显示打印。' },
      { title: '免登录免费', text: '带水印导出与打印不限次数，无需注册安装。' },
      { title: '名单不上传', text: 'Excel 与照片全程在浏览器本地处理，数据不出浏览器。' },
    ],
    faqs: [
      {
        q: '桌牌在线生成后怎么打印？',
        a: '导出 A4 PDF 用普通打印机打印即可，页面自带裁切线与对折线；用 160g 以上厚纸打印效果更挺括，也可以打印后塑封或插入亚克力台签座。',
      },
      {
        q: '没有 Excel 名单能用吗？',
        a: '可以。直接把姓名粘贴进名单框，一行一人即可批量生成；有职务、单位等多字段信息时用 Excel 导入会自动匹配表头。',
      },
      {
        q: '生成的桌牌是什么尺寸？',
        a: '内置模板覆盖常见会议桌牌尺寸（如 A4 对折 210×99mm 单面），也支持自定义任意毫米尺寸，行列数与页边距自动计算。',
      },
      {
        q: '在线生成桌牌收费吗？名单安全吗？',
        a: '带水印导出完全免费不限次数（水印仅页边小字角标），无水印导出每日有免费次数。名单与照片全部在浏览器本地解析排版，不上传任何服务器。',
      },
    ],
    relatedLinks: [
      { label: '会议桌牌尺寸怎么选？', to: '/guides/meeting-desk-card-size-guide' },
      { label: 'Excel 批量生成桌牌教程', to: '/guides/excel-generate-desk-cards' },
      { label: '双面对折桌牌打印教程', to: '/guides/double-sided-tent-card-print' },
      { label: '浏览模板库', to: '/templates' },
    ],
  },
  {
    path: '/name-card-batch',
    shortName: '姓名卡片批量生成',
    heading: '姓名卡片批量生成器：名单一键出可打印的姓名卡',
    subheading:
      '粘贴名单或上传 Excel，批量生成姓名卡片、席卡、姓名贴：A4 一页多枚自动拼版、毫米级物理尺寸、裁切线齐备，打印裁开即用。免费免登录。',
    seoTitle: '姓名卡片批量生成器：免费在线制作打印姓名卡席卡',
    seoDescription:
      '姓名卡片批量生成器：粘贴名单或上传 Excel 一键生成姓名卡、席卡、姓名贴打印页。A4 自动拼版、毫米尺寸、裁切线、照片匹配与打印校准，免费免登录，名单不出浏览器。',
    cta: { label: '立即批量生成姓名卡片', to: '/studio' },
    secondaryCta: { label: '先看演示效果', to: '/studio?demo=1' },
    howToName: '批量生成可打印的姓名卡片',
    steps: [
      {
        name: '粘贴或导入名单',
        text: '把姓名粘贴进名单框（一行一人），或上传 Excel/CSV，多字段（职务/桌号/考场）自动匹配表头。',
      },
      {
        name: '选卡片样式与尺寸',
        text: '222+ 款免费模板按场景挑选，尺寸按毫米设置；选不干胶纸型可自动对版。',
      },
      {
        name: '打印或导出',
        text: 'A4 一页多枚自动拼版，带裁切线直接打印，或导出 PDF；也可按名字导出单张图片。',
      },
    ],
    features: [
      { title: 'A4 自动拼版', text: '一页多枚自动排列并生成裁切线，打印后按线裁开即用，不是逐张图片。' },
      { title: '毫米物理尺寸', text: '卡片宽高按毫米设置，配合 17 款不干胶纸型自动对版，打印不跑偏。' },
      { title: '多字段支持', text: '姓名之外还能放职务、单位、桌号、考场座位号，Excel 表头自动匹配。' },
      { title: '照片匹配', text: '照片按文件名批量对应到名单，带照片的姓名卡一次生成。' },
      { title: '免费免登录', text: '带水印导出与打印不限次数，无需注册即可使用全部功能。' },
      { title: '名单不上传', text: '名单与照片全程在浏览器本地处理，关闭页面即清空。' },
    ],
    faqs: [
      {
        q: '姓名卡片批量生成后是图片还是打印页？',
        a: '默认生成带裁切线的 A4 打印页（可导出 PDF），按线裁开即用；需要逐张图片时也支持按标签逐张导出 PNG 并打包 ZIP，文件名可按名单字段命名。',
      },
      {
        q: '一次最多能生成多少张？',
        a: '没有数量限制，几十人到上千人的名单都能一次生成，页数自动计算；改动名单后即时重新渲染，无需重来。',
      },
      {
        q: '能设置卡片的实际打印尺寸吗？',
        a: '可以。宽高按毫米设置，行列数、页边距与间距自动计算；如果用市售 A4 不干胶标签纸，选对应纸型即可自动对版。',
      },
      {
        q: '名单会被上传到服务器吗？',
        a: '不会。名单与照片全部在浏览器本地解析和排版，不上传任何服务器，支持离线使用，适合处理学生、员工等敏感名单。',
      },
    ],
    relatedLinks: [
      { label: '免费席位卡打印模板', to: '/guides/free-place-card-print-template' },
      { label: 'A4 座位卡尺寸与排版', to: '/guides/a4-seat-card-size-layout' },
      { label: '考场座位贴批量打印教程', to: '/guides/exam-seat-label-batch-print' },
      { label: '不干胶纸型库', to: '/papers' },
    ],
  },
]

export function findTopicPage(path: string): TopicPage | undefined {
  return topicPages.find((p) => p.path === path)
}
