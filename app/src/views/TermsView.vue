<script setup lang="ts">
import { LEGAL_UPDATED_AT, OPERATOR_NAME } from '@/data/site'
import { useI18n } from '@/i18n'

const { locale } = useI18n()
</script>

<template>
  <div v-if="locale === 'en'" lang="en" class="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14" data-testid="legal-en-summary">
    <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Terms of Service</p>
    <h1 class="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Terms of Service (English Summary)</h1>
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
        <RouterLink to="/terms" class="underline decoration-amber-400 underline-offset-2 hover:text-amber-950" data-testid="legal-zh-full-link">
          Read the full Chinese text (用户协议)
        </RouterLink>
      </p>
    </div>

    <div class="mt-8 space-y-8 text-sm leading-7 text-slate-600">
      <section>
        <h2 class="text-lg font-bold text-slate-900">1. What the service is</h2>
        <p class="mt-2">
          SeatMark (www.seatmark.cn) is operated by {{ OPERATOR_NAME }}. It is a batch generator for seat labels,
          place cards, table tents, door signs and ID badges that runs mainly in your browser. Using the service,
          including as a guest, means you accept the Terms. Users under 18 should use it with a guardian's consent.
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">2. Service content and accounts</h2>
        <ul class="mt-2 list-disc space-y-1.5 pl-5">
          <li>Spreadsheet parsing, template design, batch layout, PDF export and printing all happen locally in your browser; the names and photos you import are not uploaded to our servers.</li>
          <li>An optional email + password account raises the daily watermark-free export quota and enables referral rewards; the core features work without signing in.</li>
          <li>The optional AI design feature forwards only your design prompt (never the roster) to a third-party model through our same-origin proxy.</li>
          <li>All features are free during the beta. Any paid plan will be announced on the site in advance and will not affect data saved locally.</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">3. Your responsibilities</h2>
        <ul class="mt-2 list-disc space-y-1.5 pl-5">
          <li>You must have a lawful basis to use the names, photos and other personal data you import, especially for students and other minors; local processing does not change your duties as the data controller.</li>
          <li>You own the labels and PDF files you generate and may use them for teaching, exams, events and commercial purposes.</li>
          <li>You may not use the service for unlawful content, attack, scrape or reverse-engineer it, or abuse export quotas and referral mechanisms.</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">4. Intellectual property, liability and changes</h2>
        <ul class="mt-2 list-disc space-y-1.5 pl-5">
          <li>The software, UI, built-in templates, guides and branding belong to us; bundled open-source fonts keep their own licenses. Names in demo data are fictional.</li>
          <li>The service is provided "as is". Test-print before a production run; we are not liable for indirect losses or for outages caused by your device, network or third-party services, to the extent permitted by law.</li>
          <li>We may update the Terms and will publish changes on this page; continued use means acceptance. Disputes are governed by the laws of the People's Republic of China.</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">5. Contact</h2>
        <p class="mt-2">
          Use the in-app feedback entry or
          <a
            href="https://github.com/wookat/SeatMark/issues"
            target="_blank"
            rel="noopener noreferrer"
            class="text-brand-600 hover:underline"
          >GitHub Issues</a>. We reply within 15 working days.
        </p>
      </section>
    </div>

    <div class="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-600">
      Related:
      <RouterLink to="/en/privacy" class="text-brand-600 hover:underline">Privacy Policy (English summary)</RouterLink>
      ·
      <RouterLink to="/terms" class="text-brand-600 hover:underline">Full Chinese text</RouterLink>
    </div>
  </div>

  <div v-else class="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
    <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Terms of Service</p>
    <h1 class="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">用户协议</h1>
    <p class="mt-2 text-xs text-slate-600">生效日期 / 最后更新：{{ LEGAL_UPDATED_AT }}</p>

    <div class="mt-8 space-y-8 text-sm leading-7 text-slate-600">
      <section>
        <h2 class="text-lg font-bold text-slate-900">一、协议的订立与接受</h2>
        <p class="mt-2">
          欢迎使用「SeatMark 座签」（以下简称「本服务」，官网
          <a href="https://www.seatmark.cn" class="text-brand-600 hover:underline">www.seatmark.cn</a>）。
          本服务由 {{ OPERATOR_NAME }}（以下简称「我们」）运营，是一款主要在浏览器本地运行的座位标签、桌牌席卡、门贴证卡批量生成工具。
        </p>
        <p class="mt-2">
          本协议是你与我们之间就使用本服务订立的具有法律约束力的协议。你访问或使用本服务（包括以游客身份使用），即表示你已阅读、理解并同意接受本协议全部条款；
          若你不同意本协议的任何内容，请立即停止访问和使用本服务。若你未满 18 周岁，请在监护人陪同下阅读本协议，并在取得监护人同意后使用本服务。
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">二、服务内容</h2>
        <ul class="mt-2 list-disc space-y-1.5 pl-5">
          <li>本服务提供 Excel 名单解析、标签模板设计、批量排版、PDF 导出与浏览器打印等功能。</li>
          <li>上述核心制签功能均在你的浏览器本地完成，你导入的名单与照片数据不会上传到我们的服务器（详见<RouterLink to="/privacy" class="text-brand-600 hover:underline">隐私政策</RouterLink>）。</li>
          <li>
            可选的账号功能（邮箱 + 密码注册登录）用于提供更高的每日无水印导出配额、分享奖励等能力；不注册登录也可使用核心功能。
          </li>
          <li>
            可选的「AI 设计」功能会将你输入的设计描述（不含名单数据）经我们的同源代理转发至第三方大模型服务；
            不使用该功能则不会产生任何相关网络请求。
          </li>
          <li>Beta 期间全部功能限时免费开放。正式收费前我们会提前在站内显著位置公告；付费方案上线不影响你已在本地保存的模板与数据。</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">三、账号管理</h2>
        <ul class="mt-2 list-disc space-y-1.5 pl-5">
          <li>你使用邮箱与密码注册即创建账号，应确保所用邮箱为你本人合法持有。</li>
          <li>账号仅限本人使用，请妥善保管邮箱与密码；因你保管不善造成的损失由你自行承担。</li>
          <li>你可以随时在账号页申请注销账号；注销后我们将依照隐私政策删除与你账号关联的信息。</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">四、用户的权利与义务</h2>
        <ul class="mt-2 list-disc space-y-1.5 pl-5">
          <li>你保证向本服务导入的名单、照片等内容拥有合法的来源与使用权，不侵犯任何第三方的合法权益，并对其合法性独立承担全部责任。</li>
          <li>
            若名单涉及他人个人信息（特别是学生等未成年人信息），你应确保已依照《中华人民共和国个人信息保护法》等法律法规取得合法处理依据，
            并妥善保管名单文件本身。本服务的本地化处理架构不改变你作为个人信息处理者的法定义务。
          </li>
          <li>你使用本服务生成的标签打印页、PDF 文件的相关权益归你所有，可自由用于教学、考务、会议等场景（含商业用途）。</li>
          <li>
            你不得利用本服务从事任何违反法律法规、危害网络安全或侵害他人权益的活动，包括但不限于：制作含违法违规内容的标签物料；
            对本服务进行恶意攻击、恶意爬取、逆向破解或以其他方式干扰其正常运行；绕过或滥用无水印导出配额、分享奖励等机制。
          </li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">五、知识产权</h2>
        <p class="mt-2">
          本服务的软件代码、界面设计、内置模板、教程文章、文案与品牌标识等知识产权归我们所有，受著作权法及相关法律保护。
          未经书面许可，任何人不得复制、镜像、反编译或用于开发同类竞争产品。
          本服务内置及可选加载的开源字体（如思源黑体、思源宋体、霞鹜文楷等）遵循其各自的开源许可证（SIL OFL、Apache 2.0 等），相关权利归原作者所有。
          模板与示例中出现的姓名、学校、单位等信息均为虚构演示数据，如有雷同纯属巧合。
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">六、免责声明与责任限制</h2>
        <ul class="mt-2 list-disc space-y-1.5 pl-5">
          <li>本服务按「现状」提供。我们尽力保证排版精度与功能稳定，但不对打印效果与你的具体设备、打印机、纸张的兼容性作出保证，建议正式打印前先行试印。</li>
          <li>因你的浏览器环境、网络状况或第三方服务（如在线字体 CDN、邮件服务、AI 模型服务）造成的功能暂时不可用，我们不承担责任，但会尽合理努力协助恢复。</li>
          <li>在法律允许的范围内，我们对因使用或无法使用本服务造成的间接损失不承担责任；法律法规另有强制性规定的，从其规定。</li>
          <li>本协议任何条款均不排除或限制依法不得排除或限制的责任，亦不影响你作为消费者依法享有的权利。</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">七、协议的变更与服务的中止、终止</h2>
        <p class="mt-2">
          我们可能根据产品迭代或法律法规要求更新本协议，更新后会在本页面发布并更新「最后更新」日期；重大变更会在站内显著位置提示。
          你在协议变更后继续使用本服务，即视为接受修改后的协议；若你不同意变更内容，应停止使用本服务。
          如你严重违反本协议或法律法规，我们有权限制或终止向你提供服务。
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">八、法律适用与争议解决</h2>
        <p class="mt-2">
          本协议的订立、履行与解释适用中华人民共和国法律。因本协议或本服务产生的争议，双方应友好协商解决；
          协商不成的，任何一方均可向{{ OPERATOR_NAME }}所在地有管辖权的人民法院提起诉讼。
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">九、联系我们</h2>
        <p class="mt-2">
          对本协议有任何疑问，可通过站内「反馈」入口联系我们，或在
          <a
            href="https://github.com/wookat/SeatMark/issues"
            target="_blank"
            rel="noopener noreferrer"
            class="text-brand-600 hover:underline"
          >GitHub Issues</a>
          留言。我们会在收到后 15 个工作日内答复。
        </p>
      </section>
    </div>

    <div class="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-600">
      相关文档：
      <RouterLink to="/privacy" class="text-brand-600 hover:underline">隐私政策</RouterLink>
    </div>
  </div>
</template>
