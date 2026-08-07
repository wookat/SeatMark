/**
 * 浏览器打印通道工具：
 * 桌面端走 window.print()（打印对话框可直接打印或另存为矢量 PDF）；
 * 移动端浏览器的打印预览对隐藏宿主 / 复杂 CSS 渲染不可靠（常见整页空白），
 * 改走「生成图片版 PDF → 调起系统分享 / 打开」的可靠通道。
 */

/** 移动端环境判定：UA 含移动关键词，或仅有粗指针（触屏）没有细指针（鼠标） */
export function isMobilePrintEnvironment(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
  if (/Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i.test(navigator.userAgent)) return true
  try {
    return (
      window.matchMedia('(any-pointer: coarse)').matches &&
      !window.matchMedia('(any-pointer: fine)').matches
    )
  } catch {
    return false
  }
}

/** afterprint 事件兜底等待上限：对话框关闭后事件未派发也不允许拖死流程 */
export const AFTER_PRINT_FALLBACK_MS = 1_500

/**
 * 调起浏览器打印并等待打印流程结束（afterprint）再返回。
 * 桌面 Chrome/Firefox 的 window.print() 阻塞到预览关闭；部分浏览器立即返回、
 * 打印预览异步渲染 —— 提前卸载打印宿主会导致输出空白，必须等 afterprint。
 */
export async function printAndWaitUntilDone(
  fallbackMs = AFTER_PRINT_FALLBACK_MS,
): Promise<void> {
  const done = new Promise<void>((resolve) => {
    window.addEventListener('afterprint', () => resolve(), { once: true })
  })
  window.print()
  await Promise.race([done, new Promise<void>((r) => setTimeout(r, fallbackMs))])
}

export type MobilePdfDelivery = 'shared' | 'opened' | 'downloaded' | 'cancelled'

/** blob URL 回收延迟：留足新标签页 / PDF 查看器加载文件的时间 */
const BLOB_URL_REVOKE_DELAY_MS = 60_000

/**
 * 移动端打印通道：优先系统分享面板（可选「打印」或用 PDF 应用打开），
 * 不支持 Web Share 时退回新标签页打开，弹窗被拦截则直接下载。
 * 用户在分享面板取消返回 'cancelled'（PDF 已生成，不视为失败）。
 */
export async function deliverPdfForMobilePrint(
  blob: Blob,
  fileName: string,
): Promise<MobilePdfDelivery> {
  const file = new File([blob], fileName, { type: 'application/pdf' })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName })
      return 'shared'
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled'
      // 分享通道失败（如系统限制）：继续走打开 / 下载兜底
    }
  }
  const url = URL.createObjectURL(blob)
  setTimeout(() => URL.revokeObjectURL(url), BLOB_URL_REVOKE_DELAY_MS)
  const win = window.open(url, '_blank')
  if (win) return 'opened'
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  return 'downloaded'
}
