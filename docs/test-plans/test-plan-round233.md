# 第 233 轮：Lighthouse 与性能周期回归（生产，无代码变更轮）

方法依据：SKILL.md:99-101 标准命令（lighthouse@13.4.1 mobile 模拟节流，每页 ≥3 跑取中值，首跑冷启动离群丢弃）；r179 基线（home 98 / studio 78 / templates 93，CLS 全 0，BP=58 为百度统计既定代价）；r161 口径（40 行导入 0.107s，基线 0.12–0.13s；#122 idle 注入 load 前分析请求=0）。bundle 现为 `index-EbJxTvBJ.js`。

## T1 Lighthouse 移动端五页（各 3 跑取中值）
- `/`、`/studio`、`/templates`：Perf 中值相对 98/78/93 劣化 ≤15%（≥83/66/79）；CLS=0；A11y/SEO 不低于既有（SEO 100、A11y ≥96）；BP=58 视为预期。
- `/seating`、`/account`：无历史移动基线——建立首测基线（健康线 Perf ≥70、CLS=0、SEO ≥90），如实记录。
- 判据：任一页中值劣化 >15% → P2 即时上报；>0% 且 ≤15% 记观察项。

## T2 桌面抽查
- `/` 与 `/studio` 桌面 preset 各 1-2 跑：/ Perf≈100、CLS 0（r161 基线）不劣化 >15%。

## T3 /studio 新代码无可感劣化
- T1 的 /studio TBT/LCP 与 r179（LCP 4.71s）比较；哨兵/照片提示代码路径在加载即执行（ModalDialog 模块级+store init），Perf 中值不劣化 >15% 即判过。

## T4 40 行导入交互耗时（r161 口径）
- /studio 真实 UI 导入 `r113_40.xlsx` ×2，0.05s 轮询 toast「已读取 40 条数据」出现耗时 ≤0.2s（基线 0.107s，>0.3s 记退化）。

## T5 统计脚本 idle 注入（#122 回归）
- 全新 tab 冷加载 `/`：Network 事件对照 loadEventFired，分析类请求（gtag/hm.baidu/push/bdstatic/sentry）load 事件**前**计数=0，load 后注入。

## T6 收尾
- 全程 pageerror=0（T4/T5 的 CDP 会话）；清 storage 关全部 tab、清理 lighthouse 临时 Chrome；写 test-report.md 第 233 轮章节（含 /seating /account 新基线）。
