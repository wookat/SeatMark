/**
 * main.ts 装配：只创建一个 Vue 应用实例，Sentry 在 mount 之后由 scheduleSentryInstall 推迟到浏览器空闲
 * （或首个错误事件）再懒初始化，并拿到这同一个实例。
 */
import { createApp, defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const created: unknown[] = []
const mounted: unknown[] = []

vi.mock('vue', async (importOriginal) => {
  const mod = await importOriginal<typeof import('vue')>()
  const createApp: typeof mod.createApp = (...args) => {
    const app = mod.createApp(...args)
    created.push(app)
    const mount = app.mount.bind(app)
    app.mount = ((container: Element | string, ...rest: []) => {
      mounted.push(app)
      return mount(container, ...rest)
    }) as typeof app.mount
    return app
  }
  return { ...mod, createApp }
})

vi.mock('@/App.vue', () => ({
  default: defineComponent({ name: 'AppStub', render: () => h('div', 'app-stub') }),
}))

vi.mock('@/assets/main.css', () => ({}))
vi.mock('@/assets/fonts-plangothic.css', () => ({}))

const scheduleSentryInstall = vi.fn(async () => true)
const createPreInitErrorQueue = vi.fn(() => ({ drain: () => [], dispose: () => {} }))
vi.mock('@/utils/sentry', () => ({
  SENTRY_DSN: 'https://k@o1.ingest.us.sentry.io/1',
  scheduleSentryInstall,
  createPreInitErrorQueue,
}))

describe('main.ts 装配', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
    created.length = 0
    mounted.length = 0
  })

  it('createApp 只调用一次（无幻影实例），Sentry 在 mount 之后由 scheduleSentryInstall 以同一 app 调度', async () => {
    // 静态 import 不能进 main.ts（它有副作用），用动态 import 触发装配
    await import('@/main')
    // 等 router.isReady().then(mount) 与其中的 scheduleSentryInstall 调用
    await vi.waitFor(() => {
      expect(mounted.length).toBe(1)
      expect(scheduleSentryInstall).toHaveBeenCalledTimes(1)
    })
    expect(created.length).toBe(1)
    expect(document.querySelector('#app')?.textContent).toContain('app-stub')

    // 队列在 mount 之前就已建立（挂载期错误也能缓存）
    expect(createPreInitErrorQueue).toHaveBeenCalledTimes(1)
    expect(createPreInitErrorQueue.mock.invocationCallOrder[0]!).toBeLessThan(
      scheduleSentryInstall.mock.invocationCallOrder[0]!,
    )

    const [appArg, routerArg, deps] = scheduleSentryInstall.mock.calls[0]! as unknown as [
      unknown,
      { isReady: () => Promise<void> },
      { queue: unknown },
    ]
    expect(appArg).toBe(created[0])
    expect(appArg).toBe(mounted[0])
    expect(typeof routerArg.isReady).toBe('function')
    expect(deps.queue).toBe(createPreInitErrorQueue.mock.results[0]!.value)
  })

  it('入口静态依赖里没有 @sentry/vue（SDK 只走懒加载）', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/main.ts'), 'utf8')
    expect(source).not.toMatch(/^import .*@sentry\/vue/m)
    const sentryUtil = fs.readFileSync(path.resolve(process.cwd(), 'src/utils/sentry.ts'), 'utf8')
    // utils/sentry.ts 对 @sentry/vue 只允许 type import 与动态 import()
    for (const line of sentryUtil.split('\n')) {
      if (line.includes("'@sentry/vue'") && line.trimStart().startsWith('import')) {
        expect(line).toMatch(/^import type /)
      }
    }
    expect(sentryUtil).toContain("import('@sentry/vue')")
    // 入口走的是推迟调度，而不是挂载后立即 installSentry
    expect(source).toContain('scheduleSentryInstall(app, router')
    expect(source).not.toMatch(/\binstallSentry\(/)
  })
})

