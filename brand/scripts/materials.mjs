// SeatMark 物料模板生成脚本（基于推荐方案 A「座位格」）
// 用法：node brand/scripts/materials.mjs && 用 rsvg-convert 导出 PNG
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'materials')
mkdirSync(OUT, { recursive: true })

const BRAND = '#4f46e5'
const INK = '#0f172a'
const FONT = "'Noto Sans CJK SC','PingFang SC','Microsoft YaHei',sans-serif"

// 方案 A 图形标，c=主色，dot=白点
const mark = (c = BRAND, white = '#fff') => `
  <rect x="6" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
  <rect x="35" y="6" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
  <rect x="6" y="35" width="23" height="23" rx="6" fill="none" stroke="${c}" stroke-width="5"/>
  <rect x="35" y="35" width="23" height="23" rx="6" fill="${c}"/>
  <circle cx="46.5" cy="46.5" r="4.5" fill="${white}"/>`

const markAt = (x, y, s, c, white) => `<g transform="translate(${x},${y}) scale(${s / 64})">${mark(c, white)}</g>`

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}">${body}</svg>`

// —— 社交头像 512x512：白格纹浅底 + 居中图形标 ——
writeFileSync(
  join(OUT, 'avatar.svg'),
  svg(
    512,
    512,
    `<rect width="512" height="512" fill="${BRAND}"/>
     ${markAt(128, 118, 256, '#ffffff', BRAND)}
     <text x="256" y="436" text-anchor="middle" font-size="64" font-weight="700" fill="#fff">座签</text>`,
  ),
)

// —— 微信公众号封面 900x383 ——
writeFileSync(
  join(OUT, 'wechat-cover.svg'),
  svg(
    900,
    383,
    `<rect width="900" height="383" fill="#eef2ff"/>
     <rect width="900" height="383" fill="url(#g)" opacity="0"/>
     ${markAt(72, 100, 96, BRAND, '#fff')}
     <text x="196" y="158" font-size="52" font-weight="700" fill="${INK}">座签 SeatMark</text>
     <text x="196" y="212" font-size="26" fill="#475569">上传 Excel 名单，批量生成座位标签</text>
     <text x="196" y="252" font-size="20" fill="#64748b">精确到 0.1mm · 数据本地处理 · 免费</text>
     <g>
       <rect x="640" y="96" width="190" height="120" rx="8" fill="#fff" stroke="#e2e8f0"/>
       <rect x="656" y="112" width="74" height="40" rx="4" fill="#e0e7ff"/>
       <rect x="746" y="112" width="74" height="40" rx="4" fill="#e0e7ff"/>
       <rect x="656" y="160" width="74" height="40" rx="4" fill="#e0e7ff"/>
       <rect x="746" y="160" width="74" height="40" rx="4" fill="${BRAND}"/>
       <circle cx="783" cy="180" r="7" fill="#fff"/>
     </g>
     <text x="735" y="248" text-anchor="middle" font-size="16" fill="#94a3b8">www.seatmark.cn</text>`,
  ),
)

// —— 小红书封面 1242x1660 ——
writeFileSync(
  join(OUT, 'xhs-cover.svg'),
  svg(
    1242,
    1660,
    `<rect width="1242" height="1660" fill="#eef2ff"/>
     ${markAt(521, 220, 200, BRAND, '#fff')}
     <text x="621" y="560" text-anchor="middle" font-size="110" font-weight="700" fill="${INK}">考场座签</text>
     <text x="621" y="700" text-anchor="middle" font-size="110" font-weight="700" fill="${BRAND}">批量生成</text>
     <text x="621" y="810" text-anchor="middle" font-size="44" fill="#475569">上传 Excel 名单 → 一键排版 → 打印</text>
     <g transform="translate(171,900)">
       <rect width="900" height="420" rx="12" fill="#fff" stroke="#e2e8f0" stroke-width="2"/>
       ${[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => `<rect x="${40 + c * 210}" y="${40 + r * 120}" width="190" height="100" rx="6" fill="${r === 1 && c === 2 ? BRAND : '#e0e7ff'}"/>`).join('')).join('')}
       <text x="565" y="205" text-anchor="middle" font-size="30" font-weight="700" fill="#fff">张三</text>
     </g>
     <text x="621" y="1430" text-anchor="middle" font-size="40" fill="#475569">A4 / A5 / A3 · 照片核验 · PDF 导出</text>
     <text x="621" y="1510" text-anchor="middle" font-size="36" fill="#94a3b8">数据本地处理 · 免费无需注册 · www.seatmark.cn</text>`,
  ),
)

// —— OG 分享图 1200x630 ——
writeFileSync(
  join(OUT, 'og-image.svg'),
  svg(
    1200,
    630,
    `<rect width="1200" height="630" fill="${INK}"/>
     ${markAt(96, 120, 120, '#818cf8', INK)}
     <text x="250" y="196" font-size="64" font-weight="700" fill="#fff">座签 SeatMark</text>
     <text x="96" y="330" font-size="40" fill="#cbd5e1">上传 Excel 名单，批量生成可打印的</text>
     <text x="96" y="392" font-size="40" fill="#cbd5e1">座位标签 · 桌牌席卡 · 门贴证卡</text>
     <text x="96" y="490" font-size="26" fill="#64748b">排版精确到 0.1mm · 数据本地处理 · 免费无需注册</text>
     <text x="96" y="560" font-size="26" fill="#818cf8">www.seatmark.cn</text>
     <g transform="translate(840,150)">
       <rect width="280" height="330" rx="12" fill="#1e293b"/>
       ${[0, 1, 2].map((r) => [0, 1].map((c) => `<rect x="${28 + c * 118}" y="${28 + r * 96}" width="106" height="80" rx="6" fill="${r === 1 && c === 1 ? BRAND : '#334155'}"/>`).join('')).join('')}
       <text x="199" y="172" text-anchor="middle" font-size="24" font-weight="700" fill="#fff">李四</text>
     </g>`,
  ),
)

// —— 名片 90x54mm @300dpi ≈ 1063x638，正反两面并排导出 ——
writeFileSync(
  join(OUT, 'business-card.svg'),
  svg(
    2206,
    638,
    `<!-- 正面 -->
     <g>
       <rect width="1063" height="638" fill="#fff" stroke="#e2e8f0"/>
       ${markAt(80, 80, 110, BRAND, '#fff')}
       <text x="220" y="140" font-size="54" font-weight="700" fill="${INK}">座签 SeatMark</text>
       <text x="220" y="192" font-size="26" fill="#64748b">考场座签 · 桌牌席卡 · 批量生成</text>
       <text x="80" y="480" font-size="30" font-weight="600" fill="${INK}">王小明 · 产品负责人</text>
       <text x="80" y="530" font-size="24" fill="#475569">hello@seatmark.cn</text>
       <text x="80" y="572" font-size="24" fill="#475569">www.seatmark.cn</text>
     </g>
     <!-- 反面 -->
     <g transform="translate(1143,0)">
       <rect width="1063" height="638" fill="${BRAND}"/>
       ${markAt(451, 189, 160, '#ffffff', BRAND)}
       <text x="531" y="460" text-anchor="middle" font-size="40" font-weight="700" fill="#fff">座签 SeatMark</text>
       <text x="531" y="516" text-anchor="middle" font-size="24" fill="#c7d2fe">www.seatmark.cn</text>
     </g>`,
  ),
)

console.log('materials done')
