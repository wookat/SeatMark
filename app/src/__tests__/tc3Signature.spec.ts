/**
 * 腾讯云 TC3-HMAC-SHA256 签名对拍测试：
 * 期望值由独立的 node:crypto 参考实现按官方签名规范
 * （https://cloud.tencent.com/document/api/1288/51889）离线计算并固化，
 * 用固定输入对拍 Web Crypto 实现的输出。
 */
import { describe, expect, it } from 'vitest'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { tc3Authorization, mailChannel } from '../../../edge-functions/api/[[default]].js'

describe('tc3Authorization 固定输入对拍', () => {
  it('SendEmail Simple 正文请求签名与参考实现一致', async () => {
    const payload = JSON.stringify({
      FromEmailAddress: 'SeatMark <noreply@seatmark.cn>',
      Destination: ['user@example.com'],
      Subject: '【SeatMark 座签】登录验证码 123456',
      Simple: {
        Text: '5L2g55qE55m75b2V6aqM6K+B56CB5piv77yaMTIzNDU277yMMTAg5YiG6ZKf5YaF5pyJ5pWI44CC',
      },
    })
    const authorization = await tc3Authorization({
      secretId: 'AKID_TEST_ID',
      secretKey: 'TestSecretKey123',
      service: 'ses',
      host: 'ses.tencentcloudapi.com',
      action: 'SendEmail',
      payload,
      timestamp: 1754000000,
    })
    expect(authorization).toBe(
      'TC3-HMAC-SHA256 Credential=AKID_TEST_ID/2025-07-31/ses/tc3_request, ' +
        'SignedHeaders=content-type;host;x-tc-action, ' +
        'Signature=e40ead35428856a198f084b16349b586f8ed25666802e93f3e536e78bca789cb',
    )
  })

  it('最小 payload 请求签名与参考实现一致', async () => {
    const authorization = await tc3Authorization({
      secretId: 'AKID-EXAMPLE-ID-2',
      secretKey: 'Gu5t9xGARNpq86cd98joQYCN3EXAMPLE',
      service: 'ses',
      host: 'ses.tencentcloudapi.com',
      action: 'SendEmail',
      payload: '{"Foo":"Bar"}',
      timestamp: 1700000000,
    })
    expect(authorization).toBe(
      'TC3-HMAC-SHA256 Credential=AKID-EXAMPLE-ID-2/2023-11-14/ses/tc3_request, ' +
        'SignedHeaders=content-type;host;x-tc-action, ' +
        'Signature=c719b5e6f10dfa258345b1d6f80aff73a9f0f770764e42e0df16c85d13306689',
    )
  })
})

describe('mailChannel 发送优先级', () => {
  it('腾讯云 SES 配置齐全时优先腾讯云', () => {
    expect(
      mailChannel({
        TENCENT_SES_SECRET_ID: 'id',
        TENCENT_SES_SECRET_KEY: 'key',
        RESEND_API_KEY: 're_xxx',
      }),
    ).toBe('tencent-ses')
  })

  it('腾讯云未配置时回退 Resend', () => {
    expect(mailChannel({ RESEND_API_KEY: 're_xxx' })).toBe('resend')
    expect(mailChannel({ TENCENT_SES_SECRET_ID: 'id', RESEND_API_KEY: 're_xxx' })).toBe('resend')
  })

  it('都未配置时为 none', () => {
    expect(mailChannel({})).toBe('none')
    expect(mailChannel(undefined)).toBe('none')
  })
})
