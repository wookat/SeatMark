---
name: testing-seatmark-local
description: How to run and test SeatMark locally (vite dev server with edge-function middleware, devCode login, admin health check)
---

# Testing SeatMark locally

- `cd app && npm install && npm run dev` — vite on http://localhost:5173. `app/scripts/devApi.mjs` runs `edge-functions/api/[[default]].js` in-process with an in-memory KV, so all `/api/*` routes work locally without EdgeOne.
- devApi reads `process.env` for RESEND_API_KEY / TENCENT_SES_* / AUTH_SECRET / ADMIN_EMAILS. If the shell has a real `RESEND_API_KEY` (Devin secrets inject one), the mail channel becomes `resend` and `/api/auth/code` attempts a real Resend call (may 502). To test the unconfigured/none channel, start with `env -u RESEND_API_KEY -u TENCENT_SES_SECRET_ID -u TENCENT_SES_SECRET_KEY npm run dev`.
- Login: go to `/account`, enter `admin@seatmark.cn` (default admin, override via ADMIN_EMAILS), click 获取验证码. When no mail channel is configured and host is localhost, the API returns `devCode` and the UI auto-fills it (toast 邮件服务未接入); click 登录.
- Admin panel: `/admin` (link 进入管理后台 on `/account` after admin login). Health check section 环境健康检查 shows KV / 邮件服务 (mail channel) / AUTH_SECRET status; JSON at `/api/admin/health` (requires admin session cookie — view it in the logged-in browser, not curl).
- `npm run test` (vitest) and `npm run build` both run from `app/`.
- Avoid `pkill -f vite` inside the same exec call that restarts vite — it can match/kill your own shell command; kill via `fuser -k 5173/tcp` in a separate call, then start the server in a dedicated background shell.
- Useful DEV localStorage keys for browser testing: `seatmark.dev.force-export-fail` = '1' forces PDF export page-render failure (DEV builds only; toast must say quota not consumed); anonymous watermark-free quota lives in `seatmark.clean-export-usage.v1`; Edit One hint dismissal in `seatmark.edit-one-hint-dismissed.v1` (clear it to re-show the first-visit hint bubble in Studio preview).
- To test export cancellation, make the export slow enough: in Studio set 行数 (rows) to 1 with demo data → ~8 pages, then click 取消 on the progress overlay immediately. A 3-page export finishes too fast to cancel reliably.
- To test the share short-code failure dialog, override `fetch` in the page console to return a 545 for `/api/share/tpl` (DevTools request blocking also works); restore afterwards to verify recovery.
- Responsive checks at 390/768 need Chrome DevTools device mode (Chrome window min width ≈532px on Linux); assert `document.documentElement.scrollWidth <= window.innerWidth` per route. Always type full URLs (`http://localhost:5173/...`) with ctrl+l — bare `localhost:5173/x` can be misparsed as a chrome:// URL in some address-bar states.
- Refreshing /studio can clear in-memory demo data (0 pages); re-load via 先用演示数据看看效果.
