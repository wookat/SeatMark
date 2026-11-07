import { sheetKeyOf, type LabelPaperSpec } from './labelPapers'

/**
 * 纸型售卖报价（购买意向参考价，非在线收款）。
 *
 * 定价模型按纸面尺寸分档 + 材质加价 + 团购折扣，与市面主流
 * 不干胶电商（汉唐/鸿诺/龙诚海等 20–50 张 ¥5–15）口径一致；
 * 对折压痕卡、圆形模切为工艺价。真实成交价以客服确认为准，
 * 意向单走 /api/feedback 通道（企业微信实时推送 + admin 存档）。
 */

export interface PaperMaterial {
  key: string
  name: string
  /** 每包加价（元）；0 为基准材质 */
  surcharge: number
}

export interface BulkTier {
  /** 达到该包数起享此单价 */
  minPacks: number
  /** 折后每包价（元，相对基准材质） */
  packPrice: number
}

export interface PaperOffer {
  /** 每包张数 */
  sheetsPerPack: number
  /** 基准材质每包价（元） */
  packPrice: number
  /** 团购档（按 minPacks 升序） */
  bulkTiers: BulkTier[]
  /** 可选材质（第一项为基准） */
  materials: PaperMaterial[]
}

/** 常规材质选项：铜版纸哑面为基准价 */
const STANDARD_MATERIALS: PaperMaterial[] = [
  { key: 'matte', name: '铜版纸哑面（常用）', surcharge: 0 },
  { key: 'kraft', name: '牛皮纸（复古手写）', surcharge: 2 },
  { key: 'glossy', name: '镜面铜版纸（亮色）', surcharge: 2 },
  { key: 'pet', name: '防水合成纸（PET）', surcharge: 4 },
]

/** 对折卡纸材质（压痕卡纸，不做 PET） */
const FOLD_MATERIALS: PaperMaterial[] = [
  { key: 'matte', name: '厚卡纸哑面（常用）', surcharge: 0 },
  { key: 'kraft', name: '牛皮卡纸', surcharge: 3 },
  { key: 'pearl', name: '珠光卡纸（婚宴常用）', surcharge: 5 },
]

/** 各纸面尺寸的默认报价 */
const SHEET_OFFERS: Record<string, Omit<PaperOffer, 'materials'>> = {
  A4: {
    sheetsPerPack: 20,
    packPrice: 9.9,
    bulkTiers: [
      { minPacks: 5, packPrice: 8.9 },
      { minPacks: 20, packPrice: 7.5 },
    ],
  },
  A3: {
    sheetsPerPack: 10,
    packPrice: 15.9,
    bulkTiers: [
      { minPacks: 5, packPrice: 14.5 },
      { minPacks: 20, packPrice: 12.9 },
    ],
  },
  A5: {
    sheetsPerPack: 30,
    packPrice: 9.9,
    bulkTiers: [
      { minPacks: 5, packPrice: 8.9 },
      { minPacks: 20, packPrice: 7.5 },
    ],
  },
  'US Letter': {
    sheetsPerPack: 20,
    packPrice: 12.9,
    bulkTiers: [
      { minPacks: 5, packPrice: 11.9 },
      { minPacks: 20, packPrice: 9.9 },
    ],
  },
}

/** 特殊工艺覆写：对折压痕卡、大圆贴 */
const SPECIAL_OFFERS: Record<string, Partial<Omit<PaperOffer, 'materials'>>> = {
  // 对折压痕席卡纸：厚卡 + 预压痕工艺，量少价高
  'avery-5302': { sheetsPerPack: 25, packPrice: 29.9 },
  'avery-5305': { sheetsPerPack: 25, packPrice: 32.9 },
  'avery-5309': { sheetsPerPack: 25, packPrice: 32.9 },
  // Φ119 大圆贴模切损耗大
  'a4-circle-119': { sheetsPerPack: 20, packPrice: 12.9 },
}

/** 纸型报价：按纸面尺寸取默认档，特殊工艺覆写 */
export function paperOfferFor(spec: LabelPaperSpec): PaperOffer {
  const base = SHEET_OFFERS[sheetKeyOf(spec)] ?? SHEET_OFFERS.A4!
  const override = SPECIAL_OFFERS[spec.slug] ?? {}
  return {
    ...base,
    ...override,
    materials: spec.fold ? FOLD_MATERIALS : STANDARD_MATERIALS,
  }
}

/** 数量对应的每包价：取满足 minPacks 的最高档 */
export function bulkPackPrice(offer: PaperOffer, packs: number): number {
  let price = offer.packPrice
  for (const tier of offer.bulkTiers) {
    if (packs >= tier.minPacks) price = tier.packPrice
  }
  return price
}

/** 估算合计：包价 + 材质加价（材质加价不打折） */
export function estimateTotal(
  offer: PaperOffer,
  packs: number,
  materialKey: string,
): { packPrice: number; material: PaperMaterial; total: number } {
  const material = offer.materials.find((m) => m.key === materialKey) ?? offer.materials[0]!
  const packPrice = bulkPackPrice(offer, packs)
  return {
    packPrice,
    material,
    total: Math.round((packPrice + material.surcharge) * packs * 10) / 10,
  }
}

/** 购买意向单正文：提交 /api/feedback 的 content 字段（结构化文本，客服按行解析） */
export function buildOrderIntentContent(input: {
  spec: LabelPaperSpec
  packs: number
  material: PaperMaterial
  total: number
  address?: string
  note?: string
}): string {
  const { spec, packs, material, total } = input
  return [
    '【购买意向】不干胶纸型',
    `型号：${spec.name}（${spec.slug}）`,
    `规格：${spec.labelWidth}×${spec.labelHeight} mm · 每页 ${spec.cols * spec.rows} 枚`,
    `数量：${packs} 包`,
    `材质：${material.name}`,
    `估价：¥${total}（以客服确认为准，含运费另计）`,
    input.address ? `收货：${input.address}` : '',
    input.note ? `备注：${input.note}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/** 定制需求单正文：按纸型定制模板服务 */
export function buildCustomIntentContent(input: {
  spec: LabelPaperSpec
  scenario: string
  fields: string
  style?: string
  note?: string
}): string {
  return [
    '【定制需求】按纸型设计模板',
    `纸型：${input.spec.name}（${input.spec.slug}）`,
    `规格：${input.spec.labelWidth}×${input.spec.labelHeight} mm · 每页 ${input.spec.cols * input.spec.rows} 枚`,
    `用途：${input.scenario}`,
    `字段：${input.fields}`,
    input.style ? `风格：${input.style}` : '',
    input.note ? `备注：${input.note}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}
