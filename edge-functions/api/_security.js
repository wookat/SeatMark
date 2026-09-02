/**
 * API 响应安全头：EdgeOne 的 edgeone.json headers 规则不作用于
 * Edge Function 自建的 Response，需在函数侧统一补齐。
 *
 * 同时收纳各函数共用的安全基础件：
 * - 开发环境判定（SEATMARK_DEV / localhost），决定是否允许 dev 默认密钥与内存存储
 * - CSPRNG 随机数（randomInt / randomDigits），验证码等安全用途禁止 Math.random
 */
const API_SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "frame-ancestors 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}

export function withSecurityHeaders(res) {
  for (const key of Object.keys(API_SECURITY_HEADERS)) {
    res.headers.set(key, API_SECURITY_HEADERS[key])
  }
  return res
}

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

/**
 * 是否开发环境：env.SEATMARK_DEV === '1'（或历史 DEV 变量）或请求 host 为本机。
 * 仅开发环境允许：邮件未配置时回显 devCode、AUTH_SECRET 缺失时用 dev 默认值、
 * 存储缺失时降级进程内存。
 */
export function isDevEnvironment(env, hostname) {
  if (env && (env.SEATMARK_DEV === '1' || Boolean(env.DEV))) return true
  return typeof hostname === 'string' && LOCAL_HOSTNAMES.has(hostname)
}

/**
 * [0, maxExclusive) 区间内均匀分布的安全随机整数。
 * 拒绝采样：丢弃落在 2^32 - (2^32 mod max) 之外的样本，避免取模偏差。
 */
export function randomInt(maxExclusive) {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 0x100000000) {
    throw new RangeError(`randomInt: maxExclusive 需为 1–2^32 的整数，收到 ${maxExclusive}`)
  }
  if (maxExclusive === 1) return 0
  const limit = 0x100000000 - (0x100000000 % maxExclusive)
  const buf = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buf)
    if (buf[0] < limit) return buf[0] % maxExclusive
  }
}

/** n 位纯数字字符串（可含前导 0），用于邮箱验证码等 */
export function randomDigits(n) {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError(`randomDigits: n 需为正整数，收到 ${n}`)
  }
  let s = ''
  for (let i = 0; i < n; i++) s += String(randomInt(10))
  return s
}
