// SeatMark 品牌物料·第二轮生成脚本（基于正式方案 A「座位格」）
// 用法：node brand/scripts/assets.mjs && bash brand/scripts/export-assets.sh
// 输出 brand/assets/ 下：社交头像方阵 / 知乎·小红书封面模板×3 / 微信分享卡片 / PPT 模板封面
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'assets')
mkdirSync(OUT, { recursive: true })

const BRAND = '#4f46e5'
const BRAND_700 = '#4338ca'
const BRAND_100 = '#e0e7ff'
const BRAND_50 = '#eef2ff'
const INK = '#0f172a'
const FONT = "'Noto Sans CJK SC','PingFang SC','Microsoft YaHei',sans-serif"

// 方案 A 图形标：c=格线色，fillC=实心格色，dot=白点色
const mark = (c = BRAND, dot = '#fff', fillC = c) => `
  <rect x="6" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
  <rect x="35" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
  <rect x="6" y="35" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
  <rect x="35" y="35" width="23" height="23" rx="6" fill="${fillC}"/>
  <circle cx="46.5" cy="46.5" r="4.5" fill="${dot}"/>`

const markAt = (x, y, s, c, dot, fillC) =>
  `<g transform="translate(${x},${y}) scale(${s / 64})">${mark(c, dot, fillC)}</g>`

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}">${body}</svg>\n`

const write = (name, content) => writeFileSync(join(OUT, name), content)

// ————————————————————————————————————————————
// 1. 社交头像方阵（同一主视觉，按平台推荐尺寸导出）
//    微信公众号 500 / 知乎 400 / 小红书 1080 / 抖音 1080
// ————————————————————————————————————————————
const avatarBody = (s) => {
  const u = s / 512
  return `
    <defs>
      <linearGradient id="avbg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${BRAND}"/>
        <stop offset="1" stop-color="${BRAND_700}"/>
      </linearGradient>
    </defs>
    <rect width="${s}" height="${s}" fill="url(#avbg)"/>
    ${markAt(124 * u, 106 * u, 264 * u, '#ffffff', BRAND, '#ffffff')}
    <text x="${s / 2}" y="${448 * u}" text-anchor="middle" font-size="${72 * u}" font-weight="700" fill="#fff" letter-spacing="${6 * u}">座签</text>`
}

const AVATARS = [
  ['avatar-wechat-mp-500', 500],
  ['avatar-zhihu-400', 400],
  ['avatar-xiaohongshu-1080', 1080],
  ['avatar-douyin-1080', 1080],
]
for (const [name, size] of AVATARS) write(`${name}.svg`, svg(size, size, avatarBody(size)))

// ————————————————————————————————————————————
// 公共插画：座位表网格卡片（浅底用）
// ————————————————————————————————————————————
const seatGridCard = (w, h, highlight = BRAND, cell = BRAND_100, name = '张三') => {
  const cols = 4
  const rows = 3
  const pad = Math.round(w * 0.045)
  const gap = Math.round(w * 0.02)
  const cw = (w - pad * 2 - gap * (cols - 1)) / cols
  const ch = (h - pad * 2 - gap * (rows - 1)) / rows
  let cells = ''
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const hi = r === 1 && c === 2
      cells += `<rect x="${pad + c * (cw + gap)}" y="${pad + r * (ch + gap)}" width="${cw}" height="${ch}" rx="${w * 0.012}" fill="${hi ? highlight : cell}"/>`
      if (hi)
        cells += `<text x="${pad + c * (cw + gap) + cw / 2}" y="${pad + r * (ch + gap) + ch / 2 + h * 0.035}" text-anchor="middle" font-size="${h * 0.1}" font-weight="700" fill="#fff">${name}</text>`
    }
  return `<rect width="${w}" height="${h}" rx="${w * 0.018}" fill="#fff" stroke="#e2e8f0" stroke-width="2"/>${cells}`
}

