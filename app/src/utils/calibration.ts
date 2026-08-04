/**
 * 打印校准：补偿打印机固有的位置偏移与缩放误差。
 * 流程：打印一页标尺校准页 → 用户量取实测值 → 反推打印机偏移/缩放 →
 * 计算补偿参数存 localStorage → 后续所有导出/打印自动应用。
 */

export interface PrintCalibration {
  /** 全局水平偏移补偿（mm，正值向右） */
  offsetX: number
  /** 全局垂直偏移补偿（mm，正值向下） */
  offsetY: number
  /** 水平缩放补偿（1 = 不缩放） */
  scaleX: number
  /** 垂直缩放补偿（1 = 不缩放） */
  scaleY: number
}

export const CALIBRATION_STORAGE_KEY = 'seatmark.print-calibration.v1'

/** 校准页基准框到纸边的名义距离（mm） */
export const CALIBRATION_FRAME_MARGIN = 20

/** 偏移补偿的合理范围（mm）：超出多半是量错了 */
export const MAX_OFFSET_MM = 15
/** 缩放补偿的合理范围：家用/办公打印机误差一般在 ±5% 内 */
export const MIN_SCALE = 0.85
export const MAX_SCALE = 1.18

export const IDENTITY_CALIBRATION: PrintCalibration = {
  offsetX: 0,
  offsetY: 0,
  scaleX: 1,
  scaleY: 1,
}

/** 校准页上用户需要量取的四个实测值（mm） */
export interface CalibrationMeasurement {
  /** 纸张左边缘到基准框左边线的实测距离 */
  left: number
  /** 纸张上边缘到基准框上边线的实测距离 */
  top: number
  /** 基准框实测宽度 */
  frameWidth: number
  /** 基准框实测高度 */
  frameHeight: number
}

/** 名义值：基准框在校准页上的设计位置与尺寸（mm） */
export function nominalFrame(paperWidth: number, paperHeight: number) {
  return {
    left: CALIBRATION_FRAME_MARGIN,
    top: CALIBRATION_FRAME_MARGIN,
    frameWidth: paperWidth - CALIBRATION_FRAME_MARGIN * 2,
    frameHeight: paperHeight - CALIBRATION_FRAME_MARGIN * 2,
  }
}

/** 结果为 0 时统一为 +0，避免 -0 造成显示与比较噪音 */
const round2dp = (v: number) => Math.round(v * 100) / 100 || 0
const round4dp = (v: number) => Math.round(v * 10000) / 10000 || 0

/**
 * 由实测值反推补偿参数。
 * 打印机变换：printed = intended × pScale + pOffset。
 * 要让最终输出等于设计值，内容需先做逆变换：
 * scale = 1 / pScale，offset = -pOffset / pScale。
 */
export function computeCalibration(
  measured: CalibrationMeasurement,
  paperWidth: number,
  paperHeight: number,
): PrintCalibration {
  const nominal = nominalFrame(paperWidth, paperHeight)
  if (
    measured.frameWidth <= 0 ||
    measured.frameHeight <= 0 ||
    nominal.frameWidth <= 0 ||
    nominal.frameHeight <= 0
  ) {
    return { ...IDENTITY_CALIBRATION }
  }
  const pScaleX = measured.frameWidth / nominal.frameWidth
  const pScaleY = measured.frameHeight / nominal.frameHeight
  const pOffsetX = measured.left - nominal.left * pScaleX
  const pOffsetY = measured.top - nominal.top * pScaleY
  return {
    offsetX: round2dp(-pOffsetX / pScaleX),
    offsetY: round2dp(-pOffsetY / pScaleY),
    scaleX: round4dp(1 / pScaleX),
    scaleY: round4dp(1 / pScaleY),
  }
}

/** 补偿参数是否在合理范围内（超出提示用户复核量取结果） */
export function isCalibrationReasonable(c: PrintCalibration): boolean {
  return (
    Math.abs(c.offsetX) <= MAX_OFFSET_MM &&
    Math.abs(c.offsetY) <= MAX_OFFSET_MM &&
    c.scaleX >= MIN_SCALE &&
    c.scaleX <= MAX_SCALE &&
    c.scaleY >= MIN_SCALE &&
    c.scaleY <= MAX_SCALE
  )
}

