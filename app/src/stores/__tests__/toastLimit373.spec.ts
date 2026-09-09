// @vitest-environment jsdom
/**
 * 第 373 轮：toast 同屏最多 3 条——连续推 5 条只保留最后 3 条（淘汰最早），
 * 常驻（timeout 0）的提示同样参与淘汰；淘汰后的自动消失计时器不影响仍在屏的条目。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { MAX_VISIBLE_TOASTS, useToastStore } from '@/stores/toast'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
})

describe('第 373 轮：toast 数量上限', () => {
  it('MAX_VISIBLE_TOASTS = 3；连续 5 条只留最后 3 条且按推入顺序', () => {
    expect(MAX_VISIBLE_TOASTS).toBe(3)
    const store = useToastStore()
    const ids = [1, 2, 3, 4, 5].map((i) => store.push('info', `t${i}`))
    expect(store.toasts).toHaveLength(3)
    expect(store.toasts.map((t) => t.id)).toEqual(ids.slice(2))
    expect(store.toasts.map((t) => t.title)).toEqual(['t3', 't4', 't5'])
  })

  it('常驻 danger（带重试）也参与淘汰；被淘汰条目的计时器到期不误删仍在屏的条目', () => {
    const store = useToastStore()
    const sticky = store.push('danger', 'sticky', undefined, 0, { label: '重试', onClick: () => {} })
    store.push('info', 'a')
    store.push('info', 'b')
    expect(store.toasts.map((t) => t.id)).toContain(sticky)
    store.push('info', 'c')
    expect(store.toasts.map((t) => t.title)).toEqual(['a', 'b', 'c'])
    expect(store.toasts.map((t) => t.id)).not.toContain(sticky)

    // 「a」自动消失后剩两条；再推一条不触发淘汰
    vi.advanceTimersByTime(3_600)
    expect(store.toasts).toHaveLength(0)
    store.push('success', 'd')
    store.push('success', 'e')
    expect(store.toasts.map((t) => t.title)).toEqual(['d', 'e'])
  })
})
