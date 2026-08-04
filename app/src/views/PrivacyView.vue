<script setup lang="ts">
const UPDATED_AT = '2026-08-04'
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
    <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Privacy Policy</p>
    <h1 class="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">隐私政策</h1>
    <p class="mt-2 text-xs text-slate-400">最后更新：{{ UPDATED_AT }}</p>

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
        核心承诺：你上传的 Excel 名单与照片<strong>全部在浏览器本地解析和排版，不会上传到任何服务器</strong>。
        页面关闭后数据即清空，本服务可完全离线使用。
      </p>
    </div>

    <div class="mt-8 space-y-8 text-sm leading-7 text-slate-600">
      <section>
        <h2 class="text-lg font-bold text-slate-900">一、我们如何处理你的数据</h2>
        <ul class="mt-2 list-disc space-y-1.5 pl-5">
          <li>
            <strong>名单与照片：</strong>Excel 解析、照片匹配、标签排版、PDF 生成全部由浏览器内的
            JavaScript 完成，数据只存在于你设备的内存中，不经过网络传输，我们无法接触到这些数据。
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
        <h2 class="text-lg font-bold text-slate-900">二、可选功能涉及的网络请求</h2>
        <ul class="mt-2 list-disc space-y-1.5 pl-5">
          <li>
            <strong>在线开源字体：</strong>当你选用在线字体时，浏览器会从公共 CDN
            拉取字体文件。该请求不包含你的名单数据。不选用在线字体则完全零外部请求。
          </li>
          <li>
            <strong>AI 设计（可选）：</strong>使用 AI 设计时，你输入的设计描述会经我们的同源代理转发至第三方大模型服务，
            仅用于生成模板版式；名单与照片数据不会被发送。不使用该功能则不产生相关请求。
          </li>
          <li>
            <strong>意见反馈（可选）：</strong>你主动提交的反馈内容会发送给我们，仅用于改进产品。
          </li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">三、访问统计</h2>
        <p class="mt-2">
          我们使用 Google Analytics 与百度统计收集匿名的页面访问数据（如访问量、页面停留时长、设备类型），
          用于了解产品使用情况并改进体验。这些统计不涉及你导入的任何名单内容。
          你可以通过浏览器的「请勿追踪」设置或内容拦截扩展限制统计脚本。
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">四、Cookie 与本地存储</h2>
        <p class="mt-2">
          本服务自身不使用 Cookie 进行身份追踪，无需注册登录。浏览器本地存储（localStorage）仅用于保存你的自定义模板与界面偏好，
          这些数据不会被发送到服务器。
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">五、未成年人保护</h2>
        <p class="mt-2">
          本服务面向考务、教学等场景的成年工作人员。由于名单数据全程本地处理，我们不会收集、存储任何学生（含未成年人）的个人信息。
          请名单管理者依照相关法律法规妥善保管名单文件本身。
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">六、政策更新与联系方式</h2>
        <p class="mt-2">
          本政策可能随功能迭代更新，更新后会在本页面发布并标注最后更新日期。对本政策有任何疑问，
          可通过站内「反馈」入口联系我们，或在
          <a
            href="https://github.com/wookat/SeatMark/issues"
            target="_blank"
            rel="noopener noreferrer"
            class="text-brand-600 hover:underline"
          >GitHub Issues</a>
          留言。
        </p>
      </section>
    </div>

    <div class="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-400">
      相关文档：
      <RouterLink to="/terms" class="text-brand-600 hover:underline">用户协议</RouterLink>
    </div>
  </div>
</template>
