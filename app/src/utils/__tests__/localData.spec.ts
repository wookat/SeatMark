import { beforeEach, describe, expect, it } from 'vitest'

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

  it('isSeatMarkStorageKey 识别前缀', () => {
    expect(isSeatMarkStorageKey('seatmark.locale')).toBe(true)
    expect(isSeatMarkStorageKey('sm-invite-ref')).toBe(true)
    expect(isSeatMarkStorageKey('_ga')).toBe(false)
  })
})
