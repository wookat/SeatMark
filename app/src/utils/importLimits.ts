/**
 * 名单文件导入上限（浏览器本地解析的保护阈值，与任何上传无关）：
 * 超过上限的文件 / 行数直接拒绝并给出可本地化的中文错误文案（en 词典有对应键）。
 */
export const IMPORT_FILE_MAX_MB = 20
export const IMPORT_FILE_MAX_BYTES = IMPORT_FILE_MAX_MB * 1024 * 1024
export const IMPORT_MAX_ROWS = 10000

/** 粘贴名单：普通输入的解析去抖（ms） */
export const PASTE_PARSE_DEBOUNCE_MS = 300
/** 粘贴名单：文本长度超过此阈值后不再每键自动重解析，改为按钮手动触发 */
export const PASTE_MANUAL_PARSE_THRESHOLD = 2000

export const IMPORT_FILE_TOO_LARGE_MESSAGE = `文件超过 ${IMPORT_FILE_MAX_MB}MB，请精简内容或拆分后再导入`
export const IMPORT_TOO_MANY_ROWS_MESSAGE = `名单超过 ${IMPORT_MAX_ROWS} 行，请拆分后再导入`

/** 文件体积超限时抛出可本地化错误，否则原样放行 */
export function assertImportFileSize(file: File): void {
  if (file.size > IMPORT_FILE_MAX_BYTES) throw new Error(IMPORT_FILE_TOO_LARGE_MESSAGE)
}

/** 数据行数超限时抛出可本地化错误 */
export function assertImportRowCount(count: number): void {
  if (count > IMPORT_MAX_ROWS) throw new Error(IMPORT_TOO_MANY_ROWS_MESSAGE)
}
