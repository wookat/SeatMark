// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import FitSuggestionBanner from '@/components/studio/FitSuggestionBanner.vue'
import QuotaLimitDialog from '@/components/ui/QuotaLimitDialog.vue'
import WeChatGuideOverlay from '@/components/ui/WeChatGuideOverlay.vue'
import { findLabelPaper } from '@/data/labelPapers'
import { setLocale } from '@/i18n'
import { QUOTA_USER_DAILY, useQuotaStore } from '@/stores/quota'
import { useTemplateLibrary } from '@/stores/templateLibrary'
import { useToastStore } from '@/stores/toast'
import { useWorkspaceStore } from '@/stores/workspace'
import { applyLabelPaper } from '@/utils/labelPaper'
import { evaluatePaperFit, FIT_LEVEL_LABELS } from '@/utils/paperFit'
import { tFitReason } from '@/utils/paperFitI18n'

const CJK = /[\u4e00-\u9fff]/

function ariaLabels(html: string): string[] {
  return [...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!)
}

async function makeRouter(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push(path)
  await router.isReady()
  return router
}

describe('第 341 轮：QuotaLimitDialog 英文化', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })
  afterEach(async () => {
    await setLocale('zh')
  })

  it('en：打开后 text 无 CJK、包含 QUOTA_USER_DAILY 数字，登录链接指向 /en/account', async () => {
    await setLocale('en')
    const router = await makeRouter('/en/studio')
    const quota = useQuotaStore()
    quota.limitDialogOpen = true
    const w = mount(QuotaLimitDialog, {
      global: { plugins: [router], stubs: { Teleport: true, Transition: true } },
    })
    await w.vm.$nextTick()
    expect(w.text()).toContain('Daily watermark-free exports used up')
    expect(w.text()).toContain(`${QUOTA_USER_DAILY} watermark-free exports per day`)
    expect(w.text()).not.toMatch(CJK)
    expect(ariaLabels(w.html()).join(' ')).not.toMatch(CJK)
    const hrefs = w.findAll('a').map((a) => a.attributes('href'))
    expect(hrefs.length).toBeGreaterThan(0)
    for (const h of hrefs) expect(h).toBe('/en/account')
  })

  it('zh：标题/阶梯/按钮文案与现状一致（含 N 次插值）', async () => {
    await setLocale('zh')
    const router = await makeRouter('/studio')
    const quota = useQuotaStore()
    quota.limitDialogOpen = true
    const w = mount(QuotaLimitDialog, {
      global: { plugins: [router], stubs: { Teleport: true, Transition: true } },
    })
    await w.vm.$nextTick()
    expect(w.text()).toContain('今日无水印导出次数已用完')
    expect(w.text()).toContain(`登录后每天 ${QUOTA_USER_DAILY} 次无水印导出`)
    expect(w.text()).toContain('分享被点开 1 次再 +1 次（每日最多 10 次）')
    expect(w.text()).toContain('带水印导出永远免费、不限次数')
    expect(w.text()).toContain(`免费登录，每天 ${QUOTA_USER_DAILY} 次无水印导出`)
    expect(w.text()).toContain('登录后可分享送次数')
    for (const a of w.findAll('a')) expect(a.attributes('href')).toBe('/account')
  })
})

