/**
 * i18n 泄漏守卫：扫描应用壳层 / 核心视图 / 工坊与标签组件，找出含 CJK 但不在 t()/tr() 调用内的字面量行。
 *
 * 用法：
 *   node scripts/i18n-audit.mjs            # 打印泄漏清单，非允许项 > 0 时 exit 1
 *   import { auditI18n } from './i18n-audit.mjs'   # vitest 用例（src/__tests__/i18nAudit.spec.ts）
 *
 * 规则：
 *   - 剔除 HTML/JS 注释、console.* 行、import 行；
 *   - 剔除 t('…') / tr('…') / t(`…`) 调用中的字面量（允许跨行）；
 *   - 剔除显式的中文分支：`<template v-if="locale === 'en'">…</template><template v-else>…</template>` 的 v-else 块、
 *     `v-if="locale !== 'en'"` 元素块，以及同一行内含 `locale === 'en' ? … : …` 三元的行（已有英文分支）；
 *   - 仅统计汉字（不含 。，（）、 等 CJK 标点）；
 *   - 剩余若仍含汉字，则逐条与 ALLOWLIST 比对：允许项可整行剔除后无汉字才算放行；
 *   - KNOWN_GAP_FILES 为已知尚未英文化的文件，仅告知不计入失败。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'src')

/** 扫描范围（相对 src/） */
export const SCAN_TARGETS = [
  'App.vue',
  'views/HomeView.vue',
  'views/StudioView.vue',
  'views/PricingView.vue',
  'views/SeatingView.vue',
  'views/BanquetView.vue',
  'views/AccountView.vue',
  'views/NotFoundView.vue',
  'components/ui',
  'components/studio',
  'components/label',
]

/**
 * 已知缺口（待后续轮次英文化）：设计器三件套体量大、交互面板密集，第 340 轮暂不处理。
 * 命中这些文件的泄漏只打印 "known-gap" 提示，不计入失败。
 */
export const KNOWN_GAP_FILES = [
  'components/designer/TemplateDesigner.vue',
  'components/designer/AiDesignDialog.vue',
  'components/designer/IconPickerDialog.vue',
]

/**
 * 允许出现在源码字面量中的中文（不翻译）：
 * - 品牌名与水印文本；
 * - ICP/公安备案；
 * - 语言切换器的「中文」；
 * - 演示数据的中文列名与示例值（中文名单本就是产品输入样本）；
 * - LabelCard 内置 sample 兜底数据。
 */
export const ALLOWLIST = [
  'SeatMark 座签 · seatmark.cn',
  'SeatMark 座签',
  '座签',
  'ICP 备案',
  '备案号',
  '公安备案',
  '中文',
  '姓名',
  '考场',
  '座位号',
  '准考证号',
  '学号',
  '班级',
  '部门',
  '职务',
  '单位',
  '桌号',
  '第一考场',
  '张三',
  '李四',
  '王五',
  '一年级',
  '演示',
  // LabelCard 内置 sample 兜底数据（预览占位，非 UI 文案）
  '张同学',
  '考场-1',
  // 教室座位表交接名单的数据键与性别值（名单数据，非 UI 文案）
  '排: String(',
  '列: String(',
  "'男'",
  "'女'",
]

/** 仅汉字（不含 CJK 标点） */
const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff]/

/** 把匹配文本替换为等长空白（保留换行以维持行号） */
function blank(text) {
  return text.replace(/[^\n]/g, ' ')
}

/** 从 openIndex（指向 `<tag` 开头）找到同名标签的匹配闭合位置（返回 `</tag>` 结束的下标） */
function findClose(source, openIndex, tag) {
  const re = new RegExp(`<${tag}\\b|</${tag}>`, 'g')
  re.lastIndex = openIndex
  let depth = 0
  let m
  while ((m = re.exec(source))) {
    if (m[0].startsWith('</')) {
      depth -= 1
      if (depth === 0) return m.index + m[0].length
    } else {
      // 自闭合 <tag … /> 不计深度
      const end = source.indexOf('>', m.index)
      if (end !== -1 && source[end - 1] === '/') continue
      depth += 1
    }
  }
  return -1
}

/**
 * 剔除模板里的显式中文分支：
 * - `<template v-if="locale === 'en'">…</template>` 紧跟的 `<template v-else>…</template>`；
 * - `<x v-if="locale !== 'en'" …>…</x>` 整块。
 */