describe('第 357 轮：scheduleSentryInstall 推迟到 idle / 首个错误事件', () => {
  type SentryUtil = typeof import('@/utils/sentry')
  let actual: SentryUtil
  let idleCallbacks: Array<{ cb: IdleRequestCallback; options?: IdleRequestOptions }>
  let cancelled: number[]

  function makeTarget(withIdle: boolean): Window {
    const target = new EventTarget() as unknown as Window & {
      requestIdleCallback?: Window['requestIdleCallback']
      cancelIdleCallback?: Window['cancelIdleCallback']
    }
    if (withIdle) {
      target.requestIdleCallback = ((cb: IdleRequestCallback, options?: IdleRequestOptions) => {
        idleCallbacks.push({ cb, options })
        return idleCallbacks.length
      }) as Window['requestIdleCallback']
      target.cancelIdleCallback = ((handle: number) => {
        cancelled.push(handle)
      }) as Window['cancelIdleCallback']
    }
    return target
  }

  function makeApp() {
    const app = createApp(defineComponent({ render: () => h('div') }))
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    })
    return { app, router }
  }

  beforeEach(async () => {
    actual = await vi.importActual<SentryUtil>('@/utils/sentry')
    idleCallbacks = []
    cancelled = []
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('requestIdleCallback 可用：idle 前不调 load，idle 后调用一次且后续 error 不重复', async () => {
    const target = makeTarget(true)
    const { app, router } = makeApp()
    const install = vi.fn<typeof actual.installSentry>(async () => true)
    const promise = actual.scheduleSentryInstall(app, router, { target, install })
    await Promise.resolve()
    expect(install).not.toHaveBeenCalled()
    expect(idleCallbacks).toHaveLength(1)
    expect(idleCallbacks[0]!.options?.timeout).toBe(actual.SENTRY_IDLE_TIMEOUT_MS)

    idleCallbacks[0]!.cb({ didTimeout: false, timeRemaining: () => 50 })
    expect(install).toHaveBeenCalledTimes(1)
    expect(install.mock.calls[0]![0]).toBe(app)
    expect(install.mock.calls[0]![1]).toBe(router)
    await expect(promise).resolves.toBe(true)

    target.dispatchEvent(new ErrorEvent('error', { message: 'later' }))
    idleCallbacks[0]!.cb({ didTimeout: true, timeRemaining: () => 0 })
    expect(install).toHaveBeenCalledTimes(1)
  })

  it('首个 error 事件立即触发 load（不等 idle），并取消 idle 回调；错误已在队列中不丢', async () => {
    const target = makeTarget(true)
    const { app, router } = makeApp()
    // 与 main.ts 一致：队列先于调度注册
    const queue = actual.createPreInitErrorQueue(target)
    const install = vi.fn<typeof actual.installSentry>(async () => true)
    const promise = actual.scheduleSentryInstall(app, router, { target, install, queue })
    expect(install).not.toHaveBeenCalled()

    const boom = new Error('boom')
    target.dispatchEvent(new ErrorEvent('error', { error: boom, message: 'boom' }))
    expect(install).toHaveBeenCalledTimes(1)
    expect(install.mock.calls[0]![2]?.queue).toBe(queue)
    expect(cancelled).toEqual([1])
    expect(queue.drain().map((p) => p.error)).toEqual([boom])
    await expect(promise).resolves.toBe(true)

    // idle 随后到来也不重复
    idleCallbacks[0]!.cb({ didTimeout: false, timeRemaining: () => 50 })
    target.dispatchEvent(new ErrorEvent('error', { message: 'again' }))
    expect(install).toHaveBeenCalledTimes(1)
  })

  it('unhandledrejection 同样立即触发', () => {
    const target = makeTarget(true)
    const { app, router } = makeApp()
    const install = vi.fn<typeof actual.installSentry>(async () => true)
    void actual.scheduleSentryInstall(app, router, { target, install })
    target.dispatchEvent(new Event('unhandledrejection'))
    expect(install).toHaveBeenCalledTimes(1)
  })

  it('不支持 requestIdleCallback：setTimeout 3000ms 兜底，到时调用一次', async () => {
    vi.useFakeTimers()
    const target = makeTarget(false)
    const { app, router } = makeApp()
    const install = vi.fn<typeof actual.installSentry>(async () => true)
    const promise = actual.scheduleSentryInstall(app, router, { target, install })
    vi.advanceTimersByTime(actual.SENTRY_IDLE_TIMEOUT_MS - 1)
    expect(install).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(install).toHaveBeenCalledTimes(1)
    await expect(promise).resolves.toBe(true)
    vi.advanceTimersByTime(10_000)
    target.dispatchEvent(new ErrorEvent('error', { message: 'late' }))
    expect(install).toHaveBeenCalledTimes(1)
  })

  it('首个 error 先于兜底计时器到来：立即调用且计时器不再重复触发', () => {
    vi.useFakeTimers()
    const target = makeTarget(false)
    const { app, router } = makeApp()
    const install = vi.fn<typeof actual.installSentry>(async () => true)
    void actual.scheduleSentryInstall(app, router, { target, install })
    vi.advanceTimersByTime(100)
    target.dispatchEvent(new ErrorEvent('error', { message: 'early' }))
    expect(install).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(10_000)
    expect(install).toHaveBeenCalledTimes(1)
  })
})