describe('第 341 轮：FitSuggestionBanner 与 paperFit 展示层翻译', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })
  afterEach(async () => {
    await setLocale('zh')
  })

  /** 从库中选一个与 38.1×21.2 小格「勉强/不适配」的内置模板，再强制套用 65 格纸型制造错配 */
  function forceMismatch() {
    const workspace = useWorkspaceStore()
    const library = useTemplateLibrary()
    const tiny = findLabelPaper('a4-65up-round')!
    const design = library.allTemplates.find((tpl) => {
      const level = evaluatePaperFit(tpl, tiny).level
      return level === 'marginal' || level === 'incompatible'
    })
    expect(design).toBeTruthy()
    workspace.selectTemplate(design!, { silent: true })
    const fit = evaluatePaperFit(design!, tiny)
    applyLabelPaper(workspace.template, tiny)
    return { tiny, fit }
  }

  it('en：错配提示条无 CJK，一键切换后 toast 为英文', async () => {
    await setLocale('en')
    forceMismatch()
    const w = mount(FitSuggestionBanner)
    await w.vm.$nextTick()
    expect(w.find('[role="status"]').exists()).toBe(true)
    expect(w.text()).not.toMatch(CJK)
    expect(w.text()).toContain('Fit between this template and')

    const btn = w.find('button')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toBe('Switch to recommended paper')
    await btn.trigger('click')
    const toasts = useToastStore().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0]!.title).toBe('Switched to the recommended paper')
    expect(`${toasts[0]!.title} ${toasts[0]!.text ?? ''}`).not.toMatch(CJK)
  })

  it('zh：错配提示条文案与现状一致（原文 reason 原样展示）', async () => {
    await setLocale('zh')
    const { tiny, fit } = forceMismatch()
    const w = mount(FitSuggestionBanner)
    await w.vm.$nextTick()
    expect(w.text()).toContain(`当前模板与纸型「${tiny.name}」适配度：${FIT_LEVEL_LABELS[fit.level]}`)
    expect(w.text()).toContain(fit.reason)
    expect(tFitReason(fit.reason)).toBe(fit.reason)
  })

  it('tFitReason：en 下按句式翻译并保留尺寸/倍数插值，未命中句式回退原文', async () => {
    await setLocale('en')
    expect(tFitReason('单格 70×40mm 与模板设计尺寸 90×54mm 相近，等比微调后可用')).toBe(
      'Cell 70×40mm is close to the design size 90×54mm; usable after proportional fine-tuning',
    )
    expect(tFitReason('单格仅 38.1×21.2mm，模板需整体缩小约 2.4 倍，文字可能过小难以辨认')).toBe(
      'Cell is only 38.1×21.2mm; the template would shrink about 2.4×, so text may become too small to read',
    )
    expect(tFitReason('该模板为整页/折叠设计，不适合 65 格小标签纸型')).toBe(
      'This template is a full-page / folded design and does not suit 65-cell label sheets',
    )
    expect(tFitReason('整版纸型与整页/折叠模板天然匹配')).not.toMatch(CJK)
    expect(tFitReason('完全陌生的原因文案')).toBe('完全陌生的原因文案')
  })
})

describe('第 341 轮：WeChatGuideOverlay 英文化', () => {
  afterEach(async () => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
    await setLocale('zh')
  })

  function mountInWeChat() {
    vi.stubGlobal('navigator', { ...navigator, userAgent: 'Mozilla/5.0 MicroMessenger/8.0' })
    return mount(WeChatGuideOverlay, { global: { stubs: { Teleport: true } } })
  }

  it('en：标题/说明/按钮/aria-label 无 CJK', async () => {
    await setLocale('en')
    sessionStorage.clear()
    const w = mountInWeChat()
    await w.vm.$nextTick()
    expect(w.find('[role="dialog"]').exists()).toBe(true)
    expect(w.text()).toContain('You are viewing SeatMark inside WeChat')
    expect(w.text()).toContain('Got it, keep browsing')
    expect(w.text()).not.toMatch(CJK)
    expect(ariaLabels(w.html())).toContain('WeChat in-app browser notice')
  })

  it('zh：文案与现状一致', async () => {
    await setLocale('zh')
    sessionStorage.clear()
    const w = mountInWeChat()
    await w.vm.$nextTick()
    expect(w.text()).toContain('你正在微信中打开 SeatMark')
    expect(w.text()).toContain('我知道了，继续浏览')
    expect(ariaLabels(w.html())).toContain('微信内浏览提示')
  })
})
