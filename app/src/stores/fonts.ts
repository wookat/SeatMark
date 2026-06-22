import { defineStore } from 'pinia'
import { reactive } from 'vue'

import { findFontByStack, findFontById, type WebFont } from '@/data/fonts'
import { useToastStore } from '@/stores/toast'
import type { LabelTemplate } from '@/types/template'

export type FontStatus = 'idle' | 'loading' | 'ready' | 'error'

/** 单个样式表注入，带超时保护 */
function injectStylesheet(url: string, timeoutMs = 12000): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLLinkElement>(`link[data-webfont="${url}"]`)
    if (existing) {
      resolve()
      return
    }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    link.dataset.webfont = url
    const timer = setTimeout(() => {
      link.remove()
      reject(new Error(`字体样式表加载超时：${url}`))
    }, timeoutMs)
    link.onload = () => {
      clearTimeout(timer)
      resolve()
    }
    link.onerror = () => {
      clearTimeout(timer)
      link.remove()
      reject(new Error(`字体样式表加载失败：${url}`))
    }
    document.head.appendChild(link)
  })
}

async function loadCssWithFallback(urls: string[]): Promise<void> {
  let lastError: unknown = new Error('没有可用的字体源')
  for (const url of urls) {
    try {
      await injectStylesheet(url)
      return
    } catch (err) {
      lastError = err
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

/**
 * 在线字体加载管理：
 * - 仅在用户选择字体时才发起网络请求（隐私优先，默认零请求）
 * - 多 CDN 依次回退，应对不同网络环境
 * - 通过 FontFace API 触发分包下载，确保预览/导出时字形可用
 */
export const useFontsStore = defineStore('fonts', () => {
  const status = reactive<Record<string, FontStatus>>({})
  const pending = new Map<string, Promise<boolean>>()

  async function doLoad(font: WebFont): Promise<boolean> {
    const toast = useToastStore()
    status[font.id] = 'loading'
    try {
      await loadCssWithFallback(font.cssUrls)
      // 触发实际字体文件（含分包）下载；jsdom 等环境无 document.fonts 时跳过
      if (typeof document !== 'undefined' && 'fonts' in document) {
        const probes = [
          document.fonts.load(`16px '${font.family}'`, font.preview),
          document.fonts.load(`bold 16px '${font.family}'`, font.preview),
        ]
        await Promise.race([
          Promise.allSettled(probes),
          new Promise((resolve) => setTimeout(resolve, 10000)),
        ])
      }
      status[font.id] = 'ready'
      return true
    } catch (err) {
      status[font.id] = 'error'
      toast.danger(
        `字体「${font.name}」加载失败`,
        err instanceof Error ? '请检查网络后重试' : String(err),
      )
      return false
    } finally {
      pending.delete(font.id)
    }
  }

  /** 确保某款字体可用；重复调用会复用进行中的加载 */
  function ensureFont(id: string): Promise<boolean> {
    const font = findFontById(id)
    if (!font) return Promise.resolve(false)
    // 系统本地字体：本机直接渲染，无需加载
    if (font.local || !font.cssUrls.length) {
      status[font.id] = 'ready'
      return Promise.resolve(true)
    }
    if (status[font.id] === 'ready') return Promise.resolve(true)
    const inflight = pending.get(font.id)
    if (inflight) return inflight
    const task = doLoad(font)
    pending.set(font.id, task)
    return task
  }

  /** 根据 font-family 栈补载目录内字体（打开自定义/分享模板时调用） */
  function ensureStack(stack: string | undefined): void {
    const font = findFontByStack(stack)
    if (font && status[font.id] !== 'ready') void ensureFont(font.id)
  }

  /** 补载模板用到的全部在线字体（模板级 + 字段级，中文与西文栈都检查） */
  function ensureTemplateFonts(template: LabelTemplate): void {
    ensureStack(template.fontFamily)
    ensureStack(template.fontFamilyEn)
    for (const field of template.fields) {
      ensureStack(field.fontFamily)
      ensureStack(field.fontFamilyEn)
    }
  }

  function statusOf(id: string): FontStatus {
    return status[id] ?? 'idle'
  }

  return { status, ensureFont, ensureStack, ensureTemplateFonts, statusOf }
})
