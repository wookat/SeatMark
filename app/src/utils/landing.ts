import type { Router } from 'vue-router'

import { SHARE_SHORT_PARAM } from '@/utils/share'

export const SHARE_REF_PARAM = 'ref'

/**
 * 清除落地参数（?ref= 分享码 / ?s= 模板短码）。
 * vue-router 的初始导航会以完整初始 URL 覆盖此前的 history.replaceState，
 * 因此必须等 router.isReady() 之后再用 router.replace 移除这两个参数，
 * 保留其余 query 与 hash，避免刷新后欢迎横幅重现、访问重复上报。
 */
export async function clearLandingQuery(router: Router): Promise<void> {
  await router.isReady()
  const route = router.currentRoute.value
  if (!(SHARE_REF_PARAM in route.query) && !(SHARE_SHORT_PARAM in route.query)) return
  const query = { ...route.query }
  delete query[SHARE_REF_PARAM]
  delete query[SHARE_SHORT_PARAM]
  await router.replace({ query, hash: route.hash })
}
