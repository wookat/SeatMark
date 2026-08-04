<script setup lang="ts">
import { LEGAL_UPDATED_AT, OPERATOR_NAME } from '@/data/site'
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
    <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Privacy Policy</p>
    <h1 class="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">隐私政策</h1>
    <p class="mt-2 text-xs text-slate-400">生效日期 / 最后更新：{{ LEGAL_UPDATED_AT }}</p>

    <div
      class="mt-6 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3.5"
    >
      <svg
        class="mt-0.5 size-5 shrink-0 text-emerald-600"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
      <p class="text-sm leading-6 font-medium text-emerald-800">
        核心承诺：你导入的 Excel 名单与照片<strong>全部在浏览器本地解析和排版，不会上传到任何服务器</strong>，
        我们无法接触这些数据。页面关闭后名单数据即清空，核心制签功能可完全离线使用。
      </p>
    </div>

    <div class="mt-8 space-y-8 text-sm leading-7 text-slate-600">
      <section>
        <h2 class="text-lg font-bold text-slate-900">引言</h2>
        <p class="mt-2">
          「SeatMark 座签」（官网 www.seatmark.cn，以下简称「本服务」）由 {{ OPERATOR_NAME }}（以下简称「我们」）运营。
          我们依照《中华人民共和国个人信息保护法》《中华人民共和国网络安全法》《中华人民共和国数据安全法》等法律法规制定本政策，
          说明我们如何处理你的个人信息以及你享有的权利。请在使用本服务前仔细阅读。
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">一、不会被收集的数据：名单与照片</h2>
        <ul class="mt-2 list-disc space-y-1.5 pl-5">
          <li>
            <strong>名单与照片：</strong>Excel 解析、照片匹配、标签排版、PDF 生成全部由浏览器内的
            JavaScript 完成，数据只存在于你设备的内存中，不经过网络传输，我们的服务器不会接收、存储这些数据。
          </li>
          <li>
            <strong>自定义模板：</strong>保存的自定义模板存储在你浏览器的
            localStorage 中，仅保存模板版式（不含名单数据），清除浏览器数据即可删除。
          </li>
          <li>
            <strong>模板分享链接：</strong>分享链接将模板版式压缩编码在 URL 片段（# 后的部分）中，
            浏览器不会将该片段发送到服务器。
          </li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">二、我们收集的个人信息类别及用途</h2>
        <p class="mt-2">仅当你主动使用以下可选功能时，我们才会处理对应的少量信息：</p>
        <ul class="mt-2 list-disc space-y-1.5 pl-5">
          <li>
            <strong>邮箱地址（账号功能）：</strong>你使用邮箱验证码登录时，我们收集你的邮箱地址用于身份验证、
            维持登录状态与发送验证码邮件。处理的法律依据是履行与你订立的服务协议。
          </li>
          <li>
            <strong>登录状态凭证：</strong>登录成功后我们通过浏览器 Cookie 保存加密的会话凭证（HttpOnly），
            仅用于维持登录状态，有效期届满或退出登录后失效。
          </li>
          <li>
            <strong>使用配额与分享统计：</strong>为实现每日生成配额与分享奖励功能，我们记录与你的账号（或经单向哈希处理的
            IP 地址）关联的当日生成次数、分享码与分享访问去重计数。哈希后的 IP 不可还原为原始地址。
          </li>
          <li>
            <strong>团队版预订信息：</strong>你在定价页预订团队版时主动提交的邮箱、团队规模与备注，仅用于开通通知与需求沟通。
          </li>
          <li>
            <strong>意见反馈：</strong>你主动提交的反馈内容与选填的联系方式，仅用于改进产品与回复你的问题。
          </li>
        </ul>
        <p class="mt-2">
          我们承诺遵循最小必要原则，不收集与上述功能无关的个人信息，不进行用户画像或个性化推送，不向任何第三方出售你的个人信息。
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">三、可选功能涉及的网络请求</h2>
        <ul class="mt-2 list-disc space-y-1.5 pl-5">
          <li>
            <strong>在线开源字体：</strong>当你选用在线字体时，浏览器会从公共 CDN
            拉取字体文件。该请求不包含你的名单数据。不选用在线字体则核心功能零外部请求。
          </li>
          <li>
            <strong>AI 设计（可选）：</strong>使用 AI 设计时，你输入的设计描述会经我们的同源代理转发至第三方大模型服务，
            仅用于生成模板版式；名单与照片数据不会被发送。不使用该功能则不产生相关请求。
          </li>
          <li>
            <strong>验证码邮件：</strong>登录验证码通过第三方邮件服务发送，仅向其提供收件邮箱与验证码内容。
          </li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">四、Cookie、本地存储与访问统计</h2>
        <ul class="mt-2 list-disc space-y-1.5 pl-5">
          <li>
            <strong>Cookie：</strong>仅在你登录后用于保存会话凭证；未登录状态下本服务自身不使用 Cookie 追踪你的身份。
          </li>
          <li>
            <strong>本地存储（localStorage）：</strong>用于保存你的自定义模板与界面偏好，数据保留在你的设备上，不会发送到服务器。
          </li>
          <li>
            <strong>访问统计：</strong>我们使用 Google Analytics 与百度统计收集匿名的页面访问数据（如访问量、页面停留时长、设备类型），
            用于了解产品使用情况并改进体验，不涉及你导入的任何名单内容。你可以通过浏览器的「请勿追踪」设置或内容拦截扩展限制统计脚本。
          </li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">五、个人信息的存储与保护</h2>
        <ul class="mt-2 list-disc space-y-1.5 pl-5">
          <li>第二条所述个人信息存储于我们境内的云服务节点，不涉及向境外提供个人信息。</li>
          <li>我们采取传输加密（HTTPS）、会话凭证加密签名、IP 单向哈希、访问频率限制等措施保护信息安全。</li>
          <li>个人信息保存期限为实现处理目的所必需的最短时间：账号信息保存至你注销账号；配额与分享去重计数按日滚动过期；反馈与预订信息在处理完毕后定期清理。</li>
          <li>如不幸发生个人信息安全事件，我们将依法履行告知与报告义务。</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">六、你的权利</h2>
        <p class="mt-2">依照《个人信息保护法》，你对自己的个人信息享有以下权利：</p>
        <ul class="mt-2 list-disc space-y-1.5 pl-5">
          <li><strong>查询与复制：</strong>登录后可在账号页查看与你账号关联的邮箱、配额与分享数据。</li>
          <li><strong>更正与补充：</strong>如发现信息有误，可通过站内「反馈」入口联系我们更正。</li>
          <li><strong>删除与注销：</strong>你可以在账号页注销账号，注销后我们将删除与你账号关联的个人信息；也可联系我们协助删除。</li>
          <li><strong>撤回同意：</strong>可选功能（AI 设计、在线字体、反馈等）均可随时停止使用，即撤回对相应处理的同意，不影响核心功能。</li>
          <li><strong>获得解释：</strong>你有权要求我们对个人信息处理规则作出解释说明。</li>
        </ul>
        <p class="mt-2">我们会在收到你的请求后 15 个工作日内响应。</p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">七、未成年人与学生信息保护</h2>
        <ul class="mt-2 list-disc space-y-1.5 pl-5">
          <li>本服务面向考务、教学、会务等场景的成年工作人员，不以未成年人为目标用户。若你未满 14 周岁，请勿注册账号；请在监护人同意与陪同下使用本服务。</li>
          <li>
            考务名单常涉及学生（含未成年人）的姓名、考号、照片等个人信息。本服务采用<strong>本地化处理架构</strong>：
            这些信息全程在名单管理者自己的浏览器中处理，不上传服务器、不经过网络传输，从技术上避免了学生个人信息的对外收集与存储，
            符合《个人信息保护法》第二十八条对未成年人个人信息作为敏感个人信息从严保护的立法精神与《儿童个人信息网络保护规定》的要求。
          </li>
          <li>
            提示：依照《儿童个人信息网络保护规定》，处理不满 14 周岁儿童个人信息应取得其监护人同意。
            名单管理者（学校、机构等）作为名单数据的个人信息处理者，应依法履行相应义务并妥善保管名单文件本身。
          </li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">八、政策更新与联系方式</h2>
        <p class="mt-2">
          本政策可能随功能迭代或法律法规变化更新，更新后会在本页面发布并更新「最后更新」日期，重大变更会在站内显著位置提示。
          对本政策有任何疑问、意见或投诉，可通过站内「反馈」入口联系我们，或在
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

    <div class="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-400">
      相关文档：
      <RouterLink to="/terms" class="text-brand-600 hover:underline">用户协议</RouterLink>
    </div>
  </div>
</template>
