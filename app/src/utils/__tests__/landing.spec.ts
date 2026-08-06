import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { clearLandingQuery } from '@/utils/landing'

function makeRouter(initialUrl: string): Router {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/studio', component: { template: '<div />' } },
    ],
  })
  void router.push(initialUrl)
  return router
}

describe('clearLandingQuery（落地参数清除：?ref= / ?s=）', () => {
  it('router 就绪后移除 ?ref=，保留其余 query 与 hash（刷新不再重现横幅/重复上报）', async () => {
    const router = makeRouter('/?ref=abcd1234&utm_source=wechat#tpl=v1.abc')
    await clearLandingQuery(router)

    const route = router.currentRoute.value
    expect(route.query.ref).toBeUndefined()
    expect(route.query.utm_source).toBe('wechat')
    expect(route.hash).toBe('#tpl=v1.abc')
    expect(route.fullPath).not.toContain('ref=')
  })

  it('移除 ?s= 模板短码参数', async () => {
    const router = makeRouter('/?s=Ab3xYz12&foo=1')
    await clearLandingQuery(router)

    const route = router.currentRoute.value
    expect(route.query.s).toBeUndefined()
    expect(route.query.foo).toBe('1')
  })

  it('同时携带 ?ref= 与 ?s= 时一并清除', async () => {
    const router = makeRouter('/?ref=abcd1234&s=Ab3xYz12')
    await clearLandingQuery(router)

    expect(router.currentRoute.value.fullPath).toBe('/')
  })

  it('无落地参数时不触发多余导航', async () => {
    const router = makeRouter('/?keep=1')
    await router.isReady()
    const before = router.currentRoute.value.fullPath
    await clearLandingQuery(router)
    expect(router.currentRoute.value.fullPath).toBe(before)
  })
})
