// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import { findTopicPage, topicPages, topicStepsHeading, type TopicPage } from '@/data/topicPages'
import TopicLandingView from '@/views/TopicLandingView.vue'

const FOUR_STEP_PAGE: TopicPage = {
  ...topicPages[0]!,
  path: '/four-steps-fixture',
  steps: [
    { name: 'A', text: 'a' },
    { name: 'B', text: 'b' },
    { name: 'C', text: 'c' },
    { name: 'D', text: 'd' },
  ],
}

vi.mock('@/data/topicPages', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/data/topicPages')>()
  return {
    ...mod,
    findTopicPage: (path: string) => (path === '/four-steps-fixture' ? FOUR_STEP_PAGE : mod.findTopicPage(path)),
  }
})

async function mountAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: TopicLandingView }],
  })
  await router.push(path)
  await router.isReady()
  return mount(TopicLandingView, { global: { plugins: [router] } })
}

describe('第 352 轮：场景页分步标题随 steps 长度渲染', () => {
  it('topicStepsHeading：缺省按步数生成，显式 stepsHeading 优先', () => {
    expect(topicStepsHeading({ steps: [{ name: '1', text: '' }, { name: '2', text: '' }, { name: '3', text: '' }] })).toBe(
      '三步完成',
    )
    expect(topicStepsHeading({ steps: FOUR_STEP_PAGE.steps })).toBe('四步完成')
    expect(topicStepsHeading({ steps: [], stepsHeading: '怎么用' })).toBe('怎么用')
    expect(topicStepsHeading({ steps: new Array<{ name: string; text: string }>(12).fill({ name: '', text: '' }) })).toBe(
      '12 步完成',
    )
  })

  it('/desk-card-generator：3 个 step → 「三步完成」，卡片数与 steps 一致', async () => {
    const page = findTopicPage('/desk-card-generator')!
    expect(page.steps).toHaveLength(3)
    const w = await mountAt('/desk-card-generator')
    expect(w.get('[data-testid="topic-steps-heading"]').text()).toBe('三步完成')
    expect(w.findAll('h3').filter((h) => page.steps.some((s) => s.name === h.text()))).toHaveLength(3)
    expect(w.text()).not.toContain('免登录')
    expect(w.text()).not.toContain('不出浏览器')
  })

  it('4 个 step 的页面 → 「四步完成」', async () => {
    const w = await mountAt('/four-steps-fixture')
    expect(w.get('[data-testid="topic-steps-heading"]').text()).toBe('四步完成')
    expect(w.findAll('h3').filter((h) => ['A', 'B', 'C', 'D'].includes(h.text()))).toHaveLength(4)
  })

  it('全部场景页文案不含「免登录 / 一键 / 不出浏览器」口号', () => {
    const strings: string[] = []
    const walk = (v: unknown): void => {
      if (typeof v === 'string') strings.push(v)
      else if (Array.isArray(v)) v.forEach(walk)
      else if (v && typeof v === 'object') Object.values(v).forEach(walk)
    }
    walk(topicPages)
    const bad = strings.filter((s) => /免登录|一键|不出浏览器/.test(s))
    expect(bad).toEqual([])
  })
})
