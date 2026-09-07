import { afterEach, describe, expect, it } from 'vitest'

import { setLocale } from '@/i18n'
import { buildSeats, type Seat, type SeatingEntry } from '@/utils/seating'
import { seatingCsvHasGender, seatingRosterCsv } from '@/utils/seatingCsv'

function lines(csv: string): string[] {
  expect(csv.startsWith('\ufeff')).toBe(true)
  expect(csv.endsWith('\r\n')).toBe(true)
  return csv.slice(1).trimEnd().split('\r\n')
}

afterEach(async () => {
  await setLocale('zh')
})

describe('seatingRosterCsv：座位清单 CSV', () => {
  it('无性别列：表头 排/列/座位号/姓名，名单不足的空座位跳过', () => {
    const entries: SeatingEntry[] = [{ name: '张伟' }, { name: '李娜' }, { name: '王芳' }]
    const seats = buildSeats(entries, 2, 2, 'rows')
    expect(seats).toHaveLength(4)
    expect(seatingCsvHasGender(seats)).toBe(false)

    const out = lines(seatingRosterCsv(seats))
    expect(out).toEqual(['排,列,座位号,姓名', '1,1,1,张伟', '1,2,2,李娜', '2,1,3,王芳'])
  })

  it('含性别列：表头追加 性别，缺性别的行留空；蛇形填充时列号跟随实际座位', () => {
    const entries: SeatingEntry[] = [{ name: '张伟', gender: '男' }, { name: '李娜', gender: '女' }, { name: '王芳' }]
    const seats = buildSeats(entries, 2, 2, 'serpentine')
    expect(seatingCsvHasGender(seats)).toBe(true)

    const out = lines(seatingRosterCsv(seats))
    expect(out[0]).toBe('排,列,座位号,姓名,性别')
    expect(out.slice(1)).toEqual(['1,1,1,张伟,男', '1,2,2,李娜,女', '2,2,3,王芳,'])
  })

  it('姓名含逗号/引号/换行时按 RFC 4180 转义', () => {
    const seats: Seat[] = [
      { row: 1, col: 1, seatNo: 1, name: 'Smith, John' },
      { row: 1, col: 2, seatNo: 2, name: '王"小"明' },
      { row: 1, col: 3, seatNo: 3, name: '李\n娜' },
      { row: 1, col: 4, seatNo: 4, name: '' },
    ]
    const out = seatingRosterCsv(seats)
    expect(out).toBe(
      '\ufeff排,列,座位号,姓名\r\n1,1,1,"Smith, John"\r\n1,2,2,"王""小""明"\r\n1,3,3,"李\n娜"\r\n',
    )
  })

  it('英文 locale：表头与性别值为英文', async () => {
    await setLocale('en')
    const seats: Seat[] = [
      { row: 1, col: 1, seatNo: 1, name: 'Amy', gender: '女' },
      { row: 1, col: 2, seatNo: 2, name: 'Bob', gender: '男' },
    ]
    const out = lines(seatingRosterCsv(seats))
    expect(out).toEqual(['Row,Column,Seat No.,Name,Gender', '1,1,1,Amy,F', '1,2,2,Bob,M'])
  })
})
