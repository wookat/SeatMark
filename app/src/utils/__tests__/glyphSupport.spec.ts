import { describe, expect, it } from 'vitest'

import { findUnsupportedChars, isGlyphSupported } from '@/utils/glyphSupport'

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
})
