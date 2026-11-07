/**
 * 长尾词专题落地页内容库（竞品第三轮 G1 获客动作）。
 * 每页承接一个高意图搜索词面：首屏直达生成器 CTA + 分步用法 + FAQ + 相关模板/教程内链。
 */

import { TEMPLATE_COUNT } from './templateMeta'

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
  /** 英文页标记（路径为 /en/…，文案为英文原生） */
  lang?: 'en'
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
  /** 分步用法（同时输出 HowTo JSON-LD） */
  howToName: string
  steps: TopicStep[]
  /** 分步用法区块标题；缺省按 steps.length 生成「N 步完成」 */
  stepsHeading?: string
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
      '免费在线生成会议桌牌、台签、席卡：选模板、上传 Excel 名单，每行出一张 A4 对折桌牌，打印页自带裁切线与对折线。不用注册，名单只在本机浏览器里解析。',
    seoTitle: '桌牌在线生成：免费批量制作会议桌牌台签 | Excel 导入生成',
    seoDescription:
      '桌牌在线生成工具：上传 Excel 名单，按行生成会议桌牌、台签、席卡打印页，A4 对折双面镜像、裁切线、毫米级排版与打印校准。免费、不用注册，名单全程在浏览器本地处理。',
    cta: { label: '立即在线生成桌牌', to: '/studio' },
    secondaryCta: { label: '先看演示效果', to: '/studio?demo=1' },
    howToName: '上传 Excel 名单，在线生成会议桌牌打印页',
    steps: [
      {
        name: '选桌牌模板',
        text: `从会议桌牌、领导席卡、对折台签等 ${TEMPLATE_COUNT} 款免费模板中挑一款，尺寸精确到毫米，也可自定义。`,
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
      { title: '批量不限量', text: '名单有多少行就输出多少张桌牌，页数自动计算；改名单后重新上传即重新渲染。' },
      { title: '生僻字不缺字', text: '内置生僻字检测与扩展字库，冷僻姓名照常显示打印。' },
      { title: '不用注册，免费用', text: '打开网页就能用，带水印导出与打印不限次数，不装软件。' },
      { title: '名单不上传', text: 'Excel 与照片只在本机浏览器里解析排版，不发送到任何服务器。' },
    ],
    faqs: [
      {
        q: '桌牌在线生成后怎么打印？',
        a: '导出 A4 PDF 用普通打印机打印即可，页面自带裁切线与对折线；用 160g 以上厚纸打印效果更挺括，也可以打印后塑封或插入亚克力台签座。',
      },
      {
        q: '没有 Excel 名单能用吗？',
        a: '可以。直接把姓名粘贴进名单框，一行一人，每行出一张桌牌；有职务、单位等多字段信息时用 Excel 导入会自动匹配表头。',
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
    heading: '姓名卡片批量生成器：粘贴名单，出一页多枚的可打印姓名卡',
    subheading:
      '粘贴名单或上传 Excel，每行一张姓名卡片、席卡或姓名贴：A4 一页多枚自动拼版、毫米级物理尺寸、裁切线齐备，打印裁开即用。免费，不用注册。',
    seoTitle: '姓名卡片批量生成器：免费在线制作打印姓名卡席卡',
    seoDescription:
      '姓名卡片批量生成器：粘贴名单或上传 Excel，按行生成姓名卡、席卡、姓名贴打印页。A4 自动拼版、毫米尺寸、裁切线、照片匹配与打印校准，免费、不用注册，名单只在浏览器本地解析。',
    cta: { label: '上传名单生成姓名卡片', to: '/studio' },
    secondaryCta: { label: '先看演示效果', to: '/studio?demo=1' },
    howToName: '用名单生成可打印的姓名卡片',
    steps: [
      {
        name: '粘贴或导入名单',
        text: '把姓名粘贴进名单框（一行一人），或上传 Excel/CSV，多字段（职务/桌号/考场）自动匹配表头。',
      },
      {
        name: '选卡片样式与尺寸',
        text: `${TEMPLATE_COUNT} 款免费模板按场景挑选，尺寸按毫米设置；选不干胶纸型可自动对版。`,
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
      { title: '照片匹配', text: '照片按「文件名 = 某列值」逐行对应到名单，未匹配的行照片位留空，面板显示匹配行数与覆盖率。' },
      { title: '免费，不用注册', text: '打开网页就能用全部功能，带水印导出与打印不限次数。' },
      { title: '名单不上传', text: '名单与照片全程在浏览器本地处理，关闭页面即清空。' },
    ],
    faqs: [
      {
        q: '生成的姓名卡片是图片还是打印页？',
        a: '默认生成带裁切线的 A4 打印页（可导出 PDF），按线裁开即用；需要逐张图片时也支持按标签逐张导出 PNG 并打包 ZIP，文件名可按名单字段命名。',
      },
      {
        q: '一次最多能生成多少张？',
        a: '没有数量限制，名单有多少行就输出多少张，页数按每页枚数自动计算；改动名单后重新上传即重新渲染，模板与字段映射保留。',
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

  // ---------- 英文落地页（原生英文，独立索引，canonical 为自身） ----------
  {
    path: '/en/place-card-generator',
    lang: 'en',
    shortName: 'Place Card Generator',
    heading: 'Place Card Generator: Turn a Guest List into Print-Ready Place Cards',
    subheading:
      'Upload a spreadsheet or paste names to batch-generate printable place cards. Pick a template, preview every card, and print at exact scale on A4, US Letter or Avery tent card stock — free, no sign-up, and your guest list never leaves your browser.',
    seoTitle: 'Free Place Card Generator from a Guest List',
    seoDescription:
      'Free place card generator: upload a guest list to batch-print place cards on Letter, A4 or Avery 5302 stock. PDF export, no sign-up, list stays in your browser.',
    cta: { label: 'Generate place cards now', to: '/en/studio' },
    secondaryCta: { label: 'Try the demo', to: '/en/studio?demo=1' },
    howToName: 'Generate printable place cards from a guest list',
    steps: [
      {
        name: 'Pick a place card template',
        text: 'Choose from wedding, banquet, holiday and minimalist styles — all sized to the millimeter and editable in the visual designer.',
      },
      {
        name: 'Upload or paste your list',
        text: 'Drop in an Excel/CSV file or paste names — headers like Name, Table and Meal Choice are matched to fields automatically.',
      },
      {
        name: 'Preview and print',
        text: 'Check every card, then print at 100% scale or export a PDF that drops onto standard Letter/A4 or Avery 5302/5305 tent stock.',
      },
    ],
    features: [
      { title: 'Batch, not one-by-one', text: 'Every row becomes a card. 150 guests means 150 cards with zero retyping.' },
      { title: 'Exact-scale printing', text: 'Millimeter-precise imposition means cut lines land where the paper expects them — no "fit to page" drift.' },
      { title: 'Avery-ready stock', text: 'Layouts for Avery 5302, 5305 and 5309 tent cards plus plain Letter/A4 cutting guides.' },
      { title: 'Table & meal fields', text: 'Table numbers, meal choices and icons print alongside names for escort-card workflows.' },
      { title: 'Privacy by design', text: 'Files are parsed locally in your browser — the guest list is never uploaded to a server.' },
      { title: 'Free to start', text: 'Open the page and print. No account, no install, works offline once loaded.' },
    ],
    faqs: [
      {
        q: 'Can I use my Google Sheets guest list?',
        a: 'Yes — download it as Excel or CSV (File → Download) and upload, or paste the names directly. See the Google Sheets tutorial linked below.',
      },
      {
        q: 'What paper should I print on?',
        a: 'Cardstock between 160–250 gsm works best. For fold-over tents, Avery 5302 (small) or 5305 (medium) blanks drop straight into the matching layout.',
      },
      {
        q: 'Does it work for escort cards too?',
        a: 'Yes — escort cards are just flat place cards with a table number. Include a Table column in your list and map it to a field.',
      },
    ],
    relatedLinks: [
      { label: 'Place cards from Google Sheets', to: '/en/guides/place-cards-from-google-sheets' },
      { label: 'Print place cards from Excel', to: '/en/guides/print-place-cards-from-excel' },
      { label: 'Escort cards vs place cards', to: '/en/guides/escort-cards-vs-place-cards' },
      { label: 'SeatMark vs placecard.us', to: '/en/vs/placecard-us' },
    ],
  },
  {
    path: '/en/name-badge-generator',
    lang: 'en',
    shortName: 'Name Badge Generator',
    heading: 'Name Badge Generator: Attendee List to Print-Ready Badges',
    subheading:
      'Turn an Eventbrite export, Excel roster or pasted list into professional name badges. First name, last name, company and role fields map automatically; print on Avery 5390/5392/5395 badge stock or plain card — free and private by design.',
    seoTitle: 'Free Name Badge Generator: Batch Badges from a List',
    seoDescription:
      'Free name badge generator: import an Eventbrite or spreadsheet list and batch-print badges on Avery 5390/5392/5395 stock. PDF export, data stays in your browser.',
    cta: { label: 'Generate badges now', to: '/en/studio' },
    secondaryCta: { label: 'Try the demo', to: '/en/studio?demo=1' },
    howToName: 'Generate printable name badges from an attendee list',
    steps: [
      {
        name: 'Choose a badge layout',
        text: 'Pick a badge template sized for Avery 5390/5392/5395 stock or a plain-card layout with cut guides.',
      },
      {
        name: 'Import the attendee list',
        text: 'Upload the Eventbrite attendee report, an Excel file, or paste names — First Name, Last Name, Company and Ticket Type map automatically.',
      },
      {
        name: 'Print or export PDF',
        text: 'Preview every badge, then print at actual size or export a PDF for the print shop — badges land exactly on the die-cut.',
      },
    ],
    features: [
      { title: 'Eventbrite-ready', text: 'The standard Eventbrite attendee export drops straight in — no column reformatting needed.' },
      { title: 'Avery badge stock', text: 'Layouts lock onto Avery 5390, 5392 and 5395 inserts so names land inside the die-cut, not across it.' },
      { title: 'Photo badges', text: 'Match headshots by filename for check-in badges and staff IDs — photos are processed locally.' },
      { title: 'Ticket-type grouping', text: 'Keep Speaker/VIP/Attendee columns on the badge to color-code roles at the door.' },
      { title: 'No server upload', text: 'Attendee PII stays in your browser — safe for corporate events with data policies.' },
      { title: 'Free, no account', text: 'Open and print immediately; login only raises the daily generation quota.' },
    ],
    faqs: [
      {
        q: 'How do I get my attendee list out of Eventbrite?',
        a: 'In Eventbrite go to Reports → Attendee report, export to Excel, and upload the file here. See the full walkthrough linked below.',
      },
      {
        q: 'Which Avery badge products are supported?',
        a: 'Letter-size layouts for 5390 (2¼×3½ in, 8-up), 5392 (3×4 in, 6-up) and 5395 (2⅓×3⅜ in, 8-up) are built in, plus generic cutting layouts.',
      },
      {
        q: 'Can I print color-coded badges by ticket type?',
        a: 'Yes — map the Ticket type column to a badge field or text, or split the list and run one batch per role with different templates.',
      },
    ],
    relatedLinks: [
      { label: 'Name badges from a spreadsheet', to: '/en/guides/name-badges-from-spreadsheet' },
      { label: 'Eventbrite list to badges tutorial', to: '/en/guides/eventbrite-attendee-badges' },
      { label: 'Place card generator', to: '/en/place-card-generator' },
      { label: 'Desk name tags for classrooms', to: '/en/guides/desk-name-tags-from-class-list' },
    ],
  },
  {
    path: '/en/tent-card-generator',
    lang: 'en',
    shortName: 'Tent Card Generator',
    heading: 'Table Tent Card Generator: Double-Sided Name Tents from a List',
    subheading:
      'Generate fold-over tent cards that read correctly on both sides — the hard part Word and Avery templates get wrong. Upload a list, preview each tent, and print on Avery 5302/5305/5309 stock or plain cardstock with fold marks.',
    seoTitle: 'Free Tent Card Generator: Double-Sided Name Tents',
    seoDescription:
      'Free tent card generator: batch-print fold-over name tents that read correctly on both sides. Layouts for Avery 5302/5305/5309 stock, PDF export, no sign-up.',
    cta: { label: 'Generate tent cards', to: '/en/studio' },
    secondaryCta: { label: 'Try the demo', to: '/en/studio?demo=1' },
    howToName: 'Generate double-sided tent cards from a list',
    steps: [
      {
        name: 'Pick a tent card template',
        text: 'Tent templates print each name twice — once upright and once rotated 180° — so both faces of the folded card read correctly.',
      },
      {
        name: 'Upload your list',
        text: 'Excel, CSV or pasted names; name, title and company headers map to fields automatically.',
      },
      {
        name: 'Print and fold',
        text: 'Print at actual size on Avery tent stock (5302 small, 5305 medium, 5309 large) or cardstock with fold marks, then fold along the score line.',
      },
    ],
    features: [
      { title: 'Both sides readable', text: 'The mirrored top half is handled automatically — no upside-down names after folding.' },
      { title: 'Real Avery geometry', text: 'Fold positions match the actual 5302/5305/5309 die-cut score lines, not a guessed halfway.' },
      { title: 'Skip the mail merge', text: 'No 20-step Word workaround: upload, preview, print.' },
      { title: 'Fold marks included', text: 'Plain-cardstock layouts print subtle fold guides so scoring is accurate.' },
      { title: 'Batch from a roster', text: 'A 200-row meeting roster becomes 200 tents in one pass.' },
      { title: 'Private by default', text: 'Lists are parsed locally in the browser — nothing is uploaded.' },
    ],
    faqs: [
      {
        q: 'Why do my Word tent cards come out upside down?',
        a: 'Word mail merge cannot mirror the top half of a folded card automatically — it is the most common tent-card complaint. Tent templates here rotate the top-half copy 180° for you.',
      },
      {
        q: 'Which Avery tent cards are supported?',
        a: '5302 (small, 4 per sheet), 5305 (medium, 2 per sheet) and 5309 (large, 1 per sheet) — all with their real score-line positions.',
      },
      {
        q: 'Can I print a logo or table number on the tent?',
        a: 'Yes — the visual designer adds images and static text; mapped fields print per-card data alongside them.',
      },
    ],
    relatedLinks: [
      { label: 'Double-sided name tents tutorial', to: '/en/guides/double-sided-name-tents' },
      { label: 'SeatMark vs Word mail merge', to: '/en/vs/wps-mail-merge' },
      { label: 'Place card generator', to: '/en/place-card-generator' },
      { label: 'Wedding table numbers', to: '/en/guides/wedding-table-numbers-printable' },
    ],
  },
  {
    path: '/en/table-plan-maker',
    lang: 'en',
    shortName: 'Table Plan Maker',
    heading: 'Wedding Table Plan Maker: Seat Guests, Print the Plan and the Cards',
    subheading:
      'The UK wedding workflow in one place: arrange guests on tables, print the table plan board, then generate matching place cards and table numbers from the same list — free, private, and sized for A4.',
    seoTitle: 'Free Table Plan Maker: Seating Plan + Place Cards (UK)',
    seoDescription:
      'Free table plan maker: arrange guests on tables, print the plan board, then batch-generate matching place cards and table numbers. A4-ready PDF export, no sign-up.',
    cta: { label: 'Start the table plan', to: '/en/banquet' },
    secondaryCta: { label: 'Try the demo', to: '/en/banquet?demo=1' },
    howToName: 'Make a wedding table plan and matching stationery',
    steps: [
      {
        name: 'Import the guest list',
        text: 'Paste or upload the RSVP list — names, plus-ones and meal choices carry through the whole workflow.',
      },
      {
        name: 'Arrange tables on the plan',
        text: 'Drag guests onto round or long tables, balance family groups, and auto-assign whoever is left.',
      },
      {
        name: 'Print plan, cards and numbers',
        text: 'Export the table plan board for the venue entrance, then generate matching place cards and table numbers on A4.',
      },
    ],
    features: [
      { title: 'Plan and stationery match', text: 'The same list drives the plan board, place cards and table numbers — no version drift between documents.' },
      { title: 'UK terms, UK paper', text: 'Top table, table plan, A4 — the workflow speaks your language and fits your printer.' },
      { title: 'Drag-and-drop seating', text: 'Move guests between tables visually; dietary notes and VIPs stay visible.' },
      { title: 'Auto-assign the stragglers', text: 'Let the tool balance remaining seats instead of shuffling the last 20 names by hand.' },
      { title: 'Guest list stays private', text: 'Names and dietary details are processed locally — nothing is uploaded.' },
      { title: 'Free to use', text: 'Open, arrange, print. No account or install needed.' },
    ],
    faqs: [
      {
        q: 'Table plan vs seating chart — what is the difference?',
        a: 'Same job, different dialect: UK weddings say "table plan", US weddings say "seating chart". Both mean the guest-to-table assignment board.',
      },
      {
        q: 'Can I print the plan as one big board?',
        a: 'Yes — export the plan view as a PDF sized for a poster frame or easel board, or tile it across A4 sheets.',
      },
      {
        q: 'Does it handle plus-ones and dietary notes?',
        a: 'Add columns for partner names, meal choices and allergies; they stay attached to the guest through seating and printing.',
      },
    ],
    relatedLinks: [
      { label: 'Seating chart from Excel', to: '/en/guides/wedding-seating-chart-from-excel' },
      { label: 'Printable table numbers', to: '/en/guides/wedding-table-numbers-printable' },
      { label: 'Escort cards vs place cards', to: '/en/guides/escort-cards-vs-place-cards' },
      { label: 'Place card generator', to: '/en/place-card-generator' },
    ],
  },
  {
    path: '/en/seating-chart-maker',
    lang: 'en',
    shortName: 'Seating Chart Maker',
    heading: 'Seating Chart Maker: Arrange Guests, Print the Chart',
    subheading:
      'Drag guests onto tables, balance the room, and export a print-ready seating chart — then generate matching escort cards from the same list. Free, private, and sized for US Letter or A4.',
    seoTitle: 'Free Seating Chart Maker: Wedding & Event Seating',
    seoDescription:
      'Free seating chart maker: drag guests onto tables, auto-assign the rest, print the chart plus matching escort cards. Letter/A4 PDF, no sign-up, list stays local.',
    cta: { label: 'Make the seating chart', to: '/en/banquet' },
    secondaryCta: { label: 'Try the demo', to: '/en/banquet?demo=1' },
    howToName: 'Make an event seating chart',
    steps: [
      {
        name: 'Import the guest list',
        text: 'Paste or upload names with tables, meal choices and notes — one list feeds the chart and the cards.',
      },
      {
        name: 'Arrange the room',
        text: 'Add round or long tables, drag guests between them, and auto-assign anyone left over.',
      },
      {
        name: 'Print chart and cards',
        text: 'Export the chart as a PDF for the entrance display, then batch escort cards from the same list.',
      },
    ],
    features: [
      { title: 'Chart + cards in sync', text: 'The same list drives the printed chart and the escort cards — last-minute swaps only reprint a few cards.' },
      { title: 'Visual drag-and-drop', text: 'Move guests between tables and see counts per table instantly.' },
      { title: 'Auto-assign leftovers', text: 'Balance the final seats automatically instead of shuffling by hand.' },
      { title: 'US Letter and A4', text: 'Output matches your paper — no "fit to page" scaling drift.' },
      { title: 'Guest list stays local', text: 'Names and dietary notes are processed in your browser, never uploaded.' },
      { title: 'Free to start', text: 'Open, arrange, print — no account or install needed.' },
    ],
    faqs: [
      {
        q: 'Seating chart or escort cards — do I need both?',
        a: 'Most US weddings use one or the other. A printed chart board is simpler to update; escort cards let guests carry their assignment. This workflow makes both from the same list.',
      },
      {
        q: 'How many guests can it handle?',
        a: 'Hundreds — the layout reflows as the list grows, and auto-assign handles large unassigned pools in one pass.',
      },
      {
        q: 'Can I print the chart as a poster?',
        a: 'Yes — export the chart view as a PDF sized for a poster frame or foam board at any print shop.',
      },
    ],
    relatedLinks: [
      { label: 'Seating chart from Excel', to: '/en/guides/wedding-seating-chart-from-excel' },
      { label: 'Table plan maker (UK)', to: '/en/table-plan-maker' },
      { label: 'Escort cards vs place cards', to: '/en/guides/escort-cards-vs-place-cards' },
      { label: 'Place card generator', to: '/en/place-card-generator' },
    ],
  },
  {
    path: '/en/classroom-label-maker',
    lang: 'en',
    shortName: 'Classroom Label Maker',
    heading: 'Classroom Label Maker: Desk Tags, Cubby Labels & Name Cards',
    subheading:
      'Paste your class list once and batch every label the room needs — desk name tags, cubby labels, supply bins, name cards — sized for US Letter and ready to laminate. Free, private, no sign-up.',
    seoTitle: 'Free Classroom Label Maker: Desk Tags & Cubby Labels',
    seoDescription:
      'Free classroom label maker: paste a class list to batch-print desk name tags, cubby labels and supply labels on US Letter. No per-name typing, data stays local.',
    cta: { label: 'Make classroom labels', to: '/en/studio' },
    secondaryCta: { label: 'Try the demo', to: '/en/studio?demo=1' },
    howToName: 'Batch classroom labels from a class list',
    steps: [
      {
        name: 'Paste the class list',
        text: 'One name per line — or upload the roster Excel your school system already exports.',
      },
      {
        name: 'Pick a label style',
        text: 'Desk name tags, cubby labels or supply bin cards — the list fills every label in the batch.',
      },
      {
        name: 'Print on Letter',
        text: 'Print at 100% on cardstock or label stock, cut along the guides, laminate once and the set lasts the year.',
      },
    ],
    features: [
      { title: 'One list, every label', text: 'Desk tag, cubby label and supply card styles all read the same roster — no retyping between formats.' },
      { title: 'No per-name editing', text: 'Unlike bought "editable" templates, you never type 30 names into text boxes — the list does it.' },
      { title: 'Letter-size layouts', text: 'Grids sized for US Letter with cut guides — straightforward on any school printer.' },
      { title: 'Late joiners covered', text: 'New student next week? Add the name, print one label, done.' },
      { title: 'Student data stays local', text: 'The roster is parsed in your browser — a plus for student-data policies.' },
      { title: 'Free for teachers', text: 'Open and print — the $1–5 per template Teachers Pay Teachers run adds up.' },
    ],
    faqs: [
      {
        q: 'Is this different from the editable PDFs on TPT?',
        a: 'Those give you a design you fill in name-by-name. Here the whole class fills in one pass from your roster — and the style is still editable.',
      },
      {
        q: 'What labels can one class list produce?',
        a: 'Desk name tags, cubby/locker labels, supply bin cards, book bin tags and name cards for field trips — swap the template, same list.',
      },
      {
        q: 'Laminate-friendly?',
        a: 'Print on cardstock, cut along the guides, laminate — the uniform cut size means labels line up in a stack for fast laminating.',
      },
    ],
    relatedLinks: [
      { label: 'Desk name tags from a class list', to: '/en/guides/desk-name-tags-from-class-list' },
      { label: 'Name badge generator', to: '/en/name-badge-generator' },
      { label: 'Place card generator', to: '/en/place-card-generator' },
      { label: 'Classroom seating chart', to: '/en/seating' },
    ],
  },
]

export function findTopicPage(path: string): TopicPage | undefined {
  return topicPages.find((p) => p.path === path)
}

const CN_NUMERALS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

/** 分步用法区块标题：显式 stepsHeading 优先，否则按步数生成「N 步完成」（1–10 用汉字数字） */
export function topicStepsHeading(page: Pick<TopicPage, 'steps' | 'stepsHeading' | 'lang'>): string {
  if (page.stepsHeading) return page.stepsHeading
  const n = page.steps.length
  if (page.lang === 'en') return `Done in ${n} steps`
  const cn = CN_NUMERALS[n]
  return cn ? `${cn}步完成` : `${n} 步完成`
}
