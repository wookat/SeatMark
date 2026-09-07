# 第 178 轮：#186 移除 Microsoft Clarity——第 176 轮弹窗泄漏闭环复测（生产）

代码依据：#186（8e1c3b3）仅改 `app/index.html`（移除 clarity stub + tag，本地 grep clarity=0；保留 gtag/百度统计注入逻辑 utils/analytics*）。产品 JS 零改动 → **entry bundle 可能不变**，部署翻转判据以 index.html 内容为主：`curl / | grep -ci clarity` 从 3 → 0，二次采样一致（sw/js hash 一并记录，如变化照记）。第 176 轮失败基线：弹窗开关 30 轮泄漏 103k 节点/15.3k 监听器/88.8MB——判据天然可区分。

## T0 部署翻转
- 轮询生产 `/` HTML：clarity 出现次数 = 0，且 15s 后复采样仍为 0；记录 js/css/sw 指标值。

## T1 弹窗泄漏闭环（核心判据，第 176 轮同口径）
- /studio?demo=1 同一 tab：「浏览全部」开弹窗→等 >10 卡片→关闭，共 30 轮；每 10 轮 GC×4 后采样 Memory.getDOMCounters + JSHeapUsedSize。
- 断言：30 轮后节点 < 起点+5k（r176 失败值 103,134）、监听器 < 起点+500（r176 失败值 15,299）、heap < 起点+15MB（r176 失败值 88.8MB）——不得线性增长。第 30 轮弹窗仍正常渲染（截图）。

## T2 统计通道
- 新 tab 开 / 并等 idle 注入：Network 域收集请求——应出现 `googletagmanager.com/gtag/js`、`hm.baidu.com/hm.js` 各 ≥1；`clarity.ms`/`clarity` 请求 = 0（出现即回归）。`zz.bdstatic.com`（百度主动推送）≥1。dataLayer 与 _hmt 存在且 push 不抛错、pageerror 0。

## T3 冒烟（Regression）
- /studio?template=deskName&demo=1 整页 PNG 导出（下载完成用 downloadProgress 事件判定）：md5 = r170 基线 `3e8fdf3e0c8530297998d8ad25623f21`、pHYs 11811；pageerror 0。

## T4 观察项（不定级）
- 连续整页导出 5 次，每次 GC 后采样 detached 节点：r176 观察到每次 +13k 暂态累积——记录 Clarity 移除后是否消失/减轻。

产出：test-report.md 第 178 轮（97→98 节）、截图 r178_* 入 /home/ubuntu/screenshots/、产物 /home/ubuntu/r178_dl/。headless 不录屏。导出脚本重连 browser WS 重设 downloadPath（eventsEnabled）。收尾清 storage + 关闭全部测试 tab。
