import { t } from '@/i18n'

/**
 * 模板 × 纸型适配原因的展示层翻译：
 * paperFit.ts 内保留中文原文（含尺寸/倍数插值），此处按句式提取插值后经 t() 的 {占位} 键翻译。
 * 未命中任何句式时原样返回（中文站零变化；英文站至多回退为中文原文）。
 */
const REASON_PATTERNS: Array<{ re: RegExp; key: string; slots: string[] }> = [
  {
    re: /^单格 (.+?)（(\d+) 列 × (\d+) 行）与本模板设计尺寸 (.+?) 最接近$/,
    key: '单格 {size}（{cols} 列 × {rows} 行）与本模板设计尺寸 {design} 最接近',
    slots: ['size', 'cols', 'rows', 'design'],
  },
  {
    re: /^单格 (.+?) 与模板设计尺寸 (.+?) 相近，等比微调后可用$/,
    key: '单格 {size} 与模板设计尺寸 {design} 相近，等比微调后可用',
    slots: ['size', 'design'],
  },
  {
    re: /^单格仅 (.+?)，模板需整体缩小约 (.+?) 倍，文字可能过小难以辨认$/,
    key: '单格仅 {size}，模板需整体缩小约 {k} 倍，文字可能过小难以辨认',
    slots: ['size', 'k'],
  },
  {
    re: /^单格 (.+?) 远大于模板设计尺寸 (.+?)（约放大 (.+?) 倍），版面会明显松散失真$/,
    key: '单格 {size} 远大于模板设计尺寸 {design}（约放大 {k} 倍），版面会明显松散失真',
    slots: ['size', 'design', 'k'],
  },
  {
    re: /^单格 (.+?) 与模板设计尺寸 (.+?) 差异过大$/,
    key: '单格 {size} 与模板设计尺寸 {design} 差异过大',
    slots: ['size', 'design'],
  },
  {
    re: /^单格 (.+?) 与模板设计尺寸 (.+?) 宽高比差异大，卡面会明显拉伸变形$/,
    key: '单格 {size} 与模板设计尺寸 {design} 宽高比差异大，卡面会明显拉伸变形',
    slots: ['size', 'design'],
  },
  {
    re: /^该模板为整页\/折叠设计，不适合 (\d+) 格小标签纸型$/,
    key: '该模板为整页/折叠设计，不适合 {n} 格小标签纸型',
    slots: ['n'],
  },
]

export function tFitReason(reason: string): string {
  const direct = t(reason)
  if (direct !== reason) return direct
  for (const { re, key, slots } of REASON_PATTERNS) {
    const m = re.exec(reason)
    if (!m) continue
    let out = t(key)
    if (out === key) return reason
    slots.forEach((slot, i) => {
      out = out.replace(`{${slot}}`, m[i + 1] ?? '')
    })
    return out
  }
  return reason
}
