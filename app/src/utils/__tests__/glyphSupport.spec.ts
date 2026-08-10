import { describe, expect, it } from 'vitest'

import {
  findUnsupportedChars,
  findUnsupportedMinorityChars,
  isGlyphSupported,
  loadRareGlyphFonts,
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

  it('少数民族文种扫描：汉字/拉丁/韩文不进入检测，canvas 不可用时维/藏/蒙/彝不误报', () => {
    expect(findUnsupportedMinorityChars(['张伟', 'Alice', '김철수', 42, null])).toEqual([])
    expect(
      findUnsupportedMinorityChars(['ئابدۇللا', 'བསོད་ནམས', 'ꆈꌠ', 'ᠪᠠᠲᠤ']),
    ).toEqual([])
  })

  it('document.fonts 不可用时扩展字库兜底降级为原有警告（返回全部）', async () => {
    expect(await resolveWithExtendedFont(['\u{20000}'])).toEqual(['\u{20000}'])
    expect(await resolveWithExtendedFont([])).toEqual([])
  })

  it('loadRareGlyphFonts：无生僻字/无 document.fonts 时静默完成', async () => {
    await expect(loadRareGlyphFonts('张伟 Alice')).resolves.toBeUndefined()
    await expect(loadRareGlyphFonts('王\u{20000}')).resolves.toBeUndefined()
  })
})

describe('withRareCJKFallback', () => {
  it('扩展字库置于栈首（Chromium 按 FontDescription 缓存回退，其他位置对晚到分包不生效）', () => {
    expect(withRareCJKFallback("'SimSun', 'Songti SC', serif")).toBe(
      `'${RARE_CJK_FAMILY}', 'SimSun', 'Songti SC', serif`,
    )
    expect(withRareCJKFallback("'Microsoft YaHei', sans-serif")).toBe(
      `'${RARE_CJK_FAMILY}', 'Microsoft YaHei', sans-serif`,
    )
    expect(withRareCJKFallback("'SimSun'")).toBe(`'${RARE_CJK_FAMILY}', 'SimSun'`)
  })

  it('空栈返回扩展字库本身', () => {
    expect(withRareCJKFallback(undefined)).toBe(`'${RARE_CJK_FAMILY}'`)
  })

  it('已包含扩展字库的栈不重复插入', () => {
    const stack = `'${RARE_CJK_FAMILY}', 'SimSun', serif`
    expect(withRareCJKFallback(stack)).toBe(stack)
  })
})
