# 第 325 轮：生产复测（#337：渲染前预热样式表修空白标签竞态 + /en 页脚精选教程收敛）

依据：`pdfExport.ts:214 prewarmStylesheets()`（fetch force-cache 全部 link[rel=stylesheet]，`:724` 每次渲染尝试前 settleWithin 10s）；`AppFooter.vue:29`（locale==='en' 时不展开 footerGuideLinks）。环境：生产，匿名。前置：轮询主包 ≠ index-4ETA6GYE.js。

## T1 空白标签修复验证（CDP 复用 r324b.py 实验器，/studio?demo=1 带水印逐标签导出）
- **T1a 判别性最强**：页面加载后清 HTTP 缓存 + 40KB/s+300ms 限速导出（324 轮 2/2 确定性失败）。PASS：成功 toast「PNG 图片已生成（26 张标签打包为 zip）」，无「渲染为空白」失败；预热给了 CSS ~2s 下载时间（<10s 上限）故克隆体命中缓存。FAIL：仍报空白。
- **T1b 竞态稳定性**：页面加载后清缓存、全速导出 ×4（324 轮约 50% 失败）。PASS：4/4 成功。
- **T1c 屏蔽法如实区分**：Network.setBlockedURLs(['*index-*.css*'])。预期修复后**仍失败**——预热 fetch 走同一 URL 也被屏蔽（工具局限而非修复无效）；用 Network 事件证明预热 fetch 发出且被 blocked，如实写明归类。
- 各场景采集 pageerror 与网络事件留档 /tmp/r325/。

## T2 正常导出回归（录屏 UI）
- /studio?demo=1 UI 点「图片 PNG」→ 带水印导出。PASS：中文成功 toast、zip 落盘 26 张、抽 3 张（首/中/尾）PIL 非空白。

## T3 /en 页脚教程组（录屏 UI）
- /en 拉到页脚。PASS：教程组仅 **'Guide center'** 一条，无 4 篇中文长标题链接。
- 中文 / 页脚对照。PASS：「教程中心」+ 4 篇精选教程（考场座位贴怎么批量打印…等）仍在。

## T4 运行时错误
- 全程 pageerror 采集。PASS：0（除 324 轮已知的每次加载 1 条基线 error，如出现则如实注记）。

收尾：清缓存/存储、还原屏蔽与限速、关多余 tab。产出：录屏、test-report.md 第 325 轮章节（不提交）、#337 建议评论。
