/**
 * 第 6 轮回归 P1 复现脚本：同一 /studio 页签长会话（多次模板切换 + 一次成功导出）后
 * 带水印导出静默失败（无 toast、无产物）。
 *
 * 根因是导出链路对 document.fonts.ready / 图片 decode 的等待没有时间上限，
 * 且单页看门狗只包住 html2canvas 本身：多次模板切换会触发在线字体补载
 * （fonts.ensureTemplateFonts），任何一个字体请求挂起都会让 fonts.ready 永不落定，
 * 后续导出在 mountHost/waitForElementReady 处永久挂死——既无报错也无产物。
 *
 * 本脚本用「挂起的字体请求」确定性地复现该状态：
 *   1. 拦截 /__hang-font__ 路由永不响应，并注入一个引用它的 FontFace 且调用 load()，
 *      使 document.fonts.ready 处于 pending（等价于线上字体 CDN 请求挂起）；
 *   2. /studio 载入演示数据，连续切换多个模板（复现路径）；
 *   3. 点击「图片版 PDF」→「带水印导出」，等待 45s 观察结果。
 *
 * 判定：
 *   - 修复前：无下载产物、无任何 toast → REPRO CONFIRMED（静默失败）
 *   - 修复后：字体等待 3s 到时放行，导出正常产出 PDF → FIXED
 *
 * 运行：先 `cd app && npm run dev`，再 `node scripts/repro-r6-export-session.mjs`
 * （依赖 playwright：`npm i -D playwright` 或全局可用的 npx playwright 环境）
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const WAIT_MS = 45_000

const browser = await chromium.launch()
const context = await browser.newContext({ acceptDownloads: true })
const page = await context.newPage()

// 1) 字体请求永久挂起（模拟线上字体 CDN 卡死）
await context.route('**/__hang-font__*', () => {
  /* 永不 fulfill / abort：请求一直 pending */
})
await page.addInitScript(() => {
  window.addEventListener('DOMContentLoaded', () => {
    const face = new FontFace('HangFont', 'url(/__hang-font__.woff2)')
    document.fonts.add(face)
    face.load().catch(() => {})
  })
})

// 2) 进入工坊，载入演示数据，连续切换多个模板（复现路径）
await page.goto(`${BASE}/studio?demo=1`)
await page.waitForLoadState('networkidle').catch(() => {})
const cards = page.locator('[class*="template"] >> role=button').or(page.getByRole('button'))
const templateCards = page.locator('aside').getByRole('button').filter({ hasText: /桌牌|考场|座签|席卡/ })
const count = Math.min(await templateCards.count(), 4)
for (let i = 0; i < count; i++) {
  await templateCards.nth(i).click().catch(() => {})
  await page.waitForTimeout(600)
}
void cards

const fontsPending = await page.evaluate(
  () => Promise.race([document.fonts.ready.then(() => false), new Promise((r) => setTimeout(() => r(true), 500))]),
)
console.log(`document.fonts.ready pending: ${fontsPending}`)

// 3) 触发带水印导出，观察是否有产物或 toast
let downloaded = false
page.on('download', () => {
  downloaded = true
})
await page.getByRole('button', { name: /图片版 PDF/ }).first().click()
await page.getByRole('button', { name: /带水印导出/ }).click()

const start = Date.now()
let toastText = ''
while (Date.now() - start < WAIT_MS) {
  if (downloaded) break
  toastText = (await page.locator('[class*="toast"], [role="alert"]').allInnerTexts().catch(() => []))
    .join(' | ')
    .trim()
  if (toastText) break
  await page.waitForTimeout(1000)
}

if (downloaded) {
  console.log('RESULT: FIXED — 导出产出 PDF（字体等待被 3s 上限放行）')
} else if (toastText) {
  console.log(`RESULT: FAILED WITH TOAST — 有明确错误提示（非静默）：${toastText}`)
} else {
  console.log('RESULT: REPRO CONFIRMED — 静默失败：45s 内既无产物也无任何 toast')
}

await browser.close()
process.exit(0)
