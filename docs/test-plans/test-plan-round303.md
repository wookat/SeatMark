# 第 303 轮：#311 admin/users 白名单 + 云端模板同步全量回归（本地 vite dev + 内存 KV，main 57ef5ca）

代码依据：`edge-functions/api/[[default]].js` L1239-1269（/api/admin/users 白名单 email/createdAt/lastLoginAt/loginCount/templateCount/proUntil/inviteCount/invitedBy）、L922-961（GET/PUT /api/account/templates，PUT 更新 user.templateCount）；`app/src/views/AdminView.vue` L454-468（用户表列：邮箱/注册时间/最近登录/登录次数/云端模板）；`app/src/views/AccountView.vue` L60-90（同步到云端 PUT customTemplates、云端找回 GET+importTemplates 按 id 合并）；`app/src/stores/templateLibrary.ts`（localStorage 键 seatmark.custom-templates.v1）；`app/src/views/StudioView.vue` L61-63（设计器保存 saveAsCustom/updateCustom）。

环境：http://localhost:5173，admin=admin@seatmark.cn（密码注册即管理员）。监听器记录全部 /api/* 响应体。

## A. #311 白名单复测
1. 注册普通账号 r303user1@example.com（造出带 passwordHash 的用户记录），再注册 admin。
2. admin 进 /admin 用户管理面板。
   - PASS：GET /api/admin/users 200，响应体逐字扫描不含 `passwordHash`/`passwordSetAt`/`pbkdf2`/`salt` 字样；users[] 每条仅白名单键子集。
   - PASS：UI 用户表显示 r303user1/admin 两行，注册时间/最近登录/登录次数(≥1)/云端模板(0) 列渲染正常，无空白/NaN。
   - FAIL 判据：响应体出现任何凭据字段，或表格列因字段缺失显示异常。

## B. 云端模板同步全量回归
1. r303user1 登录 → /studio 打开设计器，创建自定义模板 T1（改名 r303模板一）保存；再存 T2（r303模板二）——本地 localStorage 有 2 个自定义模板。
2. /account 点「同步到云端」→ PASS：PUT /api/account/templates 200 `{ok:true,count:2}`，toast 成功，账户页云端模板数=2。
3. 更新覆盖：/studio 编辑 T1（改名 r303模板一v2）保存（updateCustom 同 id）→ /account 再同步 → PASS：PUT count 仍 2（覆盖非新增）。
4. 跨设备找回：清 localStorage/sessionStorage/cookie（模拟新设备）→ 重新登录 r303user1 → /account 点「云端找回」→ PASS：toast「云端共 2 个模板，新增 2 个」；/studio 模板列表出现 r303模板一v2、r303模板二（v2 名称证明更新覆盖生效，若显示旧名 FAIL）；选中 T1 可进入设计器继续编辑，预览渲染正常。
5. 不串号：登出 → 注册 r303user2 → /account「云端找回」→ PASS：云端共 0 个（GET 返回 templates:[]），/studio 无 r303 模板；admin 用户表 r303user1 云端模板列=2、r303user2=0。
6. 会员口径：本地新号均为 7 天专业版（会员口径已覆盖）；免费口径无法本地制造（新号必送会员，沿用第 298 轮结论标注 untested），代码层同步接口不区分 pro（L922 仅要求登录）。
7. 隐私/健康：全程 /api/* 响应体无 passwordHash/pbkdf2；pageerror=0。

## 收尾
- 停 vite/监听器，清浏览器状态；报告 test-report.md 第 303 轮章节置顶。
