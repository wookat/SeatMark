/**
 * SeatMark 账号体系 API（EdgeOne Pages Edge Function，catch-all 路由）
 *
 * 覆盖 /api/* 中未被具体文件（ai-design.js / feedback.js）命中的所有路径：
 *   POST /api/auth/code          发送邮箱验证码（限频）
 *   POST /api/auth/verify        校验验证码，签发 httpOnly JWT 会话
 *   GET  /api/auth/me            当前登录用户（含配额/分享状态）
 *   POST /api/auth/logout        退出登录
 *   GET  /api/account/templates  拉取云端模板
 *   PUT  /api/account/templates  上传（覆盖）云端模板
 *   GET  /api/quota              当前配额状态（登录用户）
 *   POST /api/quota/consume      消耗一次无水印导出配额（登录用户，服务端计数）
 *   GET  /api/share/mine         我的分享码与裂变进度
 *   POST /api/share/visit        分享链接访问上报（IP+日去重，为分享者赠送次数）
 *   POST /api/team/reserve       团队版预订登记
 *   GET  /api/announcement       公告（公开）
 *   GET  /api/admin/health       环境健康检查（KV/邮件/AUTH_SECRET 配置状态）
 *   GET  /api/admin/overview     管理端总览（用户数/增长/模板同步/配额/裂变/预订）
 *   GET  /api/admin/users        用户列表
 *   GET  /api/admin/feedback     反馈列表（KV 存档，见 feedback.js）
 *   GET  /api/admin/reservations 团队版意向名单
 *   GET  /api/admin/announcement 公告读取（管理员）
 *   PUT  /api/admin/announcement 公告配置（管理员）
 *
 * 环境变量（EdgeOne Pages 控制台配置）：
 * - AUTH_SECRET      JWT 签名密钥（必配，未配置时使用开发默认值并在响应头标记）
 * - ADMIN_EMAILS     管理员邮箱白名单，逗号分隔（未配置则管理端全部 403）
 * - TENCENT_SES_SECRET_ID    腾讯云 SES SecretId（配置后优先走腾讯云 SES 发送验证码）
 * - TENCENT_SES_SECRET_KEY   腾讯云 SES SecretKey
 * - TENCENT_SES_REGION       腾讯云 SES 地域（默认 ap-guangzhou）
 * - TENCENT_SES_TEMPLATE_ID  腾讯云 SES 模板 ID（可选；配置后用模板发送，变量 {code}/{ttl}）
 * - RESEND_API_KEY   Resend 邮件发送密钥（腾讯云未配置时的备用通道；都未配置时仅本地开发环境以 devCode 形式返回验证码）
 * - MAIL_FROM        发件地址（默认 SeatMark <noreply@seatmark.cn>）
 *
 * KV 绑定（EdgeOne Pages 控制台 → KV 存储 → 绑定命名空间，变量名 seatmark_kv）：
 * 未绑定时自动降级为进程内存存储（数据不持久，仅用于联调）。
 */

// ---------- 配额与裂变参数（前端 quota.ts 与此保持一致；计数对象为无水印导出，带水印不限次） ----------
const QUOTA_ANON_DAILY = 1
const QUOTA_USER_DAILY = 3
const SHARE_BONUS_PER_VISIT = 1
const SHARE_BONUS_DAILY_CAP = 10

const SESSION_COOKIE = 'sm_session'
const SESSION_TTL_SECONDS = 30 * 24 * 3600
const CODE_TTL_MS = 10 * 60 * 1000
const CODE_RESEND_INTERVAL_MS = 60 * 1000
const CODE_MAX_ATTEMPTS = 5
const CODE_IP_DAILY_LIMIT = 20
const TEMPLATES_MAX_BYTES = 512 * 1024

const memoryStore = new Map()

