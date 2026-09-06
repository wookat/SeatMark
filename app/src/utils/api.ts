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

/** 单次请求超时：边缘实例无响应时不让按钮永远停在加载态 */
export const API_TIMEOUT_MS = 15_000
export const API_TIMEOUT_STATUS = 408
export const API_TIMEOUT_MESSAGE = '请求超时，请重试'

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new ApiError(API_TIMEOUT_STATUS, API_TIMEOUT_MESSAGE))
    }, API_TIMEOUT_MS)
  })
  let res: Response
  try {
    res = await Promise.race([
      fetch(path, {
        method: options.method ?? 'GET',
        credentials: 'same-origin',
        headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      }),
      timeout,
    ])
  } catch (err) {
    if (controller.signal.aborted) throw new ApiError(API_TIMEOUT_STATUS, API_TIMEOUT_MESSAGE)
    throw err
  } finally {
    clearTimeout(timer)
  }
  let data: Record<string, unknown> = {}
  try {
    data = (await res.json()) as Record<string, unknown>
  } catch {
    // 非 JSON 响应按空对象处理
  }
  if (!res.ok) {
    // 网关级错误（如边缘实例 5xx）返回非 JSON，给用户可理解的重试提示而非裸状态码
    const fallback =
      res.status >= 500 ? '服务暂时不可用，请重试' : `请求失败（${res.status}）`
    const message = typeof data.error === 'string' ? data.error : fallback
    throw new ApiError(res.status, message, data)
  }
  return data as T
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_RE.test(email)
}
