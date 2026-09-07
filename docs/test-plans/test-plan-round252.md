# 第 252 轮：#255 密码保护 xlsx 专门提示线上验证（生产，Chromium CDP）

代码依据：#255（7c69387）`utils/excel.ts:34-40` —— .xlsx 非 PK 魔数分支内新增 CFB 魔数（D0 CF 11 E0）识别，命中抛「文件可能被密码保护（加密），请在 Excel/WPS 中解除密码后另存为 .xlsx 再导入」；其余非 ZIP 内容仍抛「文件内容不是有效的 .xlsx 工作簿…」。toast 出口 `workspace.ts:581`「Excel 导入失败 <msg>」。部署确认：entry `index-DL6SyG-8.js` → `index-DNF7Ft0O.js`。

环境：CDP 29229 全新 incognito context 单会话串行（复用 r250 方法：toast observer + pageerror/request 监听）。夹具复用 `~/r250_fixtures/`：encrypted.xlsx（CFB）、truncated.xlsx（PK 残缺）、good40.xlsx；新增 fake_csv.xlsx（纯 CSV 文本改名 .xlsx，非 ZIP 非 CFB，含 张伟250 标记）。

## T1 阳性：encrypted.xlsx
- 导入 → toast 标题「Excel 导入失败」，正文逐字=「文件可能被密码保护（加密），请在 Excel/WPS 中解除密码后另存为 .xlsx 再导入」（r250 时为「不是有效的 .xlsx 工作簿…」——新旧文案可区分）；截图像素可见；pageerror 增量=0。

## T2 阴性回归
- fake_csv.xlsx（非 ZIP 非 CFB）→ toast 正文仍=「文件内容不是有效的 .xlsx 工作簿（可能是改名或损坏的文件）；若是 CSV 名单请将扩展名改回 .csv 后重试」且**不含**「密码保护」；截图。
- truncated.xlsx（PK 在）→ toast 正文仍含「文件解析失败：文件可能已损坏或格式不受支持」且不含「密码保护」。

## T3 恢复
- 上述每次失败后导入 good40.xlsx →「已读取 40 条数据」+「共 40 条」。

## T4 常规
- pageerror 全程=0；请求 张伟250/隐私学校250 命中 0；清 storage、关 context（常驻 Chrome 不动）。

## 报告
- 追加 test-report.md 第 252 轮章节（不提交）；输出 #255 复测评论建议。