/** KV 抽象：优先 EdgeOne KV 绑定（变量名 seatmark_kv），未绑定降级为内存 Map */
function getKv(env) {
  const kv =
    (env && env.seatmark_kv) ||
    (typeof globalThis !== 'undefined' ? globalThis.seatmark_kv : undefined)
  if (kv && typeof kv.get === 'function') return { kv, persistent: true }
  return {
    persistent: false,
    kv: {
      async get(key) {
        return memoryStore.has(key) ? memoryStore.get(key) : null
      },
      async put(key, value) {
        memoryStore.set(key, String(value))
      },
      async delete(key) {
        memoryStore.delete(key)
      },
      async list({ prefix = '', limit = 256, cursor = '' } = {}) {
        const keys = [...memoryStore.keys()]
          .filter((k) => k.startsWith(prefix))
          .sort()
        const start = cursor ? keys.indexOf(cursor) + 1 : 0
        const page = keys.slice(start, start + limit)
        return {
          keys: page.map((name) => ({ name })),
          complete: start + limit >= keys.length,
          cursor: page.length ? page[page.length - 1] : '',
        }
      },
    },
  }
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_RE.test(email)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

// ---------- JWT（HS256，Web Crypto） ----------
const encoder = new TextEncoder()

function b64url(bytes) {
  let s = ''
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b)
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4))
  return atob(str.replaceAll('-', '+').replaceAll('_', '/') + pad)
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

async function signJwt(payload, secret) {
  const header = b64url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = b64url(encoder.encode(JSON.stringify(payload)))
  const key = await hmacKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${body}`))
  return `${header}.${body}.${b64url(sig)}`
}

async function verifyJwt(token, secret) {
  try {
    const [header, body, sig] = token.split('.')
    if (!header || !body || !sig) return null
    const key = await hmacKey(secret)
    const sigBytes = Uint8Array.from(b64urlDecode(sig), (c) => c.charCodeAt(0))
    const ok = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      encoder.encode(`${header}.${body}`),
    )
    if (!ok) return null
    const payload = JSON.parse(b64urlDecode(body))
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

function getSecret(env) {
  return (env && env.AUTH_SECRET) || 'seatmark-dev-secret-do-not-use-in-prod'
}

function parseCookies(request) {
  const raw = request.headers.get('Cookie') || ''
  const out = {}
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=')
    if (idx > 0) out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim()
  }
  return out
}

async function currentUserEmail(request, env) {
  const token = parseCookies(request)[SESSION_COOKIE]
  if (!token) return null
  const payload = await verifyJwt(token, getSecret(env))
  return payload && typeof payload.sub === 'string' ? payload.sub : null
}

function sessionCookie(token, maxAge = SESSION_TTL_SECONDS) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
}

function isAdmin(email, env) {
  const list = ((env && env.ADMIN_EMAILS) || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return Boolean(email) && list.includes(email.toLowerCase())
}

function clientIp(request) {
  return (
    request.headers.get('EO-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ---------- 用户与配额 ----------
async function getUser(kv, email) {
  const raw = await kv.get(`user:${email}`)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function putUser(kv, user) {
  await kv.put(`user:${user.email}`, JSON.stringify(user))
}

async function getCounter(kv, key) {
  const raw = await kv.get(key)
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

async function quotaStatus(kv, email) {
  const date = today()
  const used = await getCounter(kv, `usage:${email}:${date}`)
  const bonus = await getCounter(kv, `bonus:${email}:${date}`)
  const limit = QUOTA_USER_DAILY + Math.min(bonus, SHARE_BONUS_DAILY_CAP)
  return { date, used, limit, bonus, remaining: Math.max(0, limit - used) }
}

async function shareCodeFor(kv, email) {
  const existing = await kv.get(`share:owner:${email}`)
  if (existing) return existing
  const code = (await sha256Hex(`${email}:${Date.now()}`)).slice(0, 8)
  await kv.put(`share:owner:${email}`, code)
  await kv.put(`share:code:${code}`, email)
  return code
}

async function shareStats(kv, email) {
  const code = await shareCodeFor(kv, email)
  const totalVisits = await getCounter(kv, `sharestat:visits:${code}`)
  const totalBonus = await getCounter(kv, `sharestat:bonus:${code}`)
  const bonusToday = await getCounter(kv, `bonus:${email}:${today()}`)
  return {
    code,
    totalVisits,
    totalBonus,
    bonusToday: Math.min(bonusToday, SHARE_BONUS_DAILY_CAP),
    bonusDailyCap: SHARE_BONUS_DAILY_CAP,
    bonusPerVisit: SHARE_BONUS_PER_VISIT,
  }
}

async function publicUser(kv, email, env) {
  const user = await getUser(kv, email)
  if (!user) return null
  return {
    email: user.email,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    loginCount: user.loginCount,
    templateCount: user.templateCount || 0,
    templateUpdatedAt: user.templateUpdatedAt || null,
    betaMember: true,
    isAdmin: isAdmin(email, env),
    quota: await quotaStatus(kv, email),
    share: await shareStats(kv, email),
  }
}

// ---------- 腾讯云 TC3-HMAC-SHA256 签名（边缘环境无 SDK，基于 Web Crypto 手写） ----------
async function hmacSha256Raw(keyBytes, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return new Uint8Array(sig)
}

function hex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 计算腾讯云 API TC3-HMAC-SHA256 签名，返回 Authorization 头。
 * 规范见 https://cloud.tencent.com/document/api/1288/51889
 * @param {{secretId:string,secretKey:string,service:string,host:string,action:string,payload:string,timestamp:number}} params
 */
export async function tc3Authorization({ secretId, secretKey, service, host, action, payload, timestamp }) {
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
  const signedHeaders = 'content-type;host;x-tc-action'
  const hashedPayload = await sha256Hex(payload)
  const canonicalRequest = [
    'POST',
    '/',
    '',
    `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`,
    signedHeaders,
    hashedPayload,
  ].join('\n')

  const credentialScope = `${date}/${service}/tc3_request`
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n')

  const secretDate = await hmacSha256Raw(encoder.encode(`TC3${secretKey}`), date)
  const secretService = await hmacSha256Raw(secretDate, service)
  const secretSigning = await hmacSha256Raw(secretService, 'tc3_request')
  const signature = hex(await hmacSha256Raw(secretSigning, stringToSign))

  return `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
}

