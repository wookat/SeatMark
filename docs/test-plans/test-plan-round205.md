# 第 205 轮：「分享送次数」增长链路 + 配额边界深度走查（报告记为 test-report.md 第 205 轮）

代码依据：quota.ts（QUOTA_ANON_DAILY=1、key `seatmark.clean-export-usage.v1`、tryConsume 只在成功后调用）；PreviewArea.vue:452-501（chooseClean 统一闸门：remaining<=0 → 开 QuotaLimitDialog；consumeQuotaAfterSuccess 仅无水印计次）；App.vue:32-49（?ref=[0-9a-f]{8} → POST /api/share/visit + ShareWelcomeBanner + clearLandingQuery）；QuotaLimitDialog.vue（标题「今日无水印导出次数已用完」，未登录 CTA「登录后可分享送次数」）；edge-functions/api/[[default]].js:710-746（owner 查 KV、IP+日去重键 sharevisit:code:ipHash:day、bonus 上限 10）。已知约束：登录需 SES 邮件（不可用）+ 生产 `x-seatmark-storage: memory` → **服务端赠送/去重仅能以 API 表面行为验证，完整 owner 赠送链路 untested（如实记录）**。entry 预期仍 `index-DOR0it5-.js`（#209 纯文档）。

## T1 匿名配额耗尽 → 引导弹窗 → 分享链路（前端侧）
1. 新 tab demo，角标应显示「今日剩余 1 次」；无水印整页 PNG 导出成功后角标变「带水印免费」（localStorage key used=1、date=今日）。
2. 再点导出→选无水印：**不发生导出**（无 download 事件），QuotaLimitDialog 打开，标题=「今日无水印导出次数已用完」，含价值阶梯「分享被点开 1 次再 +1 次（每日最多 10 次）」与按钮「登录后可分享送次数」（未登录态无复制链接按钮——按代码只有登录后才有专属链接）。截图取证。
3. 被分享链接还原：访问 `https://www.seatmark.cn/?ref=`+8 位 hex 码——断言 ① POST /api/share/visit 发出并记录响应状态/body（memory 存储下码不存在，预期 404/not-found 类响应，如实记录）；② ShareWelcomeBanner 可见（截图）；③ URL 中 ref 参数被 router.replace 清除；④ 非法码（如 ?ref=zzz）不发请求、不出横幅。
4. API 表面（同链路曲线取证，不用 cookie 伪造）：同一 tab 内对同一码二次 POST /api/share/visit 观察响应（memory 下无法证明 IP+日去重生效——记 untested，理由：无有效 owner 码且存储不持久）。

## T2 配额边界
1. 通道一致性：耗尽态下 PNG（整页+逐张模式各一）、PDF、打印三通道点「无水印」均只弹 QuotaLimitDialog、零下载/零打印调用；「带水印」通道全部照常可用（PNG 实导 1 次验证成功 toast）。
2. 取消不扣次（#74 回归）：清 storage 新 tab（剩余 1 次）→ 无水印整页 PNG 导出中点 loading 遮罩「取消」→ toast 含「本次未扣除无水印次数」、无 download、角标仍「今日剩余 1 次」、localStorage used 仍 0；随后正常导出成功应扣为 0。
3. localStorage 篡改容错（每次改后刷新页面）：
   - used=999 → 角标「带水印免费」、无水印被拦，不白屏；
   - used=-5 → 记录实际角标数值（代码推断=剩余 6，Math.max(0,1-(-5))——若如此如实记录为 P4 候选：负值未 clamp 到上限）；
   - value=垃圾串 / 删除键 → 按当日 0 次处理（剩余 1）、不白屏、pageerror 0。
4. 日重置边界：改 localStorage date=昨天、used=1 → 刷新后角标应回「今日剩余 1 次」（todayStr 比对失效即重置）。

## T3 配额文案全站一致
- 角标（今日剩余 n 次）、导出选择弹窗「无水印导出（今日剩余 n 次）」、QuotaLimitDialog 价值阶梯、/pricing（「无水印导出每日 1 次（免费登录即升为每日 3 次）」「分享链接每被点开 1 次即得 1 次」）——同一时点数值/口径一致，截图取证 /pricing 与导出弹窗。

## T4 收尾
- 全程 pageerror 0；清 storage + 关闭全部测试 tab。

产物：/home/ubuntu/r205_dl/、截图 /home/ubuntu/screenshots/r205_*、报告置顶追加 test-report.md「第 205 轮」。headless 不录屏。
