# 第 229 轮：#232（r228 P3×2 修复）生产复测

代码依据：excel.ts:92-100（重名/空表头统一补名：`列N` 后缀去重递增 姓名→姓名2→姓名22）；SelectField.vue:95/105/151（min-w-0 + truncate）；MappingPanel.vue:158（chip max-w-full truncate）。entry 已翻转 `index-6teszdpy.js`。
判据来源：r228 失败形态对照（rows 只剩后列值 / 选中后 ASIDE scrollWidth 2982）。

## T1 重名列（t1_dup.xlsx：两列「姓名」甲X/乙X）
- headers==["姓名","姓名2","班级"]；rows[0]=={姓名:甲一228, 姓名2:乙一228, 班级:一班}（两列值都在）；映射下拉出现「姓名」「姓名2」两个可区分项；把某字段映射到 姓名2 后卡片显示乙值、姓名字段显示甲值；截图。

## T2 后缀冲突（新夹具 [姓名,姓名,姓名2]）
- headers==["姓名","姓名2","姓名22"]，三列数据全在（rows 值分别为 a/b/c 标识串）。

## T3 超长表头选中态三宽度（r228 P3② 复测）
- t5_long.xlsx 导入 → 打开映射下拉 → 选中超长列，在 1280/768/390 三视口分别断言 document.documentElement.scrollWidth <= innerWidth+1（r228 时 2982/1500 溢出）；已映射行 code 区 truncate；预览含「长头值一228」；PNG 带水印导出成功（toast/进度出现）。截图选中态。

## T4 回归（r228 已过项不回归）
- 空表头补名「列2」映射可用值正确；公式缓存值夹具读出「丁一228三班」；t4_wide 100 列×20 行导入「共 20 条」不卡死；t6_mixed 值 42/纯文本228/2024-01-05/007/50%；t7a/t7b 报错「Excel 至少需要包含表头行和一行数据」。

## T5 收尾
- 全程 pageerror=0；清 storage 关全部 tab；第 229 轮置顶追加 test-report.md。P1/P2 即时上报。
