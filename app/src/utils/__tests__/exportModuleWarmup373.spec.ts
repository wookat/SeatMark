// @vitest-environment jsdom
/**
 * 第 373 轮：导出分包预热与「重试」提示——
 * warmUpExportModules 每页面会话只调度一次；省流量 / 2g 跳过；无 requestIdleCallback 回退 2 s setTimeout；
 * 预热失败静默不重复；组件加载超时/失败的 toast 常驻并带「重试」按钮，点击直接重新走同一导出调用；
 * 页面渲染失败仍是普通 toast。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { pushExportFailureToast } from '@/utils/exportFailureToast'

type IdleCb = () => void

function stubConnection(value: { saveData?: boolean; effectiveType?: string } | undefined) {
  Object.defineProperty(navigator, 'connection', { value, configurable: true })
}

async function loadPdfExport() {
  const mod = await import('@/utils/pdfExport')
  mod.resetExportModuleWarmupForTests()
  return mod
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('html2canvas-pro')
  vi.doUnmock('jspdf')
  vi.resetModules()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  stubConnection(undefined)
  delete (window as { requestIdleCallback?: unknown }).requestIdleCallback
})

describe('第 373 轮：warmUpExportModules', () => {
  it('requestIdleCallback 可用：只调度一次，空闲回调内 import jspdf + html2canvas-pro', async () => {
    const jspdfFactory = vi.fn(async () => ({ jsPDF: class {} }))
    const h2cFactory = vi.fn(async () => ({ default: vi.fn() }))
    vi.doMock('jspdf', jspdfFactory)
    vi.doMock('html2canvas-pro', h2cFactory)
    const idleCallbacks: IdleCb[] = []
    const ric = vi.fn((cb: IdleCb) => {
      idleCallbacks.push(cb)
      return idleCallbacks.length
    })
    ;(window as unknown as { requestIdleCallback: typeof ric }).requestIdleCallback = ric

    const { warmUpExportModules } = await loadPdfExport()
    expect(warmUpExportModules()).toBe(true)
    expect(warmUpExportModules()).toBe(false)
    expect(warmUpExportModules()).toBe(false)
    expect(ric).toHaveBeenCalledTimes(1)
    expect(jspdfFactory).not.toHaveBeenCalled()

    idleCallbacks[0]!()
    await vi.waitFor(() => {
      expect(jspdfFactory).toHaveBeenCalledTimes(1)
      expect(h2cFactory).toHaveBeenCalledTimes(1)
    })
  })

  it('无 requestIdleCallback：回退 setTimeout 2 s 后再预热', async () => {
    // 默认 fake timers 会连 requestIdleCallback 一起仓真，这里只仓真 setTimeout 以模拟无 rIC 的浏览器（Safari）
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    expect(typeof window.requestIdleCallback).toBe('undefined')
    const jspdfFactory = vi.fn(async () => ({ jsPDF: class {} }))
    vi.doMock('jspdf', jspdfFactory)
    vi.doMock('html2canvas-pro', async () => ({ default: vi.fn() }))

    const { warmUpExportModules, EXPORT_WARMUP_FALLBACK_DELAY_MS } = await loadPdfExport()
    expect(EXPORT_WARMUP_FALLBACK_DELAY_MS).toBe(2_000)
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout')
    expect(warmUpExportModules()).toBe(true)
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1)
    expect(setTimeoutSpy.mock.calls[0]![1]).toBe(2_000)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(vi.getTimerCount()).toBe(0)
    await vi.waitFor(() => expect(jspdfFactory).toHaveBeenCalledTimes(1))
  })

  it('navigator.connection.saveData / 2g / slow-2g → 跳过预热且不调度', async () => {
    const ric = vi.fn()
    ;(window as unknown as { requestIdleCallback: typeof ric }).requestIdleCallback = ric
    const { warmUpExportModules, shouldSkipExportWarmup, resetExportModuleWarmupForTests } =
      await loadPdfExport()

    stubConnection({ saveData: true, effectiveType: '4g' })
    expect(shouldSkipExportWarmup()).toBe(true)
    expect(warmUpExportModules()).toBe(false)
    expect(ric).not.toHaveBeenCalled()

    for (const effectiveType of ['2g', 'slow-2g']) {
      resetExportModuleWarmupForTests()
      stubConnection({ saveData: false, effectiveType })
      expect(shouldSkipExportWarmup(), effectiveType).toBe(true)
      expect(warmUpExportModules(), effectiveType).toBe(false)
    }
    expect(ric).not.toHaveBeenCalled()

    resetExportModuleWarmupForTests()
    stubConnection({ saveData: false, effectiveType: '4g' })
    expect(shouldSkipExportWarmup()).toBe(false)
    expect(warmUpExportModules()).toBe(true)
    expect(ric).toHaveBeenCalledTimes(1)
  })

  it('预热失败静默：分包 import 拒绝不抛出、也不再次调度', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const jspdfFactory = vi.fn(async () => {
      throw new TypeError('Failed to fetch dynamically imported module')
    })
    vi.doMock('jspdf', jspdfFactory)
    vi.doMock('html2canvas-pro', async () => ({ default: vi.fn() }))
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      const { warmUpExportModules } = await loadPdfExport()
      expect(warmUpExportModules()).toBe(true)
      await vi.advanceTimersByTimeAsync(2_000)
      await vi.waitFor(() => expect(jspdfFactory).toHaveBeenCalledTimes(1))
      await vi.advanceTimersByTimeAsync(0)
      expect(unhandled).not.toHaveBeenCalled()
      expect(warmUpExportModules()).toBe(false)
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })
})

describe('第 373 轮：loadExportModules 区分超时与加载失败', () => {
  it('loader 拒绝 → 「导出组件加载失败」；永不落定 → 20 s 后「导出组件加载超时」；两者都算加载阶段错误', async () => {
    vi.useFakeTimers()
    const { loadExportModules, isExportModuleLoadError, MODULE_LOAD_FAILED_MESSAGE, MODULE_LOAD_TIMEOUT_MESSAGE } =
      await loadPdfExport()

    const failed = loadExportModules(() => Promise.reject(new TypeError('Failed to fetch')))
    await expect(failed).rejects.toThrow(MODULE_LOAD_FAILED_MESSAGE)
    await expect(failed.catch((e: unknown) => isExportModuleLoadError(e))).resolves.toBe(true)

    const hung = loadExportModules(() => new Promise<never>(() => {}))
    const expectation = expect(hung).rejects.toThrow(MODULE_LOAD_TIMEOUT_MESSAGE)
    await vi.advanceTimersByTimeAsync(20_000)
    await expectation

    expect(isExportModuleLoadError(new Error('第 1/3 页渲染失败：canvas 为空'))).toBe(false)
    await expect(loadExportModules(async () => 42)).resolves.toBe(42)
  })
})

describe('第 373 轮：导出失败 toast 带「重试」', () => {
  const t = (zh: string) => zh

  it('组件加载超时 → danger、常驻（timeout 0）、action=重试并重新调用同一导出函数', async () => {
    const { MODULE_LOAD_TIMEOUT_MESSAGE } = await loadPdfExport()
    const push = vi.fn(() => 1)
    const retry = vi.fn(async () => {})
    const kind = pushExportFailureToast({
      toast: { push },
      t,
      title: 'PDF 生成失败',
      error: new Error(MODULE_LOAD_TIMEOUT_MESSAGE),
      renderFailureText: 'should not be used',
      moduleLoadNote: '；本次未扣除无水印次数，可直接重试',
      retry,
    })
    expect(kind).toBe('module-load')
    expect(push).toHaveBeenCalledTimes(1)
    const [type, title, text, timeout, action] = push.mock.calls[0]! as unknown as [
      string,
      string,
      string,
      number,
      { label: string; onClick: () => void },
    ]
    expect(type).toBe('danger')
    expect(title).toBe('PDF 生成失败')
    expect(text).toBe(`${MODULE_LOAD_TIMEOUT_MESSAGE}；本次未扣除无水印次数，可直接重试`)
    expect(timeout).toBe(0)
    expect(action.label).toBe('重试')
    expect(retry).not.toHaveBeenCalled()
    action.onClick()
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('组件加载失败（非超时）同样带重试；页面渲染失败仍是普通 danger toast（自动消失、无按钮）', async () => {
    const { MODULE_LOAD_FAILED_MESSAGE } = await loadPdfExport()
    const push = vi.fn(() => 1)
    const retry = vi.fn()
    expect(
      pushExportFailureToast({
        toast: { push },
        t,
        title: '导出失败',
        error: new Error(MODULE_LOAD_FAILED_MESSAGE),
        renderFailureText: 'unused',
        retry,
      }),
    ).toBe('module-load')
    const failedCall = push.mock.calls[0]! as unknown as unknown[]
    expect(failedCall[3]).toBe(0)
    expect(failedCall[2]).toBe(MODULE_LOAD_FAILED_MESSAGE)

    push.mockClear()
    expect(
      pushExportFailureToast({
        toast: { push },
        t,
        title: '导出失败',
        error: new Error('第 2/5 页渲染失败：timeout'),
        renderFailureText: '第 2/5 页渲染失败：timeout；本次未扣除无水印次数，可直接重试',
        retry,
      }),
    ).toBe('render')
    expect(push).toHaveBeenCalledWith('danger', '导出失败', '第 2/5 页渲染失败：timeout；本次未扣除无水印次数，可直接重试')
    expect((push.mock.calls[0]! as unknown as unknown[]).length).toBe(3)
    expect(retry).not.toHaveBeenCalled()
  })
})
