import type { Breadcrumb, Event as SentryEvent, EventHint } from '@sentry/vue'
import type { App } from 'vue'
import type { Router } from 'vue-router'

import { telemetryPath } from '@/router'

/**
 * Sentry 懒初始化：主包只带本文件（类型导入不进产物），@sentry/vue 在 app.mount 后
 * 动态 import；初始化前的 window error / unhandledrejection 先入临时队列，init 后回放。
 */

export const SENTRY_DSN =
  'https://e07e934a609b9b8aab670cf18d669e42@o4511621503451136.ingest.us.sentry.io/4511621514592256'

type SentryModule = typeof import('@sentry/vue')
type SentryInitOptions = NonNullable<Parameters<SentryModule['init']>[0]>

export interface PendingError {
  kind: 'onerror' | 'onunhandledrejection'
  error: unknown
}

export interface PreInitErrorQueue {
  /** 取出并清空已缓存的错误（只保留最早的 max 条，防止错误风暴撑爆内存） */
  drain(): PendingError[]
  /** 解绑监听；init 成功后由 Sentry 自身的全局处理器接管 */
  dispose(): void
}

export function createPreInitErrorQueue(target: Window, max = 20): PreInitErrorQueue {
  const pending: PendingError[] = []
  const onError = (ev: ErrorEvent) => {
    if (pending.length >= max) return
    pending.push({ kind: 'onerror', error: ev.error ?? ev.message })
  }
  const onRejection = (ev: PromiseRejectionEvent) => {
    if (pending.length >= max) return
    pending.push({ kind: 'onunhandledrejection', error: ev.reason })
  }
  target.addEventListener('error', onError)
  target.addEventListener('unhandledrejection', onRejection)
  return {
    drain() {
      return pending.splice(0, pending.length)
    },
    dispose() {
      target.removeEventListener('error', onError)
      target.removeEventListener('unhandledrejection', onRejection)
    },
  }
}

/** 形如「路径?查询」的字符串才清洗，避免把异常消息里的普通文本误改 */
function scrubIfPath(value: unknown): unknown {
  if (typeof value !== 'string' || !value.includes('?')) return value
  return telemetryPath(value)
}

export function scrubBreadcrumb<T extends Breadcrumb>(breadcrumb: T): T {
  const data = breadcrumb.data
  if (data) {
    for (const key of ['from', 'to', 'url'] as const) {
      if (typeof data[key] === 'string') {
        data[key] = telemetryPath(data[key])
      }
    }
  }
  return breadcrumb
}

/**
 * 错误事件与性能事务共用的清洗：request.url、transaction、tags、
 * exception 栈帧 URL、事件内 breadcrumb URL、span 描述统一剥离 ?q= 等用户输入参数。
 * 只改字段值，不改事件结构。
 */
export function scrubEvent<T extends SentryEvent>(event: T): T {
  if (event.request?.url) {
    event.request.url = telemetryPath(event.request.url)
  }
  if (event.transaction) {
    event.transaction = telemetryPath(event.transaction)
  }
  if (event.tags) {
    for (const key of Object.keys(event.tags)) {
      event.tags[key] = scrubIfPath(event.tags[key]) as typeof event.tags[string]
    }
  }
  for (const exception of event.exception?.values ?? []) {
    for (const frame of exception.stacktrace?.frames ?? []) {
      if (frame.filename) frame.filename = telemetryPath(frame.filename)
      if (frame.abs_path) frame.abs_path = telemetryPath(frame.abs_path)
    }
  }
  for (const breadcrumb of event.breadcrumbs ?? []) {
    scrubBreadcrumb(breadcrumb)
  }
  for (const span of event.spans ?? []) {
    if (span.description) {
      span.description = telemetryPath(span.description)
    }
  }
  return event
}

export function buildSentryOptions(
  sentry: Pick<SentryModule, 'browserTracingIntegration'>,
  app: App,
  router: Router,
): SentryInitOptions {
  return {
    app,
    dsn: SENTRY_DSN,
    integrations: [sentry.browserTracingIntegration({ router })],
    tracesSampleRate: 0.2,
    beforeSend(event) {
      return scrubEvent(event)
    },
    // 性能事务的浏览器指标 span 取自 PerformanceNavigationTiming（初始文档 URL），
    // history.replaceState 改写不了它——上报前统一剥离搜索词等用户输入参数
    beforeSendTransaction(event) {
      return scrubEvent(event)
    },
    beforeBreadcrumb(breadcrumb) {
      return scrubBreadcrumb(breadcrumb)
    },
  }
}

export interface InstallSentryDeps {
  load?: () => Promise<Pick<SentryModule, 'init' | 'browserTracingIntegration' | 'captureException'>>
  queue?: PreInitErrorQueue
}

/**
 * 在 app 挂载后调用：动态加载 @sentry/vue 并用「同一个已挂载的 app」初始化
 * （init 传入 app 即自动挂 Vue errorHandler，不再单独 attachErrorHandler），
 * 然后回放初始化前队列里的错误。加载失败只 warn，不影响页面。
 */
export async function installSentry(app: App, router: Router, deps: InstallSentryDeps = {}): Promise<boolean> {
  const queue = deps.queue ?? createPreInitErrorQueue(window)
  const load = deps.load ?? (() => import('@sentry/vue'))
  let sentry: Awaited<ReturnType<NonNullable<InstallSentryDeps['load']>>>
  try {
    sentry = await load()
  } catch (err) {
    queue.dispose()
    console.warn('[sentry] 懒加载失败，本次会话不上报:', err)
    return false
  }
  sentry.init(buildSentryOptions(sentry, app, router))
  queue.dispose()
  for (const pending of queue.drain()) {
    const hint: EventHint = { mechanism: { type: pending.kind, handled: false } }
    sentry.captureException(pending.error, hint)
  }
  return true
}
