/**
 * 设计器矢量图标库：24 viewBox 线性图标（stroke 风格）。
 * 插入标签时序列化为 SVG data URL 写入图片字段 imageSrc，
 * 矢量嵌入模板，打印 / 导出不失真，且不依赖任何网络资源。
 */

export interface VectorIcon {
  id: string
  name: string
  /** SVG 内部元素（path / circle / rect），stroke 继承外层 svg */
  body: string
}

export const VECTOR_ICONS: VectorIcon[] = [
  {
    id: 'star',
    name: '星形',
    body: '<path d="M12 3l2.7 5.7 6.3.9-4.6 4.4 1.1 6.2L12 17.2 6.5 20.2l1.1-6.2L3 9.6l6.3-.9L12 3z"/>',
  },
  {
    id: 'check-circle',
    name: '对勾',
    body: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16.5 9"/>',
  },
  {
    id: 'alert',
    name: '警示',
    body: '<path d="M12 4 2.5 20h19L12 4z"/><path d="M12 10.5v4M12 17.3h.01"/>',
  },
  {
    id: 'info',
    name: '信息',
    body: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8h.01"/>',
  },
  {
    id: 'pin',
    name: '定位',
    body: '<path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  },
  {
    id: 'clock',
    name: '时钟',
    body: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  },
  {
    id: 'calendar',
    name: '日历',
    body: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  },
  {
    id: 'pencil',
    name: '铅笔',
    body: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  },
  {
    id: 'book',
    name: '书本',
    body: '<path d="M4 19.5V5a2 2 0 0 1 2-2h14v17H6.5A2.5 2.5 0 0 0 4 19.5zm0 0A2.5 2.5 0 0 1 6.5 17H20"/>',
  },
  {
    id: 'grad-cap',
    name: '学位帽',
    body: '<path d="M22 9 12 4 2 9l10 5 10-5z"/><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5M22 9v5"/>',
  },
  {
    id: 'trophy',
    name: '奖杯',
    body: '<path d="M7 4h10v6a5 5 0 0 1-10 0V4z"/><path d="M17 5h3a4 4 0 0 1-4 5M7 5H4a4 4 0 0 0 4 5M12 15v4M8 21h8"/>',
  },
  {
    id: 'flag',
    name: '旗帜',
    body: '<path d="M5 21V4"/><path d="M5 4.5c4.5-2.2 9 2.2 14 0V13c-5 2.2-9.5-2.2-14 0"/>',
  },
  {
    id: 'bell',
    name: '铃铛',
    body: '<path d="M18 9.5a6 6 0 1 0-12 0c0 6.5-2.5 7.5-2.5 7.5h17S18 16 18 9.5"/><path d="M10.3 20.5a2 2 0 0 0 3.4 0"/>',
  },
  {
    id: 'shield',
    name: '盾牌',
    body: '<path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3z"/><path d="m8.8 11.8 2.2 2.2 4.2-4.8"/>',
  },
  {
    id: 'user',
    name: '人像',
    body: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20c1.4-3.3 4.3-5 7.5-5s6.1 1.7 7.5 5"/>',
  },
  {
    id: 'users',
    name: '多人',
    body: '<circle cx="9" cy="7.5" r="3.5"/><path d="M2.5 19.5c1.1-2.8 3.6-4.3 6.5-4.3s5.4 1.5 6.5 4.3M15.5 4.2a3.5 3.5 0 0 1 0 6.6M18.5 15.4c1.5.7 2.6 1.9 3.2 4.1"/>',
  },
  {
    id: 'heart',
    name: '爱心',
    body: '<path d="M12 20S4 14.7 4 9.2a4.4 4.4 0 0 1 8-2.6 4.4 4.4 0 0 1 8 2.6C20 14.7 12 20 12 20z"/>',
  },
  {
    id: 'ban',
    name: '禁止',
    body: '<circle cx="12" cy="12" r="9"/><path d="m5.8 5.8 12.4 12.4"/>',
  },
  {
    id: 'phone-ban',
    name: '禁用手机',
    body: '<rect x="7.5" y="2.5" width="9" height="19" rx="2"/><path d="M11 18.5h2M4 4l16 16"/>',
  },
  {
    id: 'camera',
    name: '相机',
    body: '<path d="M3.5 7.5h3.4L9 5h6l2.1 2.5h3.4v12h-17v-12z"/><circle cx="12" cy="13" r="3.5"/>',
  },
  {
    id: 'id-card',
    name: '证件',
    body: '<rect x="3" y="5" width="18" height="14.5" rx="2"/><circle cx="8.5" cy="11" r="2"/><path d="M5.8 16.2c.6-1.4 1.6-2 2.7-2s2.1.6 2.7 2M14 9.5h4.5M14 12.7h4.5M14 15.9h3"/>',
  },
  {
    id: 'arrow-right',
    name: '箭头',
    body: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  },
  {
    id: 'scissors',
    name: '剪刀',
    body: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 7.6 20 19M8 16.4 20 5"/>',
  },
  {
    id: 'home',
    name: '房屋',
    body: '<path d="m3 11 9-7.5L21 11"/><path d="M5.5 9.5V20h13V9.5"/>',
  },
]

/** 把图标渲染成内嵌 SVG data URL（stroke 颜色在生成时固化） */
export function iconDataUrl(icon: VectorIcon, color: string, strokeWidth = 1.8): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ` +
    `stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">` +
    `${icon.body}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
