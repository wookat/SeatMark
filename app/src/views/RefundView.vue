<script setup lang="ts">
import { LEGAL_UPDATED_AT, OPERATOR_NAME } from '@/data/site'
import { useI18n } from '@/i18n'

const { locale } = useI18n()
</script>

<template>
  <div v-if="locale === 'en'" lang="en" class="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14" data-testid="legal-en-summary">
    <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Refund Policy</p>
    <h1 class="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Refund Policy (English Summary)</h1>
    <p class="mt-2 text-xs text-slate-600">Effective / last updated: {{ LEGAL_UPDATED_AT }}</p>

    <div
      role="note"
      class="mt-6 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3.5 text-sm leading-6 text-amber-900"
      data-testid="legal-en-disclaimer"
    >
      <p>
        This page is a convenience summary in English. <strong>The Chinese version is the legally binding text.</strong>
        Where this summary and the Chinese text differ, the Chinese text prevails.
      </p>
      <p class="mt-1.5 font-semibold">
        <RouterLink to="/refund" class="underline decoration-amber-400 underline-offset-2 hover:text-amber-950" data-testid="legal-zh-full-link">
          Read the full Chinese text (退款政策)
        </RouterLink>
      </p>
    </div>

    <div class="mt-8 space-y-8 text-sm leading-7 text-slate-600">
      <section>
        <h2 class="text-lg font-bold text-slate-900">1. Try before you pay</h2>
        <p class="mt-2">
          SeatMark is free-first: layout, printing and watermarked exports are unlimited for everyone, and
          watermark-free exports have a free daily quota (higher after sign-in). Please confirm the output fits
          your printer and paper before purchasing a paid plan.
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">2. Refunds for paid plans</h2>
        <ul class="mt-2 list-disc space-y-1.5 pl-5">
          <li>Paid plans are digital services delivered immediately on payment.</li>
          <li>You may request a full refund within <strong>14 days</strong> of purchase if the membership benefits have not been substantially used; after that window, or where benefits have been substantially used, refunds are assessed case by case.</li>
          <li>Duplicate or mistaken payments are refunded in full whenever reported.</li>
          <li>Refund requests that follow chargeback fraud or abuse may be declined.</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">3. How refunds are processed</h2>
        <ul class="mt-2 list-disc space-y-1.5 pl-5">
          <li>Refunds go back to the original payment method — Alipay orders return to your Alipay account; international orders paid through our Merchant of Record (Paddle) are returned to the original card or account by Paddle.</li>
          <li>Alipay refunds typically arrive within 1–7 working days; card refunds via Paddle depend on your bank and can take 5–10 working days.</li>
          <li>When a refund is issued, the corresponding membership days are revoked.</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">4. How to request a refund</h2>
        <p class="mt-2">
          Email
          <a href="mailto:wookat@qq.com" class="text-brand-600 hover:underline">wookat@qq.com</a>
          with your order number (or the email you paid with) and the reason — no lengthy justification needed.
          We reply within 15 working days, usually much sooner.
        </p>
      </section>
    </div>

    <div class="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-600">
      Related:
      <RouterLink to="/en/terms" class="text-brand-600 hover:underline">Terms of Service (English summary)</RouterLink>
      ·
      <RouterLink to="/en/privacy" class="text-brand-600 hover:underline">Privacy Policy (English summary)</RouterLink>
      ·
      <RouterLink to="/refund" class="text-brand-600 hover:underline">Full Chinese text</RouterLink>
    </div>
  </div>

  <div v-else class="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
    <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Refund Policy</p>
    <h1 class="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">退款政策</h1>
    <p class="mt-2 text-xs text-slate-600">生效日期 / 最后更新：{{ LEGAL_UPDATED_AT }}</p>

    <div class="mt-8 space-y-8 text-sm leading-7 text-slate-600">
      <section>
        <h2 class="text-lg font-bold text-slate-900">一、先试用，再付费</h2>
        <p class="mt-2">
          「SeatMark 座签」由 {{ OPERATOR_NAME }} 运营，采取免费优先的策略：排版、打印与带水印导出不限次数，
          无水印导出设有每日免费额度（登录后更高），模板与核心功能全部免费开放。
          请在购买付费方案前先用免费功能确认排版与打印效果符合你的纸张和打印机。
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">二、付费方案的退款规则</h2>
        <ul class="mt-2 list-disc space-y-1.5 pl-5">
          <li>专业版、团队版等付费方案属于支付后立即开通的数字服务，会员天数实时发放到账号。</li>
          <li>支付成功后 <strong>14 天内</strong>，若会员权益未被实质使用（如未进行无水印导出、未使用定制服务），可申请全额退款；超过 14 天或权益已实质使用的，按个案协商处理。</li>
          <li>重复支付、误支付订单一经核实即全额退款，不受上述时间限制。</li>
          <li>因滥用、欺诈性拒付等异常情形提出的退款申请，我们有权拒绝。</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">三、退款方式与到账时间</h2>
        <ul class="mt-2 list-disc space-y-1.5 pl-5">
          <li>退款原路返回：支付宝订单退回付款的支付宝账户；通过国际收单（Paddle 等销售方代理商）支付的订单，由收单方退回原付款卡或账户。</li>
          <li>支付宝退款一般 1–7 个工作日到账；银行卡退款视发卡行通常需 5–10 个工作日。</li>
          <li>退款生效后，相应的会员天数将被回收；已生成的本地模板与文件不受影响。</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">四、如何申请退款</h2>
        <p class="mt-2">
          发送邮件至
          <a href="mailto:wookat@qq.com" class="text-brand-600 hover:underline">wookat@qq.com</a>，
          注明订单号（或付款所用邮箱）与退款原因即可，无需繁琐说明；
          也可通过站内「反馈」入口或微信 <span class="font-semibold">HERUOZAI</span> 联系。
          我们会在 15 个工作日内答复，通常更快。
        </p>
      </section>
    </div>

    <div class="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-600">
      相关文档：
      <RouterLink to="/terms" class="text-brand-600 hover:underline">用户协议</RouterLink>
      ·
      <RouterLink to="/privacy" class="text-brand-600 hover:underline">隐私政策</RouterLink>
    </div>
  </div>
</template>
