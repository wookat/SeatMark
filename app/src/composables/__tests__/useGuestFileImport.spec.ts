// @vitest-environment jsdom
/**
 * 第 353 轮：名单文件导入上限——>20MB 文件在加载解析库之前就被拒绝；Excel 数据行 >10000 解析后拒绝。
 * 错误文案为可本地化中文键，en 词典须有对应译文。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'

const parseExcelFile = vi.fn()
const decodeCsvText = vi.fn((_bytes: Uint8Array) => 'mocked')
vi.mock('@/utils/excel', () => ({
  parseExcelFile: (file: File, sheet?: string) => parseExcelFile(file, sheet),
  decodeCsvText: (bytes: Uint8Array) => decodeCsvText(bytes),
}))

import { readGuestFile, useGuestFileImport } from '@/composables/useGuestFileImport'
import { en } from '@/i18n/locales/en'
import {
  IMPORT_FILE_MAX_BYTES,
  IMPORT_FILE_TOO_LARGE_MESSAGE,
  IMPORT_MAX_ROWS,
  IMPORT_TOO_MANY_ROWS_MESSAGE,
} from '@/utils/importLimits'

/** 不实际分配 20MB 内存：用 size 只读属性伪造超大文件 */
function fakeFile(name: string, size: number, type = ''): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

beforeEach(() => {
  parseExcelFile.mockReset()
  decodeCsvText.mockClear()
})

describe('readGuestFile 文件体积上限', () => {
  it('>20MB 的 .xlsx 被拒绝，且不调用 parseExcelFile', async () => {
    const file = fakeFile('big.xlsx', IMPORT_FILE_MAX_BYTES + 1)
    await expect(readGuestFile(file)).rejects.toThrow(IMPORT_FILE_TOO_LARGE_MESSAGE)
    expect(parseExcelFile).not.toHaveBeenCalled()
  })

  it('>20MB 的 .txt / .csv 同样被拒绝，不读取内容', async () => {
    for (const name of ['big.txt', 'big.csv']) {
      const file = fakeFile(name, IMPORT_FILE_MAX_BYTES * 2)
      const arrayBuffer = vi.spyOn(file, 'arrayBuffer')
      await expect(readGuestFile(file)).rejects.toThrow(IMPORT_FILE_TOO_LARGE_MESSAGE)
      expect(arrayBuffer).not.toHaveBeenCalled()
    }
    expect(decodeCsvText).not.toHaveBeenCalled()
  })

  it('恰好 20MB 的文件放行并进入 parseExcelFile', async () => {
    parseExcelFile.mockResolvedValue({ headers: ['姓名'], rows: [{ 姓名: '张伟' }] })
    const file = fakeFile('ok.xlsx', IMPORT_FILE_MAX_BYTES)
    await expect(readGuestFile(file)).resolves.toEqual({
      kind: 'table',
      headers: ['姓名'],
      rows: [{ 姓名: '张伟' }],
    })
    expect(parseExcelFile).toHaveBeenCalledTimes(1)
  })

  it('useGuestFileImport.handleFile：超限文件走 onError 展示文案，不触发 onTable/onText', async () => {
    const handlers = { onTable: vi.fn(), onText: vi.fn(), onError: vi.fn() }
    const guest = useGuestFileImport(handlers)
    await guest.handleFile(fakeFile('big.xlsx', IMPORT_FILE_MAX_BYTES + 1))
    expect(handlers.onError).toHaveBeenCalledWith(IMPORT_FILE_TOO_LARGE_MESSAGE)
    expect(handlers.onTable).not.toHaveBeenCalled()
    expect(handlers.onText).not.toHaveBeenCalled()
    expect(parseExcelFile).not.toHaveBeenCalled()
    expect(guest.reading.value).toBe(false)
  })
})

describe('parseExcelFile 行数上限（真实实现）', () => {
  it('10001 行数据抛出「名单超过 10000 行」；10000 行放行', async () => {
    const { parseExcelFile: realParse } = await vi.importActual<typeof import('@/utils/excel')>(
      '@/utils/excel',
    )
    const build = (count: number) => {
      const matrix = [['姓名', '座位号']]
      for (let i = 0; i < count; i++) matrix.push([`考生${i}`, String(i + 1)])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(matrix), 'Sheet1')
      const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
      return new File([bytes], `rows-${count}.xlsx`)
    }
    await expect(realParse(build(IMPORT_MAX_ROWS + 1))).rejects.toThrow(IMPORT_TOO_MANY_ROWS_MESSAGE)
    const ok = await realParse(build(IMPORT_MAX_ROWS))
    expect(ok.rows).toHaveLength(IMPORT_MAX_ROWS)
  })

  it('真实 parseExcelFile 对 >20MB 文件同样在读取前拒绝', async () => {
    const { parseExcelFile: realParse } = await vi.importActual<typeof import('@/utils/excel')>(
      '@/utils/excel',
    )
    const file = fakeFile('big.xlsx', IMPORT_FILE_MAX_BYTES + 1)
    const arrayBuffer = vi.spyOn(file, 'arrayBuffer')
    await expect(realParse(file)).rejects.toThrow(IMPORT_FILE_TOO_LARGE_MESSAGE)
    expect(arrayBuffer).not.toHaveBeenCalled()
  })
})

describe('上限错误文案 i18n', () => {
  it('zh 文案含具体阈值，en 词典有对应键', () => {
    expect(IMPORT_FILE_TOO_LARGE_MESSAGE).toContain('20MB')
    expect(IMPORT_TOO_MANY_ROWS_MESSAGE).toBe('名单超过 10000 行，请拆分后再导入')
    expect(en[IMPORT_FILE_TOO_LARGE_MESSAGE]).toMatch(/20MB/)
    expect(en[IMPORT_TOO_MANY_ROWS_MESSAGE]).toMatch(/10,000 rows/)
  })
})
