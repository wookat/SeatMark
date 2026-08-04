// SeatMark 品牌资产生成脚本
// 用法：node brand/scripts/generate.mjs
// 生成 brand/logos/ 下各方案 SVG 与 brand/preview/ 对比页 HTML
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BRAND = '#4f46e5'
const BRAND_LIGHT = '#c7d2fe'
const INK = '#0f172a'
const FONT = "'PingFang SC','Noto Sans CJK SC','Microsoft YaHei',sans-serif"
const LATIN = "'Inter','SF Pro Display','Segoe UI',system-ui,sans-serif"

// 每个方案：mark(color, accent) 返回 64x64 viewBox 内的 SVG 内容
const directions = [
  {
    id: 'a-seatgrid',
    name: 'A · 座位格',
    desc: '考场座位表网格中定位到「你的座位」，一格高亮，直指核心场景。',
    mark: (c, a) => `
      <rect x="6" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="35" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="6" y="35" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="35" y="35" width="23" height="23" rx="6" fill="${a}"/>
      <circle cx="46.5" cy="46.5" r="4.5" fill="${c === a ? '#fff' : '#fff'}"/>`,
    markMono: (c) => `
      <rect x="6" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="35" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="6" y="35" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="35" y="35" width="23" height="23" rx="6" fill="${c}"/>
      <circle cx="46.5" cy="46.5" r="4.5" fill="#fff"/>`,
  },
  {
    id: 'b-tagcard',
    name: 'B · 标签卡',
    desc: '打孔吊牌 + 姓名行 + 照片位，覆盖座签/桌贴/证卡全品类的「标签」意象。',
    mark: (c, a) => `
      <path d="M20 4 h24 a6 6 0 0 1 6 6 v44 a6 6 0 0 1 -6 6 h-24 a6 6 0 0 1 -6 -6 v-44 a6 6 0 0 1 6 -6 z" fill="none" stroke="${c}" stroke-width="5"/>
      <circle cx="32" cy="13" r="3.2" fill="${c}"/>
      <rect x="23" y="22" width="18" height="16" rx="3" fill="${a}"/>
      <rect x="23" y="43" width="18" height="5" rx="2.5" fill="${c}"/>`,
    markMono: (c) => `
      <path d="M20 4 h24 a6 6 0 0 1 6 6 v44 a6 6 0 0 1 -6 6 h-24 a6 6 0 0 1 -6 -6 v-44 a6 6 0 0 1 6 -6 z" fill="none" stroke="${c}" stroke-width="5"/>
      <circle cx="32" cy="13" r="3.2" fill="${c}"/>
      <rect x="23" y="22" width="18" height="16" rx="3" fill="${c}" opacity="0.35"/>
      <rect x="23" y="43" width="18" height="5" rx="2.5" fill="${c}"/>`,
  },
  {
    id: 'c-tentcard',
    name: 'C · 桌牌',
    desc: '立式桌牌（席卡）正面 + 折面轮廓 + 姓名条，会议桌牌/台签场景一眼可识。',
    mark: (c, a) => `
      <path d="M14 24 L22 8 h34 a3 3 0 0 1 3 3 v13" fill="none" stroke="${c}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M10 24 h44 a4 4 0 0 1 4 4 v24 a4 4 0 0 1 -4 4 h-44 a4 4 0 0 1 -4 -4 v-24 a4 4 0 0 1 4 -4 z" fill="${a}"/>
      <rect x="15" y="33" width="26" height="5" rx="2.5" fill="#fff"/>
      <rect x="15" y="42" width="16" height="5" rx="2.5" fill="#fff" opacity="0.7"/>`,
    markMono: (c) => `
      <path d="M14 24 L22 8 h34 a3 3 0 0 1 3 3 v13" fill="none" stroke="${c}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M10 24 h44 a4 4 0 0 1 4 4 v24 a4 4 0 0 1 -4 4 h-44 a4 4 0 0 1 -4 -4 v-24 a4 4 0 0 1 4 -4 z" fill="${c}"/>
      <rect x="15" y="33" width="26" height="5" rx="2.5" fill="#fff"/>
      <rect x="15" y="42" width="16" height="5" rx="2.5" fill="#fff" opacity="0.7"/>`,
  },
  {
    id: 'd-cropmark',
    name: 'D · 裁切定位',
    desc: '印刷裁切角标包裹一枚座签卡，表达「毫米级打印精度」的工程感。',
    mark: (c, a) => `
      <path d="M6 18 v-8 a4 4 0 0 1 4 -4 h8" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/>
      <path d="M46 6 h8 a4 4 0 0 1 4 4 v8" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/>
      <path d="M58 46 v8 a4 4 0 0 1 -4 4 h-8" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/>
      <path d="M18 58 h-8 a4 4 0 0 1 -4 -4 v-8" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/>
      <rect x="17" y="21" width="30" height="22" rx="4" fill="${a}"/>
      <rect x="22" y="27" width="20" height="4" rx="2" fill="#fff"/>
      <rect x="22" y="34" width="12" height="4" rx="2" fill="#fff" opacity="0.7"/>`,
    markMono: (c) => `
      <path d="M6 18 v-8 a4 4 0 0 1 4 -4 h8" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/>
      <path d="M46 6 h8 a4 4 0 0 1 4 4 v8" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/>
      <path d="M58 46 v8 a4 4 0 0 1 -4 4 h-8" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/>
      <path d="M18 58 h-8 a4 4 0 0 1 -4 -4 v-8" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/>
      <rect x="17" y="21" width="30" height="22" rx="4" fill="${c}"/>
      <rect x="22" y="27" width="20" height="4" rx="2" fill="#fff"/>
      <rect x="22" y="34" width="12" height="4" rx="2" fill="#fff" opacity="0.7"/>`,
  },
  {
    id: 'e-seatpin',
    name: 'E · 座位定位',
    desc: '座椅侧影与定位针合体：找到座位、贴上座签，图形独占性强。',
    mark: (c, a) => `
      <path d="M32 4 c-11 0 -20 8.6 -20 19.2 c0 8 4.8 13.4 10.4 19.6 c3.4 3.7 6.6 7.6 8 13.2 a1.7 1.7 0 0 0 3.2 0 c1.4 -5.6 4.6 -9.5 8 -13.2 c5.6 -6.2 10.4 -11.6 10.4 -19.6 c0 -10.6 -9 -19.2 -20 -19.2 z" fill="${a}"/>
      <path d="M25 14 v12 h11" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M22 26 h20 v6 h-20 z" fill="#fff" rx="2"/>`,
    markMono: (c) => `
      <path d="M32 4 c-11 0 -20 8.6 -20 19.2 c0 8 4.8 13.4 10.4 19.6 c3.4 3.7 6.6 7.6 8 13.2 a1.7 1.7 0 0 0 3.2 0 c1.4 -5.6 4.6 -9.5 8 -13.2 c5.6 -6.2 10.4 -11.6 10.4 -19.6 c0 -10.6 -9 -19.2 -20 -19.2 z" fill="${c}"/>
      <path d="M25 14 v12 h11" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M22 26 h20 v6 h-20 z" fill="#fff"/>`,
  },
  {
    id: 'f-seal',
    name: 'F · 座字印',
    desc: '方形印章承载「座」字，东方印信气质，中文品牌记忆点最强。',
    mark: (c, a, dark) => `
      <rect x="6" y="6" width="52" height="52" rx="12" fill="${a}"/>
      <text x="32" y="34" text-anchor="middle" dominant-baseline="central" font-family="${FONT}" font-size="34" font-weight="700" fill="${dark ? INK : '#fff'}">座</text>`,
    markMono: (c) => `
      <rect x="6" y="6" width="52" height="52" rx="12" fill="${c}"/>
      <text x="32" y="34" text-anchor="middle" dominant-baseline="central" font-family="${FONT}" font-size="34" font-weight="700" fill="#fff">座</text>`,
  },
]

