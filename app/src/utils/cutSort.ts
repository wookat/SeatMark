/**
 * 裁切分拣排序（摞优先）：
 * 多页标签打印后按裁切线裁开，同一版位（第 r 行第 c 列）的纸片天然叠成一摞。
 * 该排序把数据重排为「摞内连续」：裁完后每摞自上而下就是原始顺序的连续区段
 * （如第 1 摞是 1–N 号、第 2 摞是 N+1–2N 号），无需再人工分拣。
 */

import type { DataRow } from '@/types/template'

/**
 * 生成摞优先的版面索引序列。
 * 返回长度为 pageCount × perPage 的数组，第 i 个元素是该版面位置应放置的
 * 原始数据下标；空位（数据不足）为 null。
 *
 * 摞 s 的第 p 张位于第 p 页的第 s 个版位，对应原始下标 s × pageCount + p。
 */
export function stackOrderIndices(total: number, perPage: number): (number | null)[] {
  if (total <= 0 || perPage <= 0) return []
  const pageCount = Math.ceil(total / perPage)
  const slots: (number | null)[] = new Array(pageCount * perPage).fill(null)
  for (let i = 0; i < total; i++) {
    const stack = Math.floor(i / pageCount)
    const pos = i % pageCount
    slots[pos * perPage + stack] = i
  }
  return slots
}

/**
 * 按摞优先顺序重排数据行；空位以 null 占位（保持版位对齐，渲染时留白）。
 * 单页数据无需重排，原样返回。
 */
export function stackSortRows(rows: DataRow[], perPage: number): (DataRow | null)[] {
  if (perPage <= 0 || rows.length <= perPage) return rows
  return stackOrderIndices(rows.length, perPage).map((idx) => (idx == null ? null : rows[idx]!))
}
