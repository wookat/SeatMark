/**
 * 从仓库 git 历史生成 src/data/changelog.ts ——「更新记录」页的数据源。
 *
 * 用法：npm run changelog（在 app/ 下执行，或仓库任意位置 node scripts/gen-changelog.mjs）
 *
 * 选取规则（与提交约定对齐）：
 * - 仅 conventional commit：feat → feature / fix → fix / perf|refactor → improve
 * - chore/diag/debug/docs/test/build/ci/merge/revert 等维护性提交不进更新记录
 * - 去掉 (rev rNNN)、(#NNN) 这类流水线/PR 尾注
 * - 按提交日期（YYYY-MM-DD，新→旧）分组；数据文件随仓库提交，CI 无需 git 环境
 */
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFileSync } from 'node:fs'

const appDir = dirname(fileURLToPath(import.meta.url)) + '/..'

const TYPE_MAP = { feat: 'feature', fix: 'fix', perf: 'improve', refactor: 'improve' }

// execFile 直传参数：Windows cmd 会把 %ad 当变量展开，不能走 shell 字符串
const raw = execFileSync(
  'git',
  ['log', '--no-merges', '--pretty=format:%h|%ad|%s', '--date=short'],
  { cwd: appDir, encoding: 'utf-8' },
)

const days = new Map() // date -> entries[]
for (const line of raw.split('\n')) {
  const [hash, date, ...rest] = line.split('|')
  const subject = rest.join('|').trim()
  const m = /^(feat|fix|perf|refactor)(?:\([^)]*\))?!?:\s*(.+)$/.exec(subject)
  if (!m) continue
  const text = m[2].replace(/\s*\((?:rev\s+r?\d+|#\d+)\)\s*$/g, '').trim()
  if (!text) continue
  if (!days.has(date)) days.set(date, [])
  days.get(date).push({ hash, kind: TYPE_MAP[m[1]], text })
}

const sorted = [...days.entries()].sort(([a], [b]) => b.localeCompare(a))
const total = sorted.reduce((n, [, entries]) => n + entries.length, 0)

const body = sorted
  .map(
    ([date, entries]) =>
      `  {\n    date: '${date}',\n    entries: [\n${entries
        .map((e) => `      { hash: '${e.hash}', kind: '${e.kind}', text: ${JSON.stringify(e.text)} },`)
        .join('\n')}\n    ],\n  },`,
  )
  .join('\n')

const out = `/**
 * 「更新记录」数据 —— 由 scripts/gen-changelog.mjs 依据 git 提交历史生成，请勿手改。
 * 重新生成：npm run changelog（需要本地有 git 历史；CI/生产直接读取本文件快照）。
 */

export type ChangelogKind = 'feature' | 'fix' | 'improve'

export interface ChangelogEntry {
  /** 提交短哈希（仅作溯源标识，不保证公开仓库可见） */
  hash: string
  kind: ChangelogKind
  text: string
}

export interface ChangelogDay {
  date: string
  entries: ChangelogEntry[]
}

export const CHANGELOG_GENERATED_AT = '${new Date().toISOString().slice(0, 10)}'
export const CHANGELOG_ENTRY_COUNT = ${total}

export const changelogDays: ChangelogDay[] = [
${body}
]
`

const target = join(appDir, 'src/data/changelog.ts')
writeFileSync(target, out)
console.log(`changelog.ts written: ${sorted.length} days, ${total} entries`)
