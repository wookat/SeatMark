/**
 * API 响应安全头：EdgeOne 的 edgeone.json headers 规则不作用于
 * Edge Function 自建的 Response，需在函数侧统一补齐。
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
