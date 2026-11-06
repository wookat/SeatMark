/**
 * 转化事件埋点：GA4（gtag 'event'）与百度统计（_trackEvent）双通道。
 *
 * 两个统计脚本都在 window load 后由 index.html 懒注入，此前触发的事件只进
 * 缓冲队列（dataLayer / _hmt），脚本就绪后自动补发；脚本被拦截时静默丢弃。
 * 上报内容一律不含用户输入（名单、搜索词、邮箱、姓名），与 telemetryPath 同口径。
 */

export interface TrackEventInput {
  /** GA4 事件名：snake_case；认证/电商沿用标准事件（sign_up / login / begin_checkout / purchase） */
  event: string
  /** 事件分组：百度 _trackEvent 的 category，同时作 GA4 event_category 参数 */
  category: 'auth' | 'export' | 'share' | 'pay' | 'feedback'
  /** 事件细目：百度 opt_label 与 GA4 event_label（套餐 / 导出格式 / 分享渠道） */
  label?: string
  /** 数值指标：百度 opt_value 与 GA4 value（金额 / 天数 / 页数） */
  value?: number
  /** GA4 附加维度（currency / transaction_id / watermark 等），不含敏感信息 */
  params?: Record<string, string | number | boolean>
}

export function trackEvent({ event, category, label, value, params }: TrackEventInput): void {
  try {
    if (typeof window.gtag === 'function') {
      window.gtag('event', event, {
        event_category: category,
        ...(label !== undefined ? { event_label: label } : {}),
        ...(value !== undefined ? { value } : {}),
        ...params,
      })
    }
  } catch {
    // 统计通道异常不影响业务
  }
  try {
    if (Array.isArray(window._hmt)) {
      window._hmt.push(['_trackEvent', category, event, label ?? '', value])
    }
  } catch {
    // 统计通道异常不影响业务
  }
}
