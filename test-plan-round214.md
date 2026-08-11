# 第 214 轮：#216 AI 设计文案降级验收 + demo 导出零回归冒烟

代码依据：#216 diff（AiDesignDialog.vue 三处）：
1. :102-105 弹窗说明 → 「免费通道依赖公共模型服务，繁忙时可能失败；有自己的 API 密钥时推荐「自定义 API」更稳定。」（旧：「默认免费通道开箱即用，无需注册或配置任何密钥。」）
2. :157 通道按钮 → 「免费通道 · 繁忙时限量」（旧：「免费通道 · 无需配置」）
3. :173-176 免费通道提示 → 「…不上传完整名单。公共服务限量且不保证可用，失败时请稍后重试，或切换「自定义 API」用自己的密钥更稳定。」（旧尾句：「高峰期偶尔繁忙，失败可重试或切换…」）

部署已证：entry `index-zn4iqgIG.js` → `index-m3vMPIl7.js`（15s 二次采样一致）。

## T1 三处新文案上线 + 旧字样 0 残留
- 新 tab → /studio?design=new → 点「AI 自动设计」→ 截图弹窗。
- 断言：弹窗 DOM 含上述 3 条新文案精确子串；截图 OCR/目视证实可见；`document.body.textContent` 中「开箱即用」「无需配置」「无需注册」出现次数 = 0；bundle 文本 grep「开箱即用」= 0。

## T2 390px 窄屏不破版
- viewport 390×844 重开弹窗 → 截图。
- 断言：`document.documentElement.scrollWidth <= 390`（无横向溢出）；三处文案元素各自 `scrollWidth <= clientWidth+1`；截图目视文案完整不重叠。

## T3 demo 导出冒烟（Regression）
- /studio?template=deskName&demo=1 → 整页带水印 PNG 导出。
- 断言：zip page1 md5 = `3e8fdf3e0c8530297998d8ad25623f21`（r170 基线逐位一致）。

## T4 收尾
- 全程 pageerror=0；清 storage + 关全部测试 tab；第 214 轮置顶追加 test-report.md（不提交）。
