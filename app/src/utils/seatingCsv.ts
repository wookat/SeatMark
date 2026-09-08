import { currentLocale, t } from '@/i18n'

import type { Seat, SeatingEntry } from './seating'

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** 名单里任一已就座学生带性别时才输出「性别」列 */
export function seatingCsvHasGender(seats: readonly Seat[]): boolean {
  return seats.some((s) => s.name && s.gender)
}

/** 表头按 locale 固定（共享键「排/列」在英文里是 rows/cols 计数语境，不适合做列名） */
function csvHeader(withGender: boolean): string[] {
  const header =
    currentLocale() === 'en' ? ['Row', 'Column', 'Seat No.', 'Name'] : ['排', '列', '座位号', '姓名']
  if (withGender) header.push(currentLocale() === 'en' ? 'Gender' : '性别')
  return header
}

/** 「未排座」段表头：序号/姓名[/性别] */
function unseatedHeader(withGender: boolean): string[] {
  const header = currentLocale() === 'en' ? ['No.', 'Name'] : ['序号', '姓名']
  if (withGender) header.push(currentLocale() === 'en' ? 'Gender' : '性别')
  return header
}

/**
 * 座位清单 CSV（UTF-8 BOM，CRLF，列：排/列/座位号/姓名[/性别]），与宴会「按桌名单 .csv」同口径。
 * 空座位（名单不足留空的位）不输出；人数超过座位数时在末尾追加空行 + 「未排座」段（序号/姓名[/性别]），
 * 不超员时无该段；全程浏览器本地生成。
 */
export function seatingRosterCsv(seats: readonly Seat[], unseated: readonly SeatingEntry[] = []): string {
  const withGender = seatingCsvHasGender(seats) || unseated.some((e) => e.name && e.gender)
  const lines = [csvHeader(withGender).join(',')]
  for (const seat of seats) {
    if (!seat.name) continue
    const cells = [String(seat.row), String(seat.col), String(seat.seatNo), seat.name]
    if (withGender) cells.push(seat.gender ? t(seat.gender) : '')
    lines.push(cells.map(csvCell).join(','))
  }
  const pending = unseated.filter((e) => e.name)
  if (pending.length) {
    lines.push('', csvCell(t('未排座')), unseatedHeader(withGender).join(','))
    pending.forEach((entry, i) => {
      const cells = [String(i + 1), entry.name]
      if (withGender) cells.push(entry.gender ? t(entry.gender) : '')
      lines.push(cells.map(csvCell).join(','))
    })
  }
  return '\ufeff' + lines.join('\r\n') + '\r\n'
}
