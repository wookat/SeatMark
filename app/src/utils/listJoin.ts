import { currentLocale } from '@/i18n'

/** 按当前 locale 用顿号（中文）或逗号（英文）拼接列表 */
export function listJoin(items: readonly string[]): string {
  return items.join(currentLocale() === 'en' ? ', ' : '、')
}