// ————————————————————————————————————————————
// 2. 知乎 / 小红书封面模板 ×3 套
//    知乎横版 1200×675（16:9），小红书竖版 1242×1660（3:4）
//    模板 1「浅底网格」/ 模板 2「暗底数据」/ 模板 3「纸张场景」
// ————————————————————————————————————————————

// —— 模板 1：浅底网格主视觉 ——
write(
  'cover-1-grid-zhihu-1200x675.svg',
  svg(
    1200,
    675,
    `<rect width="1200" height="675" fill="${BRAND_50}"/>
     <g opacity="0.5">${markAt(1000, -60, 380, BRAND_100, BRAND_50, BRAND_100)}</g>
     ${markAt(84, 76, 88, BRAND, '#fff')}
     <text x="196" y="136" font-size="46" font-weight="700" fill="${INK}">座签 SeatMark</text>
     <text x="84" y="288" font-size="64" font-weight="700" fill="${INK}">考场座签批量生成</text>
     <text x="84" y="368" font-size="34" fill="#475569">上传 Excel 名单 → 一键排版 → 打印</text>
     <g transform="translate(84,430)">${seatGridCard(560, 180)}</g>
     <text x="700" y="500" font-size="26" fill="#64748b">精确到 0.1mm · 数据本地处理</text>
     <text x="700" y="548" font-size="26" fill="#64748b">免费 · 无需注册 · 可离线</text>
     <text x="700" y="608" font-size="26" font-weight="600" fill="${BRAND}">www.seatmark.cn</text>`,
  ),
)
write(
  'cover-1-grid-xhs-1242x1660.svg',
  svg(
    1242,
    1660,
    `<rect width="1242" height="1660" fill="${BRAND_50}"/>
     <g opacity="0.5">${markAt(920, -120, 520, BRAND_100, BRAND_50, BRAND_100)}</g>
     ${markAt(505, 190, 232, BRAND, '#fff')}
     <text x="621" y="560" text-anchor="middle" font-size="104" font-weight="700" fill="${INK}">考场座签</text>
     <text x="621" y="694" text-anchor="middle" font-size="104" font-weight="700" fill="${BRAND}">批量生成</text>
     <text x="621" y="800" text-anchor="middle" font-size="44" fill="#475569">上传 Excel 名单 → 一键排版 → 打印</text>
     <g transform="translate(191,890)">${seatGridCard(860, 400)}</g>
     <text x="621" y="1420" text-anchor="middle" font-size="40" fill="#475569">A4 / A5 / A3 · 照片核验 · PDF 导出</text>
     <text x="621" y="1502" text-anchor="middle" font-size="36" fill="#94a3b8">数据本地处理 · 免费无需注册 · www.seatmark.cn</text>`,
  ),
)

