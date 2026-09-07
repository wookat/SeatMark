// @vitest-environment jsdom
/**
 * 第 348 轮：/terms /privacy 运营主体落款不再是「【运营主体名称】」占位符，
 * 渲染文本中不得残留全角方括号占位。
 */
import { describe, expect, it } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'

import { OPERATOR_NAME } from '@/data/site'
import PrivacyView from '@/views/PrivacyView.vue'
import TermsView from '@/views/TermsView.vue'

const stubs = { RouterLink: RouterLinkStub }

describe('第 348 轮：法务页运营主体落款', () => {
  it('OPERATOR_NAME 为中性落款，不含全角方括号', () => {
    expect(OPERATOR_NAME).toBe('SeatMark 座签运营团队')
    expect(OPERATOR_NAME).not.toMatch(/[【】]/)
  })

  it('TermsView 正文含运营主体名且不含「【」「】」', () => {
    const text = mount(TermsView, { global: { stubs } }).text()
    expect(text).toContain(OPERATOR_NAME)
    expect(text).not.toContain('【')
    expect(text).not.toContain('】')
    expect(text).not.toContain('运营主体名称')
  })

  it('PrivacyView 正文含运营主体名且不含「【」「】」', () => {
    const text = mount(PrivacyView, { global: { stubs } }).text()
    expect(text).toContain(OPERATOR_NAME)
    expect(text).not.toContain('【')
    expect(text).not.toContain('】')
    expect(text).not.toContain('运营主体名称')
  })
})