export function blankZhOnlyBranches(source) {
  let out = source
  const enIfRe = /<template\s+v-if="locale(?:\.value)? === 'en'"\s*>/g
  let m
  while ((m = enIfRe.exec(out))) {
    const closeEnd = findClose(out, m.index, 'template')
    if (closeEnd === -1) continue
    const rest = out.slice(closeEnd)
    const elseMatch = /^\s*<template\s+v-else\s*>/.exec(rest)
    if (!elseMatch) continue
    const elseStart = closeEnd + elseMatch.index + elseMatch[0].length - elseMatch[0].trimStart().length
    const elseEnd = findClose(out, elseStart, 'template')
    if (elseEnd === -1) continue
    out = out.slice(0, elseStart) + blank(out.slice(elseStart, elseEnd)) + out.slice(elseEnd)
  }
  const zhIfRe = /<([a-zA-Z][\w-]*)\b[^>]*?\sv-if="locale(?:\.value)? !== 'en'"/g
  while ((m = zhIfRe.exec(out))) {
    const closeEnd = findClose(out, m.index, m[1])
    if (closeEnd === -1) continue
    out = out.slice(0, m.index) + blank(out.slice(m.index, closeEnd)) + out.slice(closeEnd)
  }
  return out
}

/** 剔除注释、t()/tr() 字面量、中文分支后返回可扫描文本 */
export function stripTranslated(source) {
  let out = source
  // HTML 注释与 JS 块注释
  out = out.replace(/<!--[\s\S]*?-->/g, blank)
  out = out.replace(/\/\*[\s\S]*?\*\//g, blank)
  out = blankZhOnlyBranches(out)
  // t('…') / tr('…') / t("…") / t(`…`)，允许 t( 与字面量之间换行
  out = out.replace(/\b(?:t|tr)\(\s*(['"`])(?:\\.|(?!\1)[^\\])*\1/g, blank)
  return out
}

/** 单行是否应跳过（行注释 / console / import） */
function skipLine(line) {
  const trimmed = line.trim()
  if (trimmed.startsWith('//')) return true
  if (trimmed.startsWith('*')) return true
  if (/^\s*console\.\w+\(/.test(line)) return true
  if (/^\s*import\s/.test(line) || /^\s*import\(/.test(line)) return true
  return false
}

function isAllowed(line) {
  // 同一行内已有 locale 三元分支（英文分支存在）
  if (/locale(?:\.value)? [!=]== 'en'/.test(line)) return true
  let rest = line
  // 行内 // 注释（不含 URL 的 :// 场景）
  rest = rest.replace(/(^|[^:])\/\/.*$/, '$1')
  for (const item of ALLOWLIST) {
    rest = rest.split(item).join('')
  }
  return !CJK_RE.test(rest)
}

function listVueFiles(target) {
  const abs = join(srcDir, target)
  const stat = statSync(abs)
  if (stat.isFile()) return [abs]
  const out = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '__tests__') continue
        walk(full)
      } else if (entry.name.endsWith('.vue')) {
        out.push(full)
      }
    }
  }
  walk(abs)
  return out.sort()
}

/**
 * 审计单个文件：返回 { file, line, text } 泄漏列表
 */
export function auditFile(absPath) {
  const source = readFileSync(absPath, 'utf-8')
  const stripped = stripTranslated(source)
  const lines = stripped.split('\n')
  const originals = source.split('\n')
  const leaks = []
  lines.forEach((line, index) => {
    if (!CJK_RE.test(line)) return
    if (skipLine(originals[index] ?? line)) return
    if (isAllowed(line)) return
    leaks.push({
      file: relative(root, absPath),
      line: index + 1,
      text: (originals[index] ?? line).trim(),
    })
  })
  return leaks
}

/**
 * 全量审计：返回 { leaks, knownGaps }
 * - leaks：非允许项（应为 0）
 * - knownGaps：KNOWN_GAP_FILES 中的泄漏（仅告知）
 */
export function auditI18n(targets = SCAN_TARGETS) {
  const files = targets.flatMap(listVueFiles)
  const leaks = []
  for (const file of files) leaks.push(...auditFile(file))
  const knownGaps = []
  for (const gap of KNOWN_GAP_FILES) {
    const abs = join(srcDir, gap)
    try {
      knownGaps.push(...auditFile(abs))
    } catch {
      // 文件不存在则忽略
    }
  }
  return { leaks, knownGaps, scannedFiles: files.map((f) => relative(root, f)) }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const { leaks, knownGaps, scannedFiles } = auditI18n()
  console.log(`i18n-audit: scanned ${scannedFiles.length} files`)
  if (knownGaps.length) {
    const byFile = new Map()
    for (const gap of knownGaps) byFile.set(gap.file, (byFile.get(gap.file) ?? 0) + 1)
    for (const [file, count] of byFile) console.log(`  known-gap ${file}: ${count} lines (待后续轮次处理)`)
  }
  if (leaks.length === 0) {
    console.log('i18n-audit: 0 leaks')
    process.exit(0)
  }
  console.error(`i18n-audit: ${leaks.length} leak(s)`)
  for (const leak of leaks) console.error(`  ${leak.file}:${leak.line}  ${leak.text}`)
  process.exit(1)
}
