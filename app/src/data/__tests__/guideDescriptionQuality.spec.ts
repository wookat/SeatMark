/**
 * 第 348 轮：教程 description 去脚手架套话。
 * 全部 description 中「本文」≤ 35、「怎么办」≤ 45；相邻 10 篇中同一开头句式（前 2 字）≤ 3 篇；
 * /guides 列表首屏（前 12 篇）不含「本文讲清」；本轮改写的 24 篇长度 60–110 且不含「本文」。
 */
import { describe, expect, it } from 'vitest'

import { guides } from '@/data/guides'

const count = (text: string, word: string) => text.split(word).length - 1

const REWRITTEN_348 = [
  'a4-seat-card-size-layout',
  'photo-verification-label',
  'wps-word-mail-merge-vs-online',
  'label-print-troubleshooting',
  'online-label-tools-review',
  'class-teacher-exam-workflow',
  'training-institution-materials',
  'exam-room-door-sign',
  'admission-ticket-batch-print',
  'exam-roll-call-sheet',
  'gaokao-zhongkao-desk-label-specs',
  'cet-exam-room-setup',
  'kaoyan-exam-room-materials',
  'exam-seating-arrangement-rules',
  'final-exam-materials-timeline',
  'exam-system-vs-seatmark',
  'hotel-wedding-place-card-setup',
  'desk-card-etiquette-seating',
  'eink-800x480-desk-card',
  'hr-annual-meeting-materials',
  'badge-visitor-card-batch',
  'browser-print-vs-pdf-export',
  'batch-photo-naming-guide',
  'print-offset-calibration-wizard',
]

describe('教程 description 套话收敛', () => {
  it('「本文」合计 ≤ 35、「怎么办」合计 ≤ 45', () => {
    const all = guides.map((g) => g.description).join('\n')
    expect(count(all, '本文')).toBeLessThanOrEqual(35)
    expect(count(all, '怎么办')).toBeLessThanOrEqual(45)
  })

  it('相邻 10 篇中同一开头句式（前 2 字）不超过 3 篇', () => {
    const opening = (d: string) => Array.from(d).slice(0, 2).join('')
    for (let i = 0; i + 10 <= guides.length; i++) {
      const window = guides.slice(i, i + 10)
      const tally = new Map<string, number>()
      for (const g of window)
        tally.set(opening(g.description), (tally.get(opening(g.description)) ?? 0) + 1)
      for (const [key, n] of tally) {
        expect(n, `第 ${i}-${i + 9} 篇开头「${key}」重复 ${n} 次`).toBeLessThanOrEqual(3)
      }
    }
  })

  it('/guides 列表首屏前 12 篇 description 不含「本文讲清」', () => {
    for (const g of guides.slice(0, 12)) {
      expect(g.description, g.slug).not.toContain('本文讲清')
    }
  })

  it('本轮改写的 24 篇：存在、长度 60–110、不含「本文」「怎么办」「一键」「几分钟」', () => {
    expect(new Set(REWRITTEN_348).size).toBe(24)
    for (const slug of REWRITTEN_348) {
      const g = guides.find((x) => x.slug === slug)
      expect(g, slug).toBeTruthy()
      const d = g!.description
      expect(d.length, `${slug} 长度 ${d.length}`).toBeGreaterThanOrEqual(60)
      expect(d.length, `${slug} 长度 ${d.length}`).toBeLessThanOrEqual(110)
      for (const banned of [
        '本文',
        '怎么办',
        '一键',
        '几分钟',
        '思路很简单',
        '一次讲清',
        '完整流程',
        '全攻略',
        '不出错',
        '保姆级',
      ]) {
        expect(d, `${slug} 含「${banned}」`).not.toContain(banned)
      }
    }
  })
})
