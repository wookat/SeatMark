# 第 250 轮：导入文件容错边界专项（生产 /studio，Chromium CDP）

代码依据：`utils/excel.ts` —— .xlsx 魔数校验 L33-38（非 PK →「文件内容不是有效的 .xlsx 工作簿（可能是改名或损坏的文件）…」）、XLSX.read 异常 L49-51（「文件解析失败：文件可能已损坏或格式不受支持…」）、无工作表 L56、行数不足 L85-87（「Excel 至少需要包含表头行和一行数据」）；`stores/workspace.ts:567-583` importExcel catch → toast.danger「Excel 导入失败 <message>」，不会抛未捕获异常。文件类型闸门 `DataImportPanel.vue:158`。

环境：CDP 29229 全新 incognito context（一个 context 串行跑全部场景以验证状态污染，另加 pageerror/request 监听），toast observer。夹具 `~/r250_fixtures/`（truncated.xlsx 60% 字节、encrypted.xlsx（msoffcrypto AES，magic D0CF11E0 非 PK）、headeronly.xlsx、empty.xlsx、wide50x100.xlsx、weird_cells.xlsx（5000 字长名/Tab+换行控制字符/emoji ZWJ+旗帜）、big_multi.xlsx 9.9MB 5 sheet×6000 行、old_format.xls、good40.xlsx）。

核心判据（每个场景）：① 出现明确 toast（成功或「Excel 导入失败 …」，文案与代码预期一致）；② pageerror 增量=0（允许应用主动 toast，不允许未捕获异常）；③ 页面不白屏不卡死（toast 后 evaluate 响应 <2s、body 有内容）；④ 失败场景后紧接导入 good40.xlsx 成功「已读取 40 条数据」+「共 40 条」（状态无污染）。

## 场景与预期
1. truncated.xlsx（PK 魔数在但 zip 残缺）→ toast「Excel 导入失败 文件解析失败：文件可能已损坏或格式不受支持…」；随后 good40 恢复。
2. encrypted.xlsx（CFB 容器非 PK）→ toast 含「不是有效的 .xlsx 工作簿」；随后 good40 恢复。（注记：加密 xlsx 实为 CFB 包裹，走魔数分支而非解析分支——提示语义「改名或损坏」对加密文件略欠精确，如实记录判级）
3. headeronly.xlsx → toast「Excel 导入失败 Excel 至少需要包含表头行和一行数据」；empty.xlsx → 同 toast（矩阵 0 行同判据）；各随后 good40 恢复。
4. wide50x100.xlsx → 成功 toast「已读取 100 条数据」、「共 100 条」，映射面板字段下拉包含 50 列（任一映射 SelectField 打开后 option 数 ≥50）、打开/选择不卡死（evaluate <2s）。
5. weird_cells.xlsx → 成功 toast「已读取 4 条数据」、不崩溃；预览渲染正常；逐张 PNG 导出一次成功（zip 4 张、非空白）——超长 5000 字名被截断省略号属正常。
6. big_multi.xlsx（9.9MB）→ 导入耗时记录（观察项），成功 toast「已读取 6000 条数据」+ 多 sheet 附注（multiSheetNote），页面可交互。
7. old_format.xls → SheetJS 原生支持 xls：预期成功「已读取 20 条数据」；若失败必须是明确 toast 而非 pageerror（如实记录）。
8. 状态无污染：见各失败场景后的 good40 恢复断言；最终一次 good40 导入后「共 40 条」。

## 常规
- 隐私：全程请求监听 张伟250/隐私学校250 命中 0；pageerror 全程=0；清 storage、关自建 context（常驻 Chrome 不动）。

## 报告
- 追加 test-report.md 第 250 轮章节（不提交）+ SKILL.md 建议。
