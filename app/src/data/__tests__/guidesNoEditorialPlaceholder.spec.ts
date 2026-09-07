import { describe, expect, it } from 'vitest'

import { guides } from '@/data/guides'

/**
 * 教程正文/摘要不得残留编辑阶段的占位符（如「【截图位建议：…】」「TODO」「待补」），
 * 这些文本会原样渲染给用户。
 */

const EDITORIAL_PLACEHOLDER_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: '【截图位建议', re: /【截图位建议/ },
  { label: '【…建议：】', re: /【[^】]*建议：[^】]*】/ },
  { label: 'TODO', re: /\bTODO\b/ },
  { label: '待补', re: /待补[充齐]?[】\]）)]/ },
  { label: '【待…】', re: /【待[^】]*】/ },
]

describe('教程内容不含编辑占位符', () => {
  it('至少有教程数据', () => {
    expect(guides.length).toBeGreaterThan(0)
  })

  for (const guide of guides) {
    it(`${guide.slug} 的 body/description 无占位符`, () => {
      const fields: Array<[string, string]> = [
        ['body', guide.body],
        ['description', guide.description],
      ]
      for (const [name, text] of fields) {
        for (const { label, re } of EDITORIAL_PLACEHOLDER_PATTERNS) {
          expect(re.test(text), `${guide.slug}.${name} 含「${label}」`).toBe(false)
        }
      }
    })
  }
})
