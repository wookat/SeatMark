/**
 * SeatMark 账号体系 API（EdgeOne Pages Edge Function，catch-all 路由）
 *
 * 覆盖 /api/* 中未被具体文件（ai-design.js / feedback.js）命中的所有路径：
 *   POST /api/auth/code          发送邮箱验证码（限频）
 *   POST /api/auth/verify        校验验证码，签发 httpOnly JWT 会话
 *   POST /api/auth/register      邮箱+密码注册（已有验证码账号未设密码时可补设），签发会话
 *   POST /api/auth/login         邮箱+密码登录（连续失败限流），签发会话
 *   GET  /api/auth/captcha       表单验证码（图片字符+签名令牌），注册/登录/重置密码需携带
 *   POST /api/auth/reset-code    找回密码：向邮箱发送重置验证码（防枚举）
 *   POST /api/auth/reset-password 找回密码：验重置码+设新密码，成功即登录
 *   GET  /api/auth/me            当前登录用户（含配额/分享状态）
 *   POST /api/auth/logout        退出登录
 *   GET  /api/account/templates  拉取云端模板
 *   PUT  /api/account/templates  上传（覆盖）云端模板
 *   GET  /api/quota              当前配额状态（登录用户）
 *   POST /api/quota/consume      消耗一次无水印导出配额（登录用户，服务端计数）
 *   GET  /api/share/mine         我的分享码与裂变进度
 *   POST /api/share/visit        分享链接访问上报（IP+日去重，为分享者赠送次数）
 *   POST /api/share/tpl          模板短码寄存（微信扫码短链，内容寻址）
 *   GET  /api/share/tpl          按短码取回模板负载
 *   POST /api/redeem             兑换码开通会员（登录用户，IP 限频防枚举）
 *   POST /api/admin/codes        批量生成兑换码（管理员，供卡网售卖）
 *   GET  /api/admin/codes        兑换码批次列表与核销进度
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
 * - AUTH_SECRET      JWT 签名密钥（必配；未配置时回退开发默认值并在函数日志告警，
 *                    /api/admin/health 的 authSecretConfigured 为 false）
 * - ADMIN_EMAILS     管理员邮箱白名单，逗号分隔（未配置则管理端全部 403）
 * - TENCENT_SES_SECRET_ID    腾讯云 SES SecretId（配置后优先走腾讯云 SES 发送验证码）
 * - TENCENT_SES_SECRET_KEY   腾讯云 SES SecretKey
 * - TENCENT_SES_REGION       腾讯云 SES 地域（默认 ap-hongkong；SES API 服务地域）
 * - TENCENT_SES_TEMPLATE_ID  腾讯云 SES 模板 ID（可选；配置后用模板发送，变量 {code}/{ttl}）
 * - RESEND_API_KEY   Resend 邮件发送密钥（腾讯云未配置时的备用通道；都未配置时仅本地开发环境以 devCode 形式返回验证码）
 * - MAIL_FROM        发件地址（默认 SeatMark <noreply@seatmark.cn>）
 *
 * 存储三级后备（见 _storage.js）：
 * - KV 绑定（变量名 seatmark_kv）优先；
 * - 未绑定时降级 EdgeOne Pages Blob（@edgeone/pages-blob，自动创建、持久化、强一致读）；
 * - 两者皆不可用时降级进程内存（数据不持久，仅本地联调）。
 *   内存降级下涉及持久化写入的路由（验证码/注册/登录/配额扣减/兑换/分享计次/限流计数）
 *   一律 fail closed 返回 503 {error:'storage_unavailable'}，仅 SEATMARK_ALLOW_MEMORY_STORAGE=1
 *   （本地 dev 中间件 / Vitest）时放行；只读端点不受影响。
 * 云端模板（tpl:）体积大，Blob 可用时优先存 Blob，读取兼容 KV 存量数据。
 */

import { getStorage, probeBlob } from './_storage.js'
import { withSecurityHeaders } from './_security.js'
import { randomDigits, randomId, randomInt, randomToken } from './_random.js'

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
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 72
const PBKDF2_ITERATIONS = 100000
const LOGIN_FAIL_LIMIT = 10
const LOGIN_FAIL_WINDOW_MS = 15 * 60 * 1000
const REGISTER_IP_DAILY_LIMIT = 20
const CAPTCHA_TTL_SECONDS = 5 * 60
const TEMPLATES_MAX_BYTES = 512 * 1024

/** 存储降级 memory 时必须 fail closed 的持久化写入路由（path → 受限方法） */
const MEMORY_UNSAFE_ROUTES = {
  '/api/auth/code': ['POST'],
  '/api/auth/verify': ['POST'],
  '/api/auth/register': ['POST'],
  '/api/auth/login': ['POST'],
  '/api/auth/reset-code': ['POST'],
  '/api/auth/reset-password': ['POST'],
  '/api/account/delete': ['POST'],
  '/api/account/templates': ['PUT'],
  '/api/quota/consume': ['POST'],
  '/api/redeem': ['POST'],
  '/api/share/visit': ['POST'],
  '/api/share/tpl': ['POST'],
  '/api/team/reserve': ['POST'],
  '/api/admin/codes': ['POST'],
  '/api/admin/announcement': ['PUT'],
}

