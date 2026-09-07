# 第 230 轮：导入入口与重复导入状态一致性专项（生产，无代码变更轮）

代码依据：DataImportPanel.vue:150-160（onDrop 处理 drop 事件，drop zone 仅在 `!excel.rows.length` 时渲染；非表格扩展名 toast「文件类型不支持」）；workspace.ts:505-523（applyExcel：**每次导入重置** mapping/照片/overrides/筛选排序 + autoMap 重建）；:564 importExcel；:583 switchSheet（DataImportPanel.vue:216-227 的 select，多 sheet 才显示）；:617 clearData（toast「数据已清空」）；fieldTemplate.ts:26-37（组合映射引用消失列 → 空串求值；templateColumnsValid 供面板校验）。

## T1 拖拽上传路径
- 空态 /studio：页内构造 File(t1 xlsx bytes) + DataTransfer，向 drop zone dispatch dragover+drop：导入成功 toast、「共 2 条」、与点击上传结果一致（headers 相同）；再验非表格文件（.txt）drop → toast「文件类型不支持」且数据不变。注：drop zone 仅空态存在，导入后消失——如实记录该产品形态。

## T2 重复导入同名文件
- 导入 A(t1_dup)→手动把座位号映射改为「姓名2」→再次导入同一文件：mapping 应被重置为 autoMap 结果（座位号回「未映射」，设计行为=重置），无残留脏状态（overrides/筛选清空、previewPage=1）；「共 2 条」不变；如实记录重置是否一致合理。

## T3 换文件导入（表头完全不同）+ 组合映射容错
- 导入 A（姓名/班级）→设置组合映射 `{姓名}-{班级}` 于某字段→导入 B（表头 甲列/乙列，全新）：旧映射全清、组合映射不残留；卡片不得用旧列名渲染（不出现 A 的值）；再在 B 下设置组合映射引用消失列 `{姓名}`（手输）→ 面板校验提示/保存按钮禁用（compositeDraftValid=false），若可保存则求值为空串不崩溃，如实记录。

## T4 多 sheet 来回切换
- 造双 sheet 文件（S1: 姓名/班级 2 行；S2: 学号/年级 3 行）：导入后 toast 含「文件含 2 个工作表」；select 切到 S2：headers/rows/「共 3 条」正确、mapping 重置为 S2 的 autoMap;切回 S1：headers/rows 与首次一致（共 2 条），无串数据。

## T5 清空后重新导入
- 「清空」入口（clearData）：toast「数据已清空」、回到空态 drop zone、sessionStorage roster 清空;重新导入 A → 正常渲染、PNG 带水印导出成功（toast+zip）。

## T6 隐私与收尾
- 全程 Network 抽查：名单值（甲一228/乙一228 等）在所有请求 URL/body 命中 0；pageerror=0；清 storage 关全部 tab；第 230 轮置顶追加 test-report.md。P1/P2 即时上报。
