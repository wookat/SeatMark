/**
 * 会话校验共享模块：与 [[default]].js 内的会话实现同算法（HS256 JWT + 注销墓碑），
 * 供独立边缘函数（ai-design.js 等）校验 sm_session 登录态。
 * 自包含实现，不依赖 [[default]].js 的内部函数；如需修改会话算法必须两处同步。
 */

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
  if (typeof secret !== 'string' || !secret) throw new Error('jwt secret missing')
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export async function verifySessionJwt(token, secret) {
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

/** 测试/管理端签发会话 token（与 signSessionToken 同构） */
export async function signSessionJwt(payload, secret) {
  const header = b64url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = b64url(encoder.encode(JSON.stringify(payload)))
  const key = await hmacKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${body}`))
  return `${header}.${body}.${b64url(sig)}`
}

export function parseSessionCookie(request) {
  const raw = request.headers.get('Cookie') || ''
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=')
    if (idx > 0 && part.slice(0, idx).trim() === 'sm_session') {
      return part.slice(idx + 1).trim()
    }
  }
  return null
}

export function revokedSessionKey(email) {
  return `sm:revoked:${email}`
}

/**
 * 解析会话：签名/有效期/注销墓碑三层校验。
 * 返回 { email, revoked }；匿名或无效令牌为 { email: null, revoked: false }。
 */
export async function resolveSession(request, secret, kv) {
  const token = parseSessionCookie(request)
  if (!token) return { email: null, revoked: false }
  const payload = await verifySessionJwt(token, secret)
  if (!payload || typeof payload.sub !== 'string') return { email: null, revoked: false }
  const tombstone = await kv.get(revokedSessionKey(payload.sub))
  if (tombstone !== null && tombstone !== undefined) {
    const deletedAt = Number(tombstone)
    const issuedAt = typeof payload.iat === 'number' ? payload.iat * 1000 : 0
    if (!Number.isFinite(deletedAt) || issuedAt <= deletedAt) return { email: null, revoked: true }
  }
  return { email: payload.sub, revoked: false }
}
