/**
 * 「更新记录」数据 —— 由 scripts/gen-changelog.mjs 依据 git 提交历史生成，请勿手改。
 * 重新生成：npm run changelog（需要本地有 git 历史；CI/生产直接读取本文件快照）。
 */

export type ChangelogKind = 'feature' | 'fix' | 'improve'

export interface ChangelogEntry {
  /** 提交短哈希（仅作溯源标识，不保证公开仓库可见） */
  hash: string
  kind: ChangelogKind
  text: string
}

export interface ChangelogDay {
  date: string
  entries: ChangelogEntry[]
}

export const CHANGELOG_GENERATED_AT = '2026-11-08'
export const CHANGELOG_ENTRY_COUNT = 57

export const changelogDays: ChangelogDay[] = [
  {
    date: '2026-11-08',
    entries: [
      { hash: '4dcd572', kind: 'feature', text: "第六批 6 款纸型专用模板（428→434）" },
      { hash: '0785f45', kind: 'feature', text: "第五批 6 款纸型专用模板（422→428）" },
      { hash: 'bc124fe', kind: 'feature', text: "第四批 6 款纸型专用模板（416→422）" },
      { hash: '6e934ca', kind: 'feature', text: "第三批 6 款纸型专用模板（410→416）" },
      { hash: '1cf4c45', kind: 'feature', text: "更新记录入构建链、admin 意向单筛选、SelectField 无障碍" },
      { hash: '16fafce', kind: 'fix', text: "排版收尾——页面副标题行高统一 leading-7、个人中心页头对齐标准" },
      { hash: '488ffe5', kind: 'fix', text: "统一前端控件与排版——原生 select 清零、页头规格、微文本" },
      { hash: '32b6c7e', kind: 'feature', text: "更新记录页 /updates——内容由仓库提交历史生成，页脚入口" },
      { hash: '147a4b2', kind: 'feature', text: "第二批 102 款纸型专用模板，56 种纸型全覆盖（308→410）" },
      { hash: '089130c', kind: 'feature', text: "全站文案升级为「纸 × 模板」双产品线叙事" },
      { hash: 'b355ea6', kind: 'feature', text: "横向进纸排版 + 纸型售卖/定制服务区块" },
      { hash: 'e96acd4', kind: 'feature', text: "add refund policy page (/refund + /en/refund)" },
      { hash: '32d9365', kind: 'feature', text: "英文获客内容矩阵 + GEO 优化 + Avery/美标纸型" },
      { hash: '1d13192', kind: 'feature', text: "竞品式排版重构——三栏布局、桌缘座位、钉座与联排桌" },
    ],
  },
  {
    date: '2026-11-07',
    entries: [
      { hash: 'cee7b4e', kind: 'feature', text: "教室/考试双模式排座——不规则座位形状、考场走位与排序" },
      { hash: 'ecaae97', kind: 'feature', text: "conversion events at call sites + first-party geo visitor stats" },
      { hash: 'a71e5a3', kind: 'feature', text: "merge roster viewer/editor into one dialog, batch photo import" },
      { hash: '22eada1', kind: 'fix', text: "visual audit pass — filters, contact info, nav, studio layout" },
      { hash: 'd90a5e3', kind: 'feature', text: "add /about product page and online roster editor" },
      { hash: 'b026e97', kind: 'fix', text: "slide nav redesign — dots left, name+paper badge right" },
      { hash: '3ef74cd', kind: 'feature', text: "add trackEvent util for GA4 + Baidu conversion events" },
      { hash: 'f52c812', kind: 'fix', text: "dropdown hover dead-zone, hero chips, contact info" },
    ],
  },
  {
    date: '2026-11-06',
    entries: [
      { hash: '2b9295b', kind: 'feature', text: "monthly AI quota per account — free 3 / pro 50 / team 300, login required" },
      { hash: '58b264c', kind: 'feature', text: "per-upstream temperature override (null omits param; kimi-k2.6 compat)" },
      { hash: 'ad02721', kind: 'feature', text: "hide BYOK group for new users — all listed models are site-hosted" },
      { hash: '0807c4a', kind: 'feature', text: "remove DeepSeek direct upstream; EO Models gateway becomes primary tier" },
      { hash: '155a349', kind: 'feature', text: "site-hosted named upstreams — GET model list + upstream selection + AI_UPSTREAMS" },
      { hash: '7b9a5ad', kind: 'feature', text: "model picker (adaptive/BYOK presets/custom) + structured layout options" },
      { hash: '5fb8b69', kind: 'feature', text: "paid pricing - pro ¥5.9/30d, team ¥19.9/30d, both Alipay-checkout enabled" },
      { hash: 'ea88f5e', kind: 'feature', text: "EO Models gateway fallback tier + temp env probe" },
      { hash: '1c05d44', kind: 'feature', text: "English guides index/articles + 4 EN comparison pages, indexable /en/guides & /en/vs" },
      { hash: 'b0fac32', kind: 'fix', text: "PBKDF2 iterations 600k->100k (EdgeOne deriveBits ceiling; fixes register/reset 500s)" },
      { hash: '8afe24b', kind: 'fix', text: "degrade overview on transient blob read failures" },
      { hash: 'bcf84c9', kind: 'fix', text: "support split ALIPAY_PRIVATE_KEY_1/_2/_3 env vars (EdgeOne 1000-char limit)" },
      { hash: '6b6d438', kind: 'feature', text: "integrate Alipay AI web payment (alipay.trade.page.pay)" },
    ],
  },
  {
    date: '2026-11-05',
    entries: [
      { hash: '7008880', kind: 'fix', text: "use full site-level ICP filing number with -2 suffix" },
      { hash: '7efc81c', kind: 'fix', text: "drop duplicate en dict key breaking vue-tsc build" },
    ],
  },
  {
    date: '2026-08-14',
    entries: [
      { hash: 'e309d85', kind: 'fix', text: "/banquet 导出左缘裁切与 A3 纵向渲染失败" },
      { hash: 'c4aaff7', kind: 'feature', text: "宴会座位表生成器（/banquet）与 /studio 名单 TXT 上传/去重" },
    ],
  },
  {
    date: '2026-08-10',
    entries: [
      { hash: '5c1b44a', kind: 'feature', text: "/vs 对比页矩阵 + 桌牌在线生成/姓名卡片批量生成长尾落地页" },
    ],
  },
  {
    date: '2026-08-09',
    entries: [
      { hash: 'd8a4fc2', kind: 'fix', text: "deluxeClassChalk 班主任前缀改用 caption 机制，映射后保留标签名" },
    ],
  },
  {
    date: '2026-08-08',
    entries: [
      { hash: '3bc8099', kind: 'feature', text: "新增第六轮 10 篇长尾搜索词教程（桌牌尺寸/Word 桌牌/免费席卡模板/字体字号/用纸/防水姓名贴/座位贴张贴/打印店价格/双语桌牌/领导桌牌摆放）" },
    ],
  },
  {
    date: '2026-08-07',
    entries: [
      { hash: '52bc910', kind: 'feature', text: "PNG 按标签逐张导出（默认）+ PDF 压缩进阶（自适应位深/强化去重/尺寸自适应倍率）" },
    ],
  },
  {
    date: '2026-08-05',
    entries: [
      { hash: '2236ee8', kind: 'feature', text: "验证码邮件支持腾讯云 SES（TC3 签名），Resend 转为备用通道" },
    ],
  },
  {
    date: '2026-06-29',
    entries: [
      { hash: 'f7afe7b', kind: 'feature', text: "重设计图标(12→S)并扩展品牌定位为座签·桌牌席卡·门贴证卡批量生成" },
    ],
  },
  {
    date: '2026-06-25',
    entries: [
      { hash: '009039e', kind: 'fix', text: "切换 DeepSeek v4-flash 模型 + EdgeOne fetch 超时配置 + 企业微信告警 + Pollinations 兜底模型修复" },
      { hash: '0c80fa7', kind: 'feature', text: "矢量PDF字体改用Noto CJK OTF并增加下载进度；打印按钮提为主按钮；SW手动注册；AI兜底模型改用openai-fast；DeepSeek异常企业微信告警" },
      { hash: '5d2069b', kind: 'feature', text: "新增vectorPdfExport工具，优化PreviewArea/Footer/Header" },
      { hash: '263d199', kind: 'feature', text: "AI设计代理改用DeepSeek v4 Pro主模型+glm-4-flash兜底；新增百度推送脚本" },
      { hash: '41676ce', kind: 'feature', text: "接入站点统计、错误监控、PWA、SEO优化及用户反馈功能" },
      { hash: '8025d81', kind: 'feature', text: "移动端适配 - StudioView Tab切换 + TemplateDesigner 抽屉式侧栏 + 工具栏横向滚动" },
    ],
  },
  {
    date: '2026-06-22',
    entries: [
      { hash: 'c01da5c', kind: 'feature', text: "版权信息与备案号同排，改为英文版权声明" },
      { hash: '3db055f', kind: 'feature', text: "调整页脚布局：备案号与隐私声明同排、隐藏公安备案、添加版权信息" },
      { hash: '4c727d1', kind: 'feature', text: "页脚添加 ICP 备案号及公安备案占位" },
      { hash: 'f31fe7d', kind: 'fix', text: "添加 edgeone.json 配置构建根目录为 app/" },
      { hash: '304e51d', kind: 'fix', text: "补全 caption 字段类型与渲染，修复构建类型错误" },
      { hash: '0b48960', kind: 'improve', text: "项目结构整理 - web/ 重命名为 app/，删除旧版和中间产物" },
    ],
  },
]
