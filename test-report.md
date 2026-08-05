# Test Report — PR #35 腾讯云 SES 邮件通道 + 健康检查 mailChannel

**环境**：本地 vite dev server（http://localhost:5173，`app/scripts/devApi.mjs` 跑边缘函数、内存 KV）。注意：本机 shell 中存在 `RESEND_API_KEY` 环境变量，会被 devApi 读取导致通道变为 resend 且真实发送失败；为按计划验证 mailChannel=none，启动 dev server 时用 `env -u RESEND_API_KEY -u TENCENT_SES_SECRET_ID -u TENCENT_SES_SECRET_KEY npm run dev` 剔除。

## 结果汇总

| # | 测试 | 结果 |
|---|------|------|
| 1 | `npm run test`（165 passed / 23 files）+ `npm run build` exit 0 | ✅ |
| 2 | admin@seatmark.cn devCode 登录，/admin 健康检查「邮件服务」显示未配置文案 | ✅ |
| 3 | /api/admin/health JSON 含 `"mailChannel":"none"` | ✅ |
| 4 | 回归：/studio 正常加载 | ✅ |

补充验证（curl，设置 RESEND_API_KEY 时）：通道切为 resend，`POST /api/auth/code` 走真实 Resend 调用（本地无有效 key 时返回 502「验证码发送失败」而非 devCode），证明优先级逻辑真实生效、不是恒为 none。

## 证据

| devCode 登录（邮件服务未接入 toast，验证码自动填入） | /admin 健康检查「邮件服务」未配置文案 |
|---|---|
| ![login](https://app.devin.ai/attachments/bcd90db6-ce70-41c2-941b-1c2252a48eca/ss_78762cae.png) | ![health-zoom](https://app.devin.ai/attachments/c7ececfc-1fe2-42f5-af22-0fde9ab45f5f/ss_zoom_402ebd38.png) |

| /api/admin/health JSON（mailChannel:"none"） | /studio 回归正常 |
|---|---|
| ![health-json](https://app.devin.ai/attachments/ef327526-2234-47ca-87c2-ac218d0dc4ff/ss_444b7da4.png) | ![studio](https://app.devin.ai/attachments/943196a5-1ee2-4088-b00e-2b525e740367/ss_054a87bd.png) |

/admin 全页：

![admin-full](https://app.devin.ai/attachments/1dae8259-a7fe-4007-812b-830293a63142/ss_4384ac76.png)

## 备注 / 局限
- 未实际验证腾讯云 SES 真实发信（需要 TENCENT_SES_SECRET_ID/KEY 与已审核的发信域名/模板）；TC3 签名正确性由 tc3Signature.spec.ts 对拍单测覆盖。
- 控制台仅有本地 dev 环境固有的 SW 注册警告（sw.js MIME），与本 PR 无关。
