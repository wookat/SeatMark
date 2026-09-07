# 第 208 轮：键盘-only 全流程可用性走查（报告记为 test-report.md 第 208 轮）

代码依据：skip-link App.vue:68-74（sr-only，focus 时显形，@click.prevent 聚焦 #main-content）；Hero CTA HomeView.vue:252-271（RouterLink btn-primary「开始制作」+ demo 副 CTA）；/templates 搜索框 TemplatesView.vue:163、模板卡 RouterLink:235；SelectField.vue:62-82（trigger 上 ↓ 展开、开启后 ↑/↓ 在 [role=option] 间移动焦点、Esc 关闭归还 trigger、Enter 激活选项）；ModalDialog.vue:36-85（Tab 循环 focusables、Shift+Tab 回绕、Esc 关闭、previouslyFocused 归还）。QuotaLimitDialog/导出选择框均为 ModalDialog 实例。方法：CDP Emulation 1280×900 + Input.dispatchKeyEvent（rawKeyDown/keyUp 真实键事件），焦点态截图裁片验证 focus ring 可见。

## T1 首页
- 加载 / 后按 1 次 Tab：activeElement=「跳到主内容」链接且**可见**（截图裁片：非 sr-only 隐藏态）；Enter 后 activeElement=#main-content。
- 继续 Tab 至 Hero「开始制作」RouterLink：有 focus ring（截图）；Enter → 路由变为 /studio。

## T2 /templates
- Tab 到搜索框（placeholder 含「搜索模板名称」）：activeElement 命中且可输入（键入「桌牌」过滤生效，结果数变化）。
- Tab 到首个模板卡 RouterLink：focus ring 截图；Enter → 路由进入模板详情或 /studio（记录实际落点）。

## T3 /studio（deskName+demo）
- 字段映射 SelectField：Tab 聚焦 trigger → ↓ 展开（aria-expanded=true、listbox 出现）→ ↓↓ 焦点在 [role=option] 间移动（activeElement 变化）→ Enter 选中（值更新、listbox 关闭、焦点归还 trigger）→ 再开后 Esc 关闭且焦点在 trigger。
- 导出对话框 focus trap：Tab 到「图片 PNG」按钮 Enter 打开 → 记录 previously-focused；在对话框内连续 Tab 20 次，activeElement 始终位于 [role=dialog] 内（无一次逃出）；Shift+Tab 从第一个元素回绕到最后一个；Esc 关闭 → activeElement 归还到打开前按钮。
- 全键盘带水印导出：重开对话框，Tab/Enter 激活「带水印导出」→ Browser.downloadProgress completed（下载事件判定）。

## T4 配额耗尽弹窗
- localStorage used=1（当日）刷新 → 键盘打开导出框并 Enter「无水印导出」→ QuotaLimitDialog 打开；Tab 循环困于弹窗内（10 次不逃出）；Esc 关闭；焦点归还（activeElement 在 [role=dialog] 外且非 body，记录实际归还点——注意该弹窗由 chooseClean 程序化打开，previouslyFocused 应为触发时焦点元素）。

## T5 横切
- 上述每步截图验证焦点可见（focus ring 像素差异：对焦点元素裁片 vs 失焦态）；全程无键盘陷阱（每页从头 Tab 40 次 activeElement 持续变化、可回到地址栏级循环即 body/首元素）；pageerror 0。

## T6 收尾
- 清 storage + 关闭全部测试 tab；报告置顶追加 test-report.md「第 208 轮」（main 工作树，不提交）。

产物：截图 /home/ubuntu/screenshots/r208_*；脚本 /home/ubuntu/r208_*.py。headless 不录屏。
