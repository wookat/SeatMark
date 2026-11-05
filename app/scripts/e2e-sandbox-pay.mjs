/**
 * 沙箱支付 E2E 脚本：注册 → 下单 → 交易查询（未支付态）→ 保存收银台 HTML。
 * 用法：node scripts/e2e-sandbox-pay.mjs
 * 依赖 dev server 已启动（注入 .alipay-sandbox.json 的 ALIPAY_* 沙箱配置）。
 */
import { writeFileSync } from 'node:fs'

const BASE = process.env.SEATMARK_BASE || 'http://localhost:5173'
const EMAIL = `sandbox-${Date.now().toString(36)}@example.com`
const PASSWORD = 'super-secret-1'

// 1. 图形验证码：从 SVG 文本节点还原字符
const cap = await fetch(`${BASE}/api/auth/captcha`).then((r) => r.json())
const svg = Buffer.from(cap.image.replace(/^data:image\/svg\+xml;base64,/, ''), 'base64').toString('utf-8')
const captchaAnswer = [...svg.matchAll(/<text [^>]*>([^<])<\/text>/g)].map((m) => m[1]).join('')
console.log('[1] captcha solved')

// 2. 注册
const reg = await fetch(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD, captchaToken: cap.token, captchaAnswer: captchaAnswer.toLowerCase() }),
})
if (reg.status !== 200) {
  console.error('register failed:', reg.status, await reg.text())
  process.exit(1)
}
const cookie = (reg.headers.get('set-cookie') || '').split(';')[0]
console.log('[2] registered:', EMAIL)

// 3. 下单
const ordRes = await fetch(`${BASE}/api/pay/order`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ plan: 'pro-30' }),
})
const ord = await ordRes.json()
if (ordRes.status !== 200) {
  console.error('order failed:', ordRes.status, JSON.stringify(ord))
  process.exit(1)
}
console.log('[3] order created:', ord.orderNo, 'amount:', ord.amount)

// 4. 未支付态交易查询（真实打到沙箱网关，验证请求签名 + 响应验签链路）
const q1 = await fetch(`${BASE}/api/pay/order?no=${ord.orderNo}&refresh=1`, { headers: { Cookie: cookie } }).then((r) => r.json())
console.log('[4] query-before-pay:', JSON.stringify(q1.order))

// 5. 保存收银台 HTML 与上下文供浏览器自动化
writeFileSync('scripts/.e2e-pay.html', ord.paymentHtml)
writeFileSync('scripts/.e2e-pay.json', JSON.stringify({ email: EMAIL, cookie, orderNo: ord.orderNo }, null, 2))
console.log('[5] payment form saved to scripts/.e2e-pay.html; context -> scripts/.e2e-pay.json')
