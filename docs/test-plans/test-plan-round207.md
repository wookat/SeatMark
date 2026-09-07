# 第 207 轮：#211 匿名配额 used 负值/NaN clamp 复测（报告记为 test-report.md 第 207 轮）

代码依据（origin/main eb7b390，app/src/stores/quota.ts:22-36）：loadLocalUsage 对 `seatmark.clean-export-usage.v1` 的 used 增加 `Number.isFinite(parsed.used)` 校验 + `Math.max(0, Number(parsed.used))` clamp。**口径勘误**：QUOTA_ANON_DAILY 源码仍=1（quota.ts:8、edge [[default]].js:48），非用户所述 3——本轮判据按 1 执行：used=-5 应显示「今日剩余 1 次」（修复前 r205 实测显示 6 次），实际无水印导出最多 1 次即耗尽弹窗。

## T0 部署确认
- entry = `index-zn4iqgIG.js`，15s 二次采样一致。

## T1 负值 clamp（核心——修复前后可见差异：6 次 vs 1 次）
- localStorage 设 `{date:今日, used:-5}` → 刷新 demo studio → 角标 =「今日剩余 1 次」（若显示 6 次 = FAIL，clamp 未生效）；截图。
- 实导验证：无水印整页 PNG 第 1 次成功（localStorage used 变 1、角标「带水印免费」）；第 2 次点无水印 → 零下载 + QuotaLimitDialog「今日无水印导出次数已用完」。

## T2 NaN/垃圾/删除容错
- `{date:今日, used:NaN}`（JSON 序列化为 null → Number.isFinite(null)=false）→ 剩余 1；
- value=垃圾串、删除键 → 均剩余 1；三例页面正常渲染（角标存在）+ pageerror 0。

## T3 正常回归
- used=0 起：无水印导出 1 次成功 → used=1 → 再点无水印弹耗尽弹窗；导出中点「取消导出」→ toast「本次未扣除无水印次数」、used 不变（抽 PNG 通道）。
- 跨日重置：`{date:昨日, used:99}` → 刷新后角标「今日剩余 1 次」。

## T4 收尾
- 全程 pageerror 0；清 storage + 关闭全部测试 tab；报告置顶追加第 207 轮。

产物：截图 /home/ubuntu/screenshots/r207_*；脚本 /home/ubuntu/r207_*.py。headless 不录屏。
