import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { defaultTemplates } from '@/data/defaultTemplates'
import { guides } from '@/data/guides'
import { prerenderPaths, resolveSeo } from '@/data/seo'
import { templateDetails } from '@/data/templateDetails'
import { topicPages } from '@/data/topicPages'
import { vsPages } from '@/data/vsPages'
import { enTemplateDescriptions } from '@/i18n/locales/enStudioDescriptions'

/**
 * 第 349 轮：去 AI 味 / 黑话禁词护栏（覆盖清单见下方 SCOPES）。
 *
 * 禁词（营销化 / 不可验证的夸张表述）：
 *   guides 既有 7 词：一键生成、完整流程、一次讲清、全攻略、一站式、看完即可上手、不出错、保姆级
 *   本轮新增 2 词：拉满、效率翻倍
 *   第 354 轮新增：抓手、链路（内部黑话，用户文案 0 容忍）；仪式感（泛用套话，全部数据文件合计 ≤ 3，仅保留典礼/全真模拟语境）
 *   第 355 轮新增：无缝衔接、绝配、质感翻倍、上一档、最会传播口碑、柔美高级、视觉语言（营销腔），
 *       扫描范围扩到 templateDetails*.ts 的 intro/useCases/tips 与 guides*.ts 全量正文
 *   第 358 轮新增：利器、大幅提升（改为「工具」「更快」等白描）
 *
 * 例外：功能按钮名「一键生成对应桌贴」是 /seating 页真实按钮文案，教程正文/FAQ 引用该按钮名属功能说明，
 *       不在 SEO 标题 / 模板文案范围内单独禁止。
 */
const MARKETING_R355 = ['无缝衔接', '绝配', '质感翻倍', '上一档', '最会传播口碑', '柔美高级', '视觉语言']
const MARKETING_R358 = ['利器', '大幅提升']
const BANNED = ['一键生成', '完整流程', '一次讲清', '全攻略', '一站式', '看完即可上手', '不出错', '保姆级', '拉满', '效率翻倍', '抓手', '链路', ...MARKETING_R355, ...MARKETING_R358]
const NEW_THIS_ROUND = ['拉满', '效率翻倍', '抓手', '链路', ...MARKETING_R355, ...MARKETING_R358]
/** 限额词：全部数据文件（含教程正文）合计上限 */
const BUDGETED: Record<string, number> = { 仪式感: 3 }
/** 允许原样出现的功能名（按钮文案） */
const FUNCTIONAL_LABELS = ['一键生成对应桌贴']

function stripFunctional(text: string): string {
  return FUNCTIONAL_LABELS.reduce((s, label) => s.split(label).join(''), text)
}

/** 递归收集对象里所有字符串字段 */
function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectStrings(v, out))
  return out
}

function hits(strings: readonly string[], words: readonly string[] = BANNED): string[] {
  const found: string[] = []
  for (const raw of strings) {
    const s = stripFunctional(raw)
    for (const w of words) {
      if (s.includes(w)) found.push(`「${w}」← ${raw.slice(0, 60)}`)
    }
  }
  return found
}

const seos = await Promise.all((await prerenderPaths()).map((p) => resolveSeo(p)))

function readSrc(rel: string): string {
  return readFileSync(resolve(__dirname, '../..', rel), 'utf-8')
}

/** 覆盖清单：文件 → 检查口径 */
const SCOPES: Record<string, () => string[]> = {
  'data/seo.ts（全部预渲染页 title/description）': () => seos.flatMap((s) => [s.title, s.description]),
  'data/topicPages.ts（全部字段）': () => collectStrings(topicPages),
  'data/vsPages.ts（全部字段）': () => collectStrings(vsPages),
  'data/defaultTemplates*.ts（模板 name/description/演示文案）': () => collectStrings(defaultTemplates),
  'data/templateDetails*.ts（seoTitle/seoDescription/intro/useCases/tips/faqs）': () => collectStrings(templateDetails),
  'i18n/locales/enStudioDescriptions.ts（中文键，需与模板 description 同步）': () => Object.keys(enTemplateDescriptions),
  'components/label/LabelCard.vue（<template> 文案）': () => {
    const src = readSrc('components/label/LabelCard.vue')
    const tpl = src.match(/<template>([\s\S]*)<\/template>/)
    expect(tpl, 'LabelCard.vue 应有 <template>').toBeTruthy()
    return [tpl![1]!]
  },
  'data/guides*.ts（title/description）': () => guides.flatMap((g) => [g.title, g.description]),
}

describe('第 349 轮：禁词护栏（SEO / 专题 / 对比 / 模板 / 模板详情 / LabelCard / 教程摘要）', () => {
  it.each(Object.entries(SCOPES))('%s 不含禁词', (_name, collect) => {
    expect(hits(collect())).toEqual([])
  })

  it('教程正文（含 FAQ/howTo）不含新增禁词「拉满」「效率翻倍」「抓手」「链路」及第 355 轮营销腔词', () => {
    expect(hits(collectStrings(guides), NEW_THIS_ROUND)).toEqual([])
  })

  it('模板详情 intro/useCases/tips（含 Round2-4）不含第 355 / 358 轮营销腔词', () => {
    const body = templateDetails.flatMap((d) => [d.intro, ...d.useCases, ...d.tips])
    expect(body.length).toBeGreaterThan(100)
    expect(hits(body, [...MARKETING_R355, ...MARKETING_R358])).toEqual([])
  })

  it('第 358 轮：「利器」「大幅提升」已改为白描，源文件内不再出现', () => {
    for (const rel of [
      'data/defaultTemplatesEvent.ts',
      'data/templateDetailsRound2.ts',
      'data/guidesRound2.ts',
      'i18n/locales/enStudioDescriptions.ts',
    ]) {
      const src = readSrc(rel)
      for (const w of MARKETING_R358) expect(src, `${rel} 含「${w}」`).not.toContain(w)
    }
    expect(readSrc('data/guidesRound2.ts')).toContain('验收更快')
  })

  it('/templates 空态引导文案为平实说法（TemplatesView.vue 与 en.ts 同步）', () => {
    expect(readSrc('views/TemplatesView.vue')).toContain("t('没有完全匹配的，先看看这些相近模板')")
    expect(readSrc('views/TemplatesView.vue')).not.toContain('也许这些模板能满足需求')
    expect(readSrc('i18n/locales/en.ts')).toContain("'没有完全匹配的，先看看这些相近模板':")
  })

  it.each(Object.entries(BUDGETED))('限额词「%s」全部用户文案合计不超 %d 处', (word, budget) => {
    const all = [...Object.values(SCOPES).flatMap((collect) => collect()), ...collectStrings(guides)]
    const found = all.filter((s) => s.includes(word)).map((s) => s.slice(0, 60))
    expect(found.length, found.join('\n')).toBeLessThanOrEqual(budget)
  })

  it('FeedbackButton 文案用「你」不用「您」（含 en.ts 中文键）', () => {
    expect(readSrc('components/ui/FeedbackButton.vue')).not.toContain('您')
    expect(readSrc('i18n/locales/en.ts')).not.toContain('您')
  })

  it('SEO 标题里的「一键生成」已改为「生成」/具体动作；/seating 真实按钮名保留', () => {
    for (const s of seos) expect(s.title, s.title).not.toContain('一键生成')
    for (const p of topicPages) expect(p.seoTitle, p.path).not.toContain('一键生成')
    for (const v of vsPages) expect(v.seoTitle, v.slug).not.toContain('一键生成')
    expect(readSrc('views/SeatingView.vue')).toContain("tr('一键生成对应桌贴')")
  })
})
