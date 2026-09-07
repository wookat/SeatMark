# 第 268 轮：#271 xlsx 加载失败刷新引导 + 离线 seo 导入静默 线上复测（生产，Chromium CDP）

代码依据（aa64f8e）：`excel.ts:15-21` `loadXlsx()`——`import('xlsx')` 失败抛「表格组件加载失败（可能是网络异常），请刷新页面后重试」（`:34` parseExcelFile、`:153` downloadSampleExcel 均走此路径）；`router/index.ts:168-172` afterEach 的 `import('@/utils/seo')` 包 try/catch（失败静默，下次导航重试）。

部署确认（T0）：entry hash 翻转（r266 为 `index-BC7trUVn.js`）——curl /studio 每 60s 轮询（≤30 分钟）。

## T1 P3 判据：预取失败后中文刷新引导（主判据）
- r266 同法：`context.route('**/vendor-xlsx*', abort)` 后 goto /studio，等 6s（预取被 abort，pageerror=0），unroute，导入 r113_40.xlsx。
- 判据：失败 toast 文案**逐字含**「表格组件加载失败（可能是网络异常），请刷新页面后重试」，**不含**「Failed to fetch dynamically imported module」（r266 旧行为对照，可区分）；截图。
- p.reload() 后重导：toast「已读取 40 条数据」、「共 40 条」——刷新引导路径成立。

## T2 P4 判据：离线导航无 seo pageerror
- 全新 context 打开 /studio，CDP offline=true，离线窗口内做一次 SPA 路由导航（点击导航栏「模板」链接）；等 5s。
- 判据：pageerror 中**无**「seo」字样条目（r266 旧行为：`Failed to fetch dynamically imported module: …seo-*.js`——可区分）；离线下路由 chunk 本身加载失败的其它表现如实记录不定级混淆。恢复网络后再导航一次正常。

## T3 回归（Regression）
- 正常路径：全新 context 打开 /studio 零交互 5s 内 network 见 `vendor-xlsx-*.js` 预取；随后首导 40 行 ≤0.2s「共 40 条」。
- 粘贴导入 3 行（张伟268-N）「共 3 条」；逐张 PNG 导出 zip 张数=3、0 空白。

## T4 常规
- 正常路径会话 pageerror=0；请求标记串（张伟268）命中 0；storage 清理、context 全关、常驻 Chrome 不动。

## 报告
- test-report.md 第 268 轮置顶章节 + 本计划 + #271 复测评论文案 + 如有 SKILL.md 建议。
