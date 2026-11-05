/**
 * 支付宝 OpenAPI 轻量客户端（EdgeOne edge runtime 版）
 *
 * 边缘函数是纯 Web 运行时（无 node:crypto），官方 alipay-sdk（Node.js，依赖
 * node:crypto + urllib）无法运行。本模块用 WebCrypto 的 RSASSA-PKCS1-v1_5 + fetch
 * 实现同一套 RSA2 签名/验签与网关调用，密钥字段与官方契约对齐：
 *   - 应用私钥：env.ALIPAY_PRIVATE_KEY，PKCS#8 或 PKCS#1（自动嗅探并包装为 PKCS#8 导入）；
 *     超出 1000 字符限制时用 ALIPAY_PRIVATE_KEY_1/_2/_3 分段拼接（单值优先）
 *   - 支付宝公钥：env.ALIPAY_PUBLIC_KEY，SPKI base64（可带 PEM 头尾）
 *   - 网关：env.ALIPAY_GATEWAY（缺省生产网关；沙箱注入 https://openapi-sandbox.dl.alipaydev.com/gateway.do）
 *   - 可选：ALIPAY_NOTIFY_URL / ALIPAY_RETURN_URL / ALIPAY_SELLER_ID / ALIPAY_SELLER_EMAIL
 *
 * 签名规则（与官方 SDK 一致）：参数按 key 字典序排序，k=v 以原始值（不 URL 编码）
 * 用 & 连接成待签名串，RSA2(SHA256withRSA) 签名后 base64；传输层再做表单编码。
 */

const encoder = new TextEncoder()

/** 配置缺失/非法时抛出；路由统一转 503 pay_not_configured */
export class AlipayConfigError extends Error {}

/** 网关调用或响应验签失败；路由按不可用处理并记录 */
export class AlipayApiError extends Error {}

/** yyyy-MM-dd HH:mm:ss（空格分隔，支付宝要求格式） */
export function alipayTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** 金额归一化为「元」两位小数字符串（"88"、"88.8" → "88.00"），非法返回 null；不引入浮点比较 */
export function normalizeAmount(value) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  const match = text.match(/^(\d+)(?:\.(\d{1,2}))?$/)
  if (!match) return null
  return `${BigInt(match[1]).toString()}.${(match[2] || '').padEnd(2, '0')}`
}

function b64ToBytes(b64) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToB64(bytes) {
  let s = ''
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b)
  return btoa(s)
}

/** 去掉 PEM 头尾与全部空白，返回裸 base64 */
function stripPem(text) {
  return String(text)
    .replace(/-----BEGIN [A-Z0-9 ]+-----/g, '')
    .replace(/-----END [A-Z0-9 ]+-----/g, '')
    .replace(/\s+/g, '')
}

/** DER TLV 读第一个元素：返回 {tag, headerLen, contentLen, totalLen} */
function derRead(buf, offset) {
  const tag = buf[offset]
  let len = buf[offset + 1]
  let headerLen = 2
  if (len & 0x80) {
    const n = len & 0x7f
    len = 0
    for (let i = 0; i < n; i++) len = (len << 8) | buf[offset + 2 + i]
    headerLen = 2 + n
  }
  return { tag, headerLen, contentLen: len, totalLen: headerLen + len }
}

/** DER 长度编码 */
function derLen(n) {
  if (n < 0x80) return [n]
  const bytes = []
  let v = n
  while (v > 0) {
    bytes.unshift(v & 0xff)
    v >>= 8
  }
  return [0x80 | bytes.length, ...bytes]
}

/**
 * 私钥归一化为 PKCS#8 DER：已是 PKCS#8 原样返回；PKCS#1 RSAPrivateKey
 * 包装一层 PrivateKeyInfo（rsaEncryption OID）。WebCrypto 只认 pkcs8。
 * 判别依据第二元素：PKCS#8 的第二个元素是 algid SEQUENCE，PKCS#1 是模数 n INTEGER。
 */