// —— 模板 2：暗底数据风 ——
const darkGrid = (w, h) => {
  const cols = 4
  const rows = 3
  const pad = Math.round(w * 0.045)
  const gap = Math.round(w * 0.02)
  const cw = (w - pad * 2 - gap * (cols - 1)) / cols
  const ch = (h - pad * 2 - gap * (rows - 1)) / rows
  let cells = ''
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const hi = r === 1 && c === 2
      cells += `<rect x="${pad + c * (cw + gap)}" y="${pad + r * (ch + gap)}" width="${cw}" height="${ch}" rx="${w * 0.012}" fill="${hi ? BRAND : '#334155'}"/>`
      if (hi)
        cells += `<text x="${pad + c * (cw + gap) + cw / 2}" y="${pad + r * (ch + gap) + ch / 2 + h * 0.035}" text-anchor="middle" font-size="${h * 0.1}" font-weight="700" fill="#fff">李四</text>`
    }
  return `<rect width="${w}" height="${h}" rx="${w * 0.018}" fill="#1e293b"/>${cells}`
}
write(
  'cover-2-dark-zhihu-1200x675.svg',
  svg(
    1200,
    675,
    `<rect width="1200" height="675" fill="${INK}"/>
     ${markAt(84, 76, 88, '#818cf8', INK, '#818cf8')}
     <text x="196" y="136" font-size="46" font-weight="700" fill="#fff">座签 SeatMark</text>
     <text x="84" y="290" font-size="62" font-weight="700" fill="#fff">名单到座签</text>
     <text x="84" y="376" font-size="62" font-weight="700" fill="#818cf8">只要 1 分钟</text>
     <text x="84" y="460" font-size="30" fill="#94a3b8">61 款模板 · 毫米级排版 · 隐私优先</text>
     <text x="84" y="580" font-size="28" font-weight="600" fill="#818cf8">www.seatmark.cn</text>
     <g transform="translate(680,150)">${darkGrid(440, 380)}</g>`,
  ),
)
write(
  'cover-2-dark-xhs-1242x1660.svg',
  svg(
    1242,
    1660,
    `<rect width="1242" height="1660" fill="${INK}"/>
     ${markAt(505, 170, 232, '#818cf8', INK, '#818cf8')}
     <text x="621" y="560" text-anchor="middle" font-size="100" font-weight="700" fill="#fff">名单到座签</text>
     <text x="621" y="700" text-anchor="middle" font-size="100" font-weight="700" fill="#818cf8">只要 1 分钟</text>
     <text x="621" y="806" text-anchor="middle" font-size="44" fill="#94a3b8">61 款模板 · 毫米级排版 · 隐私优先</text>
     <g transform="translate(191,900)">${darkGrid(860, 420)}</g>
     <text x="621" y="1450" text-anchor="middle" font-size="40" fill="#94a3b8">数据本地处理 · 免费无需注册</text>
     <text x="621" y="1530" text-anchor="middle" font-size="38" font-weight="600" fill="#818cf8">www.seatmark.cn</text>`,
  ),
)

// —— 模板 3：纸张打印场景 ——
const a4Sheet = (w, h) => {
  const rows = 4
  const pad = Math.round(w * 0.08)
  const gap = Math.round(h * 0.025)
  const rh = (h - pad * 2 - gap * (rows - 1)) / rows
  let rowsSvg = ''
  for (let r = 0; r < rows; r++) {
    const y = pad + r * (rh + gap)
    rowsSvg += `<rect x="${pad}" y="${y}" width="${w - pad * 2}" height="${rh}" rx="${w * 0.01}" fill="${r === 1 ? BRAND_100 : '#f8fafc'}" stroke="#e2e8f0"/>
      <rect x="${pad + w * 0.04}" y="${y + rh * 0.3}" width="${w * 0.3}" height="${rh * 0.18}" rx="${rh * 0.09}" fill="${r === 1 ? BRAND : '#cbd5e1'}"/>
      <rect x="${pad + w * 0.04}" y="${y + rh * 0.58}" width="${w * 0.2}" height="${rh * 0.12}" rx="${rh * 0.06}" fill="#cbd5e1"/>
      <rect x="${w - pad - w * 0.2}" y="${y + rh * 0.2}" width="${w * 0.14}" height="${rh * 0.6}" rx="${w * 0.008}" fill="${r === 1 ? BRAND_100 : '#e2e8f0'}" stroke="#cbd5e1"/>`
  }
  return `<rect width="${w}" height="${h}" rx="${w * 0.012}" fill="#fff" stroke="#e2e8f0" stroke-width="2"/>
    <line x1="${pad}" y1="${pad * 0.55}" x2="${pad + w * 0.1}" y2="${pad * 0.55}" stroke="#cbd5e1" stroke-width="2"/>
    <line x1="${w - pad - w * 0.1}" y1="${pad * 0.55}" x2="${w - pad}" y2="${pad * 0.55}" stroke="#cbd5e1" stroke-width="2"/>
    ${rowsSvg}`
}
write(
  'cover-3-paper-zhihu-1200x675.svg',
  svg(
    1200,
    675,
    `<rect width="1200" height="675" fill="#f8fafc"/>
     <rect width="1200" height="675" fill="${BRAND_50}" opacity="0.6"/>
     ${markAt(84, 76, 88, BRAND, '#fff')}
     <text x="196" y="136" font-size="46" font-weight="700" fill="${INK}">座签 SeatMark</text>
     <text x="84" y="300" font-size="60" font-weight="700" fill="${INK}">A4 一页 6 签</text>
     <text x="84" y="382" font-size="60" font-weight="700" fill="${BRAND}">打印即贴</text>
     <text x="84" y="466" font-size="30" fill="#475569">桌牌 · 席卡 · 门贴 · 证卡全覆盖</text>
     <text x="84" y="580" font-size="28" font-weight="600" fill="${BRAND}">www.seatmark.cn</text>
     <g transform="translate(760,80) rotate(3 180 255)">${a4Sheet(360, 510)}</g>`,
  ),
)
write(
  'cover-3-paper-xhs-1242x1660.svg',
  svg(
    1242,
    1660,
    `<rect width="1242" height="1660" fill="#f8fafc"/>
     <rect width="1242" height="1660" fill="${BRAND_50}" opacity="0.6"/>
     ${markAt(505, 150, 232, BRAND, '#fff')}
     <text x="621" y="540" text-anchor="middle" font-size="96" font-weight="700" fill="${INK}">A4 一页 6 签</text>
     <text x="621" y="676" text-anchor="middle" font-size="96" font-weight="700" fill="${BRAND}">打印即贴</text>
     <text x="621" y="784" text-anchor="middle" font-size="44" fill="#475569">桌牌 · 席卡 · 门贴 · 证卡全覆盖</text>
     <g transform="translate(361,870) rotate(3 260 320)">${a4Sheet(520, 640)}</g>
     <text x="621" y="1600" text-anchor="middle" font-size="38" font-weight="600" fill="${BRAND}">www.seatmark.cn</text>`,
  ),
)

