import { describe, expect, it } from 'vitest'

import { defaultTemplates } from '@/data/defaultTemplates'
import { NOVEL_STYLE_NAMES, PLAIN_NAME_POOL } from '@/data/demoDatasets'

/**
 * 内置模板示例姓名要像用户自己的名单：
 * - 不用繁体字（許長安 之类）；
 * - 不用网文风姓名（苏沐宸 / 闻人静姝 / 霍云峥 …）；婚宴雅致款最多保留 2 个 allowlist；
 * - 事件 / 会议 / 婚宴 / 生活类模板的演示数据不再出现「考场 / 准考证」考务字段。
 */

/** 繁体常用字抽样（简体名单里不该出现） */
const TRADITIONAL_RE = /[許長國學會這說們個華發經東車門馬鳥龍臺灣體點見電開關樂園書雲風]/

/** 婚宴 / 雅致款允许保留的雅致示例姓名（模板 id → 姓名），上限 2 条 */
const WEDDING_ALLOWLIST: Record<string, string> = {
  deluxeWedArch: '沈知微',
  deluxeWedBotanic: '苏浅语',
}

/** 去掉称谓 / 前缀，只留姓名本体（「陆呈之 先生」「致 江晓白」「糖糖小朋友」） */
function bareName(value: string): string {
  return value
    .replace(/^致\s*/, '')
    .replace(/\s*(先生|小姐|女士|小朋友|老师)$/, '')
    .trim()
}

const NON_EXAM_CATEGORIES = new Set(['event', 'wedding', 'life', 'kids'])
const banned = new Set(NOVEL_STYLE_NAMES)

describe('模板示例姓名普通化', () => {
  const withName = defaultTemplates.filter((t) => t.sampleData?.name)

  it('有 sampleData.name 的模板数量合理（护栏本身有效）', () => {
    expect(withName.length).toBeGreaterThan(100)
  })

  it('sampleData.name 不含繁体字符', () => {
    for (const t of withName) {
      expect(t.sampleData!.name, `${t.id} 示例姓名含繁体字`).not.toMatch(TRADITIONAL_RE)
    }
  })

  it('sampleData.name 不在网文风禁名单（婚宴 allowlist ≤ 2 例外）', () => {
    expect(Object.keys(WEDDING_ALLOWLIST).length).toBeLessThanOrEqual(2)
    for (const t of withName) {
      const raw = t.sampleData!.name
      const parts = raw.split(/\s*[·♥]\s*/).map(bareName)
      for (const p of parts) {
        if (WEDDING_ALLOWLIST[t.id] === p) {
          expect(t.category, `${t.id} allowlist 仅限婚宴类`).toBe('wedding')
          continue
        }
        expect(banned.has(p), `${t.id} 示例姓名「${p}」为网文风`).toBe(false)
      }
    }
  })

  it('婚宴 allowlist 之外的字段 sample 也不含网文风姓名', () => {
    for (const t of defaultTemplates) {
      for (const f of t.fields) {
        if (!f.sample) continue
        const parts = f.sample.split(/\s*[·♥]\s*/).map(bareName)
        for (const p of parts) {
          if (WEDDING_ALLOWLIST[t.id] === p) continue
          expect(banned.has(p), `${t.id}/${f.id} sample「${p}」为网文风`).toBe(false)
        }
      }
    }
  })

  it('替换后的常用示例姓名均来自普通姓名池', () => {
    const pool = new Set(PLAIN_NAME_POOL)
    for (const name of ['刘洋', '陈静', '徐强', '周杰', '李娜', '马超', '高翔', '胡军', '王建国', '李秀英']) {
      expect(pool.has(name), `「${name}」应在 PLAIN_NAME_POOL`).toBe(true)
    }
    const used = withName.map((t) => bareName(t.sampleData!.name.split(/\s*[·♥]\s*/)[0]!))
    const fromPool = used.filter((n) => pool.has(n)).length
    expect(fromPool).toBeGreaterThanOrEqual(40)
  })

  it('事件 / 婚宴 / 生活 / 幼儿类模板的演示数据与字段标签不含「考场 / 准考证」', () => {
    for (const t of defaultTemplates) {
      if (!t.category || !NON_EXAM_CATEGORIES.has(t.category)) continue
      const text = [
        ...Object.values(t.sampleData ?? {}),
        ...t.fields.map((f) => `${f.label ?? ''} ${f.sample ?? ''}`),
      ].join(' ')
      expect(text, `${t.id}（${t.category}）演示数据含考务字段`).not.toMatch(/考场|准考证/)
    }
  })

  it('签到桌牌版 / 半页大桌牌版 使用会议语义的会场与签到号', () => {
    const signage = defaultTemplates.find((t) => t.id === 'signage')!
    expect(signage.sampleData).toMatchObject({ room: '主会场 A 区', examId: 'A-08' })
    expect(signage.fields.find((f) => f.id === 'room')!.label).toBe('会场')
    expect(signage.fields.find((f) => f.id === 'examId')!.label).toBe('签到号')
    const deskHalf = defaultTemplates.find((t) => t.id === 'deskHalf')!
    expect(deskHalf.sampleData).toMatchObject({ room: '主会场', examId: 'B-15' })
  })
})
