import { describe, expect, it } from 'vitest'

import { telemetryPath } from '@/router'

describe('telemetryPath', () => {
  it('无查询串时原样返回', () => {
    expect(telemetryPath('/templates')).toBe('/templates')
    expect(telemetryPath('/')).toBe('/')
  })

  it('剥离 q 参数', () => {
    expect(telemetryPath('/templates?q=考场')).toBe('/templates')
    expect(telemetryPath('/templates?q=%E5%A9%9A%E7%A4%BC')).toBe('/templates')
  })

  it('保留其他参数', () => {
    expect(telemetryPath('/templates?cat=exam&q=考场&sub=room')).toBe(
      '/templates?cat=exam&sub=room',
    )
    expect(telemetryPath('/studio?template=standard')).toBe('/studio?template=standard')
  })

  it('保留 hash 片段', () => {
    expect(telemetryPath('/templates?q=abc#top')).toBe('/templates#top')
    expect(telemetryPath('/templates?cat=exam&q=abc#top')).toBe('/templates?cat=exam#top')
  })
})
