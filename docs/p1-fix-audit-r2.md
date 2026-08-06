# 审计 R2 三个 P1 专项复现与处置报告

- 环境：本地构建版（vite dev + 进程内 edge API，http://localhost:5173），CDP 设备模拟（Playwright connect_over_cdp，390/768/1280 三档，含 is_mobile 与桌面两种模式）。
- 日期：2026-08-06。

## P1-1a：390 宽 /studio「最小内容宽度 ~518px」

### 复现结论：默认「适应宽度」状态不复现；非 fit 缩放档（50%/75%/100%）可复现同源问题

- 390 宽全流程（选模板 → 导入/演示数据 → 预览 → 打开三种导出弹窗）逐状态测量 `document.documentElement.scrollWidth`，默认缩放下全部恒为 390，无页面级横向滚动（与此前测试代理测得 scrollWidth=390 一致）。
- 但预览缩放切到 **100%** 时：`docSW: 836 / innerWidth: 836`（修复前），页面被撑宽、需横向滚动——这与审计记录的「scrollWidth 达 800」量级吻合（A4 纵向 794px + 容器内边距）。
- 审计的「~518px」与 fit 缩放的 0.6 兜底比例吻合：预览容器宽度未测得（如面板隐藏瞬间）时 scale 兜底 0.6 → 794×0.6≈476px 固定宽内容 + p-3(24) + 页面 px-4(16) + 边框 ≈ 518px。

### 根因

`StudioView.vue` 的主网格只在 `lg:` 断点声明了 `lg:grid-cols-[400px_minmax(0,1fr)]`；**单列（移动端）时网格轨道为默认 `auto`（min-width:auto）**，预览区内那个按 `pageWidthPx × scale` 设定的固定像素宽子元素（非 fit 缩放时 ≥794px）会把轨道连同整页撑宽，`overflow-auto` 预览容器因此永远不会进入内部滚动。

### 修复（保守，2 处 class）

```diff
- <div class="grid items-start gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
+ <div class="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
    ...
-   :class="[..., 'lg:sticky lg:top-[72px] ...']"
+   :class="[..., 'min-w-0 lg:sticky lg:top-[72px] ...']"
```

### 修复后实测

- 100% 缩放：`docSW: 390`，预览容器 `scrollWidth 806 / clientWidth 356` —— 纸张在预览容器**内部**滚动（与桌面端行为一致），页面不再横向滚动。
- 390/768/1280 三档全流程（含三种导出弹窗、字段命名展开态）`document.scrollWidth` 全部等于视口宽。

## P1-1b：390 宽导出对话框「scrollWidth 达 800 且半透明叠字」

### 复现结论：对话框本体不复现；「800」实为对话框背后被撑宽的页面（同 P1-1a 根因），随 P1-1a 一并修复

- 三种导出弹窗（PNG/图片版 PDF/打印）在 390 实测：面板宽 358px（`w-full max-w-md` 受 `p-4` 视口约束）、`scrollWidth 358`、`background rgb(255,255,255)`、`opacity 1` —— 对话框自身无溢出、完全不透明。
- 修复前若预览处于非 fit 缩放，打开弹窗时 `document.scrollWidth = 836`：审计测得的 ~800 是**弹窗底下的页面**宽度；蒙层 `bg-slate-900/45` 为设计内半透明，被撑宽的底层文字透出即「半透明叠字」观感（另：弹窗有 150ms 淡入过渡，过渡中截图也会呈半透明）。
- 修复后弹窗打开时 `docSW: 390`，底层不再溢出。

## P1-3：PNG 字段命名输入框直接键入中文丢字符

### 复现结论：应用层不复现；丢字是 GUI 注入工具（xdotool 直接键入非 ASCII）所致，与受控输入/IME 无关

三组对照实验：

| 实验 | 输入方式 | 结果 |
| --- | --- | --- |
| A | CDP 真实 IME 流程（`Input.imeSetComposition` 组合中 + `Input.insertText` 上屏）键入 `{姓名}-{桌号}` | 输入框与 v-model 均得到完整 `{姓名}-{桌号}`，blur 后不变 ✅ |
| B | GUI 桌面直接 type（xdotool 逐键注入）同一字符串到**本输入框** | 得到 `{}-{}`（与审计记录完全一致）❌ |
| C | 同样的 GUI type 注入到**无任何框架的裸 `<input>`**（`data:text/html,<input>`） | 同样得到 `abc{}-{}end` ❌ |

实验 C 证明丢字发生在注入层（X11 xdotool 无法合成中文键事件），与 Vue 受控输入无关；实验 A 证明真实 IME 组合/上屏路径下应用行为正确——Vue 3 的 `v-model` 原生带 compositionstart/end 感知（组合期间不提交、compositionend 后统一提交），无需额外改造。**依「不要臆改」原则，此项不做代码改动。**

真机手测建议：手机浏览器打开 /studio → 任一多页模板 → 图片 PNG → zip 内文件命名切「按名单字段命名」→ 中文输入法直接键入 `{姓名}`，应完整上屏。

## 回归

- `cd app && npm run test`：33 文件 / 250 用例全绿。
- `cd app && npm run build`（含 vue-tsc）：通过。
- 390/768/1280 三档全流程 `document.scrollWidth === innerWidth` 复测通过。
