/**
 * 轻量 i18n（gettext 风格）：中文原文即字典 key。
 * - 英文字典独立 chunk，仅 /en 路由进入前懒加载，中文用户主包零增量；
 * - 未命中字典的字符串回退中文原文，英文覆盖可分批推进；
 * - 方案论证见 docs/i18n-plan.md。
 */
import { computed, ref } from 'vue'

export type Locale = 'zh' | 'en'

export const LOCALE_STORAGE_KEY = 'seatmark.locale'

const localeRef = ref<Locale>('zh')

let enDict: Record<string, string> | null = null

/** 路由前缀 → locale（/en 与 /en/* 为英文） */
export function localeFromPath(path: string): Locale {
  return path === '/en' || path.startsWith('/en/') ? 'en' : 'zh'
}

/** 切换 locale；英文字典首次使用时懒加载 */
export async function setLocale(locale: Locale): Promise<void> {
  if (locale === 'en' && !enDict) {
    const mod = await import('./locales/en')
    enDict = mod.en
  }
  localeRef.value = locale
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN'
  }
}

/** 中文原文 → 当前 locale 文案；英文未命中时回退中文 */
export function t(zh: string): string {
  if (localeRef.value === 'en') return enDict?.[zh] ?? zh
  return zh
}

/** 给站内路径加上当前 locale 前缀（zh 原样返回） */
export function localePath(path: string, locale: Locale = localeRef.value): string {
  if (locale !== 'en') return path
  if (path === '/en' || path.startsWith('/en/') || path.startsWith('/en?') || path.startsWith('/en#')) return path
  const match = path.match(/^([^?#]*)([\s\S]*)$/)!
  const base = match[1]!
  const rest = match[2]!
  return (base === '/' || base === '' ? '/en' : `/en${base}`) + rest
}

/** 去掉 /en 前缀，得到对应的中文路径 */
export function stripLocalePrefix(path: string): string {
  if (path === '/en') return '/'
  if (path.startsWith('/en/')) return path.slice(3)
  return path
}

export function useI18n() {
  return {
    t,
    localePath,
    locale: computed(() => localeRef.value),
  }
}

export function currentLocale(): Locale {
  return localeRef.value
}

/** 记住用户语言选择（仅做切换器记忆，不做自动重定向） */
export function rememberLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // 忽略存储异常
  }
}
