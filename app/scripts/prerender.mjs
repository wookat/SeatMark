/**
 * 构建后预渲染：把每个内容路由输出为独立的静态 HTML 文件。
 *
 * 流程（见 package.json 的 build 脚本）：
 *   1. vite build                       → dist/（客户端产物，含 index.html 模板）
 *   2. vite build --ssr entry-server.ts → dist-ssr/（Node 端渲染函数）
 *   3. node scripts/prerender.mjs       → 对 prerenderPaths() 中的每个路由：
 *        - renderToString 得到完整正文 HTML；
 *        - 用 resolveSeo() 重写 title/description/canonical/OG/JSON-LD；
 *        - 写入 dist/<path>/index.html，EdgeOne 静态托管可直接命中。
 *
 * 同时按同一份路径清单生成 dist/sitemap.xml，保证 sitemap 与实际页面一致。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = join(root, 'dist')

const { render, resolveSeo, prerenderPaths, appShellPaths, SITE_ORIGIN } = await import(
  join(root, 'dist-ssr', 'entry-server.js')
)

const template = readFileSync(join(distDir, 'index.html'), 'utf-8')

function escapeAttr(text) {
  return text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}

/** JSON-LD 里的 </script> 防注入（内容为站内数据，防御性处理） */
function safeJsonLd(data) {
  return JSON.stringify(data).replaceAll('</', '\\u003C/')
}

function applyHead(html, seo) {
  const url = `${SITE_ORIGIN}${seo.path === '/' ? '/' : seo.path}`
  const title = escapeAttr(seo.title)
  const description = escapeAttr(seo.description)

  let out = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(
      /<meta\s+name="description"[\s\S]*?\/>/,
      `<meta name="description" content="${description}" />`,
    )
    .replace(
      /<link rel="canonical"[^>]*\/>/,
      `<link rel="canonical" href="${url}" />`,
    )
    .replace(/<meta property="og:url"[^>]*\/>/, `<meta property="og:url" content="${url}" />`)
    .replace(
      /<meta property="og:title"[^>]*\/>/,
      `<meta property="og:title" content="${title}" />`,
    )
    .replace(
      /<meta\s+property="og:description"[\s\S]*?\/>/,
      `<meta property="og:description" content="${description}" />`,
    )
    .replace(
      /<meta name="twitter:title"[^>]*\/>/,
      `<meta name="twitter:title" content="${title}" />`,
    )
    .replace(
      /<meta\s+name="twitter:description"[\s\S]*?\/>/,
      `<meta name="twitter:description" content="${description}" />`,
    )
    // 移除模板中的静态 JSON-LD，改为按路由注入
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/, '')

  if (seo.robots) {
    if (/<meta\s+name="robots"[^>]*\/>/.test(out)) {
      out = out.replace(/<meta\s+name="robots"[^>]*\/>/, `<meta name="robots" content="${escapeAttr(seo.robots)}" />`)
    } else {
      out = out.replace('</title>', `</title>\n    <meta name="robots" content="${escapeAttr(seo.robots)}" />`)
    }
  }

  const jsonLdTags = seo.jsonLd
    .map((data) => `<script type="application/ld+json" data-route-jsonld>${safeJsonLd(data)}</script>`)
    .join('\n    ')
  return out.replace('</head>', `    ${jsonLdTags}\n  </head>`)
}

const paths = prerenderPaths()
// 应用壳路径（账号/管理页）：预渲染 HTML 壳供静态托管直达，noindex 且不进 sitemap
const shellPaths = appShellPaths()
for (const path of [...paths, ...shellPaths]) {
  const seo = resolveSeo(path)
  let html = applyHead(template, seo)

  // /studio 与应用壳为纯交互应用，保持 SPA 挂载即可；其余路由注入正文
  if (path !== '/studio' && !shellPaths.includes(path)) {
    const appHtml = await render(path)
    html = html.replace('<div id="app"></div>', `<div id="app">${appHtml}</div>`)
  }

  const outFile = path === '/' ? join(distDir, 'index.html') : join(distDir, path, 'index.html')
  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(outFile, html)
  console.log(`prerendered ${path} -> ${outFile.replace(distDir, 'dist')}`)
}

// ---------- sitemap.xml（与预渲染路径同源） ----------
const today = new Date().toISOString().slice(0, 10)
const priorities = (p) => (p === '/' ? '1.0' : p === '/studio' ? '0.9' : p.split('/').length > 2 ? '0.7' : '0.8')
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths
  .map(
    (p) => `  <url>
    <loc>${SITE_ORIGIN}${p === '/' ? '/' : p}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priorities(p)}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`
writeFileSync(join(distDir, 'sitemap.xml'), sitemap)
console.log(`sitemap.xml generated with ${paths.length} urls`)
