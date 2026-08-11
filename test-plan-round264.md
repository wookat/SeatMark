# 第 264 轮：周期性性能回归专项（生产，无代码变更轮；上次 r233）

环境依据：生产 entry 已翻转 `index-EbJxTvBJ.js`（r233）→ `index-C2ENcB-P.js`（含 #259 启动骨架、#261 横滑提示、#265/#267 粘贴导入）。口径与 r233 完全一致：lighthouse@13.4.1 npx、mobile 模拟节流 `--form-factor=mobile --screenEmulation.mobile --throttling-method=simulate`、每页 3 跑取中值、桌面 `--preset=desktop` 2 跑；原始 JSON 落盘 /home/ubuntu/r264_lighthouse/。交互计时沿用 r233 真实 UI toast 口径（CDP 29229 incognito）。

## T1 Lighthouse 移动五页（vs r233 中值基线）
- `/` 91、`/studio` 79、`/templates` 96、`/seating` 99、`/account` 84。
- 判据：各页中值 Perf 劣化 ≤15%（home ≥77、studio ≥67、templates ≥82、seating ≥84、account ≥71），CLS 全 0；波动带内差异如实注记不定级。BP=58（百度统计既定代价，不报）；/account SEO 66 属设计性 noindex 不报。

## T2 Lighthouse 桌面抽查
- `/`（r233 基线 100·CLS 0）与 `/studio`（88·CLS 0）各 2 跑取优。判据同 ≤15% 劣化、CLS=0。

## T3 交互性能（真实 UI）
- 40 行文件导入：r113_40.xlsx 两次导入，从注入到 toast「已读取 40 条数据」耗时；判据：量级与基线 0.08–0.13s 相当（<0.5s 即无退化，>1s 定级）。
- 粘贴导入 100 行（新增路径）：弹窗粘贴 100 行 TSV（张伟264-N\t0N），测 fill→实时提示「识别到 100 条数据」出现耗时 + 点导入→toast「已导入 100 条数据」耗时；判据：均 <1s（应无可感知卡顿），提示与 toast 条数=100 精确。
- 逐张 PNG 导出 100 张耗时：点击到 download 完成秒数；判据：与近轮量级（r261 6 张约数秒级）按张数线性合理（<120s），zip 恰 100 张非空白。

## T4 主包体积
- 生产 `index-C2ENcB-P.js` curl 落盘，gzip -9 后字节数 vs 历史基线约 107KB；判据：增幅 ≤15%（≈≤123KB），超出才定级；增量来源注记（#265/#267 粘贴解析等在主链路内）。

## T5 常规
- 交互会话 pageerror=0；请求标记串（张伟264）命中 0；storage 清理、context 全关、常驻 Chrome 不动；lighthouse 临时 Chrome 随进程退出。

## 报告
- test-report.md 第 264 轮置顶章节 + 本计划 + 如有 SKILL.md 建议（更新基线注记）。