function markSvg(d, { size = 64, variant = 'color', onDark = false } = {}) {
  let inner
  if (variant === 'mono') inner = d.markMono(onDark ? '#ffffff' : INK)
  else inner = d.mark(BRAND, BRAND, onDark)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">${inner}</svg>`
}

function lockupSvg(d, { onDark = false, variant = 'color' } = {}) {
  const text = onDark ? '#ffffff' : INK
  const sub = onDark ? 'rgba(255,255,255,0.65)' : '#64748b'
  const markColor = variant === 'mono' ? (onDark ? '#ffffff' : INK) : BRAND
  const inner = variant === 'mono' ? d.markMono(markColor) : d.mark(BRAND, BRAND, onDark)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 72" width="240" height="72">
  <g transform="translate(4,4) scale(1)">${inner}</g>
  <text x="82" y="34" font-family="${FONT}" font-size="30" font-weight="700" fill="${text}">座签</text>
  <text x="82" y="58" font-family="${LATIN}" font-size="16" font-weight="600" letter-spacing="1" fill="${sub}">SeatMark</text>
</svg>`
}

mkdirSync(join(ROOT, 'logos'), { recursive: true })
mkdirSync(join(ROOT, 'preview'), { recursive: true })

for (const d of directions) {
  writeFileSync(join(ROOT, 'logos', `${d.id}-mark.svg`), markSvg(d))
  writeFileSync(join(ROOT, 'logos', `${d.id}-mark-mono.svg`), markSvg(d, { variant: 'mono' }))
  writeFileSync(join(ROOT, 'logos', `${d.id}-lockup-light.svg`), lockupSvg(d))
  writeFileSync(join(ROOT, 'logos', `${d.id}-lockup-dark.svg`), lockupSvg(d, { onDark: true }))
}

// 对比预览页
const rows = directions
  .map((d) => {
    const m = (opt) => markSvg(d, opt)
    return `<section class="row">
  <div class="meta"><h2>${d.name}</h2><p>${d.desc}</p></div>
  <div class="cells">
    <div class="cell light">${lockupSvg(d)}</div>
    <div class="cell dark">${lockupSvg(d, { onDark: true })}</div>
    <div class="cell light">${lockupSvg(d, { variant: 'mono' })}</div>
    <div class="cell light fav">
      ${m({ size: 48 })}${m({ size: 32 })}${m({ size: 24 })}${m({ size: 16 })}
      <span class="favlabel">48 / 32 / 24 / 16px</span>
    </div>
  </div>
</section>`
  })
  .join('\n')

writeFileSync(
  join(ROOT, 'preview', 'logo-comparison.html'),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>SeatMark Logo 方案对比</title>
<style>
  * { margin:0; box-sizing:border-box; }
  body { font-family:${FONT}; background:#f8fafc; color:${INK}; padding:40px; width:1360px; }
  h1 { font-size:26px; margin-bottom:6px; }
  .sub { color:#64748b; margin-bottom:28px; font-size:14px; }
  .row { display:flex; gap:20px; background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:20px; margin-bottom:16px; align-items:center; }
  .meta { width:260px; flex:none; }
  .meta h2 { font-size:17px; margin-bottom:6px; color:${BRAND}; }
  .meta p { font-size:13px; color:#64748b; line-height:1.6; }
  .cells { display:flex; gap:12px; flex:1; }
  .cell { border-radius:8px; padding:12px 16px; display:flex; align-items:center; justify-content:center; border:1px solid #e2e8f0; }
  .cell.light { background:#fff; }
  .cell.dark { background:${INK}; border-color:${INK}; }
  .cell.fav { gap:10px; flex-direction:row; position:relative; padding-bottom:26px; }
  .favlabel { position:absolute; bottom:6px; left:0; right:0; text-align:center; font-size:11px; color:#94a3b8; }
</style></head><body>
<h1>SeatMark 座签 · Logo 方案对比（6 方向）</h1>
<p class="sub">每行：亮底组合标 · 暗底组合标 · 单色版 · Favicon 缩小可用性（48/32/24/16px）。主色 indigo #4f46e5，与 DESIGN.md 一致。</p>
${rows}
</body></html>`,
)

console.log('done')
