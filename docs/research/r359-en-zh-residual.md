# r359 · /en 渲染 DOM 中文（CJK）残留清单

- 抓取方式：Playwright 经 CDP 连接本机 Chrome，匿名访问生产（r358，首页主包 `index-DpUvtypr.js`），
  遍历渲染后 DOM 的文本节点与 `aria-label/title/placeholder/alt` 属性，正则 `[\u4e00-\u9fff]`；
  排除 `script/style/noscript/textarea/template`、`contenteditable` 与 **`lang="zh"` 精确匹配的祖先**。
- 路由集合：`/en/templates`、`/en/templates` 页内发现的全部 24 个 `/en/templates/:slug` 链接、`/en/studio?demo=1`。
- 抓取时间：2026-09-08（UTC），未登录、未提交任何表单，抓取后清理站点存储。

## 一、基线（r358）与本轮结果

| 路由 | 基线未包裹 CJK 项 | 本轮代码期望 | 结果口径 |
| --- | ---: | ---: | --- |
| `/en/templates`（首屏 6 张缩略图已渲染，其余懒渲染） | 10 | 0 | 固定文案入表翻译；语言切换「中文」/ICP 备案号加 `lang="zh"`；仍含中文示例值的缩略图外层 `lang="zh"` |
| `/en/templates/:slug` × 24 | 97–115 / 页（合计 2504） | 不变（见下） | **路由级中文专页**：`router/index.ts` `EN_ZH_ONLY_DETAIL_RE` 明确把 `/en/templates/:slug` 重定向到中文详情页；生产直连 `curl /en/templates/a5compact` 返回 404 + `<html lang="zh-CN">`（直接实证）。整页 `lang="zh-CN"`，扫描脚本按 `lang="zh"` 精确匹配未识别为祖先，属**扫描口径差异**而非未标注文案。本轮不改路由架构（超出收尾项范围，且英文详情页正文尚不存在） |
| `/en/studio?demo=1` | 34 | 0 | 见分类表 |

> 「本轮代码期望」列为代码层推断（单测 + 本地渲染），生产复扫数字在本轮 PR 合并部署后另行补入 PR 评论；未复扫前不宣称生产已归零。

## 二、`/en/templates` + `/en/studio?demo=1` 44 项分类与处置

| 类别 | 条数 | 样例 | 处置 |
| --- | ---: | --- | --- |
| 模板固定文案（`label-field__content`） | 33 | `座位号 SEAT`、`准考证号 EXAM NO.`、`核验照片 PHOTO`、`入场请核对照片与准考证信息是否一致` | (b) `TEMPLATE_FIXED_TEXT_EN` 入表；新增「中英并排文案只保留英文段」通用规则（`考试出入证 · EXAM PASS`→`EXAM PASS`）；模板橱窗缩略图改为经 `localizeTemplateForLocale` 渲染（此前 `TemplateThumb` 直接吃原模板，是残留主因）；Studio 画布为用户设计稿内容，不改内容，画布外层按 (d) 标 `lang="zh"` |
| 语言切换按钮「中文」 | 4 | 头部 + 页脚 | (d) 品牌/导航原文保留，外层 `lang="zh"` |
| ICP 备案号 | 2 | `湘ICP备2026009844号` | (d) 法定原文保留，`lang="zh"` |
| 字体名 | 1 | `宋体`（FontPicker 当前值） | (c) `FONT_NAME_EN` 别名表（宋体→SimSun、黑体→SimHei、楷体→KaiTi、仿宋→FangSong、思源黑体→Noto Sans SC…），列表副行显示原名并标 `lang="zh"`；不改 font-family 值 |
| 中文标点拼接 | 4 | `Sheet「Exam seating」`、`showing first 5 only，Total 26 rows`、`（show rows）`、`，Cell 63.5×33.9mm…` | 标点走 `t()`：`「`/`」`/`，`/`（`/`）` 补英文映射（DataImportPanel / MappingPanel / LayoutPanel） |

## 三、全部 225 款默认模板离线清点（代码层，非生产）

对 `defaultTemplates` 逐款套用 `localizeTemplateForLocale(tpl, 'en')` 后统计仍含 CJK 的字段：

| 口径 | r358 | r359 |
| --- | ---: | ---: |
| fixedText / caption 含 CJK 的条目 | 216 | **0**（单测 `templateLocale.spec.ts` 逐款断言） |
| sample / sampleData 含 CJK 的条目 | 724 | 604（297 个不同示例值：人名、口号、单位名、菜名等） |

剩余示例值属「不能/不宜逐条翻译的示例」，按 (d) 处理：`templateHasCjk()` 判定后由 `TemplatesView` 给缩略图外层加 `lang="zh"`，
中文站 `/templates` 渲染不受影响（`zh` 下 `localizeTemplateForLocale` 返回原对象、`lang` 不设置）。
新增示例映射：`第N桌→Table N`、`第N组→Group N`、`第 N 考场→Room N`、职务（首席技术官→CTO 等）、`org/company/department/position/teacher` 字段英文占位。

## 四、(c) 「模板详情的字体展示处」

`TemplateDetailView.vue` 未渲染字体名（仅文案描述），且 `/en/templates/:slug` 为中文专页（见第一节），本轮无需改动；字体别名仅落在 `FontPicker.vue`。

## 五、证据口径

- 直接实证：生产 r358 扫描计数（本文件第一节基线列）、`curl /en/templates/a5compact` 404 + `lang="zh-CN"`。
- 本地实证：`templateLocale.spec.ts`（225 款 fixedText/caption 归零、字体别名）、`i18n-audit.mjs` 0 leaks。
- 未验证（待部署后复扫）：生产 `/en/templates`、`/en/studio?demo=1` 结果列。
