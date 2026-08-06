# SeatMark PNG 导出功能测试报告

**分支**: `devin/1786023428-png-field-naming-eink-presets`
**环境**: 本地 vite dev（http://localhost:5173），`/studio?template=eink800&demo=1`（会议演示数据，18 行/18 页，表头 姓名/单位/职务/部门/工号/桌号/座位号）
**方法**: 全部通过浏览器 UI 操作导出真实 zip，shell 解压列名，Pillow 校验尺寸与灰度值；全程录屏。

## 结果总览（逐条验收）

| # | 验收项 | 结果 |
|---|--------|------|
| 1 | eink800 默认：精确像素 + 预设 800×480 + 纯黑白自动勾选 | ✅ 通过 |
| 2 | 按名单字段命名（`{姓名}-{部门}`）导出 18 页 zip，文件名为字段值 | ✅ 通过 |
| 3 | PIL 校验默认预设：18 张全部精确 800×480 且灰度值 ⊆ {0,255} | ✅ 通过 |
| 4 | 重名去重（`{部门}`，4 个部门重复）：`技术部.png`、`技术部-2…-5.png` 等 | ✅ 通过 |
| 5 | 400×300 预设：琥珀色拉伸警告显示；PIL 校验 18 张全部精确 400×300 纯黑白 | ✅ 通过 |
| 6 | 默认序号命名回归：`考场座位标签-YYYYMMDD-HHMM-001.png … -018.png` | ✅ 通过 |
| 7 | 配额：4 次带水印导出后徽标仍为 无水印 1（不限次） | ✅ 通过 |
| 8 | 配额：无水印导出中途取消 → toast「已取消导出，本次未扣除无水印次数」，徽标不变 | ✅ 通过 |
| 9 | 配额：强制失败（`seatmark.dev.force-export-fail`）→ toast「PNG 生成失败…本次未扣除无水印次数」，无 zip，配额不变 | ✅ 通过 |
| 10 | 配额：无水印导出成功 → 徽标 1→0，localStorage `{"date":"2026-08-06","used":1}` | ✅ 通过 |
| 11 | 响应式 390/768/1280：`scrollWidth <= innerWidth` 均成立，无横向溢出 | ✅ 通过 |

## 导出产物证据

- `{姓名}-{部门}` 导出（考场座位标签-20260806-1341.zip）：`张伟-技术部.png`、`王芳-市场部.png`… 共 18 个；PIL：`count 18, all 800x480 pure BW: True`。
- `{部门}` 去重导出（…-1343.zip 与 400×300 的 …-1344.zip）：
  `技术部.png 技术部-2.png 技术部-3.png 技术部-4.png 技术部-5.png 市场部.png 市场部-2…-5.png 战略发展部.png…-4 人力资源部.png…-4`（18 个）；400×300 zip PIL：`all 400x300: True, all pure BW: True`。
- 序号命名回归（…-1345.zip）：`考场座位标签-20260806-1345-001.png` … `-018.png`。

## 截图证据

| 默认 800×480 预设 + 纯黑白 + 命名选择器 | 400×300 拉伸警告（琥珀色） |
|---|---|
| ![default](https://app.devin.ai/attachments/a91dd145-4600-4a1e-9d47-271bcca04b7d/png-dialog-default-800x480.png) | ![stretch](https://app.devin.ai/attachments/9b1c7d8c-f83d-402d-a39e-6dd7fbc063df/png-dialog-400x300-stretch-warning.png) |

| 取消不扣次数 toast | 强制失败不扣次数 toast |
|---|---|
| ![cancel](https://app.devin.ai/attachments/21a4f42f-3883-40b9-8d4b-c16c0a6a304b/cancel-no-quota-toast.png) | ![fail](https://app.devin.ai/attachments/4bed1839-d9da-47fb-a284-930184cd91ca/forced-fail-no-quota-toast.png) |

| 390 宽（DevTools 设备模式） | 768 宽 |
|---|---|
| ![390](https://app.devin.ai/attachments/2d27766a-cb62-4caf-b5c3-31c1a5cc8b8e/png-dialog-390.png) | ![768](https://app.devin.ai/attachments/106206cf-41c7-4fb3-aecd-753ff0d6ae20/png-dialog-768.png) |

| 1280 宽 |
|---|
| ![1280](https://app.devin.ai/attachments/34f2b315-1ac4-4457-8601-005c0304f5bb/png-dialog-1280.png) |

溢出检查数值：390→`innerWidth=390 scrollWidth=390`；768→`768/768`；1280 窗口→`innerWidth=1248 scrollWidth=1238`，均满足 `scrollWidth <= innerWidth`。

## 备注 / 异常

- 测试早期一次 `{部门}` 导出（…-1342.zip）产生了 `{}.png`、`{}-2.png` 等文件名。复查判断是自动化输入时中文「部门」二字未成功注入输入框、实际模板变成了字面 `{}` 所致（测试工具输入问题，非应用缺陷）。随后用官方「点击插入字段」chips 重做两次（800×480 与 400×300）均得到正确的去重文件名，且 `{}` 行为本身符合规范（非法/空字段名按字面处理并去重，不崩溃）。
- 本地截图：`/home/ubuntu/screenshots/png-dialog-390.png`、`png-dialog-768.png`、`png-dialog-1280.png`、`png-dialog-default-800x480.png`、`png-dialog-400x300-stretch-warning.png`、`cancel-no-quota-toast.png`、`forced-fail-no-quota-toast.png`。
- 录屏：`/home/ubuntu/screencasts/rec-f20301d1-96ee-4f01-864c-61072ccf22fc/rec-f20301d1-96ee-4f01-864c-61072ccf22fc-edited.mp4`
