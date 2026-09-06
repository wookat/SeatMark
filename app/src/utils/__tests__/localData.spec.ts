import { beforeEach, describe, expect, it } from 'vitest'

import { HAS_ACCOUNT_KEY } from '@/stores/auth'
import { clearLocalData, isSeatMarkStorageKey } from '@/utils/localData'

describe('clearLocalData', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('只删除本站前缀键，保留第三方键', () => {
    localStorage.setItem('seatmark.banquet-state.v1', '{}')
    localStorage.setItem('seatmark.custom-templates.v1', '[]')
    localStorage.setItem('seat-label-custom-templates', '[]')
    localStorage.setItem('_ga', 'x')
    sessionStorage.setItem('seatmark.workspace-roster.v1', '{}')
    sessionStorage.setItem('other', '1')

    expect(clearLocalData()).toBe(4)
    expect(localStorage.getItem('seatmark.banquet-state.v1')).toBeNull()
    expect(localStorage.getItem('_ga')).toBe('x')
    expect(sessionStorage.getItem('seatmark.workspace-roster.v1')).toBeNull()
    expect(sessionStorage.getItem('other')).toBe('1')
  })

  it('清除 stores/auth 的 seatmark:has-account 标记', () => {
    localStorage.setItem(HAS_ACCOUNT_KEY, '1')
    localStorage.setItem('seatmark:other-flag', '1')

    expect(clearLocalData()).toBe(2)
    expect(localStorage.getItem(HAS_ACCOUNT_KEY)).toBeNull()
    expect(localStorage.getItem('seatmark:other-flag')).toBeNull()
  })

  it('isSeatMarkStorageKey 识别前缀', () => {
    expect(isSeatMarkStorageKey('seatmark.locale')).toBe(true)
    expect(isSeatMarkStorageKey('sm-invite-ref')).toBe(true)
    expect(isSeatMarkStorageKey('seatmark:has-account')).toBe(true)
    expect(isSeatMarkStorageKey('_ga')).toBe(false)
  })
})
