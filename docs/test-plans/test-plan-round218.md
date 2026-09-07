# 第 218 轮：隐私承诺全站网络外发审计（「名单数据不出浏览器」运行时取证）

代码依据：遥测注入 app/index.html:71-87（GA4 `G-5MKTF5XDYQ` + 百度 `hm.js?8a3f…`，延迟 addScript）；路由遥测 router/index.ts:174-183（gtag page_view 仅 {page_path,page_title}、百度 _trackPageview 仅 path）；长链分享纯前端 share.ts:12/59-67（`#tpl=v1.<base64url(deflate(模板JSON))>`，零服务端）；短码分享 share.ts:122-132（POST /api/share/tpl body={payload}，payload=模板编码——**需运行时解码验证不含名单**）；照片仅内存 Map（workspace.ts:150，loadPhotoFiles）；名单持久化 localStorage `seatmark.workspace-template.v1`（workspace.ts:34/114）；SeatingView.vue 无任何 fetch/beacon。

夹具（独特标识）：`/home/ubuntu/r218_roster.xlsx`（姓名列「隐私审计张三218/李四218/王五218」+ 手机号列 13800218001-003）；照片 `/home/ubuntu/隐私审计张三218_PRIVAUDIT218.jpg`（文件名含 PRIVAUDIT218）。
敏感串集合 S = {隐私审计, 张三218, 李四218, 王五218, 13800218, PRIVAUDIT218}（含 base64/URL 编码变体核查——对每条请求 body 同时做原文与 `encodeURIComponent`/base64 子串匹配；短码 payload 额外做 deflate 解码后检查）。

## T0 全量网络捕获装置
- 新 tab 启用 `Network.enable` + 记录所有 requestWillBeSent（URL+POST body）+ Fetch/XHR/Beacon；GA/百度请求单列。

## T1 完整链路走查（真实 UI，全程捕获）
1. /studio → 选带照片字段模板（有 type:'image' 的默认模板，模板选择器中挑选）→ 导入 r218_roster.xlsx → 映射姓名 → 照片匹配列=姓名 → 上传照片（DOM.setFileInputFiles）→ 预览含「隐私审计张三218」+照片（截图）。
2. PNG 逐张带水印导出 + 图片版 PDF 导出（下载事件成功即可，重点是导出期间网络零外发名单）。
3. /seating 排座：导入/复用名单走一次排座渲染（截图）。
4. 模板分享：复制分享链接（长链断言 `#tpl=` 纯 hash、无网络请求）；扫码短码（断言 POST /api/share/tpl 仅含模板 payload——解码 payload 后检查 S 全部 0 命中；模板 JSON 本身不应含名单行）。
- **核心断言（P1 判据）**：全程捕获的每条请求（URL/query/body）对 S 的原文+编码变体命中数 = 0；照片内容不上传（无 multipart/大 body 外发请求）。
- 遥测如实记录：GA4 collect 请求与百度 hm.gif 的完整参数列表（page_path/title/cid 等），列出实际外发字段。

## T2 存储清理验证
- 断言导入后 localStorage `seatmark.workspace-template.v1` 含名单（预期行为，本地持久化）；执行 localStorage.clear()+sessionStorage.clear()+indexedDB 枚举删除后，重新读取全部为空；刷新后页面回到无名单状态（截图/DOM 证据）。

## T3 收尾
- 全程 pageerror=0；关全部测试 tab；第 218 轮置顶追加 test-report.md（不提交）。

预期：任何 S 命中即 P1 即时回报 message_parent。