function isMemoryUnsafeRoute(path, method) {
  const methods = MEMORY_UNSAFE_ROUTES[path]
  return Boolean(methods && methods.includes(method))
}

// ---------- 会员与兑换码 ----------
const TRIAL_DAYS_REGISTER = 7
const INVITE_BONUS_DAYS = 7
const REDEEM_IP_DAILY_LIMIT = 20
const REDEEM_BATCH_MAX = 200
const REDEEM_DAYS_MAX = 3660
/** 兑换码字符集：去除易混淆字符 0/O/1/I/L */
const REDEEM_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

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

const DEV_AUTH_SECRET = 'seatmark-dev-secret-do-not-use-in-prod'

function getSecret(env) {
  return (env && env.AUTH_SECRET) || DEV_AUTH_SECRET
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

// ---------- 密码哈希（PBKDF2-SHA256，Web Crypto） ----------
async function pbkdf2Bits(password, saltBytes, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations },
    keyMaterial,
    256,
  )
  return new Uint8Array(bits)
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const derived = await pbkdf2Bits(password, salt, PBKDF2_ITERATIONS)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64url(salt)}$${b64url(derived)}`
}

async function verifyPassword(password, stored) {
  try {
    const [scheme, iterStr, saltB64, hashB64] = String(stored).split('$')
    if (scheme !== 'pbkdf2') return false
    const iterations = Number(iterStr)
    if (!Number.isFinite(iterations) || iterations < 1000) return false
    const salt = Uint8Array.from(b64urlDecode(saltB64), (c) => c.charCodeAt(0))
    const expected = Uint8Array.from(b64urlDecode(hashB64), (c) => c.charCodeAt(0))
    const derived = await pbkdf2Bits(password, salt, iterations)
    if (derived.length !== expected.length) return false
    let diff = 0
    for (let i = 0; i < derived.length; i++) diff |= derived[i] ^ expected[i]
    return diff === 0
  } catch {
    return false
  }
}

function isValidPassword(password) {
  return (
    typeof password === 'string' &&
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH
  )
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

async function quotaStatus(kv, email, user) {
  const date = today()
  const [used, bonus] = await Promise.all([
    getCounter(kv, `usage:${email}:${date}`),
    getCounter(kv, `bonus:${email}:${date}`),
  ])
  const resolved = user === undefined ? await getUser(kv, email) : user
  // 会员有效期内无水印导出不限次（用大额度表达，前端据 pro.active 展示「不限」）
  if (proStatus(resolved).active) {
    return { date, used, limit: 9999, bonus, remaining: 9999, pro: true }
  }
  const limit = QUOTA_USER_DAILY + Math.min(bonus, SHARE_BONUS_DAILY_CAP)
  return { date, used, limit, bonus, remaining: Math.max(0, limit - used) }
}

/** 会员到期时间顺延：未过期在尾部叠加，已过期从当前时刻起算 */
function grantProDays(user, days) {
  const base = Math.max(Date.now(), Date.parse(user.proUntil || '') || 0)
  user.proUntil = new Date(base + days * 86400000).toISOString()
}

function proStatus(user) {
  const until = Date.parse(user?.proUntil || '') || 0
  return { active: until > Date.now(), until: until ? new Date(until).toISOString() : null }
}

function randomRedeemCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  let s = ''
  for (let i = 0; i < 12; i++) {
    s += REDEEM_ALPHABET[bytes[i] % REDEEM_ALPHABET.length]
    if (i === 3 || i === 7) s += '-'
  }
  return `SM-${s}`
}

/** 兑换码存储键：只存哈希，服务端不保留可反推的明文码 */
async function redeemKey(code) {
  return `redeem:${await sha256Hex(`redeem-code:${code}`)}`
}

/** 掉尾展示：仅保留末 4 位便于人工对账 */
function maskRedeemCode(code) {
  return `SM-****-****-${code.slice(-4)}`
}

/** 读兑换码记录：优先哈希键，兼容历史明文键并迁移 */
async function getRedeemRecord(kv, code) {
  const key = await redeemKey(code)
  let raw = await kv.get(key)
  if (!raw) {
    const legacyKey = `redeem:${code}`
    raw = await kv.get(legacyKey)
    if (raw) {
      await kv.put(key, raw)
      await kv.delete(legacyKey).catch(() => {})
    }
  }
  if (!raw) return { key, record: null }
  try {
    return { key, record: JSON.parse(raw) }
  } catch {
    return { key, record: null }
  }
}

/** 归一化用户输入：容忍大小写/空格/丢失的连字符 */
function normalizeRedeemCode(input) {
  const raw = String(input || '').toUpperCase().replace(/[^0-9A-Z]/g, '')
  if (!/^SM[0-9A-Z]{12}$/.test(raw)) return null
  const body = raw.slice(2)
  return `SM-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`
}

async function shareCodeFor(kv, email, defer) {
  const existing = await kv.get(`share:owner:${email}`)
  if (existing) return existing
  const code = (await sha256Hex(`${email}:${Date.now()}`)).slice(0, 8)
  const write = () =>
    Promise.all([kv.put(`share:owner:${email}`, code), kv.put(`share:code:${code}`, email)])
  if (defer) defer(write)
  else await write()
  return code
}

async function shareStats(kv, email, defer) {
  const code = await shareCodeFor(kv, email, defer)
  const [totalVisits, totalBonus, bonusToday] = await Promise.all([
    getCounter(kv, `sharestat:visits:${code}`),
    getCounter(kv, `sharestat:bonus:${code}`),
    getCounter(kv, `bonus:${email}:${today()}`),
  ])
  return {
    code,
    totalVisits,
    totalBonus,
    bonusToday: Math.min(bonusToday, SHARE_BONUS_DAILY_CAP),
    bonusDailyCap: SHARE_BONUS_DAILY_CAP,
    bonusPerVisit: SHARE_BONUS_PER_VISIT,
  }
}

async function publicUser(kv, email, env, preloadedUser, defer) {
  const user = preloadedUser || (await getUser(kv, email))
  if (!user) return null
  const [quota, share] = await Promise.all([
    quotaStatus(kv, email, user),
    shareStats(kv, email, defer),
  ])
  return {
    email: user.email,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    loginCount: user.loginCount,
    templateCount: user.templateCount || 0,
    templateUpdatedAt: user.templateUpdatedAt || null,
    betaMember: true,
    pro: proStatus(user),
    isAdmin: isAdmin(email, env),
    quota,
    share,
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

/** 验证码邮件用途文案：login 登录 / reset 重置密码 */
function codeMailCopy(kind, code) {
  const label = kind === 'reset' ? '重置密码验证码' : '登录验证码'
  return {
    subject: `【SeatMark 座签】${label} ${code}`,
    text: `你的${label}是：${code}，10 分钟内有效。如非本人操作请忽略本邮件。`,
  }
}

async function sendCodeMailTencent(env, email, code, kind) {
  const { subject, text } = codeMailCopy(kind, code)
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
        'X-TC-Region': (env && env.TENCENT_SES_REGION) || 'ap-hongkong',
      },
      body: payload,
    })
    const data = await res.json().catch(() => null)
    const err = data?.Response?.Error
    if (!res.ok || err) {
      console.log(`[mail] SES SendEmail failed: http=${res.status} code=${err?.Code || ''} message=${err?.Message || ''}`)
      return { configured: true, delivered: false, errorCode: err?.Code || `HTTP_${res.status}` }
    }
    return { configured: true, delivered: true }
  } catch (e) {
    console.log(`[mail] SES SendEmail exception: ${e && e.message}`)
    return { configured: true, delivered: false, errorCode: 'FETCH_ERROR' }
  }
}

async function sendCodeMailResend(env, email, code, kind) {
  const { subject, text } = codeMailCopy(kind, code)
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
        subject,
        text,
      }),
    })
    return { configured: true, delivered: res.ok }
  } catch {
    return { configured: true, delivered: false }
  }
}

/** 发送优先级：腾讯云 SES → Resend → 未配置 */
async function sendCodeMail(env, email, code, kind = 'login') {
  const channel = mailChannel(env)
  if (channel === 'tencent-ses') return sendCodeMailTencent(env, email, code, kind)
  if (channel === 'resend') return sendCodeMailResend(env, email, code, kind)
  return { configured: false, delivered: false }
}

// ---------- 图形验证（图片字符，无状态签名令牌） ----------
/** 答案不区分大小写；字符集排除易混淆的 0/O/1/I/L 等 */
const CAPTCHA_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const CAPTCHA_LENGTH = 4

async function captchaAnswerHash(answer, secret) {
  return sha256Hex(`captcha:${String(answer).trim().toUpperCase()}:${secret}`)
}

/** 生成扭曲字符 SVG 验证码图片（边缘运行时无 canvas，用 SVG 绘制） */
function captchaSvg(code) {
  const width = 132
  const height = 44
  const rand = (min, max) => min + (randomInt(10000) / 10000) * (max - min)
  const palette = ['#334155', '#1d4ed8', '#0f766e', '#7c3aed', '#b45309']
  const pick = () => palette[randomInt(palette.length)]
  let parts = `<rect width="${width}" height="${height}" fill="#f8fafc"/>`
  for (let i = 0; i < 3; i++) {
    parts += `<path d="M0 ${rand(6, height - 6).toFixed(1)} Q ${(width / 2).toFixed(1)} ${rand(0, height).toFixed(1)}, ${width} ${rand(6, height - 6).toFixed(1)}" stroke="${pick()}" stroke-opacity="0.35" fill="none" stroke-width="1.2"/>`
  }
  for (let i = 0; i < 14; i++) {
    parts += `<circle cx="${rand(2, width - 2).toFixed(1)}" cy="${rand(2, height - 2).toFixed(1)}" r="${rand(0.6, 1.4).toFixed(1)}" fill="${pick()}" fill-opacity="0.4"/>`
  }
  const step = width / (code.length + 1)
  for (let i = 0; i < code.length; i++) {
    const x = step * (i + 1) + rand(-3, 3)
    const y = height / 2 + rand(-4, 4)
    const rotate = rand(-24, 24).toFixed(1)
    const size = rand(21, 26).toFixed(1)
    parts += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" transform="rotate(${rotate} ${x.toFixed(1)} ${y.toFixed(1)})" font-family="Georgia, 'Times New Roman', serif" font-size="${size}" font-weight="700" fill="${pick()}" text-anchor="middle" dominant-baseline="central">${code[i]}</text>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts}</svg>`
}