function pkcs1ToPkcs8(der) {
  const outer = derRead(der, 0)
  if (outer.tag !== 0x30) throw new AlipayConfigError('private key is not a DER sequence')
  const first = derRead(der, outer.headerLen)
  const second = derRead(der, outer.headerLen + first.totalLen)
  if (second.tag === 0x30) return der
  if (second.tag !== 0x02) throw new AlipayConfigError('unsupported private key format')
  const algid = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00]
  const innerLen = der.length
  const body = [
    0x02, 0x01, 0x00,
    ...algid,
    0x04, ...derLen(innerLen), ...der,
  ]
  return new Uint8Array([0x30, ...derLen(body.length), ...body])
}

async function importPrivateKey(rawKey) {
  const der = b64ToBytes(stripPem(rawKey))
  const pkcs8 = pkcs1ToPkcs8(der)
  return crypto.subtle.importKey(
    'pkcs8',
    pkcs8,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

async function importPublicKey(rawKey) {
  const der = b64ToBytes(stripPem(rawKey))
  return crypto.subtle.importKey(
    'spki',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
}

/**
 * 加载运行时支付配置。env 字段缺失/无法导入密钥时抛 AlipayConfigError；
 * 调用方据此 fail closed，不回退示例值或跳过验签。
 */
export async function loadAlipayConfig(env, origin) {
  const appId = (env && env.ALIPAY_APP_ID) || ''
  // EdgeOne 环境变量单值上限 1000 字符，RSA 私钥超限时可拆成 ALIPAY_PRIVATE_KEY_1/_2/_3 拼接
  const privateKeyRaw =
    (env && env.ALIPAY_PRIVATE_KEY) ||
    ['ALIPAY_PRIVATE_KEY_1', 'ALIPAY_PRIVATE_KEY_2', 'ALIPAY_PRIVATE_KEY_3']
      .map((k) => (env && env[k]) || '')
      .join('')
  const alipayPublicKeyRaw = (env && env.ALIPAY_PUBLIC_KEY) || ''
  if (!appId || !privateKeyRaw || !alipayPublicKeyRaw) {
    throw new AlipayConfigError('missing ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY / ALIPAY_PUBLIC_KEY')
  }
  const [privateKey, alipayPublicKey] = await Promise.all([
    importPrivateKey(privateKeyRaw).catch((e) => {
      throw new AlipayConfigError(`invalid ALIPAY_PRIVATE_KEY: ${e.message || e}`)
    }),
    importPublicKey(alipayPublicKeyRaw).catch((e) => {
      throw new AlipayConfigError(`invalid ALIPAY_PUBLIC_KEY: ${e.message || e}`)
    }),
  ])
  return {
    appId,
    privateKey,
    alipayPublicKey,
    gateway: (env && env.ALIPAY_GATEWAY) || 'https://openapi.alipay.com/gateway.do',
    notifyUrl: ((env && env.ALIPAY_NOTIFY_URL) || '').trim() || null,
    returnUrl: ((env && env.ALIPAY_RETURN_URL) || '').trim() || (origin ? `${origin}/pay/result` : null),
    sellerId: ((env && env.ALIPAY_SELLER_ID) || '').trim() || null,
    sellerEmail: ((env && env.ALIPAY_SELLER_EMAIL) || '').trim() || null,
  }
}

/** 待签名串：key 字典序，k=v 原始值 & 连接（不 URL 编码） */
export function signContent(params) {
  return Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
}

async function rsaSign(privateKey, content) {
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, encoder.encode(content))
  return bytesToB64(sig)
}

async function rsaVerify(publicKey, content, signatureB64) {
  try {
    return await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      b64ToBytes(signatureB64),
      encoder.encode(content),
    )
  } catch {
    return false
  }
}

/**
 * alipay.trade.page.pay 的支付表单（等价 SDK pageExec 的 POST 形态）：
 * 返回带自动提交脚本的 HTML <form>，前端渲染后自动跳转支付宝收银台。
 * notifyUrl 为 null 时省略该字段（不传占位值）；returnUrl 缺省省略。
 */
export async function pagePayFormHtml(cfg, { outTradeNo, totalAmount, subject, notifyUrl, returnUrl }) {
  const params = {
    app_id: cfg.appId,
    method: 'alipay.trade.page.pay',
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: alipayTimestamp(),
    version: '1.0',
    biz_content: JSON.stringify({
      out_trade_no: outTradeNo,
      total_amount: totalAmount,
      subject,
      product_code: 'FAST_INSTANT_TRADE_PAY',
    }),
  }
  const effectiveNotifyUrl = notifyUrl || cfg.notifyUrl
  if (effectiveNotifyUrl) params.notify_url = effectiveNotifyUrl
  const effectiveReturnUrl = returnUrl || cfg.returnUrl
  if (effectiveReturnUrl) params.return_url = effectiveReturnUrl
  params.sign = await rsaSign(cfg.privateKey, signContent(params))

  const esc = (s) =>
    String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
  const inputs = Object.keys(params)
    .sort()
    .map((k) => `<input type="hidden" name="${esc(k)}" value="${esc(params[k])}">`)
    .join('\n')
  return `<form name="punchout_form" method="post" action="${esc(cfg.gateway)}?charset=utf-8">
${inputs}
<input type="submit" value="ok" style="display:none">
</form>
<script>document.forms[0].submit();</script>`
}

/** 服务端 API 调用（exec）：表单 POST 到网关，校验响应 JSON 节点签名后返回响应体 */
export async function alipayExec(cfg, method, bizContent) {
  const params = {
    app_id: cfg.appId,
    method,
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: alipayTimestamp(),
    version: '1.0',
    biz_content: JSON.stringify(bizContent),
  }
  params.sign = await rsaSign(cfg.privateKey, signContent(params))

  const body = Object.keys(params)
    .map((k) => `${k}=${encodeURIComponent(params[k])}`)
    .join('&')
  let res
  try {
    res = await fetch(cfg.gateway, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body,
    })
  } catch (e) {
    throw new AlipayApiError(`gateway request failed: ${e.message || e}`)
  }
  const text = await res.text()
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new AlipayApiError(`gateway returned non-JSON (http ${res.status})`)
  }

  const respKey = Object.keys(parsed).find((k) => k.endsWith('_response'))
  if (!respKey) throw new AlipayApiError('gateway response missing *_response node')
  const node = parsed[respKey]
  const signature = parsed.sign
  if (typeof signature !== 'string' || !signature) {
    throw new AlipayApiError('gateway response missing sign')
  }
  const rawNode = extractJsonNode(text, respKey)
  if (!rawNode || !(await rsaVerify(cfg.alipayPublicKey, rawNode, signature))) {
    throw new AlipayApiError('gateway response signature verification failed')
  }
  return node
}

/**
 * 从原始响应文本取出 "<key>":{...} 节点的精确子串（即被签名的原文），
 * 用括号配对定位到平衡的 }。
 */
export function extractJsonNode(text, key) {
  const needle = `"${key}"`
  const start = text.indexOf(needle)
  if (start < 0) return null
  const objStart = text.indexOf('{', start + needle.length)
  if (objStart < 0) return null
  let depth = 0
  let inStr = false
  let escaped = false
  for (let i = objStart; i < text.length; i++) {
    const ch = text[i]
    if (inStr) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(objStart, i + 1)
    }
  }
  return null
}

/**
 * 异步通知验签：全部参数（剔除 sign、sign_type）按 key 字典序 k=v 原始值 & 连接，
 * 用支付宝公钥 RSA2 验签。params 来自 application/x-www-form-urlencoded 解析后的平面对象。
 */
export async function verifyAlipayNotify(cfg, params) {
  const sign = params.sign
  if (typeof sign !== 'string' || !sign) return false
  const content = Object.keys(params)
    .filter((k) => k !== 'sign' && k !== 'sign_type')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  return rsaVerify(cfg.alipayPublicKey, content, sign)
}
