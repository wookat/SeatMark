# 第 266 轮：#270 导入面板空闲预取 xlsx 分包线上复测（生产，Chromium CDP）

代码依据（4a9e5f8）：`DataImportPanel.vue:134-144` onMounted 后 `requestIdleCallback(()=>import('xlsx').catch(()=>{}), {timeout:3000})`，无 rIC 时 `setTimeout(1500)`，失败静默。r264 基线：冷首导 0.17–1.5s（vendor-xlsx 懒 chunk 在导入时才拉取）、热路径 0.046–0.13s。

部署确认（T0）：entry hash 翻转（r264 为 `index-C2ENcB-P.js`）——curl /studio 每 60s 轮询（≤30 分钟）；翻转后浏览器验证行为。

## T1 阳性：空闲预取 + 首导热路径（主判据）
- 全新 incognito context 打开 /studio，**不做任何交互**等 5s；network 记录应出现 `vendor-xlsx-*.js` 请求（导入前）。r264 对照：同一序列下该 chunk 直到导入才出现——本判据可区分好坏。
- 随后首次导入 r113_40.xlsx 计时（toast「已读取 40 条数据」）：判据 ≤0.2s（热量级；若 >0.5s 判 fail）。截图导入成功。

## T2 竞态：打开后立即导入
- 全新 context 打开 /studio，DOM ready 后**立即**（不等空闲）注入 r113_40.xlsx。判据：无 pageerror、toast「已读取 40 条数据」正常出现、「共 40 条」；耗时如实记录（允许含 chunk 拉取）。

## T3 断网预取失败静默
- 全新 context 打开 /studio，页面 load 后立即 CDP `Network.emulateNetworkConditions offline=true`（赶在预取前，rIC timeout 3000 内）；等 6s：判据 pageerror=0、无未捕获 rejection（console error 如实记录）、页面正常。
- 恢复网络（offline=false）后导入 r113_40.xlsx：判据导入成功「共 40 条」（import() 失败后浏览器可重试动态导入）。若浏览器缓存动态 import 失败导致导入不可用——如实上报定级。

## T4 回归（Regression）冒烟
- 粘贴导入 3 行（张伟266-N）「共 3 条」；多 sheet 文件（r231 夹具或既有多 sheet 夹具）切换 sheet 正常；逐张 PNG 导出 zip 张数正确非空白。

## T5 常规
- pageerror=0（T3 预取失败静默不例外）；请求标记串（张伟266）命中 0；storage 清理、context 全关、常驻 Chrome 不动。

## 报告
- test-report.md 第 266 轮置顶章节 + 本计划 + #270 复测评论文案 + 如有 SKILL.md 建议（更新 r264 冷路径注记为已修复）。
