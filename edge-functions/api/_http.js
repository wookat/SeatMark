/**
 * 边缘函数共用的 HTTP 小工具：JSON 响应、客户端 IP 提取、SHA-256 十六进制。
 * 供 [[default]].js / feedback.js / ai-design.js 复用。
 */

const encoder = new TextEncoder()

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  })
}

/**
 * 客户端 IP 头来源：EdgeOne 注入的 EO-Connecting-IP 优先，其次 X-Forwarded-For 首段。
 * 返回 'eo' | 'xff' | 'none'，只描述来源、不含 IP 值（供健康检查诊断）。
 */
export function clientIpSource(request) {
  if (request.headers.get('EO-Connecting-IP')) return 'eo'
  if (request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()) return 'xff'
  return 'none'
}

export function clientIp(request) {
  return (
    request.headers.get('EO-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
