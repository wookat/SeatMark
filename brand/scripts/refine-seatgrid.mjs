// SeatMark 方案 A「座位格」精修变体生成脚本
// 用法：node brand/scripts/refine-seatgrid.mjs
// 生成 brand/preview/refine-seatgrid/ 下各变体 SVG 与 brand/preview/logo-refine-a.html 对比页
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BRAND = '#4f46e5'
const BRAND_100 = '#e0e7ff'
const INK = '#0f172a'
const FONT = "'PingFang SC','Noto Sans CJK SC','Microsoft YaHei',sans-serif"
const LATIN = "'Inter','SF Pro Display','Segoe UI',system-ui,sans-serif"

// 每个变体：mark(color, accent) 返回 64x64 viewBox 内的 SVG 内容；markMono(color) 同理
const variants = [
  {
    id: 'v0-control',
    name: 'A0 · 现行版',
    desc: '当前线上版本，作对照基线。2×2 描边格 + 右下实心格白点。',
    mark: (c, a) => `
      <rect x="6" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="35" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="6" y="35" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="35" y="35" width="23" height="23" rx="6" fill="${a}"/>
      <circle cx="46.5" cy="46.5" r="4.5" fill="#fff"/>`,
    markMono: (c) => `
      <rect x="6" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="35" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="6" y="35" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="35" y="35" width="23" height="23" rx="6" fill="${c}"/>
      <circle cx="46.5" cy="46.5" r="4.5" fill="#fff"/>`,
  },
  {
    id: 'v1-polished',
    name: 'A1 · 精修',
    desc: '原版光学修正：描边 5→4.5、格距 6→8 更透气、圆角 6→5.5、白点光学居中。变化最小。',
    mark: (c, a) => `
      <rect x="6" y="6" width="22" height="22" rx="5.5" fill="none" stroke="${c}" stroke-width="4.5"/>
      <rect x="36" y="6" width="22" height="22" rx="5.5" fill="none" stroke="${c}" stroke-width="4.5"/>
      <rect x="6" y="36" width="22" height="22" rx="5.5" fill="none" stroke="${c}" stroke-width="4.5"/>
      <rect x="36" y="36" width="22" height="22" rx="5.5" fill="${a}"/>
      <circle cx="47" cy="47" r="4.2" fill="#fff"/>`,
    markMono: (c) => `
      <rect x="6" y="6" width="22" height="22" rx="5.5" fill="none" stroke="${c}" stroke-width="4.5"/>
      <rect x="36" y="6" width="22" height="22" rx="5.5" fill="none" stroke="${c}" stroke-width="4.5"/>
      <rect x="6" y="36" width="22" height="22" rx="5.5" fill="none" stroke="${c}" stroke-width="4.5"/>
      <rect x="36" y="36" width="22" height="22" rx="5.5" fill="${c}"/>
      <circle cx="47" cy="47" r="4.2" fill="#fff"/>`,
  },
  {
    id: 'v2-chart9',
    name: 'A2 · 座位表',
    desc: '3×3 真实考场座位表网格，中心座位高亮。彻底脱离 2×2「应用菜单」通用感，品类语义最强。',
    mark: (c, a) => {
      const cells = []
      for (let r = 0; r < 3; r++)
        for (let col = 0; col < 3; col++) {
          const x = 4.5 + col * 20, y = 4.5 + r * 20
          if (r === 1 && col === 1) continue
          cells.push(`<rect x="${x}" y="${y}" width="15" height="15" rx="3" fill="none" stroke="${c}" stroke-width="3.5"/>`)
        }
      cells.push(`<rect x="24.5" y="24.5" width="15" height="15" rx="3" fill="${a}"/>`)
      cells.push(`<circle cx="32" cy="32" r="3" fill="#fff"/>`)
      return '\n      ' + cells.join('\n      ')
    },
    markMono: (c) => {
      const cells = []
      for (let r = 0; r < 3; r++)
        for (let col = 0; col < 3; col++) {
          const x = 4.5 + col * 20, y = 4.5 + r * 20
          if (r === 1 && col === 1) continue
          cells.push(`<rect x="${x}" y="${y}" width="15" height="15" rx="3" fill="none" stroke="${c}" stroke-width="3.5"/>`)
        }
      cells.push(`<rect x="24.5" y="24.5" width="15" height="15" rx="3" fill="${c}"/>`)
      cells.push(`<circle cx="32" cy="32" r="3" fill="#fff"/>`)
      return '\n      ' + cells.join('\n      ')
    },
  },
  {
    id: 'v3-check',
    name: 'A3 · 定位勾',
    desc: '高亮格内白点换成对勾——「确认并标记你的座位」，呼应 SeatMark 的 Mark。小尺寸辨识度优于圆点。',
    mark: (c, a) => `
      <rect x="6" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="35" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="6" y="35" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="35" y="35" width="23" height="23" rx="6" fill="${a}"/>
      <path d="M40.5 46.5 l4.5 4.5 l8.5 -9.5" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    markMono: (c) => `
      <rect x="6" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="35" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="6" y="35" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="35" y="35" width="23" height="23" rx="6" fill="${c}"/>
      <path d="M40.5 46.5 l4.5 4.5 l8.5 -9.5" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: 'v4-selected',
    name: 'A4 · 选中框',
    desc: '实心格 + 四角选择框，像座位表里被框选定位的那一格。「定位到座位」的语义可视化最强。',
    mark: (c, a) => `
      <rect x="6" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="35" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="6" y="35" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="35" y="35" width="23" height="23" rx="6" fill="${a}"/>
      <path d="M39.5 31.5 h-5 a3 3 0 0 0 -3 3 v5" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M53.5 31.5 h5 a3 3 0 0 1 3 3 v5" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M61.5 53.5 v5 a3 3 0 0 1 -3 3 h-5" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M47.5 61.5 h-5 a3 3 0 0 1 -3 -3 v-5" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/>`,
    markMono: (c) => `
      <rect x="6" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="35" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="6" y="35" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="35" y="35" width="23" height="23" rx="6" fill="${c}"/>
      <path d="M39.5 31.5 h-5 a3 3 0 0 0 -3 3 v5" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M53.5 31.5 h5 a3 3 0 0 1 3 3 v5" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M61.5 53.5 v5 a3 3 0 0 1 -3 3 h-5" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M47.5 61.5 h-5 a3 3 0 0 1 -3 -3 v-5" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/>`,
  },
  {
    id: 'v5-labelcard',
    name: 'A5 · 座签格',
    desc: '高亮格内嵌姓名条，这一格本身就是一张座签卡——「座位表里长出一枚座签」，产品动作可视化。',
    mark: (c, a) => `
      <rect x="6" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="35" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="6" y="35" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="35" y="35" width="23" height="23" rx="6" fill="${a}"/>
      <rect x="41" y="43" width="11" height="4" rx="2" fill="#fff"/>
      <rect x="41" y="50" width="7" height="3.5" rx="1.75" fill="#fff" opacity="0.72"/>`,
    markMono: (c) => `
      <rect x="6" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="35" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="6" y="35" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="35" y="35" width="23" height="23" rx="6" fill="${c}"/>
      <rect x="41" y="43" width="11" height="4" rx="2" fill="#fff"/>
      <rect x="41" y="50" width="7" height="3.5" rx="1.75" fill="#fff" opacity="0.72"/>`,
  },
  {
    id: 'v6-tonal',
    name: 'A6 · 柔格',
    desc: '描边格改浅底填充格（brand-100），只有高亮格实心。更柔和现代，深色/浅色底都成立。',
    mark: (c, a) => `
      <rect x="6" y="6" width="23" height="23" rx="6" fill="${BRAND_100}"/>
      <rect x="35" y="6" width="23" height="23" rx="6" fill="${BRAND_100}"/>
      <rect x="6" y="35" width="23" height="23" rx="6" fill="${BRAND_100}"/>
      <rect x="35" y="35" width="23" height="23" rx="6" fill="${a}"/>
      <circle cx="46.5" cy="46.5" r="4.5" fill="#fff"/>`,
    markMono: (c) => `
      <rect x="6" y="6" width="23" height="23" rx="6" fill="${c}" opacity="0.14"/>
      <rect x="35" y="6" width="23" height="23" rx="6" fill="${c}" opacity="0.14"/>
      <rect x="6" y="35" width="23" height="23" rx="6" fill="${c}" opacity="0.14"/>
      <rect x="35" y="35" width="23" height="23" rx="6" fill="${c}"/>
      <circle cx="46.5" cy="46.5" r="4.5" fill="#fff"/>`,
  },
  {
    id: 'v7-lifted',
    name: 'A7 · 抽取格',
    desc: '高亮格被「拿起」：略放大、轻旋转、脱格而出。动感与故事感最强，但形式最跳出。',
    mark: (c, a) => `
      <rect x="6" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="35" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="6" y="35" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <g transform="rotate(-8 46.5 46.5)">
        <rect x="33.5" y="33.5" width="26" height="26" rx="7" fill="${a}"/>
        <circle cx="46.5" cy="46.5" r="4.5" fill="#fff"/>
      </g>`,
    markMono: (c) => `
      <rect x="6" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="35" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="6" y="35" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
      <g transform="rotate(-8 46.5 46.5)">
        <rect x="33.5" y="33.5" width="26" height="26" rx="7" fill="${c}"/>
        <circle cx="46.5" cy="46.5" r="4.5" fill="#fff"/>
      </g>`,
  },
]

function markSvg(d, { size = 64, variant = 'color', onDark = false } = {}) {
  const inner = variant === 'mono' ? d.markMono(onDark ? '#ffffff' : INK) : d.mark(BRAND, BRAND, onDark)
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

mkdirSync(join(ROOT, 'preview', 'refine-seatgrid'), { recursive: true })

for (const d of variants) {
  writeFileSync(join(ROOT, 'preview', 'refine-seatgrid', `${d.id}-mark.svg`), markSvg(d))
  writeFileSync(join(ROOT, 'preview', 'refine-seatgrid', `${d.id}-mark-mono.svg`), markSvg(d, { variant: 'mono' }))
}

// 对比预览页
const rows = variants
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
  join(ROOT, 'preview', 'logo-refine-a.html'),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>SeatMark Logo 方案A精修对比</title>
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
<h1>SeatMark 座签 · 方案A「座位格」精修对比（8 变体）</h1>
<p class="sub">A0 为现行版基线。每行：亮底组合标 · 暗底组合标 · 单色版 · Favicon 缩小可用性（48/32/24/16px）。</p>
${rows}
</body></html>`,
)

console.log('done:', variants.length, 'variants')
