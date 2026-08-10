import { describe, expect, it } from 'vitest'

import {
  findUnsupportedChars,
  isGlyphSupported,
  resolveWithExtendedFont,
} from '@/utils/glyphSupport'
import { withRareCJKFallback, RARE_CJK_FAMILY } from '@/data/fonts'

// jsdom 无 canvas 实现：检测应 fail-safe 按「有字形」处理，不误报
describe('glyphSupport', () => {
  it('常用汉字/字母不进入检测，永远不报缺字', () => {
    expect(findUnsupportedChars(['张伟', 'Alice', '第3组', '欧阳先生'])).toEqual([])
  })

  it('非字符串值被跳过', () => {
    expect(findUnsupportedChars([42, null, undefined, {}])).toEqual([])
  })

  it('canvas 不可用时生僻字按有字形处理（不误报）', () => {
    expect(isGlyphSupported('\u{20000}')).toBe(true)
    expect(findUnsupportedChars(['\u{20000}\u{2A6D6}'])).toEqual([])
  })

  it('重复出现的生僻字只检测一次（去重）', () => {
    const chars = findUnsupportedChars(['㐀㐀㐀', '㐀'])
    expect(chars.length).toBeLessThanOrEqual(1)
  })

  it('document.fonts 不可用时扩展字库兜底降级为原有警告（返回全部）', async () => {
    expect(await resolveWithExtendedFont(['\u{20000}'])).toEqual(['\u{20000}'])
    expect(await resolveWithExtendedFont([])).toEqual([])
  })
})

describe('withRareCJKFallback', () => {
  it('扩展字库插在首个通用字族关键字之前（否则永远不生效）', () => {
    expect(withRareCJKFallback("'SimSun', 'Songti SC', serif")).toBe(
      `'SimSun', 'Songti SC', '${RARE_CJK_FAMILY}', serif`,
    )
    expect(withRareCJKFallback("'Microsoft YaHei', sans-serif")).toBe(
      `'Microsoft YaHei', '${RARE_CJK_FAMILY}', sans-serif`,
    )
  })

  it('栈中无通用字族时追加到末尾；空栈返回扩展字库本身', () => {
    expect(withRareCJKFallback("'SimSun'")).toBe(`'SimSun', '${RARE_CJK_FAMILY}'`)
    expect(withRareCJKFallback(undefined)).toBe(`'${RARE_CJK_FAMILY}'`)
  })

  it('已包含扩展字库的栈不重复插入', () => {
    const stack = `'SimSun', '${RARE_CJK_FAMILY}', serif`
    expect(withRareCJKFallback(stack)).toBe(stack)
  })
})
