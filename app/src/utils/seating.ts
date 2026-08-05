import type { DataRow } from '@/types/template'

export type SeatingGender = '男' | '女'

export interface SeatingEntry {
  name: string
  gender?: SeatingGender
}

const GENDER_TOKENS: Record<string, SeatingGender> = {
  男: '男',
  女: '女',
  m: '男',
  f: '女',
  male: '男',
  female: '女',
}

/**
 * 解析名单文本：每行一人，行内可用空格/逗号/制表符附带性别列（如「张伟 男」）。
 * 无性别列时保持旧行为：一行内多个分隔片段视为多个姓名。
 */
export function parseSeatingRoster(text: string): SeatingEntry[] {
  const out: SeatingEntry[] = []
  for (const line of text.split(/\n+/)) {
    const tokens = line
      .split(/[\s,，、;；\t]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (!tokens.length) continue
    const last = tokens[tokens.length - 1]!
    const gender = GENDER_TOKENS[last.toLowerCase()]
    if (tokens.length >= 2 && gender) {
      // 「姓名 性别」两列：仅首个片段为姓名（多余片段并入姓名，容忍复姓中间空格）
      out.push({ name: tokens.slice(0, -1).join(''), gender })
    } else {
      for (const t of tokens) out.push({ name: t })
    }
  }
  return out
}

/** Fisher–Yates 洗牌（返回新数组，不改原数组） */
export function shuffleEntries<T>(list: readonly T[], rand: () => number = Math.random): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/**
 * 男女混排：先分组各自洗牌，再从人数多的一组开始交替入座，
 * 无性别的成员洗牌后补在末尾。
 */
export function interleaveByGender(
  entries: readonly SeatingEntry[],
  rand: () => number = Math.random,
): SeatingEntry[] {
  const boys = shuffleEntries(
    entries.filter((e) => e.gender === '男'),
    rand,
  )
  const girls = shuffleEntries(
    entries.filter((e) => e.gender === '女'),
    rand,
  )
  const rest = shuffleEntries(
    entries.filter((e) => !e.gender),
    rand,
  )
  let a = boys
  let b = girls
  if (girls.length > boys.length) [a, b] = [girls, boys]
  const out: SeatingEntry[] = []
  for (let i = 0; i < a.length; i++) {
    out.push(a[i]!)
    if (i < b.length) out.push(b[i]!)
  }
  out.push(...rest)
  return out
}

/** 座位表 → 标签工坊 一键带入名单的 localStorage 暂存键 */
export const SEATING_HANDOFF_KEY = 'seatmark.seating-handoff.v1'

export interface SeatingHandoff {
  title: string
  rows: DataRow[]
}

/** 读取并清除座位表带入的名单（仅消费一次） */
export function takeSeatingHandoff(): SeatingHandoff | null {
  try {
    const raw = localStorage.getItem(SEATING_HANDOFF_KEY)
    if (!raw) return null
    localStorage.removeItem(SEATING_HANDOFF_KEY)
    const parsed = JSON.parse(raw) as SeatingHandoff
    if (!parsed || !Array.isArray(parsed.rows) || !parsed.rows.length) return null
    return parsed
  } catch {
    return null
  }
}
