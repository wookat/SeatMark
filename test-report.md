# 第 291 轮（2026-08-12）：#294 auth 稳健性线上复测 ✅ 可测项全部 PASS（545 探测 0/50、5xx 友好提示 UI 生效）；⚠️ 登出分支补测仍 BLOCKED（本机 IP 发码日限 429 未重置，UTC 00:00 后可测）

**环境**：部署确认 entry `index-DX45eo51.js` 含「服务暂时不可用，请重试」文案；线上 /api/auth/* 响应头 storage=blob。脚本 `/home/ubuntu/r291_ui2.py`；结果 `r291_probe.json`、`r291_ui.json`、`r291_ui2.json`。计划 test-plan-round291.md。

## T1 545 频率对比（#294 ② Blob Store 模块级单例）— PASSED（趋势口径）
- GET /api/auth/me ×25 + GET /api/quota ×25（间隔 ~0.8s，不消耗发码限额）：**全部 200，545 计 0/50**。
- 口径注记：r290 的 ≈25%（6/24）在 POST /api/auth/code、/api/auth/verify 上测得（发码日限已耗尽，无法在同端点复测），本对比为趋势性而非同端点同口径；0/50 与修复预期一致。

## T2 5xx 友好提示 UI（#294 ③ apiFetch fallback）— PASSED
- CDP Fetch.fulfillRequest 把 /api/auth/code 模拟成真实网关形态（545 + text/html「Error return from script」，Playwright route.fulfill 不接受非标状态码 545，改用原生 CDP）：/account 点「获取验证码」后表单显示**「服务暂时不可用，请重试」**（r290 旧行为为静默零提示，可区分）；截图 r291_t2_545ui.png（OCR 复核）；pageerror=0。
- 反向确认：模拟 400+JSON `{"error":"测试用服务端文案400"}` 时 UI 仍显示服务端文案（fallback 未覆盖正常错误通道）。

## T3 登出分支补测（r290 遗留；含 #294 ① 不吞码顺带）— BLOCKED
- 实探 POST /api/auth/code → 429「请求过于频繁，请明天再试」（storage=blob）——本机 IP 的 20 次/日限额（UTC 日键）未重置，当前 20:06 UTC，**00:00 UTC 后重置可测**。登录→头像下拉登出→me=null→刷新仍未登录 的闭环与错码文案回归（T4）均顺延。#294 ①「verify 成功后才删码」在生产同因无法直接实证（需真实发码）。

## T5 常规 — PASSED
探测请求无 payload / 拦截仅本地模拟（名单零外发）；pageerror=0；storage/cookie 清理、context 全关。headless CDP 未录屏。

---