/** 验证表单验证码：令牌为服务端签名 JWT，无需存储；5 分钟内有效 */
async function verifyCaptcha(env, token, answer) {
  if (typeof token !== 'string' || answer === undefined || answer === null) return false
  const payload = await verifyJwt(token, getSecret(env))
  if (!payload || payload.typ !== 'captcha' || typeof payload.cap !== 'string') return false
  return payload.cap === (await captchaAnswerHash(answer, getSecret(env)))
}

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

/** 是否本地开发环境：仅此时允许在邮件未配置的情况下把 devCode 返回给前端 */
function isLocalDev(url, env) {
  return LOCAL_HOSTNAMES.has(url.hostname) || Boolean(env && env.DEV)
}

/**
 * 存储操作防御重试：Blob 后备链首次调用可能因实例初始化抖动而失败，
 * 短暂等待后重试一次；仍失败则抛出交由调用方降级，避免整个函数 545。
 */
async function kvOpWithRetry(label, op) {
  try {
    return await op()
  } catch (err) {
    console.error(`[seatmark-api] ${label} 首次失败，120ms 后重试:`, err)
    await new Promise((resolve) => setTimeout(resolve, 120))
    return op()
  }
}

// ---------- 路由处理 ----------
/** 顶层兜底：任何未捕获异常都返回结构化 JSON 500，而不是让边缘实例 545 */
export async function onRequest(context) {
  try {
    return withSecurityHeaders(await handleRequest(context))
  } catch (err) {
    console.error(
      '[seatmark-api] 未捕获异常:',
      context?.request?.method,
      context?.request?.url,
      err,
    )
    return withSecurityHeaders(json({ error: '服务暂时不可用，请稍后重试' }, 500))
  }
}