/** 是否与「无补偿」存在实际差异（偏移 ≥0.05mm 或缩放 ≥0.05%） */
export function isCalibrationActive(c: PrintCalibration): boolean {
  return (
    Math.abs(c.offsetX) >= 0.05 ||
    Math.abs(c.offsetY) >= 0.05 ||
    Math.abs(c.scaleX - 1) >= 0.0005 ||
    Math.abs(c.scaleY - 1) >= 0.0005
  )
}

export function loadCalibration(): PrintCalibration {
  try {
    const raw = localStorage.getItem(CALIBRATION_STORAGE_KEY)
    if (!raw) return { ...IDENTITY_CALIBRATION }
    const parsed = JSON.parse(raw) as Partial<PrintCalibration>
    const nums = [parsed.offsetX, parsed.offsetY, parsed.scaleX, parsed.scaleY]
    if (nums.some((n) => typeof n !== 'number' || !Number.isFinite(n))) {
      return { ...IDENTITY_CALIBRATION }
    }
    return {
      offsetX: parsed.offsetX as number,
      offsetY: parsed.offsetY as number,
      scaleX: parsed.scaleX as number,
      scaleY: parsed.scaleY as number,
    }
  } catch {
    return { ...IDENTITY_CALIBRATION }
  }
}

export function saveCalibration(c: PrintCalibration): void {
  try {
    localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(c))
  } catch {
    /* 存储满 / 隐私模式下静默失败 */
  }
}

export function clearCalibration(): void {
  try {
    localStorage.removeItem(CALIBRATION_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * 生成矢量标尺校准页 PDF 并触发下载：
 * 四周毫米标尺（每 1mm 一刻度，5/10mm 加长）+ 基准框 + 量取说明。
 */
export async function downloadCalibrationPdf(
  paperWidth: number,
  paperHeight: number,
): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({
    orientation: paperWidth > paperHeight ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [paperWidth, paperHeight],
  })
  const frame = nominalFrame(paperWidth, paperHeight)
  const fx = frame.left
  const fy = frame.top
  const fw = frame.frameWidth
  const fh = frame.frameHeight

  doc.setDrawColor(15, 23, 42)
  doc.setLineWidth(0.3)
  doc.rect(fx, fy, fw, fh)

  // 水平标尺（沿基准框上边线，向框内画刻度）
  doc.setLineWidth(0.15)
  doc.setFontSize(6)
  doc.setTextColor(51, 65, 85)
  for (let mm = 0; mm <= fw; mm++) {
    const x = fx + mm
    const len = mm % 10 === 0 ? 4 : mm % 5 === 0 ? 2.6 : 1.4
    doc.line(x, fy, x, fy + len)
    if (mm % 10 === 0 && mm > 0 && mm < fw) {
      doc.text(String(mm), x, fy + 6.5, { align: 'center' })
    }
  }
  // 垂直标尺（沿基准框左边线）
  for (let mm = 0; mm <= fh; mm++) {
    const y = fy + mm
    const len = mm % 10 === 0 ? 4 : mm % 5 === 0 ? 2.6 : 1.4
    doc.line(fx, y, fx + len, y)
    if (mm % 10 === 0 && mm > 0 && mm < fh) {
      doc.text(String(mm), fx + 5, y + 1, { align: 'left' })
    }
  }

  // 中心十字（辅助确认纸张对中）
  const cx = paperWidth / 2
  const cy = paperHeight / 2
  doc.setLineWidth(0.2)
  doc.line(cx - 5, cy, cx + 5, cy)
  doc.line(cx, cy - 5, cx, cy + 5)

  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42)
  doc.text('SeatMark Print Calibration', cx, cy - 24, { align: 'center' })
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  const tips = [
    `Print at 100% scale (Actual size), no margins. Paper: ${paperWidth} x ${paperHeight} mm`,
    `Frame nominal: left/top = ${frame.left} mm, width = ${fw} mm, height = ${fh} mm`,
    'Measure: paper edge to frame line (left & top), and frame width & height.',
    'Enter the 4 measured values back in SeatMark to finish calibration.',
  ]
  tips.forEach((t, i) => doc.text(t, cx, cy - 16 + i * 5, { align: 'center' }))

  doc.save(`seatmark-calibration-${paperWidth}x${paperHeight}.pdf`)
}
