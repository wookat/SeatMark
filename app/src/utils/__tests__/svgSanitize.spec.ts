// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { defaultTemplates } from '@/data/defaultTemplates'
import { sanitizeDecorSvg } from '@/utils/svgSanitize'

const wrap = (body: string) =>
  `<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">${body}</svg>`

function parse(svg: string) {
  return new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement
}

/** 元素名 + 属性名/值（按名称排序）+ 文本，用于语义等价比较 */
function shape(el: Element): string {
  const attrs = Array.from(el.attributes)
    .map((a) => `${a.name}=${a.value}`)
    .sort()
    .join(' ')
  const kids = Array.from(el.childNodes)
    .map((n) =>
      n.nodeType === Node.ELEMENT_NODE ? shape(n as Element) : (n.textContent ?? '').trim(),
    )
    .filter(Boolean)
    .join('')
  return `<${el.localName} ${attrs}>${kids}</${el.localName}>`
}

describe('sanitizeDecorSvg 拒绝项', () => {
  it('非 svg 根 / 解析失败 / 空输入返回 null', () => {
    expect(sanitizeDecorSvg('')).toBeNull()
    expect(sanitizeDecorSvg('<div>x</div>')).toBeNull()
    expect(sanitizeDecorSvg('<svg><rect></svg>')).toBeNull()
    expect(sanitizeDecorSvg('<svg xmlns="http://www.w3.org/1999/xhtml"></svg>')).toBeNull()
  })

  it('<style>、<script>、<foreignObject>、<a>、<set>、<animate>、<image> 整体剥离', () => {
    const out = sanitizeDecorSvg(
      wrap(
        '<style>rect{fill:url(http://x)}</style><script>alert(1)</script>' +
          '<foreignObject><body onload="alert(1)"/></foreignObject>' +
          '<a href="javascript:alert(1)"><rect width="1" height="1"/></a>' +
          '<set attributeName="onload" to="alert(1)"/>' +
          '<animate attributeName="href" to="javascript:alert(1)"/>' +
          '<image href="http://evil/x.png" width="1" height="1"/>' +
          '<rect width="2" height="2" fill="#000"/>',
      ),
    )
    expect(out).not.toBeNull()
    for (const tag of ['style', 'script', 'foreignObject', 'a', 'set', 'animate', 'image']) {
      expect(out).not.toContain(`<${tag}`)
    }
    expect(out).not.toMatch(/javascript:|onload|evil/)
    // <a> 连同其子 rect 一起被移除，只剩最后一个合法 rect
    expect(out!.match(/<rect/g)).toHaveLength(1)
  })

  it('on* 事件、style 属性、非 #id 的 href/url() 被剥离，#id 引用保留', () => {
    const out = sanitizeDecorSvg(
      wrap(
        '<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs>' +
          '<rect width="1" height="1" onclick="alert(1)" style="fill:red" fill="url(#g)"/>' +
          '<rect width="1" height="1" fill="url(http://x/a.svg#b)" stroke="url(&quot;data:x&quot;)"/>' +
          '<use href="#g" xlink:href="http://evil" xmlns:xlink="http://www.w3.org/1999/xlink"/>',
      ),
    )!
    expect(out).not.toMatch(/onclick|style=|http:\/\/x|evil|data:/)
    expect(out).toContain('fill="url(#g)"')
    expect(out).toContain('href="#g"')
    expect(out).not.toContain('xlink:href')
    expect(out).toContain('id="g"')
  })
})

describe('sanitizeDecorSvg 对内置模板无误杀', () => {
  const decorated = defaultTemplates.filter((t) => t.label.decorSvg)

  it('内置模板含装饰层的数量 > 0', () => {
    expect(decorated.length).toBeGreaterThan(0)
  })

  it.each(decorated.map((t) => [t.id, t.label.decorSvg!] as const))(
    '%s：sanitize 后与原 SVG 语义等价（节点/属性一致）',
    (_id, svg) => {
      const out = sanitizeDecorSvg(svg)
      expect(out).not.toBeNull()
      expect(shape(parse(out!))).toBe(shape(parse(svg)))
      expect(parse(out!).querySelectorAll('*').length).toBe(parse(svg).querySelectorAll('*').length)
    },
  )
})
