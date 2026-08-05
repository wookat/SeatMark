# Test Plan — PR #35 腾讯云 SES 邮件通道 + 健康检查 mailChannel

Env: local vite dev server http://localhost:5173 (RESEND_API_KEY/TENCENT_* unset → mailChannel=none), admin email admin@seatmark.cn, in-memory KV, devCode login.

## Shell checks (no recording)
1. `npm run test` → all tests pass (already: 165 passed) — quick reverify done.
2. `npm run build` → exit 0 (done in setup).

## UI flow (recorded)
### Test 1: It should log in admin via devCode and show mailChannel=none in /admin health check
- /account → type admin@seatmark.cn → 发送验证码 → devCode auto-filled + toast「邮件服务未接入」→ login succeeds.
- Navigate to /admin → health check「邮件服务」item shows exact text: 「未配置邮件通道（TENCENT_SES_* 或 RESEND_API_KEY），线上无法发送登录验证码」 (fail if old text or missing).
- Other health items (KV/AUTH_SECRET) render; page has no errors.

### Test 2: It should return mailChannel field in /api/admin/health JSON
- While logged in as admin, open http://localhost:5173/api/admin/health in browser tab.
- Pass iff JSON contains `"mailChannel":"none"` and `"mailConfigured":false`.

### Test 3 (Regression): It should load /studio normally
- Navigate to /studio → main editor UI renders without error screen.