// ---------- 验证码发送 ----------
const SES_HOST = 'ses.tencentcloudapi.com'
const SES_VERSION = '2020-10-02'

/** 当前生效的邮件通道：tencent-ses / resend / none */
export function mailChannel(env) {
  if (env && env.TENCENT_SES_SECRET_ID && env.TENCENT_SES_SECRET_KEY) return 'tencent-ses'
  if (env && env.RESEND_API_KEY) return 'resend'
  return 'none'
}

function mailFrom(env) {
  return (env && env.MAIL_FROM) || 'SeatMark <noreply@seatmark.cn>'
}

async function sendCodeMailTencent(env, email, code) {
  const subject = `【SeatMark 座签】登录验证码 ${code}`
  const text = `你的登录验证码是：${code}，10 分钟内有效。如非本人操作请忽略本邮件。`
  const templateId = Number(env.TENCENT_SES_TEMPLATE_ID)
  const payloadObj = {
    FromEmailAddress: mailFrom(env),
    Destination: [email],
    Subject: subject,
  }
  if (Number.isFinite(templateId) && templateId > 0) {
    // 国内站触发类邮件建议（部分地域强制）使用审核通过的模板发送
    payloadObj.Template = {
      TemplateID: templateId,
      TemplateData: JSON.stringify({ code, ttl: '10' }),
    }
  } else {
    payloadObj.Simple = {
      Text: btoa(String.fromCharCode(...encoder.encode(text))),
    }
  }
  const payload = JSON.stringify(payloadObj)
  const timestamp = Math.floor(Date.now() / 1000)
  const authorization = await tc3Authorization({
    secretId: env.TENCENT_SES_SECRET_ID,
    secretKey: env.TENCENT_SES_SECRET_KEY,
    service: 'ses',
    host: SES_HOST,
    action: 'SendEmail',
    payload,
    timestamp,
  })
  try {
    const res = await fetch(`https://${SES_HOST}`, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json; charset=utf-8',
        Host: SES_HOST,
        'X-TC-Action': 'SendEmail',
        'X-TC-Version': SES_VERSION,
        'X-TC-Timestamp': String(timestamp),
        'X-TC-Region': (env && env.TENCENT_SES_REGION) || 'ap-guangzhou',
      },
      body: payload,
    })
    if (!res.ok) return { configured: true, delivered: false }
    const data = await res.json().catch(() => null)
    return { configured: true, delivered: !data?.Response?.Error }
  } catch {
    return { configured: true, delivered: false }
  }
}

