// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import CalibrationDialog from '@/components/studio/CalibrationDialog.vue'
import DuplexGuideDialog from '@/components/studio/DuplexGuideDialog.vue'
import FontPicker from '@/components/studio/FontPicker.vue'
import { WEB_FONTS } from '@/data/fonts'
import { setLocale } from '@/i18n'

const CJK = /[\u4e00-\u9fff]/
const CJK_ALL = /[\u4e00-\u9fff]+/g

const modalStubs = { Teleport: true, Transition: true }

function ariaLabels(html: string): string[] {
  return [...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!)
}

function placeholders(html: string): string[] {
  return [...html.matchAll(/placeholder="([^"]*)"/g)].map((m) => m[1]!)
}

/** 去掉字体名后的剩余文本（字体名本身按需求不翻译） */
function stripFontNames(text: string): string {
  let out = text
  const names = WEB_FONTS.map((f) => f.name).sort((a, b) => b.length - a.length)
  for (const name of names) out = out.split(name).join(' ')
  return out
}

describe('第 341 轮：工坊打印引导与字体选择器英文化', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })
  afterEach(async () => {
    await setLocale('zh')
  })

  describe('CalibrationDialog', () => {
    it('en：open=true 后 text/aria-label 无 CJK，教程链接文字为 troubleshooting guide (Chinese) 且 href 仍为中文教程', async () => {
      await setLocale('en')
      const w = mount(CalibrationDialog, { props: { open: true }, global: { stubs: modalStubs } })
      await w.vm.$nextTick()
      expect(w.text()).toContain('Print calibration wizard')
      expect(w.text()).toContain('Print the ruler calibration page (A4 portrait)')
      expect(w.text()).not.toMatch(CJK)
      expect(ariaLabels(w.html()).join(' ')).not.toMatch(CJK)
      const guide = w.find('a[href="/guides/print-offset-calibration-wizard"]')
      expect(guide.exists()).toBe(true)
      expect(guide.text()).toBe('troubleshooting guide (Chinese)')
    })

    it('zh：文案与现状一致', async () => {
      await setLocale('zh')
      const w = mount(CalibrationDialog, { props: { open: true }, global: { stubs: modalStubs } })
      await w.vm.$nextTick()
      const text = w.text()
      expect(text).toContain('打印校准向导')
      expect(text).toContain('打印标尺校准页（A4 纵向）')
      expect(text).toContain('下载并用目标打印机打印这一页：缩放选「实际大小 / 100%」，不要选「适应页面」，边距设为无。')
      expect(text).toContain('用直尺量取 4 个实测值（mm）')
      expect(text).toContain('设计值：基准框距纸张左、上边缘各 20 mm，框宽 170 mm、框高 257 mm。请量取打印出来的实际值：')
      expect(text).toContain('实测值与设计值一致，无需补偿——你的打印机很准。')
      expect(text).toContain('保存并全局应用')
      expect(w.find('a[href="/guides/print-offset-calibration-wizard"]').text()).toBe('打印偏移排障教程')
    })
  })

  describe('DuplexGuideDialog', () => {
    it('en：open=true 后 text 无 CJK，含长边/短边翻转与两个操作按钮', async () => {
      await setLocale('en')
      const w = mount(DuplexGuideDialog, { props: { open: true }, global: { stubs: modalStubs } })
      await w.vm.$nextTick()
      expect(w.text()).toContain('Duplex / fold-over printing guide')
      expect(w.text()).toContain('Flip on long edge')
      expect(w.text()).toContain('Flip on short edge')
      expect(w.text()).toContain('Got it, continue printing')
      expect(w.text()).toContain('Cancel')
      expect(w.text()).not.toMatch(CJK)
      expect(ariaLabels(w.html()).join(' ')).not.toMatch(CJK)
    })

    it('zh：文案与现状一致', async () => {
      await setLocale('zh')
      const w = mount(DuplexGuideDialog, { props: { open: true }, global: { stubs: modalStubs } })
      await w.vm.$nextTick()
      const text = w.text()
      expect(text).toContain('双面 / 对折打印引导')
      expect(text).toContain('长边翻转')
      expect(text).toContain('短边翻转')
      expect(text).toContain('像翻书一样沿长边翻页。')
      expect(text).toContain('我已了解，继续打印')
      expect(text).toContain('取消')
    })
  })

  describe('FontPicker', () => {
    it('en：默认项/分组/搜索框/徽标/底部说明为英文，除字体名外无 CJK', async () => {
      await setLocale('en')
      const w = mount(FontPicker, { props: { modelValue: undefined }, global: { stubs: modalStubs } })
      await w.vm.$nextTick()
      expect(w.text()).toContain('SimSun (system default)')
      await w.find('button').trigger('click')
      await w.vm.$nextTick()
      const text = w.text()
      expect(text).toContain('Chinese system fonts · offline')
      expect(text).toContain('Latin system fonts · offline')
      expect(text).toContain('Chinese open-source fonts · loaded online')
      expect(text).toContain('Latin open-source fonts · loaded online')
      expect(text).toContain('System fonts render locally')
      expect(stripFontNames(text)).not.toMatch(CJK)
      expect(placeholders(w.html())).toContain('Search fonts (e.g. Kai / Noto / Serif)')
      expect(ariaLabels(w.html()).join(' ')).not.toMatch(CJK)
      // 字体名保留原文（不翻译）
      expect(text).toContain('思源黑体')
      expect(text).toContain('Times New Roman')

      const input = w.find('input')
      await input.setValue('zzz-not-a-font')
      expect(w.text()).toContain('No fonts match “zzz-not-a-font”')
      expect(w.text()).not.toMatch(CJK)
    })

    it('en + lang=en：仅西文字体时整体无 CJK', async () => {
      await setLocale('en')
      const w = mount(FontPicker, {
        props: { modelValue: undefined, lang: 'en', defaultLabel: '跟随中文字体' },
        global: { stubs: modalStubs },
      })
      expect(w.text()).toContain('Follow Chinese font')
      await w.find('button').trigger('click')
      await w.vm.$nextTick()
      expect(w.text()).not.toMatch(CJK)
      expect(w.text().match(CJK_ALL)).toBeNull()
    })

    it('zh：默认项/分组/说明与现状一致', async () => {
      await setLocale('zh')
      const w = mount(FontPicker, { props: { modelValue: undefined }, global: { stubs: modalStubs } })
      expect(w.text()).toContain('宋体（系统默认）')
      await w.find('button').trigger('click')
      await w.vm.$nextTick()
      const text = w.text()
      expect(text).toContain('中文系统字体 · 无需联网')
      expect(text).toContain('西文系统字体 · 无需联网')
      expect(text).toContain('中文开源字体 · 联网加载')
      expect(text).toContain('英文开源字体 · 联网加载')
      expect(text).toContain('系统字体本机直接渲染；开源字体来自公共 CDN 按需联网加载，可免费商用')
      expect(placeholders(w.html())).toContain('搜索字体（如：楷体 / Noto / Serif）')
      await w.find('input').setValue('zzz-not-a-font')
      expect(w.text()).toContain('没有匹配「zzz-not-a-font」的字体')
    })
  })
})
