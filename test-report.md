# SeatMark P1/P2 回归清扫 — 浏览器端到端测试报告

- 分支：`devin/1785982600-regression-p1p2-sweep`（本地提交 `9cc4a36`）
- 环境：本地 vite dev（`cd app && npm run dev`，http://localhost:5173，devApi 内存 KV 提供 `/api/share/tpl`）
- 录屏：`/home/ubuntu/screencasts/rec-77829cd1-9279-45fe-b6e1-4fc24d38072d/rec-77829cd1-9279-45fe-b6e1-4fc24d38072d-edited.mp4`
- 硬性命令：`npm install` ✅、`npm run test` ✅（27 文件 / 199 用例全部通过）、`npm run build` ✅（vue-tsc + vite build + prerender，exit 0）

## 结果总览

| # | 测试 | 结果 |
|---|------|------|
| T1 | 分享短码 QR 成功路径（加载态 → 短码 QR） | ✅ 通过 |
| T2 | 短码失败对话框（重试 / 改用长链接）与长链回退警告、恢复 | ✅ 通过 |
| T3 | /seating 鼠标拖拽换座、行把手整排交换、点选换座、触屏文案 | ✅ 通过 |
| T4 | 导出失败注入：失败 toast「本次未扣除无水印次数」、配额不变；移除后正常导出并扣额 | ✅ 通过 |
| T5 | 导出进度浮层「取消」按钮：取消后 toast「已取消导出」、配额不变 | ✅ 通过（第一次尝试因导出完成过快而失败，改用 8 页导出后成功验证） |
| T6 | Edit One 引导气泡：首访显示、可关闭、localStorage 持久化、label title 提示 | ✅ 通过 |
| T7 | 响应式 390/768/1280 × `/`、`/studio`、`/seating`：无横向溢出 | ✅ 通过（9/9 组合 scrollWidth == innerWidth） |
| 附加 | 无 emoji 图标（全为 inline SVG） | ✅ 通过（全程未见 emoji 图标） |

## T1/T2 分享短码 QR

