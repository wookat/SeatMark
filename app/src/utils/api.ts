/**
 * 账号体系 API 客户端：同源 /api/*，会话通过 httpOnly cookie 维持。
 * 标签内容数据（名单/照片/排版）永不经过这些接口，仅账号资料与模板结构上云。
 */

export class ApiError extends Error {
  status: number
  data: Record<string, unknown>

  constructor(status: number, message: string, data: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.data = data
  }
}

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: options.method ?? 'GET',
    credentials: 'same-origin',
    headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  let data: Record<string, unknown> = {}
  try {
    data = (await res.json()) as Record<string, unknown>
  } catch {
    // 非 JSON 响应按空对象处理
  }
  if (!res.ok) {
    const message = typeof data.error === 'string' ? data.error : `请求失败（${res.status}）`
    throw new ApiError(res.status, message, data)
  }
  return data as T
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_RE.test(email)
}
