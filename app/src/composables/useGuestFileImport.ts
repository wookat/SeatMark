import { ref } from 'vue'

import type { DataRow } from '@/types/template'

/** 名单文件读取结果：Excel 走表格（表头 + 数据行），TXT/CSV 走纯文本 */
export type GuestFileContent =
  | { kind: 'table'; headers: string[]; rows: DataRow[] }
  | { kind: 'text'; text: string }

/** 所有名单文件入口共用的 accept 列表（与 BanquetView 原有入口同规格） */
export const GUEST_FILE_ACCEPT = '.txt,.csv,.xlsx,.xls,text/plain,text/csv'

/**
 * 浏览器本地读取名单文件（不触发任何网络请求）：
 * .xlsx/.xls 懒加载 @/utils/excel 的 parseExcelFile；其余按 TXT/CSV 文本解码（UTF-8 → GB18030 回退）。
 */
export async function readGuestFile(file: File): Promise<GuestFileContent> {
  if (/\.xlsx?$/i.test(file.name)) {
    const { parseExcelFile } = await import('@/utils/excel')
    const { headers, rows } = await parseExcelFile(file)
    return { kind: 'table', headers, rows }
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { decodeCsvText } = await import('@/utils/excel')
  return { kind: 'text', text: decodeCsvText(bytes) }
}

export interface GuestFileImportHandlers {
  /** Excel 表格结果（表头 + 行） */
  onTable: (headers: string[], rows: DataRow[]) => void | Promise<void>
  /** TXT/CSV 文本结果 */
  onText: (text: string) => void | Promise<void>
  /** 读取/解析失败（Excel 损坏、加密等）；message 为可翻译的中文错误文案 */
  onError: (message: string) => void
}

/**
 * 名单文件上传入口的共用逻辑：持有隐藏 <input type=file> 的 ref，
 * `open()` 触发选择，`onFileChange` 读取后按类型分派到 onTable / onText，并清空 input 以便重复选同一文件。
 */
export function useGuestFileImport(handlers: GuestFileImportHandlers) {
  const fileInput = ref<HTMLInputElement | null>(null)
  const reading = ref(false)

  function open() {
    fileInput.value?.click()
  }

  async function handleFile(file: File) {
    reading.value = true
    try {
      const content = await readGuestFile(file)
      if (content.kind === 'table') await handlers.onTable(content.headers, content.rows)
      else await handlers.onText(content.text)
    } catch (err) {
      handlers.onError(err instanceof Error ? err.message : String(err))
    } finally {
      reading.value = false
    }
  }

  async function onFileChange(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    await handleFile(file)
  }

  return { fileInput, reading, open, onFileChange, handleFile, accept: GUEST_FILE_ACCEPT }
}
