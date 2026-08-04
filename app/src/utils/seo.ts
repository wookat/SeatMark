import { resolveSeo, SITE_ORIGIN } from '@/data/seo'

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/**
 * 客户端路由切换时应用页面级 SEO：
 * title / description / canonical / OG / JSON-LD。
 * 预渲染 HTML 首屏已带正确 head，此函数保证 SPA 内部导航后 head 同步更新。
 */
export function applySeo(path: string): void {
  const seo = resolveSeo(path)

  document.title = seo.title
  setMeta('name', 'description', seo.description)
  setMeta('name', 'robots', seo.robots ?? 'index,follow')
  setMeta('property', 'og:title', seo.title)
  setMeta('property', 'og:description', seo.description)
  setMeta('property', 'og:url', `${SITE_ORIGIN}${seo.path}`)
  setMeta('property', 'og:image', `${SITE_ORIGIN}/og-image.png`)
  setMeta('name', 'twitter:title', seo.title)
  setMeta('name', 'twitter:image', `${SITE_ORIGIN}/og-image.png`)
  setMeta('name', 'twitter:description', seo.description)

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }
  canonical.href = `${SITE_ORIGIN}${seo.path}`

  // 页面级 JSON-LD：先移除上个路由注入的，再写入当前路由的
  document.head
    .querySelectorAll('script[data-route-jsonld]')
    .forEach((el) => el.remove())
  for (const data of seo.jsonLd) {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.dataset.routeJsonld = ''
    script.textContent = JSON.stringify(data)
    document.head.appendChild(script)
  }
}
