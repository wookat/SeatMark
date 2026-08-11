# 第 290 轮：#291 blob 存储后登录全链路 + #292 分散对齐折行回退（生产，CDP）

部署确认：`X-SeatMark-Storage: blob` 已实测（curl /api/auth/code 响应头）；entry 翻转 `index-DEJK6L2z.js`。#292 静态 grep 未在压缩产物中稳定命中 `data-justify`（压缩形态不可靠），以运行时行为为准：折行 justify 字段 computed textAlign 是否回退 center（r288 旧行为=justify 可区分）。

代码依据：`edge-functions/api/_storage.js`（#291 字面量动态 import）；`LabelCard.vue:38-53 adjustJustify`（data-justify=1 且 body.scrollHeight>lineHeight*1.5 → textAlign/-last=center，否则 justify）；登录链路同 r289（`[[default]].js:496-608`、`AccountView.vue`）。

## T1 登录全链路（r289 T3/T4 补测，主判据）
- mail.tm 新邮箱 → /account 发码：200 `delivery:'email'`、toast、倒计时；收到真码。
- 先输错码（真码±1）→ formError 应为「验证码不正确」**专属文案**（r289 被 memory 掩盖为「已过期」，可区分）。
- 再输真码 → toast「登录成功」、页面切个人中心：显示邮箱、「今日无水印导出配额 remaining/limit=3」。
- 刷新 → 仍个人中心（/api/auth/me 返回 user 非 null，httpOnly 会话保持）。
- 登录态配额文案如实记录（每日 3 次 vs 匿名 1 次）。
- 「退出登录」→ 回到发码表单，刷新仍未登录（me 返回 user:null）。
- 全程 /api/auth/* 响应头 storage=blob；payload 仅 {email,code}；pageerror=0。

## T2 #292 折行回退（主判据）
- 复现 r288 场景：TAB 分列粘贴「创新 网络科技公司」入姓名列 + 设计器姓名字段分散对齐 + maxLines=2（折行）。
- 判据：该字段（折行）computed textAlign 与 textAlignLast = **center**（r288 旧行为=justify——第一行「创新」被拉到两端；坏实现可区分）；截图肉眼可见第一行整体居中不贴边。
- 对比截图：同内容普通「居中」对齐折行形态（老板要看视觉对比）。

## T3 单行分散对齐回归（r288 判据沿用）
- 「张三」「王小明」单行仍 justify：预览 textAlignLast=justify、字段截图墨迹横跨 >95% 字段宽；带水印逐张 PNG + 图片版 PDF 抽第 1 页：姓名墨迹 span ≥90% 字段宽、张三 2 簇贴边 / 王小明 3 簇等距（若回退实现把单行也居中则 span 显著 <60%，可区分）。

## T4 常规
- pageerror=0、名单/邮箱外第三方零外发、storage 清理、context 全关。

## 报告
- test-report.md 第 290 轮置顶章节 + 关键对比截图。
