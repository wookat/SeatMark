import type { ToastAction, ToastType } from '@/stores/toast'
import { isExportModuleLoadError } from '@/utils/pdfExport'

/** 只依赖 toast store 的 push 签名，便于在 utils 层单测而不挂 Pinia */
export interface ExportFailureToastSink {
  push(type: ToastType, title: string, text?: string, timeout?: number, action?: ToastAction): number
}

export interface ExportFailureToastOptions {
  toast: ExportFailureToastSink
  /** i18n 查表函数（中文源串 → 当前语言） */
  t: (zh: string) => string
  /** 标题，如「PDF 生成失败」「导出失败」 */
  title: string
  error: unknown
  /** 页面渲染失败时的正文（调用方已本地化） */
  renderFailureText: string
  /** 组件加载失败时追加在正文后的额度说明（可选，Studio 传「；本次未扣除无水印次数」） */
  moduleLoadNote?: string
  /** 重试直接重新走同一导出调用 */
  retry: () => void | Promise<void>
}

export type ExportFailureKind = 'module-load' | 'render'

/**
 * 导出失败提示：
 * - 组件加载超时 / 加载失败 → 常驻 danger toast + 「重试」按钮（Vite 动态 import 失败不缓存拒绝，重试即重新下载分包）；
 * - 页面渲染失败 → 普通 danger toast，沿用调用方文案，自动消失。
 * 两类都不涉及额度扣减（加载/渲染失败本就不扣次数）。
 */
export function pushExportFailureToast(options: ExportFailureToastOptions): ExportFailureKind {
  const { toast, t, title, error, retry } = options
  if (isExportModuleLoadError(error)) {
    const message = error instanceof Error ? error.message : String(error)
    toast.push(
      'danger',
      title,
      `${t(message)}${options.moduleLoadNote ?? ''}`,
      0,
      {
        label: t('重试'),
        onClick: () => {
          void retry()
        },
      },
    )
    return 'module-load'
  }
  toast.push('danger', title, options.renderFailureText)
  return 'render'
}
