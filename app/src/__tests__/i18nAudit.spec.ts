import { describe, expect, it } from 'vitest'

// @ts-expect-error 纯 ESM 脚本，无类型声明；与 node scripts/i18n-audit.mjs 共用同一实现
import { auditI18n, blankZhOnlyBranches, stripTranslated } from '../../scripts/i18n-audit.mjs'

interface Leak {
  file: string
  line: number
  text: string
}

interface AuditResult {
  leaks: Leak[]
  knownGaps: Leak[]
  scannedFiles: string[]
}

/**
 * i18n 泄漏守卫：壳层 / 核心视图 / 工坊与标签组件中不允许出现未经 t() 包裹的中文字面量
 *（允许清单与 known-gap 见 scripts/i18n-audit.mjs）。
 */
describe('i18n 泄漏守卫', () => {
  it('t()/tr() 字面量与注释被剔除，裸中文保留', () => {
    const src = [
      "const a = t('已保存')",
      "const b = tr(\"名单为空\")",
      'const c = t(`多行',
      '  文案`)',
      '// 注释 中文',
      '/* 块注释 中文 */',
      "const d = '泄漏'",
    ].join('\n')
    const out = (stripTranslated as (s: string) => string)(src)
    expect(out).not.toContain('已保存')
    expect(out).not.toContain('名单为空')
    expect(out).not.toContain('多行')
    expect(out).not.toContain('块注释')
    expect(out).toContain('泄漏')
    expect(out.split('\n')).toHaveLength(src.split('\n').length)
  })

  it('显式中文分支（v-if locale / v-else）被剔除', () => {
    const src = [
      '<p>',
      '  <template v-if="locale === \'en\'">English copy</template>',
      '  <template v-else>中文文案</template>',
      '</p>',
      '<div v-if="locale !== \'en\'" class="x">',
      '  <span>仅中文</span>',
      '</div>',
      '<span>裸中文</span>',
    ].join('\n')
    const out = (blankZhOnlyBranches as (s: string) => string)(src)
    expect(out).not.toContain('中文文案')
    expect(out).not.toContain('仅中文')
    expect(out).toContain('English copy')
    expect(out).toContain('裸中文')
  })

  it('扫描范围内非允许项为 0（逐行打印 文件:行号）', () => {
    const { leaks, scannedFiles } = (auditI18n as () => AuditResult)()
    expect(scannedFiles.length).toBeGreaterThan(20)
    const report = leaks.map((l) => `${l.file}:${l.line}  ${l.text}`).join('\n')
    expect(leaks, `i18n 泄漏 ${leaks.length} 条：\n${report}`).toEqual([])
  })
})
