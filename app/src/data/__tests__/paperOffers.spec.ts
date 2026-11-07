import { describe, expect, it } from 'vitest'

import { labelPapers } from '@/data/labelPapers'
import {
  buildCustomIntentContent,
  buildOrderIntentContent,
  bulkPackPrice,
  estimateTotal,
  paperOfferFor,
} from '@/data/paperOffers'

describe('paperOffers：纸型售卖报价', () => {
  it('每种纸型都有合法报价（包价 > 0、每包张数 > 0、材质非空）', () => {
    for (const spec of labelPapers) {
      const offer = paperOfferFor(spec)
      expect(offer.packPrice, spec.slug).toBeGreaterThan(0)
      expect(offer.sheetsPerPack, spec.slug).toBeGreaterThan(0)
      expect(offer.materials.length, spec.slug).toBeGreaterThanOrEqual(1)
      // 基准材质为第一项且无加价
      expect(offer.materials[0]!.surcharge, spec.slug).toBe(0)
    }
  })

  it('团购档按 minPacks 升序且单价递减', () => {
    for (const spec of labelPapers) {
      const { bulkTiers } = paperOfferFor(spec)
      for (let i = 1; i < bulkTiers.length; i++) {
        expect(bulkTiers[i]!.minPacks, spec.slug).toBeGreaterThan(bulkTiers[i - 1]!.minPacks)
        expect(bulkTiers[i]!.packPrice, spec.slug).toBeLessThan(bulkTiers[i - 1]!.packPrice)
      }
    }
  })

  it('bulkPackPrice 取满足条件的最高档', () => {
    const spec = labelPapers.find((p) => p.slug === 'a4-24up-round')!
    const offer = paperOfferFor(spec)
    expect(bulkPackPrice(offer, 1)).toBe(offer.packPrice)
    expect(bulkPackPrice(offer, offer.bulkTiers[0]!.minPacks)).toBe(offer.bulkTiers[0]!.packPrice)
    expect(bulkPackPrice(offer, 999)).toBe(offer.bulkTiers.at(-1)!.packPrice)
  })

  it('estimateTotal = （包价 + 材质加价）× 包数；材质未知时回退基准', () => {
    const spec = labelPapers.find((p) => p.slug === 'a4-24up-round')!
    const offer = paperOfferFor(spec)
    const matte = estimateTotal(offer, 2, 'matte')
    expect(matte.total).toBeCloseTo(offer.packPrice * 2, 5)
    const pet = estimateTotal(offer, 2, 'pet')
    expect(pet.total).toBeCloseTo((offer.packPrice + 4) * 2, 5)
    const fallback = estimateTotal(offer, 1, 'not-a-material')
    expect(fallback.material.key).toBe(offer.materials[0]!.key)
  })

  it('对折纸型用卡纸材质档（无 PET 选项）', () => {
    const folded = labelPapers.find((p) => p.fold)!
    const offer = paperOfferFor(folded)
    expect(offer.materials.every((m) => m.key !== 'pet')).toBe(true)
  })

  it('购买意向正文包含型号 / 数量 / 材质 / 估价关键信息', () => {
    const spec = labelPapers.find((p) => p.slug === 'a4-24up-round')!
    const offer = paperOfferFor(spec)
    const material = offer.materials[0]!
    const content = buildOrderIntentContent({
      spec,
      packs: 3,
      material,
      total: 26.7,
      address: '上海市杨浦区',
      note: '需要发票',
    })
    expect(content).toContain('购买意向')
    expect(content).toContain(spec.name)
    expect(content).toContain(spec.slug)
    expect(content).toContain(`${spec.labelWidth}×${spec.labelHeight}`)
    expect(content).toContain('3 包')
    expect(content).toContain(material.name)
    expect(content).toContain('¥26.7')
    expect(content).toContain('上海市杨浦区')
    expect(content).toContain('需要发票')
    expect(content.length).toBeLessThanOrEqual(2000)
  })

  it('定制需求正文包含纸型 / 用途 / 字段关键信息', () => {
    const spec = labelPapers.find((p) => p.slug === 'a4-circle-60')!
    const content = buildCustomIntentContent({
      spec,
      scenario: '烘焙店日期标签',
      fields: '品名 + 生产日期 + 保质期',
      style: '手作风',
    })
    expect(content).toContain('定制需求')
    expect(content).toContain(spec.slug)
    expect(content).toContain('烘焙店日期标签')
    expect(content).toContain('品名 + 生产日期 + 保质期')
    expect(content).toContain('手作风')
    expect(content.length).toBeLessThanOrEqual(2000)
  })
})
