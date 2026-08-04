import { describe, expect, it } from 'vitest'

import {
  computeCalibration,
  IDENTITY_CALIBRATION,
  isCalibrationActive,
  isCalibrationReasonable,
  loadCalibration,
  nominalFrame,
  saveCalibration,
} from '@/utils/calibration'

const A4 = { w: 210, h: 297 }

describe('computeCalibration 偏移/缩放补偿计算', () => {
  it('实测值与名义值一致时补偿为恒等（无偏移、无缩放）', () => {
    const nominal = nominalFrame(A4.w, A4.h)
    const c = computeCalibration(nominal, A4.w, A4.h)
    expect(c).toEqual(IDENTITY_CALIBRATION)
    expect(isCalibrationActive(c)).toBe(false)
  })

  it('纯偏移：打印整体右移 2mm 下移 3mm 时，补偿为反向偏移', () => {
    const nominal = nominalFrame(A4.w, A4.h)
    const c = computeCalibration(
      {
        left: nominal.left + 2,
        top: nominal.top + 3,
        frameWidth: nominal.frameWidth,
        frameHeight: nominal.frameHeight,
      },
      A4.w,
      A4.h,
    )
    expect(c.offsetX).toBeCloseTo(-2, 2)
    expect(c.offsetY).toBeCloseTo(-3, 2)
    expect(c.scaleX).toBeCloseTo(1, 4)
    expect(c.scaleY).toBeCloseTo(1, 4)
  })

  it('纯缩放：打印机整体缩小 2% 时，补偿缩放为约 1/0.98', () => {
    const nominal = nominalFrame(A4.w, A4.h)
    const c = computeCalibration(
      {
        left: nominal.left * 0.98,
        top: nominal.top * 0.98,
        frameWidth: nominal.frameWidth * 0.98,
        frameHeight: nominal.frameHeight * 0.98,
      },
      A4.w,
      A4.h,
    )
    expect(c.scaleX).toBeCloseTo(1 / 0.98, 3)
    expect(c.scaleY).toBeCloseTo(1 / 0.98, 3)
    expect(c.offsetX).toBeCloseTo(0, 1)
    expect(c.offsetY).toBeCloseTo(0, 1)
  })

  it('偏移叠加缩放：补偿后名义点经打印机变换应回到设计位置', () => {
    // 模拟打印机：printed = intended * pScale + pOffset
    const pScaleX = 1.015
    const pScaleY = 0.99
    const pOffsetX = 1.6
    const pOffsetY = -2.2
    const nominal = nominalFrame(A4.w, A4.h)
    const measured = {
      left: nominal.left * pScaleX + pOffsetX,
      top: nominal.top * pScaleY + pOffsetY,
      frameWidth: nominal.frameWidth * pScaleX,
      frameHeight: nominal.frameHeight * pScaleY,
    }
    const c = computeCalibration(measured, A4.w, A4.h)
    // 任取一个设计坐标，先应用补偿再过打印机，应基本等于设计值
    const intended = 100
    const compensated = intended * c.scaleX + c.offsetX
    const printed = compensated * pScaleX + pOffsetX
    expect(printed).toBeCloseTo(intended, 1)
    const compensatedY = intended * c.scaleY + c.offsetY
    expect(compensatedY * pScaleY + pOffsetY).toBeCloseTo(intended, 1)
  })

  it('非法实测值（框宽/高 <= 0）时回落恒等补偿', () => {
    const c = computeCalibration({ left: 20, top: 20, frameWidth: 0, frameHeight: -5 }, A4.w, A4.h)
    expect(c).toEqual(IDENTITY_CALIBRATION)
  })
})

describe('isCalibrationReasonable 合理范围校验', () => {
  it('常见误差范围内为合理', () => {
    expect(
      isCalibrationReasonable({ offsetX: -2, offsetY: 3.5, scaleX: 1.02, scaleY: 0.985 }),
    ).toBe(true)
  })

  it('偏移超 15mm 或缩放超范围时不合理', () => {
    expect(isCalibrationReasonable({ offsetX: 20, offsetY: 0, scaleX: 1, scaleY: 1 })).toBe(false)
    expect(isCalibrationReasonable({ offsetX: 0, offsetY: 0, scaleX: 1.3, scaleY: 1 })).toBe(false)
    expect(isCalibrationReasonable({ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 0.7 })).toBe(false)
  })
})

describe('localStorage 持久化', () => {
  it('保存后可读回；损坏数据回落恒等补偿', () => {
    const c = { offsetX: -1.5, offsetY: 2, scaleX: 1.01, scaleY: 0.995 }
    saveCalibration(c)
    expect(loadCalibration()).toEqual(c)

    localStorage.setItem('seatmark.print-calibration.v1', '{broken')
    expect(loadCalibration()).toEqual(IDENTITY_CALIBRATION)

    localStorage.setItem('seatmark.print-calibration.v1', JSON.stringify({ offsetX: 'x' }))
    expect(loadCalibration()).toEqual(IDENTITY_CALIBRATION)
  })
})