// ————————————————————————————————————————————
// 3. 微信分享卡片图 500×400（消息卡片 5:4）
// ————————————————————————————————————————————
write(
  'wechat-share-card-500x400.svg',
  svg(
    500,
    400,
    `<rect width="500" height="400" fill="${BRAND_50}"/>
     <g opacity="0.5">${markAt(360, -50, 240, BRAND_100, BRAND_50, BRAND_100)}</g>
     ${markAt(40, 40, 72, BRAND, '#fff')}
     <text x="130" y="90" font-size="40" font-weight="700" fill="${INK}">座签 SeatMark</text>
     <text x="40" y="188" font-size="30" font-weight="700" fill="${INK}">上传名单，批量生成座位标签</text>
     <text x="40" y="238" font-size="21" fill="#475569">61 款模板 · 毫米级排版 · PDF 导出</text>
     <g transform="translate(40,270)">${seatGridCard(300, 96)}</g>
     <text x="370" y="326" font-size="17" fill="#64748b">数据本地处理</text>
     <text x="370" y="356" font-size="17" font-weight="600" fill="${BRAND}">免费无需注册</text>`,
  ),
)

// ————————————————————————————————————————————
// 4. 品牌 PPT 模板封面 1280×720（16:9）
// ————————————————————————————————————————————
write(
  'ppt-cover-1280x720.svg',
  svg(
    1280,
    720,
    `<rect width="1280" height="720" fill="#fff"/>
     <rect width="1280" height="8" fill="${BRAND}"/>
     <g opacity="0.35">${markAt(1010, 420, 420, BRAND_100, '#fff', BRAND_100)}</g>
     ${markAt(96, 88, 72, BRAND, '#fff')}
     <text x="188" y="138" font-size="38" font-weight="700" fill="${INK}">座签 SeatMark</text>
     <text x="96" y="330" font-size="72" font-weight="700" fill="${INK}">演示文稿标题</text>
     <text x="96" y="404" font-size="32" fill="#475569">副标题 · 汇报人 · 日期</text>
     <line x1="96" y1="452" x2="336" y2="452" stroke="${BRAND}" stroke-width="4"/>
     <text x="96" y="640" font-size="22" fill="#94a3b8">www.seatmark.cn · 考场座签批量生成</text>`,
  ),
)

console.log('brand/assets generated')
