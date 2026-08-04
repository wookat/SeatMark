<script setup lang="ts">
const UPDATED_AT = '2026-08-04'
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
    <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Terms of Service</p>
    <h1 class="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">用户协议</h1>
    <p class="mt-2 text-xs text-slate-400">最后更新：{{ UPDATED_AT }}</p>

    <div class="mt-8 space-y-8 text-sm leading-7 text-slate-600">
      <section>
        <h2 class="text-lg font-bold text-slate-900">一、协议的接受</h2>
        <p class="mt-2">
          欢迎使用 SeatMark 座签（以下简称「本服务」，官网
          <a href="https://www.seatmark.cn" class="text-brand-600 hover:underline">www.seatmark.cn</a>）。
          本服务是一款在浏览器本地运行的座位标签、桌牌席卡、门贴证卡批量生成工具。
          你访问或使用本服务，即表示你已阅读、理解并同意接受本协议全部条款。若你不同意本协议的任何内容，请停止使用本服务。
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">二、服务内容</h2>
        <ul class="mt-2 list-disc space-y-1.5 pl-5">
          <li>本服务提供 Excel 名单解析、标签模板设计、批量排版、PDF 导出与浏览器打印等功能。</li>
          <li>上述核心功能均在你的浏览器本地完成，名单与照片数据不会上传到我们的服务器。</li>
          <li>
            可选的「AI 设计」功能会将你输入的设计描述（不含名单数据）经我们的同源代理转发至第三方大模型服务；
            不使用该功能则不会产生任何相关网络请求。
          </li>
          <li>Beta 期间全部功能限时免费开放。正式收费前我们会提前在站内公告。</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">三、用户的权利与义务</h2>
        <ul class="mt-2 list-disc space-y-1.5 pl-5">
          <li>你保证向本服务导入的名单、照片等内容拥有合法的使用权，并对其合法性独立承担责任。</li>
          <li>你使用本服务生成的标签打印页、PDF 文件的相关权益归你所有，可自由用于教学、考务、会议等场景（含商用）。</li>
          <li>不得利用本服务从事任何违反法律法规的活动，不得对本服务进行恶意攻击、爬取或干扰其正常运行。</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">四、知识产权</h2>
        <p class="mt-2">
          本服务的软件代码、界面设计、内置模板、文案与商标标识等知识产权归 SeatMark 所有。
          未经书面许可，任何人不得复制、镜像、反编译或用于开发同类竞争产品。
          内置的开源字体遵循其各自的开源许可证（如 SIL OFL），可免费商用。
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">五、免责声明</h2>
        <ul class="mt-2 list-disc space-y-1.5 pl-5">
          <li>本服务按「现状」提供。我们尽力保证排版精度与功能稳定，但不对打印效果与你的具体设备、打印机、纸张的兼容性作出保证，建议正式打印前先行试印。</li>
          <li>因你的浏览器环境、网络状况或第三方服务（如在线字体 CDN、AI 模型服务）造成的功能不可用，我们不承担责任。</li>
          <li>在法律允许的最大范围内，我们对因使用或无法使用本服务造成的任何间接损失不承担责任。</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">六、协议的变更与终止</h2>
        <p class="mt-2">
          我们可能根据产品迭代或法律要求更新本协议，更新后会在本页面发布并标注最后更新日期。
          重大变更会在站内显著位置提示。你在协议变更后继续使用本服务，即视为接受修改后的协议。
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-slate-900">七、联系我们</h2>
        <p class="mt-2">
          对本协议有任何疑问，可通过站内「反馈」入口联系我们，或在
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
      <RouterLink to="/privacy" class="text-brand-600 hover:underline">隐私政策</RouterLink>
    </div>
  </div>
</template>