| 🟢 短码 QR 成功（弹窗，文案「二维码只包含一个短链接」） | 🟢 短码 QR 放大 |
|---|---|
| ![短码QR弹窗](https://app.devin.ai/attachments/bd026688-fa6d-4755-9833-63dd559cb055/ss_186e8c50.png) | ![短码QR放大](https://app.devin.ai/attachments/74a0d20f-f318-4974-bd06-9ed892fd58fe/ss_zoom_d9c23149.png) |

阻断 `/api/share/tpl` 后（fetch 覆盖注入 545 失败）：

| 🔴 失败对话框（「短链服务暂时不可用」+「重试」「改用长链接二维码」） | 🟡 长链回退（密度较高需近距离扫描警告） |
|---|---|
| ![失败对话框](https://app.devin.ai/attachments/54ce9196-e154-46a3-b829-599e90fe6184/ss_b8d3bb2b.png) | ![长链回退](https://app.devin.ai/attachments/f01c611d-b19b-409c-a567-311f39b602c0/ss_zoom_0770a0e4.png) |

解除阻断后重开恢复短码 QR：

![恢复短码QR](https://app.devin.ai/attachments/380bf037-7619-4392-9a98-fbbe6b33ecfb/ss_zoom_09733fb9.png)

## T3 /seating 拖拽 / 点选换座

| 🟡 拖拽中（座位 11 显示绿色 drop-target 高亮，鼠标按住） | 🟢 释放后：王伟丽 ↔ 徐强磊（座位 1↔11）互换 |
|---|---|
| ![拖拽中高亮](https://app.devin.ai/attachments/03b6818d-e003-4a2a-a885-4afc37575278/ss_033ed88d.png) | ![换座结果](https://app.devin.ai/attachments/2d9202a2-6f32-4bc2-aa1f-c2630edb6853/ss_zoom_78f20f3b.png) |

| 🟡 行把手拖拽中（第 3 排把手高亮） | 🟢 释放后 toast「已交换第 1 排与第 3 排」，整排互换 |
|---|---|
| ![行拖拽中](https://app.devin.ai/attachments/52730bd0-5eec-4557-9f95-8add88629dc7/ss_ac09b223.png) | ![整排交换toast](https://app.devin.ai/attachments/7b07c0c6-0f75-4f46-8943-5226a6d76401/ss_d3691b13.png) |

| 🟡 点选第一个座位（蓝色选中框 + 提示「已选中座位，点另一个座位交换」） | 🟢 点第二个座位后互换（何超英 ↔ 郑杰洋） |
|---|---|
| ![点选选中](https://app.devin.ai/attachments/897bcf00-9867-4ed3-819e-48610a6b1b2f/ss_zoom_1e0307d0.png) | ![点选互换结果](https://app.devin.ai/attachments/b635cf04-d2b9-4ad4-8d79-7f1cb0e2b2ae/ss_zoom_c03dbcbb.png) |

说明文案确认包含「触屏设备请用点选方式。」（DOM 验证）。

## T4 导出失败注入（不扣配额）

前置：`seatmark.clean-export-usage.v1` = null；设置 `seatmark.dev.force-export-fail` = '1'。

| 🔴 注入失败：toast「PDF 生成失败 / 开发注入：强制页面渲染失败…本次未扣除无水印次数」，配额仍为 null | 🟢 移除 key 后正常导出：toast「图片版 PDF 已生成」，PDF 已下载，配额变为 `{"date":"2026-08-06","used":1}` |
|---|---|
| ![导出失败toast](https://app.devin.ai/attachments/e0c30668-1036-40d0-83f4-84e84aa5521c/ss_feff3109.png) | ![导出成功toast](https://app.devin.ai/attachments/35a16131-9ef7-488f-ac42-f5a66a43baa7/ss_2b90e56f.png) |

## T5 取消导出

行数改为 1（8 页导出）以获得可见进度期。第一次尝试因点击晚于导出完成而未成功（已重置配额重试，未计入通过）。第二次在进度浮层出现后立即点「取消」：

| 🟡 进度浮层含「取消」按钮（正在渲染第 2/8 页） | 🟢 取消成功：toast「已取消导出 / 本次未扣除无水印次数」，配额 null 不变，无新 PDF 下载 |
|---|---|
| ![进度浮层取消按钮](https://app.devin.ai/attachments/7130355e-a2fb-4c35-9736-ffb48496340d/ss_77a13240.png) | ![取消toast](https://app.devin.ai/attachments/af2fa20c-6126-4851-b060-2a8ac8024301/ss_765d9c55.png) |

## T6 Edit One 引导

| 🟢 首访预览区左上角引导气泡（可关闭） | 🟢 关闭后气泡消失，`seatmark.edit-one-hint-dismissed.v1` = '1'，刷新不再出现 |
|---|---|
| ![引导气泡](https://app.devin.ai/attachments/4595f220-ecfa-40f2-af6a-86e1bb38a7c2/ss_zoom_10e7e814.png) | ![气泡已关闭](https://app.devin.ai/attachments/74c1ecec-7c5f-44c2-aebd-dd92ad062ef2/ss_zoom_330e920b.png) |

标签 title 属性确认为「点击可单张覆写：只改这一张标签，不改名单」（DOM 验证）。

## T7 响应式 390 / 768 / 1280

所有 9 个组合 `document.documentElement.scrollWidth == innerWidth`，无横向溢出：

| 路由 | 390 | 768 | 1280 |
|---|---|---|---|
| `/` | ![landing390](https://app.devin.ai/attachments/ea1219ea-80e5-424f-81ac-15ef997a0812/ss_2d6f355c.png) | ![landing768](https://app.devin.ai/attachments/3e5602a1-b655-47f2-abf2-acc9c8edfa7c/ss_e7782eb8.png) | ![landing1280](https://app.devin.ai/attachments/68b9f12a-ee5b-42ec-90ae-72b9bfa2d378/ss_ad6798f6.png) |
| `/studio` | ![studio390](https://app.devin.ai/attachments/c8c903f3-c2b8-4f78-b718-5042c78f5dd2/ss_e9c5dd99.png)（移动端「设置/预览」双 tab 布局） | ![studio768](https://app.devin.ai/attachments/d7b7b56b-59ed-44eb-82dc-4c7af4be5769/ss_94a7c3ab.png) | ![studio1280](https://app.devin.ai/attachments/4803a72c-8ba1-4093-87a2-c7c7d3bd335f/ss_3dae3aa1.png) |
| `/seating` | ![seating390](https://app.devin.ai/attachments/6f3717f7-0aec-4902-9226-4ea4b6d4895e/ss_d3ef7835.png) | ![seating768](https://app.devin.ai/attachments/7e83beb1-8b9b-499e-9365-1d1813c58617/ss_b26ce969.png) | ![seating1280](https://app.devin.ai/attachments/f6923663-f4a4-4bdf-9de2-d96b58fbb351/ss_c11bdf43.png) |

注：390/768 视口通过 Chrome DevTools 设备模式模拟（Linux 下 Chrome 窗口最小宽度约 532px，无法直接把窗口缩到 390）；溢出判定基于页面内 `scrollWidth`/`innerWidth`，与设备模式无关。

## 单元测试与构建

```
npm run test  → Test Files 27 passed (27), Tests 199 passed (199)
npm run build → vue-tsc --noEmit ✅ + vite build ✅ + prerender（306 URL sitemap）✅，exit 0
```

## 备注 / 局限

- T5 第一次取消尝试因 3 页导出完成过快而点击过晚（导出已成功并扣额 1 次）；随后重置了匿名配额并用 8 页导出重试成功。此行为符合预期（取消只在导出未完成时生效），非缺陷。
- 响应式测试期间一次误点曾把选中模板切换为「考号贴」，已切回「标准考场版」，不影响结果。
- 短码失败注入通过在页面 console 覆盖 `fetch` 对 `/api/share/tpl` 返回 545 实现（测试计划允许的注入方式）。
