import { describe, expect, it } from 'vitest'

import { matchesChineseQuery, pinyinInitial, pinyinInitials } from '@/utils/pinyin'

describe('pinyinInitial', () => {
  it('返回常见汉字的拼音首字母', () => {
    expect(pinyinInitial('监')).toBe('j')
    expect(pinyinInitial('考')).toBe('k')
    expect(pinyinInitial('证')).toBe('z')
    expect(pinyinInitial('桌')).toBe('z')
    expect(pinyinInitial('牌')).toBe('p')
    expect(pinyinInitial('座')).toBe('z')
  })

  it('英文与数字返回小写本身，其他字符返回空串', () => {
    expect(pinyinInitial('A')).toBe('a')
    expect(pinyinInitial('8')).toBe('8')
    expect(pinyinInitial(' ')).toBe('')
    expect(pinyinInitial('/')).toBe('')
  })
})

describe('pinyinInitials', () => {
  it('把整段文本转为首字母串', () => {
    expect(pinyinInitials('监考证')).toBe('jkz')
    expect(pinyinInitials('会议桌牌')).toBe('hyzp')
    expect(pinyinInitials('A4 座签')).toBe('a4zq')
  })
})

describe('matchesChineseQuery', () => {
  it('原文包含关键词时匹配', () => {
    expect(matchesChineseQuery('考场座位标签', '座位')).toBe(true)
    expect(matchesChineseQuery('考场座位标签', '桌牌')).toBe(false)
  })

  it('拼音首字母匹配', () => {
    expect(matchesChineseQuery('监考证', 'jkz')).toBe(true)
    expect(matchesChineseQuery('会议桌牌', 'zp')).toBe(true)
    expect(matchesChineseQuery('会议桌牌', 'jkz')).toBe(false)
  })

  it('空关键词视为全部匹配', () => {
    expect(matchesChineseQuery('任意文本', '')).toBe(true)
    expect(matchesChineseQuery('任意文本', '  ')).toBe(true)
  })

  it('大小写不敏感', () => {
    expect(matchesChineseQuery('监考证', 'JKZ')).toBe(true)
  })
})