async function sendCodeMailResend(env, email, code) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: mailFrom(env),
        to: [email],
        subject: `【SeatMark 座签】登录验证码 ${code}`,
        text: `你的登录验证码是：${code}，10 分钟内有效。如非本人操作请忽略本邮件。`,
      }),
    })
    return { configured: true, delivered: res.ok }
  } catch {
    return { configured: true, delivered: false }
  }
}

/** 发送优先级：腾讯云 SES → Resend → 未配置 */
async function sendCodeMail(env, email, code) {
  const channel = mailChannel(env)
  if (channel === 'tencent-ses') return sendCodeMailTencent(env, email, code)
  if (channel === 'resend') return sendCodeMailResend(env, email, code)
  return { configured: false, delivered: false }
}

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

/** 是否本地开发环境：仅此时允许在邮件未配置的情况下把 devCode 返回给前端 */
function isLocalDev(url, env) {
  return LOCAL_HOSTNAMES.has(url.hostname) || Boolean(env && env.DEV)
}

// ---------- 路由处理 ----------
export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const method = request.method

  if (method === 'OPTIONS') return new Response(null, { status: 204 })

  const { kv, persistent } = getKv(env)
  const storageHeader = { 'X-SeatMark-Storage': persistent ? 'kv' : 'memory' }

  async function readBody() {
    try {
      return await request.json()
    } catch {
      return null
    }
  }

  // ----- 认证 -----
  if (path === '/api/auth/code' && method === 'POST') {
    const body = await readBody()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!isValidEmail(email)) return json({ error: '邮箱格式不正确' }, 400, storageHeader)

    // IP 日限频
    const ip = clientIp(request)
    const ipKey = `rl:ip:${await sha256Hex(ip)}:${today()}`
    const ipCount = await getCounter(kv, ipKey)
    if (ipCount >= CODE_IP_DAILY_LIMIT) {
      return json({ error: '请求过于频繁，请明天再试' }, 429, storageHeader)
    }

    // 邮箱 60s 重发间隔
    const codeKey = `code:${email}`
    const existingRaw = await kv.get(codeKey)
    if (existingRaw) {
      try {
        const existing = JSON.parse(existingRaw)
        if (Date.now() - existing.sentAt < CODE_RESEND_INTERVAL_MS) {
          return json({ error: '发送太频繁，请稍后再试' }, 429, storageHeader)
        }
      } catch {
        // 记录损坏则直接覆盖
      }
    }

    const code = String(Math.floor(100000 + Math.random() * 900000))
    await kv.put(
      codeKey,
      JSON.stringify({ code, sentAt: Date.now(), exp: Date.now() + CODE_TTL_MS, attempts: 0 }),
    )
    await kv.put(ipKey, String(ipCount + 1))

    const { configured, delivered } = await sendCodeMail(env, email, code)
    if (delivered) return json({ ok: true, delivery: 'email' }, 200, storageHeader)
    if (!configured) {
      // 邮件服务未配置：仅本地开发环境把 devCode 回显给前端供联调，线上一律报错
      if (isLocalDev(url, env)) {
        return json({ ok: true, delivery: 'stub', devCode: code }, 200, storageHeader)
      }
      return json({ error: '邮件服务未配置，请联系管理员' }, 503, storageHeader)
    }
    return json({ error: '验证码发送失败，请稍后再试' }, 502, storageHeader)
  }

  if (path === '/api/auth/verify' && method === 'POST') {
    const body = await readBody()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const code = typeof body?.code === 'string' ? body.code.trim() : ''
    if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
      return json({ error: '邮箱或验证码格式不正确' }, 400, storageHeader)
    }

    const codeKey = `code:${email}`
    const raw = await kv.get(codeKey)
    if (!raw) return json({ error: '验证码已过期，请重新获取' }, 400, storageHeader)
    let record
    try {
      record = JSON.parse(raw)
    } catch {
      return json({ error: '验证码已过期，请重新获取' }, 400, storageHeader)
    }
    if (record.exp < Date.now()) {
      await kv.delete(codeKey)
      return json({ error: '验证码已过期，请重新获取' }, 400, storageHeader)
    }
    if (record.attempts >= CODE_MAX_ATTEMPTS) {
      await kv.delete(codeKey)
      return json({ error: '尝试次数过多，请重新获取验证码' }, 429, storageHeader)
    }
    if (record.code !== code) {
      record.attempts += 1
      await kv.put(codeKey, JSON.stringify(record))
      return json({ error: '验证码不正确' }, 400, storageHeader)
    }
    await kv.delete(codeKey)

    let user = await getUser(kv, email)
    const now = new Date().toISOString()
    if (!user) {
      user = { email, createdAt: now, lastLoginAt: now, loginCount: 1, templateCount: 0 }
    } else {
      user.lastLoginAt = now
      user.loginCount = (user.loginCount || 0) + 1
    }
    await putUser(kv, user)

    const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
    const token = await signJwt({ sub: email, exp }, getSecret(env))
    return json(
      { ok: true, user: await publicUser(kv, email, env) },
      200,
      { ...storageHeader, 'Set-Cookie': sessionCookie(token) },
    )
  }

  if (path === '/api/auth/me' && method === 'GET') {
    const email = await currentUserEmail(request, env)
    if (!email) return json({ user: null }, 200, storageHeader)
    return json({ user: await publicUser(kv, email, env) }, 200, storageHeader)
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    return json({ ok: true }, 200, { ...storageHeader, 'Set-Cookie': sessionCookie('', 0) })
  }

  // ----- 账号注销（删除与账号关联的全部个人信息） -----
  if (path === '/api/account/delete' && method === 'POST') {
    const email = await currentUserEmail(request, env)
    if (!email) return json({ error: '请先登录' }, 401, storageHeader)
    const shareCode = await kv.get(`share:owner:${email}`)
    await kv.delete(`user:${email}`)
    await kv.delete(`tpl:${email}`)
    if (shareCode) {
      await kv.delete(`share:owner:${email}`)
      await kv.delete(`share:code:${shareCode}`)
    }
    try {
      const usage = await kv.list({ prefix: `usage:${email}:`, limit: 64 })
      for (const { name } of usage.keys || []) await kv.delete(name)
      const bonus = await kv.list({ prefix: `bonus:${email}:`, limit: 64 })
      for (const { name } of bonus.keys || []) await kv.delete(name)
    } catch {
      // 计数键按日过期，删除失败不阻塞注销
    }
    return json({ ok: true }, 200, { ...storageHeader, 'Set-Cookie': sessionCookie('', 0) })
  }

  // ----- 云端模板 -----
  if (path === '/api/account/templates') {
    const email = await currentUserEmail(request, env)
    if (!email) return json({ error: '请先登录' }, 401, storageHeader)

    if (method === 'GET') {
      const raw = await kv.get(`tpl:${email}`)
      let templates = []
      if (raw) {
        try {
          templates = JSON.parse(raw)
        } catch {
          templates = []
        }
      }
      return json({ templates }, 200, storageHeader)
    }

    if (method === 'PUT') {
      const body = await readBody()
      if (!body || !Array.isArray(body.templates)) {
        return json({ error: '请求体需要 templates 数组' }, 400, storageHeader)
      }
      const serialized = JSON.stringify(body.templates)
      if (serialized.length > TEMPLATES_MAX_BYTES) {
        return json({ error: '模板数据超过 512KB 上限' }, 413, storageHeader)
      }
      await kv.put(`tpl:${email}`, serialized)
      const user = (await getUser(kv, email)) || {
        email,
        createdAt: new Date().toISOString(),
        loginCount: 1,
      }
      user.templateCount = body.templates.length
      user.templateUpdatedAt = new Date().toISOString()
      await putUser(kv, user)
      return json(
        { ok: true, count: body.templates.length, updatedAt: user.templateUpdatedAt },
        200,
        storageHeader,
      )
    }
    return json({ error: '请求方法不支持' }, 405, storageHeader)
  }

  // ----- 配额 -----
  if (path === '/api/quota' && method === 'GET') {
    const email = await currentUserEmail(request, env)
    if (!email) {
      return json(
        { anonymous: true, limit: QUOTA_ANON_DAILY, loggedInLimit: QUOTA_USER_DAILY },
        200,
        storageHeader,
      )
    }
    return json({ anonymous: false, ...(await quotaStatus(kv, email)) }, 200, storageHeader)
  }

  if (path === '/api/quota/consume' && method === 'POST') {
    const email = await currentUserEmail(request, env)
    if (!email) return json({ error: '请先登录' }, 401, storageHeader)
    const status = await quotaStatus(kv, email)
    if (status.remaining <= 0) {
      return json({ error: '今日无水印导出次数已用完', ...status }, 429, storageHeader)
    }
    const used = status.used + 1
    await kv.put(`usage:${email}:${status.date}`, String(used))
    return json(
      { ok: true, ...status, used, remaining: status.limit - used },
      200,
      storageHeader,
    )
  }

  // ----- 分享裂变 -----
  if (path === '/api/share/mine' && method === 'GET') {
    const email = await currentUserEmail(request, env)
    if (!email) return json({ error: '请先登录' }, 401, storageHeader)
    return json(await shareStats(kv, email), 200, storageHeader)
  }

  if (path === '/api/share/visit' && method === 'POST') {
    const body = await readBody()
    const code = typeof body?.code === 'string' ? body.code.trim() : ''
    if (!/^[0-9a-f]{8}$/.test(code)) return json({ error: '分享码无效' }, 400, storageHeader)
    const owner = await kv.get(`share:code:${code}`)
    if (!owner) return json({ error: '分享码无效' }, 400, storageHeader)

    // 访问者本人打开自己的链接不计数
    const visitor = await currentUserEmail(request, env)
    if (visitor && visitor === owner) return json({ ok: true, counted: false }, 200, storageHeader)

    // IP + 日去重
    const ipHash = await sha256Hex(clientIp(request))
    const dedupeKey = `sharevisit:${code}:${ipHash}:${today()}`
    if (await kv.get(dedupeKey)) return json({ ok: true, counted: false }, 200, storageHeader)
    await kv.put(dedupeKey, '1')

    await kv.put(
      `sharestat:visits:${code}`,
      String((await getCounter(kv, `sharestat:visits:${code}`)) + 1),
    )

    // 赠送次数（每日封顶）
    const bonusKey = `bonus:${owner}:${today()}`
    const bonusToday = await getCounter(kv, bonusKey)
    if (bonusToday < SHARE_BONUS_DAILY_CAP) {
      const granted = Math.min(SHARE_BONUS_PER_VISIT, SHARE_BONUS_DAILY_CAP - bonusToday)
      await kv.put(bonusKey, String(bonusToday + granted))
      await kv.put(
        `sharestat:bonus:${code}`,
        String((await getCounter(kv, `sharestat:bonus:${code}`)) + granted),
      )
      return json({ ok: true, counted: true, granted }, 200, storageHeader)
    }
    return json({ ok: true, counted: true, granted: 0 }, 200, storageHeader)
  }

  // ----- 团队版预订 -----
  if (path === '/api/team/reserve' && method === 'POST') {
    const body = await readBody()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const teamSize = typeof body?.teamSize === 'string' ? body.teamSize.trim() : ''
    const note = typeof body?.note === 'string' ? body.note.trim() : ''
    if (!isValidEmail(email)) return json({ error: '邮箱格式不正确' }, 400, storageHeader)
    if (teamSize.length > 50 || note.length > 500) {
      return json({ error: '内容过长' }, 400, storageHeader)
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    await kv.put(
      `reserve:${id}`,
      JSON.stringify({ email, teamSize, note, createdAt: new Date().toISOString() }),
    )
    return json({ ok: true }, 200, storageHeader)
  }

  // ----- 公告（公开读取） -----
  if (path === '/api/announcement' && method === 'GET') {
    const raw = await kv.get('announcement')
    if (!raw) return json({ announcement: null }, 200, storageHeader)
    try {
      return json({ announcement: JSON.parse(raw) }, 200, storageHeader)
    } catch {
      return json({ announcement: null }, 200, storageHeader)
    }
  }

  // ----- 管理端 -----
  if (path.startsWith('/api/admin/')) {
    const email = await currentUserEmail(request, env)
    if (!email) return json({ error: '请先登录' }, 401, storageHeader)
    if (!isAdmin(email, env)) return json({ error: '无管理权限' }, 403, storageHeader)

    if (path === '/api/admin/health' && method === 'GET') {
      return json(
        {
          kvBound: persistent,
          mailConfigured: mailChannel(env) !== 'none',
          mailChannel: mailChannel(env),
          authSecretConfigured: Boolean(env && env.AUTH_SECRET),
        },
        200,
        storageHeader,
      )
    }

    if (path === '/api/admin/overview' && method === 'GET') {
      const users = []
      let cursor = ''
      for (let i = 0; i < 20; i++) {
        const page = await kv.list({ prefix: 'user:', limit: 256, cursor })
        for (const k of page.keys) {
          const raw = await kv.get(k.name)
          if (raw) {
            try {
              users.push(JSON.parse(raw))
            } catch {
              // 跳过损坏记录
            }
          }
        }
        if (page.complete || !page.cursor) break
        cursor = page.cursor
      }

      // 近 14 天注册增长
      const growth = []
      for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
        growth.push({
          date: d,
          count: users.filter((u) => (u.createdAt || '').slice(0, 10) === d).length,
        })
      }

      const date = today()
      let usageToday = 0
      let bonusToday = 0
      let activeTrialToday = 0
      for (const u of users) {
        const used = await getCounter(kv, `usage:${u.email}:${date}`)
        usageToday += used
        if (used > 0) activeTrialToday += 1
        bonusToday += await getCounter(kv, `bonus:${u.email}:${date}`)
      }

      const reservations = await kv.list({ prefix: 'reserve:', limit: 256 })
      const feedback = await kv.list({ prefix: 'fb:', limit: 256 })

      return json(
        {
          totalUsers: users.length,
          growth,
          templateSyncUsers: users.filter((u) => (u.templateCount || 0) > 0).length,
          templateTotal: users.reduce((s, u) => s + (u.templateCount || 0), 0),
          usageToday,
          trialUsers: users.length,
          activeTrialToday,
          shareBonusToday: bonusToday,
          reservationCount: reservations.keys.length,
          feedbackCount: feedback.keys.length,
          storage: persistent ? 'kv' : 'memory',
        },
        200,
        storageHeader,
      )
    }

    if (path === '/api/admin/users' && method === 'GET') {
      const cursor = url.searchParams.get('cursor') || ''
      const page = await kv.list({ prefix: 'user:', limit: 50, cursor })
      const users = []
      for (const k of page.keys) {
        const raw = await kv.get(k.name)
        if (raw) {
          try {
            users.push(JSON.parse(raw))
          } catch {
            // 跳过损坏记录
          }
        }
      }
      return json(
        { users, cursor: page.complete ? null : page.cursor },
        200,
        storageHeader,
      )
    }

    if (path === '/api/admin/feedback' && method === 'GET') {
      const page = await kv.list({ prefix: 'fb:', limit: 200 })
      const items = []
      for (const k of page.keys.slice(-100)) {
        const raw = await kv.get(k.name)
        if (raw) {
          try {
            items.push(JSON.parse(raw))
          } catch {
            // 跳过损坏记录
          }
        }
      }
      items.reverse()
      return json({ items }, 200, storageHeader)
    }

    if (path === '/api/admin/reservations' && method === 'GET') {
      const page = await kv.list({ prefix: 'reserve:', limit: 256 })
      const items = []
      for (const k of page.keys) {
        const raw = await kv.get(k.name)
        if (raw) {
          try {
            items.push(JSON.parse(raw))
          } catch {
            // 跳过损坏记录
          }
        }
      }
      items.reverse()
      return json({ items }, 200, storageHeader)
    }

    if (path === '/api/admin/announcement') {
      if (method === 'GET') {
        const raw = await kv.get('announcement')
        let announcement = null
        if (raw) {
          try {
            announcement = JSON.parse(raw)
          } catch {
            announcement = null
          }
        }
        return json({ announcement }, 200, storageHeader)
      }
      if (method === 'PUT') {
        const body = await readBody()
        const text = typeof body?.text === 'string' ? body.text.trim() : ''
        const enabled = Boolean(body?.enabled)
        if (text.length > 500) return json({ error: '公告内容过长' }, 400, storageHeader)
        const announcement = { text, enabled, updatedAt: new Date().toISOString() }
        await kv.put('announcement', JSON.stringify(announcement))
        return json({ ok: true, announcement }, 200, storageHeader)
      }
      return json({ error: '请求方法不支持' }, 405, storageHeader)
    }
  }

  return json({ error: '接口不存在' }, 404, storageHeader)
}
