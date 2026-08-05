/** 微信内置浏览器 UA 检测（micromessenger）；不含微信开发者工具 */
export function isWeChatBrowser(ua?: string): boolean {
  const value = ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  return /micromessenger/i.test(value)
}

/** 微信引导浮层「本次会话已看过」的 sessionStorage 键 */
export const WECHAT_GUIDE_SEEN_KEY = 'seatmark.wechat-guide-seen.v1'