async function handleRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const method = request.method

  if (method === 'OPTIONS') return new Response(null, { status: 204 })

  const { kv, storage, blobStore } = await getStorage(env)
  // Rev 标记仅用于部署观测：探针可确认线上边缘函数版本，改动本文件时递增
  const storageHeader = { 'X-SeatMark-Storage': storage, 'X-SeatMark-Rev': 'r356' }

  if (storage !== 'memory' && !(env && env.AUTH_SECRET)) {
    console.error('[seatmark-api] AUTH_SECRET 未配置，正在使用开发默认密钥签发会话')
  }

  // 内存降级跨 isolate 不一致且不持久：验证码、配额、兑换、限流等写入会静默丢失，
  // 生产必须 fail closed；仅显式放行（本地 dev / 测试）时允许
  if (
    storage === 'memory' &&
    !(env && env.SEATMARK_ALLOW_MEMORY_STORAGE === '1') &&
    isMemoryUnsafeRoute(path, method)
  ) {
    console.error(
      '[seatmark-api] 存储降级 memory 且未放行，拒绝持久化写入:',
      method,
      path,
    )
    return json({ error: 'storage_unavailable' }, 503, storageHeader)
  }

  /**
   * 非关键写入移出响应关键路径：平台支持 waitUntil 时响应先行、写入后台完成
   * （生产实测 Blob 写入会间歇性干扰响应收尾导致网关 545）；不支持时回退同步等待。
   * 同一请求的多个后台写串成单链依次执行：并发的后台写同样会干扰收尾。
   */
  let writeChain = null
  const deferWrite = (start) => {
    const run = () =>
      start().catch((err) => {
        console.error('[seatmark-api] 后台写入失败:', err)
      })
    if (typeof context.waitUntil === 'function') {
      // 延迟启动：避免写入与响应回传同时在飞（实测在飞写入同样会干扰收尾导致 545）
      writeChain = writeChain
        ? writeChain.then(run)
        : new Promise((resolve) => setTimeout(resolve, 150)).then(run)
      context.waitUntil(writeChain)
      return
    }
    return run()
  }

  /** 云端模板体积大：Blob 可用时优先 Blob，读取保留 KV 存量兜底 */
  const templateStore = {
    async get(email) {
      if (blobStore) {
        try {
          const fromBlob = await blobStore.get(`tpl:${email}`, { consistency: 'strong' })
          if (fromBlob !== null) return fromBlob
        } catch {
          // Blob 读失败回退 KV
        }
      }
      return kv.get(`tpl:${email}`)
    },
    async put(email, serialized) {
      if (blobStore) {
        try {
          await blobStore.set(`tpl:${email}`, serialized)
          return
        } catch {
          // Blob 写失败回退 KV
        }
      }
      await kv.put(`tpl:${email}`, serialized)
    },
    async delete(email) {
      if (blobStore) {
        try {
          await blobStore.delete(`tpl:${email}`)
        } catch {
          // 删除失败不阻塞
        }
      }
      await kv.delete(`tpl:${email}`)
    },
  }

  async function readBody() {
    try {
      return await request.json()
    } catch {
      return null
    }
  }

  // ----- 认证 -----
  // 表单验证码：图片字符 + 签名令牌（无存储，5 分钟有效），注册/登录/重置密码均需携带
  if (path === '/api/auth/captcha' && method === 'GET') {
    const code = randomToken(CAPTCHA_LENGTH, CAPTCHA_CHARSET)
    const token = await signJwt(
      {
        typ: 'captcha',
        cap: await captchaAnswerHash(code, getSecret(env)),
        exp: Math.floor(Date.now() / 1000) + CAPTCHA_TTL_SECONDS,
      },
      getSecret(env),
    )
    const svgBytes = new TextEncoder().encode(captchaSvg(code))
    const image = `data:image/svg+xml;base64,${btoa(String.fromCharCode(...svgBytes))}`
    return json({ image, token }, 200, storageHeader)
  }

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

    const code = randomDigits(6)
    await kv.put(
      codeKey,
      JSON.stringify({ code, sentAt: Date.now(), exp: Date.now() + CODE_TTL_MS, attempts: 0 }),
    )
    await kv.put(ipKey, String(ipCount + 1))

    const { configured, delivered, errorCode } = await sendCodeMail(env, email, code)
    if (delivered) return json({ ok: true, delivery: 'email' }, 200, storageHeader)
    if (!configured) {
      // 邮件服务未配置：仅本地开发环境把 devCode 回显给前端供联调，线上一律报错
      if (isLocalDev(url, env)) {
        return json({ ok: true, delivery: 'stub', devCode: code }, 200, storageHeader)
      }
      return json({ error: '邮件服务未配置，请联系管理员' }, 503, storageHeader)
    }
    // 错误码只标识邮件服务商返回的错误类别（不含用户数据），便于管理员在不看函数日志的情况下定位配置问题
    return json({ error: '验证码发送失败，请稍后再试' }, 502, {
      ...storageHeader,
      ...(errorCode ? { 'X-SeatMark-Mail-Error': String(errorCode).slice(0, 64) } : {}),
    })
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
    // 会话签发成功后才消费验证码：中途实例异常时码仍有效，用户重试同一码即可
    await deferWrite(() => kv.delete(codeKey))
    return json(
      { ok: true, user: await publicUser(kv, email, env, user, deferWrite) },
      200,
      { ...storageHeader, 'Set-Cookie': sessionCookie(token) },
    )
  }

  if (path === '/api/auth/register' && method === 'POST') {
    const body = await readBody()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!isValidEmail(email)) return json({ error: '邮箱格式不正确' }, 400, storageHeader)
    if (!isValidPassword(password)) {
      return json(
        { error: `密码长度需在 ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} 位之间` },
        400,
        storageHeader,
      )
    }
    if (!(await verifyCaptcha(env, body?.captchaToken, body?.captchaAnswer))) {
      return json({ error: '验证码不正确或已过期，请重试', captcha: true }, 400, storageHeader)
    }

    const ip = clientIp(request)
    const regKey = `rl:reg:${await sha256Hex(ip)}:${today()}`
    const regCount = await getCounter(kv, regKey)
    if (regCount >= REGISTER_IP_DAILY_LIMIT) {
      return json({ error: '请求过于频繁，请明天再试' }, 429, storageHeader)
    }
    await deferWrite(() => kv.put(regKey, String(regCount + 1)))

    let user = await getUser(kv, email)
    if (user && user.passwordHash) {
      return json({ error: '该邮箱已注册，请直接登录' }, 409, storageHeader)
    }
    const now = new Date().toISOString()
    const isNewAccount = !user
    if (!user) {
      user = { email, createdAt: now, lastLoginAt: now, loginCount: 1, templateCount: 0 }
      // 新注册赠 7 天专业版试用（仅首次建账，历史验证码账号补设密码不重复赠送）
      grantProDays(user, TRIAL_DAYS_REGISTER)
    } else {
      // 历史验证码账号未设密码：首次注册即补设密码
      user.lastLoginAt = now
      user.loginCount = (user.loginCount || 0) + 1
    }

    // 邀请裂变：新用户携带邀请码（分享码）注册，双方各赠 7 天专业版，邀请方可叠加
    const inviteCode =
      typeof body?.inviteCode === 'string' && /^[0-9a-f]{8}$/.test(body.inviteCode.trim())
        ? body.inviteCode.trim()
        : ''
    if (isNewAccount && inviteCode) {
      const inviter = await kv.get(`share:code:${inviteCode}`)
      if (inviter && inviter !== email) {
        grantProDays(user, INVITE_BONUS_DAYS)
        user.invitedBy = inviter
        deferWrite(async () => {
          const inviterUser = await getUser(kv, inviter)
          if (!inviterUser) return
          grantProDays(inviterUser, INVITE_BONUS_DAYS)
          inviterUser.inviteCount = (inviterUser.inviteCount || 0) + 1
          await putUser(kv, inviterUser)
        })
      }
    }

    user.passwordHash = await hashPassword(password)
    user.passwordSetAt = now
    await putUser(kv, user)

    const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
    const token = await signJwt({ sub: email, exp }, getSecret(env))
    return json(
      { ok: true, user: await publicUser(kv, email, env, user, deferWrite) },
      200,
      { ...storageHeader, 'Set-Cookie': sessionCookie(token) },
    )
  }

  if (path === '/api/auth/login' && method === 'POST') {
    const body = await readBody()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!isValidEmail(email) || typeof password !== 'string' || !password) {
      return json({ error: '邮箱或密码格式不正确' }, 400, storageHeader)
    }
    if (!(await verifyCaptcha(env, body?.captchaToken, body?.captchaAnswer))) {
      return json({ error: '验证码不正确或已过期，请重试', captcha: true }, 400, storageHeader)
    }

    // 连续失败限流（按邮箱，15 分钟窗口）
    const failKey = `pwfail:${email}`
    let fails = { count: 0, firstAt: Date.now() }
    const failsRaw = await kv.get(failKey)
    if (failsRaw) {
      try {
        const parsed = JSON.parse(failsRaw)
        if (Date.now() - parsed.firstAt < LOGIN_FAIL_WINDOW_MS) fails = parsed
      } catch {
        // 损坏记录直接重置
      }
    }
    if (fails.count >= LOGIN_FAIL_LIMIT) {
      return json({ error: '失败次数过多，请 15 分钟后再试' }, 429, storageHeader)
    }

    const user = await getUser(kv, email)
    if (!user || !user.passwordHash) {
      return json(
        { error: user ? '该账号尚未设置密码，请先注册设置' : '邮箱或密码不正确' },
        user ? 409 : 401,
        storageHeader,
      )
    }
    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) {
      fails.count += 1
      await deferWrite(() => kv.put(failKey, JSON.stringify(fails)))
      return json({ error: '邮箱或密码不正确' }, 401, storageHeader)
    }
    const now = new Date().toISOString()
    user.lastLoginAt = now
    user.loginCount = (user.loginCount || 0) + 1
    // 登录统计更新与限流计数清零都非关键：后台完成，响应不等 Blob 写回；无失败记录时不白写
    if (failsRaw) await deferWrite(() => kv.delete(failKey))
    await deferWrite(() => putUser(kv, user))

    const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
    const token = await signJwt({ sub: email, exp }, getSecret(env))
    return json(
      { ok: true, user: await publicUser(kv, email, env, user, deferWrite) },
      200,
      { ...storageHeader, 'Set-Cookie': sessionCookie(token) },
    )
  }

  // 找回密码第一步：向邮箱发送重置验证码（防枚举：未注册邮箱同样返回 ok，只是不发信）
  if (path === '/api/auth/reset-code' && method === 'POST') {
    const body = await readBody()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!isValidEmail(email)) return json({ error: '邮箱格式不正确' }, 400, storageHeader)
    if (!(await verifyCaptcha(env, body?.captchaToken, body?.captchaAnswer))) {
      return json({ error: '验证码不正确或已过期，请重试', captcha: true }, 400, storageHeader)
    }

    const ip = clientIp(request)
    const ipKey = `rl:ip:${await sha256Hex(ip)}:${today()}`
    const ipCount = await getCounter(kv, ipKey)
    if (ipCount >= CODE_IP_DAILY_LIMIT) {
      return json({ error: '请求过于频繁，请明天再试' }, 429, storageHeader)
    }

    const resetKey = `reset:${email}`
    const existingRaw = await kv.get(resetKey)
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

    await kv.put(ipKey, String(ipCount + 1))

    const user = await getUser(kv, email)
    if (!user || !user.passwordHash) {
      // 防邮箱枚举：不透露该邮箱是否已注册，直接返回成功但不发信
      return json({ ok: true, delivery: 'email' }, 200, storageHeader)
    }

    const code = randomDigits(6)
    await kv.put(
      resetKey,
      JSON.stringify({ code, sentAt: Date.now(), exp: Date.now() + CODE_TTL_MS, attempts: 0 }),
    )

    const { configured, delivered, errorCode } = await sendCodeMail(env, email, code, 'reset')
    if (delivered) return json({ ok: true, delivery: 'email' }, 200, storageHeader)
    if (!configured) {
      if (isLocalDev(url, env)) {
        return json({ ok: true, delivery: 'stub', devCode: code }, 200, storageHeader)
      }
      return json({ error: '邮件服务未配置，请联系管理员' }, 503, storageHeader)
    }
    return json({ error: '验证码发送失败，请稍后再试' }, 502, {
      ...storageHeader,
      ...(errorCode ? { 'X-SeatMark-Mail-Error': String(errorCode).slice(0, 64) } : {}),
    })
  }

  // 找回密码第二步：验重置码 + 设新密码，成功后直接登录
  if (path === '/api/auth/reset-password' && method === 'POST') {
    const body = await readBody()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const code = typeof body?.code === 'string' ? body.code.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
      return json({ error: '邮箱或验证码格式不正确' }, 400, storageHeader)
    }
    if (!isValidPassword(password)) {
      return json(
        { error: `密码长度需在 ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} 位之间` },
        400,
        storageHeader,
      )
    }

    const resetKey = `reset:${email}`
    const raw = await kv.get(resetKey)
    if (!raw) return json({ error: '验证码已过期，请重新获取' }, 400, storageHeader)
    let record
    try {
      record = JSON.parse(raw)
    } catch {
      return json({ error: '验证码已过期，请重新获取' }, 400, storageHeader)
    }
    if (record.exp < Date.now()) {
      await kv.delete(resetKey)
      return json({ error: '验证码已过期，请重新获取' }, 400, storageHeader)
    }
    if (record.attempts >= CODE_MAX_ATTEMPTS) {
      await kv.delete(resetKey)
      return json({ error: '尝试次数过多，请重新获取验证码' }, 429, storageHeader)
    }
    if (record.code !== code) {
      record.attempts += 1
      await kv.put(resetKey, JSON.stringify(record))
      return json({ error: '验证码不正确' }, 400, storageHeader)
    }

    const user = await getUser(kv, email)
    if (!user) {
      await kv.delete(resetKey)
      return json({ error: '该邮箱尚未注册' }, 404, storageHeader)
    }
    const now = new Date().toISOString()
    user.passwordHash = await hashPassword(password)
    user.passwordSetAt = now
    user.lastLoginAt = now
    user.loginCount = (user.loginCount || 0) + 1
    await putUser(kv, user)
    // 重置成功后后台清理：重置码作废 + 登录失败计数归零
    await deferWrite(() => kv.delete(resetKey))
    await deferWrite(() => kv.delete(`pwfail:${email}`))

    const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
    const token = await signJwt({ sub: email, exp }, getSecret(env))
    return json(
      { ok: true, user: await publicUser(kv, email, env, user, deferWrite) },
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
    await templateStore.delete(email)
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
      const raw = await templateStore.get(email)
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
      await templateStore.put(email, serialized)
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

  // ----- 兑换码 -----
  if (path === '/api/redeem' && method === 'POST') {
    const email = await currentUserEmail(request, env)
    if (!email) return json({ error: '请先登录' }, 401, storageHeader)

    // IP 日限频：防暴力枚举兑换码
    const ip = clientIp(request)
    const rlKey = `rl:redeem:${await sha256Hex(ip)}:${today()}`
    const attempts = await getCounter(kv, rlKey)
    if (attempts >= REDEEM_IP_DAILY_LIMIT) {
      return json({ error: '尝试次数过多，请明天再试' }, 429, storageHeader)
    }

    const body = await readBody()
    const code = normalizeRedeemCode(body?.code)
    if (!code) {
      await deferWrite(() => kv.put(rlKey, String(attempts + 1)))
      return json({ error: '兑换码格式不正确' }, 400, storageHeader)
    }

    const { key: recordKey, record } = await getRedeemRecord(kv, code)
    if (!record) {
      await deferWrite(() => kv.put(rlKey, String(attempts + 1)))
      return json({ error: '兑换码无效' }, 400, storageHeader)
    }
    const user = await getUser(kv, email)
    if (!user) return json({ error: '请先登录' }, 401, storageHeader)
    if (record.usedBy) {
      // 幂等：同一用户重试已兑换成功的码（如 5xx 后重试）直接返回当前会员状态
      if (record.usedBy === email) {
        return json({ ok: true, already: true, pro: proStatus(user) }, 200, storageHeader)
      }
      return json({ error: '兑换码已被使用' }, 409, storageHeader)
    }

    // 两段式核销（KV 无条件写）：先写入认领声明，延迟回读确认声明仍归本人后才发放，
    // 将并发双发窗口收窄到写-写重叠的毫秒级；核销与发放均同步落库
    record.usedBy = email
    record.usedAt = new Date().toISOString()
    await kv.put(recordKey, JSON.stringify(record))
    await new Promise((resolve) => setTimeout(resolve, 60))
    const confirmRaw = await kv.get(recordKey)
    let confirmed = null
    try {
      confirmed = confirmRaw ? JSON.parse(confirmRaw) : null
    } catch {
      confirmed = null
    }
    if (!confirmed || confirmed.usedBy !== email) {
      return json({ error: '兑换码已被使用' }, 409, storageHeader)
    }
    grantProDays(user, record.days)
    await putUser(kv, user)
    return json({ ok: true, days: record.days, pro: proStatus(user) }, 200, storageHeader)
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

  // ----- 模板短码分享（微信扫码用短 URL，KV 只存模板设计负载，不含任何名单数据） -----
  if (path === '/api/share/tpl' && method === 'POST') {
    const body = await readBody()
    const payload = typeof body?.payload === 'string' ? body.payload.trim() : ''
    if (!/^v[01]\.[A-Za-z0-9_-]{1,20000}$/.test(payload)) {
      return json({ error: '模板负载无效' }, 400, storageHeader)
    }
    // 内容寻址短码：同一模板重复分享得到同一短码，天然去重
    const code = (await sha256Hex(payload)).slice(0, 10)
    try {
      await kvOpWithRetry('tplshare 写入', () => kv.put(`tplshare:${code}`, payload))
    } catch (err) {
      console.error('[seatmark-api] tplshare 写入重试后仍失败:', err)
      return json({ error: '分享服务暂时不可用，请稍后重试' }, 503, storageHeader)
    }
    return json({ ok: true, code }, 200, storageHeader)
  }

  if (path === '/api/share/tpl' && method === 'GET') {
    const code = (url.searchParams.get('code') || '').trim()
    if (!/^[0-9a-f]{10}$/.test(code)) return json({ error: '短码无效' }, 400, storageHeader)
    let payload
    try {
      payload = await kvOpWithRetry('tplshare 读取', () => kv.get(`tplshare:${code}`))
    } catch (err) {
      console.error('[seatmark-api] tplshare 读取重试后仍失败:', err)
      return json({ error: '分享服务暂时不可用，请稍后重试' }, 503, storageHeader)
    }
    if (!payload) return json({ error: '短码不存在或已过期' }, 404, storageHeader)
    return json({ ok: true, payload }, 200, storageHeader)
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
    const id = randomId()
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
          kvBound: storage === 'kv',
          blobAvailable: await probeBlob(blobStore),
          storage,
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
          storage,
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
            const u = JSON.parse(raw)
            // 白名单字段：绝不下发 passwordHash 等凭据材料
            users.push({
              email: u.email,
              createdAt: u.createdAt,
              lastLoginAt: u.lastLoginAt,
              loginCount: u.loginCount,
              templateCount: u.templateCount,
              proUntil: u.proUntil,
              inviteCount: u.inviteCount,
              invitedBy: u.invitedBy,
            })
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

    // 兑换码批量生成（供卡网售卖）：明文仅在本次响应返回一次，服务端只存哈希与末 4 位掩码
    if (path === '/api/admin/codes' && method === 'POST') {
      const body = await readBody()
      const days = Number(body?.days)
      const count = Number(body?.count)
      const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 100) : ''
      if (!Number.isInteger(days) || days < 1 || days > REDEEM_DAYS_MAX) {
        return json({ error: `天数需为 1–${REDEEM_DAYS_MAX} 的整数` }, 400, storageHeader)
      }
      if (!Number.isInteger(count) || count < 1 || count > REDEEM_BATCH_MAX) {
        return json({ error: `数量需为 1–${REDEEM_BATCH_MAX} 的整数` }, 400, storageHeader)
      }
      const batch = randomId()
      const createdAt = new Date().toISOString()
      const codes = []
      const hashes = []
      const masked = []
      for (let i = 0; i < count; i++) {
        let code = randomRedeemCode()
        let key = await redeemKey(code)
        // 碰撞防御：已存在则重新生成（码空间 31^12，碰撞概率极低）
        while (await kv.get(key)) {
          code = randomRedeemCode()
          key = await redeemKey(code)
        }
        await kv.put(key, JSON.stringify({ days, batch, createdAt, note }))
        codes.push(code)
        hashes.push(key.slice('redeem:'.length))
        masked.push(maskRedeemCode(code))
      }
      await kv.put(
        `redeembatch:${batch}`,
        JSON.stringify({ batch, days, count, note, createdAt, hashes, masked }),
      )
      return json({ ok: true, batch, days, count, codes }, 200, storageHeader)
    }

    if (path === '/api/admin/codes' && method === 'GET') {
      const page = await kv.list({ prefix: 'redeembatch:', limit: 100 })
      const batches = []
      for (const k of page.keys) {
        const raw = await kv.get(k.name)
        if (!raw) continue
        try {
          const b = JSON.parse(raw)
          // 新批次存哈希；历史批次兼容明文 codes（同时兼容已被兑换迁移到哈希键的记录）
          const keys = Array.isArray(b.hashes)
            ? b.hashes.map((h) => `redeem:${h}`)
            : await Promise.all((b.codes || []).map((code) => redeemKey(code)))
          let used = 0
          for (let i = 0; i < keys.length; i++) {
            let rec = await kv.get(keys[i])
            if (!rec && Array.isArray(b.codes)) rec = await kv.get(`redeem:${b.codes[i]}`)
            if (rec) {
              try {
                if (JSON.parse(rec).usedBy) used += 1
              } catch {
                // 损坏记录计未使用
              }
            }
          }
          const { codes: legacyCodes, hashes: _hashes, ...rest } = b
          batches.push({
            ...rest,
            masked: Array.isArray(b.masked)
              ? b.masked
              : (legacyCodes || []).map((c) => maskRedeemCode(c)),
            legacyCodes: Array.isArray(legacyCodes) ? legacyCodes : undefined,
            used,
          })
        } catch {
          // 跳过损坏记录
        }
      }
      batches.reverse()
      return json({ batches }, 200, storageHeader)
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
