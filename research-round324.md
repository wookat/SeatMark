# 第 324 轮调研：逐标签 PNG 导出「冷启动 ~90s」时间去向 + 空白标签偶发失败根因定位

生产 www.seatmark.cn（主包 index-4ETA6GYE.js），匿名，CDP 驱动（fresh tab、清缓存/存储、真实 Input 点击），浮层文案 120ms 轮询切分阶段，Network 全事件采集，longtask 采集。原始数据：/tmp/r324/（runs.json、run_*.json、netA/net_D-40KBps/net_F.jsonl）。

## 1. 正常条件下各阶段耗时（清缓存后冷导出 vs 同 tab 二次导出）

| 阶段（浮层切分） | A-cold（清缓存） | A-warm（二次） | B-cold CPU×6 |
|---|---|---|---|
| 点击→「正在准备页面...」 | 1.1s | —（跳过） | 1.5s |
| 「准备页面」（动态 import vendor-pdf 618KB + pngExport 26KB + jszip 97KB） | **2.8s** | ~0 | 1.2s |
| 渲染第1页+切标签 | 0.9s | 1.3s | 14s |
| 渲染第2页+切标签+zip+落盘 | 1.6s | 1.3s | 2s |
| **总计（点击→成功 toast）** | **5.4s** | **3.9s** | **17.1s** |

- **90 秒未复现**：本机清缓存冷导出仅 5.4s；6 倍 CPU 降速也只 17.1s。JS 层等待全部有上限（fonts 3s、图片 5s、看门狗 30s），唯一无上限的变量是**网络**。
- 「正在准备页面...」阶段 = 三个 JS 分包的动态 import（html2canvas 在 **vendor-pdf-BytP0Zqb.js，617,796B**）。40KB/s 限速下该阶段拉长到 6.5s，与下载耗时线性同步。
- **90s 归因（结合证据的判断）**：历史 90s 均发生在**新包刚部署后的首次导出**（00:4x），彼时 vendor-pdf/jszip 新哈希在 EdgeOne 边缘为 Cache Miss 回源；「准备页面」阶段時长即分包下载时长，无超时、无重试、无提示，慢到 90s 也只能干等。今日资产已是 edge Cache Hit（curl 证实 eo-cache-status: Cache Hit），故快。此为最自洽解释，但未能在生产复现 90s 本身。

## 2. 重大新发现：空白标签偶发失败可确定性复现（根因 = html2canvas 克隆文档重取 CSS）

html2canvas 渲染时把整个 document 克隆进 iframe，克隆体会**重新发起 index-*.css 等资源请求**（netA 中每次渲染尝试都可见整组 assets 的重复请求，缓存命中时 0ms 完成）。若该 CSS 请求**未命中 HTTP 缓存且未及时返回**，html2canvas 在样式未生效时截图 → 标签渲染为空白：

| 实验 | 条件 | 结果 |
|---|---|---|
| E/G-blockCSS | 全速网络，仅屏蔽 index-*.css 重取 | **100% 复现**「PNG 生成失败：第 1/2 页第 2 枚标签渲染为空白」 |
| C/D-40KBps | 页面加载后清 HTTP 缓存 + 40KB/s+300ms | 2/2 复现同一失败 |
| E2 vs F | 页面加载后清 HTTP 缓存，全速 | 一次失败、一次成功（**竞态**，重现「偶发」特征） |
| A/F2 | CSS 在缓存中 | 全部成功 |

- **#335 的 rebuildHost 兜底救不了这类失败**：三次尝试的克隆体都重新拉取同一未缓存/慢的 CSS，netD 中可见 3 组克隆请求全部 ERR_ABORTED（渲染未等 CSS 即快照）→ 3 次全空白 → 报错。行为与 #335 设计一致（确实做了 3 次渲染 + 重建），但根因是**资源可用性**不是容器劣化。
- 生产「偶发」场景推测：刚部署后新哈希 CSS 边缘 Miss/慢、磁盘缓存写入竞态、缓存被逐出等，都会让克隆体的 CSS 重取变慢而触发。
- **修复方向建议**（供裁量）：① 渲染前用 `fetch(cssHref, {cache:'force-cache'})` 预热/确保 CSS 在缓存；② html2canvas `onclone` 里等待克隆文档 styleSheets 就绪再返回；③ 空白重试间加延时/等资源（现在 3 次重渲几乎背靠背，毫秒级内全部失败）；④ 90s 侧：给「正在准备页面...」阶段加分包下载进度或超时提示。

## 3. 其他
- pageerror：每次页面加载恒有 1 条 window error（成功/失败运行均为 1，属基线，与导出无关，未定位具体来源）。
- 首次脚本中「第二次导出无 zip 落盘」为测试器材问题：JS click 触发的第二次自动下载被 Chrome「多文件下载」权限拦截（截图可见权限条）；改真实 Input 事件后无此问题，非产品缺陷。
- 证据截图：/home/ubuntu/screenshots/r324_blank_fail_repro.png（屏蔽 CSS 后确定性失败 toast）。
