import { describe, expect, it } from 'vitest'

import { defaultTemplates } from '@/data/defaultTemplates'
import { en } from '@/i18n/locales/en'

/**
 * 第 367 轮：模板 description 去同构句式护栏。
 *
 * 改写前 225 条里「A + B」连缀 116 条（51.6%）、「特大字|超大字」27 条、「一眼」11 条、
 * 以「通用/醒目/皆宜/吸睛」收尾约 20 条；改写 45 条后实测为 79（35.1%）/ 9 / 0 / 7。
 * 阈值取实测值向上留约 10% 余量（方案给定：≤ 40%、≤ 15、≤ 5、≤ 10），防止后续新增模板回潮。
 */
const MAX_PLUS_RATIO = 0.4
const MAX_HUGE_FONT = 15
const MAX_AT_A_GLANCE = 5
const MAX_GENERIC_TAIL = 10

const descriptions = defaultTemplates.map((t) => t.description)

function count(re: RegExp): string[] {
  return descriptions.filter((d) => re.test(d))
}

describe('模板描述句式收敛（templateDescriptionShape）', () => {
  it('聚合到全部内置模板描述且非空', () => {
    expect(descriptions.length).toBeGreaterThan(200)
    for (const d of descriptions) expect(d.trim().length).toBeGreaterThan(10)
  })

  it(`「A + B」连缀比例 ≤ ${MAX_PLUS_RATIO * 100}%`, () => {
    const plus = count(/\+/)
    expect(plus.length / descriptions.length, plus.slice(0, 5).join('\n')).toBeLessThanOrEqual(MAX_PLUS_RATIO)
  })

  it(`含「特大字|超大字」≤ ${MAX_HUGE_FONT} 条`, () => {
    const huge = count(/特大字|超大字/)
    expect(huge.length, huge.join('\n')).toBeLessThanOrEqual(MAX_HUGE_FONT)
  })

  it(`含「一眼」≤ ${MAX_AT_A_GLANCE} 条`, () => {
    const glance = count(/一眼/)
    expect(glance.length, glance.join('\n')).toBeLessThanOrEqual(MAX_AT_A_GLANCE)
  })

  it(`以「通用/醒目/皆宜/吸睛」收尾 ≤ ${MAX_GENERIC_TAIL} 条`, () => {
    const tail = count(/(通用|醒目|皆宜|吸睛)[。！]?$/)
    expect(tail.length, tail.join('\n')).toBeLessThanOrEqual(MAX_GENERIC_TAIL)
  })

  it('每条描述都有非空英文译文，且译文不含未翻译的中文', () => {
    for (const d of descriptions) {
      const translated = en[d]
      expect(translated, d).toBeTruthy()
      expect(translated!.trim().length, d).toBeGreaterThan(10)
      expect(translated, d).not.toMatch(/[\u4e00-\u9fff]/)
    }
  })
})
