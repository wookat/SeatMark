# 第 314 轮（2026-08-14）：PR #324 本地端到端测试（登录注册加固：注册/重置确认密码 + 找回密码邮件重置码 + 表单算术验证码）——全部判据 PASS；生产复测（X-SeatMark-Rev=r314、Resend seatmark@zalize.com 发信）待合并部署后另行执行

**环境**：本地 vite dev http://localhost:5173（分支 devin/1786716467-auth-hardening @39339c2，`env -u RESEND_API_KEY -u TENCENT_SES_SECRET_ID -u TENCENT_SES_SECRET_KEY npm run dev`，memory KV、devCode 可用；`/api/auth/captcha` 已返回 `x-seatmark-rev: r314`）。全 UI 操作 + 录屏；测试账号 r314user@test.cn（memory 存储，服务重启即消失）。计划 test-plan-round314.md。

## T1 注册——PASS
- 两次密码不一致：确认密码框下即时红字「两次输入的密码不一致」；提交仍被拦，performance 资源计数证实 **0 次 POST /api/auth/register**。
- 验证码答错（1+4 填 9）：POST /api/auth/register 400，表单红字「验证码不正确或已过期，请重试」，题面**自动换新题**（1+4→3−3）。
- 新题答对提交：toast「注册成功…7 天专业版」，自动登录进入个人中心（专业版会员 · 2026/8/21 到期）。

## T2 登录（验证码 + 换题重试）——PASS
- 登出后登录表单验证问题自动重新取题。
- 答错（4+8 填 99）：400 红字 + 题面自动更新（→8−6）；点「换一题」题面再变（→4+1）。
- 新题答对 + 正确密码：登录成功，累计登录 2 次。

## T3 找回密码全链路——PASS
- 登录页「忘记密码？」→ 标题「找回密码」，仅邮箱+验证问题+「发送重置验证码」。
- 答对发送：POST /api/auth/reset-code 200，toast「验证码已发送（若该邮箱已注册…）」防枚举文案；**devCode 六位数字自动回填**（419980）；重发按钮「58s 后重发」倒计时生效。
- 新密码两次输入不一致：红字「两次输入的密码不一致」；改一致后 POST /api/auth/reset-password 200，toast「密码已重置…已为你自动登录」，进入个人中心（累计登录 3）。
- 登出后旧密码 + 正确验证码登录：**HTTP 401**「邮箱或密码不正确」（performance responseStatus 实测 [400,200,401] 依次对应错验证码/成功/旧密码）。
- 新密码登录：成功（累计登录 4）。

## T4 390px 移动端 + pageerror——PASS
- CDP 390×844 仿真：登录表单与找回密码发码后表单 scrollWidth=390=innerWidth，无横向溢出；devCode 在移动端同样自动回填（437280）；window error/unhandledrejection 监听全程 **0 条**（桌面会话同样 0）。
- 截图 `/home/ubuntu/r314/mob390_login.png`、`mob390_reset.png`。

## 未测/延后（如实标注）
- 生产判据（X-SeatMark-Rev=r314 上线、重置邮件由 Resend seatmark@zalize.com 发出、真实邮箱收信）——等合并部署后按用户通知复测。
- 重置码尝试上限（CODE_MAX_ATTEMPTS）、429 频控、验证码 5 分钟过期等分支仅有单测覆盖，本轮 UI 未逐一实测。

# 第 313 轮（2026-08-14）：PR #322 生产复测（/banquet 首次 PNG 导出损坏修复：data-export-ink + rebuildHost 兜底）——全部判据 PASS，3 次冷启动+2 次连发均无坏图；兜底失败分支 untested（生产不可注入）

**环境**：生产 https://www.seatmark.cn ，全程匿名。部署确认：新 bundle `index-DlKjKpQ8.js`（旧 `index-DQa2HNr9.js`），`BanquetView-B8IarNdU.js` 含 `data-export-ink` 标记；main=6ef6355。计划 test-plan-round313.md，全程录屏。导出原始物存 `/home/ubuntu/r313/`。

## T1 冷启动首次 PNG 导出 ×3（复现 #312 P2 场景）——PASS
每次：CDP 清 localStorage → 硬刷新 /banquet → 用演示名单（48 人 3 组）→ 一键自动分配 → A4 横向首次导出 PNG（带水印，忽略空桌弹窗继续）。
- 3/3 次产出 3509×2481、首个非白列均为 **284**（#312 坏图为 1）、8 桌圆桌图形完整、底边水印在、无静默坏图、无「页面渲染不完整」报错（`/home/ubuntu/r313/cold{1,2,3}.png`、`cold1_small.png`）。
- 判读口径（如实标注）：原缺陷为偶发，3 次通过证明「未复现且交付物全部健康」，不构成概率意义上的彻底修复证明；rebuildHost 兜底重渲/连续失败报错分支生产无法强制注入——untested（有单测 pdfExport.spec.ts 覆盖，运行时未实证）。

## T2 同会话连续 PNG ×2——PASS
- 两次均首个非白列 284、图形完整（`seq4.png`、`seq5.png`）。

## T3 PDF 回归（改走 exportPagedPdf({getPage, rebuildHost}) 新路径）——PASS
- A4 横 PDF：841.89×595.276 pts，栅格左缘完整含全部桌形（`a4l.pdf`/`a4l-1.png`）。
- A3 纵 PDF：不报错，841.89×1190.55 pts（`a3p.pdf`/`a3p-1.png`）。
- A3 横 + 导出带分组颜色 PDF：1190.55×841.89 pts，宾客芯片按组着色（蓝/红/青三组）+ 底部「分组图例」三色点齐全（`a3l_colors.pdf`/`a3lc-1.png`/`a3lc_legend.png`）。

## T4 /studio 整页 PNG 冒烟（domExpectsRightInk 选择器扩展回归）——PASS
- 标准考场版 + 演示数据（26 条 2 页）带水印按整页导出：zip 两页 2481×3509，p1 非白 676k/右 40% 区 258k、p2 稀疏尾页右 40% 区 47k（水印墨迹在），导出成功无「页面渲染不完整」误报（`studio/` 解包、`studio_p1_small.png`）。

**收尾**：localStorage/sessionStorage 已清。注：pageerror 判据以「全部导出成功产出+无 UI 报错弹窗」佐证，未挂全程异常监听器（导出期 UI 无任何错误提示）。

---

# 第 312 轮（2026-08-14）：PR #320+#321 生产复测（/banquet 宴会座位表生成器 + /studio TXT/去重 + 互链）——T1/T3/T4/T5 全 PASS；T2 发现 1×P2：A4 横向 PNG 首次导出渲染损坏（重试成功，疑似偶发/竞态）

**环境**：生产 https://www.seatmark.cn ，全程匿名（带水印导出）。部署确认：新 bundle `index-DQa2HNr9.js`，`x-seatmark-rev: r304`（本轮未改边缘函数）；main=e309d85（特性提交 c4aaff7）。计划 test-plan-round312.md，全程录屏。导出原始物存 `/home/ubuntu/r312/`。

## T1 /banquet 四步全流程——PASS
- 粘贴多行名单（含 2 条重复）→「添加到名单（自动去重）」toast 提示去重、列表条数正确；「上传 TXT 名单」（`/home/ubuntu/r312/guests.txt`，含 1 条与现有重复）入列去重正确（`ss_bbb6c0fd.png`、`ss_eeeb5c43.png`）。
- 自定义分组：男方亲友 #E11D48 / 女方亲友 #4F46E5，HEX 可改、宾客可逐个指派（`ss_zoom_d049706b.png`）。
- 五种布局预设全部点击生成（圆桌/长桌/主桌+圆桌/U 形/教室）；主桌改名「贵宾主桌」、座位数改 6；添加入口/舞台/舞池标记；Pointer 拖动 5 号桌位置改变（`ss_129f896d.png`、`ss_cc189209.png`）。
- 一键自动分配：7/7 上桌、同组尽量聚集主桌；拖拽王芳到 2 号桌微调成功；陈静可拖回「未安排」区撤下（`ss_68eeeeca.png`、`ss_5bbe972c.png`、`ss_57fe7545.png`）。
- localStorage `seatmark.banquet-state.v1` 存在（len=1994，keys 含 guests/groups/tables/markers/paper 等），刷新后状态保留（`ss_c47f105d.png`）。

## T2 导出口径（#321 回归）——含 1×P2
- ⚠️ **P2：A4 横向 PNG 首次导出渲染损坏**——3509×2481 尺寸正确但全部文字挤在左缘、无任何餐桌图形（`/home/ubuntu/r312/a4_landscape.png`、`a4png_full_small.png`）。同状态**立即重试第二次导出完全正常**（`a4_landscape_retry.png`：标题/舞台/主桌/6 圆桌/入口/底边水印/边距均正确，首个非白列 284——左缘不裁切）。疑似偶发渲染竞态（如字体/布局未就绪即截图），建议排查导出前等待逻辑。
- A4 横向 PDF：841.89×595.276 pts（A4 横），栅格化正确、左缘完整、水印在（`a4_landscape.pdf`/`a4pdf-1.png`）。
- **A3 纵向 PDF：不报错、成功产出** 841.89×1190.55 pts（A3 纵），内容完整（`a3_portrait.pdf`/`a3pdf-1.png`）——#321 两缺陷（左缘裁切、A3 纵失败）在 PDF 通道均未复现。
- 勾选「导出带分组颜色」PDF：宾客芯片红/靛按组着色、底部含「分组图例：●男方亲友 ●女方亲友」（`a4_landscape_colors.pdf`、`a4color_chips.png`、`a4color_legend.png`）。

## T3 导出前检查弹窗——PASS
- 构造 1 名未安排（陈静）+5 张空桌 → 点导出：弹窗「导出前检查发现问题」列出「未安排的宾客（1）陈静」「空桌（5）1/3/4/5/6号桌」；「返回修改」阻断导出；此前已验证「忽略问题，继续导出」可继续（`ss_c6fa5927.png`、`ss_394b7edc.png`）。

## T4 移动端 390px——PASS
- CDP 390×844 仿真：四步区块完整可用、scrollWidth 390≤innerWidth 390 无横向溢出、pageerror=0（`/home/ubuntu/r312/mob390_{top,mid,bot}.png`）。
- 测试注记：390 仿真期间本机 Chrome 一度崩溃重启（自动化环境问题，非生产页面错误；重启后同判据复测通过）。重启换 profile 导致本地 banquet 状态丢失属测试环境现象，持久化判据此前已过。

## T5 /studio 与 /seating 回归——PASS
- /studio「粘贴名单导入」弹窗：含「上传 TXT 文件」按钮与「自动去重重复行」开关（默认开）；开时粘贴 5 行（2 重复）提示「识别到 3 条数据…已去重 2 条」，导入后预览 3 枚；关时同样 5 行识别到 5 条（保留重复）；TXT 上传追加 3 行识别到 8 条（`ss_446fff6b.png`、`ss_zoom_81eaac95.png`、`ss_0080aa4b.png`）。
- /seating 顶部互链「要排婚宴、年会圆桌？用 宴会座位表生成器」点击跳转 /banquet 成功；/banquet 顶部反向链接「教室座位表打印」、页脚含 /banquet 入口；/seating 演示名单 48 人渲染正常无回归（`ss_50a06d0f.png`、`ss_d3160524.png`）。

**收尾**：浏览器 localStorage/sessionStorage 已清（`seatmark.seating-state.v1` 等），结束于匿名页面。

---

# 第 310 轮（2026-08-14）：PR #317 生产上线复测（双语英文名修复 + 3 款新模板 + 225 计数）——全部判据 PASS，无 P1/P2 回归；新观察 1×P3（retail 演示数据「土雞蛋」为繁体「雞」）

**环境**：生产 https://www.seatmark.cn ，全程匿名（带水印导出）。部署确认：`index.html` 引用新 bundle `index-CLPzfp2I.js`（旧 `index-BDLw0dx-.js`），`x-seatmark-rev: r304` 保持（本轮未改边缘函数）；main=f1ba201。浏览器硬刷新绕过 SW 缓存。计划 test-plan-round310.md，全程录屏。

## T1 双语英文名修复（修第 309 轮 P2）——PASS
- /studio?template=tentBilingual：首次打开残留旧本地演示数据（仍显示 CHEN Jiaming）——属本地持久化数据非产品缺陷；UI「清空」后 ?demo=1 重载，数据表新增「英文名」列，预览逐卡：张伟→ZHANG Wei、王芳→WANG Fang、李娜→LI Na、刘洋→LIU Yang、陈静→CHEN Jing，与中文名拼音逐行对应，无任何两卡重复（`ss_bd0ca642.png`、`ss_zoom_0d32544c.png`）。
- 带水印导出逐张 PNG（zip 10 张，2245×1536）抽 001/003/010 放大：ZHANG Wei / LI Na / WU Xia 逐卡不同，字形完整、底边水印细线存活（`/home/ubuntu/r310/tent_crop_*.png`、`tent_wm_001.png`；原始 `/home/ubuntu/r310/tent/`）。

## T2 三款新模板——PASS
- /templates 拼音搜索 shengxian/yuding/shuye 各命中生鲜价签/预订席位卡/输液座位签，缩略图无溢出错位（`ss_34dd594f.png`、`ss_705efb53.png`、`ss_260d9a4c.png`）。
- 详情页 /templates/freshPrice、/templates/dinerReserve、/templates/infusionSeat 均可打开，标题/尺寸（60×36 / 90×55 / 70×40）/描述/FAQ/SEO 内容与源码一致（`ss_fc97346f.png`、`ss_b944a516.png`、`ss_03cc0b8a.png`）。
- Studio 预览逐卡字段变化，无固定回退值：
  - freshPrice：零售演示 12 行，品名/单价（红字特大）/产地/日期逐卡不同，4/4 字段自动匹配（`ss_b6246f41.png`）；
  - dinerReserve：餐饮演示 12 行，宾客/时间人数/桌号逐卡不同，「RESERVED · 已预订」题头正常（`ss_bfba4ad1.png`）；
  - infusionSeat：医院演示 18 行含新列，座位号 01–12 反白、过敏史红字（无/青霉素/头孢/磺胺类）逐卡变化，4/4 字段匹配（`ss_a7648ec7.png`）。
- 每款带水印逐张 PNG 导出抽查放大：字形完整、裁切线存在、水印细线「SeatMark 座签 · seatmark.cn」存活、无丢线：fresh 001/009（1000×600，`/home/ubuntu/r310/fresh_*.png`）、diner 001/006（1063×650，`diner_*.png`）、infusion 002/004（1000×572，`inf_*.png`）。原始 zip 解包在 `/home/ubuntu/r310/{fresh,diner,inf}/`。

## T3 计数 225——PASS
- 首页统计带「225 款 内置专业模板」、hero 文案「225 款内置模板」、「查看更多模板（还有 220 款）」（`ss_170b32a2.png`）；/templates「全部 225」（`ss_4d51b2be.png`）；/studio 左栏「浏览全部 225 款模板」。未见 222 残留。

## T4 回归：医院数据集新列不破坏 wardBed——PASS
- /studio?template=wardBed：数据表含新「座位号」「过敏史」列后，床号 01–10 反白仍正确映射、5/5 字段自动匹配（床号/护理等级/姓名/主管医生/责任护士），无空值/错位（`ss_7271f6bc.png`）。

## 硬判据与观察项
- 上述页面 pageerror=0（console 仅残留上一会话 print throw-stub 的「Error: stub」，非本轮页面错误）；无横向溢出异常。
- 新观察 P3：retail 演示数据第 9 行「土雞蛋」使用繁体「雞」，与全站简体口径不一致，建议改为「土鸡蛋」（`/home/ubuntu/r310/fresh_009.png`）。

---

# 第 309 轮（2026-08-14）：全站视觉审计 + 222 款模板全量质检 + 导出物像素级检查 + 覆盖面盘点——硬判据全 PASS（18 路由 × 3 宽度 54 组无横向溢出、pageerror=0；222 缩略图无 P1；导出物字形/裁切线/水印细线/反白全存活），发现 1×P2（双语模板英文名固定样例）+ 6×P3 精调点，无 P1

**环境**：生产 https://www.seatmark.cn ，全程匿名（带水印导出）。计划 test-plan-round309.md，全程录屏。方法：CDP 设备仿真三宽度整页截图 + scrollWidth/pageerror 采集；/templates 六分类长截图切片逐款肉眼扫描；12 款代表模板 /studio 实际预览；标准考场版（逐张 PNG/整页 PNG/图片版 PDF）、深蓝会议桌牌（逐张 PNG）、照片核验版（逐张 PNG）、双语会议桌牌（打印/矢量 PDF，throw-stub 保活法）导出后 PIL/pdftoppm 放大逐像素检查。

## A. 全站页面走查（硬判据 PASS）
- 18 路由（/、/studio?demo=1、/templates、/templates/standard、/papers、/papers/a4-8up、/guides、2 篇教程页、/pricing、/account、/seating、/vs、/vs/chuangkit、/desk-card-generator、/name-card-batch、/terms、/privacy）× 390/768/1280 共 54 组：scrollWidth ≤ innerWidth 54/54、window error 0 — PASS（截图 `/home/ubuntu/r309/page_*_{390,768,1280}.png`）。

## B. 模板全量质检（222 款缩略图 + 12 款代表预览）
- 六分类（考试 31/教学 43/幼儿教育 19/会议活动 54/婚庆喜宴 23/生活办公 52 = 222）长截图切片逐款扫描：无文字溢出字段、无装饰错位、无破图、对比度正常、水印无遮挡 — PASS（`/home/ubuntu/r309/tpls_*_s*.png`）。
- 12 款代表（standard/navyConfCard 深色/drinkCup 36×24 小签/weddingCandy/libraryCall/kidsCandy 退顶边/withPhoto 照片/staffIdCard 照片/tentBilingual 双语大幅/deluxeGovGuilloche 复杂装饰/deskName/lotteryTicket）/studio 预览：布局无溢出错位、照片占位正常、pageerror=0 — PASS（`/home/ubuntu/r309/rep_*.png`）。

## C. 导出物像素级检查（PASS，含 1 项 P2 发现）
- 标准考场版逐张 PNG（1000×534）+ 整页 PNG（2481×3509）+ 图片版 PDF（pdftoppm 栅格）：字形完整无缺笔、虚线裁切线笔直、底边「细线—SeatMark 座签·seatmark.cn—细线」水印存活、边距对称 — PASS。
- 深蓝会议桌牌逐张 PNG（2127×1063）：藏青底金线保真、水印反白清晰 — PASS。
- 照片核验版逐张 PNG：照片占位/核对提示完整，水印细线与提示行贴近但不遮挡 — PASS。
- 双语会议桌牌打印/矢量 PDF（9 页）：每卡底边水印 + 页脚角标齐备、墨绿条与分隔线保真 — PASS，但发现 **P2**（见下）。

## P 级问题清单（无 P1）
- **P2** 双语系模板（tentBilingual 等含「英文名」字段者）：内置演示名单无英文名列，预览/导出中每张卡的英文名固定渲染样例值「CHEN Jiaming」（张伟、王芳等所有人同名），演示数据与场景不符、易误导用户。建议：演示数据补拼音英文名列，或字段未映射时隐藏该行。证据 `/home/ubuntu/r309/exp/full_tentpdf1.png`、`rep_tentBilingual.png`。
- P3 /templates 分类网格同排卡片高度不一（描述行数差异）导致大片留白（如教学类「培训班桌贴」附近），建议描述行数钳制或等高卡片。
- P3 标准考场版逐张 PNG 中水印文字与左下「座位号 SEAT」小注基线较近（约 1mm 视距），小签打印后略显拥挤，建议水印上边距微调。
- P3 照片核验版底部「入场请核对…」提示行与水印细线几乎贴合，建议同上微调。
- P3 /studio 1440 宽下左栏「三步拿到成品」引导卡与模板卡间距略大于区块间统一间距（视觉节奏轻微不齐）。
- P3 /guides 教程页 390 宽下 H2 与首段间距偏紧（对比 1280 版式）。
- P3 /vs 对比表 390 宽下依赖横向滚动容器，无溢出但缺少可滚动视觉暗示（阴影/渐隐）。

## D. 覆盖矩阵与缺口建议（222 款）
| 场景维度 | 现有覆盖 | 代表模板 | 缺口/建议 |
|---|---|---|---|
| 考务 | 强（31 款：座签/考号贴/门贴/监考证/物料签/A4 大签/照片核验/黑白高对比） | standard、withPhoto | 已充分；可补少数民族双语考场签（如汉维/汉藏，60×32，字段同 standard+民族文字姓名） |
| 教学 | 强（43 款：课桌贴/学生证/图书角/实验室/听课证/作业筐） | deskName、studentIdCard、libraryCall | 可补「家长会桌牌」（180×90，姓名+学生姓名+班级） |
| 幼儿 | 良（19 款：姓名贴/水杯/毛巾/接送卡/生日卡） | kidsCandy | 可补「过敏/饮食禁忌提示贴」（40×25，姓名+禁忌项） |
| 会议活动 | 强（54 款：桌牌/胸牌/签到/展会/志愿者/抽奖/双语） | navyConfCard、tentBilingual、lotteryTicket | 可补「线上会议虚拟背景名牌」（1920×1080px 数字尺寸，姓名+职务+单位） |
| 婚庆 | 良（23 款：席位卡/迎宾/喜糖/敬酒） | weddingCandy | 可补「婚礼桌号立牌」大幅（140×200 竖版，桌号+桌名+宾客列表字段） |
| 餐饮 | 中（生活办公类内含餐桌/取餐/后厨标签约 8 款） | drinkCup | 缺「预订席位卡」（90×55，宾客名+时间+人数）与「外卖出餐架位签」（60×40，单号+平台） |
| 医疗 | 中（诊室门牌/药房货架/床头卡约 5 款） | — | 缺「输液座位签」（70×40，姓名+床/座号+过敏标识）与「科室导引牌」（180×60） |
| 政务 | 良（服务窗口/政务窗口牌/纹章系约 6 款） | deluxeGovGuilloche | 可补「办事取号窗口屏排队牌」（数字 800×480px 电子墨水屏尺寸） |
| 办公 | 强（工位/门牌/资产/仓储/工作证约 20 款） | staffIdCard | 已充分；可补「会议室预约门牌」（120×90，室名+时段字段） |
| 零售 | 中（价签/货架/促销约 6 款） | — | 缺「生鲜价签」（70×38，品名+单价+产地+日期）与「促销爆炸贴」（60×60 异形示意） |

**建议优先级**：零售生鲜价签、餐饮预订席位卡、医疗输液座位签（真实高频场景且现库空缺）> 民族双语考场签 > 其余。

**结论**：硬判据全 PASS、无 P1；1×P2（双语演示英文名）建议排期修复，6×P3 精调点与 10 项模板缺口建议供裁量。

---

# 第 308 轮（2026-08-14）：PR #315 五处 UI 小改生产复测——✅ 全部 PASS（三导出弹窗新水印文案/角标外移白描边/模板库短 placeholder/定价胶囊徽章/账户浅灰信息条），五页 390/1280 10/10 无横向溢出、pageerror=0，无回归

**环境**：生产 https://www.seatmark.cn ，全程匿名。部署确认：新前端 bundle `index-BDLw0dx-.js` + `StudioView-BVUuqBQw.js` 含「细线签名式」（旧 bundle `index-CkHzKmPK.js` 时代等待约 20 分钟后切换）；本轮未改边缘函数，`x-seatmark-rev: r304` 保持不变（符合预期）。硬刷新确认页面实际加载新 bundle。计划 test-plan-round308.md，全程录屏。

- T1 导出弹窗水印文案：/studio?demo=1 依次打开 图片 PNG / 图片版 PDF / 打印·矢量 PDF 三个弹窗，「带水印导出」说明均为「每张标签底边叠加细线签名式品牌水印（细线 + seatmark.cn 小字，配色随模板自适应），不遮挡姓名等核心内容」；「徽章式」「座位格标记」0 出现 — PASS（`ss_2c77c666.png`、`ss_zoom_2f6800c4.png`、`ss_zoom_bdae860b.png`）。
- T5 工坊 1280 导出角标：「今日剩余 1 次」角标外移（-top-2.5/-right-2）不再紧贴「图片版 PDF（推荐）」按钮文字，ring-1 ring-white 描边生效 — PASS（`ss_zoom_b160d7a7.png`）。
- T2 模板库 placeholder：390 下完整显示「搜索模板 / 场景，支持拼音、首字母」无截断（DOM placeholder 逐字一致）；1280 同 — PASS（`r308_templates_390.png`）。
- T3 定价徽章：390 与 1280 下「限时 5 折 · 注册送 7 天」「限时 5 折 · 可预约」均为胶囊形（rounded-full）单行不换行、带阴影，pt-7 后不压卡内标题、与描边间距正常 — PASS（`r308_pricing_390_badge.png`、`r308_pricing_1280_badge.png`）。
- T4 账户未登录信息条：浅灰 bg-slate-100（计算色 oklch(0.968 0.007 247.896)）圆角、max-w-md 居中，390/1280 均层级清晰无溢出 — PASS（`r308_account_390_bar.png`、`r308_account_1280_bar.png`）。
- 硬判据：/、/studio、/templates、/pricing、/account × 1280/390 共 10 组 `scrollWidth ≤ innerWidth`（1280 下 sw=1270、390 下 sw=390），window error=0 — PASS。
- 回归：无新发现，未见 P 级问题。收尾：清除设备仿真、结束于匿名首页。

# 第 306 轮（2026-08-13）：PR #314 底边细线签名水印生产视觉复测 + UI 小改走查——✅ A 全部 6 分支 PASS（浅/深/小标签/退顶边/打印通道/新旧对比），B 无横向溢出、pageerror=0、微调点 8 条（另：三个导出弹窗水印文案陈旧 P2）

**环境**：生产 https://www.seatmark.cn （部署确认：CSS `index-6XEkK5P2.css` 含 `.label-watermark__rule`，旧 `__mark` 已消失），全程匿名（带水印导出不限次）。可视 Chromium 全 UI 操作，全程录屏；导出物落 ~/Downloads 后 shell 解包用 PIL/pdftoppm 逐像素核验。旧版对比用独立 worktree /tmp/sm_old (f5b8103) 起 vite:5199，测后已 `git worktree remove` + 停 vite，主工作树零改动。计划 test-plan-round306.md。

## A. 水印视觉复测（六分支）
- A1 浅色 standard 60×32 PNG（带水印）：底边呈「细线—SeatMark 座签 · seatmark.cn—细线」，极小字距、半透明；无旧徽章 Logo；放大裁剪线像素存在（html2canvas 未丢线）— PASS（`r306_std_png_bottom.png`）。
- A1 浅色 standard 图片版 PDF：pdftoppm 栅格化首页，底部同样式、细线未丢 — PASS（`r306_std_pdf_bottom.png`）。
- A2 深色 navyConfCard 180×90 PNG：深蓝底上水印**反白**（白系半透明）细线+文字清晰可辨；大标签显示全称「SeatMark 座签 · seatmark.cn」；无徽章 — PASS（`r306_navy_png_bottom.png`）。
- A3 小标签 drinkCup 36×24 PNG：水印文字为短版「seatmark.cn」，≈2mm 下限仍可辨，两侧细线存在，不遮甜度冰量字段 — PASS（`r306_cup_png_full.png`）。
- A4 底边被字段占用退顶边：本地复算全部内置模板水印落位（脚本 /tmp/wm2.ts），选中「姓名贴·糖果款 kidsCandy 45×30」（底占顶空）→ 生产带水印 PNG：水印出现在**顶边**、短版文字+细线，不遮班级字段 — PASS（`r306_candy_png_top.png`/`_full.png`）。
- A5 打印/矢量通道（糖果款抽 1 例）：stub window.print 保留打印宿主后 CDP printToPDF——每枚标签顶边同样呈细线签名水印 — PASS（`r306_candy_print_crop.png`，PDF `/home/ubuntu/r306/candy_print.pdf`）。注：首次 no-op stub 时宿主随 print() 返回即卸载得空白页，需 throw 保留宿主，属测试手法非产品缺陷。
- A6 新旧对比：本地 f5b8103 同 standard 带水印 PNG——旧版为右下角「徽章图标+seatmark.cn」大字；生产新版为底边细线签名，并排图 `r306_old_vs_new.png` — PASS（旧徽章已完全移除）。
- ⚠️ 未测/口径注记：深色与小标签的 PDF 未跑（PNG 已证，PDF 走同一 DOM 渲染路径，风险低）；「两条候选带都被占用→仍贴底边半透明叠加」分支未实测（内置模板多数属此形态，standard 即该 fallback 且导出正常，但未构造双占对照断言）；纯黑白 PNG 分支（hostWatermark=false 走 sheet 角标）未测。

## B. UI 小改走查（1280/390 双宽度五页，不改代码）
- 硬判据：10/10 组 `scrollWidth ≤ innerWidth`（1280 均 1270/1280；390 均 390/390）、window error=0 — PASS。截图 `r306_ui_{home,studio,templates,pricing,account}_{1280,390}.png`。
- 微调点清单（P2/P3）：
  1. **P2 导出弹窗文案陈旧**：PNG/图片版 PDF/打印三个弹窗「带水印导出」描述仍写「叠加半透明**徽章式**品牌水印（座位格标记 + seatmark.cn）」——与 #314 细线签名实现不符，建议改为「底边细线签名（细线 + seatmark.cn 小字）」。
  2. P3 首页 390：快捷入口 chips 换行成两行后行间距与上方按钮间距不一致，且勾选项「A4 · A5 · A3」孤行换行；建议统一 chips 行 gap、勾选项允许换行对齐。
  3. P3 首页 390：hero 副文案段落约 9 行过长，移动端建议截短或拆两段。
  4. P3 定价 390：「限时 5 折 · 注册送 7 天」徽章压住专业版卡片顶部描边、间距偏紧，建议 badge 上移 2-4px 或卡片 padding-top 加大。
  5. P3 模板库 390：搜索框 placeholder「…支持拼音、首字母，如“jkz”」被截断显示为「如“!」，建议移动端用短版 placeholder。
  6. P3 账户页（双宽度）：底部「当前未登录：今日本设备剩余 1/1 次…」纯文本层级弱、与上方隐私说明距离大，建议加浅色信息条背景。
  7. P3 工坊 1280：导出按钮上方「今日剩余 1 次」绿色角标紧贴按钮文字、视觉拥挤，建议角标改为按钮内 badge 或加 2px 间距。
  8. P3 定价 1280：三卡功能列表条数不一（7/6/5）致卡片留白不均，建议团队版补一条或列表区 min-height 对齐。

## 健康与收尾
- 全程 window error=0；导出物均核对（std/navy/cup/candy zip + std PDF + candy 打印 PDF）；旧版 vite 已停、worktree 已删、`git status` 仅新增 test-plan/report/skill 文档；浏览器结束时恢复正常 UA/尺寸并清理导出残留状态（匿名无登录态）。

---

# 第 303 轮（2026-08-13）：PR #311 admin/users 白名单复测 + 云端模板同步全量回归（main 57ef5ca，本地）——✅ 全部执行判据 PASS（响应体零凭据字段、管理表渲染正常；多模板同步/更新覆盖/跨设备找回/导出/不串号；免费口径 UNTESTED）

**环境**：本地 http://localhost:5173（main 57ef5ca 含 #311 合并，vite dev + devApi 内存 KV，邮件环境变量剥离）。可视 Chromium 全 UI 操作 + async 监听器（`/home/ubuntu/r303_listen.py` → `r303_net.jsonl`，全 /api/* 口径，86 行）。全程录屏。计划 test-plan-round303.md。**未触碰生产**。账号：r303user1@example.com（云同步主账号）、r303user2@example.com（隔离）、admin@seatmark.cn（本地密码注册即管理员）。

## A. #311 /api/admin/users 白名单
- admin 注册后 /account 出现「进入管理后台」入口 → /admin 概览（注册用户 3、云端模板 1/2）与用户列表（3）渲染正常：admin/user1/user2 三行，注册时间/最近登录/登录次数(1/2/1)/云端模板(0/2/0) 列无空白无 NaN — PASS。
- GET /api/admin/users 200 原始响应体（576B）逐字扫描：`passwordHash`/`passwordSetAt`/`pbkdf2`/`salt` 均 **0 命中**；users[] 每条仅 email/createdAt/lastLoginAt/loginCount/templateCount/proUntil（inviteCount/invitedBy 本轮账号无值故 JSON 省略，属白名单子集）；cursor:null — PASS。
- 全 86 行监听捕获（含 auth/templates/admin 各接口）响应体凭据字样 0 命中 — PASS。

## B. 云端模板同步全量回归
- r303user1 在 /studio 设计器创建并保存 2 个自定义模板 r303（60×40）与 r303b（60×40）→ /account「同步到云端」→ PUT 200 `{ok:true,count:2}`，页面「云端已存 2 个」 — PASS。
- 更新覆盖：编辑既有 r303 高 40→45（同 id 保存）→ 再同步 → PUT 200 count **仍 2**（覆盖非新增） — PASS。（注：改名操作在卡片上未见生效，改用尺寸变更作更新标记；名称覆盖未单独断言。）
- 跨设备找回：CDP 清 cookies + 全部 origin 存储 → 匿名 → 重登 user1 → 「本设备 0 个；云端已存 2 个」→「从云端找回」→ toast「云端共 2 个模板，新增 2 个到本设备」；/studio 列表 r303 为 **60×45**（更新版）、r303b 60×40 完整 — PASS。
- 可继续编辑导出：找回的 r303 进入编辑器正常渲染；载入演示数据（18 条）后选 r303 渲染 18 枚标签，「图片版 PDF · 无水印导出」成功下载（106KB Done） — PASS。
- 不串号：再清存储注册 r303user2 → 「本设备 0 个；云端已存 0 个」，同步/找回按钮均禁用（GET templates:[]）；admin 表 user1=2、user2=0 — PASS。
- 会员口径：user1/user2 均为 7 天专业版（会员口径覆盖）；**免费口径 UNTESTED**（本地新号必送会员，无法制造免费账号；接口层同步仅要求登录、不区分 pro）。
- 健康：pageerror=0（仅既知本地 SW 注册 MIME 警告）；两次 PUT/一次 GET 响应形状正确无数据丢失。

## 收尾
- vite 与监听器已停、浏览器 cookies/storage 已清、内存 KV 随进程销毁无残留。

---

# 第 302 轮（2026-08-13）：PR #310 兑换码安全加固复测（main e7e1a26，本地）——✅ 全部判据 PASS（哈希只存/明文一次性展示/末4位掩码、新码兑换+幂等+409、存量明文键迁移、并发核销恰一赢家、批次核销 2/3、定价回归）

**环境**：本地 http://localhost:5173（main e7e1a26 含 #310 合并，vite dev + devApi 内存 KV，邮件环境变量剥离）。可视 Chromium 全 UI 操作 + async 监听器（`/home/ubuntu/r302_listen.py` → `r302_net.jsonl`，全 /api/* 口径）。全程录屏。计划 test-plan-round302.md。**未触碰生产**。测试注入：devApi.mjs 临时 seed 旧格式明文键 `redeem:SM-LEGA-CYAA-TE55`（15 天），测试后已 `git checkout` 回滚。

## T1 明文一次性 + 批次只存哈希
- admin 生成 7 天 ×3（备注 r302）→ toast「共 3 个，请立即复制保存——服务端只存哈希，离开页面后无法再查看明文」；amber 一次性展示区出现（标题「仅展示一次…」+ textarea 3 个明文码 + 复制全部码按钮）；复制后剪贴板核对（xclip）3 个码一致 — PASS。
- 生成码：SM-ZR8R-TTBF-3ER6 / SM-5WFD-RFCP-3Q9H / SM-324X-NWBK-K6RA。
- 刷新 /admin → amber 区消失；批次行操作列仅「末4位：3ER6 / 3Q9H / K6RA」，无复制按钮 — PASS。
- 监听证据：5 个 GET /api/admin/codes 200 响应体均无任何完整明文码，仅 `masked:["SM-****-****-3ER6",…]`；明文仅出现在 POST 生成响应一次（`{"ok":true,…,"codes":[…]}`，符合设计） — PASS。

## T2 新码兑换全分支（UI）
- r302user1 注册（8/20 到期）→ 兑码 A → toast「兑换成功 · 专业版已延长 7 天」，到期 8/20 → **8/27** — PASS。
- 同人重试码 A → toast「兑换码已生效 · 此前已兑换到你的账号」，到期不变 — PASS。
- r302user2 注册 → 兑码 A → 红字「兑换码已被使用」，到期仍 8/20 — PASS。

## T3 存量明文键迁移
- user2 兑 seed 旧码 SM-LEGA-CYAA-TE55 → toast「兑换成功 · 专业版已延长 15 天」，到期 8/20 → **9/4** — PASS。
- 同人重试旧码 → 「兑换码已生效」（核销记录已落哈希键、usedBy 归属正确的间接实证） — PASS。
- 注：内存 KV 无外部调试口，「旧明文键已删除」未直接观测，以哈希键记录可读+幂等归属间接验证（getRedeemRecord 迁移路径已被触发）。

## T4 并发核销（脚本口径，用户指定）
- curl 注册 r302c1/c2 两账号，同码 B（SM-5WFD-RFCP-3Q9H）两并发 POST /api/redeem → **c1 200 `ok:true days:7`、c2 409「兑换码已被使用」**（恰一赢家；两段式 60ms 回读确认生效） — PASS。
- 回 /admin：批次「已兑换 **2/3**」（码 A+B；legacy 码不属此批次不计入）——哈希键口径核销计数正确 — PASS。

## T5 回归与隐私
- 注册仍送 7 天（4 个新号全部 8/20 到期、配额「不限」）；/pricing 五折卡、注册送 7 天文案、登录态 CTA→/account#redeem 正常 — PASS。
- pageerror=0；auth 响应无 passwordHash — PASS。
- **观察项（既有问题，非 #310 引入）**：`GET /api/admin/users`（管理端用户列表）直接返回 KV 原始用户记录，**响应体含每个用户的 `passwordHash`（PBKDF2 哈希）与盐**。管理员会话才可访问，且为哈希非明文，但按最小暴露原则建议裁剪字段（如剔除 passwordHash/passwordSetAt），与本轮「服务端最小化明文暴露」的加固方向一致。
- 收尾：devApi.mjs 临时 seed 已回滚、vite/监听器已停、浏览器 storage/cookie 已清、结束于登出态；内存 KV 随进程销毁无残留。

---

# 第 298 轮（2026-08-13）：PR #308 会员体系与兑换码——本地全流程 ✅ 全部判据 PASS（注册送7天、邀请双方+7、兑换码生成/兑换/幂等/409/无效、五折定价、390/768/1280 无溢出）

**环境**：本地 http://localhost:5173（分支 devin/1786652411-membership-redeem 62d23ee，vite dev + devApi 内存 KV，邮件环境变量剥离）。可视 Chromium（CDP 29229）全 UI 操作 + async 监听器（`/home/ubuntu/r298_listen.py` → `r298_net.jsonl`）。全程录屏。计划 test-plan-round298.md。**未触碰生产**。

## T1 注册送 7 天专业版
- UI 注册 m298user1@example.com → 徽章「专业版会员 · 2026/8/20 到期」（注册日 8/13 +7 天），配额卡显示「不限」— PASS。
- API 证据：register 200 响应 `pro:{active:true,until:"2026-08-20T20:30:16Z"}`、`quota:{limit:9999,remaining:9999,pro:true}`，无 passwordHash — PASS。

## T2 邀请裂变 +7/+7（deferWrite）
- 登出后访问 `/?ref=0fa5446a`（user1 分享码）→ 分享欢迎横幅出现，localStorage `sm-invite-ref=0fa5446a` — PASS。
- UI 注册 m298user2 → register payload 携带 `inviteCode:"0fa5446a"`（且仅 email/password/inviteCode 三键），响应到期 **2026/8/27（+14 = 注册7+受邀7）**；注册后 `sm-invite-ref` 已清除 — PASS。
- 重登 user1（二次查询）→ 到期由 8/20 变 **8/27（邀请方 +7，deferWrite 已落库）**，分享统计累计访问/获赠 1 — PASS。

## T3 兑换码全分支
- admin@seatmark.cn（默认 ADMIN_EMAILS）注册后 /admin「兑换码管理」生成 30 天 ×3（备注 test298）→ toast「兑换码已生成 共 3 个（已尝试复制到剪贴板）」，批次表「30 天 / 3 / 已兑换 0/3 / test298 / 复制全部码」— PASS。
- user1 在 /account#redeem 输码 SM-HVYS-AEWY-NW37 → toast「兑换成功 · 专业版已延长 30 天」，到期 8/27 → **9/26（+30）** — PASS。
- 同人同码重试 → toast「兑换码已生效 · 此前已兑换到你的账号」（already 幂等），到期仍 9/26 未叠加 — PASS。
- user2 输同码 → 红字「兑换码已被使用」（409），到期仍 8/27 — PASS。
- 未发行码 SM-2222-3333-4444 →「兑换码无效」；`abc` →「兑换码格式不正确」— PASS。
- 回 /admin 批次表「已兑换 **1/3**」核销计数正确 — PASS。

## T4 /pricing 定价与响应式
- 专业版 ¥14.5/月 + 划线 ¥29/月、badge「限时 5 折 · 注册送 7 天」、绿标「注册送 7 天」、feature「邀请好友注册，双方各送 7 天，可累计叠加」「支持兑换码开通，天数可叠加」；团队版 ¥49.5 + 划线 ¥99「限时 5 折 · 可预订」— PASS。
- 登录态点专业版 CTA「使用兑换码开通 / 延长」→ 跳转 /account#redeem 并滚动到兑换区 — PASS。
- 390/768/1280 下 /pricing 与 /account 均 scrollWidth ≤ innerWidth（CDP 设备仿真，截图 r298_pricing_390/768/1280.png、r298_account_*.png）— PASS。
- **观察项（旧文案残留，非本轮判据）**：/pricing FAQ 仍写「专业版定价 ¥29/月，Beta 期间限时免费试用：注册登录即自动开通」「登录即开通专业版 Beta 限时免费试用」；页脚链接文案「定价（Beta 限时免费试用）」；导航头像下拉徽标「Beta 会员 · 试用中」；登录成功 toast 仍写「每日 3 次无水印导出」——与新会员体系文案不一致，建议同 PR 顺手更新。

## T5 回归与隐私
- 普通登录（user1/user2/admin 共 5 次密码登录）全部成功 — PASS。
- **免费版配额展示（非会员视角）— UNTESTED**：本分支所有新注册账号均获 7 天专业版，本地无到期/免费账号可用（用户已允许跳过到期场景；免费分支 UI 代码为 quota.pro 为假时回落原数字展示，未获运行时实证）。
- 云端模板区块正常渲染（0 模板、按钮禁用态正确）；完整同步链路本轮未跑 — 轻回归。
- 监听器：pageerror=0；所有 auth 响应无 passwordHash；payload 键仅 {email,password(,inviteCode)} — PASS。
- 收尾：vite 已停、监听器已停、浏览器 storage/cookie 已清、结束于登出态。内存 KV 随进程销毁，无持久测试残留。

---

# 第 297 轮（2026-08-13）：UI 口径注册补测（r296 注册项 429 遗留）——✅ UI 注册 3/3 成功 0 可见失败；本轮 register raw 545 = 0/3（未触发 545，前端 register→login 收尾链路未被动用，与用户 curl 口径 3/3 545 形成鲜明波动对比）

**环境**：生产 https://www.seatmark.cn，`X-SeatMark-Rev: r298`、`X-SeatMark-Storage: blob` 复核。可视 Chromium（CDP 29229）UI 操作 + async 监听器（`/home/ubuntu/r297_listen.py` → `r297_net.jsonl`）。全程录屏。计划 test-plan-round297.md。IP 注册日限已重置（用户 curl 已用 3 次）。

## T1 UI 注册 ×3
- seatmark297ui1/ui2/ui3@example.com（uipass297{N}）依次注册：**3/3 直接 200**、UI 全程只见「注册中...」→ 个人中心，0 用户可见失败 — PASS。
- **raw 545 = 0/3**：本轮未触发任何 545，因此前端 register→545→login 自动收尾链路本轮**未获动用/验证**（r294 已实证过一次）。与同日早些时候用户 curl 口径 3/3 注册请求 545（服务端副作用完成）对比：545 呈强波动/时段相关，UI 口径无法稳定复现。
- 注册响应体形状完整：loginCount:1、quota{3/3}、share code（fbeeb763/7659acfb/4aea9b79），无 passwordHash。

## T2 登录态形状
- 个人中心 share 链接（?ref=码）、配额 3/3、使用统计（注册时间/最近登录/累计登录 1 次）区块渲染正常 — PASS。

## T3 回归
- 刷新保持登录（me 200 ui3 user）；登出 → me 未再查询即回匿名表单（logout 200 {"ok":true}），页面回到「登录 SeatMark」— PASS。

## T4 头/隐私/健康
- 8/8 响应全部 200 且 r298+blob（本轮 0 个 545/4xx/5xx）；payload 键仅 {email,password}；响应无 passwordHash；pageerror=0 — PASS。

## 观察项（用户实测转录，本轮未复测）
- 错密码限流实测 12 次才 429（限 10）：deferred write 下 1 次后台失败计数写丢失——已知代价；锁定期内正确密码也 429，15 分钟后自动恢复。记录为观察项，非 P 项。

## 结论与残留
- UI 口径注册路径本身健康；545 未在本轮出现，register→login 收尾链路的生产触发依赖 545 时段波动，无法按需复现（r294 曾实证一次）。
- 新增账号：seatmark297ui1/ui2/ui3@example.com（另用户 curl 建 seatmark297reg1..3）。本日注册限额已用 6/20。
- 产物：录屏 rec-b998ac8a…-edited.mp4；截图 r297_ui1_registered/ui3_registered/refresh/loggedout.png；网络明细 /home/ubuntu/r297_net.jsonl。

---

# 第 296 轮（2026-08-12）：#302–#305 部署后 545 攻坚全链路复测——✅ 登录侧「用户视角 0 失败」达成：login 8/8 成功，raw 545 = 4/13 login 尝试（≈31%），全部被 1 次静默重试吸收；⚠️ 注册项 BLOCKED（IP 日限 429，改用探针账号）

**环境**：生产 https://www.seatmark.cn。部署确认：所有正常 API 响应头 `X-SeatMark-Rev: r298`、`X-SeatMark-Storage: blob`；entry `/assets/index-BxN07GMT.js` 含 `600*d` 与 `d<5;`（前端登录重试上限 5 已上线）。可视 Chromium（CDP 29229）UI 操作 + Playwright async 监听器（`/home/ubuntu/r296_listen.py` → `r296_net.jsonl`，53 行）。全程录屏。计划 test-plan-round296.md。

## T1 545 成功率
- **注册×3：BLOCKED**——首次注册 seatmark296a731@example.com 即 429「请求过于频繁，请明天再试」（IP 20/天限额已被当日 curl 探针耗尽，符合预期）。零新账号创建，立即停手改用已有探针账号。截图 r296_reg_429.png。
- **登录×8（+1 次登出回归重登=9 次操作）**：seatmark295probe1..8@example.com（probepass{N}{N}）逐一登录，**9/9 用户视角成功进入个人中心，0 次可见失败**。
- **raw 545**：login 响应 4×545 / 13 次尝试 ≈31%（r294 为 login 7/18 ≈39%、合计 8/21 ≈38%；用户 curl 探针 3/40）。545 均无 rev/storage 头（网关层）。**每次 545 后 ~600ms 出现自动重试且下一次即 200**——本轮无一操作需要第 2 次重试，未逼近 5 次上限。probe6 登录 UI 停留「登录中...」约 4s 后成功（1 次 545 被无感吸收）。
- 判据「用户视角 0 失败」：登录侧 **PASS**；注册侧因限额未测（非代码缺陷）。

## T2 错密码
- probe8 + 错密码：监听器仅 **1 个** login 请求、401「邮箱或密码不正确」，请求→响应 1.5s，表单即时显示文案、无重试延迟 — PASS（截图 r296_wrongpass.png）。

## T3 短密码 + 登出回归
- 注册模式 7 位密码：原生 minlength 提示「Please lengthen this text to 8 characters or more」，**零 register 请求** — PASS（截图 r296_shortpass.png）。
- probe8 登出 → `/api/auth/me` 返回 `{"user":null}`（r298/blob）→ 刷新仍为匿名登录表单 → 正确密码重登成功（累计登录 18）— PASS（截图 r296_loggedout.png）。

## T4 头/隐私/payload 形状
- 26 个正常响应全部 `X-SeatMark-Rev: r298` + `X-SeatMark-Storage: blob`（0 例外）；4 个 545 无头。
- 全部请求 payload 键 ⊆ {email,password}；全部响应体无 `passwordHash`；pageerror = 0。
- 登录成功响应形状完整（publicUser 后台写线程化后不变）：`loginCount:18`、`lastLoginAt`、`quota{used,limit,bonus,remaining}`、`share{code:"d970ed87",totalVisits,totalBonus,bonusToday,bonusDailyCap}` 均正常返回。

## 结论与残留
- #302–#305 效果实证：登录侧用户视角 0 失败（r294 为 1/11 打穿）；raw 545 仍存在（4/13 ≈31%，与 r294 同量级、高于用户 curl 的 3/40——样本小且 UI 操作节奏不同，如实记录口径差异），但重试上限 5 下全部 1 次重试吸收。**注册路径（register 545→login 收尾）本轮未获验证**（429 阻断），待限额重置后可补。
- 残留账号：无新增（注册被 429 阻断）。既有 seatmark293x812 / seatmark294a417/b528/c639 / seatmark295probe1..10 仍在。
- 产物：录屏 rec-0704468d…-edited.mp4；截图 r296_reg_429/login1/wrongpass/shortpass/loggedout.png；网络明细 /home/ubuntu/r296_net.jsonl。

---

# 第 294 轮（2026-08-12）：PR #301 线上复测（auth 545 双管齐下）——⚠️ 大幅改善但未达「用户视角 0 失败」：raw 545 8/21 auth POST，前端静默重试吸收其中 2 轮，但 1 次登录 3 连 545 打穿重试上限，用户仍见「服务暂时不可用，请重试」

**环境**：生产 https://www.seatmark.cn（storage=blob）。部署确认：entry `/assets/index-CnDnn-Ti.js` → 主 chunk `index-C6Gj5hO2.js` 含 `600*d` 退避与 register→login 收尾代码（auth.ts 新 bundle 已上线）。可视 Chromium（CDP 29229）UI 操作 + Playwright async 监听器（`/home/ubuntu/r294_listen.py` → `r294_net.jsonl`）。全程录屏。计划 test-plan-round294.md。

## T1 545 成功率（register×3 新账号 + login×8 正确密码）
- **raw 网络层 545**：register 1/3、login 7/18（含重试产生的额外请求；login POST 中 200×10、545×7、401×1）。按用户操作口径：11 次用户操作（注册 3 + 登录 8），其中 3 次操作遭遇 545。
- **前端自动收尾成功 2 例**：
  - 注册账号 c：register 545 → 自动改走 login（又 545）→ 600ms 退避重试 login → 200，UI 全程只见「注册中...」，最终 toast 进入个人中心（**#301 register→login 收尾 + login 重试链路实证**）。
  - 登录第 1 次：login 545 → 600ms 静默重试 → 200，用户无感。
- **❌ 用户视角失败 1 例（未达 0 失败目标）**：登录第 4 次 3 次尝试全部 545（间隔 ~0.6s/1.2s 符合退避设计），表单显示「服务暂时不可用，请重试」；手动再点登录后成功。545 响应均无 storage 头（网关级）。
- 副作用注记（与 r293 一致）：每次 545 的 login 服务端均已计数——账号 a 实际 UI 成功登录 9 次但「累计登录 16 次」（545 尝试全部入账）。
- **结论：FAIL（判据「用户视角 0 失败」）**——重试把 545 对用户的影响从 r293 的「过半操作需手动重试」降到 1/11，但 3 连 545 仍会打穿；545 根因未消除（本轮 auth POST raw 545 率 8/21 ≈38%，与 r293 的 54% 同量级）。

## T2 错密码不重试 — PASS
- 错密码提交 → **仅 1 个** /api/auth/login 请求、401 `{"error":"邮箱或密码不正确"}`，表单立即（~1.8s，无退避延迟）显示同文案，无第 2/3 次请求（不重复计失败次数）。

## T3 短密码拦截 + 登出回归 — PASS
- 注册模式 7 位密码 → input minlength=8 原生气泡拦截，**无任何 register 请求发出**。
- 登出（头像下拉）→ me `{"user":null}`，F5 后仍未登录；正确密码重登成功（8 轮登录循环反复实证）。

## T4 存储/隐私/健康 — PASS
- 全部正常（<500）auth 响应头 `X-SeatMark-Storage: blob`（0 例外）；545 无 storage 头（网关错误页）。
- 全部 auth POST payload 键仅 {email,password}（logout/me 无 body）；全部响应体无 `passwordHash`；pageerror=0。

## 测试残留与清理
- 新增线上测试账号（可清理）：seatmark294a417 / seatmark294b528 / seatmark294c639 @example.com（密码 ProdPass294!）。上轮 seatmark293x812@example.com 未复用、未清理（无删除入口，注销账号按钮未触碰以免误删流程未测路径）。
- 浏览器 cookie/localStorage 已清理，监听器已停止。

**产物**：录屏 rec-f9009462；截图 r294_reg_a/b/c、r294_login4_fail（用户可见失败）、r294_wrongpass、r294_shortpass、r294_loggedout；网络明细 /home/ubuntu/r294_net.jsonl。

---

# 第 293 轮（2026-08-12）：邮箱+密码登录（PR #299，已合入部署）——本地全功能 ✅ 全 PASS；线上功能打通但 ⚠️ auth POST 端点 545 率 7/13（注册 3/4、登录 4/7），依赖 #294 友好提示 + 用户手动重试才能完成注册/登录

**环境**：本地 vite dev（http://localhost:5173，`app/scripts/devApi.mjs` 内存 KV，`env -u RESEND_API_KEY …` 启动）+ 线上 https://www.seatmark.cn（storage=blob）。可视 Chromium（CDP 29229）计算机操作 + Playwright async 监听器旁路捕获 /api/auth/* 请求/响应/pageerror（`/home/ubuntu/r293_listen.py` → `r293_net.jsonl`）。全程录屏。计划 test-plan-round293.md。

## Part A 本地（内存 KV）——全部 PASS
- A2 短密码：注册模式 7 位密码 → input `minlength=8` 原生拦截（气泡提示），**无 /api/auth/register 请求发出** — PASS
- A1 注册：新邮箱 r293x47121@test.dev + 12 位密码 → 200、toast「注册成功」、个人中心显示邮箱 + 配额 3/3 — PASS
- A3 刷新保持：F5 后仍个人中心（me 200 user） — PASS
- A4 登出：头像下拉「退出登录」→ /account 回登录表单，me 返回 `{"user":null}` — PASS
- A5 错密码：401 `{"error":"邮箱或密码不正确"}`，表单同文案 — PASS
- A6 正确密码重登：toast「登录成功」，累计登录 2 次 — PASS
- A7 重复注册：同邮箱再注册 → 409「该邮箱已注册，请直接登录」，表单显示同文案 — PASS
- A8 移动端 390px：devtools device 模式，scrollWidth=390=innerWidth 无横向溢出 — PASS

## Part B 线上（blob）——功能打通，但 545 显著
- 部署确认：/account 已是密码表单；POST /api/auth/login 对未知邮箱返回 401（新端点已上线）。
- B1 注册 seatmark293x812@example.com：**前 2 次提交均 545**（「Error return from script」，无 storage 头；UI 显示 #294 友好提示「服务暂时不可用，请重试」）；第 3 次返回 **409「该邮箱已注册」**——说明**首次 545 的请求在服务端已实际写入账号**（545 发生在响应阶段，handler 已执行完）。随后切登录模式，第 2 次尝试登录成功（第 1 次又 545）→ 个人中心、配额 3/3、storage=blob — 功能可达但体验受损
- B2 刷新保持：me 200（blob，含 user）→ 仍个人中心 — PASS（注：me 响应耗时约 3s，刷新后有短暂未登录表单闪现）
- B3 登出：logout 200 → me `{"user":null}`，刷新仍未登录 — PASS
- B4 登出后正确密码重登：成功（中间又遇 2 次 545，重试后 200）；服务端「累计登录 6 次」而 UI 成功登录仅 2 次——**545 的登录请求服务端同样已执行**（计数+签发后响应才死在网关） — PASS（如实记录）
- B5 错密码：401「邮箱或密码不正确」表单显示 — PASS；短密码 390px 下原生拦截无请求 — PASS
- B6 移动端 390px：scrollWidth=390 无溢出 — PASS
- ⚠️ **545 统计（本轮线上 auth POST）**：register 3/4、login 4/7，合计 **7/13 ≈54%**（r290 code/verify 为 6/24≈25%；r291 GET 0/50）。545 无 storage 头（网关级）；每次 UI 均正确显示「服务暂时不可用，请重试」（#294 ③ 生效）。**新证据：545 请求的服务端副作用已完成**（注册已建号、登录已计数）——问题定位在响应/收尾阶段（疑 waitUntil/Blob 写回或响应流），建议按此排查。

## 常规
- 隐私：15 个 auth POST payload 键均 ⊆ {email,password}（logout/me 无 body），名单零外发；24 个 auth 响应体**均无 passwordHash** — PASS
- pageerror=0；正常线上响应均 storage=blob；storage/cookie 清理完毕、登出收尾 — PASS
- 测试残留：线上新增测试账号 seatmark293x812@example.com（可清理）；本地内存账号随 dev server 关闭消失。

**产物**：录屏 `/home/ubuntu/screencasts/rec-6f2e64d2-f1c3-4ac2-ba89-8a221522de1d/rec-6f2e64d2-f1c3-4ac2-ba89-8a221522de1d-edited.mp4`；截图 r293_a1_registered/a2_short/a3_refresh/a4_loggedout/a5_wrongpass/a6_relogin/a7_dup409/a8_390/b1_545/b1_loggedin/b2_refresh/b3_loggedout/b4_relogin/b5_wrongpass（/home/ubuntu/screenshots/）；网络明细 `/home/ubuntu/r293_net.jsonl`。

---

# 第 292 轮（2026-08-12）：登录闭环补测 🔴 BLOCKED——生产 SES 凭证失效（`X-SeatMark-Mail-Error: AuthFailure.SecretIdNotFound`，8 次发码 0 成功），且 POST /api/auth/code 仍有间歇 545（3/8）。登出闭环、错码回归、#294 ① 不吞码实证全部无法执行。

**环境**：UTC 日界已过（00:02 UTC 起测），IP 发码日限已重置实证（不再 429）。CDP 全新 incognito context 打生产 /account + mail.tm 新邮箱；脚本 `/home/ubuntu/r292_run.py`，结果 `r292_res.json`。计划 test-plan-round292.md。

## T1/T2/T3 登录闭环、错码回归、#294 ① 不吞码 — BLOCKED（新运维阻断）
- 8 次真实发码（不同 mail.tm 新邮箱，间隔合规）：**0 次成功**。分布：502×5（响应体「验证码发送失败，请稍后再试」、storage=blob、**`X-SeatMark-Mail-Error: AuthFailure.SecretIdNotFound`**）+ 545×3（「Error return from script」，无 storage 头）。
- `AuthFailure.SecretIdNotFound` 为腾讯云 API 鉴权错误：**SES 的 SecretId 无效/被删除/未随部署带上**（r289 时同凭证可发信成功，属环境回退——疑与近期重新部署有关）。当前效果：**线上用户完全无法收到验证码、无法登录**（比 r290 的间歇 545 更严重）。
- UI 侧表现：前端显示服务端文案「验证码发送失败，请稍后再试」（502 JSON 正常透传）；545 时按 #294 ③ 应显示「服务暂时不可用，请重试」（r291 已实证，本轮 UI 路径未重复截图）。
- 发码限额纪律：确认阻断后即停手（本日消耗 8/20，为后续修复复测留量）。

## T4 同端点 545 频率 — 如实记录（无法与 r290 同条件对比）
- POST /api/auth/code 8 次中 545×3（≈37%）。r291 的 GET 端点 0/50 与本轮 POST 3/8 并存，说明 **#294 ② 后 545 在 GET 上消失但 POST /api/auth/code 上仍存在**——可能与发信路径（sendCodeMail 内部异常/超时）相关而非 Blob 单例本身；r290 P2 不能视为闭环，如实保留。
- 注：3 次 545 均无 X-SeatMark-Storage 头（网关级错误页特征，与 r290 一致）。

## T5 常规 — PASSED
- auth payload 仅 {email}（verify 未发出）；名单/邮箱标记第三方零外发；pageerror=0；正常响应 storage=blob；storage/cookie 清理、context 全关。headless CDP 未录屏。

## 遗留
- 登出闭环（r290 起三连顺延）、错码回归、#294 ① 不吞码实证：待 **SES 凭证修复**（EdgeOne 环境变量中的 SecretId/SecretKey 校验并重新部署）后再发起一轮，届时预算 2–3 次发码即可完成。

---

# 第 291 轮（2026-08-12）：#294 auth 稳健性线上复测 ✅ 可测项全部 PASS（545 探测 0/50、5xx 友好提示 UI 生效）；⚠️ 登出分支补测仍 BLOCKED（本机 IP 发码日限 429 未重置，UTC 00:00 后可测）

**环境**：部署确认 entry `index-DX45eo51.js` 含「服务暂时不可用，请重试」文案；线上 /api/auth/* 响应头 storage=blob。脚本 `/home/ubuntu/r291_ui2.py`；结果 `r291_probe.json`、`r291_ui.json`、`r291_ui2.json`。计划 test-plan-round291.md。

## T1 545 频率对比（#294 ② Blob Store 模块级单例）— PASSED（趋势口径）
- GET /api/auth/me ×25 + GET /api/quota ×25（间隔 ~0.8s，不消耗发码限额）：**全部 200，545 计 0/50**。
- 口径注记：r290 的 ≈25%（6/24）在 POST /api/auth/code、/api/auth/verify 上测得（发码日限已耗尽，无法在同端点复测），本对比为趋势性而非同端点同口径；0/50 与修复预期一致。

## T2 5xx 友好提示 UI（#294 ③ apiFetch fallback）— PASSED
- CDP Fetch.fulfillRequest 把 /api/auth/code 模拟成真实网关形态（545 + text/html「Error return from script」，Playwright route.fulfill 不接受非标状态码 545，改用原生 CDP）：/account 点「获取验证码」后表单显示**「服务暂时不可用，请重试」**（r290 旧行为为静默零提示，可区分）；截图 r291_t2_545ui.png（OCR 复核）；pageerror=0。
- 反向确认：模拟 400+JSON `{"error":"测试用服务端文案400"}` 时 UI 仍显示服务端文案（fallback 未覆盖正常错误通道）。

## T3 登出分支补测（r290 遗留；含 #294 ① 不吞码顺带）— BLOCKED
- 实探 POST /api/auth/code → 429「请求过于频繁，请明天再试」（storage=blob）——本机 IP 的 20 次/日限额（UTC 日键）未重置，当前 20:06 UTC，**00:00 UTC 后重置可测**。登录→头像下拉登出→me=null→刷新仍未登录 的闭环与错码文案回归（T4）均顺延。#294 ①「verify 成功后才删码」在生产同因无法直接实证（需真实发码）。

## T5 常规 — PASSED
探测请求无 payload / 拦截仅本地模拟（名单零外发）；pageerror=0；storage/cookie 清理、context 全关。headless CDP 未录屏。

---

# 第 290 轮（2026-08-12）：#291 blob 存储后登录全链路 + #292 分散对齐折行回退 ⚠️ 两项修复本体均验证生效（登录成功/刷新保持/错码专属文案；折行回退居中+单行分散不回归），但**新发现 P2**：/api/auth/code 与 /api/auth/verify 间歇返回 545「Error return from script」（受控探测 6/24 ≈25%），UI 无任何反馈提示；且 verify 遇 545 后原验证码记录疑似丢失（后续同码报「已过期」）。另：登出分支 UNTESTED（测试自身触发 IP 日限 20 次 429，无法再发码）。

**环境**：部署确认 entry `index-DEJK6L2z.js`；线上 /api/auth/* 响应头 `X-SeatMark-Storage: blob`（#291 生效实测）。CDP 全新 incognito context 打生产；收码 mail.tm（@emalupe.com）。脚本 `/home/ubuntu/r290_login*.py`、`r290_justify.py`、`r290_export.py`、`r290_analyze.py`；结果 `r290_login.json`、`r290_login3.json`、`r290_justify.json`、`r290_export.json`、`r290_analyze.json`、`r290_pdf_analyze.json`；导出物 `/home/ubuntu/r290_dl/`。计划 test-plan-round290.md。

## T1 登录全链路（#291，r289 T3/T4 补测）— 主体 PASSED（登出 UNTESTED）
- 发码：200 `{"ok":true,"delivery":"email"}`、storage=blob；toast「验证码已发送」；mail.tm 真实收码。截图 r290_sent.png。
- **错码专属文案（r289 被 memory 掩盖的分支闭环）**：真码±1 提交 → 400 `{"error":"验证码不正确"}`、storage=blob；UI 显示「验证码不正确」。截图 r290_wrongcode.png。
- **verify 登录成功（r289 16/16 失败 → 本轮成功）**：真码提交后进入个人中心，显示邮箱 seatmark290x553238@emalupe.com、「今日无水印导出配额 3/3」及「每日 0 点恢复为 3 次」登录态配额文案（与匿名 1 次区分）。截图 r290_loggedin.png（OCR 复核文案）。
- 刷新保持登录：reload 后仍个人中心（/api/auth/me 返回用户驱动前端恢复）。截图 r290_refresh.png。注：该成功轮脚本在登出步骤崩溃（登出按钮实际在头部头像下拉菜单 AppHeader.vue 内，脚本按钮定位错误超时），API 明细 JSON 未落盘，登录/刷新证据以截图+OCR 为准。
- **登出 — UNTESTED**：重跑补测时 /api/auth/code 返回 429「请求过于频繁，请明天再试」（IP 日限 20 次被本轮探测耗尽；限频键为 UTC 日期，约 4 小时后重置）——顺带实证 **IP 日限频在 blob 下已生效**（r289 memory 下不生效的既有运维项闭环）。
- storage 头：全部有响应头的 /api/auth/* 均 blob；**545 响应无 X-SeatMark-Storage 头**（EdgeOne 网关级错误页）。
- payload 仅 {email, code}（名单零外发）；pageerror=0。

## T2 **P2 新发现：auth 接口间歇 545「Error return from script」**
- 受控探测 12 组「发码+错码 verify」：/api/auth/code 200×9 + 545×3；/api/auth/verify 400×9 + 545×3（合计 6/24 ≈25%）。间歇性、重试通常可过 → 疑似部分 EdgeOne 边缘实例上 `@edgeone/pages-blob` 运行时抛异常未被捕获（#291 改字面量 import 后新出现的形态）。
- 用户可见影响：①UI 无反馈——发码/登录点击后无 toast 无错误文案（前端未处理非 JSON 545 响应）；②一轮实测中 verify 遇 545 后，同一真码重试报「验证码已过期」（记录疑似在崩溃路径中丢失/未回写），用户需重新收码且受 60s 重发与 IP 日限约束。复现明细 r290_login.json（verify 545→已过期序列）、r290_login3.json（429）。
- 建议：verify/code 主路径包 try/catch 落 5xx JSON+storage 头；前端对非 2xx/非 JSON 响应给通用错误 toast。

## T3 #292 分散对齐折行回退 — PASSED（预览判据）
- 复现 r288 场景（TAB 分列「创新 网络科技公司」+姓名字段分散对齐+maxLines=2）：折行字段 computed textAlign/textAlignLast=**center**（data-justify=1 存在，adjustJustify 生效；r288 旧行为 justify 可区分）；Range 实测第一行「创新 」墨迹 leftGap=rightGap=42px、span=27.6%——**整体居中不再拉到两端**。截图 r290_wrap_justify.png、整页 r290_preview_justify.png。
- 单行不受影响：张三/王小明 textAlignLast=justify、行内墨迹 span=100%（首尾贴边）。截图 r290_zs_justify.png、r290_wxm_justify.png。
- 普通居中对齐折行对比：切回「居中」后同内容 textAlign=center/textAlignLast=auto，截图 r290_wrap_center.png（与分散对齐折行回退后形态一致——视觉对比用）。

## T4 单行分散对齐导出回归（Regression，r288 像素判据沿用）— PASSED
- 带水印逐张 PNG（1000px 宽）：张三墨迹 span=97.5%/2 簇首尾贴边、王小明 span=97.3%；折行卡第一行 span=47.5% 居中（left 24.6%/right 27.9%，非两端拉伸）。裁片 /home/ubuntu/r290_dl/crop_zs.png、crop_wxm.png、crop_wrap_l1.png。
- 图片版 PDF（pdftoppm 150dpi）：张三 span=97.3%/2 簇、王小明 span=97.3%；折行卡第一行 span=26.8%、左右留白各 36.6%——**完美居中**。裁片 pdf_zs_crop.png、pdf_wxm_crop.png、pdf_wrap_l1_crop.png。

## T5 常规 — PASSED
第三方请求扫名单标记串零命中；pageerror=0（登录+设计器+导出全程）；storage 清理、context 全关、常驻 Chrome 未动。headless CDP 未录屏。

---

# 第 289 轮（2026-08-12）：SES 认证后登录全链路线上复测 ⚠️ 发码链路 PASS（502→200 闭环、邮件真实送达），**verify 全部失败**——生产 `X-SeatMark-Storage: memory` 跨实例读不到验证码（发码与验码落在不同边缘实例），登录成功分支（T3/T4）untested。属既有运维限制（KV/Blob 未绑定），非本次代码缺陷；但当前效果是**线上用户实际无法完成登录**。

**环境**：CDP 全新 incognito context 打生产 /account；收码邮箱用 mail.tm API（@emalupe.com 随机地址）。脚本 `/home/ubuntu/r289_run.py`、`r289_retry.py`，结果 `r289_res.json`、`r289_res2.json`。

## T1 发码 — PASSED（r227 的 502 容错分支闭环为 200 真实发信）
- POST /api/auth/code → **200** `{"ok":true,"delivery":"email"}`（非 stub/devCode，无 X-SeatMark-Mail-Error）；UI toast「验证码已发送」+ 按钮变「57s 后重发」disabled 倒计时。截图 r289_t1_sent.png。
- mail.tm 收件箱 4/4 轮均收到主题『【SeatMark 座签】登录验证码 XXXXXX』真实邮件（SES 发信认证生效）。

## T2 错误分支 — 部分（重发频控前端护栏 PASSED；错码文案被 memory 掩盖）
- 60s 重发：按钮 disabled 显示「57s 后重发」（前端倒计时护栏，服务端 60s 限频未能独立触发——按钮不可点）。
- 错误验证码：返回 400 但文案为「验证码已过期，请重新获取」而非「验证码不正确」——验码实例读不到 code 记录（memory 掩盖了错码分支），错码专属文案未能实证。

## T3 verify 登录 — FAILED（memory 运维限制，非代码缺陷；判「邮件收到但验码失败」）
4 个新邮箱 × 每邮箱 4 次快速重试（共 16 次 verify）全部 400「验证码已过期，请重新获取」；每次响应头 X-SeatMark-Storage=memory。区分口径：邮件全部收到、码为邮件原文 6 位码且在 10 分钟 TTL 内提交——失败原因为发码写入实例与验码读取实例不同。**结论：KV/Blob 绑定生效前，线上真实用户大概率同样无法登录**（复现 16/16）。

## T4 登录态链路（me/刷新保持/登出/配额文案）— UNTESTED（依赖 T3 成功）

## T5 常规 — PASSED
/api/auth/* payload 仅含 {email, code}（名单零外发）；pageerror=0；storage 清理、context 全关。headless CDP 未录屏。

---

# 第 288 轮（2026-08-12）：#289 线上复测——分隔符优先换行 + 分散对齐（含导出预栅格化）✅ 全部判据 PASS

**环境**：部署确认 CSS `index-Drr90_HC.css` `.label-field__body`=`word-break:keep-all;overflow-wrap:anywhere`、`StudioView-CAoR79uO.js` 含「分散对齐」/textAlignLast/Intl.Segmenter。CDP 全新 incognito context 打生产 /studio；脚本 `/home/ubuntu/r288_run.py`/`r288_p2.py`/`r288_p3.py`，结果 `r288_res*.json`，导出物 `/home/ubuntu/r288_dl2/`、`r288_dl3/`。

## T1 分隔符优先换行 — PASSED
制表符分列导入「创新 网络科技公司」（空格留在姓名单元格内），设计器把姓名字段 maxLines=2：预览 computedStyle wordBreak=keep-all/overflowWrap=anywhere；Range 逐字测行位：折行点 index=3，第一行=「创新 」——**在空格处折行**（旧 break-all 为任意字符断行可区分）；无空格 18 字长串仍换行且 scrollWidth-clientWidth=0 无横溢。截图 r288_card_wrap.png。注：粘贴解析中空格本身是分列分隔符（空格分隔输入会被拆成两列），需用制表符/逗号分列才能把含空格文本留在同一单元格——as-designed，如实记录。

## T2 分散对齐（设计器→预览）— PASSED
设计器「水平对齐」下拉选项=[左, 居中, 右, **分散对齐**]；选中姓名字段设分散对齐并保存自定义模板后，预览「张三」computedStyle textAlignLast=justify，字段截图墨迹横跨 99.1% 字段宽（两字分居两端；居中形态为中部单簇可区分）。截图 r288_card_zs.png、r288_preview2.png。

## T3 导出所见即所得（rasterizeJustifiedText）— PASSED（PNG+图片版 PDF）
- 带水印逐张 PNG：张三卡姓名字段墨迹 span 占字段宽 **97.1%**、列簇=2（首尾贴边）；王小明卡 span 97.1%、列簇=3 等距——与预览 justify 分布一致，**非居中聚拢**（html2canvas 原生 justify 会画成居中，若未预栅格化则 span 显著 <60%）。证据 `r288_dl2/分散288b-*-001/002_crop.png`。
- 图片版 PDF（带水印）第 1 页 pdftoppm 栅格同判据：张三 ratio 0.967/2 簇、王小明 0.967/3 簇 — 一致。证据 `r288_dl3/pdf_zhangsan_crop.png`、`pdf_wangxiaoming_crop.png`。
- 带 caption/多行字段跳过预栅格化的形态未单独构造（设计如此，跳过路径未触发）。

## T4 回归+常规 — PASSED
左/中/右对齐既有路径以第 287 轮同日「标准考场版」（居中）导出成功为回归证据；全程 pageerror=0；张三/王小明/公司名串第三方零外发；storage 清理、context 全关。headless CDP 未录屏。

---

# 第 287 轮（2026-08-12）：#287 线上复测——匿名配额/分享频控「今日」改本地日期 ✅ 全部判据 PASS（r286 P4 闭环）

**环境**：部署确认 entry `index-BdUDE_2p.js` 含 `getFullYear/getMonth/getDate + padStart(2,"0")` 本地日期拼接。CDP 全新 incognito context（timezone_id=Asia/Shanghai + Date 偏移至北京次日 01:30，UTC 未跨日）打生产 /studio?demo=1。脚本 `/home/ubuntu/r287_run.py`，结果 `r287_res.json`。

## T1 主判据（r286 场景反转）— PASSED
自检 `new Date()`=Aug 12 01:30 GMT+0800 / ISO 日期仍 2026-08-11。预写 {date:'2026-08-11'(=本地昨日), used:1} → 弹窗「无水印导出（今日剩余 1 次）」（r286 旧行为=0 次可区分），无水印导出成功下载 `标准考场版-20260812-013014.zip`，写回 {date:'2026-08-12'(本地今日), used:1}；分享频控键 date 同为 2026-08-12——配额/分享/文件名三者日历统一为本地日期。截图 r287_t1_beijing0130.png。

## T2 回归 — PASSED
- 容错：{date:'2099-01-01',used:99}、{date:'garbage',used:null} 均「今日剩余 1 次」，无负数无锁死。
- 单页签：第 1 次无水印成功（used=1）、B 页签**不刷新**即「今日剩余 0 次」且强点无下载+引导弹窗（#282 行为不回归），used 保持 1 不覆写。截图 r287_t2_B_blocked.png。
- 常规：pageerror=0；26 条第三方请求扫演示名单串零命中；storage 清理、context 全关。

---

# 第 286 轮（2026-08-11）：日期/时区与「跨日重置」语义边界审计（生产，无代码变更轮）✅ 容错与逆向判据 PASS，⚠️ 证实 **1 个 P4**：匿名配额「今日」为 **UTC 日期**（`quota.ts:19 toISOString`）——北京时间 00:00–08:00 属「本地新一天但 UTC 未跨日」窗口，配额不重置（实测北京 01:30 仍显示「今日剩余 0 次」，到 08:00 才恢复）；且同一时刻导出文件名用**本地日期**（实测 `20260812-013018`）与配额/分享计数键的 UTC 日期（2026-08-11）**两套日历并存**。未来/异常日期记录容错全过、无锁死。

**环境**：CDP 29229 全新 incognito context（timezone_id=Asia/Shanghai + init script 偏移 Date 至北京次日 01:30）打生产 /studio?demo=1。脚本 `/home/ubuntu/r286_run.py`，结果 `/home/ubuntu/r286_res.json`。代码基准 `quota.ts:18-19`（UTC）、`pngExport.ts:144`/`pdfExport.ts:779`（本地时间戳）、`PreviewArea.vue:320-334`（分享计数同 UTC）。

## T1 北京 01:30 场景（主判据）— 证实 UTC 口径（P4）
- 模拟环境自检：`new Date()` = Wed Aug 12 2026 01:30 GMT+0800，`toISOString().slice(0,10)` = 2026-08-11（本地已跨日、UTC 未跨）。
- 预写 {date: 2026-08-11(UTC 今日), used:1}（=北京「昨晚」消耗）→ 导出弹窗仍「今日剩余 0 次」并拦截——**本地新一天不重置**。定级 P4：仅影响 0–8 点的匿名用户，重置延迟至北京 08:00 而非丢失；宣传文案「每日 0 点自动恢复」（定价页 FAQ）与实际（北京 8 点）不符。修复方向：todayStr 改本地日期（getFullYear/Month/Date），或文案改「按 UTC 日」。截图 r286_t1_beijing0130.png。
- 逆向：预写 {date: UTC 昨日, used:1} → 「今日剩余 1 次」正常重置 ✅。

## T2 未来/异常日期容错 — PASSED
{date:明天,used:1}、{date:'2099-01-01',used:99}、{date:'garbage',used:null} 三种预写刷新后均显示「今日剩余 1 次」（非当日记录按 0 处理），无负数无锁死；随后无水印消费成功、写回 {date: 今日UTC, used:1}。

## T3 导出文件名时间戳 — PASSED（附两套日历并存记录)
北京 01:30 带水印导出文件名 `标准考场版-20260812-013018.zip`——日期/小时为本地口径（正确符合用户直觉）；但同一时刻配额键与分享计数键 date=2026-08-11（UTC）——同一次导出两套日历并存，为 T1 P4 的佐证。

## T4 分享引导计数键 — PASSED（同 UTC 口径记录）
导出后 `seatmark.post-export-share-prompt.v2` = {"date":"2026-08-11","count":1}（UTC 口径，与 quota 一致；影响仅为提示频控窗口偏移，无用户可见损失）。

## T5 常规 — PASSED
全程 pageerror=0；13 条第三方请求扫 demo 名单串零命中；storage 清理、context 全关、常驻 Chrome 未动。headless CDP 未录屏。

---

# 第 285 轮（2026-08-11）：#285 粘贴名单剥离零宽字符线上复测 ✅ 全部判据 PASS——r283 P4 闭环：`\ufeff`/`\u200b` 导入后不残留（codepoint 级断言），emoji ZWJ 序列（👨‍👩‍👧‍👦）完整保留不拆散；TSV/纯姓名/逗号顿号/「首行是表头」开关回归全过；pageerror=0、隐私零外发。

**环境**：部署确认 entry `index-DQXCHqb-.js`→`index-DHZCT1Xa.js`，excel chunk `excel-DN-BUKnq.js` 含 `replace(/[\u200b\ufeff]/g,"")`。CDP 29229 全新 incognito context 打生产 /studio。脚本 `/home/ubuntu/r285_run.py`，结果 `/home/ubuntu/r285_res.json`。

## T1 主判据 — PASSED
粘贴 `\ufeff姓名\n\u200b张三285\u200b\n👨‍👩‍👧‍👦`：识别行=「识别到 2 条数据、1 列（首行为表头：姓名）」（BOM 剥离后表头正常识别）；导入后 headers=["姓名"] 无 \ufeff/\u200b；行 1 姓名 === "张三285"（前后零宽全剥，r283 旧行为为 \u200b 残留，可区分）；行 2 姓名逐 codepoint = U+1F468 ZWJ U+1F469 ZWJ U+1F467 ZWJ U+1F466（UTF-16 长度 11）——3 个 \u200d 完整保留，家庭 emoji 不被拆散。截图 r285_t1.png。

## T2 回归（Regression）— PASSED
TSV：1 条 2 列表头「姓名/班级」；纯姓名 3 行：3 条、首列「姓名」；逗号/顿号混用：2 条 2 列（张三285/一班）；「首行是表头」开关：勾选→「首行为表头：张三285」且 3→2 条，取消→恢复自动识别。

## T3 常规 — PASSED
pageerror=0；19 条第三方请求扫「张三285/李四285」零命中；storage 清理、context 全关、常驻 Chrome 未动。headless CDP 未录屏。

---

# 第 283 轮（2026-08-11）：剪贴板与文本输入边界稳健性审计（生产，无代码变更轮）✅ 主体判据 PASS（CRLF/CR/全角空格/制表符混排/超长单元格/10000 行大粘贴/emoji 导出/表单边界/IME 冒烟全过、pageerror=0、隐私零外发），⚠️ 1 个 P4 观察：零宽字符（\u200b/BOM）粘贴后不被过滤、随姓名进入数据与导出（打印不可见但占位）；另 1 处未覆盖：HTML 富文本真实剪贴板粘贴未执行（headless 限制，textarea 语义上取 text/plain）。

**环境**：生产 /studio、/seating，CDP 29229 全新 incognito context。脚本 `/home/ubuntu/r283_p3.py`（T1 主体+T3+反馈）、`r283_p2.py`（大粘贴/seating/字段边界）、`r283_p4.py`、`r283_p5.py`；结果 r283_res*.json；导出物 `/home/ubuntu/r283_dl/`。代码基准 `utils/excel.ts:210-253` parsePastedRoster。

## T1 粘贴导入极端内容 — PASSED（1 个 P4 观察）
- CRLF：2 条 2 列、表头「姓名/班级」识别 ✅；老 Mac CR：3 条 ✅；全角空格 \u3000：转半角后按空白分列 2 列 ✅；\t+多空格混排：优先按 \t 分列、多空格保留在单元格内（符合代码语义）✅。
- 零宽/BOM：`\ufeff姓名` 表头正常识别；但 `\u200b张三283` 的零宽字符**残留在姓名数据**（未过滤）——P4 观察：不可见字符随导出打印占位，建议解析时剥离 \ufeff/\u200b/\u200c/\u200d。
- Emoji/组合字符（👨‍👩‍👧‍👦、é 组合、🎂）：3 条导入 ✅；600 字超长单元格：导入成功不报错 ✅。
- 10000 行大粘贴：「识别到 10000 条数据、2 列」实时解析正确、点导入 0.4s 完成、toast「已导入 10000 条」、页面响应正常（evaluate 4ms）✅。测试侧注记：Playwright fill() 对 10000 行 textarea 两次超时（值实际已写入、计数正确）——自动化工具侧现象，真实用户单次粘贴不受影响，但提示粘贴框对超大文本的每次 input 重解析开销可留意。
- 空/纯空白：导入按钮直接禁用（比 toast 更早的防线）✅。
- 未覆盖：从网页复制的 HTML 富文本真实粘贴（需要真实剪贴板 text/html，headless CDP 未执行；textarea 粘贴语义上仅取 text/plain）。

## T2 表单输入边界 — PASSED
- /studio 名单单元格注入 \u0007+300 字后刷新渲染：pageerror=0、页面正常（r283_t2_longcell.png）。
- /seating 列数输入 0/99/-1 → 钳制为 1/16/1（min=1 max=16）✅；1000 行名单粘贴后页面响应 5ms 不卡死 ✅。
- 反馈表单：textarea maxlength=2000 前端硬截断（2500 字→2000、计数器 2000/2000）——「不能超过 2000 字」toast 经 UI 不可达（双保险）；含 emoji 提交成功「感谢反馈！」+ POST /api/feedback（已提交 1 条标注可忽略的测试反馈）。

## T3 Emoji 导出回归 — PASSED（附注记）
emoji 名单带水印导出 zip 3 张 PNG（1000×534），PIL 验非空白（非白像素采样 1085-1248）✅；预览截图 r283_t3_preview.png。注记：首次导出尝试曾 300s 无下载（无报错文案），重开 context 重试即成功——偶发未复现，如再遇可关注导出首次运行的资源加载。豆腐块判定基于 PNG 非空白+预览截图，未做逐字形像素比对。

## T4 IME 冒烟（Regression r21）— PASSED
/seating 标题逐字键入「输入法冒烟283」值完整；/studio 模板搜索框逐字键入后搜索功能正常（r283_t4_ime.png）。

## T5 常规 — PASSED
全程 pageerror=0（所有脚本）；第三方请求扫标记串（张三283/学生283/蛋糕283/输入法冒烟等）零命中；storage 清理、context 全关、常驻 Chrome 未动。

---

# 第 282 轮（2026-08-11）：全站 SEO 元数据与结构化数据一致性审计（生产，无代码变更轮）✅ 全部判据 PASS，零发现——13 页抽样 title 唯一/canonical 规范/OG 卡片齐全、JSON-LD 全部合法且字段完整（pricing FAQ 6 条=源数据）、sitemap 331 条抽 15 全 200 非软 404、/account /admin noindex、无效 slug 真 404、SPA 导航 head 同步正常。

**环境**：以当前线上为基线（entry index-DQXCHqb-.js）。curl 静态源审计脚本 `/home/ubuntu/r282_audit.py`（结果 `/home/ubuntu/r282_audit.json`）+ 浏览器 SPA head 同步 `/home/ubuntu/r282_t6.py`。代码基准：`data/seo.ts`（单一数据源）、`scripts/prerender.mjs`（同清单生成预渲染页与 sitemap）。

## T1 预渲染内容页抽样（13 页）— PASSED
/、/templates、/papers、/pricing、/seating、/vs、/guides、2 篇 guides 详情、/vs/chuangkit、/desk-card-generator、/name-card-batch、/terms：title 全部唯一且与 seo.ts 一致；description 非空无乱码；canonical=https://www.seatmark.cn+规范路径（根「/」结尾、其余无尾斜杠无参数）；og:url=canonical。issues=0。

## T2 OG/Twitter 卡片 — PASSED
13 页 og:title/og:description/og:image/twitter:* 全存在且 og:title=title；og-image.png HTTP 200、image/png、121KB。

## T3 JSON-LD — PASSED
全部 script JSON.parse 通过；首页 SoftwareApplication（offers.price=0）；/pricing SoftwareApplication+FAQPage（mainEntity=6=PRICING_FAQS）+BreadcrumbList；guides 详情 Article+BreadcrumbList+HowTo（4-5 步）+FAQPage（3 条）；topic 页 SoftwareApplication+HowTo+FAQ+Breadcrumb；必填字段（@context/@type、FAQ name+text、Breadcrumb position/item）零缺失。

## T4 sitemap 与 robots — PASSED
sitemap 331 条抽 15（首页/studio/privacy/guides×3/templates×3/papers×2/vs×2/topic×2）全部 HTTP 200 且非软 404（title 正确、无「页面不存在」）；robots.txt Sitemap 行一致；现状记录：/studio 在 sitemap 且 robots=index,follow（设计如此），/account /admin 不在 sitemap、预渲染源 robots=noindex, nofollow。

## T5 无效 slug 真 404 — PASSED
/guides/no-such-guide-xyz 与 /templates/no-such-tpl-xyz 均 HTTP **404**、title「页面不存在 - SeatMark 座签」、robots=noindex, follow。

## T6 基础属性 + SPA head 同步 — PASSED
13 页均 lang=zh-CN、charset=utf-8、viewport；浏览器 / → 点击导航 /pricing → /templates：title/canonical/og:url/JSON-LD 类型全部跟随路由更新；pageerror=0；storage 清理、context 关闭、常驻 Chrome 未动。截图 r282_t6_home/pricing/templates.png。

---

# 第 281 轮（2026-08-11）：#282 匿名配额多页签同步线上复测 ✅ 全部判据 PASS——r279 P4 闭环：A 页签消耗后 B 页签**不刷新**即显示「今日剩余 0 次」并拦截（引导弹窗），used 保持 1 不覆写；反向同样拦截；单页签/跨日重置/带水印不计数回归全过；pageerror=0。

**环境**：部署确认 entry `index-BY-oO6Ou.js`→`index-DQXCHqb-.js`（新 entry 含 `addEventListener("storage",…clean-export-usage…)` 特征）。CDP 29229 全新 incognito context 双 page 打生产 /studio?demo=1。脚本 `/home/ubuntu/r281_run.py`，结果 `/home/ubuntu/r281_res.json`。

## T1 主判据：A 消耗 → B 不刷新同步 + 拦截 — PASSED
A 无水印导出成功（下载 1 个），localStorage `seatmark.clean-export-usage.v1`={"date":"2026-08-11","used":1}；B **不刷新**打开导出弹窗：文案已变「今日 0 次 无水印导出（今日剩余 0 次） 今日已用完，登录后每天 3 次，还可分享送次数」（r279 旧行为=「剩余 1 次」，可区分）；B 强行点击无水印 → **无下载**、引导弹窗出现（含「登录后每天」文案）；used 保持 1 不被覆写。截图 r281_t1_B_norefresh.png / r281_t1_B_blocked.png。

## T2 反向：B 先消耗、A 后拦截 — PASSED
新 context，B 无水印导出成功；A 不刷新尝试 → 文案「今日剩余 0 次」、无下载、引导弹窗、used=1。（截图渲染超时未取到，判据以文案/下载/storage 实值取证。）

## T3 回归 — PASSED
- 单页签：第 1 次无水印导出成功（「今日剩余 1 次」→下载），第 2 次拦截（「剩余 0 次」+引导弹窗，无下载），used=1。截图 r281_t3_second_blocked.png。
- 跨日重置：预写 {date:昨日,used:1} 后新页签显示「今日剩余 1 次」且导出成功，写回 {date:今日,used:1}。
- 带水印导出不计数：下载成功后 used 仍=1。

## T4 常规 — PASSED
全程 pageerror=0；storage 清理、context 全关、常驻 Chrome 未动。headless CDP 未录屏。

---

# 第 279 轮（2026-08-11）：多页签/多实例并发一致性专项（生产，无代码变更轮）✅ 主体判据 PASS（名单页签隔离、#153 写竞争防护、seating/studio 互不干扰、双击导出防重、pageerror=0、隐私零外发），⚠️ 发现 **1 个 P4**：匿名无水印配额跨页签不同步——A 页签消耗当日 1 次后，B 页签（未刷新）仍显示「今日剩余 1 次」且可再次无水印导出，且写回为覆写（used 仍=1 而非 2）——每多开一个页签实际可多得 1 次无水印导出；刷新后口径恢复正确（「今日剩余 0 次」并拦截）。

**环境**：CDP 29229 全新 incognito context 内开双 page（同源共享 localStorage、独立 sessionStorage）打生产。脚本 `/home/ubuntu/r279_p2.py`（T2/T3/T4/T5）与 inline T1 重跑；请求 `/home/ubuntu/r279_reqs.json`（106 条第三方扫描）。

## T1 双页签 /studio 名单隔离 + 模板共享 — PASSED
A 粘贴 3 条（页签A279-*）「共 3 条」、B 粘贴 2 条「共 2 条」；各自 sessionStorage roster 只含本页签名单（互不污染）；B 换模板「大字远视版」→ A 刷新后模板跟随 B（localStorage 共享的既有语义）且 A 名单仍「共 3 条」（sessionStorage 本页签保留）。截图 r279_t1_A.png、r279_t1_B.png。

## T2 自定义模板写竞争（Regression r138/#153）— PASSED
A、B 相继经设计器保存「定制A279」「定制B279」→ `seatmark.custom-templates.v1` 同时含两条（写前 syncFromStorage 生效，后写不覆盖先写）；A 页签无需刷新即在模板列表看到「定制B279」（storage 事件同步生效）。截图 r279_t2_A.png、r279_t2_B.png。

## T3 配额跨页签一致性 — ⚠️ 发现 P4
A 无水印导出 1 次成功 → localStorage `{used:1}` ✅；B（未刷新）弹窗仍「无水印导出（今日剩余 1 次）」（内存陈旧，代码无 storage 监听）→ B 无水印导出**成功放行**，且写回仍 `{used:1}`（内存 0+1 覆写，未累加）→ 匿名日配额（1 次）实际按页签数放大。B 刷新后「今日 0 次…今日剩余 0 次」正确拦截 ✅。影响面：仅未登录本地计数（已登录走服务端计数不受影响）、且匿名配额本可通过清 storage 绕过，故评 P4；修复方向：quota store 加 storage 事件监听 + tryConsume 前重读 localStorage。证据截图 r279_t3_B_stale.png（B 陈旧显示）、r279_t3_B_after.png。

## T4 /seating 与 /studio 互不干扰 — PASSED
A /studio 名单 3 条、B /seating 标题改「并发279考场」→ `seatmark.seating-state.v1` 落盘、B 刷新后标题仍在；A 刷新名单仍「共 3 条」、roster 无 seating 数据写串。截图 r279_t4_seating.png。

## T5 快速连点导出 — PASSED
带水印连点 2 次（第二次点击被 loading 遮罩阻断，Playwright 超时）→ 仅 1 次下载（1 个 zip）、配额 used 不变；无水印路径配额只 +1。截图 r279_t5_dblclick.png。

## T6 常规 — PASSED
106 条第三方请求扫「页签A279/页签B279/并发279考场」零命中；全程 pageerror=0；storage 清理、context 全关、常驻 Chrome 未动。

测试侧注记：/studio 刷新后立即 page.screenshot 偶发超时（字体/预览渲染忙），加 timeout+捕获重试即可；不影响断言（断言走 evaluate/文案）。

---

# 第 278 轮（2026-08-11）：/papers 纸型库全链路专项（生产，无代码变更轮）✅ 全部判据 PASS：列表 17 款与源数据/页首宣称三方一致、抽 5 款规格逐字一致、详情/深链/404、纸型→工坊锁定与不适配自动换模板（r83）、自由排版解锁（r133）、21 格整页导出切缝像素级命中、跨模板纸型携带与不适配重置（r76）、隐私零外发、pageerror=0。

**环境**：CDP 29229 全新 incognito context 打生产。脚本 `/home/ubuntu/r278_run.py`、`r278_t5b.py`、`r278_t5c.py`（inline）；请求 `/home/ubuntu/r278_reqs.json`、`r278_reqs_t45.json`；导出物 `/home/ubuntu/r278_dl/标准考场版-*.zip`。

## T1 /papers 列表 — PASSED
卡片 17=页首宣称「17 种」=labelPapers.ts 源数据 17 款；抽 5 款（a4-1up/2up/8up/21up/8up-round）卡片规格行与源数据逐字一致（尺寸/列行/枚数/切角，含 74.25、42.4、99.1×67.7 等小数）；「圆角」筛选=5 款（源数据 rounded 5 款）、「全部」恢复 17；移动端 390×844 scrollWidth=380 无横溢。截图 r278_t1_list.png、r278_t1_round.png、r278_t1_mobile.png。

## T2 详情与深链 — PASSED
/papers/a4-8up 规格表：整张 A4 210×297、单枚 105×74.25、2 列×4 行每页 8 枚、间距 0、直角满切——与源数据一致；适配模板推荐 3 个 /templates/ 链接（=recommendedTemplates 3 项）；curl 直开 HTTP 200 且静态源含「8格不干胶」×6（预渲染）；/papers/no-such-paper-xyz HTTP **404**。截图 r278_t2_detail.png。

## T3 纸型→工坊 — PASSED
- 详情页点「用此纸型开始排版」→ /studio?paper=a4-8up，toast「已按纸型锁定排版」。截图 r278_t3a_studio.png。
- 不适配自动换模板（Regression r83）：先以 fullPage（整页名牌版）进入再直开 ?paper=a4-21up → toast「已换用适配该纸型的模板…已切换到『幼儿姓名贴·奶油云朵』并按纸型锁定排版（每页 21 枚）」。截图 r278_t3b_autoswitch.png。
- 自由排版解锁（Regression r133）：锁定态选「不使用纸型（自由排版）」→ toast「已取消纸型锁定」，模板恢复默认 3×8、60×32（锁定值 3×7、70×42.4 可区分）。截图 r278_t5_unlock.png。

## T4 纸型约束下整页导出 — PASSED
/studio?paper=a4-21up&demo=1（标准考场版适配直接锁定 3×7、70×42.4；演示 26 条）→ 开裁切线 → 「按整页导出（每页纸张一张 PNG）」带水印导出 → zip 2 页 PNG 2481×3509（比例=210:297 误差<0.01%）；PIL 沿 labelPaperGeometry 推导切缝抽验：x=70/140mm 两条列缝、y=42.4k（k=1..6）六条行缝在 ±2px 内均检出暗线（缝上灰度 ~64 vs 背景 ~254）。截图 r278_t4_studio.png、r278_t4_page1.png（导出首页）。

## T5 跨模板切换不残留（Regression r76）— PASSED
锁定 a4-21up 下切「大字远视版」（适配）→ toast 含「已保留纸型」且标签仍 70×42.4、3×7（携带）；再切「整页名牌版」（不兼容多格纸型）→ toast「适配度不足…已恢复模板默认排版」且模板变 1×1、190×277（纸型不残留）。截图 r278_t5_carry.png、r278_t5_reset.png。

## T6 隐私与常规 — PASSED
演示名单字段串扫 25 条第三方请求零命中；全程 pageerror=0（各 context 均 0）；storage 清理、context 全关、常驻 Chrome 未动。

测试侧注记：工坊侧栏面板标题（「页面与版式」等）非按钮，Playwright click 会超时——用 scroll_into_view + 面板内 `button[aria-haspopup=listbox]` 遍历选纸型；模板切换用「浏览全部 N 款模板」弹窗内按名称点选最稳。

---

# 第 277 轮（2026-08-11）：#278 Sentry 上报前剥离 q（beforeSendTransaction/beforeBreadcrumb）线上复测（生产）✅ 全部判据 PASS——r275 P4 残留闭环：直开 ?q= 时 Sentry pageload 事务 envelope 全文零命中标记词，browser.metrics span description 已剥为 `https://www.seatmark.cn/templates`，Sentry 上报本身未被破坏。

**部署确认**：entry 翻转 `index-B2OZ6Rre.js`→`index-BY-oO6Ou.js`（轮询第 2 分钟命中）。环境：CDP 29229 全新 incognito context，标记词「考场277标记词」，Sentry envelope 全量落盘 `/home/ubuntu/r277_reqs.json`、命中采样事务全文 `/home/ubuntu/r277_tx_envelope.txt`，脚本 `/home/ubuntu/r277_run.py`。

## T1 主判据：直开 ?q= 的 Sentry envelope 零命中 — PASSED
- 直开 `…/templates?q=考场277标记词` 循环重试，第 **3** 个 context 采样命中（tracesSampleRate=0.2 合理范围）。
- 事务 envelope body 全文标记词原文/百分号编码 **0 命中**（r275 旧行为：browser.domContentLoadedEvent/loadEvent/connect/TLS/DNS/request/response 等 span description 均带 ?q=，可区分）。
- 剥离而非丢弃：span description=「https://www.seatmark.cn/templates」（路径保留）、`request.url=https://www.seatmark.cn/templates`、`transaction=templates`、navigation 面包屑 `from:"/templates",to:"/templates"` 均干净且完整。

## T2 Sentry 未被破坏 — PASSED
`"type":"transaction"` envelope 正常发出、结构完整（trace_id/span 树在）；三次直开 pageerror=0；页面功能正常（地址栏剥离为 /templates、搜索框带入标记词）。截图 r277_t1_direct.png。

## T3 快速回归（Regression）— PASSED
SPA 内搜索标记词：地址栏无 ?q=、无结果态正常、GA/百度 8 条第三方请求零命中；改搜「桌牌」25 款正常；pageerror=0；storage 清理、context 全关、常驻 Chrome 未动。截图 r277_t3_search.png。

---

# 第 275 轮（2026-08-11）：#277 搜索词不进地址栏（sessionStorage 根治）线上复测（生产）✅ 主判据基本达成，⚠️ 残留 1 条 P4：直开旧链接 `?q=` 时 Sentry pageload 性能事务的 browser.metrics span description 仍含原始完整 URL（Performance API `PerformanceNavigationTiming.name` 记录的是文档初始请求 URL，history.replaceState 无法改写）。SPA 内搜索（主路径）已彻底零外发——r273 的 5 条通道全部消失。

**部署确认**：entry 翻转 `index-B5y8Q7W3.js`→`index-B2OZ6Rre.js`，生产 HTML 含 `seatmark.templates-search.v1`（轮询第 2 分钟命中）。环境：CDP 29229 全新 incognito context，标记词「考场275标记词」，请求全量落盘 `/home/ubuntu/r275_reqs.json`，脚本 `/home/ubuntu/r275_run.py`。

## T1 SPA 内搜索零外发（主判据）— PASSED
- 搜索期间地址栏始终 `https://www.seatmark.cn/templates`（无 ?q=，r273 旧行为有）；`sessionStorage['seatmark.templates-search.v1']`=「考场275标记词」，清词后键被 remove。
- 第三方请求 31 条（GA 16、百度 hm.gif 5 等）URL+body 扫描：标记词原文/百分号编码 **0 命中**（r273 同口径为 GA dl/dr×5+Sentry×1）；GA `view_search_results` 事件不再出现。
- 非敏感保留：`cat=exam` 仍出现在 7 条 GA/百度上报中 ✅。截图 r275_t1_search.png。

## T2 直开 `?q=标记词` 旧链接兼容 — PASSED（功能）/ 1 条 Sentry 残留（隐私）
- 地址栏被剥离为 `/templates` ✅；搜索框带入标记词、结果为搜索后状态 ✅；sessionStorage 已转存 ✅。
- GA 首个 `dl=https://www.seatmark.cn/templates`、百度 `u`/`su` 均干净、sp0.baidu.com `l` 干净、无 `ep.search_term` ✅（r273 泄漏的 GA/百度 4 条通道全部关闭）。
- 🔴 残留（P4）：Sentry pageload 事务 envelope body 中 `origin:"auto.ui.browser.metrics"` 的 browser.domContentLoadedEvent/loadEvent/connect/TLS/DNS/request/response 等 span 的 `description` 均=原始 `…/templates?q=%E8%80%83%E5%9C%BA275…`——来源是浏览器 Performance API 导航条目（记录初始文档 URL，replaceState 改不了）。仅影响「直开旧 ?q= 链接」场景、仅 Sentry 一方；修复方向：Sentry `beforeSendTransaction`/`beforeSend` 里正则剥离 q，或关闭 browser.metrics span。
- 截图 r275_t2_direct.png。

## T3 保状态回归（r79）— PASSED
搜「桌牌」25 款 → 进 /templates/signage 详情 → 浏览器返回：搜索框仍「桌牌」、25 款恢复、地址栏无 ?q=；reload 后搜索框仍「桌牌」。截图 r275_t3_back.png、r275_t3_reload.png。

## T4 常规回归 — PASSED
cat 仍走 URL（点「考试」→ ?cat=exam；直开 ?cat=exam 卡片=31）；叠加「在「考试」分类中找到 2 款」；无结果态「清除搜索条件」恢复 222 且 sessionStorage 键清除；pageerror=0（两 context 均 0）；storage 清理、context 全关、常驻 Chrome 未动。截图 r275_t4_overlay.png、r275_t4_catdirect.png。

---

# 第 273 轮（2026-08-11）：#276 分析上报剥离搜索词 线上复测（生产）🔴 主判据 FAIL——修复只覆盖「手动 pageview 的路径参数」，标记词仍经 5 条通道外发：① GA 事件自动附带的 dl/dr=location.href（page_path 只改 dp，dl/dr 不受控）；② GA 增强测量 `view_search_results` 直接以 `ep.search_term=考场273标记词` 明文上报；③ 百度 hm.gif 的 su 参数；④ 百度主动推送 push.js（sp0.baidu.com s.gif?l=完整 URL）；⑤ Sentry navigation 面包屑（to:"/templates?q=…"）。已生效部分：GA 初始 config dl/dp 干净、百度手动 _trackPageview u 参数干净、cat=exam 保留、回归全过

**部署确认**：entry 翻转 `index-lywsFKJ6.js`→`index-B5y8Q7W3.js`，生产 HTML 含 `_setAutoPageview`（轮询第 2 分钟命中）。环境：CDP 29229 全新 incognito context，标记词「考场273标记词」，三阶段请求全量落盘 `/home/ubuntu/r273_reqs.json`。脚本 `/home/ubuntu/r273_run.py`。

**T1 主判据（SPA 内搜索零外发）— FAILED**
- 地址栏正常带 ?q=（功能未变）✅；但第三方请求命中标记词 7 处：
  - GA `en=page_view` 的 **dl**=`https://www.seatmark.cn/templates?q=%E8%80%83%E5%9C%BA273…`（含 `?cat=exam&q=…` 组合）与后续请求的 **dr**（referrer）同样带 q——gtag 的 `page_path` 只覆盖 dp 参数，dl/dr 由 gtag.js 自动取 location.href/前一 URL，未被剥离；
  - **Sentry** envelope body 的 navigation 面包屑：`{"category":"navigation","data":{"from":"/templates","to":"/templates?q=%E8%80%83%E5%9C%BA273%E6%A0%87%E8%AE%B0%E8%AF%8D"}}`。
- 非敏感保留判据：上报中仍见 cat=exam ✅（telemetryPath 只删 q 的意图达成，但达成面不完整）。

**T2 首屏直开 ?q=（初始 pageview）— FAILED（部分生效）**
- 已生效 ✅：GA 首个请求 dl=`https://www.seatmark.cn/templates`、dp=`/templates`（config 剥离生效）；百度 hm.gif **u**=`https://www.seatmark.cn/templates`（手动 _trackPageview 生效）。
- 仍泄漏 🔴：GA 增强测量自动事件 **`en=view_search_results`，`ep.search_term=考场273标记词` 明文**（GA4 站内搜索自动检测 URL 的 q 参数——比整 URL 更直接的外发）；百度 hm.gif **su**=`…?q=%E8%80%83%E5%9C%BA273…`；**百度主动推送** `sp0.baidu.com/...s.gif?l=https://www.seatmark.cn/templates?q=考场273标记词`（push.js 取 location.href 提交 SEO 收录——搜索词甚至进入百度收录队列）。
- 功能不受影响 ✅：搜索框带入标记词、无结果态正常渲染。

**T3 回归（Regression）— passed**：标记词无结果态+清除恢复 222+「考试」×「考号」叠加「在「考试」分类中找到 2 款」不变；GA page_view 10 次、路径对应各页（含 /templates?cat=exam——cat 保留）、百度 hm.gif 仍在发（防矫枉过正 ✅）；pageerror=0；storage 清理。

**修复建议（供裁量）**：① GA：`gtag('set','page_location',clean)` 不够——需在 config 关掉增强测量站内搜索（`site_search_query_parameter` 置空/`enhanced_measurement` 关闭）并考虑用 Measurement Protocol 层面 dl 不可控的现实，或索性在 history.replaceState 层把 q 从 URL 剥离（搜索状态改存内存/sessionStorage）；② 百度：su 与 push.js 均取 location.href，同样只有「URL 不含 q」才能根治；③ Sentry：`beforeBreadcrumb` 过滤 navigation 面包屑 query。**根治方案**是不把搜索词放进地址栏 query（代价：r79 的返回保状态需换实现），否则每个第三方 SDK 都要逐一拦截。

**结论**：#276 未闭环 r271 P4 观察①——搜索词仍外发（且新发现 GA `ep.search_term` 明文与百度收录推送两条更直接的通道，建议升级为 P3 处理）。计划：`test-plan-round273.md`。证据：`/home/ubuntu/r273_reqs.json`；截图 `/home/ubuntu/screenshots/r273_t1_search.png`、`r273_t2_direct.png`、`r273_t3_overlay.png`、`r273_t3_studio.png`。

---

# 第 271 轮（2026-08-11）：模板发现链路质量专项（/templates 搜索·筛选·详情·进工坊，生产，无代码变更轮）✅ 全部判据 PASS——中文/全拼/简拼搜索命中正确（历史开放项闭环：简拼支持，jkz 命中监考证）、无结果态+清空恢复、特殊字符/超长输入健壮；分类/子分类计数与卡片数一致、搜索×分类叠加与跨类回退提示正确（r81 回归过）；3 款详情规格与源数据逐字一致、「用此模板开始」进工坊模板+场景演示数据正确带入（r115 回归过）；预渲染直开 200、无效 slug HTTP 404+404 视图（r85 回归过）；移动端 390px 无横溢。2 个 P4 观察：搜索词经 URL ?q= 同步被 GA/百度统计以页面 URL 参数外发；简拼子串匹配跨字段偶有松散误命中

**环境**：生产 https://www.seatmark.cn/templates ，CDP 29229 全新 incognito context（桌面 1280×900 + 移动 390×844）。代码依据：`TemplatesView.vue:79-117/213-252`、`pinyin.ts:59-63/73-97`、`TemplateDetailView.vue:49-77/196`、`StudioView.vue:108`。脚本 `/home/ubuntu/r271_run.py`。

**T1 搜索质量**：库总量 222（页首宣称=卡片数=「全部 222」chip 三方一致）。「考场」10 款、「婚礼」15 款、「桌牌」25 款——首 3 卡名称/场景均含关键词；全拼 hunli=15 款且与「婚礼」结果一致（pinyin-pro 懒加载 ~2s 后自动重算）；**简拼 jkz 命中 3 款，前 2 为监考证/巡考证（历史开放项闭环：简拼受支持）**；无结果态「没有匹配“zzzzzz不存在”…」+「清除搜索条件」+3 款推荐，点清除恢复 222；`<script>alert(1)</script>`/1000 字符/`%%%'"` 均无 pageerror、无结果态原文安全展示（XSS 不执行）— passed
- P4 观察①：简拼是对「名称+场景+描述」拼接串的**子串**匹配，jkz 第 3 命中为不相关的手写风姓名贴（描述串首字母偶合），松散误命中量小、排序无权重，供裁量。

**T2 筛选与叠加（r81 回归）**：分类 chips 考试31/教学43/幼儿教育19/会议活动54/婚庆喜宴23/生活办公52——点「考试」卡片=31=chip 计数；子分类「考场布置 17」卡片=17；叠加类内命中：「考试」+「考号」→提示「在「考试」分类中找到 2 款」=卡片数且均为考号类；跨类回退：「考试」+「婚礼」→「「考试」分类下无匹配，已在全部分类中找到 15 款」=卡片数 — passed

**T3 详情与进工坊（standard/weddingPlace/signage 三场景抽样）**：预览渲染非空白；规格徽章与 defaultTemplates 源数据逐字一致（standard 60×32mm·3×8·24枚·210×297；weddingPlace 90×52·2×5·10枚；signage 90×54·2×5·10枚）；「用此模板开始」→ /studio?template=slug，工坊带入对应模板且演示数据跟随场景（weddingPlace 工坊含喜宴/桌号宾客类文案，standard/signage 无婚礼词——可区分，r115 回归过）— passed

**T4 深链与 404（r85 回归）**：curl /templates/standard HTTP 200 且静态源含「标准考场版」×6（预渲染直出）、浏览器渲染正常；/templates/no-such-slug-xyz HTTP **404** + 页面渲染「404 NOT FOUND 页面不存在或已被移动」— passed

**T5 移动端 390×844**：列表/详情 scrollWidth=390 无横溢；搜索「考场」10 款正常；CTA「用此模板开始」视口内可见（358×50@y716）— passed

**T6 常规**：全程 pageerror=0；storage 清理、context 全关、常驻 Chrome 未动 — passed
- P4 观察②（隐私面，如实记录）：搜索词经 r79 的「筛选状态同步 route.query」进入页面 URL（?q=考场），GA（dl/dr 参数）与百度统计（su/u 参数）按整 URL 上报——**用户搜索词被外发到第三方分析**（名单姓名不走 URL 不受影响；BP=58 百度统计为既定代价）。可裁量：分析上报前剥离 q 参数。

**结论**：模板发现链路整体健康，简拼历史开放项闭环；2 个 P4 观察供裁量。计划：`test-plan-round271.md`。证据：`/home/ubuntu/r271_reqs.json`；截图 `/home/ubuntu/screenshots/r271_*`（t1 五组/t2 三组/t3 六组/t4 两组/t5 两组）。

---

# 第 270 轮（2026-08-11）：#273 懒路由分包失败自动整页跳转恢复 线上复测（生产）✅ 主判据 PASS——r268 P4 闭环：离线导航失败后恢复网络可自动到达 /templates（无需手动刷新）；防循环生效（离线仅 1 次跳转尝试、无无限刷新）；成功进入后 chunk-reload 标记清除；在线 SPA 行为不变。2 个如实注记：离线跳转落在浏览器错误页（全新会话无 SW 壳页兜底）、chunk 失败时仍有 1 条裸 pageerror（onError 处理导航但错误照常冒泡）

**部署确认**：entry hash 翻转 `index-BVh4bXov.js`（r268）→ `index-lywsFKJ6.js`（首查即已翻转）。环境：CDP 29229 全新 incognito context。代码依据：`router/index.ts:168-177` onError 正则命中 chunk 错误→置 `chunk-reload:<path>` 标记→`location.assign`，同路径有标记则 return；`:179-183` afterEach 成功清标记。脚本 `/home/ubuntu/r270_run.py`、`r270_t2b.py`、`r270_t2c.py`。

**T1 主判据（r268 P4 闭环）**：全新 context /studio → CDP offline → 点「模板」→ onError 触发整页跳转，离线下落在 `chrome-error://`（浏览器断网错误页，**无 SW 壳页兜底**——全新会话 SW 未就绪，如实记录）→ 恢复网络 → 自动重载到 `https://www.seatmark.cn/templates` 并渲染模板列表（`window.__alive` 消失证明发生整页导航；r268 旧行为：停留 /studio 静默无反应需手动刷新——可区分）— passed

**T2 防循环**：
- 真离线：点「模板」后共 **1** 次整页跳转尝试，二次点击无新增导航（页面已是错误页）、观察窗口内无刷新循环 — passed
- 确定性复现（在线 route abort `TemplatesView*`）：点「模板」→ onError 置标记 `chunk-reload:/templates`='1' + 1 次 location.assign；整页落到预渲染 /templates（静态 HTML 有正文，用户不白屏）；标记存在期间无第二次自动 assign — passed
- 注记①：chunk 失败场景仍产生 1 条裸 pageerror「Failed to fetch dynamically imported module: …TemplatesView-*.js」（onError 兜底导航但错误照常冒泡，不影响恢复，供裁量）；注记②：已缓存过资源的会话离线点击可直接从 HTTP 缓存完成整页加载并成功渲染（t2b 实证），风险面仅限「chunk 未缓存」首访场景。

**T3 标记清理**：T1 恢复成功后与 T2c 解除阻断 goto /templates 成功后，`sessionStorage.getItem('chunk-reload:/templates')` 均=**null**（afterEach removeItem 生效）— passed

**T4 回归（Regression）**：在线导航 /studio→/templates→/ 全程 `window.__alive`=1（SPA 无整页刷新）；xlsx 预取仍生效、40 行导入「共 40 条」；正常路径 pageerror=0；chunk-reload 键零残留 — passed

**T5 常规**：176 请求标记串命中 0；storage 清理、context 全关、常驻 Chrome 未动 — passed

**结论**：r268 P4 至此闭环（恢复网络后可自动到达目标路由）。两注记供裁量：① 全新会话离线点击的中间态是浏览器错误页（Chrome 联网后自动重试可恢复；若期望应用内滞留提示需 SW 离线壳页配合）；② chunk 失败时 1 条裸 pageerror。计划：`test-plan-round270.md`。产物：`/home/ubuntu/r270_reqs.json`；截图 `/home/ubuntu/screenshots/r270_t1_offline.png`、`r270_t1_recovered.png`、`r270_t2c_antiloop.png`、`r270_t2c_recovered.png`、`r270_t2b_shell.png`、`r270_t4_import.png`。

---

# 第 268 轮（2026-08-11）：#271 xlsx 加载失败刷新引导 + 离线 seo 导入静默 线上复测（生产）✅ 两处修复判据全 PASS——预取失败后导入 toast 为中文刷新引导（不再露英文模块错误）、刷新后恢复；离线导航 pageerror=0（seo 裸错误消失）；回归全过。1 个 P4 附带观察（离线点击导航后该路由在恢复网络后仍无法进入，需刷新——路由 chunk 动态 import 失败同样被浏览器缓存，非 #271 引入）

**部署确认**：entry hash 翻转 `index-BC7trUVn.js`（r266）→ `index-BVh4bXov.js`（轮询第 2 分钟命中）。环境：CDP 29229 全新 incognito context。代码依据：`excel.ts:15-21` `loadXlsx()` 失败抛「表格组件加载失败（可能是网络异常），请刷新页面后重试」（`:34/:153` 两调用点）；`router/index.ts:168-172` seo 动态导入 try/catch。脚本 `/home/ubuntu/r268_run.py`、`r268_t2b.py`。

**T1 P3 修复（主判据）**：r266 同法 route abort `vendor-xlsx*` 覆盖预取窗口（预取失败静默 pageerror=0）→ 解除阻断导入 → toast 逐字=「Excel 导入失败 表格组件加载失败（可能是网络异常），请刷新页面后重试」，**不含**「Failed to fetch dynamically imported module」（r266 旧行为对照）；p.reload() 后重导「已读取 40 条数据」+「共 40 条」——刷新引导路径成立（r268_t1_cn_toast.png / r268_t1_reload_ok.png）— passed

**T2 P4 修复**：/studio 打开后 CDP offline，离线窗口内点击导航「模板」→ 等 5s：pageerror=**0**（r266 旧行为有「…seo-*.js」裸错误——可区分）、console 仅资源级 ERR_INTERNET_DISCONNECTED — passed
- **附带观察（P4，非 #271 引入）**：离线时点过「模板」后，恢复网络再点仍停留 /studio（无任何用户反馈）——TemplatesView 路由 chunk 的动态 import 失败同样被浏览器按 URL 缓存，重试导航静默失败；刷新页面后导航正常到 /templates。最小复现：/studio 断网点「模板」→ 恢复网络 → 再点「模板」无反应。与 r266 P3 同根因（模块级失败缓存），可裁量是否在 router.onError 做兜底提示/重载。

**T3 回归（Regression）**：正常路径预取仍生效（load 后 0.89s 拉取 vendor-xlsx）、首导 40 行 **0.107s**（≤0.2s）；粘贴 3 行（张伟268-*）「共 3 条」；逐张 PNG zip 3 张 0 空白 — passed

**T4 常规**：正常路径会话 pageerror=0；159 请求标记串（张伟268）命中 0；storage 清理、context 全关、常驻 Chrome 未动 — passed

**结论**：r266 P3 与 P4 至此闭环。新增 P4 观察项（离线导航失败缓存）供裁量。计划：`test-plan-round268.md`。产物：`/home/ubuntu/r268_dl/`、`/home/ubuntu/r268_reqs.json`；截图 `/home/ubuntu/screenshots/r268_t1_cn_toast.png`、`r268_t1_reload_ok.png`、`r268_t2_offline_nav.png`、`r268_t2b_final.png`、`r268_t3_regression.png`。

---

# 第 266 轮（2026-08-11）：#270 导入面板空闲预取 xlsx 分包线上复测（生产）⚠️ 主判据 PASS（空闲预取 0.36s 即拉取、首导 0.132s 热量级、竞态导入正常、回归全过），但发现 **1 个 P3**：预取网络失败后（失败本身静默）后续导入被浏览器模块缓存钉死——恢复网络重试 0 次网络请求、toast 直露英文错误「Failed to fetch dynamically imported module…」，需刷新页面才能导入

**部署确认**：entry hash 翻转 `index-C2ENcB-P.js`（r264）→ `index-BC7trUVn.js`（轮询第 2 分钟命中）。环境：CDP 29229 全新 incognito context。代码依据：`DataImportPanel.vue:134-144`（onMounted 后 `requestIdleCallback(()=>import('xlsx').catch(()=>{}),{timeout:3000})`，Safari 兜底 setTimeout 1500ms）。脚本 `/home/ubuntu/r266_run.py`、`r266_t3b.py`、`r266_t3c.py`。

**T1 阳性（主判据）**：全新 context 打开 /studio 无任何交互，load 后 **0.36s** 即见 `vendor-xlsx-CKwrMZHi.js` 网络拉取（r264 对照：直到导入才拉取——可区分判据）；随后首次导入 r113_40.xlsx **0.132s**（判据 ≤0.2s；r264 冷路径 0.17–1.5s），导入期间无新 chunk 拉取 — passed

**T2 竞态（打开后立即导入）**：DOM ready 即注入文件（不等空闲）→ 无 pageerror、toast「已读取 40 条数据」0.139s、「共 40 条」— passed

**T3 预取失败与恢复**：
- 失败静默（阻断 `vendor-xlsx*` 请求模拟预取网络失败）：预取被 abort，pageerror=0（`.catch` 生效）、页面正常 — passed
- **恢复后导入不可用（P3）**：解除阻断后导入 → toast「Excel 导入失败 Failed to fetch dynamically imported module: …vendor-xlsx-CKwrMZHi.js」，且重试期间 vendor-xlsx **网络请求 0 次**——Chrome 对同 URL 动态 import 失败做模块级缓存，`import('xlsx')` 永久 reject，直到**刷新页面**（刷新后导入 0.094s 正常）。真离线复现（CDP offline 6s 后恢复）同样导入失败。最小复现：打开 /studio 时短暂断网 3s（覆盖预取窗口）→ 恢复网络 → 导入任意 xlsx → 失败且重试无效 — **failed（P3）**
- 附带观察（P4，非 #270 引入）：真离线窗口内路由守卫 `router/index.ts:166` `await import('@/utils/seo')` 无 catch，产生 pageerror「Failed to fetch dynamically imported module: …seo-*.js」——离线时既有动态导入链路的裸错误。
- P3 定级理由：#270 把 xlsx chunk 拉取提前到页面打开后 3s 内的空闲窗口，**放大了瞬时网络抖动的暴露面**——修复前失败发生在用户主动导入时（可感知、重试常伴随刷新），修复后页面打开时的一次抖动会静默埋雷，之后网络已恢复仍导入失败且 toast 直露英文技术错误、无「请刷新重试」引导。建议：import 失败时带时间戳 query 重试一次（绕开模块缓存），或 catch 后提示「网络异常，请刷新页面后重试」。

**T4 回归（Regression）**：粘贴 3 行（张伟266-*）「共 3 条」— passed；双 sheet roster231.xlsx 导入成功「共 3 条」+逐张 PNG zip 3 张 0 空白 — passed；注记：本轮页面未出现 sheet 切换按钮（S2 marker 不在 DOM），sheet 切换判据**未测**（r231/r232 已验过该链路），如实记录。

**T5 常规**：交互会话 pageerror 仅上述 T3 离线 seo 观察项（预取路径本身 0）；请求标记串（张伟266）命中 0；storage 清理、context 全关、常驻 Chrome 未动 — passed

**结论**：#270 主目标达成（预取生效、冷导入降至热量级、竞态安全），但预取失败后的恢复路径不成立（P3，复现与建议见上）。计划：`test-plan-round266.md`。产物：`/home/ubuntu/r266_dl/`、`/home/ubuntu/r266_reqs.json`、`r266_reqs_t3b.json`；截图 `/home/ubuntu/screenshots/r266_t1_imported.png`、`r266_t2_race.png`、`r266_t3_failtoast.png`、`r266_t3_reload_ok.png`、`r266_t4_sheet.png`。

---

# 第 264 轮（2026-08-11）：Lighthouse 与性能周期回归（无代码变更轮，上次 r233）✅ 无 >15% 劣化——移动中值 home 97（回升）/ studio 80 / templates 96 / seating 99 / account 83，CLS 五页全 0；桌面 home 100·studio 99（较 r233 88 改善）；主 chunk gzip 106.3KB（≈基线 107KB，未增长）；40 行导入热 0.046s；粘贴 100 行解析 81ms/导入 92ms 无卡顿；逐张 PNG 100 张 5.9s；pageerror 0

**环境**：生产 entry 已翻转 `index-EbJxTvBJ.js`（r233）→ `index-C2ENcB-P.js`（含 #259 启动骨架、#261 横滑提示、#265/#267 粘贴导入）。口径与 r233 一致：lighthouse@13.4.1 npx、mobile 模拟节流每页 3 跑取中值、桌面 preset 2 跑；原始 JSON `/home/ubuntu/r264_lighthouse/`（19 份），脚本 `/home/ubuntu/r264_lh.sh`、`r264_t3.py`、`r264_cold.py`。

**T1 移动五页中值（Perf/A11y/BP/SEO · LCP/TBT/CLS，vs r233）**：
- `/`：**97**（88/97/97）/100/58/100 · 1.92s/112ms/**0** —— vs r233 91 回升 +6.6%（落回 r179 98 一侧，佐证 home 91–98 波动带）
- `/studio`：**80**（74/84/80）/96/58/100 · 4.78s/202ms/**0** —— vs 79 持平（LCP 抖动带内）
- `/templates`：**96**（83/96/96）/96/58/100 · 1.88s/154ms/**0** —— 持平
- `/seating`：**99**（99/100/99）/93/58/100 · 1.53s/61ms/**0** —— 持平（#261 提示无代价）
- `/account`：**83**（82/83/86）/98/58/66 · 4.42s/112ms/**0** —— vs 84 -1.2%（噪声带内；SEO 66 设计性 noindex 不报）
- BP 五页均 58（百度统计既定代价，不报）。CLS 全 0 — passed

**T2 桌面抽查**：`/` **100**（100/99）· LCP 0.48s · CLS 0（=基线）；`/studio` **99**（99/99）· LCP 0.81–0.90s · CLS 0（r233 为 88，改善）— passed

**T3 交互性能（真实 UI）**：
- 40 行文件导入：首跑 1.477s / 热跑 **0.046s**——首跑含懒加载 `vendor-xlsx-CKwrMZHi.js` 网络拉取（隔离复验 3 次全新 context 冷导入 0.169/0.170/0.713s，均见该 chunk 在导入时才加载）；热路径优于基线 0.08–0.13s，冷路径系网络抖动非解析退化，如实注记 — passed
- 粘贴 100 行（#265/#267 新路径）：fill→提示「识别到 100 条数据、2 列（首行为表头：姓名、座位号）」**80.8ms**；导入→toast「已导入 100 条数据」**92.3ms**+「共 100 条」——无可感知卡顿 — passed
- 逐张 PNG 导出 100 张：**5.9s**、zip 恰 100 张 0 空白（r261 6 张秒级，线性合理 ≪120s）— passed

**T4 主包体积**：`index-C2ENcB-P.js` 304,875 B → gzip -9 = **108,825 B（106.3KB）**，vs 历史基线约 107KB 未增长（粘贴解析等新增被摇树/压缩吸收）— passed

**T5 常规**：交互会话 pageerror=0；136 请求标记串（张伟264）命中 0；storage 清理、context 全关、常驻 Chrome 未动、lighthouse 临时 Chrome 随进程退出 — passed

**结论**：自 r233 以来合入的 #259/#261/#265/#267 无性能代价；home 中值回升至 97 佐证 91–98 波动带。无 P 级发现。计划：`test-plan-round264.md`。产物：`/home/ubuntu/r264_lighthouse/`、`/home/ubuntu/r264_dl/paste100.zip`、`/home/ubuntu/r264_reqs.json`；截图 `/home/ubuntu/screenshots/r264_import40.png`、`r264_paste100_hint.png`、`r264_paste100_imported.png`。

---

# 第 263 轮（2026-08-11）：#267 粘贴名单「首行是表头」手动开关线上复测（生产）✅ 全部判据 PASS——r261 P4 闭环：误判可手动取消（2 条完整导入）、反向手动指定表头、重开弹窗重置为自动、TSV 回归+逐张导出、移动端 390px 含复选框不破版；无新发现

**部署确认**：lazy chunk，浏览器打开粘贴弹窗输入文本后 DOM 即含「首行是表头」复选框——首次打开即已部署。环境：CDP 29229 全新 incognito context，桌面 1280×800 + 移动 390×844。脚本 `/home/ubuntu/r263_run.py`。代码依据：`excel.ts:197` `parsePastedRoster(text, firstRowHeader?)`（`:214` `firstRowHeader ?? 启发式`）、`DataImportPanel.vue:166/172/178/366-372`（CheckboxField 绑定 headerDetected、toggle 设 override、开弹窗重置 null）。姓名标记 张伟263/王芳263。测试侧注记：CheckboxField 原生 input 为 sr-only（`CheckboxField.vue:18`），Playwright check/uncheck 会因不可见超时——需点击 label 切换。

**T1 P4 修复主判据**：粘贴「张伟263手机甲\n张伟263手机乙」→ 默认提示逐字=「识别到 1 条数据、1 列（首行为表头：张伟263手机甲）」且复选框 checked=true（自动误判如实呈现）；点掉勾选 → 提示实时变「识别到 2 条数据、1 列（未检测到表头，首列将按「姓名」处理）」、checked=false；导入 → toast「已导入 2 条数据 未检测到表头，首列已按「姓名」处理」+「共 2 条」+ 页面含 张伟263手机甲（首条不再静默丢失）（r263_t1_misdetect/fixed/imported.png）— passed

**T2 反向手动指定表头**：粘贴「张伟263甲\t男 / 王芳263\t女」（无关键词）→ 默认 checked=false、「识别到 2 条数据、2 列（未检测到…）」；勾选 → 「识别到 1 条数据、2 列（首行为表头：张伟263甲、男）」（表头如实取首行）、checked=true；导入 toast「已导入 1 条数据 首行已识别为表头」、数据查看器仅 1 行 [王芳263, 女]（r263_t2_manual_header.png）— passed

**T3 重开弹窗重置为自动**：T2 手动勾选导入后清空、重开弹窗粘贴 T1 含「手机」文本 → 提示回到自动误判态「识别到 1 条…首行为表头」、checked=true——前次手动状态不残留（若残留应显示 2 条）（r263_t3_reset.png）— passed

**T4 回归（Regression）TSV 带表头**：`姓名\t座位号`+4 行 → 自动「识别到 4 条数据、2 列（首行为表头：姓名、座位号）」checked=true（未动手）；导入「共 4 条」；逐张 PNG zip 恰 4 张 1000×534、md5 互异、0 空白（r263_dl/tsv4.zip）— passed

**T5 移动端 390px**：弹窗粘贴 T1 文本无横向溢出（380≤390）、「首行是表头」复选框 bounding box 完整在视口内（36,533,77×16）、默认误判态一致；取消勾选 → 2 条、导入成功「共 2 条」（r263_t5_mobile.png / r263_t5_mobile_imported.png）— passed

**T6 常规**：pageerror=0；87 请求标记串（张伟263/王芳263）命中 0；localStorage/sessionStorage 清理、context 全关、常驻 Chrome 未动 — passed

**结论**：r261 P4（HEADER_KEYWORDS 子串误伤首行数据）至此闭环——自动识别保留、手动开关可双向覆盖、重开重置为自动，行为与 spec 完全一致。无 P1–P4 新发现。计划：`test-plan-round263.md`。

---

# 第 261 轮（2026-08-11）：#265 /studio 粘贴名单导入线上复测（生产）✅ 主链路全部判据 PASS——TSV 表头识别/自动映射/逐张导出、无表头纯姓名、顿号缺列补空、空文本禁用、清空后回归、移动端 390px 弹窗全过；1 个 P4 观察项（表头关键词误伤首行数据）

**部署确认**：lazy chunk，以浏览器 DOM 出现「没有文件？粘贴名单」为准——首次打开即已部署。环境：CDP 29229 全新 incognito context，桌面 1280×800 + 移动 390×844。脚本 `/home/ubuntu/r261_run.py`。代码依据：`excel.ts:196` parsePastedRoster（\t > [,，、] > \s+，`excel.ts:181` HEADER_KEYWORDS 判表头）、`DataImportPanel.vue:224/336/350/360/176/181`。本轮姓名标记 张伟261-*。

**T1 TSV 带表头全链路（核心）**：弹窗实时提示逐字=「识别到 6 条数据、3 列（首行为表头：姓名、班级、座位号）」；导入 toast「已导入 6 条数据 首行已识别为表头」；面板「粘贴的名单」+「共 6 条」；预览标签渲染 张伟261-1…-6、字段映射自动命中（姓名/座位号 2/4，考场/准考证号本就无此列属未映射合理）；逐张 PNG 导出 zip 恰 6 张 1000×534、md5 互异、0 空白（r261_dl/paste6.zip）— passed

**T2 纯姓名（无表头分支）**：5 行姓名夹 2 空行 → 提示「识别到 5 条数据、1 列（未检测到表头，首列将按「姓名」处理）」、toast 副文=「未检测到表头，首列已按「姓名」处理」、「共 5 条」— passed

**T3 顿号分隔+缺列**：`姓名、座位号`+3 行（1 行缺座位号）→「识别到 3 条数据、2 列（首行为表头：姓名、座位号）」、导入成功、数据查看器缺列单元格为空串（[张伟261B, ""]）、无报错 — passed

**T4 空文本/纯空白**：textarea 空与纯空白（空格+空行）下均无提示行、「导入名单」disabled=true — passed

**T5 回归（Regression）**：粘贴导入后点「清空」→ 空数据态复现（粘贴按钮回来）→ good40.xlsx 文件导入「共 40 条」正常，文件链路不受影响 — passed

**T6 移动端 390px**：空数据态两按钮并排可见（粘贴按钮 149×30 在视口内）；弹窗无横向溢出（380≤390）、textarea 可填、「导入名单」按钮在视口内可点、导入 2 条成功 toast+「共 2 条」（r261_t6_dialog.png / r261_t6_imported.png）— passed

**T7 常规**：pageerror 全程=0 — passed；118+ 请求标记串（张伟261）命中 0 — passed；storage 清理、context 全关、常驻 Chrome 未动 — passed

**发现问题**：**P4（表头启发式误伤）**：HEADER_KEYWORDS（excel.ts:181，含 手机/学号/座位/序号/号码 等）对首行做**子串**匹配——若首行是数据但姓名/内容里恰含关键词（如「张伟手机甲」含「手机」），首行被误判为表头而**静默丢弃第一条记录**。最小复现：粘贴弹窗输入两行「张伟261手机甲\n张伟261手机乙」→ 提示「识别到 1 条数据、1 列（首行为表头：张伟261手机甲）」、导入仅 1 条（截图 r261_t6_dialog 前次运行留档）。缓解因素：实时提示行与成功 toast 均如实展示表头识别结果，用户可发现；真实姓名含关键词概率低。可裁量改进：仅当首行**恰等于**关键词（或短词全字匹配）才判表头，或提供「首行是表头」手动开关。

**测试侧注记**：①「重新上传」按钮是打开文件选择器而非清空（DataImportPanel.vue:271 fileInput.click()），清态要点「清空」（:274 workspace.clearData()，无确认弹窗）——首版脚本误点导致断言波动，修正后重跑；② T6 首次用「张伟261手机甲」命名夹具触发上述 P4 才发现该问题（因祸得福），改无关键词姓名后移动端导入判据通过。

**证据**：截图 `/home/ubuntu/screenshots/r261_t1_dialog.png`（TSV+实时提示）、`r261_t1_imported.png`（预览+映射+toast）、`r261_t2_noheader.png`、`r261_t3_viewer.png`（缺列空串）、`r261_t4_disabled.png`、`r261_t5_regression.png`、`r261_t6_dialog.png`、`r261_t6_imported.png`；产物 `/home/ubuntu/r261_dl/paste6.zip`；请求 `/home/ubuntu/r261_reqs.json`；计划 `test-plan-round261.md`。

---

# 第 259 轮（2026-08-11）：系统外观偏好稳健性专项（生产）✅ 全部判据 PASS——dark 偏好下四页仍按设计浅色渲染（截图像素 diff=0.0%）、原生控件/导出弹窗无深色 UA 混搭、dark 下导出与 light 基线 40/40 字节全同、reduced-motion 降级生效（reveal 全量立即显现）、contrast:more 无破版、forced-colors 冒烟正常、pageerror=0、隐私零外发

**口径**：Playwright `page.emulate_media(color_scheme=…/reduced_motion=…)`；`prefers-contrast: more` 因本机 Playwright 版本无 contrast 参数，改用 CDP `Emulation.setEmulatedMedia features:[{name:'prefers-contrast',value:'more'}]`（每例均以页内 matchMedia 命中=true 证明模拟生效）；forced-colors 用 `emulate_media(forced_colors='active')`。代码依据：src 无任何 `dark:` 变体、index.html/CSS 未声明 `color-scheme`（UA normal）；reduced-motion 降级在 `main.css:233`（.reveal-init 立即显现）+ `HomeView.vue:18`（matchMedia 命中直接加 reveal-in）。脚本 `/home/ubuntu/r259_run.py`。

**T1 prefers-color-scheme: dark（核心）**：
- 四页 `/`、`/studio`、`/templates`、`/seating`：dark 下 matchMedia=true 而 body 背景不变（oklch(0.984…) 浅色）、documentElement colorScheme=normal、整页截图与 light 基线逐像素 diff 全部 **0.0%**、平均亮度逐页相同（243.3/242.4/244.1/247.8）— passed
- /studio 导入区原生控件（裁切线/高亮缺失 checkbox、SelectField、file 上传区）与导出弹窗：dark vs light 截图 diff 均 0.0%（无深色 UA 控件混搭；截图 r259_t1_controls_dark.png、r259_t1_dialog_dark.png 人眼核对全浅色）— passed
- dark 下全链路：导入 40 条成功 + 逐张 PNG 导出 zip 40 张 1000×534、0 空白、与 r258 light 100% 基线 **40/40 字节全同** — passed

**T2 prefers-reduced-motion: reduce**：
- 阳性/阴性对照：no-preference 下首屏未显现 reveal 元素 28/30（动画机制在跑）；reduce 下 0/30——全部立即带 reveal-in、页底元素滚动前 opacity=1（main.css:233+HomeView.vue:18 双路径降级均生效）— passed
- 全站扫描：reduce 下四页残留动画仅 /studio 8 个 `animate-pulse` 骨架占位（loading 类轻量脉冲，判据内可接受）+ home 4 个（同类）；无 transition-duration>0.3s 的可见元素；不定级 — passed（注记）
- 功能回归：reduce 下导入 40 条 + 导出弹窗打开正常 — passed

**T3 prefers-contrast: more**：四页 matchMedia=true、scrollWidth≤innerWidth、关键按钮可见、截图 vs light 基线 diff 全部 0.0%（无 contrast 特化样式，符合预期无破版）— passed

**T4 forced-colors 冒烟**（r172-175 已闭环不重复全量）：matchMedia=true、「用演示数据先试试」可点、演示数据载入（26 标签渲染）、强制配色下页面可交互、pageerror=0（r259_t4_forcedcolors.png）— passed

**T5 常规**：pageerror 全程=0 — passed；642 请求标记串（张伟250/隐私学校250）命中 0（r259_reqs.json）— passed；storage 清理、自建 context 全关、常驻 Chrome 未动 — passed

**发现问题**：无 P1–P4。

**证据**：截图 `/home/ubuntu/screenshots/r259_t1_{home,studio,templates,seating}_{light,dark}.png`、`r259_t1_controls_{light,dark}.png`、`r259_t1_dialog_{light,dark}.png`、`r259_t3_*_contrast.png`、`r259_t4_forcedcolors.png`；产物 `/home/ubuntu/r259_dl/dark_perlabel.zip`；请求 `/home/ubuntu/r259_reqs.json`；计划 `test-plan-round259.md`。

---

# 第 258 轮（2026-08-11）：浏览器缩放与大字号可用性专项（生产）✅ 全部判据 PASS——四页 150%/200% 无横向溢出破版、关键按钮可达、200% 下导入+逐张 PNG 导出产物与 100% 基线一致（24/40 字节全同、其余 16 张仅字体抗锯齿亚像素差、像素级布局/文字完全一致）、导出弹窗 200% 下滚动可达按钮不裁出、pageerror=0、隐私零外发

**缩放口径（如实注明）**：浏览器 Ctrl+/- 缩放在 Chromium 中等效于「布局视口按倍率缩小 + devicePixelRatio 按倍率放大」。实现：Playwright `browser.new_context(viewport={w:round(1280/z), h:round(800/z)}, device_scale_factor=z)`，z∈{1.5, 2.0}，基准物理窗口 1280×800——即 200% 时 CSS 视口 640×400、DPR=2，与真实 Ctrl+/- 缩放同口径；CDP `Emulation.setDeviceMetricsOverride` 直调被弃用（见测试侧坑注记）。**大字号口径（近似，如实注明）**：Chromium 浏览器「最小字号/字体大小」设置无 CDP 接口，用 `document.documentElement.style.fontSize='20px'`（=16px 的 125%）近似评估 rem 布局稳健性，非真实系统大字号。脚本 `/home/ubuntu/r258_v2.py`（首版 `/home/ubuntu/r258_run.py` 因 CDP 覆盖被 Playwright 重置而作废）。

**T1 四页 × 150%/200%**（每格判据 scrollWidth≤innerWidth + 关键按钮 rect 非零可滚动到达 + 截图）：
- `/` 150%/200%：843≤853、630≤640，「开始制作」CTA 可见 — passed（r258v2_t1_home_150/200.png）
- `/studio` 150%：843≤853，「图片 PNG」可见 — passed；200%：630≤640 无溢出 — passed；「图片 PNG」在默认「设置」页签下 rect=0×0——**非 bug**：200% 时 CSS 视口 640px 触发 /studio 移动双页签布局（设置/预览），切「预览」页签后按钮可见可点（T2 全链路实证），属设计内响应式降级 — passed（注记）
- `/templates` 150%/200%：无溢出，搜索框可见（448px 宽）— passed
- `/seating` 150%/200%：无溢出，「完全随机」可见 — passed
- 文字重叠：8 张截图人工核查未见重叠 — passed（截图判据）

**T2 /studio 200% 全链路（核心）**：CSS 视口 640×400 DPR2 下导入 good40.xlsx →「Excel 导入成功 已读取 40 条数据」+「共 40 条」；切「预览」页签开「图片 PNG」弹窗选逐张导出 → zip 40 张、全部 1000×534、0 空白 — passed。**与 100% 基线一致性**：按序号逐张对比——24/40 PNG 字节完全相同；16 张字节不同但逐像素 diff 仅字形边缘抗锯齿亚像素差（最大差异张 1.8% 像素、diff 图只有字形轮廓，布局/文字/尺寸完全一致，见 r258_diff26.png 三联图）；两次 100% 运行（本轮基线 vs r255 产物）40/40 字节全同证明管线本身确定——差异来源是导出渲染读取了页面 DPR 的字体光栅化，**非布局/内容差异**，判「产物一致（尺寸/内容/非空白）」成立、字节级 md5 严格全同不成立 — passed（如实降级注记）

**T3 大字号近似（fontSize 125%→20px）**：/studio 无横向溢出（1270≤1280）、「共 40 条」名单在、「图片 PNG」可点、布局无错乱（r258_t3_bigfont.png）— passed（近似口径）

**T4 200% 弹窗可达性**：导出弹窗（含配额区「今日剩余 1 次」）打开于 640×400 视口——「带水印导出」初始 y=526 超出 400 高视口，但弹窗体 overflowY 可滚动（scrollable=true），scrollIntoView 后按钮完整在视口内（y=184, h=116, 全边界内）并实际点击触发下载成功；无水印配额按钮同屏可见（r258v2_t4_wm_reachable.png）；Esc 关弹窗 dialog=0 — passed

**T5 常规**：pageerror 全程=0 — passed；286 请求标记串（张伟250/隐私学校250）命中 0（r258_reqs_v2.json）— passed；storage 清理、自建 context 全关、常驻 Chrome 未动 — passed

**发现问题**：无 P1–P3。P4 观察项（可裁量）：200%（=640px CSS 视口）下 /studio 落入移动双页签布局，老花用户放大后需先点「预览」才能见导出按钮——属既有响应式设计而非破版，如认为放大场景应保留桌面单栏可评估将 /studio 断点阈值与缩放场景解耦（最小复现：1280 宽窗口 Ctrl+ 放大到 200% 打开 /studio）。

**测试侧坑（已写入 SKILL 建议）**：对 Playwright 管理的 page 直接用 CDP `Emulation.setDeviceMetricsOverride` 会被 Playwright 后续动作静默重置（截图/下载等操作后 innerWidth 弹回原视口），导致首版 T2「200%」实际大半在 100% 下跑；必须用 context 级 `device_scale_factor`+缩小 viewport 实现缩放口径。

**证据**：截图 `/home/ubuntu/screenshots/r258v2_t1_{home,studio,templates,seating}_{150,200}.png`、`r258v2_t2_imported_200.png`、`r258v2_t4_dialog_200.png`、`r258v2_t4_wm_reachable.png`、`r258_t3_bigfont.png`、`r258_diff26.png`；产物 `/home/ubuntu/r258_dl/{base100_perlabel.zip,v2_zoom200_perlabel.zip}`；请求 `/home/ubuntu/r258_reqs_v2.json`；计划 `test-plan-round258.md`。

---

# 第 257 轮（2026-08-11）：#261 /seating 移动端横滑提示线上复测（生产）✅ 全部判据 PASS——390px 提示可见且位于视角切换行与网格容器之间、≥640px sm:hidden 生效、换座冒烟正常

**部署确认**：SeatingView 为懒加载 chunk（页面 HTML 不含其哈希），以浏览器 DOM 出现提示文案为准——首次打开即已部署（无需轮询）。环境：CDP 29229 全新 incognito context，移动口径 CDP 390×844 视口、桌面 1280×800。脚本 `/home/ubuntu/r257_run.py`。代码依据：#261（eefd229）`SeatingView.vue:638`——视角/选中提示行后、previewContainer（overflow-auto）前插入 `<p class="mb-1 text-[11px] leading-5 text-slate-400 sm:hidden">← 座位表超宽时可左右滑动查看 →</p>`。

**T1 390px 移动端**：提示截图像素可见（r257_t1_hint_grid.png：提示位于「教师视角/学生视角」行与网格之间）；DOM 佐证：hint.previousElementSibling 文本=「教师视角 学生视角（镜像）」、nextElementSibling 为 overflow-auto 网格容器（含 .seating-seat）——位置与 spec 一致；display=block、offsetParent 非 null；文档无横向溢出（scrollWidth 380≤390）；网格容器自身可横滚（529>346）— passed。换座冒烟（Regression）：张伟257⇄李四257 下标 9↔0 互换成功 — passed。

**T2 ≥640px 桌面（1280px）**：提示元素在 DOM 但 display=none、offsetParent=null（sm:hidden 生效），截图 r257_t2_desktop.png 中无该文案 — passed。

**T3 常规**：pageerror=0；47 请求标记串（张伟257 等 10 名单名）命中 0（r257_reqs.json）；storage 清理、context 全关、常驻 Chrome 未动 — passed。

**结论**：#261 行为与 spec 完全一致，r246 P4 裁量项（移动端无横滑提示）闭环。无新发现。

---

# 第 255 轮（2026-08-11）：#259 SPA 壳页内联启动骨架线上复测（生产）✅ 全部判据 PASS——Slow 3G 空窗被骨架填补（spinner+加载中文案像素可见）、挂载后零残留、内容页/404 预渲染未回归、/account 壳页正常

**部署确认**：/studio HTML 由 boot-splash=0 翻转为 6 处命中（entry 哈希不变 `index-DNF7Ft0O.js` 属预期——#259 仅改 index.html 与 prerender.mjs，不动 JS bundle）。环境：CDP 29229 全新 incognito context，弱网沿用 r253 页级 CDP `Network.emulateNetworkConditions`（50000 B/s、RTT 400ms）。脚本 `/home/ubuntu/r255_run.py`。代码依据：index.html:106-116（.boot-splash 内联样式+role=status）、prerender.mjs:84-90（replaceAppMount 正则整体替换，仅 /studio 与 shellPaths 保留骨架）。

**T1 Slow 3G 首访 /studio 骨架（核心阳性）**：3s 与 5s 时刻截图均**像素可见** spinner + 「SeatMark 座签加载中…」（r253 同时刻为纯背景空窗——r253_t1_loading.png 对照），DOM `.boot-splash`=1；挂载完成后 `.boot-splash`=0 零残留、无错乱 scrollWidth≤innerWidth — passed。本次可用耗时 25.2s（r253 为 10.0s，弱网波动/缓存差异，同为 Slow 3G 量级，非本变更引入——骨架全程在场无空窗）。截图 r255_t1_splash_3s.png / r255_t1_splash_5s.png / r255_t1_loaded.png。

**T2 正常网络**：load 后 `.boot-splash`=0 无残留，页面正常 — passed。截图 r255_t2_normal.png。

**T3 内容页阴性（curl 源码）**：`/`、`/templates`、`/guides/exam-seat-label-batch-print`、`/nonexistent-r255`（404.html）boot-splash 均=0 且 h1 正文在（上传 Excel…/标签模板库/考场座位贴…/页面不存在或已被移动）——预渲染未回归 — passed。注记：`/guides/how-to-make-seat-cards` 为不存在的 slug（我猜错的 URL，返回 404 页同样 boot-splash=0），实际教程页以 exam-seat-label-batch-print 为准。

**T4 /account 壳页**：curl 源码含 boot-splash（=6，壳页保留骨架）；浏览器直达加载后 `.boot-splash`=0、正常渲染登录页（登录 SeatMark + 邮箱验证码表单）— passed。截图 r255_t4_account.png。

**T5 常规回归（Regression）**：/studio 导入 good40「已读取 40 条数据」+「共 40 条」、逐张 PNG 导出 zip 40 张 1000×534 md5 互异 0 空白 — passed；pageerror=0；130 请求标记串命中 0（r255_reqs.json）；storage 清理、context 全关、常驻 Chrome 未动 — passed。

**结论**：#259 行为与 spec 完全一致：壳页（/studio、/account）弱网空窗被内联骨架填补且挂载后零残留，预渲染内容页与 404 未受 replaceAppMount 影响。r253 裁量注记①闭环。无新发现。

---

# 第 253 轮（2026-08-11）：弱网与网络中断稳健性专项（生产）✅ 全部判据 PASS——Slow 3G 首访 10s 可用、弱网/全断网/导出中途断网下导入导出全成功、断网路由切换 SW 缓存命中非白屏、恢复后名单持久化在、遥测挂起不阻塞 UI

**环境**：生产 `index-DNF7Ft0O.js`，常驻 Chromium CDP 29229 全新 incognito context；弱网 = 页级 CDP session `Network.emulateNetworkConditions`（50000 B/s ≈400kbps、RTT 400ms）；断网 = `context.set_offline(True)`；遥测挂起 = context.route 对 googletagmanager.com/hm.baidu.com/zz.bdstatic.com 永不应答。夹具 good40.xlsx（张伟250）、ff240.xlsx（𱁬田240/RTL）、big300.xlsx（张伟247）。脚本 `/home/ubuntu/r253_a.py`、`r253_b.py`；产物 `~/r253_dl/`。代码依据：main.ts:32-44（router.isReady 后挂载+SW 注册）、vite.config.ts:48-75（workbox 导航 NetworkFirst 4s + 离线壳回落）、index.html:68-95（统计 idle 注入带缓冲队列）、workspace.ts:55-72（名单 sessionStorage 会话级持久化）。

**T1 Slow 3G 首访 /studio**：可用耗时 10.0s（Excel input attached + load；正常网络基线 1.1s）；完成态截图无错乱、scrollWidth≤innerWidth、body 文本 1430 字符 — passed。注记：3s 时刻截图为纯背景色（HTML 主文档在 400kbps 下仍在下载），白屏窗口短暂非永久，10s 即全可用。截图 r253_t1_loading.png / r253_t1_loaded.png。

**T2 弱网导入+逐张导出**：导入 40 行 0.56s（基线 0.19s）、逐张 PNG 导出 2.7s（基线 2.6s），zip 40 张 1000×534 md5 全互异 0 空白——纯本地链路弱网同量级（<3×）— passed。截图 r253_t2_slow_imported.png。

**T3 完全断网**：正常加载+导入后 set_offline(True)：断网下再导入 ff240（40 条成功）+ 逐张 PNG 导出成功（zip 40 张完整非空白）——「数据不出浏览器」强验证 — passed；断网点导航 /studio→/templates：完整模板库页渲染（body 19299 字符，SW NetworkFirst 回落缓存命中，非白屏非死路），go_back 回 /studio 仍非空 — passed。断网期间 pageerror=0（无未捕获应用异常）。截图 r253_t3_offline_export.png / r253_t3_offline_templates.png。

**T4 导出中途断网**：300 行逐张导出，进度「正在渲染第 N/13 页」出现后立即断网——导出仍成功，zip 恰 300 张 1000×534 md5 300/300 互异 0 空白 — passed。截图 r253_t4_midoffline_done.png。

**T5 断网恢复**：set_offline(False) 后重进 /studio：页面正常、「共 40 条」在、预览渲染 ff240 名单（𱁬田240/张伟240/RTL 均在版）— passed（名单持久化为 sessionStorage 会话级，workspace.ts:55 设计；localStorage 无 roster key 属预期）。300 行 context reload 后「共 300 条」亦在 — passed。截图 r253_t5_recovered.png。

**T6 遥测挂起**：三个统计脚本请求（gtag/js、hm.js、push.js）全部挂起不应答，页面交互不卡：导入 1.06s、开导出弹窗 0.30s、evaluate 0.003s — passed。截图 r253_t6_telemetry_hang.png。

**T7 常规**：pageerror 全程=0（含断网场景）；两脚本合计 677 请求，标记串（张伟250/隐私学校250/𱁬田240/张伟247）命中 0（r253_reqs_a/b.json）；storage 清理、自建 context 全关、常驻 Chrome 存活未动 — passed。

**结论**：弱网/断网下核心工作流全链路稳健：本地导入导出不依赖网络，SW 离线路由回落有效，遥测不阻塞，恢复后会话级持久化符合设计。无 P1–P4 新发现。

---

# 第 252 轮（2026-08-11）：#255 密码保护 xlsx 专门提示线上验证（生产）✅ 全部判据 PASS——阳性新文案逐字命中、两条阴性分支文案不变、失败后恢复正常；r250 P4 闭环

**部署确认**：生产 entry 已翻转 `index-DL6SyG-8.js` → `index-DNF7Ft0O.js`（页面 resource entries 实证）。环境：CDP 29229 全新 incognito context 单会话串行（r250 方法），夹具复用 `~/r250_fixtures/`（encrypted.xlsx=CFB D0CF11E0、truncated.xlsx=PK 残缺、新增 fake_csv.xlsx=纯 CSV 文本改名 .xlsx 非 ZIP 非 CFB、good40.xlsx）。脚本 `/home/ubuntu/r252_run.py`。

**T1 阳性（encrypted.xlsx）**：toast「Excel 导入失败 文件可能被密码保护（加密），请在 Excel/WPS 中解除密码后另存为 .xlsx 再导入」——新文案逐字命中、旧「不是有效的 .xlsx 工作簿」不再出现（r250 时同文件走旧文案，可区分）；pageerror=0 — passed。截图 r252_t1_encrypted_newtoast.png。

**T2 阴性回归**：fake_csv.xlsx → 仍逐字「文件内容不是有效的 .xlsx 工作簿（可能是改名或损坏的文件）；若是 CSV 名单请将扩展名改回 .csv 后重试」且不含「密码保护」— passed（截图 r252_t2_fakecsv.png）；truncated.xlsx → 仍「文件解析失败：文件可能已损坏或格式不受支持…」且不含「密码保护」— passed（截图 r252_t2_truncated.png）。

**T3 恢复**：三次失败后各导入 good40.xlsx 均「已读取 40 条数据」+「共 40 条」— passed。

**T4 常规**：31 请求，张伟250/隐私学校250 命中 0 — passed；pageerror 全程=0 — passed；storage 清理、context 关闭、常驻 Chrome 未动 — passed。

**结论**：#255 行为与 spec 完全一致，CFB 识别未误伤非 CFB 分支，r250 P4 观察项闭环。

---

# 第 250 轮（2026-08-11）：导入文件容错边界专项（生产 /studio，无代码变更）✅ 全部判据 PASS——8 类损坏/极端文件全部明确 toast、零 pageerror、无白屏卡死、失败后状态无污染；无 P1/P2

**环境**：CDP 29229 全新 incognito context 单会话串行跑全部场景（故意同 context 验证状态污染），toast observer + pageerror/request 监听。夹具 `~/r250_fixtures/`（openpyxl/msoffcrypto-tool/xlwt 自造，标记串 张伟250/隐私学校250）。脚本 `/home/ubuntu/r250_run.py`。

**逐场景结果**（每场景判据：明确 toast + pageerror 增量=0 + evaluate 响应 <0.01s 不卡死 + 失败后 good40.xlsx 恢复「已读取 40 条数据」+「共 40 条」）：
1. **截断 xlsx**（60% 字节，PK 魔数在）：0.4s toast「Excel 导入失败 文件解析失败：文件可能已损坏或格式不受支持…」，恢复 OK — passed
2. **加密 xlsx**（msoffcrypto AES，CFB 容器 D0CF11E0）：toast「Excel 导入失败 文件内容不是有效的 .xlsx 工作簿（可能是改名或损坏的文件）…」，恢复 OK — passed。注记（P4 观察）：加密文件走魔数分支，提示语义「改名或损坏」对「密码保护」欠精确，用户可裁量是否补专门文案（CFB 魔数可识别为加密/老 xls 容器）
3. **仅表头 / 完全空**：均 toast「Excel 导入失败 Excel 至少需要包含表头行和一行数据」，恢复 OK — passed
4. **50 列×100 行宽表**：0.2s 成功「已读取 100 条数据」+「共 100 条」，映射下拉打开 52 个 option 不卡死 — passed
5. **异常单元格**（5000 字长名/Tab+换行/emoji ZWJ+旗帜）：成功「已读取 4 条数据」，逐张 PNG 导出落盘 4 张 1000×534 全非空白（10.6–12.7%）md5 互异 — passed（成功 toast 因采样窗口未捕获，以产物核验为准，方法注记）；控制字符注记：openpyxl 本身拒写 \x0b 类 XML 非法字符，实测用 Tab/换行（XML 合法控制字符）
6. **9.9MB 多 sheet**（5 sheet×6000 行）：2.6s 成功「已读取 6000 条数据；文件含 5 个工作表，可在导入面板切换」，sheet 切换控件在，页面可交互 — passed
7. **.xls 老格式**（xlwt/BIFF）：成功「已读取 20 条数据」+「共 20 条」（SheetJS 原生支持）— passed
8. **状态无污染**：4 个失败场景后 + 最终各一次 good40 导入全部恢复正常 — passed

**常规**：全程 56 请求，张伟250/隐私学校250 命中 0 — passed；pageerror 全程=0（含所有失败场景，全部为应用主动 toast 无未捕获异常）— passed；storage 清理、context 关闭、常驻 Chrome 未动 — passed。

**结论**：导入容错边界全绿，唯一观察项为加密 xlsx 提示文案不够精确（P4）。产物 `/home/ubuntu/r250_dl/`，请求 `/home/ubuntu/r250_reqs.json`，截图 r250_s1–s8。

---

# 第 249 轮（2026-08-11）：#253 图片版 PDF dpi 降档提示线上验证（生产）✅ 全部判据 PASS——阳性 300 行提示出现且文案/颜色逐字符合、阴性 40 行不出现、三宽度无溢出、导出回归正常

**部署确认**：生产 entry 已翻转 `index-B7iIsDpm.js` → `index-DL6SyG-8.js`（页面 resource entries 实证）。环境：CDP 29229 全新 incognito context，方法同前（toast observer + expect_download）。脚本 `/home/ubuntu/r249_run.py`。

**T1 阳性（300 行=13 页 192dpi）**：导入 big300.xlsx →「共 300 条」→ 图片版 PDF 弹窗预估行「共 13 页 · 每页约 192dpi · 预估体积约 2.2 MB（按页数自适应清晰度与压缩）」；琥珀提示可见、文案逐字=「页数较多时清晰度自动降档以控制体积；追求最高打印清晰度请改用「打印 / 矢量 PDF」。」、computed color `oklch(0.555 0.163 48.998)`（=Tailwind amber-700 #b45309），弹窗截图像素级验证含 814 个琥珀色像素 — passed。三宽度 390/768/1280：文档与弹窗均无横向溢出（doc 380≤390 / 758≤768 / 1270≤1280；dialog scrollWidth==clientWidth），提示三档均可见 — passed。截图 r249_t1_hint_1280.png、r249_t1_w390/768/1280.png。

**T2 阴性（40 行=2 页 300dpi）**：全新 context 导入 ff240.xlsx → 同弹窗预估行「共 2 页 · 每页约 300dpi · 预估体积约 850 KB」，「页数较多时」出现次数=0，弹窗截图琥珀色像素=0 — passed。截图 r249_t2_nohint.png。

**T3 回归**：T1 弹窗选带水印 → toast「图片版 PDF 已生成 每页为 192dpi…」、落盘 `标准考场版-20260811-120727.pdf`，pypdfium2 13 页、p1 非空白 25.43%、文件名秒级 — passed。

**T4 常规**：344 请求，张伟247/隐私学校247/𱁬田240 命中 0 — passed；pageerror=0 — passed；storage 清理、自建 context 全关、常驻 Chrome 未动 — passed。

**结论**：#253 提示行为与 spec 完全一致（阈值 dpi<240 生效于 192dpi、阴性 300dpi 不出现），无回归，无 P1–P4 新发现。产物 `/home/ubuntu/r249_dl/`。

---

# 第 247 轮（2026-08-11）：大名单规模压力专项（300/1000 行，生产，无代码变更）✅ 全部判据 PASS——300 行三导出链路完整、1000 行导入/分页/PDF 可用、导出中途取消不落盘不扣配额可立即重导；无 P1/P2

**环境**：常驻 Chromium CDP 29229（Chrome 133 headless，未动其本体），每大项全新 incognito context，add_init_script toast observer + expect_download。夹具 openpyxl 自造 `~/r247_fixtures/big300.xlsx` / `big1000.xlsx`（列 姓名/考场/座位号/学校；姓名 张伟247-NNNN 系列 + 𱁬田247/𫔭𨱏247 + 60 字长名，学校列含标记 隐私学校247）。脚本 `/home/ubuntu/r247_a.py`、`r247_b.py`。产物 `~/r247_dl/`。

**T1 300 行导入**：1.5s 完成，toast「已读取 300 条数据」+「共 300 条」+ 映射面板齐全，导入后 evaluate 响应 <0.01s 无卡死 — passed。

**T2 300 行三导出链路**（带水印通道，标准模板实际 24 行/页 → 13 页）：
- 整页 PNG：13.9s，zip 13 张 2481×3509、md5 全互异、无一张空白（全量核验非抽样）— passed
- 逐张 PNG：16.9s，zip 恰 300 张 1000×534、md5 300/300 互异、全量非空白（<0.3% 墨量视为坏页，0 张命中）— passed
- 图片版 PDF：15.8s，toast「图片版 PDF 已生成 每页为 192dpi…」（大名单自动降 dpi：40 行轮为 300dpi、300 行 192dpi、1000 行 168dpi——设计内存保护，注记非缺陷），pypdfium2 13 页、p1/p7/p13 非空白 25.4/25.3/15.6% — passed
- 文件名秒级 `-YYYYMMDD-HHMMSS` 全部 — passed

**T3 1000 行**：导入 0.6s toast「已读取 1000 条数据」+「共 1000 条」，页面即时可交互；预览分页 42 页（`input[aria-label=跳转到页码]` max=42），跳页 22 显示 张伟247-0505/0506、末页 0999/1000、末页「下一页」按钮正确禁用 — passed。图片版 PDF 43.9s 成功（<5 分钟，进度「正在渲染第 N/42 页...」推进），pypdfium2 42 页、p1/p21/p42 非空白 25.1/25.2/18.9% — passed。内存：页内 performance.memory 每 2s 采样，导出峰值 147MB → 结束后回落 31MB（不失控、有回落），导出后页面 evaluate 正常 — passed。

**T4 导出中途取消（300 行逐张、无水印通道）**：进度推进至「正在渲染第 4/13 页...」时点 LoadingOverlay「取消导出」→ toast「已取消导出 本次未扣除无水印次数，可随时重新导出」；等待 30s 无任何 download 事件（不落盘）；配额 key `seatmark.clean-export-usage.v1` 取消前后均未写入（used=0 未消耗，代码口径：配额仅成功后扣）；随即重导（带水印）成功，zip 恰 300 张完整 — passed。

**T5 隐私与收尾**：两脚本合计 2290 请求，张伟247/𱁬田247/隐私学校247 命中 0 — passed；pageerror=0（无 ResizeObserver 亦无其他）— passed；storage 清理、自建 context 全关、常驻 Chrome 未动 — passed。

**诚实注记**：① 首版脚本用 Python 线程内调 sync Playwright CDP `Performance.getMetrics` 采样失败（greenlet 跨线程限制，测试侧问题），改为页内 `performance.memory` setInterval 采样，故 T2（300 行）导出期间无内存曲线，内存判据由 T3（1000 行更重负载）覆盖；② 计划估算 20 行/页有误，实际 24 行/页（13/42 页），断言按实际张数/页数全量核验；③ 取消测试的进度点为 4/13 页（约 1/3 处而非恰一半），判据不受影响。

**结论**：300/1000 行规模下导入、分页、四类导出、取消恢复、内存回落全部符合预期，无静默坏页，无 P1–P3 新发现。观察项：图片版 PDF dpi 随行数自动下调（192/168dpi），如需大名单高清打印建议用矢量打印链路。

---

# 第 246 轮（2026-08-11）：移动端 WebKit（iPhone 13 设备描述）黄金链路专项（生产，无代码变更）✅ 全部判据 PASS——移动 Safari 引擎口径下布局、导入、四导出链路、触摸交互、/seating 点选换座首次实证

**环境**：Playwright webkit-1967 + `devices['iPhone 13']`（视口 390×664、DPR 3、has_touch、iOS Safari UA；用户所述 390×844 与本机 profile 664 高度略异，如实注记），`PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`，方法沿用 r243/r244（add_init_script toast observer、expect_download、每大项全新 context）。脚本 `/home/ubuntu/r246_run.py`、`/home/ubuntu/r246_b.py`。

**T1 布局黄金链路**：首页 → tap 模板入口 → /templates → tap 模板卡 → /studio，三页均 `scrollWidth=390 <= innerWidth=390` 无横向溢出；/studio 移动端为「设置/预览」双 Tab 单栏布局（ASIDE 与 SECTION 纵向堆叠 x=16 宽 358），顶部 header 与主要 CTA 视口内可 tap — passed。截图 r246_t1_home/templates/studio.png。

**T2 移动端导入 40 行 xlsx**：`input[type=file]` 有两个（JSON 与 Excel），须选 `accept*=xlsx` 的第二个（首轮脚本误选 JSON input 导致导入静默失败——测试侧问题非产品缺陷）。set_input_files(ff240.xlsx) → toast「Excel 导入成功 已读取 40 条数据」+「共 40 条」+ 映射面板（姓名）齐全，无横向溢出 — passed。

**T3 移动端导出四链路**（预览 Tab 内 tap，toast + expect_download 落盘 + 产物核验，文件名均秒级 `-YYYYMMDD-HHMMSS`）：
- 逐张 PNG（移动端 PNG 弹窗默认成图单位）：40 张 1000×534、md5 全互异、非空白 5.8–6.9% — passed
- 整页 PNG（弹窗内「成图单位」listbox 切「整页」）：2 页 2481×3509、非空白 5.98/4.39% — passed
- 图片版 PDF：toast「图片版 PDF 已生成」、pypdfium2 p1 非空白 12.15% — passed
- eink 800×480 逐标签（全新 context + eink234.xlsx 3 行）：3 张恰 800×480、恰 2 色 (0,0,0)/(255,255,255)、无 pHYs、md5 互异 — passed

**T4 触摸交互 + #228**：缩放档 SelectField（非原生 select，`aria-haspopup=listbox` 按钮）tap 切「适应单枚→适应宽度」预览宽 1050→300 — passed；「显示选项」折叠组 tap 展开（裁切线可见）/收起（不可见）— passed；导出弹窗 tap 开（dialog=1）/关（dialog=0）— passed；#228 返回哨兵：开弹窗 → history.back → dialog=0 且 pathname 仍 /studio — passed。

**T5 /seating 移动端**：粘贴 10 行（含 张伟246）→ tap「完全随机」10 座位全部出名 — passed；点选换座 张伟246⇄李四246 座位下标 1↔7 互换 — passed；文档无横向溢出（390/390），排座网格祖先容器自身可横滚（scrollWidth 517 > clientWidth 356，overflow-x 滚动可用）— passed；**「横滑提示」文案在 seating 代码中不存在**（仅 VsDetailView 有「左右滑动查看完整对照表」），如实注记非缺陷。

**T6 隐私与收尾**：r246_b 全程 139 请求，张伟246/𱁬田240/维文/张伟240/234 标记串命中 0 — passed；pageerror 仅 1 条良性「ResizeObserver loop completed with undelivered notifications.」（白名单内），真实 pageerror=0 — passed；storage 清理、context/进程全退。诚实注记：首轮脚本（r246_run.py，覆盖 T1/T2/前三导出）在 T4 处因 SelectField 非原生 select 抛错中止，其请求清单未落盘；补测脚本 r246_b 覆盖了同一导入+导出+seating 路径的隐私审计（命中 0）。

**结论**：移动 WebKit（iPhone UA/触摸/DPR3）黄金链路全部判据 PASS，无 P1–P3 新发现。产物 `/home/ubuntu/r246_dl/`，请求 `/home/ubuntu/r246_reqs_b.json`。

---

# 第 245 轮（2026-08-11）：打印链路 headed Firefox 实证（生产，无代码变更）✅ 全部判据 PASS——window.print 在 Firefox 实调起且 print-to-file 落盘矢量 PDF：/studio demo 2 页（文字在版可选中）、/seating 排座 1 页（张伟245 等名单文字在 PDF 文本层）；与 Chromium printToPDF 基线页数一致、墨量同量级；WebKit window.print 亦被调起但无 print-to-file 通道（产物 blocked，如实标注）

**环境注记（重要）**：用户所述 DISPLAY=:0 可视桌面**实际不存在**（无 X socket、无 Xorg/Xvfb 进程；常驻 Chrome 29229 是 headless，其环境变量里的 DISPLAY=:0 指向不存在的显示）。改为自建 `Xvfb :99`（1600×1000）承载 headed Firefox（firefox-1438，headless=False）；常驻 Chrome 全程未动（收尾核验仍存活）。Firefox 静默打印落盘配方：`print.always_print_silent=true` + `print_printer='Mozilla Save to PDF'` + `print.printer_Mozilla_Save_to_PDF.print_to_file=true/print_to_filename=<path>`（Playwright firefox_user_prefs 注入），先以探针页验证可行后再打生产。脚本 `/home/ubuntu/r245_ff.py`。

**T1 /studio demo 打印**：载入演示数据 → 点「打印 / 矢量 PDF」→ 导出方式弹窗选带水印 → toast「正在准备 2 页打印内容...」「已调起浏览器打印」；hook 计数 window.print=1；落盘 `r245_ff_studio.pdf` 96KB：**2 页** 596×842pt（A4），p1 墨量 4.88% / p2 0.86% 无空白页，pypdfium2 文本层含「座位号 SEAT / 张伟 / 第1考场 / 2026061001…」（矢量文字可选中）— passed

**T2 /seating 排座打印**：粘贴 10 行（含 张伟245）→ 完全随机 → 点「打印」→ toast「即将调起浏览器打印 请选 A4 横向…」；window.print=1；落盘 `r245_ff_seating.pdf`：1 页、墨量 1.47% 非空白，文本层含「高三（2）班 期末考试 / 讲台 / 张伟245 / 李四245…」全名单在版 — passed

**T3 与 Chromium 基线粗比对（r128 方法族）**：常驻 CDP 29229 同素材 stub window.print + Page.printToPDF 出基线 `r245_cr_studio.pdf`：页数 **2=2 一致**；p1 墨量 FF 4.88% vs CR 7.10%（比值 0.69 ∈ [0.3,3] 同量级，CR 侧 printToPDF 含更重背景渲染）— passed（粗比对判据）

**T4 WebKit 打印**：headed WebKit（Xvfb :99）同路径点「打印 / 矢量 PDF」→ hook 证实 **window.print 被调起（计数 2，重入为 hook 侧现象）、无 JS 异常、页面不崩**；但 WPE WebKit 无 Mozilla Save to PDF 式 print-to-file 机制、无打印对话框 UI，打印产物无法落盘核验 — window.print 调起 passed / 产物 **blocked（引擎无 print-to-file 通道，如实标注）**。首轮 WK 探针的 1 条 pageerror 为测试脚本自身 init-script 语法错误，重跑干净口径 pageerror=0。

**T5 隐私与收尾**：FF 55 请求，张伟245 命中 **0**（`/home/ubuntu/r245_reqs_ff.json`）；FF/WK pageerror=0（干净口径）；storage 清理；headed Firefox/WebKit 窗口全关、Xvfb :99 已杀、常驻 Chrome 29229 存活未动。r240 以来反复标 untested 的「打印实际调起」至此在 Firefox 闭环（含产物核验），WebKit 闭环到 window.print 调起层。

# 第 244 轮（2026-08-11）：次级链路 Firefox + WebKit 跨引擎回归（生产，无代码变更）✅ 全部判据 PASS——/seating 排座（粘贴/换座/持久化/桌贴联动）、长链分享（生成/还原/篡改容错）、模板设计器（加字段/改字号颜色/保存/刷新保留/导出 PNG）、#228 弹窗返回哨兵，在两引擎全过；隐私零外发；诚实注记：WebKit 全程 3 条良性 ResizeObserver pageerror（见 T5）

**环境**：Playwright firefox-1438 与 webkit-1967（`PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`）headless 打生产 `index-B7iIsDpm.js`；判据沿用 r240–r243（toast MutationObserver 改为 context init-script 安装，防导航后丢观察器；WebKit/Firefox 下载均用 `expect_download`；每大项全新 context 防 localStorage 模板残留）。脚本 `/home/ubuntu/r244_run.py`。

**T1 /seating（两引擎）**：粘贴 10 行名单（含 张伟244/𫔭𨱏244）→「完全随机」toast「已完全随机排座」、10 个座位格出名；点选换座：张伟244⇄李四244 在座位序列中的下标互换（FF idx 9↔6 / WK idx 0↔7）；reload 后 `seatmark.seating-state.v1` 存在、座位顺序完全恢复；「一键生成对应桌贴」→ `location.href=/studio?from=seating`、预览「共 10 条」、映射含 座位号 — passed（两引擎）。打印对话框 window.print headless 不可验证 — untested（如实）。注意：Firefox headless 下 router.push 后 Playwright `page.url` 不更新（location.href 正确）——测试侧现象非产品问题。

**T2 长链分享（两引擎）**：「复制当前模板分享链接」toast「分享链接已复制」，钩取 clipboard 得 `https://www.seatmark.cn/studio#tpl=…`（FF 1284 / WK 1288 字符）；全新 context 打开 → 分享模板弹窗出现，点「仅本次使用」→ toast「已应用分享模板 仅本次使用，未保存到我的模板」；篡改 payload（截断+加脏字符）打开 → toast「分享链接无效 链接可能不完整或已损坏，请让对方重新生成」、页面不崩、studio 可继续使用（PNG 按钮在） — passed（两引擎）

**T3 模板设计器（两引擎）**：studio「新建模板」→ 设计器打开（模板名称 input 在）；「+ 添加字段」→ 文本字段加入（空字段提示消失，字段 2 个）；改字号 20pt、颜色 #E11D48；模板名改「r244自定义FI/WE」→「保存」→ 设计器关闭 + toast「模板已保存 已加入我的模板并应用」；reload 后自定义模板仍在列表且 localStorage 持久化串含 `"fontSize":20` 与 `e11d48`；用该模板导出逐张 PNG：toast「PNG 图片已生成（18 张标签打包为 zip）」，zip 落盘 18 张 1000×667 非空白（墨量 6.3-7.7%），首张可见新增红色 #E11D48 字段「示例文本」（`/home/ubuntu/screenshots/r244_label_ff.png`/`r244_label_wk.png`）— passed（两引擎）。注：空模板导出按钮置灰，需先载入演示数据（设计如此）。

**T4 #228 弹窗返回哨兵（两引擎）**：/studio 打开 PNG 导出弹窗（dialog=1）→ `history.back()` → dialog=0、`location.pathname` 仍 `/studio`、页面可继续操作 — passed（两引擎）

**T5 隐私与收尾**：FF 272 / WK 316 请求，张伟244/𫔭𨱏244/r244自定义 标记串命中 **0**（`/home/ubuntu/r244_reqs_firefox.json`/`r244_reqs_webkit.json`）；Firefox pageerror=0；**WebKit pageerror=3，均为「ResizeObserver loop completed with undelivered notifications.」**——业界公认良性警告（浏览器把未及时投递的 ResizeObserver 通知上报为 error 事件，不中断执行、无功能影响，本轮所有断言在其存在下仍全过），Chromium/Firefox 轮未出现，判 P4 记录不阻塞；storage 清理、两引擎 context/进程全退。

# 第 243 轮（2026-08-11）：WebKit/Safari 跨引擎专项回归（生产，无代码变更）✅ 全部判据 PASS——主链路首次在 WebKit 引擎验证：导入/标准三导出链路/eink 精确像素（整页+逐标签 800 与 4096）/字体（𱁬+维文）/长名截断/隐私零外发/pageerror 0 全过，未见 Firefox 式误截或引擎级失败

**环境**：Playwright webkit-1967 headless（WPE WebKit 2.43.1，UA Safari/605.1.15）。注意两个环境坑：① playwright host 校验对 bundled libjxl 误报缺依赖，需 `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` 启动（libjxl.so.0.8 实际在 webkit 目录 sys/lib 内，运行正常）；② WebKit 下 `page.on('download')` 回调里的 save_as 若与 ctx.close() 竞态会 TargetClosedError 丢文件——PDF 等大文件用 `page.expect_download()` 同步等待再 save_as。生产 bundle `index-B7iIsDpm.js`（与 r242 相同，无部署变化）。夹具同 r242。

**T1 冒烟**：首页 title 正常、/templates 5 个模板入口、40 行导入 toast +「共 40 条」+ 预览截图留档 — passed

**T2 标准模板三链路**：整页 PNG（2 页 2481×3509，非空白 6.6/4.8%）、逐张 PNG（40 张 1000×534，md5 互异非空白 6.5-7.4%）、图片版 PDF（2 页，pypdfium2 p1 非空白 11.2%）全部成功落盘、文件名秒级 — passed

**T3 eink 精确像素（#244 截断判据 WebKit 首验）**：逐标签 800×480 3 行（3.6s）与 40 行（19.5s）、4096 自定义（32.5s，40 张 4096×2458）、整页 800×480 全部成功；逐张恰 800×480/4096×2458、恰 2 色 (0,0,0)/(255,255,255)、无 pHYs、md5 互异——**无 Firefox 式「页面渲染不完整」失败**。误截观察：导出宿主轮询仅捕获 21 字长名行「欧阳娜娜穆罕默德阿卜杜拉希莫夫斯…」（真溢出，合法截断），单行短名（张伟234/𫔭𨱏234）未被误截 — passed

**T4 字体（𱁬+维文 RTL，vs r242 Chromium 产物）**：𱁬田240 列分段 WK/CR 均 5 段、逐段位置几乎一致（[(443,80),(539,74)…] vs [(442,80),(539,75)…]）、墨量 2.03 vs 1.98%；维文 9 vs 8 段、墨量 1.22 vs 1.52%（引擎级差异，与 r240 FF 观察同型，非缺字）；张伟240 5v5 段。无 tofu/顶部平切；蒙太奇 `r243_t4_wk_vs_cr.png`（左 WK 右 CR）留档人工终判 — passed（带人工判读注记）

**T5 超长姓名**：60 字名逐张导出成功，导出宿主捕获「超超超超超超超超超超…」（省略号截断生效）；产物姓名区单一文本带（行 100-143）无叠压 — passed

**T6 隐私与收尾**：全程 2370 请求，姓名/生僻字/维文/夹具标记串命中 **0**（`/home/ubuntu/r243_reqs.json`）；pageerror=0 全部会话；storage 清理、WebKit context/进程全退、CDP 无遗留 SeatMark tab。诚实注记：首轮脚本 T2 的 PDF 因上述 save_as 竞态未落盘，已用 expect_download 口径重跑并核验（`标准考场版-20260811-105205.pdf`）。

产物：`/home/ubuntu/r243_dl/`（6 zip+1 pdf）、截图 `/home/ubuntu/screenshots/r243_t1_home.png`、`r243_t1_templates.png`、`r243_t1_imported.png`、`r243_t3_eink.png`、`r243_t3_4096.png`、`r243_t4_wk_vs_cr.png`、`r243_t5_label1.png`、请求 `/home/ubuntu/r243_reqs.json`、脚本 `/home/ubuntu/r243_wk.py`、`r243_pdf.py`。headless 不录屏。

# 第 242 轮（2026-08-11）：#244 Firefox eink 逐标签导出 P2 修复 生产复测（r240 口径）✅ 全部判据 PASS——**r240 P2 闭环**：Firefox eink 精确像素「按标签逐张导出」从 0/10 全失败变为全部成功（3 行×3 次复跑 + 40 行 + 4096 自定义全过）；eink 整页/标准模板三链路/长名截断/Chromium 同口径回归均无回归；隐私零外发、pageerror 0

**环境**：Playwright firefox-1438 headless + Chromium headless（CDP 29229）对照；生产 bundle **`index-B7iIsDpm.js`**（从 r240 的 `index-j8zuZYS6.js` 翻转确认，页面 resource entries 实证）；夹具 r231 `eink234.xlsx`（3 行）、r240 `ff240.xlsx`（40 行含 𱁬田240/维文）、新建 `/home/ubuntu/r240_fixtures/long242.xlsx`（60 字超长姓名 + 张伟242）；判据 toast（MutationObserver）+ download.save_as 落盘 + 产物像素/pypdfium2。

**T1 P2 闭环核心（Firefox eink 逐标签 800×480）**：3 行夹具连续 3 次导出**3/3 成功**（r240 为确定性 0/10 失败），toast「PNG 图片已生成（3 张标签打包为 zip）」1.3-3.3s；40 行夹具成功（15.7s，40 张）。产物逐张核验：IHDR 恰 800×480、恰 2 色 (0,0,0)/(255,255,255)、无 pHYs、不同姓名 md5 互异、非空白（ink 0.75-3.8%）— **passed（P2 闭环）**

**T2 4096 自定义宽度逐标签（Firefox）**：40 行 45.8s 成功 toast，zip 40 张全部 4096×2458、纯二值、无 pHYs、md5 互异 — passed

**T3 eink 整页回归（Firefox）**：3 行 1.8s 成功，逐张 800×480、恰 2 色、无 pHYs（整页链路截断防护保持，未受 skipTruncationCheck 影响）— passed

**T4 标准模板 Firefox 回归**：40 行整页 PNG（2 页 2481×3509，非空白 5.8/4.3%）、逐张 PNG（40 张 1000×534，非空白 7.3-7.9%）、图片版 PDF（2 页，pypdfium2 p1 非空白 10.6%）全部成功落盘，文件名秒级 — passed。**真溢出仍截断**：60 字超长姓名导出成功且导出宿主 `.label-field__content` 实时捕获到截断文本「超超超超超超超超超超…」（省略号截断仍生效，判据未因半行余量放松而失效）；产物标签姓名区单一文本带（行 84-125）、与边框/相邻字段无叠压 — passed

**T5 Chromium 同口径回归**：eink 逐张（3 张 800×480 纯二值无 pHYs md5 互异）、eink 整页、标准 40 行逐张/整页、长名夹具整页均成功；Chromium 侧同样捕获「超超超超超超超超超超…」截断文本（#207/#208 整页截断防护路径未被 skip——代码位 pdfExport.ts:638 仅逐标签链路传 skipTruncationCheck）；pageerror=0 — passed（截断防护为行为抽测：生产无法人工注入真截断形态，以代码路径 + 导出正常佐证）

**T6 隐私与收尾**：Firefox 全程 4479 请求，𱁬田240/维文串/张伟240/超长名/张伟242/eink234 标记串命中 **0**（`/home/ubuntu/r242_reqs.json`）；pageerror=0（FF+CR 全部会话）；storage 清理、Firefox 进程全退、CDP 侧无遗留 SeatMark tab。

产物：`/home/ubuntu/r242_dl/`（FF eink 9 zip+1 pdf）、`/home/ubuntu/r242_dl_std/`（FF 标准 5 件）、`/home/ubuntu/r242_dl_cr/`（CR 对照 5 件）、截图 `/home/ubuntu/screenshots/r242_t1_eink3.png`、`r242_t2_4096.png`、`r242_t4b_std_preview.png`、`r242_t4b_label1/2.png`、`r242_t4b_montage.png`、脚本 `/home/ubuntu/r242_ff.py`、`r242_ff2.py`、`r242_ff3.py`、`r242_cr.py`。headless 不录屏。

# 第 240 轮（2026-08-11）：Firefox 跨浏览器专项回归（生产，无代码变更）⚠️ 发现 P2×1——**eink 精确像素「按标签逐张导出」在 Firefox 下 100% 确定性失败**（0/10，800 预设与 4096 自定义、3 行与 1 行夹具全失败，每次 ~1.3s 弹「PNG 生成失败 第 1/N 页渲染失败：页面渲染不完整（右侧内容未绘出）」），已即时上报；对照组均正常：eink**按整页导出**成功（800×480 精确、纯二值、无 pHYs）、标准模板整页/逐张/图片版 PDF 全部成功；核心链路冒烟、字体（𱁬/维文 RTL）、隐私零外发、pageerror 0 均过

**环境**：Playwright firefox-1438 headless（viewport 1500×1000），生产 `index-j8zuZYS6.js`；夹具 `/home/ubuntu/r240_fixtures/ff240.xlsx`（40 行：𱁬田240 / 维文 ئابدۇللا مۇھەممەت / 张伟240 / 考生04-40）+ r231 eink 夹具；判据 toast（MutationObserver）+ page.on('download') 落盘 + 产物像素。

**T1 核心链路冒烟**：首页 title 正常、/templates 5 个模板入口、/studio 导入 40 行 toast「Excel 导入成功 已读取 40 条数据」+「共 40 条」+ 映射面板 姓名/学号/班级 齐全 — passed

**T2 导出三链路（标准考场版）**：整页 PNG 3.5s 落盘 zip（2 页，2481×3509，非空白 5.67%）；逐张 PNG 3.7s zip 40 张（1000×534，前 3 张 md5 互异、非空白 7.1-7.8%）；图片版 PDF 4.8s 落盘（2 页，pypdfium2 渲染 p1 非空白 9.83%）；文件名均 `-\d{8}-\d{6}` 秒级 — passed

**T3 字体渲染（𱁬 + 维文 RTL）**：𱁬田240 标签 FF/CR 列分段（blob）结构几乎逐段一致（[(450,81),(546,69),(635,36),(681,41),(731,38)] vs CR 同构）→ 𱁬 无缺字/无 tofu；维文行 FF 13 段 vs CR 8 段、墨量 FF≈CR 的 80%——维文本身含天然断笔字母（ا/د/ۇ），FF 预览与 FF 导出分段结构一致（导出与预览自洽），判读为引擎级字体/粗细差异而非缺字或平切；三张 bbox 完整贴边一致、首行墨迹行=0（边框）无顶部平切。人工终判请看并排蒙太奇 `r240_t3_ff_vs_cr.png`（左 FF 右 CR）— passed（带人工判读注记）

**T4 eink 精确像素**：整页导出成功——落盘 PNG 恰 800×480、恰 2 色 (0,0,0)/(255,255,255)、无 pHYs — passed；**逐张导出 P2**：800 预设与 4096 自定义、3 行与 1 行夹具共 10 次全部 ~1.3s 失败 toast「页面渲染不完整（右侧内容未绘出）」（截断检测 domExpectsRightInk 拦下 html2canvas 在 Firefox 对 eink 逐张 cropRect/精确像素路径的右侧未绘出）——有失败 toast 兜底非静默，但 **Firefox 用户完全无法使用 eink 逐张导出**；Chromium 同夹具同路径正常（r236/r239）— **failed（P2，已上报）**；4096 大宽度耗时判据因此 blocked

**T5 打印链路冒烟**：「打印 / 矢量 PDF」对话框可打开（含彩色打印检查清单文案）；window.print 实际调起在 headless firefox 不可验证 — untested（如实标注）

**T6 隐私与收尾**：全程 214 请求，𱁬田240/维文串/张伟240/文件名标记串命中 **0**；pageerror=0（Firefox 全部会话）；storage 清理、Firefox context 全关、CDP 侧无遗留 SeatMark tab。

产物：`/home/ubuntu/r240_dl/`（FF：2 zip+1 pdf+1 png）、`/home/ubuntu/r240_dl_cr/`（CR 对照 zip）、`/home/ubuntu/r240_extract/`（ff/cr_label1-3.png）、截图 `r240_t3_ff_vs_cr.png`、`r240_t4_fail1.png`、`r240_t1_*.png`、脚本 `/home/ubuntu/r240_t1.py`–`r240_t7.py`、`r240_cr.py`、请求 `/home/ubuntu/r240_reqs.json`、夹具 `/home/ubuntu/r240_fixtures/ff240.xlsx`。headless 不录屏。

# 第 239 轮（2026-08-11）：#241 导出文件名时间戳秒级 生产复测 ✅ 全部判据 PASS——同一分钟内连续两次相同 PNG 导出**两个 zip 均落盘**（`…-094227.zip` / `…-094233.zip`，秒位互异，r237 的同名去重丢文件问题闭环）；图片版 PDF 落盘 `电子座签 800×480-20260811-094738.pdf`（`-\d{8}-\d{6}\.pdf`）；整页导出与按字段命名无回归；pageerror 0

**环境**：生产新 bundle `index-j8zuZYS6.js`（09:39 翻转确认，main a539193 含 #241 pngExport.ts:144 / pdfExport.ts:766 stamp 加 `pad(getSeconds())`），headless CDP，夹具 `/home/ubuntu/r231_fixtures/eink234.xlsx`，toast 判据用页内 MutationObserver（r237 口径）。

**T1 同分钟双导出**：秒位 <35 时起跑，0942 分钟内连续两次 800 宽逐张导出——两次均 toast「PNG 图片已生成（3 张标签打包为 zip）」且**各自落盘**：`电子座签 800×480-800x480-20260811-094227.zip` 与 `…-094233.zip`（秒级互异；旧行为第二个必被 Chrome 同名去重丢弃）— passed。注：首轮尝试第 1 次导出命中既知低频「页面渲染不完整」快速失败 toast（0.8s，r237 已定性 1/25 级），重试轮两次全成功，非回归。

**T2 PDF 秒级时间戳**：「图片版 PDF（推荐）」带水印导出 2.9s toast「图片版 PDF 已生成」，落盘 `电子座签 800×480-20260811-094738.pdf` 符合 `-\d{8}-\d{6}\.pdf` — passed。注：「打印 / 矢量 PDF」路径走浏览器打印对话框不落盘文件（设计如此，headless 下无打印预览，不在本轮判据内）。

**T3 回归抽查**：整页导出成功，zip 内 `…-094413-001/002/003.png` 序号命名含秒级时间戳；按字段命名（模板 `{姓名}`）zip 内为 `张伟234.png`/`欧阳娜娜…234.png`/`𫔭𨱏234.png`——字段命名路径不含时间戳、不受 #241 影响 — passed。

**T4 收尾**：pageerror=0 全部会话；storage 清理；SeatMark tabs 全关（仅剩 sw.js worker）。

产物：`/home/ubuntu/r239_dl/`（7 zip + 1 pdf）、脚本 `/home/ubuntu/r239_t1.py`–`r239_t4.py`、截图 `/home/ubuntu/screenshots/r239_t1_two_success.png`、`r239_t2_pdf3.png`、`r239_t3_field.png`。headless 不录屏。

# 第 237 轮（2026-08-11）：诊断 r236「与宽度无关的间歇性导出卡死」（生产，无代码变更）✅ 结论：**测试口径误判，非看门狗失效，撤销 r236 T-flake 的 P3 建议**——以 toast 为判据的受控复测 25 次导出（800/4096 交替）**全部 ≤3s 内收到成功或失败 toast，0 次卡死**；r236/r237 首轮的「卡死」由两个测试侧伪影叠加造成：① overlay 判据误匹配 AppHeader 常驻按钮文案「正在制作中」（studio 路由下该按钮永远显示此文案，导致「overlay 卡住」为假象）；② 文件落盘判据受 Chrome 下载去重影响——导出文件名仅含分钟级时间戳（`-YYYYMMDD-HHMM.zip`），同一分钟内的重复导出被静默丢弃不落盘（16 次成功 toast 仅 6 个文件落盘），file-based 检测便误报「无产物」。看门狗真实有效：捕获到一次真实渲染失败在 **1.1s** 即弹「PNG 生成失败 第 1/3 页渲染失败：页面渲染不完整（右侧内容未绘出）…」；取消按钮可用

**环境**：生产 bundle `index-CXMSr-GO.js`（与 r236 相同，无新部署），headless CDP，夹具 `/home/ubuntu/r231_fixtures/eink234.xlsx`（3 行），`/studio?template=eink800` 自定义宽度 800/4096 交替。

**T1 卡死终局观察（≥180s）**：沿用 r236 口径（file-based 检测 + Escape 复位）跑 20 次，出现 6 次「>330s 无文件无 toast」且**严格每 3 次一周期**（#3/6/9/12/15/18）——周期性本身即测试伪影信号；卡死时截屏亮度 247.6/255（无深色 loading 遮罩，页面正常），说明**并非 overlay 真卡住**，是判据误匹配 header「正在制作中」+ 下载被去重丢弃。改用「逐步取证 + toast 判据」复测（`r237_t2.py`，9 次）：每一步（PNG 按钮/预设/宽度/导出按钮）均 ok，**每次 1-2s 内出成功或失败 toast**，overlay 文案真实为「正在渲染第 N/3 页... 取消导出」且 N 随页递增 — 无一真卡死。

**T2 运行时状态（原「卡死」时点）**：`Runtime.evaluate` 心跳 2ms（主线程空闲）、rAF 300ms 内触发 19 次（headless 页面 visible，双 rAF 不会挂起 mountHost）、setTimeout(0) 即时触发、`document.visibilityState=visible` —— 与「html2canvas 竞态挂起」假设矛盾，与「导出早已结束、toast 已过期消失（~8s 生命周期，60s 后必然看不到）」一致。

**T3 结局统计（toast 判据，MutationObserver 非破坏取证，16 次）**：15 次成功（800 宽 1.0-1.1s、4096 宽 2.6-3.0s，分布极稳）+ 1 次真实失败 toast @1.1s（「第 1/3 页渲染失败：页面渲染不完整（右侧内容未绘出），请重新导出；本次未扣除无水印次数」——即 r236 偶发渲染不完整被空白/截断检测拦截并快速报错，**这才是间歇性现象的真身**，有兜底非卡死）；0 次 >90s；0 次无响应。加 T1 复测 9 次合计 25 次 0 卡死。**注**：30s 看门狗超时路径本轮未被自然触发（所有失败在 1s 级由截断检测抛错），无法直接实证 30s 截断，但已无证据支持存在「无提示无产物」路径。

**T4 取消按钮**：4096 导出渲染中 overlay 含「取消导出」按钮（enabled），点击后 1.5s 内 toast「已取消导出 本次未扣除无水印次数，可随时重新导出」、遮罩消失（截屏亮度恢复 247.2），后续导出正常 — passed。

**T5 收尾**：pageerror=0 全部会话；storage 清理；SeatMark tabs 全关（仅剩 sw.js service worker）。

**裁量建议**：① r236 T-flake 降级为「非缺陷（测试口径误判）」关闭；② 真实残留为**低频（1/25）渲染不完整→快速失败 toast**，属既有兜底按设计工作，用户可一键重试，建议不立案或 P4 观察；③ 产品可选改进：导出文件名时间戳精确到秒可避免同分钟重复导出被浏览器去重丢弃（对真实用户连续导出同宽度也有影响——同一分钟第二次导出会静默无文件落盘，**这是本轮发现的唯一疑似用户可感问题**，建议裁量）。

产物：`/home/ubuntu/r237_results.json`、`r237_stats.json`、脚本 `/home/ubuntu/r237_t1.py`–`r237_t4.py`、截图 `/home/ubuntu/screenshots/r237_t4_overlay.png`（overlay+取消按钮）、`r237_t4_after_cancel.png`、`r237_hang_state.png`（「卡死」时点实为无遮罩亮页）。headless 不录屏。

# 第 236 轮（2026-08-11）：#239 精确像素大宽度关闭超采样 生产复测 ⚠️ 核心判据 PASS 但发现残留问题——3840/4000/4096 现均可 3-4s 成功导出（r234 P2 的确定性 >300s 卡死已消除），产物 IHDR 精确/纯二值/无 pHYs/文件名含分辨率；预设 800×480 与 296×128 与 r234 基线 4/6 张逐位一致（2 张长名行有 0.1% 单字形微差，疑字体加载时序）；**但导出流程存在与宽度无关的间歇性卡死（约 2-3/10，800/2048/3840/4096 均复现，overlay 卡住无文件无报错）**，已如实上报裁量

**环境**：生产新 bundle `index-CXMSr-GO.js`（06:54 翻转确认，main c363fa4 含 #239 `exactPixelSupersample(w)=w*2<=4096?2:1`），headless CDP，夹具复用 `/home/ubuntu/r231_fixtures/eink234.xlsx`（3 行）。

**T1 大宽度修复核心**：3840→3840×2304、4000→4000×2400、4096→4096×2458 各 3 张，成功时均 **3-4s** 出 zip（r234 同环境 >300s 确定性卡死），逐张纯二值恰 2 色、无 pHYs、文件名含 `-{w}x{h}` — **passed**（首跑 3840 一次卡死后复跑成功，见 T-flake）

**T2 边界回归**：2048（仍 2×）→2048×1229、2049/3072/3500（1× 直出）→2049×1229/3072×1843/3500×2100 全部成功且尺寸精确、纯二值无 pHYs — passed

**T3 预设像素级基线比对**：800×480 与 296×128 各导出与 r234 基线 zip 逐位比对——第 1/3 张（张伟234/𫔭𨱏234 行）**逐位一致**；第 2 张（21 字长名行）各有一处单字形大小的局部微差（800×480：413px、bbox 43×42 @x299-341；296×128：37px），墨量相当（1741 vs 1794），疑 Plangothic 生僻字体加载时序/字形替换所致非 #239 回归，比对 crop 存 `r236_t3_diff_crop.png` — passed（带注记）

**T4 无效输入**：99/4097 → 红边 +「请输入 100–4096 之间的整数」、导出无产物 — passed

**T-flake 残留间歇性卡死（新发现，宽度无关）**：三组压力测试共 32 次导出中 7 次「正在制作中」overlay 卡住 >60s 无文件、无错误 toast、pageerror=0（点击已确认注册、对话框已关、overlay 可见）：混合宽度 3840/4096 10 次中 3 次；**800/2048 小宽度 10 次中 2 次**；5s 间隔+每 4 次重载 10 次中 2 次。与宽度无关 → 非 #239 引入的超采样问题本身，疑导出流程（html2canvas/字体等待）存在竞态且无超时兜底；卡死后重开对话框再导出可恢复。r234 曾在旧 bundle 连续 10+ 次导出未见此象，无法排除新 bundle 相关，也可能是 headless 环境放大，建议产品侧给导出加超时/失败提示兜底并裁量级别（建议 P3，若真机可复现升 P2）。

**T5 收尾**：pageerror=0 全程（所有会话）；storage 清理、tabs left: []。

产物：`/home/ubuntu/r236_dl/`（46 个 zip 含压力测试）、`/home/ubuntu/screenshots/r236_*.png`、脚本 `/home/ubuntu/r236_t1.py`、`r236_stress.py`、`r236_t3.py`。headless 不录屏。

# 第 234 轮（2026-08-11）：eink 精确像素模式全流程专项（无代码变更轮）⚠️ 发现 P2×1——自定义宽度 ≥约3600（UI 校验允许至 4096）导出「正在制作中」遮罩永久卡死无兜底；其余全过：入口可发现、6 预设 IHDR 全精确、纯二值无 pHYs、文件名含实际分辨率（#151 保持）、逐张内容随行变化、生僻字非 tofu、名单零外发、pageerror 0

**环境**：生产（bundle `index-EbJxTvBJ.js`，无新部署），headless CDP；夹具 3 行名单（张伟234 / 21 字长名「欧阳娜娜穆罕默德阿卜杜拉希莫夫斯基娅234」/ 生僻字「𫔭𨱏234」，`/home/ubuntu/r231_fixtures/eink234.xlsx`）；模板 eink800「电子座签 800×480」。

**T1 入口可发现性**：首页含「电子座签 800×480」指南链接 → `/guides/eink-800x480-desk-card` 可达且有 /studio CTA；/templates 库搜索可见电子座签卡片；`/studio?template=eink800` 直达后 PNG 导出对话框默认「精确像素（电子墨水屏 800×480）+ 纯黑白 + 预设 800×480」——路径顺畅 ✅

**T2 预设全枚举**：6 预设逐个真实导出（带水印，3 行逐张 zip），逐张 IHDR 核验：800×480、1280×720、648×480、640×384、400×300、296×128 全部与标称**逐像素一致**；每 zip 3 张同尺寸；文件名含实际分辨率后缀（如 `电子座签 800×480-296x128-…-001.png`，#151/#135 口径保持）；比例不匹配预设（1280×720/648×480/400×300/296×128）均出现「画面会被拉伸」amber 提示 ✅

**T3 自定义宽度边界**：100（下限）→ 100×60 三张成功；2048/3072/3500 → 6-7s 成功尺寸精确；99/4097/1.5/-5/空 → 输入框红边 +「请输入 100–4096 之间的整数」、点导出无文件产出（正确拦截）✅；**P2：3840/4000/4096（均在 UI 允许范围内）→「正在制作中」遮罩 >300s 永久卡死，无错误 toast、无文件、pageerror=0，仅刷新可恢复**（单行名单亦复现；疑似 2× 超采样使画布宽 >7000px 后 html2canvas 失败无超时兜底；headless Chrome 133 复现，真机阈值或不同，但 MAX=4096 与实际能力不匹配 + 无失败兜底是产品侧问题）已上报

**T4 产物质量**：抽验全部 zip 逐张——chunk 序列无 pHYs、色彩恰 2 色 (0,0,0)/(255,255,255) 纯二值；800×480 三张 md5 互异、黑像素占比 2.9/4.6/2.5% 随行内容变化（长名行墨量最大，符合预期）✅

**T5 小尺寸可读性**：296×128 三张同样纯二值、内容随行变化（黑占比 3.9/5.8/3.5%）；预览页 2/3 文本完整含 21 字长名与「𫔭𨱏234」（长名自动缩字号至 38.7px 渲染，未丢字）；生僻字 canvas 实测两字形 ink 684/1465、diff 1587（非 tofu 同形）；人眼级细节见蒙太奇图 r234_montage_296/800.png。溢出量化指标（scrollWidth）因缩放 span 读数为 0，记 inconclusive ✅（部分）

**T6 隐私与收尾**：全量 Network 104 请求，姓名/长名/生僻字/文件名标记串命中 **0**；全程 pageerror=0；storage 清理、tabs left: []（CDP 浏览器曾因 r233 清理误杀重启，无影响）。

产物：`/home/ubuntu/r234_dl/`（10 个 zip）、`/home/ubuntu/r234_extract/`、`/home/ubuntu/screenshots/r234_*.png`、`/home/ubuntu/r234_reqs.json`、脚本 `/home/ubuntu/r234_t1.py`–`r234_t5b.py`。headless 不录屏。

# 第 233 轮（2026-08-11）：Lighthouse 与性能周期回归（无代码变更轮）✅ 无 >15% 劣化——移动中值 home 91（-7%，观察项）/ studio 79（持平微升）/ templates 96（改善）；/seating 99、/account 84 建立首测移动基线；CLS 五页全 0；BP=58 既定代价不变；40 行导入 0.080/0.087s 优于基线；统计脚本 idle 注入保持；pageerror 0

**环境**：生产（bundle `index-EbJxTvBJ.js`，含弹窗哨兵 #228 与照片提示 #236 等 r179 后 50+ 轮变更），lighthouse@13.4.1 SKILL 标准口径（mobile 模拟节流，每页 3 跑取中值），原始 JSON 存 `/home/ubuntu/r233_lighthouse/`（19 份）。

**结果（移动中值 Perf/A11y/BP/SEO · LCP/TBT/CLS）**：
- `/`：**91**（83/91/91）/100/58/100 · 2.73s/120ms/**0** —— 对 r179 基线 98 为 **-7.1%**（≤15%，观察项：三跑最高 91，与 r161 中值 91 持平，r179 的 98 疑为偏乐观样本）
- `/studio`：**79**（72/82/79）/96/58/100 · 4.20s/204ms/**0** —— 对基线 78 持平微升，TBT 204ms（r179 未劣化）→ 哨兵/照片提示新代码无可感劣化
- `/templates`：**96**（80/97/96）/96/58/100 · 1.90s/153ms/**0** —— 对基线 93 改善
- `/seating`（首测新基线）：**99**（98/99/100）/93/58/100 · 1.54s/65ms/**0** —— 健康
- `/account`（首测新基线）：**84**（77/84/85）/98/58/**66** · 4.18s/71ms/**0** —— SEO 66 仅因 `is-crawlable`（账号页设计性 noindex,nofollow，seo.ts:183），非缺陷；Perf 健康线以上
- 桌面抽查：`/` **100/100** · LCP 0.48s · CLS 0（=r161 基线）；`/studio` 88/98 · CLS 0
- 趣闻注记：studio_r3 单跑 BP=100（该跑百度 cookie 未种上），佐证 BP=58 完全由百度统计钉死。

**T4 40 行导入耗时（r161 口径）**：`r113_40.xlsx` 两次真实 UI 导入 toast「已读取 40 条数据」**0.080s / 0.087s**（r161 0.107s、基线 0.12–0.13s）— 无退化且更优。
**T5 统计脚本 idle 注入（#122 回归）**：全新 tab 冷加载 `/`，分析类请求 load 事件**前 0 个**，load 后 +0.13s 起注入（gtag/hm.js/push.js → hm.gif ×2 → sentry +1.72s）— passed。
- 全程 CDP 会话 pageerror=0；storage 清理 + tabs left: []；lighthouse 临时 Chrome 已随进程退出。
- 产物：`/home/ubuntu/r233_lighthouse/`、`/home/ubuntu/r233_lh.sh`、`r233_lh.log`、`r233_t45.py`；截图 `/home/ubuntu/screenshots/r233_import_run1.png`。
# 第 232 轮（2026-08-11）：#236（照片清除明确提示）生产复测 ✅ 全部判据 PASS——带照片重导/切 sheet 均出现 toast「照片已清除 数据源已更换，照片需重新上传并匹配」（与导入成功/切换 toast 并存不冲突）；无照片导入零打扰（负向隔离复验）；刷新提醒不回归；「清空」按钮仍走「数据已清空」；照片链路冒烟无回归；pageerror 0

**环境**：生产真实 UI，entry 翻转 `index-6teszdpy.js` → `index-EbJxTvBJ.js`（main f86fab2，#236 已部署），复用 r231 夹具与「照片核验版」模板（`/studio?template=withPhoto`）。

**结果**：
- T1 带照片重导同一文件：toast 栈同时出现「照片已清除 数据源已更换，照片需重新上传并匹配」+「Excel 导入成功 已读取 3 条数据…」，照片 img=0、覆盖率行消失（r231 静默注记闭环）— passed
- T2 带照片切 sheet：toast「照片已清除」+「已切换到工作表「S2」」并存，照片清空 — passed
- T3 无照片导入零打扰（负向）：首跑受 T2 残留 toast 污染（如实记录），已隔离复验——全新会话无照片状态下重导同文件与换文件 B 各一次，toasts 均只有「Excel 导入成功」、**不含**「照片已清除」— passed
- T4 刷新提醒不回归：照片态刷新后 400ms 轮询捕获 toast「照片需重新上传 为保护隐私…」，名单「共 3 条」+匹配列=姓名 恢复、照片按设计清空 — passed
- T5 「清空」按钮路径：带照片态点「清空」→ toast「数据已清空 可以重新导入新的 Excel 与照片」，未额外弹「照片已清除」（clearData 不经 applyExcel，符合预期）— passed
- T6 冒烟回归：重导+匹配列+张伟.jpg → toast「照片已加载 本次匹配 1 张，当前覆盖率 33%」、卡片照片像素=纯红 [254,0,0] — passed
- 全程 pageerror=0；storage 清理 + tabs left: []。
- 产物：`/home/ubuntu/r232_t1.py`；截图 `/home/ubuntu/screenshots/r232_t1_toast.png`、`r232_t2_sheet_toast.png`、`r232_t3_negative.png`、`r232_t4_reload.png`、`r232_t5_clear.png`、`r232_t6_smoke.png`。
# 第 231 轮（2026-08-11）：照片链路专项（无代码变更轮）✅ 全部判据 PASS——真实照片导入/覆盖率/卡片渲染正确；带照片重导/切 sheet 均静默清照片（UI 无提示，注记）；刷新有「照片需重新上传」明确提醒；匹配边界（同批完全一致优先、.JPG、空格括号名、双值文件名、未匹配/伪图错误明细）全过；导出 PNG 像素级验到照片真实渲染；照片文件名与二进制零外发；pageerror 0

**环境**：生产真实 UI（entry `index-6teszdpy.js`，无新部署），headless CDP + Network 全量捕获；模板「照片核验版」（`/studio?template=withPhoto` 直达）；夹具 `/home/ubuntu/r231_fixtures/`（3 行名单双 sheet + 纯色 JPEG/PNG 可做像素断言 + 伪图片）。

**结果**：
- T1 真实照片导入：匹配列=姓名后传 张伟.jpg（红）+李娜.png（绿）：toast「照片已加载 本次匹配 2 张，当前覆盖率 67%」、覆盖率行「已导入 2 张照片，匹配 2/3 行（覆盖率 67%）」、预览 2 张 data: 照片上卡（张伟卡像素=纯红 254,0,0）；未选匹配列时上传按钮 disabled — passed
- T2 带照片重置实证（r230 缺口）：重导同一文件/切 sheet 后照片全清（卡片照片消失、覆盖率行消失、data img=0），**无任何提示**（静默清除，photoColumn 亦复位）——行为一致但静默，注记供裁量；刷新页面：名单/匹配列恢复 + toast「照片需重新上传 为保护隐私，照片仅保存在浏览器内存中…」明确提醒 — passed
- T3 匹配边界：**同批**上传 [张伟20230101.jpg(蓝,包含), 张伟.jpg(红,完全一致)] → 完全一致优先，卡上为红 — passed；**跨批**后传的包含匹配文件会覆盖已有完全一致照片（exactKeys 仅批内生效，跨批=后传覆盖）——如实注记（可解读为「重新上传即更新」，非缺陷上报）；李娜.JPG 大写扩展名命中；「王强 (1).jpg」空格括号包含命中（覆盖率 100%）；匹配列=学号时 张伟20230101.jpg 命中学号行（33%）；未匹配「无名氏.jpg - 未找到匹配的数据行…」与伪图「伪图张伟2.jpg - 不是有效的图片文件…」进错误明细 details — passed
- T4 照片行导出：PNG 带水印导出 zip 3 张，PIL 像素断言：001 含大面积纯红（张伟照片）、002 含纯绿（李娜）、003 无色块（王强无照片占位）——照片真实渲染非裂图 — passed
- T5 隐私：129 个请求（seatmark.cn+统计域+sentry）中姓名/学号/文件名标识串与图片 base64 特征串命中 0（页内 data: URL 不出网）；有 body 的仅 GA/sentry 心跳（199B 内无标记）— passed
- 全程 pageerror=0；storage 清理 + tabs left: []。
- 产物：`/home/ubuntu/r231_t1b.py`、`r231_t2c.py`、`r231_t2d.py`、`/home/ubuntu/r231_fixtures/`、`/home/ubuntu/r231_dl/照片核验版-20260811-0441.zip`、`/home/ubuntu/r231_reqs_a.json`/`_b.json`；截图 `/home/ubuntu/screenshots/r231_t1_photos.png`、`r231_t2_after_reimport.png`、`r231_t2c_reload.png`、`r231_t3e_single_batch.png`、`r231_t3_errors.png`、`r231_t4_export.png`。
# 第 229 轮（2026-08-11）：#232（r228 P3×2 修复）生产复测 ✅ 全部判据 PASS——重名列自动加序号后缀不再丢列（姓名/姓名2/姓名22）、超长表头映射选中态三宽度均不再溢出；r228 已过项全部无回归；pageerror 0

**环境**：生产真实 UI，entry 翻转 `index-BRn1Rj39.js` → `index-6teszdpy.js`（main 50e53df，#232 已部署），复用 r228 夹具 + 新增后缀冲突夹具。

**结果**：
- T1 重名列（两列「姓名」甲X/乙X）：headers=["姓名","姓名2","班级"]，rows 两列值**都保留**（{姓名:甲一228, 姓名2:乙一228}）；映射下拉选项=[未映射,姓名,姓名2,班级,自定义组合…]可区分；把座位号字段映射到「姓名2」后卡片同时显示甲值与乙值 — **passed（r228 P3① 修复确认）**
- T2 后缀冲突（表头 [姓名,姓名,姓名2]）：去重为 ["姓名","姓名2","姓名22"]，三列数据全在（a/b/c 标识串各归其列）— passed
- T3 超长表头（200 字符）选中态：导入→下拉→选中后 1280/768/390 三视口 scrollWidth=1270/768/390 均 ≤ innerWidth（r228 时 2982 溢出 ~1500px）；预览含「长头值一228」；PNG 带水印导出成功（toast「PNG 图片已生成（2 张标签打包为 zip）」+ zip 落盘）— **passed（r228 P3② 修复确认）**
- T4 回归：空表头补名「列2」值正确；公式缓存值读出「丁一228三班」；100 列×20 行「共 20 条」不卡死；混合类型 42/纯文本228/2024-01-05/007/50%；表头-only 与 1×1 均报「Excel 至少需要包含表头行和一行数据」— passed
- 全程 pageerror=0；storage 清理 + 全部测试 tab 关闭。
- 产物：`/home/ubuntu/r229_t1.py`、`r229_t3b.py`、夹具 `/home/ubuntu/r228_fixtures/t2_conflict229.xlsx`；截图 `/home/ubuntu/screenshots/r229_t1_dup_mapped.png`、`r229_t3_1280.png`、`r229_t3_768.png`、`r229_t3_390.png`、`r229_t3_export_done.png`；导出物 `/home/ubuntu/r229_dl/标准考场版-20260811-0423.zip`。
# 第 230 轮（2026-08-11）：导入入口与重复导入状态一致性专项（无代码变更轮）✅ 全部判据 PASS——拖拽上传与点击上传行为一致（含非法扩展名拦截）；重复导入/换文件导入均整体重置映射+autoMap 重建，无残留脏状态；组合映射引用消失列被面板校验拦截（应用按钮禁用）；多 sheet 来回切换一致；清空后重导入配额/预览/导出正常；pageerror 0；名单隐私零外发

**环境**：生产真实 UI（entry `index-6teszdpy.js`，无新部署），headless CDP + Network 全量捕获；夹具新增 `/home/ubuntu/r228_fixtures/t230_multisheet.xlsx`（S1 姓名/班级 2 行、S2 学号/年级 3 行）、`t230_B.xlsx`（甲列/乙列）、`t230_bad.txt`。

**结果**：
- T1 拖拽上传：/studio 空态导入区确有 drop zone（DataImportPanel.vue onDrop，仅空态渲染）。页内构造真实 File+DataTransfer dispatch dragover+drop：t1_dup.xlsx 拖入 toast「Excel 导入成功 已读取 2 条数据」、headers=[姓名,姓名2,班级]，与点击上传（DOM.setFileInputFiles）结果一致；.txt 拖入 toast「文件类型不支持 请拖入 .xlsx / .xls / .csv 文件」且数据不变 — passed。注记：导入后 drop zone 消失（面板改显示文件信息），换文件需走「重新上传/清空」，属产品形态如实记录。
- T2 重复导入同名文件：导入 A → 手动把座位号映射改为「姓名2」（mapping={name:姓名, seatNo:姓名2}）→ 再次导入同一文件：mapping **整体重置**为 autoMap 结果（{name:姓名}，手动项丢弃），照片/overrides/筛选随 applyExcel 一并清空（workspace.ts:505-523 设计行为），预览「共 2 条」正常，无脏状态 — passed（重置语义一致合理；手动映射不保留，如实记录供产品裁量）。
- T3 换文件导入：A 上设组合映射 `{姓名}-{班级}`（预览显示「多表甲230-一班」）→ 导入 B（甲列/乙列）：mapping 全清 {}，旧值（甲一228 等）页面零残留、B 值正常上卡，无静默用旧列名渲染空卡 — passed。组合映射引用消失列：B 下手输 `{姓名}-{班级}` 时面板红字「模板需至少引用一个 {列名}，且引用的列必须存在于当前表头」且「应用组合」按钮 DISABLED（templateColumnsValid 校验）— passed。
- T4 多 sheet 来回切换：导入 toast「文件含 2 个工作表，可在导入面板切换」；切 S2：headers=[学号,年级]、「共 3 条」、mapping 重置；切回 S1：headers/rows 与首次完全一致（共 2 条，rows[0]={姓名:多表甲230,班级:一班}），无串数据；带组合映射切 sheet 亦整体清空无残留渲染 — passed。
- T5 清空后重导入：「清空」按钮 toast「数据已清空」、sessionStorage roster 清空、空态 drop zone 恢复；重导入 A「共 2 条」，PNG 带水印导出成功（toast「PNG 图片已生成（2 张标签打包为 zip）」+ zip 落盘）— passed。
- T6 隐私：全程 31 个网络请求（seatmark.cn + baidu/GA 统计域）URL/postData 中名单标识串（甲一228/乙一228/多表甲230/B甲一230 等）命中 0 — passed。
- 全程 pageerror=0；storage 清理 + 全部测试 tab 关闭。
- 产物：`/home/ubuntu/r230_t1.py`、`r230_t3.py`、`/home/ubuntu/r230_reqs.json`、`/home/ubuntu/r230_dl/标准考场版-20260811-0431.zip`；截图 `/home/ubuntu/screenshots/r230_t1_drop.png`、`r230_t2_reimport.png`、`r230_t3_composite_A.png`、`r230_t3_fileB.png`、`r230_t3_invalid_composite.png`、`r230_t4_sheets.png`、`r230_t5_export.png`。
# 第 228 轮（2026-08-11）：Excel 导入字段映射边界形态走查（无代码变更轮）⚠️ 发现 **P3×2**（重复列名静默丢列；超长表头映射后撑破布局），其余边界形态（空表头/公式列/宽表/混合类型/最小表报错）全部 PASS；pageerror 0

**环境**：生产真实 UI（entry `index-BRn1Rj39.js`，无新部署），headless CDP；夹具 python3+openpyxl/xlsxwriter 现场生成于 `/home/ubuntu/r228_fixtures/`（8 个）。

**结果**：
- T1 重复列名（两列都叫「姓名」，A列=甲X/B列=乙X）：导入 toast「导入成功 已读取 2 条」，headers 保留两个「姓名」，但 rows 中只剩后列值（乙一228/乙二228），前列数据**不可达且无任何提示**、预览不含甲值 — **P3（静默丢列）**。根因 excel.ts:97-106 `record[header]` 后列覆盖前列。建议：重名列自动加后缀（姓名/姓名2）或导入时提示。
- T2 空表头列：自动补名「列2」，下拉可选、映射后卡片正确显示该列值（空头值X228）— passed
- T3 公式列（=A2&B2）：含缓存计算值的真实 Excel 读出计算结果（丁一228三班），非公式串 — passed。注记：openpyxl 生成的**无缓存值**公式文件该列读出为空串（无报错）——真实 Excel 均带缓存值，属夹具边缘，如实记录。
- T4 宽表 100 列×20 行：导入完成「共 20 条」、≈8s 内可交互、映射面板可用、pageerror 0 — passed
- T5 超长表头（200 字符）：导入后与下拉打开态不破版（scrollWidth=1490=视口）；但**选中该列映射后**侧栏 ASIDE(w=400) scrollWidth=2982，页面出现 ~1500px 横向滚动（body overflow-x visible）— **P3（映射选中态破版）**。建议映射下拉选中值 truncate。
- T6 混合类型列：按 Excel 所见文本呈现——42 / 纯文本228 / 2024-01-05 / **007（前导零保留）** / **50%** — passed
- T7 只有表头、1×1 最小表：均 toast「Excel 导入失败 Excel 至少需要包含表头行和一行数据」，不产生空导入假成功、原有数据不被清坏 — passed
- 全程 pageerror=0；storage 清理 + 全部测试 tab 关闭。
- 产物：`/home/ubuntu/r228_t1.py`、`r228_t2.py`、`r228_t5b.py`、`/home/ubuntu/r228_fixtures/`；截图 `/home/ubuntu/screenshots/r228_t1_dup.png`、`r228_t2_mapped.png`、`r228_t3_formula.png`、`r228_t4_wide.png`、`r228_t5_after_map.png`（破版）、`r228_t6_mixed.png`、`r228_t7a.png`。
# 第 227 轮（2026-08-11）：/account 账号页与登录链路容错走查（无代码变更轮）✅ 全部判据 PASS——SES 未认证下登录不可用但体验诚实：/api/auth/code 返回 502 `{"error":"验证码发送失败，请稍后再试"}`，UI 原文透出、**无假成功**、可重试；前端邮箱校验零请求拦截；payload 仅 {email} 无名单外发；pageerror 0

**环境**：生产真实 UI（entry `index-BRn1Rj39.js`，main 11889c7），headless CDP + Network 全量捕获 + 页内 fetch 钩子取响应体；测试邮箱 devin-r227-test@example.com（假邮箱）。

**结果**：
- T1 未登录态 UI：/account 直链 1280 与 390×844 视口均完整渲染（「邮箱验证码登录」表单+「获取验证码」按钮+每日 3 次说明），390 下 scrollWidth=390 无横向溢出 — passed
- T2 前端邮箱校验：空值与 `abc` 提交均红字「请输入正确的邮箱地址」、期间 /api/auth/code 请求数 0、验证码框不出现 — passed
- T3 真实发送容错（核心）：POST /api/auth/code {email} → **502** `{"error":"验证码发送失败，请稍后再试"}`；UI formError 原文透出、无「已发送」toast、codeSent 不置真（验证码框不出现）——错误路径诚实，与 [[default]].js:540 一致；线上未回显 devCode — passed
- T4 可重试性：失败后「获取验证码」按钮 disabled=false，再点仍真实发出请求（同样 502 透出，未触发限频拦截）— passed
- T5 payload 隐私：先在 /studio 导入 3 行名单再发送，body keys 恰 {email}，全部捕获请求中名单姓名串命中 0 — passed
- T6 配额文案一致性：未登录导出弹窗文案「登录后无水印导出每天 3 次，分享链接每被点开 1 次再得 1 次…」与 /account 页说明（QUOTA_USER_DAILY=3）一致 — passed
- T7 /account 直链刷新正常；/studio→/account→back→forward URL 与渲染正常 — passed
- 全程 pageerror=0；storage 清理 + 全部测试 tab 关闭。
- 注记：登录成功路径（验证码送达+verify）依赖 SES 认证修复，本轮按预期不可用，未覆盖登录后（云端同步/注销/分享送次数）功能面。
- 产物：`/home/ubuntu/r227_t1.py`、`r227_t3b.py`；截图 `/home/ubuntu/screenshots/r227_account_1280.png`、`r227_account_390.png`、`r227_invalid_email.png`、`r227_send_result.png`、`r227_retry.png`、`r227_quota_copy.png`。
# 第 226 轮（2026-08-11）：#228（哨兵三修）生产四测 ✅ **全部判据 PASS**——r225 P2（配额弹窗 /account 链接不跳）与 P3（孤儿哨兵占用一次返回）均已修复；单层弹窗 back 双通道、Esc/遮罩延迟回收、forward、快速切换 back、回归全过；pageerror 0

**环境**：生产真实 UI，entry 翻转 `index-BYArTfAJ.js` → `index-BRn1Rj39.js`（main 11889c7，#228 已部署；bundle grep 证实含 `seatmarkModalSentinel`）。

**结果**：
- T1 单层弹窗后退（双通道回归）：开「图片 PNG」弹窗（history.state.seatmarkModalSentinel=1）→ back：弹窗关、URL 仍 /studio、「共 3 条」在、哨兵清除；再 back 才离开到 /，forward 回来名单在。CDP `Page.navigateToHistoryEntry` 原生通道同过 — passed
- T2 配额弹窗 /account 链接（r225 P2 复测）：配额弹窗打开时**有哨兵**（sentinel=2，r225 时为 None）→ 点 /account 链接，URL 100ms 采样立即全程 /account、最终 pathname=/account — **passed（P2 已修复）**；从 /account 一次 back 直落 /studio（无孤儿死条目）、再 back 到会话起点，历史干净
- T3 Esc/遮罩关闭延迟回收（50ms）：两种关法后 history.state 均无哨兵号，一次 back 即离开 /studio、无多跳 — passed
- T4 弹窗态直接站内链接（r225 P3 复测）：导出弹窗开着点 /templates → 跳转成功；从 /templates back **一次**即透明跳过孤儿哨兵直落 /studio（sentinel=None、名单在），再 back 到 / — **passed（P3 已修复）**
- T5 back 关弹窗后 forward：80ms 采样全程 /studio、弹窗不重开、最终 state 无哨兵号、无 pageerror（孤儿哨兵被自动弹回原地，用户无感）— passed
- T6 快速切换（导出框关→配额框开）→ back 一次：配额弹窗关、URL 仍 /studio、哨兵清除；再 back 直接离开（无死条目）— passed
- T7 回归：/templates `?cat=event&q=桌牌` 返回保搜索词/分类/scrollY=500；无弹窗导航照常 — passed
- 叠层两层 ModalDialog 路径依旧不存在（与 r223/225 结论一致，本轮未列判据）。
- 全程 pageerror=0；storage 清理 + 全部测试 tab 关闭。
- 产物：`/home/ubuntu/r226_t1.py`、`r226_t2.py`；截图 `/home/ubuntu/screenshots/r226_dialog_open.png`、`r226_after_back1.png`、`r226_native_back.png`、`r226_quota_dialog.png`、`r226_account.png`、`r226_t6_back1.png`。
# 第 225 轮（2026-08-11）：#226 哨兵方案生产三测 ✅ 核心返回键拦截**生效**（单层弹窗 back 只关弹窗、URL 保持、名单在，双通道 2/2；Esc/遮罩关闭哨兵正确回收）❌ **新增 P2 回归**：配额引导弹窗内 /account 登录链接点击后不再跳转（2/2 复现，r223 该项 passed）；另有哨兵残留 P3；pageerror 0

**环境**：生产真实 UI，entry 翻转 `index-DvH8Q9XM.js` → `index-BYArTfAJ.js`（main cb7a17f，#226 已部署；bundle grep 证实含 `seatmarkModalDepth`）。

**结果**：
- T1 单层弹窗后退（核心）：/studio「共 3 条」→ 开「图片 PNG」弹窗（history.state.seatmarkModalDepth=1）→ history.back()：弹窗关、**URL 仍 /studio**、名单在、哨兵态清除；再 back 才真正离开到 /，forward 回来名单保持。CDP `Page.navigateToHistoryEntry` 原生返回通道同样通过（历史尾部可见同 URL 哨兵条目 /studio×2）— **passed（2/2 双通道）**
- T3 Esc/遮罩关闭哨兵回收：Esc 关与遮罩点击关后 history.state 均无 seatmarkModalDepth（哨兵被 history.back() 回收），随后**一次** back 即离开 /studio、无多跳 — passed
- T5 前进键（#226 特有风险）：back 关弹窗后 forward → 落回哨兵条目（URL /studio 不变、弹窗不重开、sentinel=1、名单在、无 pageerror），再 back 正常 — passed（如实记录：forward 存在一格「原地」条目，属方案固有）
- T4 弹窗内站内链接：**failed（P2 回归）**——配额引导弹窗（「今日无水印导出次数已用完」，注：此时 history.state 已无哨兵）内点 /account 链接，URL 100ms 采样全程 /studio、弹窗关闭、最终仍停 /studio，跳转**未发生**（2/2 复现；r223 同判据 passed）。疑因 chooseClean「关导出弹窗→开配额弹窗」过渡中 consumeSentinel 的异步 history.back() 与 RouterLink 的 router.push 竞态，popstate 取消进行中的导航，且弹窗快速切换时哨兵计数失衡。
- T4b 单层导出弹窗开着直接点站内链接（/templates）：跳转成功、弹窗关；但哨兵条目**残留**在历史（entries: /studio, /studio(哨兵), /templates）——从 /templates 按 back 需两次才能离开 /studio（第一次落在哨兵原地）— **P3 注记**（历史不干净，consumeSentinel 在路由已变时不回收）
- T2 叠层弹窗逐层关 — **untested**（「浏览全部」弹窗开启时侧栏扫码按钮被遮罩覆盖，产品仍无稳定两层 ModalDialog 叠加路径，与 r223 结论一致）
- T6 回归：/templates `?cat=event&q=桌牌` 进详情返回——URL 参数/搜索词/分类/scrollY=500 全恢复；无弹窗 /studio↔/ 往返名单保持 — passed
- 全程 pageerror=0；storage 清理 + 全部测试 tab 关闭。
- 产物：`/home/ubuntu/r225_t1.py`、`r225_t2.py`、`r225_t4b.py`、`r225_t4c.py`；截图 `/home/ubuntu/screenshots/r225_dialog_open.png`、`r225_after_back1.png`、`r225_native_back.png`、`r225_quota_dialog.png`、`r225_after_account_click.png`。

# 第 224 轮（2026-08-11）：代码变更轮说明——#226 弹窗返回键拦截二修（哨兵方案）

- `app/src/components/ui/ModalDialog.vue` 重写拦截：弃用 #225 的 popstate 时间戳 + router.beforeEach 守卫（r223 验收 P2 未生效）；改为打开时 `pushState({...当前state(含 position), seatmarkModalDepth: openStack.length}, '', 同URL)` 哨兵条目；popstate 落到 depth<openStack.length 的条目时关顶层弹窗；Esc/遮罩/程序关闭时若哨兵仍是当前条目则 history.back() 回收；无 router 守卫；SSR 判空。生产验收见第 225 轮。
# 第 223 轮（2026-08-11）：#225 弹窗返回键拦截生产验收 ❌ **核心判据 FAILED（P2）**——弹窗打开按后退仍整页跳走（4/4 复现，含 CDP 原生返回），守卫代码在 bundle 内但未生效；无弹窗导航/弹窗内链接/Esc 后关闭等回归项全过；pageerror 0

**环境**：生产真实 UI，entry 已翻转 `index-m3vMPIl7.js` → `index-DvH8Q9XM.js`（main 87afa16，#225 已部署；bundle grep 证实含 popstate 时间戳+beforeEach 守卫逻辑）。

**结果**：
- T1 单层弹窗后退（核心判据）：/studio 导入「共 3 条」→ 开「图片 PNG」导出弹窗 → 后退 → **URL 变为 /、弹窗随视图卸载**，与 r221 旧行为完全一致——期望「弹窗关、URL 仍 /studio」未发生。history.back() 三次独立会话 + `Page.navigateToHistoryEntry`（浏览器原生返回通道）各复现，4/4 全失败 — **failed（P2）**
- 根因分析（源码+实验取证）：vue-router 自身 popstate 监听在 app 初始化注册，先于 ModalDialog 守卫的时间戳监听；事件监听器之间存在 microtask checkpoint，router.beforeEach 在守卫更新 lastPopstateAt **之前**执行 → `Date.now()-lastPopstateAt>300` 恒真 → 放行。旁证实验：页内先手动 dispatch PopStateEvent 预热时间戳再 back，弹窗被关但历史错乱（落到 about:blank），说明 return false 后的 restore 路径同样有问题。建议改用「弹窗打开时 pushState 哨兵条目 + popstate 直接关顶层弹窗」的常规方案。
- T2 叠层弹窗逐层关 — **untested**（核心拦截未生效，叠层判据无意义；且 chooseClean 设计上先关导出框再开配额框，UI 无稳定两层 ModalDialog 叠加路径）
- T3（Regression）无弹窗导航照常：/studio↔/ back/forward 正常、名单保持「共 3 条」；/templates `?cat=event&q=桌牌` 返回保搜索词/分类/scrollY=500 — passed
- T4 弹窗内站内链接：置 `seatmark.clean-export-usage.v1` used=1（匿名日限 1）→「无水印导出（今日剩余 0 次）」→ 配额弹窗「今日无水印导出次数已用完」→ 点弹窗内 /account 链接正常跳转 /account（守卫不拦点击导航——本来也未生效）— passed
- T5 Esc 关弹窗后 back：Esc 只关弹窗、后续 back 正常走历史、无残留拦截 — passed（在守卫未生效前提下该项无区分力，如实注记）
- 全程 pageerror=0；storage 清理 + 全部测试 tab 关闭 — passed

**产物**：截图 `r223_dialog_open.png`/`r223_after_back1.png`（后退后已离开 /studio）/`r223_native_back.png`/`r223_quota_dialog.png`/`r223_account.png`；脚本 `/home/ubuntu/r223_t1.py`、`r223_t2.py`。已 message_parent 即时回报 P2。

# 第 222 轮（2026-08-11）：#225 弹窗返回键拦截（代码变更轮）

ModalDialog.vue 增加模块级 popstate 时间戳 + router.beforeEach 守卫：弹窗打开且本次导航由 popstate 驱动（300ms 窗口）时关顶层弹窗并取消导航（r221 T3 裁量项）。生产验收见第 223 轮——**结论：未生效（P2），需返工**。

# 第 221 轮（2026-08-11）：浏览器历史导航与状态完整性走查 ✅ 全部判据 PASS——/studio 后退/前进名单+模板保持、/templates 返回保搜索词+分类+滚动位（#79 回归）、导出弹窗后退为路由级后退但名单不丢、/seating 排座后退前进保持、分享长链页后退正常、刷新中断导出无残留可复导；pageerror 0

**环境**：生产真实 UI，entry `index-m3vMPIl7.js`（main df59d33）。SPA 历史由页内真实链接点击建立，后退/前进用 history.back()/forward()。夹具：`r221_roster.xlsx`（历史审计孙一/钱二/李三221，3 行）与 60 行版（中断导出用）。

**结果**：
- T1 /studio 导入+切模板→后退→前进：/→/studio 导入「共 3 条」→ 切「考号贴」（localStorage template id=examNo）→ back 回 /（正文 3244 字非白屏）→ forward 回 /studio，「共 3 条」+预览含孙一221+模板仍 examNo — passed
- T2 /templates 深度状态（#79 回归）：分类「会议活动」+搜索「桌牌」→ URL `?cat=event&q=桌牌` → 滚动 500 → 进详情 /templates/signage → back：URL 参数保持、搜索框值=桌牌、分类高亮（bg-brand-600）、scrollY 恢复 500（分毫不差）— passed
- T3 导出弹窗开着按后退：PNG 导出对话框打开态 back → 路由级后退回 /（弹窗随视图卸载，无 popstate 集成属预期）→ forward 回 /studio 名单仍「共 3 条」——**未丢名单，不定级**（如实记录：后退是整页路由跳走而非只关弹窗，属产品当前设计）— passed
- T4 /seating 排座后退→前进：12 人「完全随机」→ back 回 / → forward 回 /seating 网格与随机后逐座一致、localStorage arranged 保持 — passed
- T5 分享长链页后退：真实「复制当前模板分享链接」产出 `/studio#tpl=v1.…`（1209 字符，clipboard 钩子取证）→ 直开落地 /studio+hash+「导入名单」确认流程 → back 无卡死/无循环重定向、pageerror 0 — passed
- T6 刷新中断导出：60 行名单带水印逐张 PNG 导出至「已完成 2/60 张标签」进度态（截图）→ 立即 reload → 恢复后名单「共 60 条」完整（sessionStorage）、无残留 loading/弹窗、按钮可用 → 重新导出成功（toast「PNG 图片已生成」+ zip 落盘）— passed
- 全程 pageerror=0（6 个场景全部会话）；storage 清理 + 全部测试 tab 关闭 — passed
- 诚实注记：① 弹窗无 history/popstate 集成（全库 grep 0 命中），移动端用户在弹窗态按返回键会整页离开 /studio——名单不丢（sessionStorage+pinia），但体验上可考虑弹窗拦截后退（产品裁量，非缺陷定级）；② T2 首两次尝试因分类按钮文本含计数后缀（如「会议活动 54」）精确匹配失败，改 startsWith 后成功（测试脚本问题）；③ 导出实际由「带水印导出/无水印导出」按钮触发（「点击即开始导出」），模式行仅为选项——首次 T6 误点模式行未真正开始导出，已用 60 行名单+进度态截图复跑证实真中断。

**产物**：截图 `r221_studio_before_back.png`/`r221_back_home.png`/`r221_fwd_studio.png`/`r221_templates_back.png`/`r221_dialog_back.png`/`r221_share_landing.png`/`r221_mid_export.png`/`r221_after_reload.png`/`r221_reexport_done.png`；脚本 `/home/ubuntu/r221_t1b.py` 等；导出样本 `/home/ubuntu/r221_dl/`。收尾：storage 清理 + 全部测试 tab 关闭。

# 第 220 轮（2026-08-11）：/seating 行列边界形态走查 ✅ 全部判据 PASS——5×10 满座、溢出提示可见（非静默）、缩格后打印/桌贴与网格一致（40 人，溢出人被丢但有 amber 提示）、行列 clamp 1-20/1-16 生效、过道开关正常；pageerror 0

**环境**：生产真实 UI，entry `index-m3vMPIl7.js`（main a1644ec）。行列由真实键入（focus→select→逐字符键事件→Tab 触发 change，NumberField.vue:28-38）与 hover 加减按钮（aria-label=增大/减小，nudge:23-25）驱动，补上 r219 未覆盖的 NumberField 交互。夹具：50 人名单「边界审计001-050号220」。

**结果**：
- T1 5×10 满座：键入排=5/列=10 生效、「已输入 50 人 / 座位 50 个」、网格 0 个空座（'—'=0）、座 50=边界审计050号220 — passed
- T2 溢出（列 10→8=40 座<50 人）：amber 提示恰为「超出 10 人排不下，请增加行列数」（截图可见）；网格含 040 号、不含 041 号 — passed
- T3 缩格链路一致性：打印 PDF 恰含 40 个姓名单元（0 个空座标记，041-050 不在版）；桌贴联动 handoff rows=40、首=001 号/末=040 号、含 040 不含 041、行结构 {姓名,座位号:40,排:5,列:8,班级}——**溢出丢人有可见提示，非静默，不定级**（行为链路自洽）— passed
- T4 极端值 clamp：排数键入 0→回写 1、99→回写 20；列数 99→回写 16；上界 20 处点「增大」仍 20、下界 1 处点「减小」仍 1 — passed
- T5 过道：点「第 2-3 列间」+「第 7-8 列间」→ `.seating-aisle` 每排 2 个共 10 个、两按钮高亮（截图）；再点取消→归 0 — passed
- pageerror=0（两次会话）；storage 清理 + 全部 tab 关闭 — passed
- 诚实注记：① 打印 PDF 中姓名被座位卡 CSS 省略号截断（「边界审计001…」），无法在 PDF 文本层面做全名断言——以「40 个姓名单元 + 0 空座」计数断言 + 网格 DOM 040/041 断言 + handoff 全名断言三方交叉证实；② studio 数据表 DOM 不直接渲染全部行（「共 40 条」分页/摘要显示），040 号存在性由 sessionStorage `seatmark.workspace-roster.v1` 全量取证。

**产物**：`/home/ubuntu/r220_print.pdf`、截图 `r220_5x10_full.png`/`r220_overflow.png`/`r220_studio_40rows.png`/`r220_aisles.png`、脚本 `/home/ubuntu/r220_t1.py`。收尾：storage 清理 + 全部测试 tab 关闭。

# 第 219 轮（2026-08-11）：带真实名单的 /seating 排座全数据流隐私+功能取证 ✅ 名单零外发（34 条全量 CDP 取证 0 命中）；点选/键盘/拖拽换座全过；打印宿主与 PDF 含全部姓名；排座→桌贴联动名单一致且 handoff 键读后即删；清 storage 后确实清空；pageerror 0

**环境**：生产真实 UI，entry `index-m3vMPIl7.js`（main d6a84f0）。CDP `Network.requestWillBeSent` 全量捕获（Tab._ev 覆盖法，同 r218）。夹具：12 行「姓名 性别」名单（排座审计赵六219/钱七219…卫己219 + 一行假手机号 13900219001）+ 标题「排座审计219班」。敏感串 {排座审计, 赵六219, 13900219} × 5 种编码变体。

**链路**：/seating 粘贴名单（textarea 入口，产品无 Excel 导入）→ 预览网格渲染 12 人 → 点选换座（座1↔座12）→ 键盘 Enter 换座（座2↔座5）→ 真实鼠标事件拖拽换座（座3→座10，拖拽中 drop-target 高亮截图）→ 打印（toast + window.print 调起 + 打印宿主 48 座含全部姓名 + Page.printToPDF 取证）→「一键生成对应桌贴」→ /studio?from=seating。

**结果**：
- ① 名单零外发：全程 34 条请求 URL/body 敏感串（含编码变体）命中 **0**；/seating 本身零 API 调用（仅静态资源+遥测）— passed
- ② 换座功能：点选互换（排座审计赵六219↔13900219001，「已选中座位」提示可见）、键盘 Enter 互换（钱七219↔吴十219）、拖拽互换（孙八219↔褚戊219，拖拽中 `.seating-seat--drop-target` 高亮=1）三通道全部姓名级断言互换成功 — passed
- ③ 打印：toast「即将调起浏览器打印」可见、window.print 被调起（stub 取证）、打印宿主 `.offscreen-host` 48 座含全部 12 个姓名、Page.printToPDF 产出 A4 横向 PDF（pdftotext 证实 11 个审计姓名+手机号行+标题全部在版）— passed
- ④ 排座→桌贴联动：跳转 /studio?from=seating、数据表含「排座审计赵六219」且 座位号/排/列/班级 列齐全、`seatmark.seating-handoff.v1` 读后即删（=null）— passed
- ⑤ 持久化与清理：排座后 localStorage 仅 `seatmark.seating-state.v1`（含 namesText+arranged，1095B）；刷新后排座结果保留（座3=褚戊219 恢复）；clear 后 ls/ss 0 键、IndexedDB 仅 workbox-expiration、刷新后名单消失 — passed
- ⑥ pageerror=0（全程两次会话）— passed
- 诚实注记：a) 排数/列数经 JS input 事件注入**未生效**（NumberField 自有事件处理），网格保持默认 6×8=48 座——12 人排前 12 座，所有功能断言不受影响，但「4×3 满座」形态未覆盖（测试脚本注入方式问题，非产品缺陷）；b) 首次 printToPDF 取证晚于 afterprint 1.5s 兜底（printing.ts:23）致宿主已卸载 PDF 为空，按代码时序在 1.35s 窗口内复跑成功；c) headless 下 window.print 用 stub 取证「被调起」，真实打印对话框行为不可观测；d) 名单行含手机号时 parse 将其拆为独立座位名（parseSeatingRoster 设计行为，如实记录）。

**产物**：`/home/ubuntu/r219_all_requests.json`、`/home/ubuntu/r219_print.pdf`、截图 `r219_grid.png`/`r219_selected.png`/`r219_click_swapped.png`/`r219_drag_mid.png`/`r219_drag_swapped.png`/`r219_studio_handoff.png`/`r219_print_page.png`/`r219_after_clear.png`、脚本 `r219_t1.py`/`r219_t2.py`。收尾：storage 清理 + 全部测试 tab 关闭。

# 第 218 轮（2026-08-11）：隐私承诺全站网络外发审计 ✅ 名单数据零外发（106 条全量 CDP 网络取证敏感串 0 命中）；分享长链纯前端 hash、短码 POST 仅含模板 JSON（解码验证无名单）；存储清后确实清空；pageerror 0

**环境**：生产真实 UI，entry `index-m3vMPIl7.js`。CDP `Network.requestWillBeSent` 全量捕获（URL+POST body，含 GA4/百度统计/beacon），headless 1024×768。夹具：`r218_roster.xlsx`（姓名「隐私审计张三218/李四218/王五218」+ 手机号列 13800218001-003）+ 照片 `隐私审计张三218_PRIVAUDIT218.jpg`。敏感串匹配含原文 + URL 编码 + base64/base64url 变体。

**链路**：/studio?template=withPhoto（照片核验版）→ 导入 xlsx（3 行读取成功）→ 照片匹配列=姓名 → 上传照片（已导入 1 张，匹配 1/3 行，预览 data:URL 内联渲染，OCR 证实三个姓名可见）→ PNG 带水印导出（zip 3 张，含照片版复跑一次也零外发）→ 图片版 PDF 带水印导出 → /seating → 分享长链复制 + 微信扫码短码。

**结果**：
- ① 名单零外发：全程 106 条请求（另含带照片导出复跑 26 条）URL/body 对 6 个敏感串 × 5 种编码变体命中 **0**；无大 body 上传请求（照片 data:URL 仅存内存 Map，workspace.ts:150/153）— passed
- ② 分享机制：长链「复制当前模板分享链接」点击后**零网络请求**（纯前端 `#tpl=v1.<deflate+base64url>`，share.ts:59-67）；扫码短码有服务端 POST `/api/share/tpl`（body 1481B）——解码 payload 为模板 JSON（id=withPhoto，2937 字符），**不含任何名单行/姓名/手机号**，随后 GET 回读校验（生产 memory 存储下短码本轮回读成功返回 978f4af257）— passed
- ③ 存储清理：导入后名单仅存 sessionStorage `seatmark.workspace-roster.v1`（会话级，workspace.ts:171——localStorage `seatmark.workspace-template.v1` 只存模板不含名单，实测 localStorage 全键无敏感串）；clear 后 localStorage/sessionStorage 均 0 键、IndexedDB 仅 workbox-expiration（SW 缓存计时，无名单）、刷新后名单消失 — passed
- ④ pageerror=0（全部 tab）— passed
- ⑤ 合法遥测清单（如实记录实际外发字段）：GA4 `/g/collect`（tid/cid/sid/dl=页面完整 URL/dt=标题/en=page_view|user_engagement/sr/ul/UA client hints）；百度 `hm.gif`（si/hca/u=页面完整 URL/tt=标题/分辨率/语言/时间戳）+ `sp0.baidu.com/s.gif?l=站点URL`；无任何自定义维度携带用户数据 — passed
- 诚实注记：a) /seating 页不共享 /studio 名单（页面无敏感串渲染），排座为独立数据流，本轮仅验证其**无任何网络调用**（SeatingView.vue 0 fetch/beacon，运行时 27 条请求均为静态资源/遥测）；b) 长链剪贴板内容因 headless 焦点限制未直接读出，以「点击后零网络请求 + 已复制 toast + share.ts 纯前端实现」联合判定；c) 首轮照片匹配列点选失误致导出期照片未匹配，已复跑带照片导出补证（结果同零外发）。

**产物**：`/home/ubuntu/r218_all_requests.json`（106 条全量取证）、`r218_telemetry.json`、截图 `r218_preview_photo.png`/`r218_share_qr.png`/`r218_seating.png`/`r218_after_clear.png`、脚本 `r218_t1.py`~`t4.py`。收尾：storage 清理 + 全部测试 tab 关闭。

# 第 217 轮（2026-08-11）：#218 反馈默认企微 webhook 上线后单条回归 ✅ UI 侧全部 PASS（200 {"ok":true} + 成功 toast + payload 口径不变 + pageerror 0）；webhook 实际送达 untested-externally（企微群由老板确认）

**环境**：生产真实 UI，entry 仍 `index-m3vMPIl7.js`（#218 仅边缘函数改动）。代码依据：#218 diff edge-functions/api/feedback.js:21 `FEEDBACK_WEBHOOK_DEFAULT`（企微机器人，与 ai-design 告警同一常量）、:94 `env.FEEDBACK_WEBHOOK || FEEDBACK_WEBHOOK_DEFAULT`；前端 FeedbackButton.vue 不变。

**结果**：
- T1 标识反馈提交：右下浮动按钮 → 「意见反馈」→ 类型「其他」→ 内容「Devin 第 217 轮测试反馈，可忽略（#218 默认 webhook 验证）」→ 提交 → POST /api/feedback **200 `{"ok":true}`**、toast「感谢反馈！」截图可见、弹窗关闭 — PASS
- T1 payload 口径不变：keys 恰为 {contact,content,page,type}、type=other、page=/ — PASS
- webhook 送达企微群 — **untested-externally**（服务端推送外部不可观测，请老板在企微群确认这条「Devin 第 217 轮测试反馈」是否收到——收到即证 #218 端到端生效）
- 全程 pageerror 0；storage 清理 + 全部测试 tab 关闭 — PASS

**产物**：截图 `/home/ubuntu/screenshots/r217_filled.png`（填写态）、`r217_success.png`（成功 toast）；脚本 `/home/ubuntu/r217_t1.py`；计划 `test-plan-round217.md`。

---

# 第 215 轮（2026-08-11）：用户反馈通道全链路走查 ⚠️ 前端表单/XSS/提交链路全 PASS；两条注记：① IP 日限 10 次在生产**实测未生效**（15 次连续提交全部 200，memory 存储限频计数不持久）② 存档/webhook 不可持久或未配置时仍回「感谢反馈！已收到您的意见」——反馈可能实际丢失（诚实性注记，webhook 配置状态外部不可判定）

**环境**：生产真实 UI，entry `index-m3vMPIl7.js`。入口：全局右下浮动按钮（App.vue:85 挂载 FeedbackButton，aria-label=反馈）。代码依据：FeedbackButton.vue:49-79（POST /api/feedback，body={type,content,contact,page}）；edge-functions/api/feedback.js（校验/IP 日限 10/存档 fb: 前缀/可选 FEEDBACK_WEBHOOK/恒回 {ok:true}）。

**结果**：
- T1 正常提交：浮动按钮 → 弹窗「意见反馈」→ 选「问题反馈」填内容+联系方式 → 提交 → POST /api/feedback 200 `{"ok":true}`、toast「感谢反馈！已收到您的意见」（截图）、弹窗关闭表单重置 — PASS
- T1 payload 检查：keys 恰为 {type,content,contact,page}，page=当前路径，type=bug；无名单/localStorage 等意外数据 — PASS
- T2 空内容：提交按钮 disabled、点按零网络请求 — PASS
- T2 超长：JS 绕过 maxlength 注入 2001 字 → 前端 toast「反馈内容不能超过 2000 字」、零请求 — PASS
- T2 XSS：内容含 `<img onerror>`+`<script>` 提交 → 无 alert（JS dialog 0）、页面无注入节点、正常 200 提交、pageerror 0 — PASS（前端 v-model 纯文本无回显面；管理端 AdminView 渲染面需登录，本轮无法覆盖）
- T3 限频：连续 **15 次**成功提交（间隔 2.5s+，同 IP 同日）全部 200 `{"ok":true}`、无一次 429「今日反馈次数已达上限」——**限频在生产未生效**，与 `x-seatmark-storage: memory` 一致（rl:fb: 计数每个 isolate 独立/不持久）。另注：前端对非 200 一律显示「提交失败 请稍后重试」，429 具体文案不会透出给用户（UX 弱点，非缺陷级）
- 全程 pageerror 0；storage 清理 + 全部测试 tab 关闭 — PASS

**诚实性结论**：feedback.js 存档失败静默忽略 + 未配置 webhook 时仍回 {ok:true} → 生产 memory 存储下反馈**很可能实际丢失但用户看到成功**。是否构成虚假承诺取决于 FEEDBACK_WEBHOOK 是否已在 EdgeOne 配置（外部不可观测）；若未配置，建议列入运维项（与 KV/Blob 绑定同源）。

**产物**：截图 `/home/ubuntu/screenshots/r215_dialog.png`、`r215_submit_success.png`、`r215_overlong_warn.png`、`r215_xss_submit.png`；脚本 `/home/ubuntu/r215_t1.py`、`r215_t3.py`、`r215_t3b.py`；计划 `test-plan-round215.md`。

---

# 第 214 轮（2026-08-11）：#216 AI 设计文案降级验收 ✅ 全部 PASS（三处新文案上线、旧「开箱即用/无需配置/无需注册」0 残留、390px 不破版、demo 整页导出 md5 = r170 基线零回归）

**环境**：部署翻转确认 entry `index-zn4iqgIG.js` → `index-m3vMPIl7.js`（15s 二次采样一致）。生产真实 UI /studio?design=new → 「AI 自动设计」弹窗。代码依据：#216 diff AiDesignDialog.vue :102-105/:157/:173-176 三处文案。

**结果**：
- T1 三处新文案（DOM 精确子串 + 截图 OCR 证实可见）：①「免费通道依赖公共模型服务，繁忙时可能失败；有自己的 API 密钥时推荐「自定义 API」更稳定。」②按钮「免费通道 · 繁忙时限量」③「公共服务限量且不保证可用，失败时请稍后重试，或切换「自定义 API」用自己的密钥更稳定」— PASS
- T1 旧字样 0 残留：页面全文「开箱即用」「无需配置」「无需注册」计数均 0；bundle `index-m3vMPIl7.js` grep「开箱即用」= 0 — PASS
- T2 390×844 窄屏：弹窗正常打开（rect 宽 358 居中）、`scrollWidth=390=innerWidth` 无横向溢出、弹窗内 p/button 无逐元素溢出、截图文案完整 — PASS
- T3 demo 整页带水印导出（Regression）：page1 md5 `3e8fdf3e0c8530297998d8ad25623f21` = r170 基线逐位一致、page2 `1cede32f30…` = 既有基线 — PASS（注：首次导出 180s 内未捕获下载事件，重跑即成功——与 r208 同类监听时序问题，判定非产品缺陷，如实记录）
- 全程 pageerror 0；storage 清理 + 全部测试 tab 关闭 — PASS

**产物**：截图 `/home/ubuntu/screenshots/r214_dialog_new_copy.png`（1500px 弹窗新文案）、`r214_dialog_390.png`（390px 窄屏）；脚本 `/home/ubuntu/r214_t1.py`、`r214_t3.py`；导出样本 `/home/ubuntu/r214_dl/`；计划 `test-plan-round214.md`。

---

# 第 212 轮（2026-08-11）：AI 设计免费通道复测（#214/#215 上线后）❌ **免费通道仍全链路不可用**——/api/ai-design 502（服务端代理 Pollinations 亦被 402 拒）+ 浏览器直连 Pollinations 两档 402；#215 错误码透出生效；前端降级行为正常、可重试、pageerror 0

**环境**：生产真实 UI，/studio?design=new，entry 仍 `index-zn4iqgIG.js`（#214/#215 仅边缘函数改动）。测前已清 localStorage `seatmark.ai-config`（r209 发现的通道路由陷阱）。代码依据：edge-functions/api/ai-design.js:27-28/161-189（无密钥服务端代理 Pollinations openai/openai-fast，全败 502 并透出上游错误）；前端回退链 aiDesign.ts:240-258 不变。

**结果**：
- T1 免费通道真实 UI 重测（分支 B——仍不可用）：点「生成设计」→ 加载态「正在生成…」→ 64s 后报「免费通道暂时繁忙（HTTP 402：…deprecation_notice…）」。请求序列：
  1. POST /api/ai-design → **502**，响应体 `AI 服务暂时不可用，请稍后再试（openai: HTTP 402 …；openai-fast: HTTP 402 …）`——**#215 上游错误码透出生效**（对比 r209 的裸 501）；
  2. 浏览器直连 text.pollinations.ai/openai（openai）→ **402**；
  3. 同 URL（openai-fast）→ **402**。
- 402 响应体全文关键信息（浏览器与本机 curl 一致）：`deprecation_notice: The Pollinations legacy text API is being deprecated for authenticated users… Anonymous requests to text.pollinations.ai are NOT affected` + `details.error.message: "API key budget too low. This request costs ~0.0001 pollen, but this key has 0.0000"`——即 Pollinations 把该来源请求归到某个**余额为 0 的 key/租户**（非单纯匿名放行），且本机 curl（带/不带浏览器 UA+Origin）同样 402——lead 早前观测到的直连 200 未能复现，判定为间歇性/额度瞬时恢复，**不可依赖**。
- 前端降级体验：错误面板红字完整展示、不白屏、按钮恢复「生成设计」可重试 — PASS
- pageerror 0；storage 清理 + 测试 tab 关闭 — PASS

**结论**：#214 服务端代理与 #215 错误透出均按设计工作，但 Pollinations 匿名/legacy 通道当前对本 VM 与 EdgeOne 出口均 402（"key budget 0"），免费通道端到端仍不可用，维持 r209 P2。建议按预案做文案降级（「免费开箱即用」→ 如实提示可能繁忙/需自定义 API），或配置真实 AI key。

**产物**：截图 `/home/ubuntu/screenshots/r212_result.png`（最终错误态）、`r212_error_crop.png`；请求取证 `/home/ubuntu/r212_requests.json`；脚本 `/home/ubuntu/r212_t1.py`；计划 `test-plan-round212.md`。

---

# 第 208 轮（2026-08-11）：键盘-only 全流程可用性走查 ✅ 全部 PASS（skip-link/Hero CTA/模板搜索与卡片/SelectField 方向键/导出对话框 focus trap/耗尽弹窗/全键盘导出）

**环境**：生产 entry `index-zn4iqgIG.js`，CDP 1280×900 + Input.dispatchKeyEvent 真实键事件（rawKeyDown/keyUp），焦点可见性用聚焦/失焦裁片像素差与截图取证。代码依据：App.vue skip-link、HomeView.vue:252-271（CTA「开始生成标签」）、TemplatesView.vue:163/235、SelectField.vue:62-82、ModalDialog.vue:36-85。

**结果**：
- T1 首页：首个 Tab = skip-link「跳到主内容」且**可见**（裁片 1081 蓝底像素，非 sr-only 隐藏态）；Enter 后 activeElement=#main-content；第 13 个 Tab 到 Hero CTA「开始生成标签」（focus ring 像素差 934px），Enter → 路由 /studio — PASS
- T2 /templates：第 9 个 Tab 达搜索框，键入「桌牌」实时过滤（模板链接 224→27）；Tab 达首个模板卡（focus ring 截图），Enter → 进入 /templates/signage 详情 — PASS
- T3 /studio SelectField：trigger 上 ↓ 展开（aria-expanded=true）；↓ 在选项间移动焦点（未映射→姓名→班级，↑ 回姓名）；Enter 选中并关闭、焦点归还 trigger；Esc 关闭归还 trigger — PASS
- T3 导出对话框 focus trap：Enter 打开后连续 Tab 20 次 activeElement 20/20 始终在 [role=dialog] 内；Shift+Tab 从首元素回绕到最后一个（带水印导出按钮）；Esc 关闭且焦点归还到打开前的「图片 PNG」按钮 — PASS
- T3 全键盘带水印导出：Tab×7 达「带水印导出」→ Enter → 渲染 → toast「PNG 图片已生成（24 张标签打包为 zip）」+ 下载完成事件 — PASS（首次尝试 60s 内未见下载事件，重试即成功——判定为脚本下载监听时序问题，非产品问题，如实记录）
- T4 耗尽弹窗（used=1）：键盘打开导出框 → Tab×6 达「无水印导出（今日剩余 0 次）」→ Enter → QuotaLimitDialog 打开；Tab×10 全困于弹窗；Esc 关闭且焦点归还「图片 PNG」按钮 — PASS
- T5 无键盘陷阱：首页 40×Tab 39 个独立停靠零卡死；/studio 40×Tab 命中 40 个**互不相同**的 DOM 元素（signature 重复为同类连续 input，元素级验证无重复）；焦点 ring 全程可见（含 input-field 裁片）— PASS
- 全程 pageerror 0（所有 tab）；storage 清理 + 全部测试 tab 关闭 — PASS

**产物**：截图 `/home/ubuntu/screenshots/r208_skiplink_crop.png`、`r208_cta_focus_crop.png`（对照 `r208_cta_blur.png`）、`r208_templates_search.png`、`r208_template_card_focus.png`、`r208_select_open_option.png`、`r208_dialog_trap_focus.png`、`r208_watermark_btn_focus.png`、`r208_quota_dialog_focus.png`、`r208_studio_input_focus.png`；脚本 `/home/ubuntu/r208_kb.py`、`r208_t1.py`、`r208_t1b.py`、`r208_t3.py`、`r208_t3c.py`、`r208_t5.py`；下载样本 `/home/ubuntu/r208_dl/`；计划 `test-plan-round208.md`。

---

# 第 209 轮（2026-08-11）：设计器「AI 设计」全链路走查 ⚠️ **P2×1：生产免费通道全链路不可用**（/api/ai-design 501 + Pollinations 匿名 402）；前端错误路径/隐私承诺/clamp-应用-保存-导出管线全部 PASS（管线部分为 stub 验证）；自定义 API 成功路径 untested（无有效密钥）

**环境**：生产 entry `index-zn4iqgIG.js`。代码依据：入口 TemplateDesigner.vue:1402「AI 自动设计」→ AiDesignDialog.vue；通道 aiDesign.ts:240-261（free：/api/ai-design → pollinations openai/openai-fast，全败报「免费通道暂时繁忙（…）」）；自定义 :211-232；clamp :294-356；应用 TemplateDesigner:1055-1067。

**Escalation（P2，已即时回报）**：真实 UI 点「生成设计」（免费通道）→ ① POST /api/ai-design=**501**（EdgeOne 环境变量 DEEPSEEK_API_KEY/AI_API_KEY 未配置）→ ② 回退 text.pollinations.ai/openai 两档均 **402 Payment Required**（旧接口对匿名弃用，提示迁移 enter.pollinations.ai）→ 33s 后用户看到「免费通道暂时繁忙（HTTP 402…）」。弹窗宣称「免费通道开箱即用」但实际必然失败。修复方向：EdgeOne 配置 AI key（智谱 glm-4-flash 免费）激活 /api/ai-design，或适配 pollinations 新接口/调整文案（lead 裁量）。

**结果**：
- T1 免费通道真实行为：请求序列 501→402→402 与代码回退链一致；错误文案含「免费通道暂时繁忙」+ 引导重试/切自定义；弹窗不白屏、生成按钮恢复可重试 — 行为符合代码设计，但**通道本身不可用（P2）**
- T1 隐私承诺：三次请求 payload 均仅 {messages,temperature[,model]}（system 排版规则 + 字段名/示例值/尺寸/设计要求），demo 名单姓名（张伟/李娜/王强）0 处出现 — PASS
- T2 自定义 API 失败路径：无效地址 → 1.5s 内报「无法连接 AI 接口：请检查接口地址与网络（接口未开放浏览器跨域时也会失败）」，不白屏，重试再现同错 — PASS
- T3 clamp/应用/保存/导出（**stub /api/ai-design 响应验证前端管线**，含越界对抗 JSON：x=-5/width=999/fontSize=300/lineHeight=9/maxLines=99/padding=50/letterSpacing=9/label.radius=99/非法色 red/非法枚举）：应用后属性面板实测 X=0、Y=0、宽=60（=画布宽）、高=40、字号=120、最多行数=6、内边距=10、字距=2、标签圆角=20——全部 clamp 到边界；toast「AI 设计已生成」；保存为自定义模板「AI设计测试r209」成功并出现在模板选择器；demo 数据下逐张 PNG 导出成功（18 张 zip，首张 1000×667 非白 97k、行剖面含 hero 区/提示带 #f1f5f9 底色区）— PASS
- T3 注记：导出标签 OCR 未能识别出文字（像素结构与设计带位一致，判「渲染非空且版式吻合」而非字符级证实）；字段列表点选第二字段未成功，id 去重仅代码路径未 UI 级证实；自定义通道**成功**路径 untested（DEEPSEEK_API_KEY/DEEPSEEK_KEY 均 Insufficient Balance、LLM_RELAY_API_KEY 无效，lead 确认无其他 key）
- 陷阱记录：AiDesignDialog 的 saveAiConfig 会把「自定义 API」配置持久化到 localStorage `seatmark.ai-config`——切过自定义后再测免费通道必须先清该键，否则生成走自定义通道
- 全程 pageerror 0；storage 清理 + 全部测试 tab 关闭 — PASS

**产物**：截图 `/home/ubuntu/screenshots/r209_free_channel_error.png`、`r209_custom_invalid_error.png`、`r209_dialog_open.png`、`r209_free_loading.png`、`r209_stub_applied.png`、`r209_stub_canvas.png`、`r209_saved.png`、`r209_custom_template_selected.png`、`r209_export_page1.png`（导出首张标签）；payload 取证 `/home/ubuntu/r209_payloads.json`；脚本 `/home/ubuntu/r209_t1b.py`、`r209_t1c.py`、`r209_t3c.py`、`r209_t3d.py`；导出样本 `/home/ubuntu/r209_dl/`；计划 `test-plan-round209.md`。

---

# 第 207 轮（2026-08-11）：#211 匿名配额 used 负值/NaN clamp 复测 ✅ 全部 PASS（r205 P4 闭环）；⚠️ 口径勘误：QUOTA_ANON_DAILY 仍=1，非任务描述的 3

**部署**：entry `index-DOR0it5-.js`→`index-zn4iqgIG.js`（15s 二次采样一致）。代码依据 origin/main eb7b390（quota.ts:22-36）：loadLocalUsage 增加 `Number.isFinite(parsed.used)` + `Math.max(0, Number(parsed.used))` clamp。**勘误**：任务描述称「应显示今日剩余 3 次（QUOTA_ANON_DAILY=3）」，但源码 quota.ts:8 与 edge [[default]].js:48 均仍为 1——本轮按 1 判定（used=-5 → 剩余 1；修复前 r205 实测显示 6）。

**结果**：
- T1 负值 clamp（核心）：used=-5 刷新后角标=「今日剩余 1 次」（OCR 证实，不再是 r205 的 6 次）；实导第 1 次无水印成功（used→1、角标「带水印免费」），第 2 次点无水印零下载 + QuotaLimitDialog「今日无水印导出次数已用完」（OCR 证实）— PASS
- T2 容错：used=null（NaN 序列化）/ used="abc" / value=垃圾串 / 删除键 → 均按 0 计（剩余 1）、页面正常渲染、pageerror 0 — PASS
- T3 回归：used=0 起——「取消导出」toast「已取消导出|本次未扣除无水印次数」且 used 仍 0；随后无水印导出成功 used→1；再点无水印弹耗尽弹窗零下载；`{date:昨日,used:99}` 刷新后角标回「今日剩余 1 次」（跨日重置，OCR 证实）— PASS
- 全程 pageerror 0；storage 清理 + 全部测试 tab 关闭 — PASS

**产物**：截图 `/home/ubuntu/screenshots/r207_neg5_badge.png`（🟢 clamp 后剩余 1，对照 r205 `r205_tamper_neg5.png` 🔴 剩余 6）、`r207_neg5_exhaust_dialog.png`、`r207_dayreset_badge.png`；脚本 `/home/ubuntu/r207_t1.py`；导出样本 `/home/ubuntu/r207_dl/`；计划 `test-plan-round207.md`。

---

# 第 205 轮（2026-08-11）：「分享送次数」链路 + 配额边界走查 ✅ 匿名侧全链路通过；⚠️ P4×1（used 负值未 clamp，角标可显「今日剩余 6 次」）；服务端赠送/IP 去重因登录不可用+storage=memory 维持 untested

**环境**：entry 仍 `index-DOR0it5-.js`（#209 纯文档，无部署变化）。代码依据：quota.ts（QUOTA_ANON_DAILY=1、key `seatmark.clean-export-usage.v1`）、PreviewArea.vue:452-501（chooseClean 统一闸门、consumeQuotaAfterSuccess 成功后计次）、App.vue:32-49（?ref= 上报+横幅+清参）、edge-functions [[default]].js:710-746（sharevisit IP+日去重）。

**结果**：
- T1.1 匿名配额消耗：新 tab 角标「今日剩余 1 次」→ 无水印整页 PNG 导出成功 → localStorage `{date:今日,used:1}`、角标变「带水印免费」— PASS
- T1.2 耗尽后再点无水印：零下载，QuotaLimitDialog 打开，OCR 证实标题「今日无水印导出次数已用完」+ 价值阶梯（登录每天 3 次 / 分享被点开 1 次再 +1 次（每日最多 10 次）/ 带水印永远免费）+ 未登录 CTA「登录后可分享送次数」（无复制链接按钮，符合代码）— PASS
- T1.3 被分享落地（?ref=abcdef12 合法格式）：POST /api/share/visit 发出 ×1；欢迎横幅可见（OCR「同事向你推荐了 SeatMark 座签…一键开始（含演示数据）」）；URL ref 参数被清除（location=https://www.seatmark.cn/）；非法格式（10 位 hex）0 请求、无横幅 — PASS
- T1.4 API 表面：POST /api/share/visit code=abcdef12 → 400 `{"error":"分享码无效"}`（响应头 `x-seatmark-storage: memory`）；二次同响应。**服务端赠送生效、IP+日去重、配额角标回升 — untested**（需登录用户产生真实分享码：SES 未配置无法登录；且生产 KV 为 memory，码不持久）
- T2.1 耗尽态通道一致性：PNG（逐张模式）、图片版 PDF、打印/矢量 PDF 三通道点「无水印」均只弹 QuotaLimitDialog、零下载零打印（三份截图逐字节一致）；带水印 PNG 照常成功 — PASS
- T2.2 取消不扣次（#74 回归）：无水印导出中点「取消导出」→ toast「已取消导出 本次未扣除无水印次数」、无下载、used 仍 0、角标仍「今日剩余 1 次」；随后正常无水印导出成功扣至 used=1 — PASS
- T2.3 localStorage 篡改容错（改后刷新）：used=999 → 角标「带水印免费」不白屏；垃圾串/删除键 → 按当日 0 次（剩余 1）；**used=-5 → 角标「今日剩余 6 次」（OCR 证实）**——Math.max(0, 1-(-5))=6，负值未 clamp 到 QUOTA_ANON_DAILY，本地可刷出 6 次无水印。**P4**（仅影响自改 storage 的用户，服务端登录口径不受影响；如要修可在 loadLocalUsage 增加 used=Math.max(0,used)）— 记录
- T2.4 日重置：date=昨天+used=1 → 刷新后角标回「今日剩余 1 次」— PASS
- T3 文案一致：角标「今日剩余 1 次」= 导出弹窗「无水印导出（今日剩余 1 次）」+「取消不扣次数」说明 = QuotaLimitDialog 阶梯 = /pricing（每日 1 次/登录 3 次/分享+1 均在）— PASS
- 全程 pageerror 0（10+ tab）；storage 清理 + 全部测试 tab 关闭 — PASS

**产物**：截图 `/home/ubuntu/screenshots/r205_quota_dialog.png`、`r205_share_welcome.png`、`r205_channel_png_blocked.png`、`r205_channel_print_blocked.png`、`r205_cancel_no_deduct.png`、`r205_tamper_neg5.png`、`r205_export_choice.png`、`r205_pricing.png`、`r205_badge_exhausted.png`；脚本 `/home/ubuntu/r205_t1.py`、`r205_t1b.py`、`r205_t1c.py`、`r205_t2.py`、`r205_t2b.py`、`r205_t2c.py`、`r205_t3.py`；计划 `test-plan-round205.md`。

---

# 第 204 轮（2026-08-11）：#208 持续性截断补修线上回归 ✅ 全部 PASS（正常链路零回归、稀疏尾页零误杀、10 次新 tab 首次导出零坏页零拦截）

**部署**：entry `index-5Z5OXi4o.js`→`index-DOR0it5-.js`（15s 二次采样一致）。代码依据 commit 50f6f65：`renderOnce(mode:'strict'|'final')`；final 检出截断形态时 `domExpectsRightInk(el)`（非空 `.label-box`/`.sheet-watermark` 右缘越 70% 宽）→ 抛「页面渲染不完整（右侧内容未绘出），请重新导出」终止；DOM 右侧本无内容 → 放行。

**结果**：
- T1 正常链路零回归：demo 整页带水印 PNG page1 md5=`3e8fdf3e0c8530297998d8ad25623f21`（r170 基线逐位一致）、page2=`1cede32f30…`；逐张 24 张（001 非白 38061）；图片版 PDF 2 页 A4、栅格非空白（21687/10878）；pageerror 0 — PASS
- T2 稀疏尾页零误杀（r202 夹具 25 行 deskName → 第 2 页仅 1 枚左上标签）：
  - 带水印导出成功、成功 toast、无「渲染不完整」类报错；page1 681679/`3625e3196e…`、page2 410440/`8e8750ee5a…`（与 r202 正常参考逐位一致）；p2 OCR 左上=「班级 五年级(1)…学生17 学号 2023050117」内容正确；p2 右 40% 非白 116230（水印墨迹→合法稀疏页不满足截断形态，#208 分支不误触）；耗时 3.21s — PASS
  - 无水印口径（今日剩余 1 次）：成功，page1 621068/`9d50e34475…`、page2 375305/`31a4695840…`（= r202 参考），耗时 1.43s、无报错 — PASS
- T3 复现场景采样（新 tab 导入 25 行名单→首次整页带水印导出 ×10，每次全新 tab）：**10/10 正常下载**——每页右 40% 非白 >0、page1 非白恒 681679、两页 md5 恒 `3625e3196e…`/`8e8750ee5a…`；渲染耗时 1.82–1.96s（无重试特征）；成功 toast；console 无未捕获错误；新报错文案「页面渲染不完整（右侧内容未绘出），请重新导出」出现 0 次（属预期可接受结果之一）；**静默坏页 0 次** — PASS
- 全程 pageerror 0（12+ tab）；storage 清理 + 全部测试 tab 关闭 — PASS

**结论**：#208 上线后本轮未再观测到静默坏页（r202 为 1/16 同形态导出），稀疏尾页零误杀成立，正常链路 md5 逐位无回归。注：本轮 10 次采样未触发截断本身（该缺陷本就低概率、非确定性触发），故「拦截报错→终止」的 final 分支在线上未被实际驱动——只能证明「无误杀、无回归」，不能正面证明拦截路径生效（生产 devForcedExportFailure 钩子仍被 DEV 关闭，无法确定性驱动；维持 r202 的观测受限注记）。

**产物**：日志 `/home/ubuntu/r204_log_t3.json`；脚本 `/home/ubuntu/r204_t1.py`、`r204_t2.py`、`r204_t3.py`；导出样本 `/home/ubuntu/r204_dl/`；夹具 `/home/ubuntu/r202_25rows.xlsx`；计划 `test-plan-round204.md`。

---

# 第 202 轮（2026-08-11）：#207 整页导出截断页检测线上回归 ⚠️ 正常链路/稀疏尾页/扰动全过，但**修复后仍捕获 1 次截断页被静默交付**（P2/P3 裁量）

**部署**：entry `index-DbXPcBBk.js`→`index-5Z5OXi4o.js`（15s 二次采样一致）。

**结果**：
- T1 正常链路零回归：demo 整页带水印 PNG page1 md5=`3e8fdf3e0c…`（r170 基线逐位一致）、page2=`1cede32f30…`；逐张 24 张（001 非白 38061）；图片版 PDF 2 页 A4、栅格非空白 — PASS
- T2 稀疏尾页不误杀（25 行 deskName → 第 2 页仅 1 枚左上标签）：
  - 带水印导出成功、无「疑似渲染不完整」报错；page2 非白 410440、OCR 左上=「学生17…」标签内容正确（25 行按列序分页，尾页为第 17 号所在页布局，内容与名单一致）；成功 toast 正常 — 尾页不误杀判据 PASS
  - 无水印口径（今日剩余 1 次）同判据 — PASS（page1 621068 / page2 375305）
  - **⚠️ 但同一次带水印导出的 page1 被截断交付**：非白像素 164136、墨迹 bbox x∈[0,1062]、右 40% 非白=0、OCR 仅水印——与 r199/r200 空白页同形态（因名单不同 md5 不同：`17161f71b4…`）。**导出无任何报错、toast 显示成功**——#207 上线后截断页仍被交付一次。该次总渲染耗时 2.78s（正常同场景 1.87–1.93s，+0.9s 与「strict×2+rebuild 后宽松放行」的重试链耗时吻合）→ 推断：截断在重试与 rebuildHost 后**持续存在**，末次宽松渲染按设计只查空白、放行了截断页。
  - 复现尝试：同场景（新 tab 导入 25 行→首次带水印整页导出）加 MutationObserver 计 offscreen-host 挂载 ×5 — 全部正常（mounts=1、无 rebuild、md5 恒 `3625e3196e…`/`8e8750ee5a…`）。
- T3 扰动变体 10 次（r200 复现法：容器滚底+渲染期窗口抖动）：10/10 产物 page1 非白 661794（>300k 判据全过）、md5 全 = 基线；console 无未捕获错误 — PASS
- 全程 pageerror 0；storage 清理 + 全部测试 tab 关闭 — PASS

**结论与定级建议**：#207 的判据与重试链对「一过性截断」有效（本轮扰动/压测零坏页），稀疏尾页宽松放行不误杀也成立；但对「持续到 rebuild 后仍截断」的场景，末次宽松渲染会按设计交付截断页——本轮实测发生 1 次（发生场景与 r199/r200 相同：某 tab 状态下的首次整页导出）。建议维持 **P3（偏 P2）**：修复方向可考虑末次宽松渲染仍检出截断时改为**报错终止（不扣配额、提示重试）**而非静默交付，或 rebuild 后增加一次延时重渲。注：生产构建 devForcedExportFailure 注入钩子被 `import.meta.env.DEV` 关闭，无法在线上直接驱动重试链做确定性验证。

**产物**：截断产物 zip `/home/ubuntu/r202_dl/37d1a440-11c1-4a13-80d6-1d081e18a8c0`；截图 `/home/ubuntu/screenshots/r202_wm_p1_topleft.png`（🔴 截断 page1 左上，仅水印）、`r202_sparse_p2_topleft.png`（🟢 稀疏尾页正常标签）、`r202_wm_p1_thumb.png`；日志 `/home/ubuntu/r202_log_t3.json`；脚本 `/home/ubuntu/r202_t1.py`、`r202_t2.py`、`r202_t2b.py`、`r202_t3.py`；夹具 `/home/ubuntu/r202_25rows.xlsx`；计划 `test-plan-round202.md`。

---

# 第 200 轮（2026-08-11）：整页导出空白观察项压测排查（无代码变更前置，entry `index-DbXPcBBk.js`）⚠️ 复现 1 次（合计 2/70），空白页字节级确定性、可逃过空白检测——建议定级 **P3（偏 P2 裁量）**

**测法**：生产 /studio?template=deskName&demo=1，带水印整页 PNG，每次校验 zip 两页非白像素（<200 灰度，正常 [661794, 361149]）与逐页 md5；全程采集 console/exception/network（Runtime + Network 事件）与下载时序。

**结果**：
- T1 30 次基线压测（同 tab 连续）：30/30 正常，page1 md5 每次都= r170 基线 `3e8fdf3e0c…`、page2 md5 恒定 `1cede32f30…`；渲染耗时稳定 1.57–1.75s（首个 2.64s）；console/network 零异常事件 — PASS
- T2 10 次扰动变体：**第 1 次（预览容器滚到底后立即导出 + 渲染期窗口滚动抖动）复现 BLANK**——page1 非白像素 163768（正常 661794），page2 正常。其余 9 次（含同款 scroll、zoom 双击、导出点击前滚动）全部正常。
- T3 定向排查（复现后加测 17 次，均未再中）：
  - rAF 循环钉住窗口 scrollTop=600 贯穿导出 ×3 — 正常；
  - 每帧窗口滚动抖动 0↔1500 贯穿导出 ×5 — 正常；
  - 每帧预览容器滚动抖动 ×5 — 正常；
  - 复刻 r199 场景（二次 attach + 容器预滚 + 立即导出）×3 — 正常；
  - 钉住滚动的对照导出 ×1 — 正常。
- 全程 pageerror 0（所有 tab）；storage 清理 + 全部测试 tab 关闭 — PASS

**关键取证（异常产物特征）**：
1. **字节级确定性**：本轮空白 page1 md5 = `52e62a47bbfbae41a51373d46bf91714` 与 r199 那次**逐字节一致**（两次独立发生、不同日内不同会话）——不是随机噪声，是一条确定的失败渲染路径。
2. 只坏第 1 页：两次事件 page2 均正常（r199 组合口径 page2、r200 默认口径 page2 各自正常）。
3. 异常页内容：仅水印文字 + 墨迹集中在左缘 x∈[0,1063]（首 250px 列 99913 px，x>1250 全白）——html2canvas 输出画布尺寸正确（2481×3509）但绘制不完整。
4. **为何逃过产品自检**：pdfExport.ts:112 `isCanvasBlank` 只采样画布左上 96×128 角——异常页左缘恰有墨迹，空白检测判「非空白」，:571 的重试/rebuildHost 兜底全部未触发，静默产出坏页。
5. 复现时 console/exception/network 事件为零、无 pageerror。

**定级建议**：P3（发生率低：2/70≈2.9%，rule of three 95% 上界 ≈6.3%；重导一次即恢复）。若按「静默产出不可用产物且用户无提示」口径可升 P2。**修复线索**：`isCanvasBlank` 改为多点采样（四角+中心）或统计全图非白像素占比，可把该失败转化为既有重试路径自动恢复；根因疑与预览容器滚动状态下 html2canvas 克隆窗口的绘制截断有关（复现需滚动扰动，但非充分条件）。

**产物**：异常 zip `/home/ubuntu/r200_dl/16563943-*`（+r199 的 `/home/ubuntu/r199_dl/1af7ec03-*`）、正常对照若干；日志 `/home/ubuntu/r200_log.json`、`r200_log_perturb.json`；截图 `/home/ubuntu/screenshots/r200_blank_leftstrip.png`（🔴 异常页左缘）vs `r200_normal_leftstrip.png`（🟢 正常页同区域）；脚本 `/home/ubuntu/r200_stress.py`、`r200_perturb.py`、`r200_determ.py`、`r200_thrash.py`、`r200_attach.py`；计划 `test-plan-round200.md`。

---

# 第 199 轮（2026-08-11）：组合字段 UI 全流程 + 微信 UA 引导浮层（补第 196 轮两项 untested；无代码变更前置）✅ 两大项全部 PASS；另记 1 次未复现的整页导出空白异常（观察项）

**前置**：entry 仍为 `index-DbXPcBBk.js`（#205 无产品代码变更）。生产 /studio 真实 UI（CDP headless），pytesseract（chi_sim，本轮新装 tesseract-ocr + tesseract-ocr-chi-sim）做导出产物 OCR 取证。

**结果**：
- T1 组合字段全流程（/studio?template=deskName&demo=1，班级字段）：
  - ① 编辑交互：下拉「自定义组合…」→ 编辑器出现（placeholder「如：第{考场}考场-{座位号}号」+ 8 个「+ 列名」chips）；用「第」+chips+「·」拼装出 `第{班级}·{姓名}` → 「应用组合」可点；应用后字段行下方 `code` 显示模板串 + 「编辑」按钮 — PASS
  - ② 预览渲染：首卡班级字段=「第五年级（1）班·张伟」（=第{班级值}·{姓名值} 逐字符一致），4 卡抽查均正确拼接 — PASS
  - ③ 导出一致：同 tab 先控制导出（默认映射）再组合导出，整页 PNG numpy diff **仅限 8 条窄带**（每标签班级行，319–3085px 均匀分布），姓名/学号零变化；OCR 导出裁片=「班级 第五年级 (1) 班·张伟」与预览一致 — PASS
  - ④ 刷新恢复：F5 后 mapping 仍为 `第{班级}·{姓名}`、下拉显示「自定义组合…」、code/预览不变（sessionStorage roster 持久化实证）— PASS
  - ⑤ 容错：`{不存在的列}` → amber 提示「模板需至少引用一个 {列名}，且引用的列必须存在于当前表头」+「应用组合」disabled；空模板同样 disabled；编辑后「取消」不改原映射；无白屏 — PASS
  - ⑥ 空列处理（导入含空单元格 xlsx，组合 `{班级}·{备注}`）：空值行渲染「三年二班·」——空串处理、无 `undefined`/`{列名}` 字面 — PASS
- T2 微信 UA 引导浮层（Emulation.setUserAgentOverride 含 MicroMessenger/8.0）：
  - 首页浮层出现：`role=dialog aria-label=微信内浏览提示`，OCR 截图证实「你正在微信中打开 SeatMark」「无法下载 PDF 文件」「在浏览器打开」+右上角箭头 — PASS
  - 点「我知道了，继续浏览」→ 浮层消失、`seatmark.wechat-guide-seen.v1`='1'；同会话路由到 /studio 不再出现；页面可正常操作 — PASS
  - 新 tab（新会话、同 UA）/studio 浮层再次出现（会话级）；非微信 UA 对照全程无浮层 — PASS
- 全程 pageerror 0（8 个 tab）；storage 清理 + 全部测试 tab 关闭 — PASS

**观察项（未复现，暂不定级）**：第 1 次组合导出（复用已开过组合编辑器的 tab、export 前做过 clip 截图）得到的整页 zip 两页仅有水印、标签全空（非白像素 163k/357k vs 正常 654k/661k）；随后以完全相同步骤（含 clip 截图步骤）+ 同 tab 连续 3 次 + 静置 120s 后共 7 次导出全部正常。1/8 发生率、无 pageerror、无法复现——记录产物（`/home/ubuntu/r199_dl/1af7ec03-*`）备查，若用户侧出现「导出整页空白」反馈可回溯此线索。

**产物**：截图 `/home/ubuntu/screenshots/r199_*`（composite_editor_open/invalid/applied、preview_composite、export_control_label1 vs export_composite_label1、empty_col、wechat_overlay/dismissed/studio_newsession）；导出 `/home/ubuntu/r199_dl/`；脚本 `/home/ubuntu/r199_t1b.py`、`r199_t1c.py`、`r199_t1d.py`、`r199_repro.py`、`r199_flake.py`、`r199_t2.py`；夹具 `/home/ubuntu/r199_empty.xlsx`；计划 `test-plan-round199.md`。

---

# 第 198 轮（2026-08-11）：#204 教程数字修正线上复测 ✅（4 落点新文案全部上线、旧数字全部消失；demo 整页导出 md5 仍 = r170 基线逐位一致；pageerror 0）

**部署**：entry `index-BmwKWsHK.js`→`index-DbXPcBBk.js`（15s 二次采样一致）。

**结果**：
- T1 4 落点（curl 生产预渲染 HTML，均 200、canonical 正常）：
  - `exam-seat-label-batch-print`：含「200 多款免费模板」×1，「20 款免费模板」0 处 — PASS
  - `online-label-tools-review`：含「200 多款」×1，「61 款」0 处 — PASS（注：lead 所指 guidesRound2 落点实为 guides.ts 的本篇 + guidesRound2 的 exam-system-vs-seatmark，slug「school-seat-arrangement-tool」不存在，已按 #204 源码 diff 定位 4 处）
  - `exam-system-vs-seatmark`：含「200 多款」×1，「61 款」0 处 — PASS
  - `sticker-paper-size-picker`：含「70×42.4 mm」×1，「42.3」0 处 — PASS
- T2 导出回归冒烟：/studio?template=deskName&demo=1 整页导出（带水印、先读模式字段避记忆陷阱）md5 = `3e8fdf3e0c8530297998d8ad25623f21` = r170 基线逐位一致 — PASS（教程数据变更不影响导出实证）
- T3 全程 pageerror 0；storage 清理 + 全部测试 tab 关闭 — PASS

**产物**：`/home/ubuntu/r197_dl/`（demo 整页 zip）、脚本 `/home/ubuntu/r197_t2.py`、计划 `test-plan-round197.md`。第 196 轮 P3×2 + P4 全部闭环。

---

# 第 196 轮（2026-08-11）：教程站 76 篇全量质检（新角度走查，无代码变更前置）✅ 结构/链路/CTA/图片/pageerror 全过；事实性抽查发现 2 处 P3 过时数字 + 1 处 P4 尺寸笔误

**范围与方法**：entry 仍为 `index-BmwKWsHK.js`（无部署变化）。用 tsx 从源码（guides.ts 25 + Round2 17 + Round3 2 + Round4 18 + Round5 4 + Round6 10 = 76 篇）dump 权威 slug/quickStart/body；curl 全量抓取生产预渲染 HTML 逐篇断言；浏览器（CDP headless）做 15 次真实 CTA 点击、76 篇 SPA 路由遍历（图片加载 + 网络失败 + pageerror 采集）与产品事实真值取证。

**结果**：
- T1 元数据 76/76 全过：HTTP 全 200；title/description 与源一致；canonical 全部 = `https://www.seatmark.cn/guides/<slug>`；JSON-LD（`data-route-jsonld`，Article + BreadcrumbList，另按篇 HowTo/FAQPage）可解析、URL 含本篇 slug、howTo/faqs 与源数据一一对应。
- T2 内链全过：正文+related+quickStart 提取站内路径去重 150 条，逐条 200、0 死链；锚点链接 0 条（无死锚点问题面）；站外链接 0 条（仅记录口径下无可记录项）。
- T3 quickStart CTA：76 篇全部带 quickStart。静态：68 篇指向 /studio 且 template 参数全部命中模板库 222 个 id（100%）；其余 8 篇指向 /seating（4）与 /papers（4），均 200，属排座/纸型合法入口。动态：15 篇真实点击（12 个不同模板 + /seating×2 + /papers×1）全部落地正确、workspace 当前模板 id == 参数、demo=1 篇目名单非空（18–26 行）——15/15 PASS。
- T4 事实性抽查（10 篇）：产品真值——/papers 实际 17 种纸型、/templates 实际「222 款」、导出角标实测「今日剩余 1 次」（`QUOTA_ANON_DAILY=1`，带水印/打印不限次）、standard 模板 3 列 × 8 行 = 24 枚 60×32 mm、纸型库 a4-1up…a4-65up-round、分享送次数 API（share/visit IP+日去重）均与教程口径吻合。**发现 3 处偏差**：
  - **P3**：`exam-seat-label-batch-print` 称「SeatMark 内置了 20 款免费模板」——实际 222 款（过时数字）。
  - **P3**：`exam-system-vs-seatmark` 称「61 款模板」——实际 222 款（过时数字）。
  - **P4**：`sticker-paper-size-picker` 称 21 枚为「70×42.3 mm」——纸型库实际 70×42.4 mm（0.1mm 笔误）。
  - 注：`wechat-browser-print-guide` 的「微信内自动弹出引导浮层」未在微信 UA 下实测（headless 无微信环境）——untested；`composite-field-template-string` 的「自定义组合…/{列名} 模板串」仅代码面证实（MappingPanel.vue COMPOSITE_OPTION），未走 UI 全流程。
- T5 图片：76 篇遍历 0 个加载失败 `<img>`、0 个 ≥400 网络响应、0 个 loadingFailed（正文 body 源码本身 0 个 `<img>`，页面级图标/资源全部正常）。
- T6 全程 pageerror 0（含 15 次 CTA 点击与 76 篇遍历）；收尾已清 storage 并关闭全部测试 tab。

**问题清单（P 级）**：P1 无；P2 无；P3 ×2（模板数量过时：20 款、61 款 → 应为 222 款或改为不写死数字）；P4 ×1（21 枚纸型 42.3→42.4 mm）。

**产物**：脚本 `/home/ubuntu/r196_t1.py`、`r196_t1b.py`、`r196_t2.py`、`r196_t3.py`、`r196_t56.py`、`r196_t4.py`、dump `/home/ubuntu/r196_guides.json`、`r196_template_ids.json`、结果 `r196_t3_results.json`；截图 `/home/ubuntu/screenshots/r196_quota_badge.png`、`r196_papers.png`。计划 `test-plan-round196.md`。

---

# 第 195 轮（2026-08-10）：#202 回退 html2canvas-pro 2.3.2→2.0.4 线上验证 ✅（三判据全中：demo 整页 PNG md5 逐位回到 r170 基线 `3e8fdf3e…`、𱁬 逐张 009.png md5 逐位回到 r188 基线 `eb4eb7bd…`、姓名对齐 4x 比值回到 0.6351（≈2.0.4 基线 0.635、预览 0.639）——r192 发现的 P3 上移偏差闭环、所见即所得恢复；pageerror 0）

**部署**：entry `index-DzDe9l0M.js`→`index-BmwKWsHK.js`（回到 r191 时的 2.0.4 构建 hash，15s 二次采样一致）。

**结果**：
- T1 demo 整页 PNG（带水印）md5=`3e8fdf3e0c8530297998d8ad25623f21` = r170 基线逐位一致 — PASS
- T2 r180 名单逐张 009.png（王𱁬明）md5=`eb4eb7bd8dafd597b0c86d57ff83bf32` = r188 基线逐位一致 — PASS
- T3 姓名对齐比值（学号行中心−姓名中心)/姓名字高 = 0.6351（r192 的 2.3.2 值 0.716 未复现，与 DOM 预览 0.639 吻合）— PASS
- 导出模式记忆陷阱已按「先读模式字段」规避；全程 pageerror 0；清 storage + 关闭全部测试 tab。
- 注记：SKILL.md 中 r192 的「2.3.2 新基线」注记（ef6b69ad…/cec2aac0…）已随 #202 回退作废，r170/r188 基线恢复有效。

**产物**：/home/ubuntu/r194_dl/（demo 整页 zip、逐张 zip）；脚本 /home/ubuntu/r194_t1.py。

# 第 193 轮（2026-08-10）：#200 html2canvas-pro 2.0.4→2.3.2 升级全量导出回归 ⚠️（功能全通过、无 P1/P2；**发现一处 P3 偏差：大字号姓名字段在 PNG 导出中相对 DOM 预览整体上移 ~12px@300dpi（≈1mm）**，2.0.4 时导出与预览对齐更准；小字段仅上移 ~3px。其余：𱁬 完整不碎裂、RTL 维文正常、裁切线真带线、pHYs 三分支正确、水印/页脚正常、图片版 PDF 正常、pageerror 0）

**部署**：entry `index-BmwKWsHK.js`→`index-DzDe9l0M.js`（15s 二次采样一致）；css 不变 `index-n4PFQFvb.css`。

**逐项判定**（md5 翻转均已做像素级人工判定）：
- T1 demo 整页 PNG（带水印）md5=`ef6b69ad…` ≠ r170 基线 `3e8fdf3e…`（预期翻转）。与 r191 同口径产物 numpy diff：408,346 px 差异，全部位于文字区/裁切线亚像素/页脚亚像素——**姓名大字段上移 12px、班级/学号小字段上移 3px**，字形本身无变化。
- **P3 判定依据**：4x 高清预览裁片量测「学号中心−姓名中心」/姓名字高 比值：DOM 预览 0.639，2.0.4 导出 0.635（吻合），2.3.2 导出 0.716（偏离）——即 2.3.2 把姓名画得比预览高 ~1mm，「所见即所得」轻微破裂；上游 #222「webfont 基线下移修复」对 SeatMark 的 DOM 口径而言是反向偏移。不影响可读性/不裁切，定 P3。
- T2 demo 逐张 zip 24 张（=共 24 条数据）；抽样 001/012/024 字形完整 — PASS
- T3 RTL 维文 003.png 连写正常无堆叠（#189 链路无回归）— PASS
- T4 扩B 𱁬 逐张 009.png：md5 `cec2aac0…` ≠ r188 基线 `eb4eb7bd…`（预期翻转），裁片对照 r188——𱁬 完整不碎裂、王/明 仍粗体（#194 链路无回归）— PASS
- T5 裁切线：整页导出真带虚线（#162 SVG 链路）— PASS
- T6 pHYs 三分支：整页 2481×3509 pHYs=11811；逐张 1063×354 pHYs=11811（=90mm 物理宽一致）；精确像素导出 800×267 **无 pHYs** — PASS
- T7 水印徽章：逐张/整页产物徽章正常，无位移异常 — PASS
- T8 图片版 PDF（jsPDF 4.2.1、1 页）栅格化无空白错排、维文/多文种正常 — PASS
- 全程 pageerror 0（多 tab）；清 storage + 关闭全部测试 tab — PASS

**产物**：/home/ubuntu/r192_dl/（demo 整页/逐张、r180 名单逐张/整页/PDF、精确像素 zip）；关键截图 /home/ubuntu/screenshots/：r192_label1_sbs.png（2.0.4|2.3.2 整页标签对照）、r192_perlabel_name_sbs.png（姓名上移对照）、r192_preview_label1_hi.png（4x 预览基准）、r192_009_r188_vs_r192.png（𱁬 对照）、r192_label_003.png（RTL）、r192_names_label1_cutlines.png（裁切线）、r192_footer_sbs.png；脚本 /home/ubuntu/r192_t1.py、r192_t1b.py、r192_t3.py、r192_t6b.py、r192_prev_hi2.py。

# 第 191 轮（2026-08-10）：#198 例行依赖收敛（仅 package-lock.json）线上冒烟回归 ✅（部署翻转后：demo 整页 PNG md5 与 r170 基线逐位一致——依赖升级渲染零变化；demo 逐张 zip 24 张与「共 24 条数据」一致；首页 /templates 加载正常；GA/百度统计通道正常注入且命中、clarity 0；pageerror 0）

**部署**：entry `index-DDHydYPE.js`→`index-BmwKWsHK.js`（15s 二次采样一致）；css `index-n4PFQFvb.css`（随构建翻转）；sw md5 `a8116cd3…`。

**结果**：
- T1 核心：demo 整页 PNG（带水印口径）md5=`3e8fdf3e0c8530297998d8ad25623f21` = r170 基线逐位一致（html2canvas-pro 2.0.4 未动，vue/vite/@sentry in-range 升级渲染零变化实证）。
- T2 冒烟：demo 逐张 zip 24 张 =「共 24 条数据」；首页与 /templates 正常渲染（截图）、pageerror 0。取证注记：图片 PNG 弹窗的导出模式跨导出记忆——上一次选「按整页」后下一次默认仍整页（本轮首跑逐张误得 2 张整页 zip，切回「按标签逐张」复跑即 24 张；产品行为，非缺陷）。
- T3 统计通道：gtag/js×1、hm.js×1、zz.bdstatic×1 注入且实际命中（GA collect×1、hm.gif×2）；clarity 0；Sentry 无异常请求/无 console error。
- 全程 pageerror 0（4 tab）；清 storage + 关闭全部测试 tab。

**产物**：/home/ubuntu/r191_dl/（demo 整页 zip、整页双页 zip、逐张 24 张 zip）；截图 /home/ubuntu/screenshots/r191_home.png、r191_templates.png；脚本 /home/ubuntu/r191_t1.py、r191_t1b.py、r191_t23.py。

# 第 189 轮（2026-08-10）：多文种/生僻字名单浏览器打印通道验证 ✅（走查轮，无代码变更：打印 PDF 中维文原生 shaping 连写正常、𱁬 完整不碎裂且王/明 仍粗体——#193 font-synthesis:none 在打印 DOM 生效实证；藏/传统蒙/彝/朝/西里尔与预览一致无豆腐；demo 打印冒烟正常；pageerror 0）

**测法**：真实点击「打印 / 矢量 PDF」入口（经导出选择弹窗「带水印导出」），预先覆写 `window.print` 抛异常使打印宿主保持挂载（doPrint 无 finally，unmountHost 不执行——headless 无打印对话框的取证手法），`Page.printToPDF`（A4、printBackground）抓取 @media print 排版，pdftoppm 300dpi 栅格化逐字段裁片。entry `index-DDHydYPE.js`（r188 后无部署变化）。

**结果**：
- T1 多文种打印 PDF（1 页 A4 595.92×841.92pt，10 标签全渲染）：
  - 维文 ئابدۇللا ئابلىز 连写正常、无堆叠（浏览器原生 shaping，html2canvas 缺陷不涉打印，与预览一致）；
  - **𱁬 完整单一字形、无重影碎裂，王/明 仍粗体**——#193 `font-synthesis: none` 在打印 DOM 路径生效的直接实证（#194 neutralize 不涉打印）；
  - 藏文叠字完整、彝文/传统蒙文（Unifont 位图风格、蒙文含既知「…」截断观察项）/朝鲜文/西里尔均与预览一致、无 U+FFFD/豆腐；
  - 水印徽章 seatmark.cn 正常出现在各标签（带水印口径）。
- T2 Regression demo 打印：2 页、16 标签/页全渲染，文字/角标/裁切线正常。
- 两 tab pageerror 均 0（覆写抛异常未产生页面级错误）；清 storage + 关闭全部测试 tab。

**产物**：PDF /home/ubuntu/r189_dl/names_print.pdf、demo_print.pdf（含栅格 png）；截图 /home/ubuntu/screenshots/r189_names_print_full.png（整页）、r189_print_biang.png（关键：打印 𱁬 完整）、r189_print_uy.png、r189_print_tibetan.png、r189_print_yi.png、r189_print_yi_mn.png（传统蒙文）、r189_demo_print_p1.png；脚本 /home/ubuntu/r189_t1b.py。

# 第 188 轮（2026-08-10）：#194 导出前中和合成加粗线上复测 ✅（**#193 导出路径闭环**：逐张 009.png md5 由失败基线 d241c042… 翻转为 eb4eb7bd…，𱁬 在逐张与整页产物中均为常规字重完整字形、无重影碎裂，王/明 仍粗体；预览与导出形态一致，所见即所得恢复；demo 整页 md5 与 r170 基线逐位一致（rare 区间外 DOM 零触碰）；维文 RTL 无回归；pageerror 0）

**部署**：entry `index-BSD8AYv1.js`→`index-DDHydYPE.js`（15s 二次采样一致）；css 不变 `index-D3VMV82H.css`；sw md5 `52f6b960…`。

**结果**：
- T1 核心：r180 名单逐张 zip 009.png（1063×354）md5=`eb4eb7bd8dafd597b0c86d57ff83bf32` ≠ 失败基线 `d241c042…`；放大裁片 𱁬 单一完整（三龍三雲结构清晰可辨），对照 r186_label_009_zoom.png 碎裂涂抹形态判据可区分；王/明 笔画仍粗体。整页 PNG（2481×3509）同标签裁片同样完整。PASS。
- T2 所见即所得：预览裁片（r188_preview_biang.png）与导出 009 裁片形态一致——𱁬 常规字重完整、王/明 粗体。PASS。
- T3 Regression：demo 整页 PNG（带水印）md5=`3e8fdf3e0c8530297998d8ad25623f21` = r170 基线逐位一致（常用字不在 rare 区间、neutralize 零触碰）。PASS。
- T4 RTL：003.png 维文连写正常无堆叠（neutralize 在 rasterizeRtlText 之前，链路无扰）。PASS。
- 全程 pageerror 0；清 storage + 关闭全部测试 tab。

**产物**：截图 /home/ubuntu/screenshots/r186_label_009_zoom.png（🔴 修复前导出碎裂）vs r188_label_009_zoom.png（🟢 修复后完整）；r188_preview_biang.png（预览对照）、r188_wholepage_biang_crop.png、r188_label_003.png。导出 /home/ubuntu/r188_dl/；脚本 /home/ubuntu/r188_t1.py。

# 第 186 轮（2026-08-10）：#193 捕获根 font-synthesis:none 线上验收 ⚠️（**预览闭环、导出未闭环**：𱁬 预览不再碎裂重影、以常规字重完整渲染；但整页 PNG 与逐张导出产物中 𱁬 仍碎裂——逐张 009.png 与 r180 修复前**逐字节相同**（md5 d241c042…、numpy diff=0），html2canvas 用 canvas fillText 自行合成加粗，CSS font-synthesis 不作用于 canvas 文本绘制；「所见即所得」反向破裂：预览好、导出坏）

**部署**：entry `index-BZ_MgILR.js`→`index-BSD8AYv1.js`、css `index-BCHVWv3_.css`→`index-D3VMV82H.css`（15s 二次采样一致）；sw md5 `008fed78…`。

**结果**：
- T1 预览：r180 名单导入后「王𱁬明」字段 computed `font-synthesis-weight: none`（weight 800、栈首 Plangothic）；截图对照 r180_preview_biang.png 碎裂基线——**𱁬 现以常规字重完整渲染、无重影碎裂**（王/明 仍粗体，Noto 真 Bold）。PASS。
- T1 导出：**FAIL**——逐张 009.png（1063×354）与 r180 修复前逐字节相同（md5 `d241c0422af37935285527a622544b69`、像素 diff=0），整页 PNG 该标签裁片同样碎裂。根因：html2canvas 以 canvas fillText 绘文本，canvas 自身对无粗体面字体合成加粗，CSS `font-synthesis` 不适用；修复只覆盖 DOM 预览路径。
- T2 粗体回归：deskName「张伟」platform fonts = Noto Sans CJK SC（非合成、真 Bold 面），预览字形明显粗体无异常；deluxeConfAurora demo 预览正常渲染无碎裂。本机有真 CJK Bold，未观察到「粗体变常规」现象。PASS。
- T3 Regression：demo 整页 PNG（带水印）md5=`3e8fdf3e0c8530297998d8ad25623f21` 与 r170 基线逐位一致。PASS。
- T4 RTL：逐张 003.png 维文连写正常无堆叠（#189 链路无回归）。PASS。
- r180 名单导入零缺字误报（与 r184 一致）；全程 pageerror 0；清 storage + 关闭全部测试 tab。

**产物**：截图 /home/ubuntu/screenshots/r186_preview_biang.png（🟢 预览修复）vs r180_preview_biang.png（🔴 基线）；r186_label_009_zoom.png（🔴 导出仍碎裂）vs r180_label_009_zoom.png（🔴 修复前，逐字节相同）；r186_wholepage_biang_crop.png、r186_preview_zhangwei.png、r186_deluxe_preview.png、r186_label_003.png。导出 /home/ubuntu/r186_dl/；脚本 /home/ubuntu/r186_t1d.py、r186_t3.py、r186_t5.py。

# 第 184 轮（2026-08-11）：#191 少数民族文种缺字形检测线上验收 ✅（部署翻转后：r180 多文种名单零误报、CJK 生僻字链路不变、阳性分支用 U+1166F 真缺字字符成功触发新警告且文案正确、demo 冒烟+整页 PNG md5 与 r170 基线逐位一致、pageerror 0）

**部署**：entry `index-BPAT-y6Z.js`→`index-BZ_MgILR.js`（15s 二次采样一致）；css 不变 `index-BCHVWv3_.css`；sw md5 `7006c579…`。

**结果**：
- T1 零误报：/studio?template=deskName 导入 r180_names.xlsx（维/藏/传统蒙/彝/朝/西里尔/扩B/超长名 10 行），导入后 12s 轮询**无任何「无法显示的字符」/生僻字警告**；数据表「共 10 条数据」；pageerror 0。CJK 链路不变：含扩 H U+31350 名单仍触发「名单含 1 个生僻字」+「已自动启用生僻字扩展字库（遍黑体）」（r180 同判据）。
- T2 阳性分支（PASS，非 untested）：自造名单含 U+1166F（蒙古文补充区，`fc-list :charset=1166f`=0 本地字体，必然豆腐；astral 码位顺带验证 codePointAt 处理）→ 触发 toast「名单含 1 个无法显示的字符」，正文「名单中有少数民族文字（码位 U+1166F）在当前设备字体中缺少字形，预览与导出可能显示为方块；建议换到安装了对应文种字体的设备上操作」——码位以 U+XXXX 文本描述、toast 正文无豆腐块混入（预览标签中该字符如实显示 tofu，正是警告所指）；遍黑体兜底 toast 未误触发（不走 CJK 链路，符合设计）。截图 r184_minority_toast.png。
- T3 冒烟回归：demo=1 纯汉字导入零警告；整页 PNG（带水印口径）md5=`3e8fdf3e0c8530297998d8ad25623f21` 与 r170 基线逐位一致（导入检测改动不影响导出链路）；全程 pageerror 0。
- 收尾：清 local/sessionStorage + 关闭全部测试 tab。

**产物**：截图 /home/ubuntu/screenshots/r184_minority_toast.png（关键）、r184_cjk_toast.png、r184_t1_import.png；导出 /home/ubuntu/r184_dl/；阳性名单 /home/ubuntu/r184_positive.xlsx；脚本 /home/ubuntu/r184_t1.py、r184_t1b.py、r184_t3.py。


# 第 182 轮（2026-08-10）：#189 RTL 字段导出预栅格化线上验收 ✅（**第 180 轮 P2 闭环**：维文 ئابدۇللا ئابلىز 在整页 PNG / 逐张 zip / 图片版 PDF 三种产物中连写正常、无重叠，与预览一致；非 RTL 文种像素级零变化；纯汉字 demo 整页 PNG md5 与 r170 基线逐位一致）

**部署**：entry `index-BADM1vql.js`→`index-BPAT-y6Z.js`（二次采样一致；css 不变 `index-BCHVWv3_.css`、sw md5 `af87e785…`）。

**结果**：
- T1 维文三产物（r180 同素材 r180_names.xlsx）：逐张 003.png 1063×354 连写正常无堆叠（失败基线 r180_label_003.png 为堆叠形态）；整页 PNG 2481×3509 @ pHYs 11811 与图片版 PDF（pdftoppm 栅格化）中维文同样正常 — passed。
- T2 非 RTL 回归：藏/彝/朝/西里尔/汉产物正常；逐张 004/007/008/010 暗像素计数与 r180 逐一相同（24785/25209/29685/28237——非 RTL 路径零触碰）；导出后预览 `.label-field__content` 内 `<img>`=0、`.offscreen-host`=0（宿主隔离，预览不受污染）— passed。
- T3 Regression：demo 名单整页 PNG（带水印口径）md5=`3e8fdf3e0c8530297998d8ad25623f21` 与 r170 基线逐位一致、numpy diff=0 — passed。**取证注记**：r170 基线本身是「带水印导出」产物——首跑误用无水印通道得 md5 f2dc311f…，diff 全部位于各标签 seatmark.cn 徽章区，非回归；带水印口径复跑即逐位一致。
- T4 RTL 位置/颜色/字号一致性：产物墨迹 bbox 宽高比 4.59 vs 预览 4.72（差 ~3%，无水平压缩）；墨色均值 (18,26,45) vs 预览 (17,25,42)≈rgb(15,23,42)；名字区垂直居中；目测对齐一致 — passed。
- 全程 pageerror 0；清 storage + 关闭全部测试 tab。

**遗留（非本轮）**：r180 观察项不变——非 CJK 文种缺字形永不告警（glyphSupport 只扫 CJK 扩展区）、遍黑体 𱁬 字形碎裂、18px 下限省略号截断。

**产物**：/home/ubuntu/r182_dl/（perlabel.zip、wholepage.png、photo.pdf、demo_wholepage_wm.zip 等）；截图 /home/ubuntu/screenshots/r182_*；脚本 /home/ubuntu/r182_t*.py。

# 第 180 轮（2026-08-10）：少数民族/多文种姓名支持走查 ⚠️（导入/数据表/朝鲜文·西里尔·彝文·藏文全链路正常；**发现 P2 缺陷：维吾尔文（RTL）姓名在 PNG/PDF 导出产物中字形严重重叠错位，而预览完全正常**；另有扩 B 生僻字（遍黑体栈首）预览与导出均字形碎裂重影、非 CJK 文种缺字永不告警（代码缺口）、超长名/传统蒙文 18px 下限后省略号截断三条观察/P3 项）

**名单**：自造 xlsx 10 行——汉、维（ئابدۇللا ئابلىز）、藏（བསོད་ནམས་དབང་འདུས）、传统蒙文（ᠪᠠᠲᠤᠪᠠᠭᠠᠲᠤᠷ）、西里尔蒙文、彝（ꆈꌠꀿꃀ）、朝（김철수）、扩 B 阳性对照（王𱁬明）、超长名。生产 /studio?template=deskName（课桌姓名贴 2×8）。

**结果**：
- T1 导入：字段映射/数据表 10 行全对，各文种 DOM 逐字符与源一致、无 U+FFFD；「共 10 条数据」。扩 B/H 真缺字形字触发「已自动启用生僻字扩展字库（遍黑体）」toast（用扩 H U+31350 复核，本环境 Noto 覆盖 𱁬 故其不触发——检测逻辑正确）。**代码缺口（P3）**：`glyphSupport.ts` L13-19 检测只覆盖 CJK 扩展/兼容区——维/藏/蒙/彝文码位缺字形时永不告警（本环境有 Unifont 兜底未豆腐；无这些字体的用户设备会豆腐且零提示，符合用户判据 5 的「产品提醒缺口」）。
- T2 预览：全部 10 名非豆腐；维文 shaping 生效（连写宽 205 < 孤立和 359）、藏文叠字完整；autofit 生效（长名 18px vs 常规 36px、无溢出）。**观察**：18px 下限后超长名/传统蒙文以省略号「…」截断（预览与导出一致）；扩 B 𱁬 在 .sheet-page（遍黑体栈首）预览即碎裂重影错位（数据表中 Noto 渲染正常）。
- T3 导出：整页 PNG 2481×3509 @ pHYs 11811；逐张 zip 10 张 1063×354；图片版 PDF 1 页可栅格化。藏/彝/朝/西里尔产物与预览一致。**P2 缺陷：维文姓名在整页 PNG、逐张 PNG、图片版 PDF 三种产物中字形全部严重重叠堆叠（预览正常连写）**——html2canvas 渲染 RTL 阿拉伯字母文本的定位缺陷；证据 r180_preview_uy.png（预览正常）vs r180_label_003.png（导出重叠）。𱁬 导出同预览一样碎裂（所见即所得成立，但字形本身坏）。
- T4 打印通道 window.print 调起 1 次；全程 pageerror 0。收尾清 storage + 关闭全部测试 tab。

**产物**：/home/ubuntu/r180_dl/（wholepage.png、perlabel*.zip、photo.pdf）；截图 /home/ubuntu/screenshots/r180_*；脚本 /home/ubuntu/r180_t*.py；名单 /home/ubuntu/r180_names.xlsx。

# 第 179 轮（2026-08-10）：Clarity 移除后 Lighthouse BP 重建基线 ⚠️（**BP 中值仍 58 未上升**——剩余扣分已定位：三项 0 分审计全部溯源到百度统计——第三方 Cookie `HMACCOUNT_BFESS`（两项）+ hm.js 注册的 unload 监听（deprecations，经 Sentry addEventListener 包装被归因到 bundle）；Perf/CLS 无回归，新基线已建）

**方法**：lighthouse@13.4.1，SKILL.md 标准命令（mobile 模拟节流），`/`、`/studio`、`/templates` 各 3 跑取中值；原始 JSON 存 /home/ubuntu/r179_lighthouse/。

**结果（中值）**：
- `/`：Perf **98**（3 跑 80/99/98，首跑冷启动偏低符合已知规律）、BP **58**、CLS **0**、LCP 1.83s
- `/studio`：Perf **78**（70/78/79）、BP **58**、CLS **0**、LCP 4.71s
- `/templates`：Perf **93**（71/93/96）、BP **58**、CLS **0**、LCP 2.48s
- Perf 无回归（home ≥87✓、studio ≥66✓、templates ≥70✓，均优于/持平旧基线）；CLS 三页全 0 ✓。

**BP 未上升的定位**：BP 58 由三项 0 分审计构成，Clarity 移除只消掉了 Clarity 相关 cookie，剩余：
1. `third-party-cookies`：百度统计 `HMACCOUNT_BFESS`（hm.baidu.com/hm.js 种）——1 个 cookie 即 0 分；
2. `deprecations`：「Unload event listeners are deprecated」——初判为 Sentry SDK，主会话复核后修正：**真实注册者是百度统计 hm.js**（脚本内两处 `b.c(window,"unload",…)`/`d.c(window,"unload",…)`），Lighthouse 将其归因到 bundle（line21 col6877）是因为 Sentry breadcrumb 集成包装了 `addEventListener`，第三方脚本注册监听时实际执行的是 bundle 内的包装函数；bundle 与 src/ 本身均无 unload 监听（bundle 内唯一 "unload" 字符串是 Sentry 导航 span 名数组）；
3. `inspector-issues`：同为百度 cookie 的 CookieIssue。
即：**三项失败审计的根因都是百度统计，只要保留它 BP 即钉死在 58**；升级 Sentry 无助（它不是 unload 的注册者）。裁量项：是否接受 BP=58 为「保留百度统计的既定代价」（面向中国市场默认保留），或砍掉百度统计换 BP 分。

**收尾**：清理 lighthouse 临时 Chrome 进程。未改产品代码。

# 第 178 轮（2026-08-10）：#186 移除 Microsoft Clarity——第 176 轮弹窗泄漏闭环复测 ✅（**核心判据 PASS**：弹窗开关 10→30 轮节点/监听器/heap 完全持平（8,095/1,731/9.7MB 三次采样零增长，r176 失败版线性涨至 103k/15.3k/88.8MB）；三家统计通道正常、clarity 请求 0、导出冒烟无回归）

**背景**：第 176 轮发现「浏览全部」弹窗每轮开关泄漏约 3.3k 节点/约 500 监听器/约 2.7MB；第 177 轮 retainer 分析定位 `window.clarity → closure → Map(table)` 永久保留 detached TemplateThumb 树；#186（8e1c3b3）从 app/index.html 移除 Clarity stub+tag，产品 JS 零改动。部署翻转：20:03:34 生产 HTML clarity 计数 3→0、15s 复采样仍 0（entry/css 如预期不变 `index-BADM1vql.js`/`index-BCHVWv3_.css`，sw md5 `4c3f26d6…`→`fcd98953…` 随 index.html 预缓存翻转）；页面内 `typeof window.clarity === 'undefined'`。

**T1 弹窗泄漏闭环（核心判据，r176 同口径 30 轮）— PASS**：GC×4 后采样——起点 2,761 节点/375 监听器/7.7MB；10/20/30 轮后均为 **8,095 节点/1,731 监听器/9.6-9.7MB，三次采样完全持平（零线性增长）**；r176 失败基线同口径为 31,270→67,202→103,134 节点线性上涨——判据可区分。第 30 轮弹窗仍正常渲染（截图）。观察项（不定级）：首次打开弹窗有一次性 +5.3k 节点/+1.36k 监听器留存（首开后恒定，疑组件懒初始化/一次性缓存，非泄漏）。

**T2 统计通道 — PASS**：新 tab 首页加载 idle 后 Network 采集——`googletagmanager.com/gtag/js`×1、`hm.baidu.com/hm.js`×1、`zz.bdstatic.com`×1 均注入且实际命中（google-analytics collect×1、hm.gif×2）；**clarity 请求 = 0**；dataLayer/_hmt 均为 object、push 不抛错；pageerror 0。取证注记：Tab 封装的 nav/js 会在命令往返中消费 Network 事件，采集统计请求须用独立 recv 循环在 navigate 后直收（首次采集误得全 0，独立循环复测取真值）。

**T3 冒烟 — PASS**：整页 PNG 导出（downloadProgress 事件判定）md5=`3e8fdf3e0c8530297998d8ad25623f21`（=r170 基线）、pHYs 11811；pageerror 0。

**T4 观察项（r176 导出后暂态 detached 累积复查）**：连续 5 次整页导出 GC 后采样——2,005→5,932→5,938→5,941→5,941→5,941，**首次导出后 +3.9k 一次性留存，其后每次 +0~9 节点，r176 的每次 +13k 线性累积已消失**（Clarity 移除的连带收益，符合根因推断）。

**收尾**：清 storage、关闭全部测试 tab。未改产品代码。

# 第 177 轮（2026-08-10）：第 176 轮弹窗泄漏根因定位 ✅（**根因 = Microsoft Clarity 统计脚本**：heap snapshot retainer 路径终点为 `window.clarity` 闭包内部的节点 Map，Clarity 把弹窗每次打开渲染的 TemplateThumb 卡片树（含 `<h3>`、ResizeObserver、事件监听器）永久保留在其内部映射中，detached 树因此无法回收；产品代码（ModalDialog/TemplateThumb/useElementSize/LabelCard autofit）清理路径全部验证正确）

**定位过程（本地 dev + 生产均复现）**：
- 复现判据完全对齐第 176 轮脚本口径（JS 合成点击开弹窗、等待 >10 张卡片渲染、点「关闭」、循环，GC×4 后 Memory.getDOMCounters）：本地 +7.6k 节点/+1.1k 监听器每轮、生产 +3.8k/+588 每轮——复现成立。
- 排除法：stub 掉弹窗内 TemplateThumb（换纯 div）泄漏仍在；`__autofitRegistry` 插桩 size 恒 185、无 detached 成员——LabelCard autofit 注册表清理正确；Vue 升 3.5.41 无变化。
- **heap snapshot retainer 分析（5 轮后快照 85MB，解析逆边 BFS 到 GC 根）**：669 份 detached TemplateThumb 容器 div 的强引用路径一致终结于 `Window.clarity → closure context → Map(table) → <h3 class="min-w-0 truncate …">`——Clarity 内部节点 Map 持有弹窗卡片标题 `<h3>`，经 parentNode 链保留整棵 detached 弹窗树（含 670 个 ResizeObserver、4.4k EventListener）。
- **反证确认**：route 拦截 `**/*clarity*` 后同脚本 10 轮——节点/监听器 **+0/轮（2,783→2,783 / 369→369）**，泄漏完全消失。

**修复（本 PR）**：从 `app/index.html` 移除 Clarity 注入（stub + tag script）。收益：①长会话内存泄漏根除；②Lighthouse Best Practices 扣分项减少（Clarity 贡献了大部分第三方 Cookie）。保留 GA4 + 百度统计 + 百度主动推送。此前「统计供应商精简」为待裁量项，本轮以泄漏实证升级为默认执行；如需保留 Clarity 请回复，可回滚并改为按需注入。

**第 176 轮 T2 观察项（导出后暂态 detached 节点累积）**同源可解释：Clarity 同样观察导出离屏宿主节点，其 Map 定期清理后回落——与「数分钟后自行回落」现象吻合，移除后一并消除。

# 第 176 轮（2026-08-10）：长会话稳定性/资源泄漏审计 ⚠️（**1 条 P3 泄漏发现**：「全部模板」弹窗每次开关泄漏约 3.3k DOM 节点 + 约 500 事件监听器 + 约 2.7MB heap，线性累积、GC 与路由切换后仍保留；模板切换/翻页/导出通道稳定，导出产物字节一致、耗时无劣化，storage 无膨胀）

**环境**：生产 www.seatmark.cn（无代码变更轮，bundle `index-BADM1vql.js`），headless Chromium 29229；度量 = CDP Memory.getDOMCounters + Performance.getMetrics，每次采样前 HeapProfiler.collectGarbage ×4。

**P3 发现（弹窗泄漏）**：/studio 反复「浏览全部」打开/关闭模板弹窗（不选模板），10/20/30 次后 GC 采样：节点 4,321→31,270→67,202→103,134；监听器 383→4,451→9,875→15,299；heap 9.1→35.7→63.9→88.8MB——**每次开关约 +3.3k 节点/+497 监听器/+2.7MB，线性无回落**；路由切走 /templates 再返回并 GC 后仍保留 112k 节点/15.9k 监听器（非暂态）。对照组：同 tab 仅在侧栏 3 张卡片间切换模板 30 次——节点/监听器持平（4,321→3,922 / 383→386），**证明泄漏源是弹窗内容（约 225-327 个 TemplateThumb 卡片被整体保留），而非模板切换本身**。ModalDialog window keydown 有 onBeforeUnmount 清理、TemplateThumb IO observer 有 disconnect——保留者在别处（建议 lead 用 heap snapshot 查 detached tree 的 retainer）。普通用户少量开关无感知，长会话反复浏览模板库会持续膨胀，定 P3。

**T1 连续切换 34 次/31 款模板**（弹窗逐款点选，含 eink800 电子座签、照片核验版、会议桌牌·鎏金雅框等重模板）：每次 `.sheet-page` 均正常渲染、pageerror 0；首尾 GC 采样 heap 9.6→125.5MB、节点 5k→166k——增长与「弹窗开了 34 次」的泄漏率吻合（见上），切换本身无泄漏（对照组持平）。Documents/Frames 恒为 1（html2canvas iframe 不累积）。

**T2 连续导出 15 整页 + 5 逐张**：Browser.downloadProgress 事件级计时，整页 15 次全部 2.8-3.1s、逐张 5 次 3.1s——**无逐次劣化**；产物 md5 全一致（整页 = r170 基线 `3e8fdf3e…`，逐张首张 `6be1f14a…`）；每次导出后 `.offscreen-host` 与 iframe 数均为 0（**离屏宿主清理正常**）。观察项（不定级）：每次整页导出后 GC 仍残留约 13k detached 节点线性累积（15 次→约 20 万节点/70MB），但监听器不涨，且数分钟后可自行回落至 1.3 万（暂态保留，疑与导出 toast/10s revokeObjectURL 定时器闭包相关），无用户可见影响。

**T3 翻页往返 30 次**：节点/监听器持平（13,239→12,983 / 420→411），pageerror 0。弹窗开关 30 次见 P3 发现。

**T4 storage**：全部动作后 localStorage+sessionStorage 合计 4,485 字节，最大键 `seatmark.workspace-roster.v1` 2,642B——无膨胀。

**取证注记（自动化假象，非缺陷）**：①同分钟内连续导出的文件名（`模板名-YYYYMMDD-HHMM.zip`）相同，CDP downloadPath 模式下 Chrome 直接**覆盖同名文件**、不产生新路径——按"新文件出现"判导出完成会交替假超时（本轮曾误现约 185s 交替延迟，事件级计时证伪）；判完成应改用 `Browser.setDownloadBehavior eventsEnabled:true` + downloadProgress completed 事件。②弹窗搜索框是 v-model，须 `Input.insertText` 而非直接赋 value；且搜索词跨开关保留，会把后续弹窗列表过滤为空。

**收尾**：清 localStorage/sessionStorage、关闭全部 16 个测试 tab。未改产品代码。

# 第 175 轮（2026-08-10）：#184 `.sheet-page` forced-color-adjust: none 线上验收 ✅（**核心判据 PASS，第 172/174 轮 forced-colors 导出失色 P3 正式闭环**：forced-colors 模拟下导出 PNG 与正常基线逐位一致、品牌青 113,898 像素完整保留；屏上 UI 强制配色边界正确、冒烟无回归）

**背景**：第 174 轮定位到 html2canvas 克隆进自建 iframe 后丢失 `.offscreen-host` 祖先豁免。PR #184 把 `forced-color-adjust: none` 直接加在捕获根 `.sheet-page` 上（main.css L247-257，`.offscreen-host` 原豁免保留）。部署翻转：17:19:09 三指标齐变（js `index-h2r97RJA.js`→`index-BADM1vql.js`、css `index-VqHoINT7.css`→`index-BCHVWv3_.css`、sw `af129298…`→`4c3f26d6…`），二次采样一致；新 CSS 构建产物实测含 `sheet-page{forced-color-adjust:none;…}`。

**T1 forced-colors 下导出保留设计色（核心判据）— PASS**：/studio?template=deskName&demo=1，同 tab 先正常导出整页 PNG 基线（2481×3509 @ pHYs 11811，md5 `3e8fdf3e0c8530297998d8ad25623f21` 与 r170 逐位一致），再 Emulation.setEmulatedMedia forced-colors:active（matchMedia 导出前后均 True，屏上壳按钮已被强制为 rgb(0,0,159)——强制配色确在生效）导出：产物 2481×3509 @ pHYs 11811、**md5 与基线逐位相同、numpy 像素 diff = 0、品牌青 rgb(13,148,136) = 113,898 像素（r174 失败版为 0）、纯黑 0 像素**。判据可区分性：r174 同流程产物青色 0 像素、diff 861,650 点。

**T2 屏上强制配色边界 — PASS**：forced-colors 下首页与正常态截图像素差 213,796/1,500,000（应用壳 UI 仍被强制配色，豁免未外溢），文本可读、pageerror 0。/studio 预览纸张区域保留设计色（截图近青像素 9,128）——`.sheet-page` 所见即所得，符合 #184 预期。

**T3 冒烟 — PASS**：正常导出 md5/pHYs 与 r170 基线一致（T1 基线即证）；新 tab 打印通道 hook `window.print()` 调起 1 次、pageerrors 全程为空。

**产物**：/home/ubuntu/r175_dl/（基线 1720 / forced 1723、1724 三份 zip，字节级一致）；截图 r175_*。收尾：重置模拟、关闭全部测试 tab。**遗留**：真实 Windows 高对比度下打印渲染色 headless 无法核验（低风险：打印走原文档，`.sheet-page`/`.offscreen-host` 双豁免均在场）。

# 第 174 轮（2026-08-10）：#183 `.offscreen-host` forced-color-adjust: none 线上验收 ❌（**核心判据 FAIL**：forced-colors 模拟下导出 PNG 仍全灰阶、品牌青 0 像素——根因已定位：html2canvas 克隆到独立 iframe 渲染，克隆树丢失 `.offscreen-host` 祖先的豁免继承；屏上 UI 与冒烟均正常）

**背景**：PR #183 给 `.offscreen-host`（main.css L440-449）加 `forced-color-adjust: none`，意图闭环第 172 轮 P3。部署翻转：17:04:16 三指标齐变（js `index-BTp5Le9S.js`→`index-h2r97RJA.js`、css `index-CTzSm9NE.css`→`index-VqHoINT7.css`、sw `e7e91bb4…`→`af129298…`），二次采样一致；新 CSS 构建产物实测含 `offscreen-host{…forced-color-adjust:none…}`。

## T1 forced-colors 下导出保留设计色 — **FAIL**
- 同 tab 基线（非 forced）：2481×3509 @ pHYs 11811、md5=`3e8fdf3e…` 与 r170/172 基线一致 ✅
- forced-colors: active 下导出：尺寸/pHYs 正常，但**品牌青 rgb(13,148,136) 像素数 = 0**（基线 113,898）、纯黑 68,518 + 全灰阶 top colors，与基线像素差 861,650 点、覆盖 99.7% 行——**设计色仍全部丢失，#183 未达成目标**。
- **根因（已实证）**：CSS 本身生效——原文档内 `.offscreen-host` 后代 computed color 保持 `rgb(13,148,136)`、forcedColorAdjust=none ✅；但 html2canvas 把被捕获节点克隆进**自建同源 iframe** 渲染：实测 iframe 内 `forced-colors: active` 仍匹配、无 `.offscreen-host` 祖先的 `.sheet-page` 元素颜色被强制为 `rgb(0,0,0)`。克隆根为 sheet-page（不含 offscreen-host 祖先），可继承豁免丢失 → 强制配色照旧烙进产物。
- **修复建议**：把 `forced-color-adjust: none` 直接加在 `.sheet-page`（或被 html2canvas 捕获的根元素及其类）上，而非仅祖先宿主；或用 html2canvas `onclone` 钩子在克隆文档根上补 `forced-color-adjust: none`。真实 Windows 高对比度下同理（iframe 同样被强制），非模拟假象。

## T2 屏上 UI 在 forced-colors 下（负向对照）
- / 强制配色截图与正常截图像素差 271,200/1,500,000（UI 确实仍被强制改写，豁免未外溢）；文本可读、dark frac 0.036 正常、pageerror 0 ✅

## T3 冒烟（Regression）
- 正常导出整页 PNG：md5=`3e8fdf3e…` 与 r170 基线逐位一致、pHYs 11811 ✅
- 打印通道：hook 确认 `window.print()` 调起 1 次、pageerror 0 ✅（注：真实打印走原文档 @media print，`.offscreen-host` 豁免对**打印通道**应有效，但 headless 无法核验打印渲染色，untested）

全程 pageerror 0。产物：/home/ubuntu/r174_dl/；截图 r174_*（含 r174_export_base_crop.png / r174_export_forced_crop.png 对照）。清理：模拟重置、测试 tab 全关。headless 不录屏。**第 172 轮 P3 未闭环，需按根因返工。**

---

# 第 172 轮（2026-08-10）：视觉稳健性专项——页面缩放/高 DPR/forced-colors/prefers-contrast/减动效下的渲染与导出一致性 ✅（缩放 150%/80% 与 DPR 1/2/3 下整页 PNG 产物像素级一致；减动效降级正常；**1 条 P3 观察项**：forced-colors 模拟激活期间导出的 PNG 会丢失设计色——品牌青/深蓝灰被强制映射为纯黑/灰阶）

**背景**：无代码变更走查轮（bundle `index-BTp5Le9S.js`）。CDP Emulation.setPageScaleFactor / setDeviceMetricsOverride / setEmulatedMedia 模拟；产物按 pHYs 基线（r170/171）逐 chunk + Pillow + numpy 像素 diff 核验。代码依据：pngExport.ts 渲染倍率与 devicePixelRatio/页面缩放完全无关（L159-176/330-336/410-418）；减动效路径 main.css L233 + HomeView.vue L18。

## T1 页面缩放 150% / 80%
- 两档预览布局无破损（截图非空白、暗像素分布正常）；各导出整页 PNG：均 **2481×3509 @ pHYs 11811**，**md5 与 100% 基线完全相同**（3e8fdf3e…）——导出不受页面缩放影响 ✅

## T2 高 DPR（deviceScaleFactor=2 / 3）
- 两档产物均 2481×3509 @ 11811；DPR3 产物 md5 不同但 **numpy 像素 diff=0**（仅 PNG 编码差异，像素完全一致）；DPR2 复跑 md5 与基线相同 ✅
- 取证注记：DPR2/3 下首跑导出各有一次下载未落盘（同 r170 的 setDownloadBehavior 失效假象叠加渲染耗时），重设 downloadPath 复跑即通过，非产品缺陷。

## T3 forced-colors: active + prefers-contrast: more
- /、/templates、/studio 三页：导航/CTA/正文全部可见（可交互元素 48/259/80、截图文本带正常）、pageerror 0 ✅
- **P3 观察项**：forced-colors 激活期间导出整页 PNG——尺寸/pHYs 正常（2481×3509 @ 11811）但**像素与基线差异 70.6 万点**：基线含品牌青 rgb(13,148,136)、深蓝灰 rgb(15,23,42)/(51,65,85) 等设计色，forced 版被强制映射为纯黑 (0,0,0)+灰阶（127/148/191）。原因：html2canvas 读取的是被 UA 强制配色改写后的 computed style。真实用户须开启 Windows 高对比度等强制配色才会命中；产物仍可读可打印，仅失去品牌色。裁量建议：可在导出渲染宿主上加 `forced-color-adjust: none`，或文档说明。仅报告，未改代码。

## T4 prefers-reduced-motion: reduce
- 首页 30 个 `.reveal-init` 全部立即带 `reveal-in`、首屏与滚动后在视区元素 opacity 全为 1（跳过 IntersectionObserver 路径生效）；/studio 导出对话框功能正常 ✅

全程 pageerror 0。产物：/home/ubuntu/r172_dl/（缩放/DPR/forced 各档 zip）；截图 r172_*（含 r172_export_base_crop.png / r172_export_forced_crop.png 对照裁片）。清理：模拟状态已重置、测试 tab 全部关闭。headless 不录屏。

---

# 第 171 轮（2026-08-10，小轮补测）：小尺寸标签自动提清（>300dpi）分支的 pHYs 取样 ✅（drinkCup 36mm 逐张 PNG 输出宽精确 1000px、pHYs=27778 px/m 与公式 output.width/rect.width×1000 完全一致 ≈705.6dpi；同模板整页仍 2481×3509 @ 11811 px/m；第 170 轮覆盖缺口闭环）

**背景**：补第 170 轮唯一覆盖缺口——`pngRasterScale`（pngExport.ts L159-176：base 3.125、MIN_OUTPUT_WIDTH 1000、MAX 8）对小标签提倍后的逐张 pHYs（L493/L515 公式 `output.width/rect.width×1000`）。#180 已上线（bundle `index-BTp5Le9S.js` 实测未变），无需等部署。模板选 drinkCup 饮品杯贴 36×24mm：need=1000/(36×3.77953)=7.349 → 预期输出宽 ≈1000px、pHYs≈27778 px/m。

## T1 逐张 PNG（提清分支）
- `/studio?template=drinkCup&demo=1` → 图片 PNG（默认逐张）→ 12 张 zip 抽 001/007/012：尺寸均 **1000×667**（36×24mm 等比精确）、pHYs x=y=**27778 px/m、unit=1**，与公式值 round(1000/36×1000)=27778 **完全一致**，换算 **705.6dpi >300dpi**（提清生效且元数据同步提倍）；内容多色非空白 ✅

## T2 整页 PNG（同模板对照）
- 同 tab 切「按整页导出」：产物 **2481×3509**、pHYs=**11811 px/m**、Pillow dpi=(299.9994, 299.9994)——整页保持 300dpi 基准不随小标签提倍 ✅

全程 pageerror 0。产物：/home/ubuntu/r171_dl/；截图 r171_*。清理：测试 tab 全部关闭。headless 不录屏。

---

# 第 170 轮（2026-08-10）：#180 标准模式导出 PNG 写入 pHYs 物理分辨率块 线上验收 ✅（整页与逐张 PNG 均含 pHYs=11811 px/m ≈300dpi，eink 精确像素 800×480 无 pHYs 且纯二值，PDF/打印冒烟无回归；第 169 轮 P3「无 pHYs」闭环）

**背景**：PR #180 合入 main（`withPngPhys`：indexedPng.ts L155-172 IHDR 后插入 pHYs、幂等；pngExport.ts L362 `pixelsPerMeter = exactPixels ? undefined : pxPerMm*1000`，索引色与原生 toBlob 两通道均生效）。部署翻转：16:13:57 观测 entry `index-BPYEjASD.js` → `index-BTp5Le9S.js`、sw.js md5 `35927928…` → `e7e91bb4…`，二次采样一致，稳定 2 分钟后开测。生产 www.seatmark.cn，headless Chromium 29229，产物经 Browser.setDownloadBehavior 捕获后 struct 逐 chunk 解析 + Pillow 复核。

## T1 整页 PNG（标准 300dpi，A4 课桌姓名贴 24 标签 2 页）
- zip 内 2 张整页 PNG：chunk 序列 IHDR/**pHYs**/PLTE/IDAT/IEND，pHYs x=y=**11811 px/m、unit=1（米）**；Pillow `img.info['dpi']=(299.9994, 299.9994)`；IHDR 尺寸仍 **2481×3509**（A4@300dpi）；内容非空白多色渲染正常 ✅（第 169 轮「无 pHYs」P3 闭环）

## T2 逐张 PNG（24 张 zip 抽首/中/尾 3 张）
- 001/013/024 均含 pHYs=11811 px/m（unit=1），换算 **300.0 dpi**；尺寸 1063×354 与第 169 轮基线一致；内容正常 ✅
- 注：本模板标签 90×30mm 未触发小标签提清（1063px/90mm×25.4≈300dpi），倍清路径未另行验证（与整页同一 canvasToPngBlob 通道）。

## T3 eink 精确像素（负向判据）
- `/studio?template=eink800&demo=1` 默认「精确像素（电子墨水屏 800×480）+纯黑白」；导出 zip 抽 3 张：IHDR=**800×480** 精确、chunk 序列 IHDR/PLTE/IDAT/IEND **无 pHYs**（刻意不写 ✅）、像素仅纯黑 (0,0,0) 与纯白 (255,255,255) 两色（二值化无回归）✅

## T4 冒烟（Regression）
- 图片版 PDF（课桌姓名贴）：下载成功，pypdfium2 打开 2 页、A4 595×842pt，渲染正常 ✅
- 打印通道：「打印 / 矢量 PDF」→ 带水印导出，hook 确认 `window.print()` 被调起 1 次（headless 无打印 UI），pageerror 0 ✅

**取证注记**：headless CDP 的 Browser.setDownloadBehavior 会在浏览器级 WS 断开后失效——每个导出脚本内须重新连 browser WS 重设下载目录，否则导出 toast 成功但落盘为空（本轮逐张/eink 首跑即此假象，重设后复跑通过）。

产物：/home/ubuntu/r170_dl/（整页/逐张/eink zip + 2 份 PDF）；截图 /home/ubuntu/screenshots/r170_*。清理：测试 tab 全部关闭。headless 不录屏。

---

# 第 169 轮（2026-08-10）：前进/后退与滚动恢复 + 导出 PNG 物理 DPI 元数据 + 模板缩略图灰字对比度复查 ✅（导航链全绿；**2 条报告项**：导出 PNG 无 pHYs chunk（P3 裁量）、缩略图装饰灰字 2.56:1 但 aria-hidden 纯装饰建议维持现状）

**背景**：无新部署走查轮（bundle `index-BPYEjASD.js`）。

## T1 浏览器前进/后退与状态/滚动恢复
- 真实 UI 导航链 / → /studio（导入 10 行 BOM CSV + 切课桌姓名贴）→ /templates（滚到 scrollY=1200）→ history.back() 回 /studio：roster 键 536B 不变、模板仍课桌姓名贴、名单在 ✅
- history.forward() 回 /templates：scrollY 恢复 1200（router scrollBehavior savedPosition 双 rAF 恢复生效）✅
- 继续 → /seating 后 back×3 逐站 /templates → /studio → /：URL 正确、页面均正常渲染 ✅；forward×1 回 /studio 正常 ✅；全程 pageerror 0 ✅
- 注：Vue SPA 内部导航不触发 bfcache（无整页卸载），状态保持依赖组件缓存与 sessionStorage——实测均不丢。

## T2 导出 PNG pHYs 元数据（报告 only，P3 裁量）
- 整页 PNG（标准清晰度 300dpi，A4）：2481×3509 px（=A4@300dpi 正确）；chunk 序列 IHDR/PLTE/IDAT/IEND——**无 pHYs**。
- 逐张 PNG（24 张 zip，1063×354/张）同样无 pHYs。
- 影响评估：无 pHYs 时看图/打印软件按默认 72/96dpi 解释物理尺寸（A4 会被认成 ~26×37 英寸）。但产品主推打印链路是矢量 PDF/直接打印（有正确物理尺寸），PNG 定位屏显/电子屏；且多数用户打印 PNG 时会选「适应页面」。**定级 P3 裁量**：如需增强，可在 canvasToPngBlob（pngExport.ts L274-291）产物中插入 pHYs（300dpi=11811 px/m，索引色路径可在 rasterizeIndexedPng 输出时一并写入）。仅报告，未改代码。

## T3 模板缩略图灰字对比度（第 122 轮裁量项收口）
- /templates 222 个缩略图容器均 `aria-hidden="true"`（TemplateThumb.vue L55，纯装饰语义正确）。
- 实测缩略图内最浅文字「座位号 SEAT」rgb(148,163,184) 对白底 **2.56:1**（7.3px 装饰小字）；其余装饰字 4.76–17.85:1。
- **结论：建议维持现状**——容器已 aria-hidden，装饰性文本不适用 WCAG 1.4.3（AA 只约束信息性文本）；真实模板导出中的对应字段颜色由模板定义控制，与缩略图渲染无关。裁量项闭环。

**截图**：/home/ubuntu/screenshots/r169_back_studio.png、r169_back_templates_scroll.png、r169_png_export.png、r169_thumb.png、r169_thumb_crop.png。产物：/home/ubuntu/r169_dl/（整页与逐张 PNG zip）。

---

# 第 168 轮（2026-08-10）：#177 /seating 座位号加深至 slate-600 全场景 AA 验收 ✅（computed color=rgb(71,85,105)；白底 7.58:1、blue-50 6.96:1、pink-50 6.94:1 全部 ≥4.5；第 166 轮 P3 观察项闭环）

**部署翻转**：15:49:13 观测 entry `index-BMP5xFFC.js` → `index-BPYEjASD.js`、sw.js md5 `3ab611f8…` → `35927928…`，双采样一致 + 稳定 2 分钟后开测（本次 sw.js 先于 entry 翻转约 30 秒，属边缘节点传播次序差异）。

## T1 对比度全场景 AA（核心）
- 1280×900 /seating「用演示名单」48 席（含性别着色）。
- `.seating-seat-no` computed color = **rgb(71, 85, 105)**（=#475569 slate-600；第 166 轮值 rgb(100,116,139) 可区分）✅
- WCAG 对比度（背景取实测 computed 值）：对白底（`.seating-sheet` 纯白）**7.58:1**、对 blue-50 rgb(239,246,255) **6.96:1**、对 pink-50 rgb(253,242,248) **6.94:1**——三场景全部 ≥4.5 ✅（**第 166 轮 P3 观察项「彩底 4.37:1」闭环**）
- 姓名层级不变：15.1px/700/rgb(15,23,42) > 座位号 10.6px/600，截图 + 2x 裁片目视座位号加深但仍为次级 ✅

## T2 390px 冒烟（Regression）
- sw=cw=390 无横向溢出、48 席渲染、座位号同色 rgb(71,85,105)、pageerror 0 ✅

**截图**：/home/ubuntu/screenshots/r168_seating_1280.png、r168_seatno_crop.png、r168_390.png。

---

# 第 166 轮（2026-08-10）：#176 /seating 座位号小字对比度提升验收 ✅（computed color=rgb(100,116,139)、对白底 4.76:1 ≥4.5 达标；1 条 P3 观察项：男女混排彩色底上为 4.37:1 略低于 4.5）

**部署翻转**：15:33:39 观测 entry `index-YLrANFvw.js` → `index-BMP5xFFC.js`、sw.js md5 `30110b96…` → `3ab611f8…`，双采样一致 + 稳定 2 分钟后开测。

## T1 对比度（核心）
- 1280×900 /seating「用演示名单」生成 48 席（演示名单含性别，默认男女着色）。
- `.seating-seat-no` computed color = **rgb(100, 116, 139)**（=#64748b 新值；旧值 rgb(148,163,184) 可区分）✅
- WCAG 对比度（手算）：新色对白底 **4.76:1 ≥4.5** ✅（旧色仅 2.56:1）；纸面 `.seating-sheet` 背景为纯白 rgb(255,255,255)。
- **P3 观察项**：演示名单默认男女着色时座位格背景为 blue-50 rgb(239,246,255)/pink-50 rgb(253,242,248)，新色在其上为 **4.37/4.36:1，略低于 4.5**（旧色仅 2.36:1，仍大幅改善）。PR 目标为白底 ≥4.5 已达成；如需全场景 AA，可再加深一档（slate-600 #475569 对 blue-50 约 6.5:1）。裁量项。
- 视觉层级：姓名 15.1px/700/rgb(15,23,42) > 座位号 10.6px/600/灰，截图与放大裁片确认座位号仍为次级小灰字 ✅

## T2 冒烟（Regression）
- 1280px 拖拽换座 seat1↔seat2：王伟丽↔李磊平 互换成功、pageerror 0 ✅
- 390×844：sw=cw=390 无横向溢出、48 席渲染、座位号同色 rgb(100,116,139)、pageerror 0 ✅

**取证注记**：/seating 首次进入未点演示名单前查询 `.seating-seat-no` 会命中未布名单的空格（computed 呈继承值 16px/oklch），须先「用演示名单」并等 `.seating-seat-name` 出现真实姓名再断言 computed style。

**截图**：/home/ubuntu/screenshots/r166_seating_1280.png、r166_seatno_crop.png（2x 放大裁片）、r166_390.png。

---

# 第 164 轮（2026-08-10）：#174 /vs 移动端「左右滑动」提示验收 + #126 SW 一刷接管补测 ✅（4 个 /vs 详情页 390px 提示可见+表可横滑、桌面端隐藏无回归；第 159 轮起待测的 #126 新部署 SW 一次刷新接管闭环）

**背景**：#174 合入 main（VsDetailView.vue L50 新增 `sm:hidden` 提示行「← 左右滑动查看完整对照表 →」），含 JS 变更 → 产生新 SW 版本，可真实补测 #126。

**部署翻转**：15:18:54 观测 entry bundle `index-DTLWjJ7n.js` → `index-YLrANFvw.js`，sw.js md5 `653c7c99…` → `30110b96…`，双采样一致 + 稳定 2 分钟后开测。

## T1 #126 SW 一次刷新接管（补测闭环）
- 翻转前 tab A：旧 bundle、SW activated、precache 57 条含旧 bundle（r164_before.png）。
- 翻转后 tab A **只刷新一次**：加载 entry = 新 `index-YLrANFvw.js` ✅；controller 非空、active.state=activated、waiting=null（skipWaiting+clientsClaim，无需二刷）✅；precache 短暂过渡（61 条新旧并存）后数秒内收敛为 57 条**含新 bundle、旧 bundle 已清** ✅；Hero 正常渲染、pageerror 0 ✅。截图 r164_sw_takeover.png。
- **#126「新部署 SW 一刷接管」自第 159 轮以来的 untested 项正式闭环。**

## T2 /vs 提示行（#174）
- 390×844 逐页（chuangkit / wps-mail-merge / placecard-us / canva）：提示元素 display:block、rect 358×20 在视口内可见（截图 r164_390_*.png，浅灰小字位于对照表上方）；对照表容器 sw560/cw356 可横滑（scrollLeft 0→200 生效）；document scrollWidth=clientWidth=390 无页面级横向溢出；pageerror 0 — 4/4 ✅
- 1280×900 桌面：提示元素 display:none / offsetHeight=0，不显示；表区布局正常（r164_1280_chuangkit.png）✅

**取证注记**：新 SW activate 后 precache 清理是异步的——一刷后立即查询会看到新旧条目并存（57→61→57），数秒后收敛；判接管以「加载的 entry hash 为新值 + waiting=null」为准，precache 收敛作旁证。

**截图**：/home/ubuntu/screenshots/r164_before.png、r164_sw_takeover.png、r164_390_chuangkit.png、r164_390_wps-mail-merge.png、r164_390_placecard-us.png、r164_390_canva.png、r164_1280_chuangkit.png。

---

# 第 162 轮（2026-08-10）：教程内容质检抽样 + 样例 Excel 下载链路 + 依赖安全审计 ✅（10 篇教程全绿零死链、样例下载→再导入回路全通、npm audit 0 critical / 6 high 均为间接依赖且实际可利用性低，仅报告不升级）

**背景**：无产品代码变更轮（自上轮仅纯文档 PR #172）。三方向：教程质检抽样、样例文件链路、依赖安全。

**方法**：guides 数据文件共 76 slug（用户口径 66 为旧数，按线上实际 76 抽样），跨 13 类目等距抽 10 篇（考务外覆盖会务/会议/使用技巧/婚庆/对比/打印/打印技巧/排版/教学/数据）；HTTP 层 curl+正则核验 title/h1/结构/死链，quickStart CTA 用 headless Chromium 真实点击落地核验；样例 Excel 经 CDP 下载捕获 + openpyxl 外部读取 + 原样再导入闭环；`npm audit --json`（--omit=dev 与全量）+ `npm ls` 链路溯源。未升级任何依赖。

## T1 教程质检（10 篇）

| 检查项 | 结果 |
|---|---|
| 10 篇全部 HTTP 200，title 与 h1 一致 | ✅ |
| 结构完整：每篇 8–10 个 h2、含 FAQ、无空节 | ✅ |
| 站内链接 52 个去重 URL 全 200，死链 0 | ✅ |
| quickStart CTA 实点 5 篇：standard/meetingTent/weddingPlace 三种 `?template=…&demo=1` 落地后模板名出现在页面且演示名单已载入；/papers 与 /seating 落地正确 | ✅ |
| 事实性抽查：①「打印校准向导」真实存在（studio「打印校准」→ 三步向导 + 校准页 PDF，与 print-offset-calibration-wizard 描述一致）；②「按整页导出」PNG 选项真实存在（label-print-troubleshooting 声明）；③ 分享解锁/水印配额徽标存在（share-unlock-watermark-free：「无水印导出（今日剩余 N 次）/带水印导出（不限次数）」）；④ /seating 男女混排等（classroom-seating-chart-print）已由第 160 轮实测支撑 | ✅ |

## T2 样例 Excel 下载→再导入回路
- 标准考场版：toast「「考场座位」样例已下载」→ `考场座位样例.xlsx`（表头 姓名/性别/考场/座位号/准考证号/班级/学号/学校/身份证号，5 行，无乱码）→ 原样再导入「已读取 5 条数据」、**0 个未映射** ✅
- 课桌姓名贴：`班级教学样例.xlsx`（表头 姓名/班级/学号/小组/座位号/科目/老师/学校）同判据通过，样例内容随模板场景变化 ✅

## T3 依赖安全（npm audit，报告 only）
- **critical 0**。生产依赖树（--omit=dev）：high 4（brace-expansion / fast-uri / nanoid / postcss），全量另有 glob、undici（dev）。
- 可利用性评估（npm ls 溯源）：4 个"prod" high 全部经 `vite-plugin-pwa → workbox-build / vite` 传入——**均为构建期工具链依赖，不进浏览器 bundle**，运行时为纯静态站，无服务端 Node 暴露面；undici/glob 亦为 dev 工具链。综合定级：**无需紧急处置，建议随下次依赖例行升级消化**（vite-plugin-pwa/workbox-build 升级可收敛大半）。明细见 `/home/ubuntu/r162_audit_prod.json`、`r162_audit_all.json`。

**截图**：/home/ubuntu/screenshots/r162_cta_*.png（5 张 CTA 落地）、r162_fact_calibration.png、r162_fact_png_dialog.png、r162_sample_download.png、r162_sample_import_standard.png、r162_sample_import_deskName.png。样例文件：/home/ubuntu/r162_dl/。

---

# 第 161 轮（2026-08-10）：性能回归审计 ✅（五页双端无 >15% 劣化，多项改善；全站移动 CLS=0、桌面首页 CLS=0 保持；#122 idle 注入、40 行导入均无退化；/vs 与 /desk-card-generator 建立移动新基线）

**背景**：无代码变更审计轮。距第 117–118 轮基线已隔 40+ PR（生僻字字库、SW 改造、安全头、SEO 新页、CSV 编码等）。bundle `index-DTLWjJ7n.js`。

**方法**：npx lighthouse 13.4.1 + headless Chromium（口径同 117/118：移动=moto G4 仿真+4x CPU+slow4G；桌面=--preset=desktop）；`/` 与 `/studio` 移动 ≥3 跑取中值；#122 用全新浏览器上下文冷加载 + Network 事件对照 loadEventFired；导入耗时 9222 真实 UI 0.05s 轮询 toast。判据：劣化 >15% 观察项、>30% P2。

## 结果（Perf/A11y/BP/SEO · LCP/TBT/CLS，中值）

| 页面 | 本轮移动 | 基线移动 | 本轮桌面 | 基线桌面 |
|---|---|---|---|---|
| `/` | **91**（78/95/91）/100/58/100 · 1.87s/283ms/**0** | 86–92 · ~1.9s · 0 | **100×3** · 0.48s/0ms/**CLS 0.0000×3** | 100 · CLS 0（#137） |
| `/templates` | **75** · 3.86s/224ms/0 | 64 · 4.09s/431ms | 100 · 0.49s/0 | 98 |
| `/studio` | **82.5**（82/83/56/83，4 跑）· LCP 中值 **3.69s** · TBT 244ms · **CLS 0** | 71 · 4.79s · 356ms · 0（118 轮新基线） | — | — |
| `/pricing` | 98 · 1.72s/61ms/0 | 99 | 100 | 100 |
| `/guides/label-print-troubleshooting` | 98 · 1.70s/91ms/0 | 98 | 100 | 100 |

- 五页双端 SEO 全 100、A11y ≥96、BP 58（统计第三方 Cookie 既有扣分，非回归）；**移动 CLS 全 0、桌面首页 CLS 0.0000×3**（#120/#137 保持）。
- `/studio` 移动较 118 轮基线**改善**：Perf 71→82.5、LCP 4.79→3.69s、TBT 356→244ms（第 117 轮观察项按本轮口径正式收敛，非回归）。`/templates` 移动 64→75 亦改善。跑 3 LCP 9.98s 为单次网络离群（同批其余三跑 3.65–3.70s），如实记录。
- `/` 移动跑 1 Perf 78（LCP 2.87s）为冷跑离群，与 117 轮同现象；中值 91 与基线持平。

## 新页面移动基线（首测，各 2 跑）
- `/vs`：Perf 98/100 · LCP 1.53–1.75s · TBT 35–78ms · CLS 0 · SEO 100 — 健康（≥85）
- `/desk-card-generator`：Perf 98/100 · LCP 1.03–1.41s · TBT 61–71ms · CLS 0 · SEO 100 — 健康

## #122 统计脚本 idle 注入（Regression）
- 全新上下文冷加载 `/`：分析类请求共 14 个（gtag/hm.baidu/push.js/clarity 等），**load 事件前 0 个**，全部在 load 后 +0.01s 起注入 — passed。

## 40 行 Excel 导入耗时（Regression，#135 口径）
- 两次独立导入 `r113_40.xlsx`：toast「已读取 40 条数据」**0.107s / 0.106s**（基线 0.12–0.13s）— 无退化。
- 取证注记：/studio 现有 2 个 file input（第 1 个为「导入 JSON」accept=.json），Excel 注入须选 accept 含 .xlsx 的那个，否则静默无 toast。

**产物**：JSON `/home/ubuntu/r161_lighthouse/`（19 份）；截图 `r161_import_run1/2.png`；脚本 `/home/ubuntu/r161_lh.sh`、`r161_t34.py`、`r161_t4c.py`；计划 test-plan-round161.md。

---

# 第 160 轮（2026-08-10）：/seating 座位表深度回归 + 长链分享全链路 ✅（全部通过，无新增 P0–P3；2 条取证注记）

**背景**：无代码变更探索/回归轮。距第 87 轮座位表专项后历经 #105 桌贴联动、#76 状态持久化、#123 键盘换座等多次重构，做一次综合回归 + 长链 `#tpl=` 分享全链路。

**方法**：生产 www.seatmark.cn，headless Chromium 29229 真实 UI（1500×1000 与 390×844）；打印路径用 override window.print 延迟 afterprint + `Page.printToPDF(landscape,A4)` 捕获真实打印产物并以 pypdfium2 提取文本核验；分享还原用 `Target.createBrowserContext` 全新无痕上下文新 tab（技能判据）。

## 结果

| 验收点 | 结果 |
|---|---|
| /seating 基础：4×5 行列设置、演示名单 20 人、过道（第 2-3 列间）4 处渲染 | ✅ |
| 完全随机排座：序变化且同一多重集；「已完全随机排座」toast；男女混排 toast | ✅ |
| 拖拽换座（Pointer 拖 seat1→seat8）：姓名互换（陈发春↔黄霞伟），拖拽中截图 | ✅ |
| 键盘换座（#123）：focus+Enter 选中→Enter 互换（张涛利↔杨敏强） | ✅ |
| 讲台开关：取消勾选 `.seating-podium` 消失、勾回恢复 | ✅ |
| 状态持久化（#76）：reload 后 4×5、过道、换座后网格 20 席逐席一致 | ✅ |
| 一键生成对应桌贴（#105）：跳 /studio?from=seating，toast「已切换到课桌贴模板」+「座位表名单已带入｜共 20 人」；roster 5 字段（姓名/座位号/排/列/班级）20 行正确，预览按课桌姓名贴渲染姓名+班级 | ✅ |
| 座位表打印（#77）：toast「即将调起浏览器打印」；打印瞬间宿主含「讲　台」；printToPDF A4 横向捕获含标题/讲台/「共 4 排 × 5 列 · 20 人 · 教师视角」/全部姓名 | ✅ |
| 长链分享：「复制当前模板分享链接」→ `#tpl=v1.` URL（1164 字符）；无痕新 tab 弹「收到一个分享模板」（含 mm 规格）→「仅本次使用」→「已应用分享模板」预览正常 | ✅ |
| 篡改 hash 容错（147 判据）：payload 中段替换后新 tab 打开 toast「分享链接无效」、studio 正常渲染不白屏、无 pageerror | ✅ |
| 390×844 冒烟：sw=cw=390 无横向溢出、20 席网格渲染 | ✅ |
| 全程 pageerror | 0 |

**取证注记**（自动化假象，非缺陷）：① 拖拽结束会置 suppressClick，紧跟其后的首次 Enter 键换座会被吞掉——键盘换座需在无未决拖拽状态下测；② headless 下 `navigator.clipboard.writeText` 静默失败且无失败 toast（真实浏览器不受影响），取分享链接需 shim writeText 捕获。

**截图**：/home/ubuntu/screenshots/r160_seating.png、r160_drag.png、r160_kbswap.png、r160_persist.png、r160_handoff_toast.png、r160_handoff.png、r160_print_toast.png、r160_print.png（打印捕获渲染）、r160_share_copy.png、r160_share_restore_dialog.png、r160_share_restore.png、r160_share_bad.png、r160_390.png。打印产物：/home/ubuntu/r160_print.pdf。

---

# 第 159 轮（2026-08-10）：#168 manifest lang=zh-CN 部署翻转验收 ✅（manifest 全绿；#126 SW 一刷接管仍 untested——本次部署未产生新 SW，如实报告）

**背景**：#168 / 28aaa28 在 VitePWA manifest 增 `lang:'zh-CN'`。轻量轮：验收线上 manifest + 顺带补测 #126「新部署 SW 一次刷新接管」。

**方法**：部署翻转前在 headless Chromium 开 tab A（旧态：bundle index-DTLWjJ7n.js、SW activated、sw.js md5 653c7c99…），轮询线上 manifest lang 直至翻转（14:29 翻转为 zh-CN），tab A 一次刷新后核验；curl 全字段 diff manifest；页面上下文 fetch 复核；CacheStorage 冒烟。计划：test-plan-round159.md。

## 结果

| 验收点 | 结果 |
|---|---|
| 线上 manifest.webmanifest `lang == "zh-CN"`（curl 与页面 fetch 双确认） | ✅ |
| 其余字段与第 156 轮记录逐字段一致：name/short_name/description/start_url=//display=standalone/background_color=#ffffff/theme_color=#4f46e5/scope=//icons 3 项（192+512+maskable） | ✅ |
| 部署翻转后 tab A 一次刷新：页面正常渲染（Hero）、controller 存在且 activated、waiting=null、无 pageerror | ✅ |
| PWA 冒烟：workbox-precache-v2 57 条、plangothic 0 条、含现行 bundle 条目 | ✅ |
| #126「新部署 SW 一次刷新接管」 | ⚠️ untested（见下） |

**覆盖注记（#126 仍 untested，非缺陷）**：本次部署只改了 manifest.webmanifest——该文件不在 precache globPatterns（js/css/html/svg/png/woff2）内，且 JS/HTML 均未变化，故 sw.js 内容翻转前后 md5 完全相同（653c7c99…）、**未产生新 SW 版本**，「新 SW 一刷接管」路径本轮无从触发。manifest 是浏览器直接按 HTTP 获取的（导航 NetworkFirst），新 lang 一刷即达，不依赖 SW 更新。#126 需等下次含 JS/CSS/HTML 变更的部署再补。

**截图**：/home/ubuntu/screenshots/r159_before.png、r159_after_reload.png、r159_smoke.png。数据：/home/ubuntu/r159_tab.json。

---

# 第 157 轮（2026-08-10）：#165 CSV 编码修复线上复测 ✅（第 156 轮 P3-1「无 BOM UTF-8 CSV 乱码」闭环）

**背景**：#165 / commit 274cf00（app/src/utils/excel.ts 新增 decodeCsvText：.csv 先 TextDecoder('utf-8',{fatal:true}) 严格解码剥 BOM，非法字节回退 gb18030，type:'string' 交 SheetJS；.xlsx/.xls 与 #159 PK 校验不变）。

**方法**：轮询确认 EdgeOne 部署新 bundle（index-BB02NSJB.js → index-DTLWjJ7n.js，两次采样一致后开测）→ 生产 www.seatmark.cn，headless Chromium 29229 单前台 tab 真实 UI 文件注入，第 156/147/150 轮同素材 + 新造 GB18030 CSV。计划：test-plan-round157.md。

## 结果

| 复测点 | 结果 |
|---|---|
| 无 BOM UTF-8 CSV（r156_fix.csv，10 行含王𫖯）：导入成功、表头「姓名/考场/座位号」全中文、无 mojibake、姓名字段映射、预览 10 枚含「王𫖯」正常渲染（第 156 轮乱码现象消失） | ✅（P3-1 闭环） |
| 带 BOM UTF-8 CSV：同判据通过；首表头字符码 [22995,21517]=「姓名」，无 \ufeff 残留 | ✅ |
| GB18030 CSV（gb18030 写入 8 行，张三丰/赵𫖯）：导入成功、表头/数据全中文、预览 8 枚（含扩展区汉字𫖯）正常 | ✅ |
| 回归：正常 .xlsx（12 行）「已读取 12 条数据」 | ✅ |
| 回归：改名垃圾 .xlsx 仍报「文件内容不是有效的 .xlsx 工作簿…」（#159 判据，未走 CSV 兜底） | ✅ |
| 回归：多 sheet xlsx「已读取 1 条数据；文件含 2 个工作表，可在导入面板切换」，导入面板 select 名单A→名单B 切换后重新导入渲染正常 | ✅ |
| 全程 pageerrors 空 | ✅ |

**注记**：多 sheet 切换 UI 为导入面板内的 `<select>` 下拉（非弹窗按钮），取证脚本注意。测试时工作区沿用课桌姓名贴模板（班级/学号字段对 3 列 CSV 显示「未映射」为预期行为，非编码问题）。

**截图**：/home/ubuntu/screenshots/r157_nobom.png（关键：无 BOM 中文表头+预览正常）、r157_bom.png、r157_gbk.png（关键：GB18030 张三丰/赵𫖯）、r157_xlsx.png、r157_fake_rejected.png、r157_2sheet_panel.png、r157_2sheet_imported.png。素材：/home/ubuntu/r156_fix.csv、r156_fix_bom.csv、r157_gbk.csv、r150_fix.xlsx、r147_fix/fake_text.xlsx、r147_fix/r149_2sheet.xlsx。脚本：/home/ubuntu/r157_run.py。

---

# 第 156 轮（2026-08-10）：PWA 离线全流程走查 ✅（无新增 P0–P2；1 项 P3 观察项：无 BOM 的 UTF-8 CSV 中文表头乱码；1 项覆盖注记：生僻字离线降级警告未触发）

**背景**：无代码变更纯 QA 轮。此前仅测过弱网壳页兜底与 SW 接管（#125–#127），本轮首次完整离线链路验收。代码依据：vite.config.ts VitePWA（precache js/css/html/svg/png/woff2、plangothic 字库不预缓存、导航 NetworkFirst 4s + precacheFallback 壳页、skipWaiting+clientsClaim）、main.ts:38 注册 /sw.js、glyphSupport.ts:115-122 字库下载失败降级警告、quota.ts 匿名配额纯 localStorage。

**方法**：生产 www.seatmark.cn（bundle index-BB02NSJB.js），headless Chromium 29229 单前台 tab，CDP Network.emulateNetworkConditions 切换离线；导出错分钟避免重名覆盖；产物 PIL/zipfile/pypdfium2 核验。计划：test-plan-round156.md。

## 结果

| 验收点 | 结果 |
|---|---|
| SW activate（ready.active.state=activated、controller 生效、scope=/） | ✅ |
| precache：workbox-precache-v2 57 条（48 js、2 css、含 index.html/图标），plangothic 分包 0 条（按设计不预缓存）；pages 运行时缓存 32 条 | ✅ |
| manifest.webmanifest：name/short_name/icons(192+512+maskable)/display=standalone/start_url=//theme_color=#4f46e5 全合规；`lang:"en"`（中文站）如实记录不定级 | ✅（附注记） |
| 完全离线重开 /（Hero 正常）与 /studio（选择模板+工具栏完整渲染） | ✅ |
| 离线打开未访问过的路由 /guides/desk-card-font-size：壳页兜底 + SPA 客户端渲染出完整教程正文（正文 2029 字符），不白屏、无 pageerror | ✅ |
| 离线导入 CSV（UTF-8 BOM，10 行含生僻字「王𫖯」）：「Excel 导入成功｜已读取 10 条数据」，预览 10 枚、表头自动匹配 | ✅ |
| 离线切模板（标准考场版→课桌姓名贴）：toast「模板已切换」、演示数据换为「班级教学」、24 标签 2 页正常渲染 | ✅ |
| 离线导出：逐张 PNG zip（10 张 1000×534）+ 整页 PNG（2481×3509，10 枚 1 页时直接落单 PNG 非 zip）+ 图片版 PDF（1 页可渲染）全部成功；配额徽标走本地 localStorage（{"date":"2026-08-10","used":1}，剩余 0 如实显示），带水印导出不受离线影响不阻塞 | ✅ |
| 全程统计/API 请求失败无用户可见报错、pageerrors 全空 | ✅ |
| 恢复在线刷新：roster（563B）/预览 10 枚/custom-templates 全部无丢失；SW 仍 activated、bundle 一致（本轮无新部署，#126 一刷接管无法真部署复测，按现状断言） | ✅ |
| 390×844 离线重开 /studio：完整渲染、scrollWidth=clientWidth=390 无横向溢出 | ✅ |

**P3-1（观察项）**：不带 BOM 的 UTF-8 CSV 中文表头/内容全部乱码（Ã¥Â§â€¦ 型 mojibake）——「导入成功 10 条」但字段全部「未映射」，无编码错误提示；加 BOM 后完全正常。与离线无关（在线同现）。裁量项：CSV 解析可尝试 UTF-8 优先或检测失败提示编码问题。

**覆盖注记**：生僻字扩展字库离线降级警告未能触发——测试字符 𫖯（U+2B5AF）被 headless 环境系统字体（Noto CJK）直接覆盖并在导出 PNG 中正常渲染，未走扩展字库下载路径，警告链路本轮 untested（非缺陷）。

**截图**：/home/ubuntu/screenshots/r156_home_online.png、r156_offline_home.png、r156_offline_studio.png、r156_offline_unvisited.png、r156_offline_import_bom.png、r156_offline_import.png（P3-1 乱码证据）、r156_offline_switch_template.png、r156_offline_export1.png、r156_offline_390.png、r156_online_restored.png、r156_label10_rare.png。导出物：/home/ubuntu/r156_dl/（逐张 zip、整页 PNG×2、图片版 PDF）。脚本：/home/ubuntu/r156_t1/t2/t3/t4/t4b/t4c/t5.py。

---

# 第 155 轮（2026-08-10）：#160 SEO 新页面线上验收 ✅（/vs 矩阵 5 页 + 2 长尾落地页全部通过，无新增 P 级问题）

**背景**：SEO 子会话 #160（commit 5c1b44a）已合入 main 并部署到生产。新增 /vs 对比索引 + /vs/chuangkit、/vs/wps-mail-merge、/vs/placecard-us、/vs/canva 与 /desk-card-generator、/name-card-batch。本轮直接线上验收（部署已稳定，未见边缘传播窗口现象）。

**方法**：curl 抓取 prerender 静态 HTML 做 SEO 元数据/JSON-LD/FAQ 一致性/内链解析（生产为 prerender 静态 HTML，HTTP 检查权威）；headless Chromium 29229 真实 UI 做 1280×900 / 390×844 视口渲染、CTA 点击与老页面回归；事实性对照 docs/competitive-round3.md 与 docs/competitive-analysis.md。计划：test-plan-round155.md。

## 结果

| 验收点 | 结果 |
|---|---|
| 7 个新 URL 全部 HTTP 200 | ✅ |
| title/description/canonical/OG(title/description/image/url)/twitter:card 全部非空，canonical 与 og:url 精确等于页面 URL | ✅ 7/7 |
| JSON-LD 全部可解析：/vs=CollectionPage+Breadcrumb；4 个对比页=Article+FAQPage+Breadcrumb；2 个落地页=SoftwareApplication+HowTo+FAQPage+Breadcrumb | ✅ |
| FAQPage 与可见 FAQ 一致（对比页各 3 问、落地页各 4 问，JSON-LD 问题文本全部出现在可见 HTML，missing=0） | ✅ 6/6 |
| sitemap.xml 收录（324→331，7 个新 URL 全在）；llms.txt 收录 /vs、/desk-card-generator、/name-card-batch | ✅ |
| footer 新增 3 内链（工具对比选型/桌牌在线生成/姓名卡片批量生成）在首页存在且可达 | ✅ |
| 新页面全部站内内链（35 个去重 URL，含 relatedGuides、CTA）线上 GET 全 200，无死链 | ✅ |
| 事实性抽查：创客贴（微信扫码登录墙、无名单批量/拼版、印刷下单独有、会员 ¥139 起）、placecard.us（Excel/CSV/Google Sheets+字段映射、~100+ 欧美婚礼风、无校准向导/照片匹配/eink、水印预览免费+$12.9 起一次性）、Canva（国际版 Bulk Create 中文站受限、¥168/年、无毫米级拼版）、WPS（邮件合并多步、稻壳会员约 ¥179）——全部能在 competitive-round3.md / competitive-analysis.md 找到实测支撑，无编造能力；页面均披露「2026-08 实际上手调研，以对方官网最新为准」 | ✅ |
| 1280×900 与 390×844：/vs、/vs/chuangkit、/desk-card-generator scrollWidth<=clientWidth 无横向溢出；390 下对照表为 overflow-x-auto 内部滚动容器（sw560/cw356，可横滑看全，页面本身不溢出），布局正常 | ✅ |
| CTA：/desk-card-generator 「开始制作」→ /studio 正常渲染（模板列表出现），无 pageerror | ✅ |
| 回归（Regression）：/ /templates /studio?demo=1 正常渲染、26 标签 2 页预览正常，pageerror 全空 | ✅ |

**注记**：test-report.md 在 main 分支上是旧版（第 150–154 轮报告在分支 devin/1786368685-skill-r154 的 69f4feb 提交），本轮已先 `git checkout 69f4feb -- test-report.md` 恢复完整 80 节后再追加。

**截图**：/home/ubuntu/screenshots/r155_1280_vs_index.png、r155_1280_vs_chuangkit.png、r155_1280_deskcard.png、r155_390_vs_index.png、r155_390_vs_chuangkit.png、r155_390_table_scrolled.png、r155_390_deskcard.png、r155_cta_studio.png、r155_reg_home/templates/studio.png。脚本：/home/ubuntu/r155_seo.py、/home/ubuntu/r155_ui.py；数据：/home/ubuntu/r155_seo.json、r155_ui.json。

---

# 第 154 轮（2026-08-10）：PR #162 裁切线二修（内联 SVG）线上复测 ✅（第 150 轮裁切线问题闭环；附 1 项部署过渡期观察注记）

**方法**：轮询确认 EdgeOne 部署新 bundle（`index-CuMqeM6b.js` → `index-BB02NSJB.js`，代码依据 commit 3497116 / PR #162：LabelSheet.vue cut-layer 改为单个 `<svg viewBox="0 0 W H">` + `<line stroke-width="0.35" stroke-dasharray="1.2 1.2">`，main.css 渐变规则删除）→ 生产 www.seatmark.cn，headless Chromium 29229 真实 UI（standard a4-24up demo 26 行 2 页 + deluxeConfAurora），导出物 PIL/zipfile/pypdfium2 像素核验（2481px/210mm ≈ 11.81px/mm，判据同第 152 轮）；打印路径「延迟 afterprint 10s 按住宿主 + Page.printToPDF(printBackground)」。不录屏（headless）。

**结论**：
- ✅ **整页 PNG：裁切线 ON/OFF 现有真实差异（第 152 轮 P2 修复确认）**——ON 首页 md5 `ee1f745e…` ≠ OFF 首页 md5 `68a9e834…`（OFF 与旧无线渲染字节一致，符合预期）；ON 时 v@73mm、v@137mm ±3px 条带 frac=0.532、trans=247（约 1:1 虚线，与打印捕获基线一致），两页均有；OFF 时同坐标 frac=0.000。多次复验（1248/1250/1256/1301/1319 五次 ON 全部有线；1300/1309/1317 三次 OFF 全部无线）。
- ✅ 图片版 PDF：ON 导出首页 pypdfium2 渲染 v@73/137mm frac=0.567、trans=247——虚线进入图片版 PDF。
- ✅ 逐张 PNG 仍无裁切线：26 张标签图（1000×534），边缘仅标签自身实线边框（top/left edge trans=0），hostSuppressCutLines 路径不受影响。
- ✅ 预览回归：`svg.cut-layer`（viewBox="0 0 210 297"）内 13 条 `line.cut-line`（x=11/73/137/199mm 垂直 + 9 条水平），stroke-dasharray="1.2 1.2"、stroke-width 0.35——虚线位置/密度与第 150/152 轮一致；关闭复选框后 svg 消失；首页 Hero（show-cut-lines 常开）svg 13 条正常渲染不破版，无 pageerror。
- ✅ 打印宿主回归：print 触发瞬间宿主 2 页 × 2 svg × 26 line；printToPDF 捕获 v@73/137mm frac=0.537、trans=247——打印路径虚线保持。
- ✅ 冒烟：standard 2 页 / deluxeConfAurora 6 页整页导出均 2481×3509、内容正常（aurora p1 ink 1202283），无 pageerror。
- **观察注记（不定级，无法在稳定态复现）**：bundle 切换后约 12:25–12:44 的过渡窗口内，3 次「裁切线 ON」整页导出产物为无线渲染（md5 = 旧行为 `68a9e834…`），且出现 1 份排版破损的整页 zip（单列大格无姓名，疑似新 JS + 旧 CSS 的边缘节点资产错配）；12:48 起全部导出行为稳定正确（5 次 ON 全有线）。另：同一分钟内两次导出的 zip 文件名相同（`模板名-YYYYMMDD-HHMM.zip`），CDP allow 下载模式下会静默覆盖，测试取证需错开分钟或分目录。
- 既有运维项不变：`x-seatmark-storage: memory` + SES 未配置，认证链路持续 untested。

**证据**：/home/ubuntu/screenshots/r154_*（关键：r154_png_on_off.png ON/OFF v@73 对比、r154_preview_cutlines.png、r154_pdf_v73.png、r154_print_v73.png、r154_hero.png、r154_perlabel_first.png、r154_aurora_p1_thumb.png）；导出物 /home/ubuntu/r154_dl3/（ON 1319.zip / OFF 1317.zip / 逐张 1312.zip / print_capture.pdf / aurora 1326.zip）+ /home/ubuntu/r154_dl2/（图片版 PDF 1302.pdf）；SVG 独立可栅格化复现 /home/ubuntu/r154_repro.html（html2canvas-pro@2.0.4 渲染 svg dashed line frac=0.531/trans=50）。**第 150 轮发现、第 152 轮定级 P2 的「整页导出静默丢裁切线」自此闭环。**

# 第 152 轮（2026-08-10）：PR #161 裁切线导出修复线上复测 ❌（核心复测点未通过：整页 PNG / 图片版 PDF 仍丢裁切线，P2）

**方法**：生产 www.seatmark.cn（bundle `index-CuMqeM6b.js` / `index-CsAP7MKc.css`，已含 f09e1a4 的 repeating-linear-gradient 裁切线 CSS），headless Chromium 29229 真实 UI，standard（a4-24up 原生排版，demo 26 行 2 页）+ deluxeConfAurora 冒烟；导出物 PIL/zipfile/pypdfium2 像素核验；打印路径用「按住 afterprint 10s + Page.printToPDF(printBackground)」捕获真实打印栅格。不录屏（headless）。

**结论**：
- ❌ **P2：整页 PNG 导出裁切线仍然静默丢失**——裁切线 ON/OFF 两次整页导出 **md5 完全相同**（`68a9e834…`），列间隙裁切线位置（v@73mm、v@137mm）像素全白（frac=0.000）。与第 150 轮（修复前）行为一致，#161 对整页 PNG 无效。
- ❌ **P2（同因）：图片版 PDF 同样无裁切线**——pypdfium2 渲染首页，v@73/137mm frac=0.000。
- **根因独立复现**（/home/ubuntu/r152_repro.html + html2canvas-pro@2.0.4 CDN）：html2canvas-pro 2.0.4 **不栅格化 repeating-linear-gradient 背景**（mm 或 px 停止点均失败，frac≈0.010），**纯色背景可以**（frac=1.000）。即修复方向（dashed border→背景渐变）恰好落在 html2canvas-pro 的另一个不支持点上。可行替代：纯色细线（solid 可栅格化，已验证）、SVG data-URI background-image、或导出 onclone 时以子元素小段实色 div 拼虚线。
- ✅ 预览：裁切线 ON 时 13 条线（v@11/73/137/199mm，h@10…293mm）虚线正常显示，位置/密度与第 150 轮一致；OFF 消失；首页 Hero 排版正常（13 条 cut-line）无破版，无 pageerror。
- ✅ 逐张 PNG：26 张标签图边缘仅有标签自身实线边框（trans=0），无裁切线杂线——hostSuppressCutLines 路径不受影响。
- ✅ 浏览器打印宿主：window.print 触发瞬间宿主 2 页 × 13 条 .cut-line（width 0.35mm，computed background 为 repeating-linear-gradient）；**真实打印栅格捕获**（printToPDF + printBackground）v@73/137mm frac=0.503、trans=248——约 1:1 虚线正确出现在打印输出中（@media print 的 print-color-adjust:exact 生效）。「打印 / 矢量 PDF」路径已被 #161 修复。
- ✅ 冒烟回归：standard 整页 2 页 / deluxeConfAurora 整页 6 页导出均 2481×3509、内容正常，无 pageerror。（注：`?template=aurora` id 不存在会兜底 standard，正确 id 为 deluxeConfAurora。）

**证据**：/home/ubuntu/screenshots/r152_*（关键：r152_export_vs_print.png 导出 vs 打印对比、r152_png_on_off.png、r152_prev_crop.png、r152_pdf_v73.png、r152_print_v73.png、r152_repro_h2c.png）；导出物 /home/ubuntu/r152_dl/（ON/OFF 整页 zip、逐张 zip、图片版 PDF、print_capture.pdf、aurora zip）；复现页 /home/ubuntu/r152_repro.html。

# 第 150 轮（2026-08-10）：数据视图交互 × 预览辅助选项组合深度 + Firefox 全流程冒烟（生产站，无代码改动）✅（1 项设计事实注记）

**方法**：生产 www.seatmark.cn（bundle `index-DkfDPQCs.js`，与 repo fedd014 一致），headless Chromium 29229 真实 UI（表头点击/漏斗筛选/复选框/单张覆写弹窗均为真实鼠标事件），导出物 PIL/zipfile/pypdfium2 像素核验；Firefox 用 Playwright firefox 121 全流程冒烟。名单 /home/ubuntu/r150_fix.xlsx（12 行，姓名/组别 A/B/编号 01–12 乱序）。不录屏（headless）。

## 1. 数据表交互（全通过）
- 「查看全部数据（可筛选排序）」弹窗点「编号」表头三态循环：升序 01–12（上箭头）→ 降序 12–01（下箭头）→ 恢复导入原序（07,03,11,01,09,05,12,02,08,04,10,06）——与 workspace.toggleSort 设计一致。截图 r150_sort_asc/desc/reset.png。
- 漏斗筛选「组别」只勾 A → 6/12 条；叠加编号升序 → 表格 07..12 全 A 组；预览 `.sheet-page` 标签顺序与表格逐一一致（07 赵一 → 12 郑七）。截图 r150_sort_filter.png、r150_preview_sortfilter.png。
- 主面板出现「排版顺序：…」提示条 +「恢复原序」按钮；点击后条消失、恢复原序。截图 r150_view_banner.png。
- 刷新后：名单恢复（sessionStorage roster），但排序/筛选态清空——**设计上不持久化**（workspace.ts:157-186 的 roster watch 不含 sort/columnFilters/rowOverrides），如实记录非缺陷。截图 r150_after_reload.png。

## 2. 单张覆写（全通过；覆写以行对象为键，跟行不跟索引）
- 点击预览「赵一/07」标签 → 覆写弹窗改姓名为「覆写测试」→ 标签显示「已改」角标。
- 编号降序 + 筛选 A 后（07 从第 1 位移到第 6 位），「已改」角标与「覆写测试」文本仍在 07 那张标签上（位置 idx5）——覆写跟随行对象（workspace.ts:190 Map<DataRow,…>），不按数组索引。截图 r150_override_after_sortfilter.png。
- 逐张 PNG 导出（6 张）：第 6 张（07）与清除覆写后同视图重导的第 6 张 diff 8262 px（姓名区），其余标签逐张 diff=0——覆写内容确实进导出且与预览一致。对比图 r150_override_export_compare.png。
- 「清空」→ 重新导入：无「已改」角标、无覆写文本残留、伴随 toast；覆写不复现。

## 3. 预览辅助选项组合
- 高亮缺失：开启后预览琥珀色高亮像素 2→2169（有未映射字段占位）；导出整页 PNG 中琥珀像素 0——**高亮只进预览不进导出** ✅（宿主 LabelSheet 不传 highlight-missing）。截图 r150_t3_highlight_on.png。
- 裁切线：预览开/关像素差 3732 px（虚线可见/消失）✅；**整页 PNG 导出开/关两次产物字节级相同（md5 一致），且导出内 v@105mm 等裁切线位置全白——裁切线当前完全不进 PNG 导出，开关对导出无效**。注记（不定级）：代码意图上宿主传了 `show-cut-lines=workspace.showCutLines`（PreviewArea.vue:1415，且 hostSuppressCutLines 注释暗示整页导出应含裁切线），实测 html2canvas-pro 未把 `.cut-line`（border 0 dashed + border-left/top-width 0.35mm）栅格化出来。与本轮用户预期「裁切线不应进导出」行为一致，但与代码意图存在出入；浏览器打印宿主走真实 CSS 渲染、打印时裁切线应仍在（本轮未实纸打印验证）。是否属预期请产品裁量。
- 裁切排序：12 行 ×10 枚/页 = 2 页，开启后预览页 1 = 07,11,09,12,08,10（原序偶数位）+4 空位、页 2 = 03,01,05,02,04,06——与 stackSortRows（叠齐裁切后每摞连续）一致；导出整页 PNG 同步变化：ON 页 2 第 1 格与 OFF 页 1 第 2 格（03 钱二）像素几乎一致（diff 4px）、页 1 尾 4 格 ink=0 空位 ✅。对比图 r150_stack_export_compare.png。
- 对折双联（镜像）：vTent 模板默认开启；导出整页 PNG 上半区 ink 30744（ON）vs 16172（OFF），ON 时上半区旋转 180° 与下半区暗像素 IoU 0.68（OFF 仅 0.34）——镜像确实进导出、关闭后上半区仅剩折线提示 ✅。对比图 r150_mirror_export_compare.png。

## 4. Firefox 全流程冒烟（Playwright firefox 121，全通过，#146 后无回归）
- 导入 r150.xlsx →「共 12 条数据」、自动匹配 2/4（标准考场版对 姓名/编号 表头的预期匹配）、预览 12 枚渲染。
- 带水印逐张 PNG 导出 zip 12 张（1000×534/张）、图片版 PDF 1 页（pypdfium2 ink 6354 非空白）、打印宿主 window.print 被调起且宿主 sheet-page 挂载。全程 0 pageerror。
- 字体栈记录（已知开放项，不定级）：预览 computed font-family = `ui-sans-serif, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`（模板宋体字段另有栈）；Linux 下 Firefox/Chromium 实际回退字体可能不同，导出为各自浏览器栅格化结果，跨浏览器产物像素不保证一致。截图 r150_ff_preview.png、r150_ff_png_p1.png、r150_ff_pdf_p1.png。

## 5. 演示/真实名单切换清理（全通过）
- 演示数据 + 排序 + 单张覆写（DEMO覆写）→ 导入真实名单：toast「单张覆写已清除」、排序态清空、角标 0、覆写文本无残留。
- 反向：真实名单 + 排序 + 覆写（REAL覆写）→ 清空 → 演示数据：同样干净（badge 0、无视图态、无残留）。截图 r150_t5_*.png。0 pageerror。

**结论**：无新增 P0–P2。1 项注记（不定级，产品裁量）：整页 PNG 导出中「裁切线」开关无效（永不渲染进导出），与宿主代码传参意图不符但与「裁切线仅预览」预期一致。收尾已清空名单与 roster 键。

# 第 149 轮（2026-08-10）：#159 线上复测——.xlsx ZIP 魔数校验 + 照片内容魔数校验（第 147 轮 P3-1/P3-2 闭环）✅

**方法**：轮询确认 EdgeOne 部署新 bundle（`index-rRU9KX0x.js` → `index-DkfDPQCs.js`，代码依据 commit fedd014）→ 生产 www.seatmark.cn，headless Chromium 29229 真实 UI，第 147 轮同一批 fixtures（/home/ubuntu/r147_fix/）复测。不录屏。

## 断言明细

| # | 断言 | 第 147 轮旧行为 | 结果 |
|---|------|----------------|------|
| 1 | 文本改名 .xlsx → toast「Excel 导入失败｜文件内容不是有效的 .xlsx 工作簿（可能是改名或损坏的文件）；若是 CSV 名单请将扩展名改回 .csv 后重试」，无「导入成功」、无 99 条垃圾行 | 「导入成功 99 条」 | ✅ 闭环 |
| 2 | 20MB /dev/urandom .xlsx → 同上文案，0.4s 快速失败 | 4.8s「导入成功 160512 条」 | ✅ 闭环 |
| 3 | Regression：正常 xlsx 40 条 / CSV 3 条（PK 校验不拦 .csv）/ 双 sheet「文件含 2 个工作表」均导入成功 | — | ✅ |
| 4 | 文本改名 .jpg → toast「本次匹配 0 张」（不再计 matched）；明细「测员001.jpg - 不是有效的图片文件（内容无法识别，可能是改名或损坏的文件）」；预览 img 数 0（无裂图） | 「本次匹配 1 张」+ naturalWidth=0 裂图 | ✅ 闭环 |
| 5 | 截断 JPEG（FFD8 头完整）→ 仍「本次匹配 1 张」，预览 400×500 正常 | 同 | ✅ |
| 6 | Regression：batch200 200 张真 jpg → 匹配 40/40 覆盖率 100%，160 未匹配均为文件名原因，无「不是有效的图片文件」误杀 | 同 | ✅ |

至此第 147 轮两个 P3 观察项全部闭环。

**产物**：截图 `/home/ubuntu/screenshots/r149_faketext.png`、`r149_junk20mb.png`、`r149_normal_xlsx.png`、`r149_csv.png`、`r149_2sheet.png`、`r149_fakejpg_details.png`、`r149_truncjpg.png`、`r149_batch200.png`；脚本 `/home/ubuntu/r149_run.py`；PR 评论 `/home/ubuntu/r149_comment.md`（#159）。测试数据已清理。

# 第 147 轮（2026-08-10）：探索性走查——错误恢复与异常输入健壮性 ✅（2 个 P3 观察项）

**方法**：生产 www.seatmark.cn（bundle `index-rRU9KX0x.js`，无代码变更轮），headless Chromium 29229 真实 UI：CDP `DOM.setFileInputFiles(objectId)` 注入损坏文件（脚本自造：文本/PNG 改名 .xlsx、0 字节、20MB /dev/urandom、msoffcrypto 加密 xlsx、文本改名 .jpg、截断 JPEG、7100×7100 50MP PNG、200 张小图批量、非法/缺字段/万层嵌套 JSON）；`Network.emulateNetworkConditions` 模拟断网；`Page.javascriptDialogOpening` 监听 XSS。不录屏。

## 断言明细

| # | 断言 | 结果 |
|---|------|------|
| 1 | PNG 改名 .xlsx / 密码保护 xlsx → toast「Excel 导入失败｜文件解析失败：文件可能已损坏或格式不受支持…」；0 字节 →「Excel 至少需要包含表头行和一行数据」；均无白屏无 pageerror | ✅ |
| 2 | 报错后导入正常 40 行 xlsx →「已读取 40 条数据」，可恢复 | ✅ |
| 3 | 照片：未匹配文件进「N 个文件未匹配，查看详情」列表；200 张批量 0.4s 完成、匹配 40/40 覆盖率 100%、160 张列明细、UI 不卡（JS 探针 2ms）；50MP PNG 不冻死 | ✅ |
| 4 | 分享 hash 篡改 4 例（截断 v1 / 非 base64 / v9 版本 / v0 缺字段 JSON）→ 均 toast「分享链接无效｜链接可能不完整或已损坏…」+ hash 清除 + 页面正常无 pageerror | ✅ |
| 5 | 模板 JSON 导入：非法 JSON →「模板解析失败」；缺字段/fields 类型错/万层嵌套 →「模板文件无效｜文件缺少 label、page 或 fields 字段」；customs 不被污染、demo 预览完好 | ✅ |
| 6 | URL fuzz（?template=不存在、?paper=乱串、?demo=xss"><script>、8KB 长参）→ 页面正常、默认模板兜底、无 alert 弹窗、无注入 script、无 pageerror | ✅ |
| 7 | 断网导出：offline 下带水印逐张 PNG 导出成功（zip 40 张，纯本地渲染） | ✅ |
| 8 | 断网分享：微信扫码 → 弹窗内「短链服务暂时不可用｜已自动重试仍未成功…」+「重试」「改用长链接二维码」，不白屏；恢复在线点重试 → 二维码正常渲染 | ✅ |

## P3 观察项（产品裁量）

- **P3-1 垃圾字节按 CSV 兜底导入**：SheetJS 对非 ZIP 内容回退文本/CSV 解析——文本改名 .xlsx「导入成功 99 条」；20MB /dev/urandom 4.8s「导入成功 160512 条数据」（不冻死、可清空恢复）。不算崩溃，但「导入成功」提示对明显垃圾文件有误导性，可考虑对单列且乱码占比高的结果给出提示。
- **P3-2 假图片静默裂图**：文本改名 .jpg 经 FileReader dataURL「照片已加载」成功 toast，预览 img naturalWidth=0（裂图）无任何警告；截断 JPEG（前 40%）浏览器可部分解码正常显示 400×500。可考虑加载后校验 naturalWidth 为 0 的照片并列入错误明细。

**产物**：截图 `/home/ubuntu/screenshots/r147_*.png`（错误 toast/明细/断网弹窗/裂图单元格等 20+ 张）；fixtures `/home/ubuntu/r147_fix/`；断网导出物 `/home/ubuntu/r147_dl/标准考场版-20260810-1043.zip`（40 张）；脚本 `/home/ubuntu/r147_lib.py` / `r147_t1.py` / `r147_t2.py` / `r147_t3.py` / `r147_t6.py`。测试数据已清理（roster 键删除、customs `[]`）。

# 第 146 轮（2026-08-10）：探索性走查——全站链接完整性与 SEO 资产一致性（324 URL 全量扫描）✅

**方法**：纯线上 HTTP/HTML 扫描（curl/urllib，并发 8、失败重试 1 次），生产 www.seatmark.cn（bundle `index-rRU9KX0x.js`，无代码变更轮）。页面为预渲染静态 HTML（title/description/canonical/JSON-LD/OG 均在响应中），且未知路由返回真实 HTTP 404（noindex + canonical /404）——curl 结论即线上死链结论。不录屏（headless 无可视桌面）。

## 断言明细

| # | 断言 | 结果 |
|---|------|------|
| 1 | sitemap.xml 恰 324 个 `<loc>`；逐一 GET 全部 200（0 非 200） | ✅ |
| 2 | 324 页 canonical == sitemap URL（0 不一致） | ✅ |
| 3 | 324 页 title/description 全部非空；title 与 description 全站零重复 | ✅ |
| 4 | 内链爬取：12 个种子页（首页/三大列表/3 模板详情/3 教程详情/2 纸型详情）提取 343 个去重站内 href，逐一线上 GET 全部 200，死链 0 | ✅ |
| 5 | 锚点链接（/#how、/#features、/#faq 等）目标页均存在对应 `id=`，错误锚点 0 | ✅ |
| 6 | quickStart 深链参数：template ∈ {archiveBoxSpine, deluxeConfAurora, standard, weddingPlace, withPhoto}、paper ∈ {a4-21up, a4-8up-spine}，与 repo 222 模板 id 及 labelPapers slug 全部匹配，无效 id 0 | ✅ |
| 7 | JSON-LD 抽查 10 页：全部块 `json.loads` 通过；类型符合预期（首页 SoftwareApplication；列表页 CollectionPage+BreadcrumbList；/pricing 含 FAQPage；模板详情 HowTo（archiveBoxSpine 另含 FAQPage）；教程详情 Article+HowTo+FAQPage；纸型详情 Product+BreadcrumbList） | ✅ |
| 8 | robots.txt Sitemap 行 = `https://www.seatmark.cn/sitemap.xml`；llms.txt（91 URL）+ llms-full.txt（301 URL）合计 305 个去重 URL 逐一 GET 全部 200，不可达 0 | ✅ |
| 9 | llms 文件 URL 与 sitemap 一致性：仅 sitemap.xml / llms-full.txt 两个自引用不在 sitemap（预期），其余全部收录 | ✅ |
| 10 | OG/Twitter 抽查 10 页：og:title/description/image/url 与 twitter:card/title/description/image 全部存在且非空，og:url == canonical | ✅ |

## 备注

- JSON-LD script 标签带 `data-route-jsonld` 属性（提取时正则需 `[^>]*`）。
- llms.txt 首段简介中的裸域名 URL 被中文全角括号紧跟（`https://www.seatmark.cn）是…`），朴素 URL 正则会截出假 URL——扫描脚本已按 URL 合法字符集收敛，非站点缺陷。
- 未知路由（/nonexistent-page-xyz、/templates/notexist-xyz）返回真实 404 + `noindex, follow` + canonical `/404`，且 404 页含返回首页/工坊/教程推荐入口，SEO 处理正确。
- 本轮 0 个 P0–P3 新发现。

**产物**：`/home/ubuntu/r146_sitemap_scan.json`、`/home/ubuntu/r146_links.json`、`/home/ubuntu/r146_seo_10pages.json`、`/home/ubuntu/r146_llms_check.json`；脚本 `/home/ubuntu/r146_scan.py` / `r146_crawl.py` / `r146_seo.py` / `r146_llms.py`；截图 `/home/ubuntu/screenshots/r146_home.png` / `r146_404.png` / `r146_llms.png`。

# 第 145 轮（2026-08-10）：PR #157 线上复测——新增纸型 a4-8up-spine（40×120 竖条 4×2）✅

**方法**：轮询确认 EdgeOne 部署新 bundle（`index-Dx0xG7HB.js` → `index-rRU9KX0x.js`）、sitemap 323→324；headless Chromium 29229 真实 UI + PIL/zipfile 产物核验。

## 断言明细
- /papers 列表出现「A4 8格竖条不干胶（40×120，4 列 × 2 行）」卡片 — PASS（r145_papers_list.png）
- /papers/a4-8up-spine 详情：40 × 120 mm、4 列 × 2 行、一页 8 枚、用途文案齐全；推荐模板含 档案盒脊标 + 图书物品标签 + 固定资产标签；title 非空、canonical=`https://www.seatmark.cn/papers/a4-8up-spine` — PASS（r145_paper_detail.png）
- /studio?template=archiveBoxSpine&demo=1：纸型下拉默认即显示 a4-8up-spine（模板默认尺寸被 matchLabelPaper 自动匹配）；打开下拉后排序首位 = a4-8up-spine 带「推荐」徽标，次位起为「勉强」档（上轮该模板 0 适配，区分点成立）— PASS（r145_picker.png / r145_picker_zoom.png）
- 锁定链路：先选「不使用纸型」→ toast「已取消纸型锁定」；再选 a4-8up-spine → toast「已按纸型锁定排版｜A4 8格竖条不干胶…4 列 × 2 行，每页 8 枚（40 × 120 mm）」；18 行 demo → 3 页、无溢出提示 — PASS（r145_locked.png）
- 导出几何：带水印整页 PNG zip 3 页、2481×3509；按 16mm 边距 + 40+6mm 栅格逐格采样：第 1/2 页 8 枚全有内容（ink 51k–55k）、列间隙 ink=0（不串格不溢出）、第 3 页恰 2 枚（18=8+8+2 分页正确）— PASS（r145_png_grid.png，产物 /home/ubuntu/r145_dl/档案盒脊标-20260810-1008.zip）
- 反向深链：/papers/a4-8up-spine「用此纸型开始排版」→ /studio?paper=a4-8up-spine → 当前模板（standard）不适配时按 StudioView:134 自动换用 archiveBoxSpine 并锁定，toast「已换用适配该纸型的模板｜…每页 8 枚」；无裸「适配度不足」warning — PASS（r145_deeplink.png）
- Regression：standard 纸型首位仍为「A4 24格圆角不干胶（63.5×33.9）推荐」（standard 原生 24 枚排版，无回归）；archiveBoxSpine 取消锁定后自由排版预览正常渲染（ink 12150）— PASS（r145_regression_standard.png / r145_free_layout.png）

**计划更正注记**：计划中 Regression 预期误写为「a4-21up」，standard 的原生适配纸型实为 a4-24up（详情页 SEO 亦为「一页 24 枚」）——按代码事实修正预期后核验通过。**结论**：无新增 P 级问题，第 144 轮 P3（archiveBoxSpine 0 适配）闭环。

# 第 144 轮（2026-08-10）：全量模板库 222 款自动化冒烟（无代码变更，线上走查）✅

**方法**：repo `defaultTemplates*.ts` 经 vite-node 导出 222 款期望值（name/mappable 字段数/演示数据集 via resolveDemoDataset/适配纸型数 via evaluatePaperFit）→ headless Chromium 29229 单 tab 逐款 `Page.navigate` 到 `/studio?template=<id>&demo=1`（单款 25s 超时 + 失败重试一次，injected error hook 过滤良性 ResizeObserver），断言：模板应用、演示数据集名、映射 N/N、预览 `.sheet-page` 裁剪截图 ink 阈值；缩略图全量存档。

## 结果汇总（222/222 完成，0 缺测）
- 预览渲染：222 款全部非空白非纯黑（ink 3060–…；最低 tableNoStand 3060 为极简设计，ASCII 核验有内容）— PASS
- JS pageerror：222 款全部 0（ResizeObserver 良性除外）— PASS
- 演示数据集不串场景：222 款 sessionStorage roster 的 sheetName 全部 = resolveDemoDataset 期望（考场/班级/会议/政务/餐饮/电竞等）— PASS
- 字段映射：222 款全部「已自动匹配 N/N」满配且 N = repo mappable 定义 — PASS
- 模板应用：批跑中 4 款（roundtableCard/gymClassDoor/deluxeGovGuilloche/afterSchoolPickup）localStorage 读到陈旧模板名——逐款复测均正确（localStorage 名 + 预览内容均为目标模板），判定为防抖持久化读取时机的自动化假象，非缺陷 — PASS（复测截图 r144_recheck_*.png）
- 适配纸型数：中位 12；**唯一 0 适配：archiveBoxSpine（档案盒脊标）**——竖长条形无内置纸型适配，自由排版仍可用，记 P3 观察项。
- SEO 抽查 10 款：title 含模板关键词、description 非空、canonical 精确 = /templates/<id>，10/10 通过。其中 2 款（deluxeAnnualRibbon「年会席卡·红绶飘带」→ title「红绶飘带年会席卡模板…」、macaronName 同理）title 用重排词序的 SEO 文案而非精确模板名，属刻意措辞非缺失。

**结论**：无新增 P0–P2；1 个 P3 观察项（archiveBoxSpine 适配纸型数 0）。缩略图 /home/ubuntu/screenshots/r144_thumbs/（222 张）。

# 第 143 轮（2026-08-10）：WebKit（Safari 引擎）移动端全流程与导出一致性专项（无代码变更，线上走查）✅

**方法**：Playwright WebKit（python，iPhone 视口 390×844、触控 UA、DPR3、真实 tap），访问生产 www.seatmark.cn。前置安装：`sudo apt-get install libgles2 gstreamer1.0-libav` + `python3 -m playwright install webkit`，启动需 `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`（apt 装齐后校验仍误报）。带水印导出（WebKit context 独立配额，未消耗无水印额度）。

## 断言明细
- 移动全流程：首页 scrollWidth=390 无水平溢出、CTA「开始制作」tap 进 /studio；demo 26 条 +「已自动匹配 4/4」；预览 tab 渲染正常（截图非空白）；全程无 JS pageerror — PASS（r143_home/studio/preview.png）
- 触控交互：纸型 listbox tap 打开 → 选 A4 21格 → toast「已按纸型锁定排版」、「2 页」；导出选择弹窗触控开合正常 — PASS（r143_lock_toast/export_dialog.png）。移动端注记：导出按钮仅在「预览」tab 可见（移动分栏），数据 tab 下不可见——布局设计而非缺陷。
- WebKit PNG 导出 vs Chromium：整页带水印 zip 2 页、每页 2481×3509 与第 142 轮 Chromium 完全一致、体积同为 0.4MB；页底水印带 ink 18485（有水印特征）；首标签「考场座位」字形完整不平切（裁图 ASCII 核验）— PASS
- WebKit 图片版 PDF：2 页 / 0.4MB、首页 ink 46594 非空白 — PASS（r143_wk_pdf_p1.png）
- 生僻字（扩A「㐆㵘」+ 扩B「𠀋𩽾𩾌」）：导入/预览/导出 PNG 中全部实心字形非豆腐块（4 单元格裁图 ASCII 核验，对照行「张三」正常）— PASS（r143_rare_cell1-4.png）。注记：本机 WebKit 系统字体（Noto CJK）本就覆盖扩B（canvas 探针 extB=true），故「已自动启用生僻字扩展字库（遍黑体）」toast 分支未触发——设备缺字时的 Plangothic 懒加载链路本轮 untested（无法在有字形的主机上自然触发）。
- 存储恢复（WebKit）：刷新后名单恢复「26 条数据」+ roster 键在；设计器保存「R143 WebKit」→ 成功 toast → localStorage 落盘 → 刷新后置顶可见 — PASS（r143_restore/restore_tpl.png）
- /seating 移动端：scrollWidth=390 无溢出、载入演示名单 →「按行填充」→「已输入 48 人 / 座位 48 个」网格渲染 — PASS（r143_seating_fill.png）
- 控制台观察（非 P 级）：`ResizeObserver loop completed with undelivered notifications`（良性）与 clarity.ms 统计脚本被访问控制拦截（第三方统计，不影响功能）。

**结论**：无新增 P 级问题。1 项覆盖缺口如实记录（遍黑体懒加载 toast 分支需缺字设备）。既有运维项不变。

# 第 142 轮（2026-08-10）：匿名无水印配额链路 + 站内搜索/拼音专项（无代码变更，index-Dx0xG7HB.js 线上走查）✅

**方法**：生产 /studio、/templates、/guides，headless Chromium 29229 真实 UI。第 141 轮特意保留的匿名每日 1 次无水印额度本轮消耗（前置核验键 `seatmark.clean-export-usage.v1` 为空 + 角标「今日剩余 1 次」）。取消/扣次顺序：先测取消不扣，再测真实消耗，避免额度先被耗尽。

## A. 无水印配额
- 取消不扣次：1000 行无水印图片版 PDF 第 15/48 页点「取消导出」→ toast「已取消导出｜本次未扣除无水印次数」、配额键仍空、导出选择框角标仍「今日剩余 1 次」、无落盘 — PASS（r142_cancel_clean.png）
- 首次无水印导出（demo 26 行整页 PNG zip，2 页）：成功落盘；与随后同参数带水印版逐像素对比：差异 72121px 集中于页底水印带（y≈3387/3509），无水印版对应区域 ink 明显更少（footer 16488 vs 24237），放大裁图对证 — PASS（r142_wm_zoom.png / r142_clean_zoom.png / r142_footer_*.png）；键变 `{"date":"2026-08-10","used":1}`、角标变「无水印导出（今日剩余 0 次）」+ 按钮角标转「带水印免费」（r142_badge_zero.png）
- 耗尽后再点无水印：QuotaLimitDialog 出现（「免费登录，每天 3 次无水印导出」「分享被点开 1 次再 +1 次（每日最多 10 次）」「也可以直接选择带水印导出继续使用…」），未触发渲染、键仍 used=1 不误扣 — PASS（r142_limit_dialog.png）
- 持久化：刷新后键保持 used=1、角标仍 0 次（r142_exhausted_persist.png）；新隔离 context 打开 /studio → 键为空、角标回「今日剩余 1 次」——本地配额可被无痕/换浏览器绕过，属已知设计，如实记录 — PASS（r142_fresh_ctx.png）

## B. 站内搜索/拼音
- /templates：「hunyan」=「婚宴」= 8 款一致；「kaochang」10 款；部分拼音「hunya」8 款（支持前缀）；简拼「hy」66 款（命中面广但非空，如实记录）；乱串「zzzzqq」空态精确「没有匹配“zzzzqq”的模板，换个关键词试试，或在设计器里从空白新建。」+ 推荐兜底 3 卡 — PASS（r142_tpl_pinyin.png / r142_tpl_empty.png）
- 分类 pill 回退（#105 回归）：搜「hunyan」+ 点「考试」pill → 「「考试」分类下无匹配，已在全部分类中找到 8 款」且仍展示 8 卡 — PASS（r142_pill_fallback.png）
- /guides：「打印」=「dayin」= 共 40 篇一致；简拼「jkz」共 1 篇（监考照片核验教程，placeholder 示例自洽）；乱串空态「该条件下暂无教程，换个关键词或筛选条件试试。」+ 推荐兜底 — PASS（r142_guides_pinyin.png / r142_guides_empty.png）

- 清理：名单清空、customs `[]`；配额键 used=1 为当日真实消耗，按计划保留不人为重置。

**结论**：无新增 P 级问题。既有运维项不变（x-seatmark-storage: memory、SES 未配置；服务端配额/登录链路不在范围）。

# 第 141 轮（2026-08-10）：超大名单极限与导出耐久性专项（无代码变更，index-Dx0xG7HB.js 线上走查）✅

**方法**：生产 /studio，headless Chromium 29229 真实 UI。脚本生成 r141_500/1000.xlsx（姓名/部门/职务/桌号，中文）导入计时；标准考场版 + A4 21格（3×7）纸型锁定；1000 行整册图片版 PDF 与逐张 PNG（{姓名} 字段命名）均走「带水印导出」（免费不限次，规避匿名无水印每日 1 次配额）；pypdfium2/PIL/zipfile 核验产物；中途取消与刷新恢复边界。

## 断言明细
- 导入极限：500 行与 1000 行导入均约 0.5s 出「N 条数据」、无卡死（布局探针 0ms）、字段映射 UI 可正常改选 4/4 — PASS（r141_import_1000.png）
- 分页计算：1000 行 A4 21格 → 「48 页」= ceil(1000/21) 精确 — PASS（r141_pages_1000.png）。注：500 行档仅验证导入耗时，未单独停留核对 24 页（随即导入 1000 行），如实记录。
- 1000 行图片版 PDF：61s 完成，进度文本持续更新（46 次不同值：「正在渲染第 i/48 页...」→「已完成 48/48 页，正在写入 PDF...」，截图 r141_pdf_progress_1-3.png）；产物 48 页 / 6.0MB（面板预估 6.2MB 相符）、首/末页非空白（ink 71260/44141），末页首标签像素读出「测员0988」（=21×47+1 行，分配正确，r141_p48_digits.png）— PASS
- 1000 张逐张 PNG zip：93s 完成，进度含逐张计数（「已完成 970/1000 张标签…」）；zip 25.8MB、条目恰 1000、字段命名正确（测员0001.png…测员1000.png，四位补零来自名单值本身）、抽样首/中/尾 9 张全部 1000×606 一致且无空白（ink 42k-44k）— PASS
- 中途取消：第 15/48 页点「取消导出」→ toast「已取消导出｜本次未扣除无水印次数，可随时重新导出」、loading 消失、无文件落盘；随后重新导出 67s 成功（48 页/6.0MB）— PASS（r141_cancel_progress.png / r141_cancel_toast.png）
- sessionStorage 边界：1000 行 roster payload 仅 47KB（远低于配额）→ 刷新完整恢复「1000 条数据」+ 4/4 映射 — PASS（r141_restore_1000.png）。未触及超配额降级路径（payload 太小，按设计静默跳过的分支本轮无法自然触发）。
- 清理：名单清空（roster 键删除）、customs `[]` — 完成

**结论**：无新增 P 级问题（1000 行全链路顺畅：导入 0.5s、PDF 61s、PNG zip 93s、取消/恢复健壮）。既有运维项不变（x-seatmark-storage: memory、SES 未配置，登录/分享短码不在本轮范围）。

# 第 140 轮（2026-08-10）：PR #155 复测——刷新后照片提醒重新上传 + 匹配列恢复 ✅（第 137 轮 P3 观察项闭环）

**方法**：确认 EdgeOne 部署新 bundle（`index-C7zVLvQG.js` → `index-Dx0xG7HB.js`，chunk `StudioView-DNkLMxuS.js` 含「照片需重新上传」；代码依据 60beb63）。生产 /studio，headless Chromium 29229 真实 UI：照片核验版模板 + 40 行名单（r140_40.xlsx，姓名=学生NNN）+ r137_photos 3 张 jpg 匹配后刷新；反例仅名单；demo 名单回归。

## 断言明细
- 核心闭环：匹配列选「姓名」+ 上传 3 张照片（「已导入 3 张照片，匹配 3/40 行（覆盖率 8%）」）→ 刷新 → info toast「照片需重新上传｜为保护隐私，照片仅保存在浏览器内存中；名单与匹配列已恢复，重新上传照片即可」出现（第 137 轮此步静默清空无提示）— PASS（r140_reload_toast.png/_zoom.png，DOM+像素双证；toast 约 0.5s 即出、数秒后自动消失，需刷新后立即捕获）
- 匹配列恢复：刷新后照片匹配列下拉仍为「姓名」（旧行为重置为「请选择 Excel 中的一列」）；名单 40 条 + 4/4 字段映射恢复；payload {hadPhotos:true, photoColumn:"姓名"} — PASS（r140_col_restored.png）
- 重新上传可再匹配：同批 3 张 jpg 再上传 → 「已导入 3 张照片，匹配 3/40 行（覆盖率 8%）」恢复 — PASS（r140_rematched.png）
- 反例：仅导入名单（payload hadPhotos:false, photoColumn:""）→ 刷新 8s 内无「照片需重新上传」toast，名单正常恢复 — PASS（r140_no_photo_no_toast.png）
- Regression：标准考场版 + demo 名单（26 条）→ 刷新恢复正常、无照片提醒误弹、模板保持 — PASS（r140_demo_reload.png）
- 清理：名单清空（roster 键删除）、customs `[]`、无残留键 — 完成

**结论**：第 137 轮 P3（照片刷新静默清空无提示）闭环。无新增问题。既有运维项不变（x-seatmark-storage: memory、SES 未配置、认证链路 untested）。

# 第 139 轮（2026-08-10）：PR #154 复测——保存类成功 toast 依据 lastPersistOk 分支 ✅（第 138 轮 P3 观察项闭环）

**方法**：确认 EdgeOne 部署新 bundle（`index-FWoZ0gOK.js` → `index-C7zVLvQG.js`，chunk `StudioView-faFeqswd.js` 含 lastPersistOk 分支；代码依据 0b23d28）。生产 /studio，headless Chromium 29229 真实 UI：filler 填满 localStorage（33 键，4KB probe 复核 QuotaExceededError）后设计器保存；清 filler 后正常保存；双 tab 同步冒烟。

## 断言明细
- 核心闭环：配额满 UI 保存「R139 配额」→ **只出现** danger toast「模板未能保存到本设备｜…刷新后此模板将丢失…」，成功 toast「模板已保存/已加入我的模板」**不再出现**（第 138 轮此步两者并存）— PASS（r139_quota_only_danger.png/_zoom.png，DOM 全文匹配 + 像素核验双证）。注：截图中同屏还有 workspace warning「当前编辑未能保存到本设备」（配额满态下工作区防抖写触发，属 #153 预期行为，非并存回归）。
- 正常保存无回归：清 filler 后保存「R139 正常」→ 成功 toast「模板已保存｜「R139 正常」已加入我的模板并应用」出现、无 danger、storage 落盘 — PASS（r139_normal_success.png/_zoom.png）
- Regression 删除/刷新：删除 → toast「自定义模板已删除」、storage `[]`、刷新后无 R139 残留 — PASS
- Regression 双 tab 同步：A 存「R139 同步E」→ B 未刷新即显示（r139_tab_sync.png）；A 删除 → B 即时移除 — PASS
- 清理：customs `[]`、r139_filler/probe 全删、B tab 关闭 — 完成

**结论**：第 138 轮 P3（成功/失败 toast 并存）闭环。无新增问题。既有运维项不变（x-seatmark-storage: memory、SES 未配置、认证链路 untested——AccountView 云端找回的同类分支因需登录未覆盖）。

# 第 138 轮（2026-08-10）：PR #153 复测——多标签写竞争 + 配额满假成功修复 ✅（第 137 轮 P2-①/P2-② 闭环）

**方法**：确认 EdgeOne 部署新 bundle（`index-BdWvwfSE.js` → `index-FWoZ0gOK.js`，chunk `templateLibrary-DP0pL5j2.js` 含「模板未能保存到本设备」；代码依据 1d6655b）。生产 /studio，headless Chromium 29229 同 context 双 tab 真实 UI 设计器保存/删除；filler 填满 localStorage 至 QuotaExceededError（4KB probe 复核）后走 UI。

## 断言明细
- P2-① 写竞争闭环：A 存「R138 并发A」→ B 存「R138 并发B」→ storage 同含两者（第 137 轮只剩后写者）— PASS（r138_both_saved.png）
- P2-① 删除不复活：A 删 并发A → B 再存「R138 复活哨兵C」→ storage=[并发B, 复活哨兵C]，并发A 不复活 — PASS（r138_no_resurrect.png）
- 加分项 storage 事件实时同步：A 保存后 B 面板未刷新即显示 并发A；A 删除后 B 面板即时移除；B 保存后 A 面板显示 并发B — PASS（r138_tabB_synced.png）
- P2-② danger toast：配额满 UI 保存「R138 配额」→ danger toast「模板未能保存到本设备｜…刷新后此模板将丢失…」出现 — PASS（r138_quota_danger.png/_zoom.png）。**观感如实记录**：成功 toast「模板已保存｜已加入我的模板并应用」与 danger toast 同屏并存，信息矛盾（P3 观察项，StudioView 保存路径未依据 persist() 返回值分支）。
- P2-② workspace warning：配额满（且工作区键不存在使写入需新分配）微调标签宽 → warning「当前编辑未能保存到本设备」出现一次；连续微调 72/73 不再新增（persistFailWarned 生效，不刷屏）— PASS（r138_ws_warning.png/_zoom.png、r138_no_spam.png）
- warning 重置：清 filler 后微调 → 成功持久化（w=74 入 storage）、无新 warning — PASS
- **测试注记（重要边界）**：同尺寸覆写已存在的 `seatmark.workspace-template.v1` 键在存储满时仍成功（localStorage 覆写语义），warning 仅在写入需净增空间时触发——非缺陷，但意味着多数「配额满微调」场景实际不丢数据；第 137 轮 2c 的「静默回旧值」实为当时脚本仅派发 input 事件未更新 Vue 模型的取证假象，特此更正。
- Regression：单 tab 存「R138 回归D」→ 刷新置顶可见 → 删除 → storage `[]`；40 行导入 + PNG 导出落盘（r138_dl/标准考场版-20260810-0827.zip）— PASS
- 清理：customs `[]`、r138_filler/probe 全删、名单清空、B tab 关闭 — 完成

**结论**：第 137 轮 P2-①、P2-② 均闭环。新增 P3 观察项 1 个（配额满保存时成功与失败 toast 并存）。既有运维项不变（x-seatmark-storage: memory、SES 未配置、认证链路 untested）。

# 第 137 轮（2026-08-10）：多标签页并发 + 本地存储边界专项（无代码变更，index-BdWvwfSE.js 线上走查）

**方法**：生产 www.seatmark.cn /studio，headless Chromium 29229 默认 context 开两个真实 tab（A/B），真实 UI 设计器保存/删除；localStorage 填充至 QuotaExceededError 后走 UI 保存；300 行 xlsx + 照片核验版模板照片匹配后刷新。代码定位：templateLibrary.ts:29（内存一次性载入）/36-42（persist 整数组覆写 + 静默 catch）、workspace.ts:96-114（工作区模板静默写）、:51-160（名单 sessionStorage per-tab）、照片仅内存 Map（workspace.ts:196-214）。

**发现（本轮新增 2 个 P 级 + 1 观察项）**
- **P2-①（静默丢数据·多标签写竞争）**：A tab 保存「R137 并发A」→ B tab（陈旧内存）保存「R137 并发B」→ storage 只剩 并发B，并发A 被整数组覆写**静默丢失**（A 刷新后消失，无任何提示）。同根因反向表现：A 删除某模板后，B（内存仍持有）再保存任何模板会让被删模板**复活**（实测 并发B 删除后复活）。根因：templateLibrary 启动时一次读入内存 + persist() 全量覆写，无 storage 事件监听/合并。
- **P2-②（静默丢数据·配额满）**：localStorage 填至 QuotaExceededError 后，设计器保存「R137 配额」→ toast 仍报「模板已保存|已加入我的模板并应用」，但 storage 写入静默失败（persist catch{}），刷新后模板消失、无任何失败提示。同态下工作区微调（标签宽 60→77）刷新后也静默回旧值。建议：persist 失败时 toast.danger 提示存储已满。
- 观察项（P3 候选）：照片匹配（3/300，覆盖率 1%）刷新后照片静默清空、匹配列重置，无「照片需重新上传」提示——与 guides「照片保存在内存」的设计一致、照片面板回到初始可上传态，尚可接受，但已加载态无恢复提示可再友好。

**其余断言（通过）**
- 1a 多 tab 状态：A 导入 40 行 + 切 eink800 → B 刷新恢复 eink800 工作区模板（localStorage 共享）、名单不出现（sessionStorage per-tab，符合设计）— PASS
- 2a 55 个自定义模板：折叠区置顶正常、「浏览全部」自定义 55、打开 722ms 无卡死、搜索「批量33」精确过滤 1 张 — PASS
- 3 大体量：300 行导入 + 刷新后名单 300 条完整恢复、字段映射保留、页面即时可交互 — PASS
- 4 Regression 单 tab：标准考场版 300 行 PNG 导出成功（标准考场版-20260810-0812.zip 落盘）— PASS
- 清理：名单清空（session 键删除）、自定义模板 []、filler 全部移除 — 完成（清空 toast 截图未及时捕获，storage 证据为准）

**截图**：/home/ubuntu/screenshots/r137_tabA_state.png、r137_tabB_state.png、r137_tabA_saved.png、r137_tabB_saved.png、r137_tabA_lost.png（并发A 丢失）、r137_tabB_resurrect.png（删除复活）、r137_many_browse.png、r137_quota_saved_toast.png（配额满仍报已保存）、r137_quota_after_reload.png（刷新后消失）、r137_300rows_before/after.png、r137_photos_loaded.png、r137_photos_after_reload.png、r137_regression_export.png

---

# 第 136 轮（2026-08-10）：PR #152 复测——主面板折叠区自定义模板置顶 ✅

**部署核验**：生产 bundle `index-NUcnYu0I.js` → `index-BdWvwfSE.js`（轮询确认后开测）。

**方法**：生产 www.seatmark.cn /studio，headless Chromium 29229 真实 UI：设计器保存自定义模板 → 刷新读取主面板折叠区卡片顺序；隔离 context 验证无自定义态；浏览全部弹窗回归；CDP 真实键盘事件复核 HEX 输入框。

**结果（全部通过）**
1. 保存「R136 置顶A」→ 刷新：折叠区 3 张卡顺序 = [R136 置顶A, 标准考场版, 考号贴]，自定义置顶、无需进「浏览全部」（第 134 轮 P3-③ 旧行为闭环）— PASS
2. 再保存「R136 置顶B」→ 刷新：折叠区 = [R136 置顶A, R136 置顶B, 标准考场版]，多个自定义均置顶 — PASS
3. 选中内置 eink800 后刷新：折叠区 = [电子座签 800×480(选中), R136 置顶A, R136 置顶B]，选中模板置顶逻辑不回归、自定义仍可见 — PASS
4. 全新隔离 context（无 localStorage）：折叠区 = [标准考场版, 考号贴, 课桌姓名贴] 纯内置，与旧行为一致 — PASS
5. Regression 浏览全部：分类含「自定义 2」、搜索「R136」过滤只剩 2 张自定义卡；两模板删除（确认弹窗 → toast「自定义模板已删除」×2 → storage []、刷新后折叠区恢复纯内置）— PASS
6. 第 134 轮 P3-① 复核：设计器 HEX 文本输入框用 CDP 真实键盘事件（keyDown/char/keyUp 逐字 + Enter）键入 #dc2626 → 文本框与拾色器同步为 #dc2626，且该颜色随模板保存入 localStorage（seatNo.color=#dc2626）——**P3-① 撤销**：为第 134 轮 synthetic 事件（仅 dispatchEvent）不触发 Vue 更新的自动化假象，真实键入生效 — PASS

**截图**：/home/ubuntu/screenshots/r136_one_custom.png、r136_two_custom.png、r136_selected_builtin.png、r136_fresh.png、r136_browse.png、r136_delete_confirm_0.png、r136_deleted_0.png、r136_after_cleanup.png、r136_hex.png、r136_saved_a.png

---

# 第 135 轮（2026-08-10）：PR #151 复测——精确像素导出文件名追加实际分辨率 ✅

**部署核验**：生产 bundle 由 `index-CHdjLWrt.js` 更新为 `index-NUcnYu0I.js`（轮询确认后开测）。

**方法**：生产 www.seatmark.cn /studio，headless Chromium 29229 真实 UI（图片 PNG 面板 → 选预设/自定义宽度 → 带水印导出），下载 zip 落盘 /home/ubuntu/r135_dl，PIL 实测内部 PNG 尺寸与灰度集合。

**结果（全部通过）**
1. eink800 + 800×480 预设：`电子座签 800×480-800x480-20260810-0737.zip`，内部 PNG 恰 800×480，灰度 {0,255} — PASS
2. eink800 + 296×128 预设：`电子座签 800×480-296x128-20260810-0738.zip`，内部 PNG 恰 296×128，灰度 {0,255} — PASS（第 134 轮 P3-② 闭环）
3. 自定义宽度 500（无预设）：面板显示「输出 500×300 像素（高度按模板比例自动推导）」，`电子座签 800×480-500x300-20260810-0740.zip`，内部 PNG 恰 500×300，灰度 {0,255} — PASS
4. 标准清晰度（300dpi）标准考场版：`标准考场版-20260810-0740.zip`，无 `-\d+x\d+-` 分辨率段（无回归），内部 PNG 1000×534 — PASS

附加实证：过程中一次误改模板标签宽为 420mm 后导出（预设 296 保持），文件名为 `-296x85-` 且图片恰 296×85——文件名后缀确实取实际推导输出尺寸，而非静态预设值。

**截图**：/home/ubuntu/screenshots/r135_296_panel.png、r135_custom500_panel.png、r135_standard_panel.png
**产物**：/home/ubuntu/r135_dl/（4 zip）

---

# 第 134 轮：eink 电子墨水通道 + 自定义模板设计器持久化全链路（无代码变更，线上走查）

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn（`index-CHdjLWrt.js`），headless Chromium 29229 真实 UI 操作，PIL/pypdfium2 像素测量。未录屏。

**结论**: **全部通过，无新增 P 级问题**。

**A. eink 通道**（/studio?template=eink800）：PNG 面板默认「精确像素（电子墨水屏 800×480）」预设 + 纯黑白勾选；demo/135 行两次导出共 139 张 PNG 全部恰 800×480 像素、灰度值集合精确 = {0,255}（无任何抗锯齿灰边，二值化彻底）；生僻字名单（王𠀀 U+20000、李𪛖 U+2A6D6）导入触发 toast「名单含 2 个生僻字 | 已自动启用生僻字扩展字库（遍黑体）」、`document.fonts.check('20px Plangothic','𠀀')=true`、导出后像素级 ASCII 渲染确认「王」三横完整、「𠀀」「𪛖」字形完整非豆腐块（r134_eink_rare_zoom*.png）；预设 296×128（宽高比 2.31 vs 模板 5:3）出现「该预设宽高比与当前模板不一致，画面会被拉伸…」提示、仍导出则恰 296×128 纯黑白；640×384（精确 5:3）无提示、输出恰 640×384。测量 r134_measure_eink.txt。

**B. 自定义模板全链路**：标准考场版「以此为基础设计」进设计器 → 改名「R134 自定义」、座位号字段 x 1.5→5 / y 2→3 / 字号 30→28 / 颜色 #0f172a→#dc2626 → 保存 → toast「模板已保存」、localStorage `seatmark.custom-templates.v1` 中字段 JSON 与所设值精确一致（r134_custom_saved.json）。刷新后模板保留、字段 JSON 逐键相等（不失真）；应用后预览红色字段可见。导出 PNG zip（标签 1000×534，红色像素 10536）与图片版 PDF（页面精确 210.000×297.000mm，红像素 5513）。「复制当前模板分享链接」得 `#tpl=v1.…` 长链（1334 字符）→ 在全新隔离 browser context（无 localStorage）打开 → 「分享了模板 “R134 自定义”」提示 + 「保存并应用」→ 还原模板与原保存快照逐键比对：fields/label/page/font 全部相等，仅 id 重新生成（预期行为）。两个上下文中删除均：确认弹窗 → toast「自定义模板已删除」→ localStorage 变 `[]`、卡片消失。

## 断言明细
- eink 默认预设 800×480 + 纯黑白勾选 — passed
- 导出 PNG 精确像素（800×480/296×128/640×384 三档全部 ±0px）— passed
- 纯黑白二值化（全部像素 ∈ {0,255}，无灰边）— passed
- 生僻字 Plangothic 生效、二值化后字形完整 — passed
- 宽高比不匹配提示（296×128 提示、640×384 无提示）— passed
- 设计器保存字段几何/颜色/字号精确入库 — passed
- 刷新持久化（JSON 逐键相等）— passed
- 自定义模板导出 PNG/图片版 PDF（红色字段渲染、页面 210×297 精确）— passed
- #tpl= 长链新上下文还原（fields/label/page/font 逐键相等）— passed
- 删除（两个上下文，toast + storage 清空 + 卡片消失）— passed

**观察项（非缺陷，P3 候选/UI 语义记录）**：① 设计器「HEX 色值」文本输入框经程序化 input/change 事件写入未生效（原生 color 拾色器输入生效）——可能仅是脚本事件时序问题，如人工键入失效才值得跟进；② 导出 PNG 的 zip 文件名取模板名（eink 模板名即「电子座签 800×480」），改选 296×128 预设导出时文件名仍为「电子座签 800×480-….zip」，用户可能误读实际分辨率（实际图片尺寸正确）；③ 自定义模板卡片在主面板仅显示于「浏览全部」弹窗的「自定义」分组或最近区，刷新后需从「浏览全部」进入选择。

截图：/home/ubuntu/screenshots/r134_*（eink_panel、eink_rare_zoom1-4、eink_mismatch、designer_open/edited、saved_toast、after_reload、custom_applied、custom_png、custom_pdf_p1、share_received、share_restored、delete_confirm*、deleted_*）。产物：/home/ubuntu/r134_dl/（3 个 eink zip + 自定义 PNG zip×2 + 图片版 PDF）、/home/ubuntu/r134_measure_eink.txt、/home/ubuntu/r134_custom_saved.json、/home/ubuntu/r134_share_url.txt。

---

# 第 133 轮：PR #150 复测——「不使用纸型（自由排版）」解除纸型锁定闭环

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn 新构建（`index-CHdjLWrt.js`，chunk `StudioView-CkFJkInA.js` 含「已取消纸型锁定」指纹），headless Chromium 29229 真实 UI 操作。未录屏。

**结论**: **全部通过，第 132 轮 P3 观察项闭环**。标准考场版锁定 A4 21格（70×42.4、3×7）后选「不使用纸型（自由排版）」：toast「已取消纸型锁定 | 恢复模板默认排版，可自由调整行列、尺寸与边距」出现（像素证据 r133_release_toast_zoom.png），下拉回到「不使用纸型」，排版恢复模板默认（标签 60×32、3 列 × 8 行、间距 4/3.857、边距 11/10），字段几何精确恢复设计稿值（座位号 left 1.5/top 2/width 21/height 23mm，分隔线 x 23.5mm 等），无溢出警示。解除后重新锁回 21格 正常（toast + 70×42.4/3×7）。未锁态再点「不使用纸型」零副作用（无 toast、状态 JSON 完全相等）。整页模板 vTent（277×190、1×1）点「不使用纸型」同样零副作用、无报错。回归：锁定 toast 正常；解除后打印通道注入 `@page { size: 210mm 297mm; margin: 0; }` 跟随恢复后的纸张。

## 断言明细
- 部署核验：新 bundle + 「已取消纸型锁定」字符串在 StudioView chunk — passed
- 锁定→解除：toast + 下拉复位 + label/page/边距全恢复设计稿 + 字段等比缩回（实测=设计稿精确值）+ 无溢出 — passed
- 解除后重新锁回 21格 — passed
- 未锁时点「不使用纸型」无副作用（状态快照前后相等、无 toast）— passed
- 整页模板 vTent 不受影响 — passed
- 回归 5a 锁定 toast / 5b @page 210×297 — passed

截图：/home/ubuntu/screenshots/r133_release_toast.png（全页）、r133_release_toast_zoom.png（toast 放大）、r133_after_release.png、r133_relock.png、r133_vtent.png。

注：本轮生产构建中纸型选择器 DOM 由 `[role=combobox]` 变为 `button[aria-haspopup=listbox]`（测试脚本选择器需同步）。

---

# 第 132 轮：校准页「下载校准页 PDF」几何专项核验（无代码变更，线上走查）

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn（`index-DAlIoE8V.js`），headless Chromium 29229，真实 UI 校准向导下载 PDF，pypdfium2 600dpi 像素测量 + 文本提取。未录屏。

**结论**: **全部通过，无新增 P 级问题**。校准页 PDF 几何精确（jsPDF 矢量直出，最大偏差 0.04mm，远小于 0.3mm 判据），校准基准不会系统性带偏校准链路。A4 页：页面精确 210.000×297.000mm，基准框边线 [19.98, 189.99]×[19.98, 276.99]（框宽 170.01、框高 257.01），上/左标尺 10mm 刻度全部 ±0.03mm，中心十字 (105.017, 148.485) vs 理论 (105, 148.5)。A5 页（经「纸张规格→A5 纵向」切换）：148.000×210.000mm，框 [19.98,128.02]×[19.98,189.99]（108.04×170.01），刻度 ±0.03mm，十字 y=105.006。向导自洽闭环：把 PDF 实测几何（=名义值 20/20/170/257）填回向导 → 「0.00 mm / 0.00 mm / 100.00% / 100.00%」+「实测值与设计值一致，无需补偿」。文件名 `seatmark-calibration-210x297.pdf` / `seatmark-calibration-148x210.pdf` 与页内标注（`Paper: 210 x 297 mm`、`Frame nominal: left/top = 20 mm, width = 170 mm, height = 257 mm`；A5 对应 108/170）与实测几何一致，无误导。

## 断言明细（测量 /home/ubuntu/r132_measure_a4.txt / r132_measure_a5.txt，PDF /home/ubuntu/r132_dl/）
- A4 页面尺寸 210.000×297.000mm（±0.05）— passed
- A4 基准框 20/20/170/257（实测最大偏差 0.02mm ≤0.3）— passed
- A4 标尺 10mm 刻度（上边 18 个/左边 26 个抽验全列）±0.03mm — passed
- A4 中心十字 (105, 148.5)（实测 105.017/148.485）— passed
- 自洽闭环：名义值回填 → 0 偏移/100% 缩放 + 「无需补偿」提示 — passed
- A5 第二尺寸：对话框「打印标尺校准页（A5 纵向）」+ 设计值「框宽 108 mm、框高 170 mm」；PDF 148.000×210.000、框 108.04×170.01（≤0.3）、十字/刻度精确 — passed
- 文件名与页内英文标注与实测几何一致 — passed
- 下载成功 toast 文案 — inconclusive（脚本 4 秒后读取已自动消失；文件落盘与内容正确已证）

截图：/home/ubuntu/screenshots/r132_a4_dialog.png、r132_selfcheck.png、r132_a5_dialog.png、r132_a4_ruler_zoom.png（标尺放大）。

**观察项（非缺陷，UI 语义说明）**：纸型下拉中「不使用纸型（自由排版）」选项当前实现为 no-op（LayoutPanel.vue:63-65 对 'none' 找不到 spec 直接 return），已锁纸型后无法用该选项解除，需经「纸张规格」选择器换纸（本轮即以此达到 A5）。如产品预期该选项能解除纸型锁定，可作为 P3 体验项另行处理。

---

# 第 131 轮：高行数纸型（A4 65格）逐行累积误差专项（无代码变更，线上走查）

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn（`index-DAlIoE8V.js`），headless Chromium 29229 + CDP printToPDF 捕获 + pypdfium2 600dpi 逐线测量（同 128–130 轮方法）。素材 /home/ubuntu/r131_135.xlsx（135 行 → 65+65+5 共 3 页），极简留白版模板 + A4 65格圆角不干胶（5 列 × 13 行，38.1×21.2mm，gapX 2.5）。理论网格：行边界 y=10.7+21.2k（页底 286.3mm）、列边界 [4.8, 42.9, 45.4, …, 205.3]。未录屏。

**结论**: **全部通过，无新增 P 级问题**。第 128 轮担心的高行数累积压缩不成立：13 行页底累计偏差仅 **-0.07mm（打印通道）/ -0.12mm（图片版 PDF）**，远低于 1mm 废纸线；打印通道逐行偏差 ∈ [-0.12, +0.11]mm（非单调累积，属亚 0.1mm 级独立舍入而非 per-row 定向漂移），竖线最大 |0.28|mm（圆角边缘峰值偏移所致，≤0.5 判据内）。图片版 PDF 页面精确 210.000×297.000mm，两通道逐线差 ≤0.15mm。多页零漂移：第 2 页与第 1 页全部 27 条横线/14 条竖线逐线差 ≤0.02mm。叠加 +2.00/-1.50mm 校准后打印通道全部线 = 无校准实测 ±偏移 ±0.03mm，行间距 21.17mm 不变（#149 裁剪修复在 5 列 × 13 行同样不触发 shrink-to-fit），页底 284.73 = 286.23-1.50 精确。3 页均非空白（6.2%/6.2%/1.8% 非白像素），首枚标签文字四向均有 >1.2mm 内边距不溢出小格。

## 断言明细（测量 /home/ubuntu/r131_measure_*.txt，PDF /home/ubuntu/r131_print*.pdf 与 r131_dl/）
- 纸型锁定 toast「A4 65格圆角不干胶（38.1×21.2）：5 列 × 13 行，每页 65 枚」— passed
- 无校准打印通道行边界偏差（14 条）：[+0.01, +0.11, +0.08, +0.04, +0.01, -0.02, -0.06, -0.09, -0.12, +0.10, +0.06, +0.03, 0.00, **-0.07（页底）**]，全部 ≤0.5、页底 ≤1mm — passed
- 无校准打印通道列边界（10 条）：最大 |0.28|mm ≤0.5 — passed
- 图片版 PDF：210.000×297.000mm，行边界偏差 [-0.12, +0.12]，页底 -0.12mm；与打印通道逐线差 ≤0.15mm — passed
- 多页漂移：第 2 页 vs 第 1 页逐线 ≤0.02mm — passed
- 校准 +2/-1.5 高行数不缩水（#149 回归）：全部线 = 基线±偏移 ±0.03mm、行距不变 — passed
- 页面完整性：3 页非空白、标签文字不溢出（内缩 1.5mm 后 bbox 仍离边 >3px）— passed

截图：/home/ubuntu/screenshots/r131_paper_selected.png、r131_print_p1.png（第 1 页 65 枚渲染）、r131_label_zoom.png（首枚放大）。测试结束保持校准清除态。

**观察项（非缺陷）**：65up 实测行距 21.17mm vs 名义 21.2（-0.13%，与第 128 轮 21up 同源的 mm→px 量化），因逐行非单调分布，13 行也不形成累积——高行数纸型无需担心页底废纸。

---

# 第 130 轮：PR #149 复测——正向校准偏移打印 shrink-to-fit 修复（第 129 轮 P2-1 闭环）

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn，与第 129 轮同方法（标准考场版 + r113_40.xlsx + A4 21格，stub window.print + CDP printToPDF 捕获，pypdfium2 600dpi 逐线测量，基线=第 128 轮网格坐标）。未录屏。取证注记：正偏移打印捕获后桌面 29229 Chromium 进程崩退，其余步骤在重启的 headless Chromium（同 29229 端口、生产同 bundle、重新导入同素材同纸型）中完成，正偏移证据在崩退前已完整落盘。

**部署核验**: `index-DAlIoE8V.js` → chunk `seating-BcjFmHsA.js` 含 #149 指纹 `@media print { .offscreen-host { width: ${e}mm; overflow: hidden !important; } }`（97d1f3c）。

**结论**: **全部通过，第 129 轮 P2-1 闭环**。正向偏移 +2.00/-1.50mm 打印通道不再缩水：竖线实测 [2.12, 72.04, 141.82] vs 期望 [2.12, 72.02, 141.83]（第 129 轮缩水态为 [2.10, 71.45, 140.67]），横线含页底 295.05mm 全部误差 ≤0.03mm；页数 2 页不变、两页非空白（非白像素 6.6%/6.0%）、彩色/水印保留（彩色像素 86万/76万）、第 2 页与第 1 页逐线差 ≤0.07mm。负向偏移（-2/+1.5，≤0.04mm）、缩放补偿（99.01%/99.00%，≤0.04mm，0 线不动）均不回归、不受新裁剪影响。图片版 PDF 通道 +2/-1.5 仍精确（页面精确 210×297mm，网格误差 ≤0.21mm）。持久化（刷新后 localStorage 保留 + 工具栏 emerald 绿点，像素核验 366 px）与「清除校准」（toast「已清除校准」、键删除、打印网格与第 128 轮基线逐线一致 ≤0.01mm、注入 style 恢复为纯 @page 无 offscreen-host 规则——无校准行为不变）正常。边界：+17mm 琥珀提示（像素核验 1255 px）+ 保存禁用，+10mm 可保存。

## 断言明细（测量数据 /home/ubuntu/r130_measure_*.txt，PDF /home/ubuntu/r130_print_*.pdf）
- 对话框反推（左18/上21.5/框170×257 → +2.00/-1.50/100.00%）— passed
- 正向偏移打印精度 ≤0.3mm、无 0.8% 缩水（P2-1 复测核心）：竖线最大误差 0.02mm、横线（含页底）≤0.03mm — **passed（P2-1 闭环）**
- 页数/内容完整：2 页、非空白、彩色/水印保留、页间漂移 ≤0.07mm — passed
- 负向偏移不回归（-2/+1.5）：≤0.04mm — passed
- 缩放补偿不受裁剪影响（99.01%/99.00%）：≤0.04mm、origin 左上 — passed
- 图片版 PDF 通道正偏移仍精确：210.000×297.000mm、≤0.21mm — passed
- 持久化（刷新保留+绿点）与清除重置（回基线 ≤0.01mm、style 无残留规则）— passed
- 边界校验（+17mm 禁存琥珀提示 / +10mm 可存）— passed

截图：/home/ubuntu/screenshots/r130_dialog_offset.png、r130_reload_dot.png、r130_reload_dialog.png、r130_boundary_17mm.png、r130_boundary_10mm.png。测试结束保持校准清除态。

---

# 第 129 轮：打印校准（CalibrationDialog）补偿链路专项（无代码变更，线上走查）

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn，沿用第 128 轮素材/纸型（标准考场版 + r113_40.xlsx + A4 21格）与测量方法（stub window.print + CDP printToPDF 捕获，pypdfium2 600dpi 逐线测量，基线=第 128 轮网格坐标）。未录屏。

**结论**: 校准链路整体可用：**负向偏移、缩放补偿、持久化/重置、边界校验、图片版 PDF 通道全部精确**（≤0.03mm）；**但发现 1 个新 P2：正向偏移（内容向右/超出纸边方向平移）会触发 Chromium 打印通道整体缩水约 0.8%**，页底网格误差累计约 -2mm，与图片版 PDF 通道行为不一致。另注：代码与 toast 均设计为「校准同时作用于导出与打印」（pdfExport.ts:510-514），与"只影响打印通道"的假设不同，按实际设计验证。

## P2-1（新增）正偏移校准下打印通道整体缩水
设 +2.00/-1.50mm 偏移后打印捕获：竖线 [2.10, 71.45, 140.67]（期望 [2.12, 72.02, 141.83]）、横向间距同缩 ~0.8%，页底行累计 -2mm。根因推断：translate(+2mm) 使 .sheet-page 内容超出 210mm 页宽，Chromium 打印布局触发 shrink-to-fit 整体缩放（负偏移/缩放补偿均无此现象，图片版 PDF 通道 +2mm 平移精确无缩水）。对需要正偏移补偿的用户实际套打误差可达 1-2mm（废纸线附近）。建议：打印样式对超出部分裁剪（如打印媒体下 overflow:hidden / 约束宿主宽度）以避免触发 shrink。

## 断言明细（测量数据 /home/ubuntu/r129_measure_*.txt）
- 对话框反推参数：填 左18/上21.5/框170×257 → 显示「+2.00 mm / -1.50 mm / 100.00%」与 computeCalibration 一致 — passed
- 打印通道偏移精度（+2/-1.5）：出现 ~0.8% 整体缩水，页底误差 -2mm — **failed（P2-1）**
- 打印通道偏移精度（-2/+1.5，无纸边溢出）：竖线 [38.44…207.76]=基线-2±0.02、横线 [1.61…]=基线+1.5±0.03 — passed
- 打印通道缩放补偿（99.01%/99.00%）：全部线 = 基线×scale ±0.02mm，origin 左上（0 线不动）— passed
- 图片版 PDF 通道（+2/-1.5）：页面精确 210×297，网格 = 基线+2/-1.5 ±0.03mm（设计即为导出也补偿，与 toast 一致）— passed
- 持久化：刷新后 localStorage 保留、工具栏「打印校准」绿点、对话框「当前已有生效的校准（偏移 +2.00 mm / -1.50 mm…）」— passed
- 重置：「清除校准」→ toast「已清除校准」→ localStorage 键删除、绿点消失、打印网格与第 128 轮基线逐线一致（≤0.01mm）— passed
- 边界：offsetX=+17mm（>15）→ 琥珀提示「超出常见打印机误差范围」+「保存并全局应用」禁用；+10mm（≤15）可保存 — passed（±10mm 属设计允许范围，无夹取、以禁用保存方式校验）

# 第 128 轮：打印输出物理精度与跨浏览器打印（无代码变更，线上走查）

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn。未录屏。方法：/studio 标准考场版 + r113_40.xlsx（40 行→2 页）→ 纸张设置「按纸型选择」锁定 A4 21格不干胶（3×7、70×42.4mm，居中推导边距 0/0.1mm）→ 三通道产 PDF：① 浏览器打印通道（真实 UI 点「打印 / 矢量 PDF」带水印导出，stub window.print + 延长 1.5s 卸载兜底保持打印宿主挂载，CDP `Page.printToPDF` preferCSSPageSize 抓取）；② 产品内「图片版 PDF」通道；③ Playwright Firefox 静默打印到 PDF（print.always_print_silent + Mozilla Save to PDF）。测量：pypdfium2 600dpi 渲染 + 像素灰度剖面找切线/标签边界，换算 mm 与纸型理论坐标（竖 0/70/140/210，横 0.1+42.4k）逐线对比，允差 ≤0.5mm。

**结论**: **全部通过，无新增 P 级问题**。三通道 21 格网格坐标全部落在 ±0.35mm 内（远小于 1mm 废纸线）；多页零漂移（≤0.08mm）；Firefox 打印通道输出不空白、布局正确、彩色保留。

## 断言明细（测量数据 /home/ubuntu/r128_measure_*.txt）
- Chromium 打印通道页面尺寸：594.96×841.92pt = 209.889×297.011mm（-0.111/+0.011mm，±0.2 内）— passed（注：Chromium printToPDF 对 A4 有 0.11mm 量化取整，属引擎行为）
- Chromium 打印通道网格：竖线偏差 [+0.12, +0.02, -0.17, -0.26]、横线最大 -0.35mm（页底累积），全部 ≤0.5mm — passed
- 多页不漂移：第 2 页 vs 第 1 页逐线偏差 ≤0.08mm — passed
- 产品「图片版 PDF」通道：页面精确 595.28×841.89pt = 210.000×297.000mm；网格最大偏差 -0.24mm；与打印通道逐线一致（差 ≤0.15mm）— passed
- Firefox 打印链路冒烟：静默打印到 PDF 成功（2 页非空白）、页面 596×842pt = 210.256×297.039mm（Firefox 按整数 pt 取整，+0.26mm，粗测 ≤1mm 内）、网格最大偏差 -0.11mm（三通道中最准）、水印/分栏色彩保留（12.7 万彩色像素）、控制台 0 错误 — passed
- 观察项（非缺陷）：Chromium 两通道均有约 0.09% 的系统性纵向压缩（每行 -0.04mm，页底累积 -0.24~-0.35mm），源于 mm→px→pt 换算取整；仍在允差内，如未来支持更多行数纸型（如 65 格）可复测累积值。
- 打印校准功能（CalibrationDialog 偏移/缩放补偿）本轮未单独验证 — untested（默认未启用校准，不影响本轮基线测量）。

# 第 127 轮：复测 PR #146（导出前对所有字段统一解除 overflow/line-clamp，合入 74ccd50）——第 126 轮 P2-1 闭环

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn。部署核验：`index-CLoFDGoD.js` → `index-DCbT6c26.js`（等待约 8 分钟上线）。未录屏。

**结论**: **全部通过，第 126 轮 P2-1（Firefox 导出字形顶部平切）闭环**：Firefox 同素材导出「王𠀀」的「王」三横完整、𠀀 台阶钩完整、「李𪛖」顶部不再压扁；Chromium 超长 24 字姓名 PNG/图片版 PDF 省略号截断与常规姓名均不回归；WebKit 冒烟不回归。**残留观察项（#146 未处理，非 fail）**：Firefox 导出字体仍与其预览不一致（预览衬线、导出黑体），字形完整可读。

## 断言明细
- 部署核验：新 bundle `index-DCbT6c26.js` — passed
- **Firefox P2-1 闭环（核心）**：同第 126 轮素材（r123_rare.xlsx）/模板（标准考场版）带水印 PNG 导出，`r127_firefox_png001_zoom.png` 王三横完整（对照 `r126_firefox_png1_zoom.png` 的「土」状）、`png002` 李𪛖 顶部完整、`png004` 张伟正常；下载正常、控制台 0 错误 — passed
- 残留观察项：Firefox 预览衬线 vs 导出黑体仍不一致（`r127_firefox_preview.png` vs 导出 PNG）——#146 范畴外，如实记录 — 观察项
- Regression Chromium PNG：`r127_long.xlsx`（24 字姓名「欧阳锋×8」+ 2 常规名）带水印导出，超长名呈「欧阳锋欧阳锋欧阳锋欧…」省略号截断、无叠压、顶部无平切（`r127_chromium_png001_zoom.png`）；常规名完整（`png002`）— passed
- Regression Chromium 图片版 PDF（带水印）：同素材一页，超长名省略号截断、常规名完整、无平切（`r127_pdf_zoom.png`）— passed
- Regression WebKit 冒烟：r123_rare.xlsx 导出字形完整（`r127_webkit_png001/002_zoom.png`，对照 r126 无回归）、下载正常、0 控制台错误 — passed
- 取证注记：Playwright 中导入 toast 6 秒后读取已消失（与第 126 轮相同的读取时机问题），以数据表/预览/导出产物确认导入成功。

# 第 126 轮：新角度线上走查——页面缩放适配 + 手输/粘贴名单链路 + Firefox/WebKit 跨浏览器冒烟

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn（无代码变更，纯探索走查）。未录屏。工具：桌面 Chromium 真实浏览器缩放（Ctrl+= / Ctrl+-，devicePixelRatio 实测 1.5 / 0.8 确认档位）+ CDP 取证；Playwright Firefox 1438 与 WebKit 1967（本轮新装，WebKit 另装了系统依赖并用 `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` 启动）。

**结论**: 缩放 150%/80% 主链路、手输（insertText 模拟 IME）/增删改/真实剪贴板粘贴名单、/seating→/studio 桌贴带入与导出、WebKit 冒烟全部通过；**发现 1 个新 P2：Firefox 下「图片 PNG」导出的姓名字段字形顶部被裁切**（王𠀀 的「王」缺顶横呈「土」状、𠀀 顶部台阶缺失、「李」顶部压扁——同素材 WebKit 与 Chromium 导出均正常），且 Firefox 导出字体与其预览不一致（预览衬线、导出黑体）。

## P 级问题
- **P2-1（新增）Firefox 图片 PNG 导出字形顶部裁切**：导入 r123_rare.xlsx 后带水印导出，`标准考场版-…-001.png` 中「王𠀀」渲染为「土 + 简化钩」（`r126_firefox_png1_zoom.png`），「李𪛖」顶部压扁（`r126_firefox_png2_zoom.png`）；同一素材同模板 WebKit 导出「王」三横完整、𠀀 台阶钩完整（`r126_webkit_png001_zoom.png`），第 125 轮 Chromium 导出亦正常。伴随现象：Firefox 预览为衬线字体、导出为黑体（字体未随导出管线应用）。疑似 html-to-image 在 Firefox 下的字体嵌入/垂直度量问题。Firefox 控制台 0 错误、下载行为正常（zip 73KB 正常落盘）。
- 无 P0/P1/P3 新增。

## 断言明细
### 1. 页面缩放（Chromium 真实浏览器缩放）
- 150%（dpr=1.5）：/studio 导入 40 行名单成功、无水平溢出（scrollWidth 1039 ≤ innerWidth 1045）、「图片 PNG」按钮可点、导出弹窗 6 个按钮全部在视口内（`r126_zoom150_studio.png`、`r126_zoom150_export.png`）— passed
- 80%（dpr=0.8）：同链路无溢出（1947 ≤ 1960）、弹窗完整（`r126_zoom80_*.png`）、window error 0 — passed
### 2. 手输/粘贴名单（/seating → /studio）
- CDP `Input.insertText` 模拟 IME 输入 3 个中文姓名：计数「已输入 3 人」，座位预览即时同步（`r126_seating_ime.png`）— passed
- 编辑（王强→王小强）与删行（李娜）：textarea 与预览即时同步为 2 人（`r126_seating_edit.png`）— passed
- 真实剪贴板粘贴 6 行「姓名 性别」（xclip + Ctrl+A/Ctrl+V）：替换生效、6 人入座、「男女混排」按钮由禁用变可用（`r126_seating_paste.png`）— passed
- 「一键生成对应桌贴」：跳 /studio?from=seating，6 条数据带入（姓名/座位号/排/列/班级 五列），座位号+姓名自动映射（考场/准考证号无对应列为「未映射」，合理），预览 6 张卡（`r126_handoff_studio.png`）；带水印 PNG 导出首试成功，6 张 PNG 内容正确（`r126_handoff_png1.png`）— passed
- 注：/studio 数据查看器为只读（搜索/筛选/排序，无添加/编辑行入口），与代码一致（DataImportPanel.vue「仅查看，不影响排版」），非缺陷。
### 3. 跨浏览器冒烟（r123_rare.xlsx 导入→预览→带水印 PNG 导出）
- Firefox：预览生僻字真实字形（`r126_firefox_rare_zoom.png`）、下载正常、控制台 0 错误 — passed；**导出字形顶部裁切 — failed（P2-1）**
- WebKit：预览生僻字正常（`r126_webkit_preview.png`）、导出 4 张 PNG 字形完整（`r126_webkit_png001/002/004_zoom.png`）、下载正常、控制台 0 错误 — passed
- 取证注记：两个 Playwright 浏览器中导入成功 toast 在 6 秒后读取时已消失（读取时机问题），toast 文案本项记 inconclusive，不影响其余断言（数据表/预览均确认导入成功）。
### 4. 跳过项
- 登录/短码链路：生产 KV/SES 未配置 — untested（既有限制）。
- #145 为测试技能文档 PR，不涉产品，未回归。

# 第 125 轮：复测 PR #144（Plangothic 置栈首，合入 4ccd10a）——#142–#144 系列闭环

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn。部署核验：`index-CLoFDGoD.js`；导入后 label computed font-family = `Plangothic, "Times New Roman", Times, SimSun, …`（栈首）。素材复用 `/home/ubuntu/r123_rare.xlsx`。未录屏。

**结论**: **全部通过，P1-1 闭环，#142–#144 生僻字扩展字库系列三轮收官**：预览「王𠀀」「李𪛖」真实字形（`getPlatformFontsForNode` = Plangothic P1，第 124 轮为 Liberation Serif），冷启动全新浏览器复现正常；导出首试成功不回归；常规汉字仍由模板字体（Noto Sans CJK SC）渲染、常规名单 0 字体请求、0 控制台错误。

## 断言明细
- 部署核验：新 bundle + 字体栈以 `Plangothic` 开头 — passed
- **预览字形（P1-1 闭环）**：王𠀀 / 李𪛖 真实遍黑体字形（`r125_preview_zoom.png` vs 第 124 轮 tofu）；platform fonts = `['Noto Sans CJK SC','Plangothic P1']`（常规字 Noto、生僻字 Plangothic）— passed
- 冷启动全新浏览器：字形正常（`r125_fresh_browser_zoom.png`）— passed
- info toast 文案不变 — passed
- 导出首试即成功（Regression）：一次点击产出 zip，放大核验字形正常（`r125_png_zoom1/2.png`）— passed
- **常规字符不受栈首置换影响（Regression 重点）**：40 行常用名单「王晓彤」「谢跃平」节点 platform fonts = `['Noto Sans CJK SC']`（非 Plangothic）；**冷启动浏览器导入常规名单 0 个 plangothic 请求**；window error 0 条 — passed
  - 取证注记：9222 复用标签页里 performance 条目出现 3 个 plangothic 项（含 exta-compat，为同标签页先前生僻字会话的缓存重取），冷启动浏览器 request 监听证实常规名单 0 请求，以冷启动为准。
  - 附带观察：Plangothic 置栈首后，扩展A 区「㐀」也改由遍黑体渲染（多下载 exta-compat 一包，字形正确）——按需加载语义正常，非问题。

**产物**: 截图 `/home/ubuntu/screenshots/r125_*.png`；导出 `/home/ubuntu/r125_dl/`；计划 `/home/ubuntu/repos/SeatMark/test-plan-round125.md`。

## 系列小结（第 123–125 轮）
- 第 123 轮（#142）：字库上线，发现 P1-1 预览豆腐块 + P2 导出空白竞态。
- 第 124 轮（#143）：P2 闭环（loadRareGlyphFonts）；P1-1 的 :key 重建方案无效（Chromium 按 FontDescription 缓存回退）。
- 第 125 轮（#144）：Plangothic 置栈首，P1-1 闭环；常规字体选择与导出均无回归。

---

# 第 124 轮：复测 PR #143（生僻字扩展字库两处修复，合入 9cf1529）

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn。部署核验：`index-U3ovpkRM.js` → `StudioView-CIeNiW-r.js` 含 `rareFontTick` 指纹 ×1。素材复用 `/home/ubuntu/r123_rare.xlsx`。未录屏。

**结论**: **P2（导出空白失败）已闭环——连续 2 轮带水印 PNG 导出均第一次点击即成功、字形正确；但 P1-1（预览豆腐块）未修复——`rareFontTick` 确认已自增到 1、LabelSheet 已按 :key 重建，重建后的节点仍由 Liberation Serif（.notdef）渲染，9222 会话与冷启动全新浏览器均复现。常规名单回归干净。**

## 断言明细
- 部署核验：新 bundle + `rareFontTick` 指纹 — passed
- info toast 不变：「名单含 2 个生僻字 | 已自动启用生僻字扩展字库（遍黑体），预览与导出将正常显示」（`r124_rare_toast.png`）— passed
- **预览字形（P1-1 复测）**：王𠀀 / 李𪛖 仍豆腐块（`r124_preview_zoom.png`；冷启动浏览器 `r124_fresh_browser_zoom.png`）；Pinia `workspace.rareFontTick`=1（重建确已触发）、分包 2 个均下载，但 `CSS.getPlatformFontsForNode` 仍 = Liberation Serif — **failed（P1-1 仍开放）**
- **导出首试即成功（P2 复测）**：连续 2 轮「图片 PNG → 带水印导出」均一次成功产出 zip（0455、0456），无「渲染为空白」toast；解包放大 王𠀀 / 李𪛖 字形正常（`r124_png_zoom1/2.png`）— passed（P2 闭环）
- Regression 40 行常用名单：仅成功 toast、0 个 plangothic 请求、window error 0 条（`r124_normal_import.png`）— passed

## P1-1 根因补充（供修复参考）
`:key` 重建生成的新 DOM 节点与旧节点具有**完全相同的 FontDescription**（同字体栈/字号/字重/字距），Chromium 的字体回退缓存按 FontDescription 命中——重建拿到的仍是「加载前」解析出的 Liberation Serif 回退，故重建无效（与第 123 轮克隆节点复现一致）。已验证有效的口径（第 123 轮诊断）：**改变字体栈本身**——把 `'Plangothic'` 插到栈首（unicode-range 保证常规字符零影响），元素立即出字形；或在重建时给含生僻字的字段附加可忽略的描述差异。建议 withRareCJKFallback 直接前置 Plangothic。

**产物**: 截图 `/home/ubuntu/screenshots/r124_*.png`；导出 `/home/ubuntu/r124_dl/`；计划 `/home/ubuntu/repos/SeatMark/test-plan-round124.md`。

---

# 第 123 轮：回归 PR #142（遍黑体生僻字扩展字库，合入 179d6ce）

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn。部署核验：`index-CzFr1-Dz.js`（CSS `index-DfAKOVgD.css` 含 21 条 Plangothic @font-face；`StudioView-rcrT9nhD.js` 含「已自动启用生僻字扩展字库」指纹；`/fonts/plangothic/plangothic-extb-20.woff2` 200 + `cache-control: public, max-age=2592000`；sw.js 预缓存 0 条 plangothic）。素材 `/home/ubuntu/r123_rare.xlsx`（王𠀀 U+20000、李𪛖 U+2A6D6、陈㐀 U+3400、张伟）。未录屏。

**结论**: **toast、按需分包下载、导出 PNG 字形三项达成；但发现 2 个新 P 级问题：P1-1 预览区生僻字仍显示豆腐块（与 toast 承诺「预览与导出将正常显示」矛盾，全新浏览器/新标签页/重导入/改缩放均复现）；P2-1 PNG 导出对含生僻字名单前两次连续失败「第 1/1 页第 2 枚标签渲染为空白」，第三次成功（未扣次数，重试可恢复）。常规 40 行名单回归干净。**

## 核心链路
- 导入 toast：「名单含 2 个生僻字 | 已自动启用生僻字扩展字库（遍黑体），预览与导出将正常显示」info 样式，无黄色码位警告（`r123_rare_toast.png`）。检测数 2 = 本环境实际缺字形数（㐀 ExtA 由 Noto Sans CJK 提供字形，正确不计）— passed
- 按需分包：仅下载 `plangothic-extb-20.woff2` + `plangothic-extb-2a.woff2` 两包（21 包中命中 2 包，均 200）— passed
- **P1-1 预览豆腐块**：导入后预览卡「王𠀀」「李𪛖」持续 tofu（`r123_preview_zoom.png`、全新浏览器 `r123_fresh_browser_zoom.png`）。CDP `CSS.getPlatformFontsForNode` 显示生僻字由 **Liberation Serif**（.notdef）渲染而非 Plangothic，尽管 `document.fonts.check('32px Plangothic','𠀀')`=true、两包 status=loaded、元素 computed font-family 含 Plangothic。诊断：把该元素 font-family 改为 `Plangothic` 或 `Plangothic, ...`（置首）立即出字形；同栈新建 span 也出字形——疑似 Chromium 对「先以回退渲染、后完成加载的 unicode-range 分包字体」不重新解析既有文本 run 的失效缺陷，叠加 Plangothic 排在栈尾。重导入、新标签页、冷启动浏览器、改缩放均不恢复 — **failed**
- **P2-1 导出前两次失败**：「PNG 生成失败 | 第 1/1 页第 2 枚标签渲染为空白；本次未扣除无水印次数，可直接重试」连续 2 次，第 3 次成功 — failed（可重试恢复）
- 导出 PNG 字形（核心验收）：zip 4 张逐张 PNG，放大核验 王𠀀 / 李𪛖 均为真实遍黑体字形、陈㐀 / 张伟 正常（`r123_png_zoom1/2.png`）— passed

## Regression
- 40 行常用名单：仅「Excel 导入成功 | 已读取 40 条数据」，**0 个** plangothic 字体请求，window error 0 条 — passed

**产物**: 截图 `/home/ubuntu/screenshots/r123_*.png`；导出 `/home/ubuntu/r123_dl/`；素材 `/home/ubuntu/r123_rare.xlsx`；脚本 `/home/ubuntu/r123_ui.py`、`r123_png.py`。

修复方向（供参考）：① 预览——加载完成后强制重排生僻字文本（如 fonts.load 兜住后对含生僻字的 label 触发一次 key 重建/文本重写），或把 Plangothic 插到字体栈更前位置（诊断证实置首即出字形，unicode-range 保证常规字符不受影响）；② 导出——导出前 `await document.fonts.load` 对应分包再渲染，消除「渲染为空白」竞态。

---

# 第 122 轮：回归 PR #140（设计器补 aria-label + 滚动区可聚焦，合入 ff33f50）

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn。部署核验：`index-DB3MfAP2.js` → `StudioView-DBBwVtxp.js` 含「设计器状态栏」指纹 ×1。同第 121 轮口径（axe-core 4.10.2 CDP 注入，设计器 390 选中文本字段态 + /studio 1280 默认态）复扫。未录屏。

**结论**: **第 121 轮 P2-1（critical label）与 P2-2（serious scrollable-region-focusable）两组全部清零；属性面板编辑与预览区键盘聚焦/滚动无回归；存量 P3 对比度组按约定保留不算失败。控制台 error / ≥400 0 条。**

## axe 复扫（同口径对比）

| 位置 | 第 121 轮 | 本轮 | 判定 |
|---|---|---|---|
| 设计器（390）label critical | 1 组 4+ 节点 | **0** | ✅ P2-1 闭环 |
| 设计器（390）scrollable-region-focusable | 1（状态栏） | **0** | ✅ P2-2 闭环 |
| /studio 1280 scrollable-region-focusable | 1（预览容器） | **0** | ✅ P2-2 闭环 |
| 存量 color-contrast（P3-2） | serious | 仍在（studio 5 / designer 6 节点） | 存量保留，不算失败 |
| 设计器 landmark-unique（moderate） | 1 | 仍在 | 存量 P3 随手项 |

属性检查：预览容器 `tabindex=0` + `aria-label="标签预览区"`；状态栏 footer `tabindex=0` + `aria-label="设计器状态栏"`；设计器 29 个 input 均带 aria-label（显示名称/固定文本内容/示例内容（仅预览用）/标签名前缀（可选）/列数/行数/模板说明全数确认，示例内容在 Excel 数据列来源字段下可见，截图 `r122_sample_input.png`）。

## 无回归抽查
- 属性面板编辑：改「显示名称」→「姓名2」，字段列表/状态栏即时同步（截图 `r122_edit_label.png`）；「列数」2→3 生效（页脚「3 列 × 5 行」）；全部在草稿内完成后点「取消」丢弃，未保存 — passed
- /studio 预览滚动区：纯 Tab 键盘路径第 55 次聚焦到「标签预览区」容器，聚焦环像素可见（`r122_preview_focus.png`），scrollBy 后 scrollTop=200 滚动正常 — passed
- 控制台 error / ≥400：0 条 — passed

**截图**: `/home/ubuntu/screenshots/r122_preview_focus.png`、`r122_sample_input.png`、`r122_edit_label.png`。axe JSON：`/home/ubuntu/r122_axe/`。脚本：`/home/ubuntu/r122_scan.py`、`r122_preview.py`、`r122_sel4.py` 等。

注记：预览容器焦点在 Tab 顺序第 55 位（其前为模板列表/导入/映射等常规控件），键盘用户到达成本较高，属可用性观察项（非违例，lead 裁量）。

---

# 第 121 轮：全站无障碍复审（axe-core 4.10.2，生产 index-DbIr-7Wl.js，无代码改动前置）

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn。axe 4.10.2 CDP 注入扫描五页（/、/studio、/templates、/seating、/pricing）× 390/844 与 1280/900 双视口（10 组）+ 设计器（390）加扫 1 组；键盘路径用 Input.dispatchKeyEvent 真实按键。历史基线明细已不在 repo（仅存 ≥72 轮），口径对齐方式：同一根因去重、整改后预期 serious/critical=0，本轮 serious/critical 均以 git blame 判新旧。未录屏。

**结论**: **主站五页双视口 critical=0；键盘路径（skip-link / SelectField 方向键 / 导出弹窗焦点圈闭+Esc / toast status 语义）与新增组件 label（切换工作表 select / 移动侧栏按钮 / HEX 色值输入）全部通过。发现 4 组存量违例（均早于 #64/#65，非新增退化）：1 组 critical（设计器属性面板/列×行输入无程序化标签）+ 3 组 serious（预览滚动区不可聚焦、/seating 座位号对比度、模板缩略图小字对比度）。**

## axe 扫描（去重后按根因）

| # | 根因 | impact | 页面/视口 | 引入时间 | 判级 |
|---|---|---|---|---|---|
| 1 | 设计器属性面板文本输入（显示名称/固定文本/示例内容/模板描述，`TemplateDesigner.vue:1626` 等 label 无 for/无 aria-label）+「列 × 行」NumberField 无 aria-label（`TemplateDesigner.vue:1934-1948`；同类 `LayoutPanel.vue:261,271` 已在 #64 修复） | **critical**（label） | 设计器（390） | 2026-06-11（#64 漏网） | **P2-1** |
| 2 | Studio 预览滚动容器 `.overflow-auto` 无 tabindex（`PreviewArea.vue:1085`）；设计器底部状态条 `.gap-x-4 overflow-x-auto` 同类 | serious（scrollable-region-focusable） | /studio d1280、设计器 | 2026-08-06（#64 只修了数据表） | **P2-2** |
| 3 | /seating 座位号 `.seating-seat-no` slate-400（rgb 148,163,184）10.6px 白底，对比度≈2.4:1（`SeatingView.vue:864`），40 节点 | serious（color-contrast） | /seating 双视口 | 2026-08-04 | **P3-1**（打印预览装饰性小号，屏显亦应≥4.5:1） |
| 4 | 模板缩略图/预览 `label-field__content` 缩小灰字（多数位于 `aria-hidden="true"` 装饰容器内） | serious（color-contrast） | /studio、/templates、设计器 | ≤2026-06-11 | **P3-2**（装饰性缩略图，建议对 aria-hidden 容器加 axe 排除或提对比度） |

/、/pricing 双视口 0 违例；critical 全站仅设计器 1 组；另设计器 1 条 moderate（landmark-unique）记 P3 随手项。原始 JSON：`/home/ubuntu/r121_axe/`（11 份）。

## 键盘抽查（/studio 1280，真实按键）
- skip-link：Tab 1 次焦点即「跳到主内容」且像素可见（`r121_skiplink.png`），回车后焦点落 MAIN、页面滚至主内容 — passed
- 多 sheet 下拉：原生 `select[aria-label="切换工作表"]`，选项 2 个 — passed
- 映射 SelectField：触发钮按 ↓ 展开（5 options）；↓/↓/↑ 焦点在 role=option 间移动（未映射→姓名→未映射，截图 `r121_selectfield.png`）；Esc 关闭且焦点回触发钮 — passed
- 导出弹窗（图片 PNG）：aria-modal + aria-label「导出图片（PNG）」；连续 14 次 Tab 全部圈闭在弹窗内并循环（关闭→单位→尺寸→黑白→命名→无水印→带水印→关闭…）；Shift+Tab 反向；Esc 关闭且焦点回「图片 PNG」按钮 — passed
- toast 容器 `[role=status][aria-label="操作提示"]` 语义仍在 — passed

## 新增组件 label/name
- 设计器移动侧栏（390）：「字段列表」「属性面板」按钮 aria-label 存在且可见可用（`r121_designer_layers.png`）— passed
- 颜色 HEX 输入：`input[aria-label="HEX 色值"]`（值 #94A3B8）+「打开取色器」label，像素可见（`r121_designer_hex.png`）— passed
- 五页导航控制台 error / ≥400：0 条 — passed

**截图**: `/home/ubuntu/screenshots/r121_skiplink.png`、`r121_selectfield.png`、`r121_export_dialog.png`、`r121_designer_layers.png`、`r121_designer_hex.png`、`r121_seating.png`。脚本：`/home/ubuntu/r121_scan.py`、`r121_kbd.py`、`r121_kbd2.py`、`r121_kbd3.py`、`r121_designer3.py`、`r121_hexshot.py`、`r121_err.py`。

---

# 第 120 轮：回归 PR #138（Excel 导入 raw:false 读格式化文本，合入 3468901）

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn `/studio`（签到桌牌版）。部署核验：`index-DbIr-7Wl.js` → `excel-BTvehrnn.js` 含 `raw:!1` 指纹 ×1（`app/src/utils/excel.ts:36`）。同素材 `/home/ubuntu/r119_fmt.xlsx` 逐列回归 + 常规导入回归。未录屏。

**结论**: **第 119 轮 3 个 P2 + 2 个 P3 全部闭环。数据表/映射预览/导出 PNG 三处均显示格式化文本；常规导入（40 行名单、CSV、标题行跳过、多 sheet 切换 + 生僻字警告）无退化；控制台 error / ≥400 响应 0 条。**

## 逐列判定（预期 = 产品同版本 SheetJS 0.20.3 `raw:false` 本地预读值）

| 列 | 第 119 轮（raw） | 本轮实际（数据表） | 判定 |
|---|---|---|---|
| 考试日期 | 46249 | **2026/8/15** | ✅ P2-1 闭环 |
| 入场时间 | 0.5625 | **13:30** | ✅ P2-2 闭环 |
| 工号（fmt 000） | 7 | **007** | ✅ P2-3 闭环 |
| 出勤率（0.0%） | 0.985 | **98.5%** | ✅ P3-1 闭环 |
| 分数（0.00，12345.678） | 12345.678 | **12345.68** | ✅ P3-2 闭环 |
| 报名费（¥#,##0.00，128.5） | 128.5 | **128.5**（SheetJS 对该货币格式渲染文本即 128.5，非「¥128.50」；按用户要求如实记录，非回归） | 注记 |
| 身份证文本 | 110101200808154321 | 不变 | ✅ |
| 身份证数字 | 110101200808154300 | 不变（Excel 存储层丢精度，与 Excel 一致） | ✅ |
| 称呼（公式缓存值） | 张伟老师 | 不变 | ✅ |

映射（座位号→工号/考场→考试日期/准考证号→入场时间）后预览显示「007」「2026/8/15」「13:30」；整页 PNG 导出（`/home/ubuntu/r120_dl/签到桌牌版-20260810-0315.png`，2481×3509）放大同样清晰显示 007 / 2026/8/15 / 13:30。第二行 王芳（012、2026/8/16、9:00、50.0%、88.10）同样正确。

## 常规导入回归（本地 raw:false 预读均已建立预期，全部一致）

- 40 行常用名单 `r113_40.xlsx`：「已读取 40 条数据」，考号 20260001 原样（无千分位/科学计数）— passed
- CSV `r120_list.csv`（UTF-8 BOM）：「已读取 2 条数据」，座位号「03」「04」前导零保留，预览正常 — passed
- 合并标题行 `r120_title.xlsx`（A1:C1 合并大标题+空行+第 3 行表头）：标题行正确跳过，表头=姓名/座位号/考场，数据 01/02 — passed
- 多 sheet `r115_rare.xlsx`：默认 sheet「已读取 3 条数据；文件含 2 个工作表」；切换到「生僻字名单」成功且生僻字警告（码位 U+20000、U+2A6A5）仍正常触发（#135/#136 路径无退化）— passed
- 全程控制台 error / HTTP ≥400：0 条 — passed

**截图**: `/home/ubuntu/screenshots/r120_table.png`、`r120_table_right.png`、`r120_mapping.png`、`r120_png_zoom.png`、`r120_csv.png`、`r120_title.png`、`r120_sheet_switch.png`、`r120_import.png`。脚本：`/home/ubuntu/r120_reg.py`、`/home/ubuntu/r120_ms.py`（复用 r119_ui/map3/png 系列）。

取证注记：复用第 119 轮脚本时两张第 119 轮截图（`r119_import.png`、`r119_table_right.png`）被本轮内容覆盖/更名（第 119 轮核心证据 `r119_table.png`、`r119_mapping.png`、`r119_png_zoom.png` 完好）。

---

# 第 119 轮：Excel 单元格类型与格式真实性走查（无代码改动，线上 index-DJutNByJ.js）

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn `/studio`（签到桌牌版）。素材 `/home/ubuntu/r119_fmt.xlsx`：openpyxl 构造真实类型单元格（date/time/文本与数字身份证/前导零工号/百分比/货币/两位小数格式/含缓存值的公式），并先用产品同版本 SheetJS 0.20.3 同参数（`excel.ts:24,35` `raw:true`）本地预读建立预期。真实 UI 导入 → 字段映射（姓名/座位号→工号/考场→考试日期/准考证号→入场时间）→ 预览 + 整页 PNG 导出核验。未录屏。未改任何产品代码。

**结论**: **预判全部命中——导入按原始值（`.v`）读取、完全忽略单元格数字格式：新发现 3 个 P2（日期显示序列数 46249、时间显示 0.5625、前导零丢失 007→7）+ 2 个 P3（百分比 98.5%→0.985、格式化小数/货币按原值显示）；文本格式身份证、含缓存值的公式单元格（读值「张伟老师」非公式）表现正确；数字格式身份证丢精度与 Excel 内一致（Excel 本身限制，非我方问题）。预览/数据表/导出 PNG 三处显示一致（无进一步失真）。**

## 逐列判定（Excel 用户所见 vs 线上 UI/导出实际显示）

| 列（格式） | Excel 中显示 | UI 数据表/预览/导出 PNG | 判定 |
|---|---|---|---|
| 考试日期（date 型，yyyy/m/d） | 2026/8/15 | **46249**（序列数） | **P2-1** |
| 入场时间（time 型，h:mm） | 13:30 | **0.5625** | **P2-2** |
| 工号（数字，fmt 000，值 7） | 007 | **7**（前导零丢） | **P2-3** |
| 出勤率（0.0%，值 0.985） | 98.5% | 0.985 | **P3-1** |
| 报名费（¥#,##0.00，128.5） | ¥128.50 | 128.5 | P3-2（同类：格式修饰丢失） |
| 分数（0.00，12345.678） | 12345.68 | 12345.678 | P3-2 |
| 身份证文本（@） | 110101200808154321 | 110101200808154321 | passed |
| 身份证数字（0） | 110101200808154300（Excel 已丢精度） | 110101200808154300 | passed（与 Excel 一致；丢精度发生在 Excel 存储层） |
| 称呼（公式 =A2&"老师"+缓存值） | 张伟老师 | 张伟老师（读缓存值非公式串） | passed |

- 根因（代码层）：`app/src/utils/excel.ts:24,35` `XLSX.read` 未开 `cellDates`，`sheet_to_json` 默认 `raw:true` 取 `.v` 原始值。SheetJS 同文件以 `raw:false` 读出的 `w`（格式化文本）恰为 Excel 所见（2026/8/15、13:30、007、98.5%、12345.68）——**修复方向现成：改用 `raw:false`（或对含 `z` 格式的单元格取 `.w`），文本/公式列不受影响**。
- 一致性：预览标签（座位号椭圆「7」、页脚「46249」「0.5625」）与导出 PNG 渲染逐像素一致（`r119_png_zoom.png`），无二次失真。
- 导入成功 toast「已读取 2 条数据」；映射自动匹配后手工指定 4/4；控制台 error / ≥400 响应 0 条。

**产物**: 素材 `/home/ubuntu/r119_fmt.xlsx`；截图 `r119_import.png`、`r119_table.png`（原始值数据表左半）、`r119_table_right.png`（右半：工号/出勤率/报名费/分数/称呼）、`r119_mapping.png`（映射+预览）、`r119_png_zoom.png`（导出放大）；导出 `/home/ubuntu/r119_dl/签到桌牌版-20260810-0301.png`；脚本 `/home/ubuntu/r119_ui.py`、`r119_map3.py`、`r119_png.py`；计划 `test-plan-round119.md`。

---

# 第 118 轮：复测 PR #137（Hero 首帧估算宽度定高，2e963e8）+ /studio 移动新基线

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn。npx lighthouse 13.x + Chromium 121 headless（同第 98/117 轮口径）；Hero 目视用 9222 真实 UI 1280×900 与 390×844 截图。未录屏。未改任何产品代码。

**结论**: **#137 目标达成——桌面首页 CLS 三跑全 0.0000（第 117 轮为 0.0435 ×2 可复现），layout-shifts 明细中 hero 区块条目消失；桌面 Perf 中值 100 不劣化；移动首页 CLS 保持 0、LCP 中值 1.91s（vs 第 117 轮 1.87s，+2%）；Hero 1280/390 目视正常。/studio 移动新基线已建立（同构建 5 跑中值）。无新增 P 级问题。**

## 1. 部署核验
- `/` 新 `index-DJutNByJ.js` → `HomeView-CeMkV3NK.js` 含指纹 `Math.min(448,window.innerWidth-32)` ×1。

## 2. 桌面首页 ×3（核心）
| 跑 | Perf | LCP | TBT | CLS | layout-shifts 明细 |
|---|---|---|---|---|---|
| 1 | 88 | 1.44s | 11ms | **0.0000** | 空 |
| 2 | 100 | 0.58s | 6ms | **0.0000** | 空 |
| 3 | 100 | 0.49s | 11ms | **0.0000** | 空 |

中值 Perf 100 / CLS 0 — 第 117 轮 hero 区块位移（0.0435 两跑一致）归零。跑 1 Perf 88 为 LCP 网络抖动（CLS 仍 0），中值不受影响。

## 3. 移动首页 ×3（Regression）
- Perf 85/86/92（中值 86，vs 第 117 轮中值 91，−5 分在 10% 容差内）；LCP 1.73–2.12s（中值 1.91s，vs 1.87s +2%）；TBT 294–458ms（中值 340ms，vs 304ms +12%，与第 117 轮 247–428ms 抖动区间重叠，非趋势性劣化）；CLS 全 0；SEO 100。

## 4. Hero 目视
- 1280×900：Hero 预览卡（A4 排版 24 枚/页缩略）缩放正常、无溢出/遮罩异常（`r118_hero_1280.png`）。
- 390×844：布局正常、预览卡在首屏下方正常渲染（`r118_hero_390.png`）。

## 5. /studio 移动新基线（index-DJutNByJ.js 构建，5 跑）
| 跑 | Perf | LCP | TBT | CLS |
|---|---|---|---|---|
| 1 | 61 | 6.55s | 263ms | 0 |
| 2 | 75 | 4.01s | 365ms | 0 |
| 3 | 71 | 4.79s | 356ms | 0 |
| 4 | 62 | 5.91s | 299ms | 0 |
| 5 | 80 | 2.67s | 410ms | 0 |

**新基线（中值）：Perf 71 · LCP 4.79s · TBT 356ms · CLS 0 · SEO 100**。注：LCP 单跑抖动 2.67–6.55s（±40%），后续对比请用 ≥3 跑中值且以该表为准（第 98 轮旧基线作废）。第 117 轮观察项①按此口径收敛：4.72s（117 中值）vs 4.79s（118 中值）同水平，非趋势性回归。

**产物**: JSON `/home/ubuntu/r118_lighthouse/`（11 份）；截图 `r118_hero_1280.png`、`r118_hero_390.png`；脚本 `/home/ubuntu/r118_hero.py`；计划 `test-plan-round118.md`。

---

# 第 117 轮：性能回归审计（#123–#136 累积，线上 index-EpdOIcut.js，无代码改动）

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn。npx lighthouse 13.x + Chromium 121 headless（与第 98–100 轮同口径：移动=默认 moto G4 仿真+4x CPU+slow4G 节流；桌面=--preset=desktop）；导入耗时用 9222 真实 UI + 0.1s toast 轮询。未录屏。未改任何产品代码。

**结论**: **首页/`/templates` 无劣化（首页移动 Perf 91–94 vs 基线 92，/templates 移动 64 vs 基线 51 反而提升，五页双端 SEO 全 100、移动 CLS 全 0）；40 行常用名单导入 toast 0.12–0.13s 即出、#135 检测路径零感知开销。一个观察项（未定 P 级，见下）：/studio 移动 LCP/TBT 三跑中值较第 98 轮基线 +14%/+29%，但基线可比性存疑（第 98 轮为 #122 统计延迟注入之前的构建），且跑分抖动大（LCP 4.02–5.79s）；另桌面首页 CLS 0.044（hero 区块，可复现但远低于 0.1 阈值与第 98 轮桌面 0.46）。**

## 1. Lighthouse 分数表（Perf/A11y/BP/SEO · LCP/TBT/CLS）

| 页面 | 移动 | 桌面 |
|---|---|---|
| `/` | **91–94**（3 跑，另有 1 次冷跑 75 离群）/100/58/100 · 1.71–2.25s/247–325ms/0 | 100/100/58/100 · 0.47–0.49s/25ms/**0.044** |
| `/templates` | 64/96/58/100 · 4.09s/431ms/0 | 98/96/58/100 · 0.77s/72ms/0 |
| `/studio` | 68–78（3 跑）/96/58/100 · 4.02–5.79s/255–336ms/0 | 88/96/58/100 · 1.87s/9ms/0 |
| `/pricing` | 99/100/58/100 · 1.74s/90ms/0 | 100/100/58/100 · 0.52s/0ms/0 |
| `/guides/label-print-troubleshooting` | 98/100/58/100 · 1.74s/123ms/0 | 100/100/58/100 · 0.50s/0ms/0 |

## 2. 与基线对比（重点页）

- `/` 移动 vs 第 100 轮（Perf 92 · LCP 1.75s · TBT 311ms · CLS 0）：稳定跑 Perf 91/91/94，LCP 中值 1.87s（+7%，≤10%），TBT 中值 304ms（−2%），CLS 0，SEO 100 — **无劣化**。首跑 75（LCP 3.24s）为 npx 冷启动离群值，复跑 3 次均恢复，如实记录。
- `/templates` 移动 vs 第 99 轮（51 · 8.20s · 507ms）：64 · 4.09s · 431ms — **提升**。
- `/studio` 移动 vs 第 98 轮（54 · 4.13s · 249ms · CLS 0.96）：68–78 · LCP 中值 4.72s（+14%）· TBT 中值 321ms（+29%）· CLS 0（0.96→0 大幅改善）。观察项：LCP/TBT 中值超 +10%，但 ① 基线是 14 个 PR 前且 #122（统计 idle 注入）之前的构建、口径不完全可比；② 三跑抖动 LCP 4.02–5.79s 覆盖基线值。保守记为**观察项（建议下轮复测定级）**，非确证 P 级回归。
- 桌面首页 CLS 0.044（两跑一致，layout-shifts 元凶 `section.relative > div.relative` hero 区块）：低于 0.1 良好阈值、远低于第 98 轮桌面 0.46；「全站 CLS=0」在桌面首页不严格成立，记为观察项。
- SEO 五页双端全 100 — 无劣化。

## 3. #135 导入路径耗时（40 行常用名单，真实 UI）

- 两次独立导入 `/home/ubuntu/r113_40.xlsx`：文件设入 → 「Excel 导入成功 | 已读取 40 条数据」toast 分别 **0.127s / 0.121s**，无生僻字警告（`isRareCodePoint` 先过滤常用字、canvas 未触发）— 无感知劣化。截图 `r117_import_run1/2.png`。

## 4. 断言汇总

- 部署核验：`index-EpdOIcut.js` 含 `isReady().then` 指纹 ×1 — passed
- 首页移动 LCP/TBT/CLS 劣化 ≤10%、SEO 100 — passed（稳定跑）
- /studio 移动 CLS=0、SEO=100 — passed；LCP/TBT 中值 +14%/+29% — 观察项（基线可比性+抖动，未定级）
- 五页双端 SEO=100 — passed；移动 CLS 全 0 — passed；桌面 CLS：仅首页 0.044 — 观察项
- 40 行导入 ≤2s 无警告 — passed（0.12–0.13s）

**产物**: `/home/ubuntu/r117_lighthouse/*.json`（14 份）；截图 `r117_import_run1/2.png`；脚本 `/home/ubuntu/r117_import.py`；计划 `test-plan-round117.md`。

---

# 第 116 轮：微回归 PR #136（生僻字警告改码位描述，6e3ba6c）

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn。改动：`workspace.ts` warnRareChars——标题「名单含 N 个生僻字」、正文只用码位不嵌入缺字形字符。测法：复用第 115 轮素材（r115_rare_only.xlsx / r113_40.xlsx）与 0.25s toast 轮询脚本。未录屏。

**结论**: **第 115 轮 P3-1 闭环——warning 标题「名单含 2 个生僻字」+ 正文「名单中有生僻字（码位 U+20000、U+2A6A5）…」全部清晰可读、零豆腐块（对比第 115 轮整段方块）；码位与本环境缺字形字完全一致；常用名单零误报。无新增 P 级问题。**

- 部署核验：`index-EpdOIcut.js` → `StudioView-JFUAWlrd.js`，新指纹「名单中有生僻字（码位」×1，旧指纹 0。
- 生僻名单导入：截图 `r116_rare_import.png`（放大 `_zoom`）标题/正文逐字可读；DOM 文本恰为「名单含 2 个生僻字 | 名单中有生僻字（码位 U+20000、U+2A6A5）在当前设备字体中缺少字形…」。
- 常用 40 行（Regression）：仅「Excel 导入成功 | 已读取 40 条数据」，无警告。
- 控制台 error / ≥400 响应 0 条。

---

# 第 115 轮：线上回归 PR #135（导入名单生僻字缺字形检测，f42a6cc）

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn。改动：`glyphSupport.ts`（U+FFFF canvas 像素比对，仅扫扩A/扩B–H/兼容区）+ `workspace.ts:498-507`（importExcel/switchSheet 成功后 `toast.warning('名单含生僻字', …)`）。测法：9222 真实 UI；环境预探（与产品同 canvas 口径）：**𠀀/𪚥 缺字形、㐀 有字形**，据此做对抗性断言（必须恰列「𠀀、𪚥」且不含 㐀）。素材：40 行常用名、双 sheet（常用+生僻）、单 sheet 生僻。未录屏。

**结论**: **检测功能全部符合预期：三条路径（直接导入/多 sheet 切换/常用名单零误报）均正确，warning 恰列「𠀀、𪚥」、无 㐀 误报，控制台零报错。新增 1 个 P3 展示问题：在缺字形设备上（正是该警告的目标受众），把生僻字混入 toast 正文会污染整行字体回退——本环境（headless Chromium 121/Linux）warning 正文整段渲染为豆腐块，标题正常。**

- 部署核验：`index-CFtvvO8q.js` → `StudioView-BCeXz_gk.js` 后继 chunk 含指纹「名单含生僻字」×1（StudioView chunk）。
- 常用 40 行：仅「Excel 导入成功 | 已读取 40 条数据」，无 warning（截图 `r115_normal_import.png`）— 零误报。
- 双 sheet 导入（默认常用 sheet）：成功 toast 含「文件含 2 个工作表」，无 warning；切换 select 到「生僻字名单」→「已切换到工作表」+ **「名单含生僻字」warning，DOM 正文恰为「𠀀、𪚥」**（无 㐀）（截图 `r115_switch_warning.png`）。
- 单 sheet 生僻直接导入：同样弹 warning，正文同上（截图 `r115_rare_import.png`）。
- **P3-1（新）警告正文在缺字设备整段豆腐块**：截图中 warning 标题「名单含生僻字」清晰，正文两行全部为方块。对照实验（页内注入两个 div）：含「𠀀、𪚥」的整句全部豆腐块，去掉生僻字的同句正常渲染（`r115_fontprobe_zoom.png`）——astral 字符使整个 text run 的字体回退失败（本环境 fontconfig 行为）。真机字体栈更全时可能只有生僻字两个字是方块，但警告的目标场景恰是字体缺失设备。建议：正文里生僻字用独立 span 包裹，或附码位（如 U+20000）兜底可读。
- 控制台 error / ≥400 响应 0 条。

| 断言 | 结果 |
|---|---|
| 部署指纹「名单含生僻字」 | PASS |
| 常用名单零误报 | PASS |
| 切换 sheet 触发 warning，恰列 𠀀、𪚥 无 㐀 | PASS |
| 直接导入触发 warning 同口径 | PASS |
| 警告正文在缺字设备可读 | **FAIL（P3-1 整段豆腐块）** |
| 控制台零报错 | PASS |

既有开放项不变：生产 `x-seatmark-storage: memory` + SES 未配置。

---

# 第 114 轮：微验证 PR #134（逐张导出进度单位改「张标签」，6a1ed46）

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn。改动：`PreviewArea.vue:634`——perLabel 文案改 `已完成 ${done}/${total} 张标签，正在生成图片...`（整页不变）。测法：复用第 113 轮 40 行名单与 50ms 采样脚本，逐张/整页各带水印导出一次。未录屏。

**结论**: **目标达成——逐张模式浮层为「已完成 N/40 张标签，正在生成图片...」（截图+DOM），全程零出现「N/40 页」旧文案；整页模式不变；两模式导出成功，控制台零报错。无新增 P 级问题。**

- 部署核验：`index-EC2GXqhA.js` → `StudioView-BCeXz_gk.js`，新指纹「张标签，正在生成图片」×1，旧指纹「张标签图片」0。
- 逐张：截图 `r114_label_progress.png` 显示「已完成 6/40 张标签，正在生成图片...」；全程 17 条唯一文案，13 条「已完成」全为「N/40 张标签」形态、零「N/40 页」；zip 恰 40 张 PNG。
- 整页（Regression）：6 条唯一文案不变（终相「已完成 4/4 页，正在生成图片...」，DOM 采样；浮层像素截到「正在渲染第 4/4 页...」相 `r114_page_render.png`，终相 ~0.3s 本轮未截到像素——与第 113 轮已截图的不变基线一致）；zip 4 张。
- 控制台 error / ≥400 响应 0 条。

---

# 第 113 轮：线上轻量抽查 PR #133（逐张 PNG 导出进度文案「张」口径，643f7bb；#132 纯文档不测）

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn。改动：`app/src/components/studio/PreviewArea.vue:630-636`——PNG 导出 `onProgress` 文案 `perLabel ? "已完成 ${done}/${total} 页，正在生成 ${pngTotalLabels} 张标签图片..." : "已完成 ${done}/${total} 页，正在生成图片..."`。测法：9222 真实 UI，40 行名单（签到桌牌版 4 页/40 张），逐张与整页两种模式各带水印导出，导出期间 50-300ms 采样浮层文本并截图。未录屏，未改任何产品代码。

**结论**: **目标达成——逐张模式浮层为「已完成 N/40 页，正在生成 40 张标签图片...」（截图 + DOM 双证据），整页模式仍为「已完成 4/4 页，正在生成图片...」不含「张标签」，两种模式均导出成功（40 张/4 张 zip），控制台零报错。无新增 P 级问题。**

## 部署核验
- `/studio` index 切到 **`index-DLQ9wyQ1.js`**，`StudioView-NO0Ff-OU.js` 内含指纹「张标签图片」×1（index chunk 0，符合组件在 StudioView chunk）。

## 逐张模式（核心）
- 浮层截图：`r113_label_progress.png`（放大 `_zoom`）清晰显示「**已完成 3/40 页，正在生成 40 张标签图片...**」+ 取消导出按钮。
- 全程采样 11 条唯一文案，「已完成 …」条目全部含「40 张标签图片」；zip 落盘 40 张 PNG（951874B）。
- 观察项（既有，非本 PR）：逐张模式「已完成 N/40 **页**」的单位仍是"页"字但计数是张（第 109 轮已记录的用词瑕疵，本 PR 仅在后半句补「张」口径）。

## 整页模式（Regression）
- 首跑脚本用 `s.value=` 设自定义下拉无效（SelectField 是 button+options 组件），改真实点击「按整页导出」后生效——如实记录。
- 全程 6 条唯一文案均不含「张标签」，最终相为「已完成 4/4 页，正在生成图片...」（截图 `r113_page_render.png`，最终相仅存续约 0.3s，需 50ms 采样才截到）；zip 落盘 4 张整页 PNG（812504B）。

## 断言汇总
| 断言 | 结果 |
|---|---|
| 部署：StudioView-NO0Ff-OU.js 含「张标签图片」指纹 | PASS |
| 逐张模式浮层含「40 张标签图片」（截图）且导出 40 张 zip | PASS |
| 整页模式浮层不含「张标签」、终相「正在生成图片...」（截图）且导出 4 张 zip | PASS |
| 控制台 error / ≥400 响应 0 条 | PASS |

既有开放项不变：P3-2 生僻字豆腐块；生产 `x-seatmark-storage: memory` + SES 未配置。

---

# 第 112 轮：线上回归 PR #131（router.isReady 后再挂载，squash 4b7452b）

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn。改动：`app/src/main.ts:29-35`——挂载改为 `router.isReady().then(() => app.mount('#app'))`，等首个路由异步组件就绪后再挂载，预渲染 HTML 在此之前持续可见。目标：修第 109 轮 P3-1（Slow 3G 首访 t≈6.9s 挂载清空预渲染 DOM → HomeView chunk 到达前 `main.innerText=0` 约 2.4–2.9s）。测法：复用第 109 轮 Slow 3G 方法（全新 profile + `Network.emulateNetworkConditions` RTT 2000ms/50KB/s + `setCacheDisabled`），共 3 次独立干净首访；快网 UI 冒烟 + 刷新一次。未录屏，未改任何产品代码。

**结论**: **第 109 轮 P3-1 闭环——三次独立 Slow 3G 干净首访中，预渲染内容出现后 `main.innerText` 全程不再归零，t≈6.9s 正文空白窗口不复现；快网首访 //templates/studio、刷新一次（SW 接管态）均正常，控制台零报错。无新增 P 级问题。**

## 部署核验
- 开测时 `/studio` 仍引用旧 `index-3wbB2Bcl.js`；轮询约 1 分钟后切换为 **`index-C2rhFdFr.js`**，chunk 内含 `isReady().then` 挂载指纹 ×1（旧版无）。

## Slow 3G 首访（核心，3 次干净 profile）
- Run A（每 ~0.8s CDP 采样）：t=8.9s 起 mainLen=2821 稳定至 30s，**无归零**；t≈17s mainH 3739→3871（挂载完成，正文无缝切换）。
- Run B：t=5.7s 起 mainLen=2821 稳定，**无归零**；t≈9.7s 挂载切换同样无缝。
- Run C（页内 200ms 密集采样，无 CDP 往返缝隙）：149 个样本，首个 mainLen>100 出现于 201ms 后，**zero-after-content 样本 0 个**，终值 2821。
- 方法敏感性：同方法在 #131 前（第 109 轮）两次独立复现 2.4–2.9s 的 mainLen=0 窗口，修复无效必然再现。
- 最终页面完整（hero + 24 枚预览）：`r112_slow3g_A_final.png`、`_B_final.png`、`_C_final.png`。
- 观察项：Run A/B 脚本在 t≈2.1s 存了一张 "blank" 图（`mainLen=-1`，document 尚未就绪的加载初期），属预渲染出现**之前**的正常空载状态，非回归窗口。

## 快网无回归 + SW 刷新（Regression）
- 新 profile 正常网速：`/` hero 6.1s 渲染（`r112_fast_home.png`）→ 点导航「模板」出 222 款网格（`r112_fast_templates.png`）→ `/studio` 三步卡「选择模板/导入数据」渲染（`r112_fast_studio.png`）。
- 回 `/` 后刷新一次（此时 `serviceWorker.controller=true`，SW NetworkFirst 接管态）：页面正常（`r112_fast_home_reload.png`）。
- 控制台 error 级日志与 ≥400 响应 **0** 条（排除既有 third-party cookie 警告）。

## 断言汇总
| 断言 | 结果 |
|---|---|
| 部署：新 index-C2rhFdFr.js 含 isReady 挂载指纹 | PASS |
| Slow 3G ×3：内容出现后 mainLen 不归零（P3-1 不复现） | PASS |
| 快网 / + templates + studio 挂载可交互 | PASS |
| 刷新一次（SW 接管）页面正常 | PASS |
| 控制台/网络零报错 | PASS |

既有开放项不变：P3-2 生僻字豆腐块；生产 `x-seatmark-storage: memory` + SES 未配置。

---

# 第 111 轮：线上回归 PR #130（截断字段解除 overflow/line-clamp 裁切，squash c1cd118）

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn。改动：`app/src/utils/pdfExport.ts:195-200`——`truncateClampedText` 截断完成后对该字段 `-webkit-line-clamp/line-clamp: unset` + `overflow: visible`，未截断字段样式零改动。测法：沿用第 110 轮方法（9222 真实 UI + CDP 脚本），4 行小名单（长姓名/emoji/长单元格/正常各 1）快跑 PNG ZIP 与图片版 PDF，产物字形级放大与 r110 基线对比。未录屏，未改任何产品代码。

**结论**: **第 110 轮 P3-1 闭环——被截断字段导出字形顶部不再平切改字：「王/单/元/宇/文/慕」等字在 PNG 与 PDF 中顶部笔画完整；单行「前缀+…」截断行为无回归、无第二行残影/串字、emoji 与正常长度零回归。无新增 P 级问题。**

## 部署核验
开测时线上 `/studio` 仍引用旧 `StudioView-BjSYfsw-.js`（无指纹），轮询 1 分钟后切换为 `index-3wbB2Bcl.js` → `StudioView-CGHV4cLr.js`，chunk 内含完整指纹：``join("")}…`,n.style.setProperty("-webkit-line-clamp","unset"),n.style.setProperty("line-clamp","unset"),n.style.overflow="visible"`` ×1。

## 断言结果
- 字形保真（PNG zip 第 001/003 张放大）：「欧」顶部完整、「宇」宝盖头在（非于）、「文」点+横在（非又）、「慕」艹完整；「王」三横（非土）、「单」倒八点（非早）、「元」两横（非兀）——与 r110 基线（平切改字）逐字对比全部恢复 — passed（对比图 r111_compare_longname/longcell.png）
- 字形保真（PDF）：`pdftoppm` 第 1 页 120dpi，标签 01/03 同样字形完整 — passed
- 截断行为无回归：两产物长姓名/长单元格仍为单行「前缀+…」（12 字+…，与预览一致、与 r110 前缀相同），无两行叠压 — passed
- 无副作用：截断字段下方无第二行文字残影，未与座位号椭圆/页脚串字（整张标签目测干净）；emoji「张伟😀🎉🀄」完整未劈开；正常「考生004」完整 — passed
- 产物完好：zip 4 张 PNG（1063×638）、PDF `pdfinfo` Pages=1 A4 — passed
- 控制台回归：两次导出运行 error 级日志与 ≥400 响应 0 条 — passed

产物：`/home/ubuntu/r111_dl/`（zip+pdf）、`/home/ubuntu/screenshots/r111_*.png`（含 r111_compare_longname/longcell.png 修复前后上下对比、r111_zoom_*.png 字形放大、r111_pdf_page1_top.png 四种行同页对照）。

---

# 第 110 轮：线上回归 PR #129（超长文本导出物理截断 truncateClampedText，squash d56bbf6）

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn。改动：`app/src/utils/pdfExport.ts` 新增 `truncateClampedText(root)`（对溢出的 `.label-field__body` 按码点二分把 `.label-field__content` 截为「可见前缀+…」），`createPageRenderer` 在 `waitForElementReady` 后调用，PNG（整页/逐张）与 PDF 共用。测法：沿用第 109 轮素材（`r109_big320.xlsx`）与 CDP 脚本（9222 真实 UI），导出 PNG ZIP 与图片版 PDF，产物与第 109 轮基线逐图对比 + 像素量化。未录屏，未改任何产品代码。

**结论**: **P2-1 主体闭环——超长姓名/超长单元格在 PNG 与 PDF 中不再两行叠压，均为单行「前缀+…」，与预览省略号形态一致；emoji 与正常长度零回归。残留 1 个新 P3：被截断标签的单行文本在导出产物中字形顶部被裁 1-2px，导致部分字被"改字"（王→土、单→早、元→兀、宇→于、文→又），预览无此现象。**

## 部署核验
线上 `/studio` HTML 引用 `assets/index-BUOYPklq.js`（旧版为 index-DQ-Z9IXg.js）→ `StudioView-BjSYfsw-.js` 含二分截断指纹 ``Math.ceil((r+p)/2);s.textContent=`${a.slice(0,f).join("")}…` `` ×1，与本地 d56bbf6 构建产物同名同内容。

## 断言结果
- PNG ZIP 逐张导出（320 张 32.0s，zip 7.9MB 解包恰 320 张）：第 001 张（24 字姓名）与第 004 张（500 字单元格）**单行「前缀+…」，无第二行、无叠压**，与 r109 基线（两行叠字）目测显著不同；量化：同区域暗像素 28164→22753 / 27642→22516（叠压密度消失）— passed
- 图片版 PDF（32 页 30.8s 4.14MB，`pdfinfo` Pages=32 A4）：第 1 页标签 01/04 同样单行省略号 — passed
- 逐张 PNG 路径与 PDF 共用链路（两者产物形态一致）— passed
- emoji 无回归：第 002 张「张伟😀🎉🀄」完整渲染、未被截断、emoji 未劈开 — passed
- 正常长度无误截断：第 005 张「考生005」完整；PDF 第 1 页 05-10 全部完整 — passed
- 生僻字 𠀀𪚥 维持豆腐块（P3-2 字体限制，非本 PR 范围）— passed（记录用）
- 所见即所得：预览与导出的省略号前缀内容一致（均为 12 字+…）— passed
- **导出字形顶部裁切 — failed（新 P3-1）**：被截断标签的单行大字在 PNG 与 PDF 中顶部被裁约 1-2px，字形被"改字"：王→土、单→早、元→兀、宇→于、文→又、慕 顶部平切；**预览中同一标签字形完整**（见 r110_pdf_done.png vs r110_zoom_longname/longcell.png）。仅影响触发截断的超长字段，正常/emoji 标签不受影响。疑因物理截断后单行大字号的 ascent 超出 line-height(1.15) 的内容盒，html2canvas 按盒裁切而浏览器绘制允许溢出。
- 控制台回归：error 级日志与 ≥400 响应 0 条（两次导出运行均零报错，第 109 轮的 ERR_CONNECTION_RESET 未再出现）— passed

产物：`/home/ubuntu/r110_dl/`（zip+pdf）、`/home/ubuntu/screenshots/r110_*.png`（含 r110_compare_longname/longcell.png 修复前后并排、r110_zoom_*.png 字形放大、r110_pdf_page1_top.png、r110_pdf_done.png 预览对照）。

---

# 第 109 轮：线上探索性走查（无代码变更，main 2e3c353，压力/弱网/边界输入）

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn。无新代码变更。测法：CDP 真实 UI（9222，1280×900）导入 320/640 行大名单跑全量图片版 PDF 与逐张 PNG ZIP 导出（进度/取消/心跳/内存采样）；全新 profile + CDP Slow 3G（RTT 2000ms / 50KB/s，Chrome DevTools 口径）首访 `/` 与 `/templates`；边界输入（24 字超长姓名、emoji、生僻字 𠀀𪚥、500+ 字单元格）核验预览与 PNG/PDF 产物像素。未录屏，未改任何产品代码。

**结论**: 压力/规模与取消行为全部通过（640 行 64 页 PDF 67.6s、320 张 PNG ZIP 32.8s，进度文案逐页更新、取消即时生效且不产出文件）。**新增 2 个发现：P2-1 超长文本预览省略号截断但导出 PNG/PDF 渲染为两行重叠压字（所见非所得、产物不可读）；P3-1 弱网首访预渲染内容显示后出现约 2.4–2.9s 正文全空白窗口（hydration 等待懒加载 HomeView chunk 期间无任何加载反馈）**。

## 发现

### P2-1 超长文本：预览截断 vs 导出重叠压字（所见非所得）
- 预览（Studio 画布）：24 字姓名与 500 字单元格均显示为**单行 + 省略号截断**（`欧阳纳兰性德慕容长孙宇文…`），排版正常。截图 `r109_import320.png`。
- 导出 PNG（zip 第 001/004 张）与图片版 PDF 第 1 页：同一标签渲染为**两行且两行相互重叠**，字形叠压完全不可读。截图 `r109_png_longname.png`、`r109_png_longcell.png`、`r109_pdf_page1.png`。
- 影响：含超长姓名/单元格的行，打印产物损坏且用户在预览中无法预知。正常长度（含 emoji 4 字）不受影响。

### P3-1 弱网首访：hydration 期间正文空白约 2.4–2.9s，无加载反馈
- 全新 profile + Slow 3G：t≈2.5s 预渲染 HTML 完整可见（hero + 24 枚排版图）→ **t≈6.9s 正文被清空（main.innerText=0，仅剩页头）→ t≈9.8s 恢复**。两次独立复现（2.4s / 2.9s 窗口）。截图 `r109_slow3g_prerender/blankwindow/recovered.png`、时间线见 r109_slow4.py 输出。
- 机理：首页路由懒加载（`router/index.ts:12` `component: () => import('@/views/HomeView.vue')`），app.mount 替换预渲染 DOM 后需等 HomeView chunk 在弱网下载完，期间 router-view 为空且无骨架/spinner。
- SW 安装不阻塞首访：首访渲染期间 `controller=false`，`/templates` 二跳后才被接管 — 符合预期。

### P3-2（信息性）生僻字 𠀀𪚥 显示为豆腐块
预览与 PNG/PDF 产物一致显示为空白方框（字体缺字，𡃁 可正常渲染），emoji 😀🎉🀄 彩色正常。属字体覆盖限制，预览与产物一致（无所见非所得问题）。

### 观察（不分级）
- PNG 逐张导出进度文案为「已完成 N/320 **页**」，实际单位是"张/标签"，用词轻微不准。
- 9222 老 profile 两次导出运行各出现 1 条 `Failed to load resource: net::ERR_CONNECTION_RESET`（Log API 未含 URL，疑似第三方统计脚本瞬断），不影响导出产物。
- 导出后 JS 堆：320 行导入 21→27MB；32 页 PDF 后 219MB；64 页 PDF 后 289MB；取消后 165MB（未回收部分随 GC 波动，未见持续增长/崩溃）。

## 断言结果（摘要）
- 320 行导入：「共 320 条数据 / 320 个标签 / 32 页」8.1s — passed
- 640 行导入 64 页；图片版 PDF 全量导出 67.6s，落盘 8.3MB，`pdfinfo` Pages=64 A4 — passed
- 320 行图片版 PDF 44.7s，Pages=32；预估体积 4.2MB vs 实际 4.14MB — passed
- 进度反馈：`正在渲染第 N/64 页...` 逐页更新 + `已完成 64/64 页，正在写入 PDF...`，遮罩含「取消导出」按钮 — passed
- 导出期间 UI 心跳：Runtime.evaluate 最大 1.0s / 平均 0.26s（PDF）、0.25s/0.08s（PNG），无卡死 — passed
- PNG ZIP 逐张：320 张 32.8s，zip 7.9MB 解包恰 320 张 PNG（1063×638），抽验 4 张非空白 — passed
- 取消行为：进度中点「取消导出」→ toast「已取消导出」、遮罩消失、**零文件落盘**、随后可重新打开导出弹窗 — passed
- 弱网 Slow 3G 首访 `/`：FCP≈5.0s、预渲染内容 2.5s 可见、最终完整渲染，无持久白屏/错误页 — passed（但见 P3-1 中途空白）
- 弱网首访 `/templates` 二跳：6.2s 出「222 款」网格 — passed
- SW 不阻塞首访 — passed
- 边界输入预览：省略号截断、emoji/𡃁 正常、𠀀𪚥 豆腐块 — passed（P3-2 记录）
- 边界输入导出产物 — **failed**（P2-1：两行重叠压字，与预览不一致）
- 控制台回归：除 2 条 ERR_CONNECTION_RESET（第三方资源瞬断，观察项）外，error 级日志与 ≥400 响应 0 条 — passed

产物：`/home/ubuntu/screenshots/r109_*.png`、`/home/ubuntu/r109_dl/`（PDF×2、zip×1）、`/home/ubuntu/r109_big320.xlsx`、`r109_big640.xlsx`、脚本 `/home/ubuntu/r109_{stress,pdf,slow3,slow4,slow5}.py`。

---

# 第 108 轮：线上回归 PR #128（/api/* Edge Function 统一补安全头，squash 2e3c353）

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn。改动：新增 `edge-functions/api/_security.js` 的 `withSecurityHeaders`（HSTS/nosniff/XFO/CSP frame-ancestors 'self'/Referrer-Policy 5 头），`[[default]].js`（含 500 兜底）、`feedback.js`、`ai-design.js` 的 onRequest 统一包裹。业务逻辑零改动。测法：curl 端点头矩阵 + 第 103 轮畸形输入抽测 + CDP 真实 UI 前端冒烟（9222）。未录屏，未改任何产品代码。

**结论**: **第 103/104 轮遗留的「/api/* 不带安全头」项闭环——全部受测 API 响应（200/400/405/204、含 Set-Cookie 的 logout、畸形输入 4xx）均带 5 头且值全等，业务头零丢失，前端功能不受影响。** 无新增 P 级问题。

## 0. 部署核验
Edge Function 变更与 sw.js/bundle 无关；开测时（00:24 UTC）`/api/quota` 已带全部 5 头，视为已部署。

## 1. 端点头矩阵（curl，原始输出 `/home/ubuntu/r108_headers.txt`）— 全部 PASS
期望 5 头精确值均命中：`strict-transport-security: max-age=31536000; includeSubDomains`、`x-content-type-options: nosniff`、`x-frame-options: SAMEORIGIN`、`content-security-policy: frame-ancestors 'self'`、`referrer-policy: strict-origin-when-cross-origin`。

| 请求 | 状态 | 5 头 | 业务头 |
|---|---|---|---|
| GET /api/quota | 200 `{"anonymous":true,"limit":1,…}` | ✅ 全 | `cache-control: no-store` + `x-seatmark-storage: memory` 仍在 ✅ |
| GET /api/auth/me | 200 `{"user":null}` | ✅ | 同上 ✅ |
| POST /api/feedback 空 body | 400 `请求体格式错误` | ✅ | content-type json ✅ |
| POST /api/ai-design 空 body | 400 `请求体格式错误` | ✅ | ✅ |
| GET /api/feedback（错误方法） | 405 `请求方法不支持` | ✅ | ✅ |
| GET /api/ai-design（错误方法） | 405 | ✅ | ✅ |
| POST /api/auth/logout | 200 `{ok:true}` | ✅ | **`set-cookie: sm_session=; …HttpOnly; Secure; SameSite=Lax; Max-Age=0` 与 5 头共存** ✅（withSecurityHeaders 未吞 Set-Cookie） |
| OPTIONS /api/feedback | 204 | ✅ | 无 body ✅ |

## 2. 第 103 轮畸形输入抽测 — 全部 PASS
| 输入 | 结果 | 头 |
|---|---|---|
| POST /api/auth/verify `{"email":123,"code":{"a":1}}` | 400 `邮箱或验证码格式不正确` | 5 头全 ✅ |
| GET `/api/share/tpl?code=' OR 1=1--` | 400 `短码无效` | ✅ |
| POST /api/ai-design `{"messages":[{"role":"admin",…}]}` | 400 `消息内容无效` | ✅ |
| POST /api/feedback 2MB content | 400 `请填写反馈内容（不超过 2000 字）` | ✅ |

零 500/545、body 均为结构化中文错误 JSON、无栈/密钥泄漏——与第 103 轮口径一致且现在全部带头。

## 3. 前端功能不受影响（CDP 真实 UI，9222）— PASS
- `/studio?template=signage` 正常渲染；导入 `/home/ubuntu/r96_singlecol.xlsx` →「共 2 条数据 / 2 个标签 / 张伟·王芳」。
- 点「图片 PNG」→ 导出弹窗**截图可见**「无水印导出（今日剩余 1 次）」+「带水印导出（不限次数）」——/api/quota 消费正常（配额角标「今日剩余 1 次」同时出现在工具栏）。
- error 级日志与 ≥400 响应 **0** 条（排除既有 third-party cookie 警告）。
- 注：本轮 CDP 会话未捕获到 /api/quota 的 responseReceived 事件（请求发生在监听窗口前/由 SW 应答），响应头证据以 curl（测项 1）为准。

## 限制（如实记录）
- 500 兜底路径（`[[default]].js` catch 分支）无法在线上安全触发，未直接验证其带头；代码上与正常路径同一包裹（`withSecurityHeaders(json(...,500))`）。
- 未登录态限制不变：生产 `x-seatmark-storage: memory`、SES 未配置，认证态/管理端 200 路径持续无法覆盖（含 Set-Cookie 的登录成功路径以 logout 的清 cookie 响应替代验证）。
- `Permissions-Policy` 不在本 PR 的 5 头之列（edgeone.json 静态路由才有），API 响应不带——符合 PR 范围，非缺陷。

**产物**：`/home/ubuntu/r108_headers.txt`；截图 `/home/ubuntu/screenshots/r108_import_ok.png`、`r108_export_dialog.png`；脚本 `/home/ubuntu/r108_ui2.py`；计划 `/home/ubuntu/repos/SeatMark/test-plan-round108.md`。录屏：无（按约定）。

---

# 第 107 轮：线上回归 PR #127（precache 禁用 directoryIndex，修第 106 轮 P3-1，squash 8905797）

**日期**: 2026-08-10　**环境**: 生产 www.seatmark.cn。改动仅 `app/vite.config.ts` workbox 段新增 `directoryIndex: ''`；其余 #126 行为（`skipWaiting`/`clientsClaim`/`globPatterns` 含 html/`precacheFallback: {fallbackURL:'/index.html'}`）保留。测法：curl 轮询 sw.js 判部署 → 全新 profile（`/tmp/r107prof`）装 SW 后在线依次导航 `/studio` → `/` → `/templates` 核验 `pages` 缓存 → 同 user-data-dir 加 `--host-resolver-rules="MAP www.seatmark.cn 127.0.0.1"` 浏览器级黑洞断网测壳页兜底 → 老 profile（`/tmp/r98profile`，9222，装 #126 版 SW）只顶层刷新一次测接管 → 安全头与跨域 iframe 回归 → 三页渲染 + 一次 PNG 导出。未录屏，未改任何产品代码。

**结论**: **第 106 轮 P3-1 已闭环——根路径 `/` 的导航现在走 NetworkFirst 并写入 `pages` 缓存（第 106 轮 `/` 从不进 `pages`），且离线壳页兜底、SW 即时接管、安全头三项均无劣化。** 无新增 P 级问题。仅有一条 **SW 语义澄清**（非缺陷）：触发更新的那一次导航仍由旧 SW 应答，新 SW 在其后接管，因此老 profile 里 `/` 的缓存回写出现在**下一次**导航（详见测项 3）。

## 0. 部署核验
| 项 | #126 版 | #127 版（线上，00:05:56 UTC 生效） |
|---|---|---|
| `sw.js` 字节 | 4153 | **4170** |
| `directoryIndex:""` | 0 | **1** |
| `clientsClaim` / `NetworkFirst` | 1 / 1 | 1 / 1 |
| `NavigationRoute` | 0 | **0**（未回归） |
| precache 条目 | 52（含 1 条 index.html） | 52（含 1 条 index.html，**指纹与 #126 相同**） |

⚠️ 因 precache 指纹与 #126 完全一致，本轮**不能**用条目数判断哪个 SW 在控制，改用**行为指纹**（`pages` 是否含 `/`、`/` 条目 Response `date` 是否刷新）。

## 1. 核心：根路径导航改走 NetworkFirst — PASS（第 106 轮此项 fail）
全新 profile `/tmp/r107prof`：访问一次 `/` 后 `controller=true`、`active: activated`、precache 52 项含 `index.html`。随后**依次**在线导航：

| 步骤 | `pages` 缓存内容 |
|---|---|
| 导航 `/studio` 后 | `[/studio]` |
| 导航 `/` 后 | `[/studio, `**`/`**`]` ← 本轮新增 |
| 导航 `/templates` 后 | `[/studio, /, /templates]` |

第 106 轮同一序列为 `[/studio]` → `[/studio]` → `[/studio, /templates]`（`/` 从不进 pages）。各条目 Response 头与时间戳：
```
/studio     date Mon, 10 Aug 2026 00:08:53 GMT  xfo=SAMEORIGIN csp=frame-ancestors 'self' hsts=true
/           date Mon, 10 Aug 2026 00:09:04 GMT  xfo=SAMEORIGIN csp=frame-ancestors 'self' hsts=true
/templates  date Mon, 10 Aug 2026 00:09:14 GMT  xfo=SAMEORIGIN csp=frame-ancestors 'self' hsts=true
```
`/` 条目 `date` 为本轮时刻（00:09:04），证明是网络取回后回写，而非旧副本。

## 2. 离线兜底不劣化 — PASS
保持同一 user-data-dir（`pages` = `/`、`/studio`、`/templates`；`/guides`、`/pricing` 从未访问），重启浏览器加 host-resolver 黑洞：

| 断网导航 | innerText | 耗时 | 浏览器错误页 | 截图可见内容 |
|---|---|---|---|---|
| `/`（已缓存） | 3221 | 0.5s | 否 | hero「上传 Excel，批量生成」+ A4 24 枚预览 ✅ |
| `/guides`（从未访问） | 10479 | 0.5s | 否 | 「教程中心」「共 76 篇教程」+ 教程卡片 ✅ |
| `/pricing`（从未访问） | 1521 | 0.5s | 否 | 「定价方案」「定价常见问题」✅ |

断网真实性对照：in-page `fetch('https://www.seatmark.cn/api/quota')` 与 `fetch('/robots.txt?ts=…')` 均 `FAILED: Failed to fetch`；整个断网过程 `pages` 条目数保持 3 条**零新增**。→ `precacheFallback` 壳页兜底在 `directoryIndex: ''` 之后仍生效。

## 3. 老 profile 一次刷新接管 — PASS（附 SW 语义澄清）
老 profile（9222，装 #126 版 SW）开测前：`active: activated, waiting: false`，`pages` 4 条，`/` 条目 `date = Sun, 09 Aug 2026 23:42:35 GMT`。**标签页不关、只顶层刷新一次**：
- `t=4s`：`active: activating`（新 worker 正在激活）、`waiting: false`；`t=8~20s`：`active: activated, waiting: false, controller=true`。→ 全程无 waiting worker，接管行为无回归。
- 但该次刷新后 `/` 条目 `date` **仍为 23:42:35**：这是 SW 标准语义——**触发更新的那一次导航仍由旧（#126）SW 应答**（旧 SW 用 precache 抢答 `/`），新 SW 在其后才接管。
- 因此补做一次顶层导航 `/`：`date` 由 `23:42:35` **刷新为 `Mon, 10 Aug 2026 00:12:16 GMT`**（当时刻 00:12:26），且仍带 `xfo=SAMEORIGIN` / `csp=frame-ancestors 'self'` / HSTS。→ 老 profile 中 `/` 也确实改走 NetworkFirst。

## 4. 安全头与点击劫持回归 — PASS
- `pages` 中 **`/` 条目**在两 profile 均带 `x-frame-options: SAMEORIGIN` + `content-security-policy: frame-ancestors 'self'` + HSTS（干净 profile 00:09:04 副本、老 profile 00:12:16 副本）；`/studio`、`/templates` 条目同样带头。
- 跨域 iframe（老 profile）：
  - `frame3.html` 嵌**根路径** `/`：iframe 空白错误页（截图），控制台 `Refused to frame … "frame-ancestors 'self'"`，响应带 XFO+CSP。
  - `frame2.html` 嵌 `/studio`：iframe 空白错误页，同样报 `Refused to frame …`，响应 `age: 0 / Cache Miss` 带 XFO+CSP。
- 反向对照：顶层直接打开 `/studio` 正常渲染（含「选择模板」，innerText 1465）。

## 5. Regression 快速冒烟 — PASS
- `/` hero+CTA、`/templates`「222 款」网格缩略图、`/studio?template=signage` 三步卡+模板列表+预览区，无白屏。
- Excel 导入 `/home/ubuntu/r96_singlecol.xlsx`：「共 2 条数据」「2 个标签」「张伟」「王芳」。
- PNG 导出：实际落盘 `/home/ubuntu/r107_dl/签到桌牌版-20260810-0013.zip`(33 955 B) → 2 张 PNG(17 868 / 15 581 B)，001 像素核验为「张伟」桌牌、非空白率 6.33%、含 seatmark.cn 水印。
- 控制台/网络：error 级日志与 ≥400 响应 **0** 条（排除既有 third-party cookie 警告）。

## 限制（如实记录）
- headless Chromium 121 的 page session 不投递**主文档** `Network.responseReceived`，因此在线响应头证据取自「SW 实际会用来应答的缓存副本响应头（`caches.match` → `Response.headers`）」+「跨域 iframe 导航响应」，非顶层文档事件直接抓取（沿用第 106 轮口径）。
- 线上 precache 实测 52 条（第 106 轮同）；用户所述构建产物计数未在线上复现，本轮同样以线上为准。
- 既有开放项不变：生产 `x-seatmark-storage: memory`（限频失效、短码分享失效、**无法登录**）、SES 未配置（`/api/auth/code` 502）、`/api/*` 不带安全头、`/assets/*` 头合并；认证态与管理端 200 路径持续无法覆盖。

**产物**：截图 `/home/ubuntu/screenshots/r107_*.png`；导出 zip `/home/ubuntu/r107_dl/签到桌牌版-20260810-0013.zip`；脚本 `/home/ubuntu/r107_core.py`、`/home/ubuntu/r107_old.py`、`/tmp/r107_old2.py`、`/home/ubuntu/r107_smoke.py`；计划 `/home/ubuntu/repos/SeatMark/test-plan-round107.md`。录屏：无（按约定）。

---

# 第 106 轮：线上回归 PR #126（SW 立即接管 + 离线壳页兜底，squash fca464d）

**日期**: 2026-08-09　**环境**: 生产 www.seatmark.cn。改动仅 `app/vite.config.ts` workbox 段（`skipWaiting: true` + `clientsClaim: true`、`globPatterns` 放回 `html`、navigate 的 NetworkFirst 加 `precacheFallback: { fallbackURL: '/index.html' }`），app bundle 仍 `index-DQ-Z9IXg.js`（预期），判部署以 **`sw.js` 内容变化**为准。测法：curl 轮询 sw.js → 老 profile（`/tmp/r98profile`，装的是 #125 版 SW）**只顶层刷新一次、标签页不关** → 攻击者页面复测 → 全新干净 profile（`/tmp/r106prof`）只访问一次首页装 SW → **浏览器级 host-resolver 黑洞断网**测壳页兜底 → 两 profile 在线安全头回归 → CDP 1280×900 真实 UI 功能冒烟。未录屏，未改任何产品代码。

**结论**: **第 105 轮 P3-1（新 SW 不即时接管）已闭环——一次顶层刷新、标签页全程开着，新 SW 即接管并拒绝攻击者 iframe；离线壳页兜底也已生效——从未访问过的 `/guides`、`/pricing` 断网下由壳页 + SPA 正常渲染（第 105 轮同类路由为 ERR_FAILED）。** 未发现安全头被反噬。新增 **1 条 P3（信息性）**：根路径 `/` 的导航被 workbox 预缓存路由（`directoryIndex: 'index.html'`）直接应答，**不经 NetworkFirst**，所以"仅改平台响应头"的部署对老访客在 `/` 上仍不会即时生效（`/studio`、`/templates` 等非根路由不受影响；跨域 iframe 导航不经 SW，故点击劫持面不受影响）。另记录一处与用户描述的差异：线上预缓存清单实测 **51 → 52 条**（用户称构建产物为 55→56）。

## 0. 部署核验
| 项 | #125 版 | #126 版（线上，23:40 UTC 生效） |
|---|---|---|
| `sw.js` 字节 | 4091–4094 | **4153** |
| `clientsClaim` | 0 | **1** |
| `precacheFallback` / `fallbackURL` | 0 | **1** |
| `index.html`（预缓存清单） | 0 | **1** |
| `NetworkFirst` | 1 | 1 |
| `NavigationRoute` | 0 | **0**（未回归） |

## 1. 老 profile 一次刷新即接管 + 点击劫持 — PASS（第 105 轮此项 fail）
老 profile `/tmp/r98profile`（9222）开测前基线（#125 版 SW）：`active: activated, waiting: false`，precache **51 条、`index.html` 计数 0**，`pages` 3 条。
**标签页不关、只顶层刷新一次** `https://www.seatmark.cn/`，此后逐时刻采样：

```
t=3s  active=activated waiting=false  precache n=51 html=0
t=6s  active=activating waiting=false precache n=52 html=1   ← 新 SW 直接 activating，未进 waiting
t=9s  active=activated  waiting=false precache n=52 html=1
t=12s active=activated  waiting=false precache n=52 html=1   controller=true
```
判据说明：`controller` 非空不足以区分新旧 SW，**precache 由 51→52 且重新出现 `index.html`** 才证明是 #126 版 SW 在控制。第 105 轮同一操作三次刷新后仍 `waiting: true`、precache 停在 52 项旧清单且 iframe 可渲染；本轮**一次刷新、6 秒内**完成接管，`waiting` 全程为 false。
攻击者页面 `http://localhost:8099/frame2.html`（iframe 嵌 `/studio`）：iframe 区域**空白错误页**（`r106_clickjacking_oldprofile.png`），控制台 `error | Refused to frame 'https://www.seatmark.cn/' because an ancestor violates … "frame-ancestors 'self'"`，该导航响应 `fromServiceWorker: true, fromDiskCache: false, age: 0, eo-cache-status: Cache Miss`，且**带** `x-frame-options: SAMEORIGIN` + `content-security-policy: frame-ancestors 'self'`。

## 2. 离线壳页兜底 — PASS
干净 profile `/tmp/r106prof`：只访问首页一次 → SW `activated`、`controller=true`、precache 52 条含 `index.html`；随后在线只访问过 `/studio`、`/templates`（`pages` 2 条），**`/guides`、`/pricing` 从未访问**。同一 user-data-dir 重启浏览器并加 `--host-resolver-rules="MAP www.seatmark.cn 127.0.0.1"`（page 与 SW 一并断网）。

| 断网导航 | innerText 长度 | 耗时 | 浏览器错误页 | 路由专属文案 |
|---|---|---|---|---|
| `/guides`（从未访问，真实路由） | 10479 | 0.6s | 否 | 「教程中心」「共 76 篇教程」可见 ✅ |
| `/pricing`（从未访问，真实路由） | 1521 | 0.5s | 否 | 「定价方案」「定价常见问题」「¥29」可见 ✅ |
| `/`（已缓存） | 3221 | 0.5s | 否 | hero「上传 Excel，批量生成」+ A4 预览可见 ✅ |
| `/tutorials`（**非** router 路由） | 615 | 0.5s | 否 | 应用自己的「404 NOT FOUND 页面不存在或已被移动」页 ✅ |

反向对照（证明断网真实生效、排除第 105 轮那种假通过）：断网态页面内 `fetch('https://www.seatmark.cn/api/quota')` 与 `fetch('/robots.txt?ts=…')` 均 `failed: Failed to fetch (www.seatmark.cn)`；`pages` 缓存在整个断网过程中**未新增**任何条目（仍为 `/studio`、`/templates` 2 条），说明这些路由确实是壳页回落而非偷偷联网。对比第 105 轮：同等断网条件下从未访问过的 `/tutorials` 出 Chrome `ERR_FAILED`。

## 3. 在线安全头未被壳页兜底反噬 — PASS（附 1 条 P3 机制注记）
- 老 profile 与干净 profile 在线顶层导航 `/studio` 均正常渲染（`r106_online_studio_9222.png` / `r106_online_studio_9229.png`）。
- 直接读取 SW 实际会用来应答导航的**缓存副本响应头**（`caches.match` 取 Response.headers），两 profile 全部条目均带安全头：

| profile | 缓存条目 | XFO | CSP | HSTS | date/age |
|---|---|---|---|---|---|
| 干净 | precache `index.html?__WB_REVISION__=64c4c6b1…` | SAMEORIGIN | frame-ancestors 'self' | ✅ | 23:43:54 / 75 |
| 干净 | pages `/studio` | SAMEORIGIN | frame-ancestors 'self' | ✅ | 23:51:53 |
| 干净 | pages `/templates` | SAMEORIGIN | frame-ancestors 'self' | ✅ | 23:48:00 / 0 |
| 老 | precache `index.html?…` | SAMEORIGIN | frame-ancestors 'self' | ✅ | 23:42:39 / 0 |
| 老 | pages `/`、`/studio`、`/studio?template=signage`、`/templates` | SAMEORIGIN | frame-ancestors 'self' | ✅ | 23:30–23:52 |

- 跨域 iframe 嵌**根路径** `https://www.seatmark.cn/`（新造攻击者页 `frame3.html`）也被拒：响应 `fromServiceWorker: false`（跨域 iframe 导航不受 SW 控制，直接走网络）、带 XFO+CSP，控制台 `Refused to frame …`（`r106_clickjacking_root_fresh.png`）。
- **P3-1（新，信息性）根路径导航绕过 NetworkFirst**：干净 profile 在线依次导航 `/studio` → `/` → `/templates`，`pages` 缓存变化为 `[/studio]` → `[/studio]` → `[/studio, /templates]`——**`/` 从未进入 `pages`**，说明 `/` 命中的是 workbox 预缓存路由（`precacheAndRoute` 默认 `directoryIndex: 'index.html'`，其注册顺序早于 runtimeCaching）。后果：与第 104 轮同类问题在**根路径上仍存在**——只改 `edgeone.json` 响应头（index.html 内容不变、precache revision 不翻转）时，老访客访问 `/` 仍会拿到旧壳页副本。当前实测无安全影响（现有 precache 副本是 #124 之后抓的，带全部安全头；且点击劫持走的跨域 iframe 导航不经 SW）。如需彻底闭环，可给 navigate 规则前置一条对 `/`（或整体导航）优先于 precacheRoute 的处理，或让每次发版 index.html 内容变化。

## 4. Regression 功能冒烟 — PASS
- `/` hero+CTA、`/templates`「222 款」网格缩略图、`/studio?template=signage` 三步卡+模板列表+预览区均正常（`r106_render_*.png`）。
- Excel 导入 `/home/ubuntu/r96_singlecol.xlsx`：「共 2 条数据」「2 个标签」，预览「张伟」「王芳」（`r106_import_ok.png`）。
- PNG 导出（「图片 PNG」→「带水印导出（不限次数）」）：实际落盘 `/home/ubuntu/r106_dl/签到桌牌版-20260809-2353.zip`(33 955 B) → 2 张 PNG(17 868 / 15 581 B)，001 像素核验为「张伟」桌牌、非空白率 6.33%、含 seatmark.cn 水印（`r106_export_png_001.png`）。
- 打印（stub `window.print` → 「打印 / 矢量 PDF」→ 导出方式卡片，`__printed=1` 时 `Page.printToPDF`）：`/home/ubuntu/r106_print.pdf` **1 页 A4 594.96×841.92 pt**，含两枚标签 + 裁切线 + 页脚，非全白（`r106_print_pdf-1.png`）。
- 控制台/网络：整轮 error 级日志与 ≥400 响应 **0 条**（排除既有 third-party cookie 警告）。

## 差异与限制（如实记录）
- 线上预缓存清单实测 **52 条**（含 1 条 `index.html`），非用户所述 56 条；新旧对比（51→52、html 0→1）足以判定新 SW 接管，但绝对条目数与用户核验的构建产物不一致，请以线上为准复核。
- 主文档（main frame Document）的 `Network.responseReceived` 在 headless Chromium 121 的 page session 中未被投递，因此在线 `/studio` 的**响应头证据取自 SW 缓存副本 + 跨域 iframe 导航响应**，而非顶层文档事件；两者均直接反映 SW 会用什么响应应答，但不是"顶层导航响应头"的直接抓取，属方法学限制。
- 既有开放项不变：生产 `x-seatmark-storage: memory`（限频失效、短码分享失效、**无法登录**）、SES 未配置（`/api/auth/code` 502）、`/api/*` 不带安全头、`/assets/*` 头合并。认证态与管理端 200 路径持续无法覆盖。

**产物**：截图 `/home/ubuntu/screenshots/r106_*.png`；导出 zip `/home/ubuntu/r106_dl/签到桌牌版-20260809-2353.zip`；打印 PDF `/home/ubuntu/r106_print.pdf`；脚本 `/home/ubuntu/r106_old.py`、`r106_shell.py`、`r106_iframe_root.py`、`r106_smoke.py`、`/tmp/r106_doc.py`、`/tmp/r106_hdr.py`；计划 `/home/ubuntu/repos/SeatMark/test-plan-round106.md`。录屏：无（按约定）。

---

# 第 105 轮：线上回归 PR #125（SW 导航改 NetworkFirst，squash 6365176）

**日期**: 2026-08-09　**环境**: 生产 www.seatmark.cn。改动仅 `app/vite.config.ts` 的 workbox 配置，app bundle 仍 `index-DQ-Z9IXg.js`（预期），判部署以 **`sw.js` 内容变化**为准。测法：curl 核验 sw.js → 第 104 轮那个「已装旧 SW 的老 profile」（user-data-dir `/tmp/r98profile`）复测点击劫持 → 全新干净 profile（`/tmp/r105prof`）核验缓存 → **浏览器级真实断网**做离线回归 → CDP 1280×900 真实 UI 功能冒烟。未录屏。未改任何产品代码。

**结论**: **本轮改动生效，第 104 轮 P3-1（SW 预缓存令老访客绕过安全头）已闭环，且离线可用性未被破坏**（已缓存路由断网仍出完整页面）。但发现 **1 条新 P3**：老访客的新 SW 会停在 `waiting` 状态，**只要站点还有标签页开着就不会接管**——需用户关掉站点全部标签页（或重启浏览器）后才生效，所以修复对老访客**不是即时**的。

## 0. 部署核验（curl）

| | 旧 sw.js（本轮开测前） | 新 sw.js（部署后） |
|---|---|---|
| 体积 | 4045 B | 4094 B |
| `index.html` 出现次数 | **2** | **0** |
| `NavigationRoute` | **1** | **0** |
| `NetworkFirst` / `networkTimeoutSeconds` / `"pages"` | 0 / 0 / 0 | **1 / 1 / 1** |

→ 部署已发生且与 diff 一致（precache 去掉 html、移除 NavigationRoute、navigate 走 NetworkFirst 到 `pages` 缓存）— PASS。

## 1. 老访客（已装旧 SW 的 profile）点击劫持复测 —— 本轮核心

老 profile 开测前状态（只读核验，未做任何清理）：`controller` 非空、precache **52 项含 `index.html?__WB_REVISION__=64c4c6b1493672cbb3f8db18411ddfa0`** —— 与第 104 轮 fail 现场一致。

**阶段 A：站点标签页保持开启，顶层刷新 3 次**
- 3 次刷新后 registration 均为 `active: activated, waiting: true`，**缓存仍是旧 precache（52 项、含 index.html），无 `pages` 缓存**。
- 此时攻击者页面 iframe 嵌 `/studio`：**仍完整渲染**，响应 `fromServiceWorker: true, fromDiskCache: true, age: 1083, eo-cache-status: Cache Hit`，**无 XFO/CSP** —— 与第 104 轮完全相同 → **此路径仍 FAIL（记 P3-1，见下）**。

**阶段 B：关闭站点全部标签页 / 重启浏览器（同一 user-data-dir，SW 与缓存均保留）**
- 再访问 `/`：`active: activated, waiting: false`，precache **51 项、`index.html` 计数 0**，并新增 **`pages` 运行时缓存**（含 `https://www.seatmark.cn/`）→ 新 SW 已接管、旧 index.html 预缓存条目已消失。
- 复测同一攻击者页面 `http://localhost:8099/frame2.html`（iframe src=`https://www.seatmark.cn/studio`）：
  - iframe 区域**空白错误页**（截图 `r105_clickjacking_oldprofile.png`）；
  - 控制台 error：`Refused to frame 'https://www.seatmark.cn/' because an ancestor violates the following Content Security Policy directive: "frame-ancestors 'self'".`；
  - 导航响应虽仍 `fromServiceWorker: true`，但 `fromDiskCache: false, age: 0, eo-cache-status: Cache Miss`，且**带有** `x-frame-options: SAMEORIGIN` + `content-security-policy: frame-ancestors 'self'` —— 正是 NetworkFirst 从网络取新响应的预期形态。
- → **第 104 轮 fail 项转为 PASS**（满足计划的"即使经 SW 也带安全头"判据）。

### P3-1（新）新 SW 对老访客不是即时接管：站点标签页未全关前一直停在 waiting
`app/vite.config.ts` 用 `registerType: 'autoUpdate'` 但 `injectRegister: false`，而 `app/src/main.ts:31-37` 只做了裸 `navigator.serviceWorker.register('/sw.js')`，**没有 virtual:pwa-register / 没有向 waiting worker 发 `SKIP_WAITING`、也没有 `clientsClaim` 立即接管**。实测后果：老访客只刷新页面（3 次）新 SW 永远 `waiting`，旧 SW 继续用旧预缓存 index.html 应答导航 → 安全头仍被绕过；必须关掉站点全部标签页/重启浏览器才生效。
建议（择一）：① 改用 `injectRegister: 'auto'` / `virtual:pwa-register` 的 autoUpdate 注册（其 registerSW 会 postMessage SKIP_WAITING 并 reload）；② 在自建注册代码里监听 `updatefound`，对 `reg.waiting` 发 `{type:'SKIP_WAITING'}`（sw.js 已内置该消息处理）并配合 `controllerchange` 刷新；③ workbox 加 `skipWaiting: true` + `clientsClaim: true`。
定级 P3：新访客与已重启过浏览器的老访客均已受保护，且本 PR 已把"永久绕过"降级为"下次全关标签页后自愈"。

## 2. 干净 profile 缓存核验

全新 profile 依次访问 `/` → `/templates` → `/studio` → `/`（首访时 SW 尚在安装，第 4 次导航起 `controller` 就位）：
- `caches.keys()` = `["workbox-precache-v2-https://www.seatmark.cn/", "pages"]` → **`pages` 运行时缓存存在** — PASS。
- precache 51 项，`index.html` 匹配数 **0**（旧 profile 旧 SW 时为 1）— PASS。
- `pages` 缓存条目随访问增长，最终为 `https://www.seatmark.cn/`、`/studio`、`/pricing` — PASS。

## 3. 离线可用性回归（本次主要风险点）

**方法学纠正（重要）**：`Network.emulateNetworkConditions {offline:true}` **只作用于 page target，Service Worker 的 fetch 仍走真实网络**。第一次尝试因此产生了假通过——断网态下**从未访问过**的 `/pricing` 竟返回完整新内容，且 `pages` 缓存随之新增 `/pricing`、`/studio`，证明 SW 实际联网了；headless chromium 121 的 `Target.getTargets` 也不暴露 `service_worker` target，无法单独对其施加 offline。该次结果已作废。
**改用浏览器级真实断网**：同一 user-data-dir 重启浏览器并加 `--host-resolver-rules="MAP www.seatmark.cn 127.0.0.1"`（本机 443 无监听 → 所有连接被拒，SW 一并断网）。

| 断网态导航 | innerText 长度 | 耗时 | 结果 |
|---|---|---|---|
| `/`（已在 pages 缓存） | 3221 | 0.5 s | ✅ 首页完整渲染，hero「上传 Excel，批量生成」+ 右侧 A4 排版预览可见，无错误页 |
| `/studio`（已在 pages 缓存） | 1407 | 0.5 s | ✅ 工坊完整渲染：三步卡、「选择模板」列表 + 缩略图、右侧预览区与工具栏 |
| `/tutorials`（**不在**缓存，反向对照） | 169 | 12.1 s | ✅ 按预期出 Chrome 错误页 `This site can't be reached / ERR_FAILED` —— 证明断网真实生效、上面两条不是假通过 |

- 未出现浏览器离线恐龙页/白屏；回落几乎瞬时（连接被拒立即失败，未等满 4 s 超时，属 NetworkFirst 正常行为）— PASS。
- 去掉 host-resolver 规则重启后 `/` 恢复正常联网渲染，缓存状态不变 — PASS。
- 取舍如实记录：`navigateFallback` 已移除，**离线访问从未访问过的路由会失败**（旧配置下 SPA 任意路由都能靠预缓存 index.html 离线打开）。这是本 PR 为"安全头即时生效"付出的代价，用户需求文档里已默认接受；若希望两者兼得，可给 navigate 规则加一个"缓存 miss 时回落到某个已缓存壳页"的 handler 兜底。

## 4. Regression 功能冒烟（真实 UI，1280×900，老 profile 新 SW 已接管）

- 渲染：`/` hero + CTA、`/templates`「标签模板库 222 款」网格与缩略图、`/studio?template=signage` 三步卡 + 模板列表 + 预览区，均正常，无白屏 — PASS。
- Excel 导入 `r96_singlecol.xlsx` →「共 2 条数据」「2 个标签」，预览含「张伟」「王芳」— PASS。
- PNG 导出（点「图片 PNG」→ 点「带水印导出（不限次数）」卡片）→ 实际落盘 `签到桌牌版-20260809-2331.zip`（33 955 B），解包 2 张 PNG（17 868 / 15 581 B），001 像素核验为「张伟」桌牌（1063×638，非空白 6.33%，含 seatmark.cn 水印）— PASS。
- 打印（stub `window.print` → 点「打印 / 矢量 PDF」→ 点导出方式卡片 → `__printed=1` 即刻 `printToPDF`）→ **1 页 A4 594.96×841.92 pt**，含「张伟」「王芳」两枚桌牌 + 裁切线 + 页脚，非空白 — PASS。
- 控制台/网络：整轮 error 级日志 **0** 条、≥400 响应 **0** 条（排除既有 third-party cookie 警告）— PASS。

## 5. 结论与开放项

- 本轮 4 类断言除 P3-1（老访客需关全部标签页才接管）外全部通过；第 104 轮 P3-1（安全头被 SW 绕过）在"新 SW 已接管"前提下确认闭环。
- 既有开放项不变：生产 `x-seatmark-storage: memory`（限频失效 / 短码分享失效 / 无法登录）、SES 邮件未配置（`/api/auth/code` 502）、`/api/*` 不带安全头（edge function 自建 Response）、`/assets/*` 头合并、`/templates` 根文档时延波动。

**产物**：截图 `/home/ubuntu/screenshots/r105_clickjacking_oldprofile.png`、`r105_offline_home.png`、`r105_offline_studio.png`、`r105_offline_uncached.png`、`r105_recovered_online.png`、`r105_render_home.png`、`r105_render_templates.png`、`r105_render_studio.png`、`r105_import_ok.png`、`r105_export_done.png`、`r105_export_png_001.png`、`r105_print_state.png`、`r105_print_pdf-1.png`；PDF `/home/ubuntu/r105_print.pdf`；导出 zip `/home/ubuntu/r105_dl/签到桌牌版-20260809-2331.zip`；脚本 `/home/ubuntu/r105_old.py`、`r105_swtakeover.py`、`r105_clean_offline.py`、`r105_offline2.py`、`r105_smoke.py`；计划 `/home/ubuntu/repos/SeatMark/test-plan-round105.md`。

---

# 第 104 轮：线上回归 PR #124（edgeone.json 安全响应头，squash 38e1f3c）

**日期**: 2026-08-09　**环境**: 生产 www.seatmark.cn（bundle 仍 `index-DQ-Z9IXg.js`，符合"仅改平台配置"预期）。curl 抓头 + CDP 1280×900 真实 UI（含全新干净 profile 浏览器实例）+ Lighthouse 13.4.1 移动仿真。未录屏。未改任何产品代码。
**结论**: **六个新头在 `/`、`/studio`、`/templates` 全部生效且值与 edgeone.json 完全一致；跨域 iframe 嵌 `/studio` 在干净浏览器里被拒绝渲染（控制台明确报 frame-ancestors 'self' 拒绝），第 103 轮 P2-1 主体闭环；功能回归（渲染/导入/PNG 导出/打印/统计脚本/控制台）全部通过。但发现 2 条新注记：① `/assets/*` 并未如预期"覆盖"`/*` 头集合，实际是合并（资产也带上了 XFO/CSP/Referrer/Permissions），属平台行为、无害；② **Service Worker 预缓存的 index.html 使老访客的导航请求绕过新头**——在已装 PWA SW 的浏览器 profile 里 iframe 仍完整渲染工坊（`fromServiceWorker: true`），记 P3。**

## 1. 响应头逐条核验（curl，原始输出 `/home/ubuntu/r104_headers.txt`）

| 头 | `/` | `/studio` | `/templates` | `/assets/index-DQ-Z9IXg.js` | `/api/quota` |
|---|---|---|---|---|---|
| Cache-Control | `no-cache, must-revalidate` ✅ | 同 ✅ | 同 ✅ | `public, max-age=31536000, immutable` ✅ | `no-store` |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains` ✅ | ✅ | ✅ | ✅ | ❌ 无 |
| X-Content-Type-Options | `nosniff` ✅ | ✅ | ✅ | ✅ | ❌ 无 |
| X-Frame-Options | `SAMEORIGIN` ✅ | ✅ | ✅ | ⚠️ 也存在（预期外，见下） | ❌ 无 |
| Content-Security-Policy | `frame-ancestors 'self'` ✅ | ✅ | ✅ | ⚠️ 也存在 | ❌ 无 |
| Referrer-Policy | `strict-origin-when-cross-origin` ✅ | ✅ | ✅ | ⚠️ 也存在 | ❌ 无 |
| Permissions-Policy | `geolocation=(), microphone=(), camera=(), payment=(), usb=()` ✅ | ✅ | ✅ | ⚠️ 也存在 | ❌ 无 |

- 三个静态路由：**六个新头逐条值全等** edgeone.json 配置，无缺无错 — PASS。
- `/assets/*`：Cache-Control 正确取到更具体规则的 immutable，HSTS + nosniff 齐全；但**用户预期的"只应有这三项"未成立**——EdgeOne 把 `/*` 与 `/assets/*` 两段的头**合并**下发，资产响应也带 XFO/CSP/Referrer/Permissions。属平台合并语义（非配置错误），对 JS/CSS 资产无副作用（XFO/CSP frame-ancestors 只影响文档级 frame 嵌套）。如实记为平台行为。
- `/api/quota`（edge function）：**六个新头全部不生效**，仅 `content-type`/`cache-control: no-store`/`x-seatmark-storage: memory`/`server: edgeone-pages`。与第 103 轮源码分析一致——`json()` 自建 Response，不受 `headers` 段控制，属平台行为；API 为 JSON 响应、不可被 frame 渲染，风险低。如需覆盖须在 `json()` 里补 `extraHeaders`。

## 2. 点击劫持复测

- **干净浏览器 profile（全新 `--user-data-dir`，无 SW/无缓存）**：本地攻击者页面 `http://localhost:8099/frame2.html` 内 `<iframe src="https://www.seatmark.cn/studio?r104=1">`
  - iframe 响应头实测：`x-frame-options: SAMEORIGIN`、`content-security-policy: frame-ancestors 'self'`、`eo-cache-status: Cache Miss`、`fromDiskCache: false`
  - 控制台（`Log.entryAdded`, level=error, source=security）：`Refused to frame 'https://www.seatmark.cn/' because an ancestor violates the following Content Security Policy directive: "frame-ancestors 'self'".`
  - 视觉：iframe 区域为**空白错误页**（截图 `r104_clickjacking_freshprofile.png`），与第 103 轮 `r103_clickjacking_iframe.png` 的完整工坊界面形成红/绿对照 — **PASS**
- 反向对照：同一环境顶层直接打开 `https://www.seatmark.cn/studio` 正常渲染（`r104_toplevel_studio_ok.png`），证明拒绝来自跨源嵌套而非站点坏了 — PASS

### P3-1（新）Service Worker 预缓存令老访客的新头失效
在**此前访问过站点的浏览器 profile** 里，同一攻击者 iframe **仍完整渲染工坊界面**（`r104_clickjacking_blocked.png` / `r104_clickjacking_after_swpurge.png`）。CDP 实测该 iframe 响应为 `fromServiceWorker: true, fromDiskCache: true, age: 1083, eo-cache-status: Cache Hit`，头里**没有** XFO/CSP。
根因：站点 PWA 的 workbox 预缓存里含 `https://www.seatmark.cn/index.html?__WB_REVISION__=64c4c6b1…`（`caches.keys()` = `workbox-precache-v2-https://www.seatmark.cn/`，27 项），SPA 任意路由导航（含跨域 iframe 导航）由 SW 用这份**部署前抓取的 Response** 应答，其响应头是旧的 → XFO/CSP 不被强制。
影响：#124 对**已安装 SW 的老访客**在其预缓存刷新前不生效；因 #124 未改 index.html 内容，precache revision 不变，该条目不会自动换新——直到下次触及 index.html 的构建。
建议（只报告不改）：下次发版顺带让 index.html 内容变化（如注入构建时间戳注释）以翻转 precache revision；或让 SW 对导航请求走 NetworkFirst/不预缓存 index.html。风险等级 P3：新访客与刷新过缓存的访客已受保护，且利用仍需受害者先访问过站点。

## 3. 功能回归（真实 UI，CDP 1280×900）

- 渲染：`/`（hero「上传 Excel，批量生成」+ 双 CTA + A4 排版预览）、`/templates`（222 款网格缩略图正常）、`/studio`（三步卡 + 预览区）全部正常，无白屏、无样式丢失 — PASS（`r104_render_home.png`、`r104_render_templates.png`、`r104_render_studio.png`）
- Excel 导入：`/studio` 文件选择器上传 `r96_singlecol.xlsx` → 「共 2 条数据 / 2 个标签」、预览渲染「张伟」「王芳」两枚桌牌 — PASS（`r104_import_ok.png`）
- PNG 导出：点「图片 PNG」→ 弹窗 → 点「带水印导出（不限次数）」→ 实际下载 `签到桌牌版-20260809-2305.zip`（33 955 B），解包含 `…-001.png`(17 868 B)、`…-002.png`(15 581 B)，`001` 像素核验为「张伟」桌牌含 seatmark.cn 水印 — PASS（`r104_export_done.png`、`r104_export_png_001.png`）
- 打印：点「打印 / 矢量 PDF」→ 弹窗选导出方式后 `window.print` stub 被调用（`__printed=1`），期间 `Page.printToPDF(preferCSSPageSize)` 捕获 **1 页 A4 纵向（594.96×841.92pt）**，含「张伟」「王芳」两枚标签 + 裁切线 + 页脚水印，无空白页 — PASS（`r104_print_pdf-1.png`、PDF `/home/ubuntu/r104_print.pdf`）
- 统计脚本（clean state 加载 `/` 等 idle，CDP Network）：`googletagmanager.com/gtag/js?id=G-5MKTF5XDYQ` HIT、`hm.baidu.com/hm.js` HIT、`zz.bdstatic.com/linksubmit/push.js` HIT、`clarity.ms` HIT — 四家全部照常加载，Referrer-Policy/Permissions-Policy 未阻断 — PASS
- 控制台/网络：整轮回归收集到的 error 级日志与 ≥400 响应 **0 条**（仅有 Chrome 的 third-party cookie 警告，与第 100/103 轮同，非新增）— PASS

## 4. Lighthouse（参考项，`/home/ubuntu/r104_lighthouse/m_home.report.json`）

| `/` 移动仿真 | 第 100 轮 | 第 104 轮 |
|---|---|---|
| Performance | 92 | **95** |
| Best Practices | 58 | **58（无变化）** |
| CLS | 0 | 0 |
| TBT | 310 ms | 210 ms |
| LCP | 1.7 s | 1.8 s |
| 根文档响应 | — | 60 ms |

Best Practices 未因 HSTS/nosniff 变化：扣分项仍为 `third-party-cookies`（8 个，来自 Clarity/百度统计）、`deprecations`（app bundle 内 `unload` 监听）、`inspector-issues`——Lighthouse 的 BP 分类不为安全响应头加分。按用户约定仅作参考。

## 结论与遗留

- #124 主体目标达成：静态路由六头齐备、值正确，跨域点击劫持在干净客户端被拒绝，功能与统计无回归。
- 新增 **P3-1**（SW 预缓存令老访客新头失效，含修法建议）。
- 平台行为注记：`/assets/*` 头为合并而非覆盖；`/api/*` 完全不受 `headers` 段控制。
- 既有开放项不变：生产 KV 绑定（`x-seatmark-storage: memory`）、登录链路待 SES+KV、`/templates` 根文档时延波动。

---

# 第 103 轮：线上安全与网络响应头卫生审计（www.seatmark.cn，只审计不改码）

**日期**: 2026-08-09　**环境**: 生产 www.seatmark.cn（bundle `index-DQ-Z9IXg.js`，`x-seatmark-storage: memory`）。curl 抓头/畸形输入探测 + CDP 1280×900 真实 UI 注入面测试 + 本地 http://localhost:8099 攻击者页面 iframe 嵌套实证。未录屏。未改任何产品代码。
**结论**: **API 面稳健（全部畸形输入均为可控 4xx、零 500/545、零栈或密钥泄漏、JWT 伪造被拦、Cookie 属性齐全、CORS 未放宽、v-html 装饰层安全门禁有效且对照组证明非假通过）；但响应头卫生为空白：全站零安全响应头，站点可被任意第三方页面 iframe 嵌套（点击劫持）——记 1×P2 + 3×P3。**

## 问题清单

### P2-1 全站零安全响应头，可被任意站点 iframe 嵌套（点击劫持面）
`/`、`/studio`、`/templates`、`/api/quota`、`/api/announcement` 逐个抓头：**HSTS / X-Content-Type-Options / X-Frame-Options / CSP(frame-ancestors) / Referrer-Policy / Permissions-Policy 全部缺失**，EdgeOne 平台默认不补（响应仅含 cache-control、etag、eo-*、server: edgeone-pages）。
实证：本地起 `http://localhost:8099/frame.html` 用 `<iframe src="https://www.seatmark.cn/studio">` 嵌套 → **完整渲染可交互**（`window.frames.length=1`，跨域加载成功，见 `r103_clickjacking_iframe.png`）。
影响：点击劫持（可覆盖透明层诱导点击「打印/导出/删除账号」）、MIME 嗅探、Referrer 全量外泄给三家统计与上游。
修法（只报告不改）：`edgeone.json` 的 `headers` 段已在用（现仅配 Cache-Control），可在 `source: "/*"` 下补
`Strict-Transport-Security: max-age=31536000; includeSubDomains`、`X-Content-Type-Options: nosniff`、`X-Frame-Options: SAMEORIGIN`（或 CSP `frame-ancestors 'self'`）、`Referrer-Policy: strict-origin-when-cross-origin`、`Permissions-Policy: geolocation=(), microphone=(), camera=()`。CSP 完整策略因站内有 v-html/内联注入器与三家统计脚本，建议先上 frame-ancestors + Report-Only 观察。
附：`http://www.seatmark.cn/` → 302 `https://...`（跳转有，但无 HSTS 预加载保护）。

### P3-1 生产 memory 存储下所有限频形同失效（未认证写入端点无节流）
- POST /api/feedback 连打 12 次（代码日限 `FEEDBACK_IP_DAILY_LIMIT=10`）→ **12/12 全 200 `{"ok":true}`**，未出现 429。
- POST /api/auth/code 同邮箱连打 6 次 → 6/6 均 502（邮件未配置，见 P3-2），限频分支未被触达。
- POST /api/share/tpl 连打 10 次合法负载 → **10/10 200 各得短码**，代码本身无任何限频；未认证即可写入 ≤20000 字符负载。
归因：既有最高优先级开放项「生产未绑定 KV/Blob，`x-seatmark-storage: memory`」使跨 isolate 计数器全部失效——按本轮指示不算新缺陷，但它把「无限频未认证写入」变成实际滥用面，绑定 KV 后需复测。

### P3-2 /api/auth/code 线上 502，登录链路仍不可用
6/6 次返回 `{"error":"验证码发送失败，请稍后再试"}`（502）。与既有「登录链路待 SES+KV」开放项一致，本轮再次线上确认。

### P3-3 /api/share/tpl 写入后读不回（短码分享在生产不可用）
POST 得短码 `45c2aa5add` 后 GET `?code=45c2aa5add` → 404 `{"error":"短码不存在或已过期"}`。前端 `createVerifiedShortShareCode` 有回读校验兜底（不会发出扫不开的码），故用户侧表现为降级长链，但云端短码分享在生产实质不可用——同属 KV 未绑定的后果。

## 通过项（objective evidence）

- **CORS 未放宽**：带 `Origin: https://evil.example` 抓 `/`、`/api/quota` 与 OPTIONS 预检 → **无 `Access-Control-Allow-Origin`**（不反射、非 `*`），预检 204 无 ACA-* 头 — passed
- **错误方法**：GET 打 /api/auth/{code,verify,logout}、/api/account/delete、/api/quota/consume、/api/share/visit → 404「接口不存在」；/api/feedback、/api/ai-design → 405「请求方法不支持」；PUT /api/account/templates 未登录 → 401 — passed
- **非 JSON 体**（`this is not json <<<>>>`）7 端点 → 全 400 固定中文文案 — passed
- **缺字段/类型污染**（`{"email":{"$ne":null}}`、`{"code":null}`、`payload` 为对象、`role:"admin"`、2000 层嵌套数组、`?code=' OR 1=1--`、`/api/../../etc/passwd`）→ 全 400/404，无 500 — passed
- **超大 body**：300KB email、300KB/2MB share payload、2MB feedback content、2MB ai-design content → 全 400，**无 500/545、无边缘实例崩溃** — passed
- **无栈/密钥泄漏**：全部响应体为固定中文文案 JSON，未出现 `stack`/`TypeError`/`at `/文件路径/`sk-`/`Bearer`/env 变量名 — passed
- **JWT 伪造与提权**：伪造 `sm_session`（签名乱改）、`alg:none`、垃圾 cookie → /api/admin/{health,users}、/api/account/templates 全 401；/api/auth/me 返回 `{"user":null}`（不 200 泄漏用户） — passed
- **Cookie 属性**：POST /api/auth/logout → `set-cookie: sm_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` — passed（注：无法真实登录，登录态 Set-Cookie 走同一 `sessionCookie()`，本轮以 logout 通道核验属性）
- **名单字段注入（真实 UI）**：造 `r103_xss.xlsx`（姓名列 `<script>alert(1)</script>`、`"><img src=x onerror=alert(1)>`、`{{7*7}}`、`<svg onload=alert(1)>`）经文件选择器导入 /studio → 「已读取 4 条数据」，预览卡片**原样以文本显示尖括号**、`{{7*7}}` 未求值为 49、`window.__xss` 计数 0、DOM 内无 `img[onerror]`/`svg[onload]`/注入 `<script>` — passed（`r103_import_xss.png`、`r103_import_xss_preview.png`）
- **v-html 装饰层门禁（真实分享链接通道）**：用页面内同算法编码 `#tpl=` 负载模拟攻击者分享链接，5 种恶意 `decorSvg`（`<svg onload=>`、`<svg><script>`、非 svg 开头 `<img onerror>`、`<use xlink:href>`、`<foreignObject><img onerror>`）逐个真实点击弹窗「仅本次使用」应用 → **全部 `.label-decor` 节点数 0（装饰层拒绝渲染）、`window.__xss`=0、无 script/onerror/onload/foreignObject/use 节点**；**对照组**合法 `<svg><rect fill="#ffe4e6"/></svg>` → 4 个 `.label-decor` 渲染、截图可见粉色底纹，证明门禁不是"全都不渲染"的假通过 — passed（`r103_decor2_g_legit.png` vs `r103_decor2_a_svg_onload.png`）

## 方法学注记（诚实记录）
- 首轮 decorSvg 探测手写的模板 JSON 未通过 `isValidTemplate`（缺 `page`/`fields`），且分享链接需真实点击「仅本次使用」才应用——首轮全部变体（含对照组）都"未渲染"，属**假通过**；补齐 schema 并真实点击弹窗后重测，对照组渲染成功才使阴性结论有效。
- 超大 body 首次经 curl 命令行传参触发 `Argument list too long`，改为 `--data-binary @file` 重测。
- 生产 `x-seatmark-storage: memory` 使登录、短码回读、限频均不可用，因此认证态端点（配额消耗、账号模板读写、管理端点 200 路径）**本轮未能覆盖**，仅验证了其未认证拒绝路径——待 KV 绑定 + SES 配置后需补测。


# 第 102 轮：线上回归 PR #123（skip-link + SelectField 键盘语义，squash 2d6dc96，bundle index-DQ-Z9IXg.js）

**日期**: 2026-08-09　**环境**: 等 EdgeOne 部署刷新（`index-Bd-zc2r4.js` → `index-DQ-Z9IXg.js`）后开测；CDP Input.dispatchKeyEvent 真实按键 + activeElement 逐步断言 + focus ring 截图；1280×800 与 390×844。未录屏。未改任何产品代码。
**结论**: **#123 两项修复线上全部生效，第 101 轮 2 条 P3 闭环：/ 首次 Tab 停在「跳到主内容」且左上角像素可见、Enter 后焦点落 main#main-content、后续 Tab 直达主内容 CTA；SelectField ↓ 展开、↑/↓ 移动焦点（端点夹住）、disabled 纸型项被跳过、Enter 选中生效且焦点归还触发按钮、Esc 关闭焦点仍在触发按钮。鼠标通道与导出弹窗焦点管理回归无退化。**

## 1. skip-link — passed
- / clean 首次 Tab：activeElement=「跳到主内容」链接，左上角紫底白字浮现（`r102_skiplink_focus.png`，对照默认态无该元素 `r102_default_no_skiplink.png`，头部布局不变）；Enter → activeElement=main#main-content；再 Tab → 落主内容区首个可聚焦元素「开始生成标签」（/studio CTA），不再回头部导航（第 101 轮此步为 logo→精选模板…）。
- 390×844：首屏视觉无异常、首次 Tab 同样落 skip-link（`r102_skip_390.png`、`r102_skip_390_focus.png`）。

## 2. SelectField 键盘语义 — passed
- /studio 缩放下拉（signage）：触发按钮关态按 ↓ → listbox 直接展开（`r102_select_arrow_open.png`）；↓↓ 到「适应单枚」、↑ 回「适应宽度」，focus ring 可见（`r102_select_option_focus.png`）；连按 ↑×5 顶端夹住不越界；Enter 选中「适应单枚」→ 触发按钮文本变「适应单枚」且 **activeElement===触发按钮**（第 101 轮此处丢 body）；再开 → Esc 关闭，焦点仍在触发按钮（`r102_select_value_changed.png`、`r102_select_esc.png`）。
- disabled 跳过：fullPage 整页模板纸型下拉 17 项中 15 项 disabled（「不适配 与当前整页/折叠模板不兼容」徽标）——↓ 遍历焦点只落「不使用纸型」「A4 整版不干胶（推荐）」两个可用项并在此夹住，activeElement 从未落 disabled 按钮（`r102_paper_disabled_skip.png`）。注：signage/aurora 等常规模板纸型全兼容（isPaperCompatible 仅对整页模板判不兼容），disabled 场景须用 fullPage 类模板构造。

## 3. Regression — passed
- 鼠标通道：点击触发按钮开 → 点击「75%」选中生效并关闭 → 再开后点击组件外部关闭 — 与旧行为一致（`r102_mouse_regression.png`）。
- 导出弹窗抽检：「图片 PNG」Enter 打开 → 焦点入 dialog → Tab×10 全困陷 → Esc 关闭 → 焦点归还「图片 PNG」按钮（`r102_dialog_regression.png`）。诚实注记：第一次抽检 Esc 后焦点曾落到预览标签卡 DIV——复盘为此前鼠标回归步骤在 (900,500) 的外部点击命中了预览卡、污染了 previouslyFocused 链，干净复测焦点精确归还触发按钮，非产品缺陷。


# 第 101 轮：线上全键盘可达性与交互语义走查（www.seatmark.cn，无代码改动，找问题为主）

**日期**: 2026-08-09　**环境**: CDP Input.dispatchKeyEvent 发真实 rawKeyDown/keyUp（Tab/Shift+Tab/Enter/Esc/箭头），每步记录 document.activeElement + 截图核验 focus ring 像素可见性；1280×800。未录屏。未改任何产品代码。
**结论**: **主链路全键盘可达：首页→模板库（搜索/分类/卡片）→模板详情→工坊、导出弹窗焦点困陷+Esc+焦点归还、预览翻页/页码跳转、/seating 键盘选座交换全部可用，focus ring 全程像素可见，无键盘陷阱。发现 2 条 P3（无 skip-link；SelectField 自定义下拉无方向键导航且选中后焦点丢到 body）。**

## 1. 首页→模板库→工坊全键盘链路 — passed
- / 首次 Tab 落在 logo 链接（无 skip-link → P3-1）；Tab 至头部「模板」focus ring 可见（`r101_nav_templates_focus.png`）→ Enter 到 /templates。
- /templates：Tab 经 教程/定价/开始制作/登录 到搜索框（ring 可见，`r101_search_focus.png`），键入「桌牌」过滤到 25 款（`r101_search_filtered.png`）；继续 Tab 经 7 个分类 chip 到首张模板卡（ring 可见，`r101_card_focus.png`）→ Enter 进 /templates/signage 详情 → Tab 到「用此模板开始」→ Enter 到 /studio?template=signage。焦点顺序与视觉排布一致，无陷阱。

## 2. 导出弹窗焦点管理（ModalDialog）— passed
- Tab 到「图片 PNG」（ring 可见，`r101_png_btn_focus.png`）→ Enter：焦点落入 dialog panel（role=dialog aria-modal）；连续 15 次 Tab activeElement 全部保持在弹窗内（困陷生效）；Shift+Tab 反向循环正常；Esc 关闭；**关闭后焦点精确归还「图片 PNG」触发按钮** — 与 ModalDialog.vue L34-95 实现一致（`r101_export_dialog_open/trap/closed.png`）。

## 3. 预览翻页/缩放 — 翻页 passed，缩放 SelectField 两条 P3
- Tab 到 aria-label「下一页」→ Enter：页码 1→2；Shift+Tab 到「跳转到页码」输入框改 1 回车跳回（`r101_nextpage_focus.png`、`r101_page2.png`）。
- 缩放（SelectField 自定义下拉）：Enter 打开 listbox，**Tab 可逐项聚焦**、Enter 选中「适应单枚」生效、Esc 关闭（`r101_zoom_option_focus.png`）。但 **P3-2**：①无 ArrowDown/Up 方向键导航（SelectField.vue L53-55 仅处理 Escape，原生 select 习惯用户会困惑）；②选中选项后焦点丢到 body（未归还触发按钮），键盘用户需从头 Tab。全站同组件（字体/纸型/命名等十余处）同此行为。

## 4. /seating 键盘可达性 — passed（超预期）
- 左侧表单全部可达（标题/排数/列数/填充顺序/过道 7 按钮/演示名单/随机/打印/生成桌贴，Tab 顺序合理）。
- 座位格为 role=button tabindex=0 + @keydown.enter（SeatingView.vue L686-690）：Tab 到座位 2 → Enter 选中（selected 样式可见，`r101_seat1_selected.png`）→ Tab 到座位 3 → Enter → **两座位键盘交换成功**（2李磊平 ↔ 3张涛利，`r101_seat_swapped.png`）；行首「排」把手同样可聚焦可激活。拖拽不可用键盘替代的部分已有点选交换等价通道，不记问题。

## 问题清单
- **P3-1 无 skip-link**：/ 首次 Tab 直接落 logo，键盘用户每页需 Tab 穿越整个头部（7 个链接）才到主内容。建议加「跳到主内容」隐藏链接。
- **P3-2 SelectField 键盘语义不完整**：无方向键导航选项；选中后焦点不归还触发按钮（丢到 body）。建议补 ArrowDown/Up/Home/End + 选中/Esc 后 focus 归还。

诚实注记：走查中曾出现工坊「标签宽」从 90 变为 10 的状态污染——复盘为本测试脚本键盘输入落点偏差所致（刷新后干净状态复核 90 正常），非产品缺陷；第 3 步断言均在干净状态下重测确认。

# 第 100 轮：线上验证 PR #122（统计脚本空闲后注入，squash 9bdd506，bundle index-Bd-zc2r4.js / index.html 已刷新）

**日期**: 2026-08-09　**环境**: 等 EdgeOne 部署刷新（线上 index.html 头部 googletagmanager 直连 <script> 消失、出现 requestIdleCallback 注入器）后开测；CDP Network 时间线 + 真实 UI 导航；npx lighthouse 13.4.1（同第 98/99 轮口径移动仿真）。未录屏。未改任何产品代码。
**结论**: **#122 线上生效：4 个统计脚本（gtag.js / hm.js / push.js / clarity tag）全部在 load 事件之后才发起请求（load 前 0 个统计请求），stub 队列回放正常（dataLayer 含 config + / 与 /templates 两条 page_view，_hmt 加载后为对象访问不抛错，clarity 为 function）；Lighthouse / 移动 Perf 92（第 99 轮 51-61）、CLS 0、TBT 310ms。诚实记录：Best Practices 仍 58 未提升——扣分项（9 个第三方 Cookie、unload deprecation、inspector-issues）在统计脚本注入后依旧存在，idle 注入只把它们移出关键路径、Lighthouse 观察窗内仍会加载；BP 提升需减少统计供应商或等 Lighthouse 窗口外注入，属预期内限制非回归。**

## 1. 延迟注入时间线 — passed

- clean state 加载 /（共 35 请求）：loadEventFired t+0.92s；4 个统计请求全部 ≥ load 时刻之后发出，load 前统计请求 **0 个**。
  - googletagmanager.com/gtag/js、hm.baidu.com/hm.js、zz.bdstatic.com/linksubmit/push.js、clarity.ms/tag：均在 load 后立即（idle 可用）注入，无一缺失。

## 2. 队列回放 + SPA 导航上报 — passed

- 注入完成后 dataLayer 含 `('js', Date)`、`('config','G-5MKTF5XDYQ')`（stub 缓冲被 gtag.js 回放）；`_hmt` 为 object（hm.js 加载后替换）访问不抛错；`typeof clarity === 'function'`。
- 真实点击导航「模板」→ /templates：dataLayer 新增 page_view，page_path 序列 = ['/', '/templates']（router afterEach 上报链路未断）（`r100_templates_after_nav.png`）。

## 3. Lighthouse 对比（移动仿真） | 第 99 轮 → 第 100 轮

| 页面 | Perf | BP | CLS | TBT |
|---|---|---|---|---|
| / | 51-61 → **92** | 58 → 58 | 0 → 0 | 520-640ms → **310ms** |
| /templates | 51 → 50 | 58 → 58 | 0 → 0 | 510ms → 610ms |

- / 大幅改善（LCP 1.7s、根文档 190ms）；/templates 本次采样根文档 3220ms（既有 P3 服务端波动），Perf 50≈51 无回归。
- BP 未提升的明细：third-party-cookies 9 个（CLID/SM/MUID×2/MR/SRM_B/ANONCHK/HMACCOUNT×2，全部来自 Clarity/百度统计本身）、deprecations 1（app bundle 内 unload 监听，非统计脚本）、inspector-issues——统计脚本在 Lighthouse 跑分窗口内仍会注入（idle timeout 4s < 观察窗），Cookie 扣分不消失。如实记录，非 #122 回归。
- 原始 JSON：`/home/ubuntu/r100_lighthouse/`。

## 4. 冒烟 — passed

- / 与 /studio 正常渲染（`r100_home_smoke.png`、`r100_studio_smoke.png`）；stub 无任何异常抛出。
- 诚实注记：首次冒烟收到一条「Failed to load resource: 400」，定位为 google-analytics.com/g/collect 采集 beacon 在本测试环境被中断（ERR_ABORTED，网络出口限制），复测一轮 0 个 4xx/5xx；与 stub/注入器无关。


# 第 99 轮：线上回归 PR #120（性能两项 P2 修复对比，squash bf33d85，bundle index-Bd-zc2r4.js）

**日期**: 2026-08-09　**环境**: 等 EdgeOne 部署刷新（`index-Y9DXCqri.js` → `index-Bd-zc2r4.js`）后开测；npx lighthouse 13.4.1 + Chromium headless（与第 98 轮同口径：移动=moto G4 仿真+节流，桌面=--preset=desktop）；功能/视觉用 CDP 1280×800 与 390×844 真实 UI 操作，clean state。未录屏。未改任何产品代码。
**结论**: **#120 两项修复线上全部生效：全站移动 CLS 0.93 → 0（footer 位移条目消失）；/templates 移动 Perf 4 → 51、TBT 1820 → 510ms、LCP 11.9 → 8.2s，bootup 榜首 TemplateThumb 1611ms 条目消失。功能回归（懒渲染滚动/搜索/工坊选择器）与视觉回归（footer 首帧不入首屏、/privacy 页尾正常、/seating 打印 1 页无空白尾页）均通过。无新增问题。**

## 1. Lighthouse 前后对比（同口径移动仿真）

| 页面 | 端 | 指标 | 第 98 轮 | 第 99 轮 |
|---|---|---|---|---|
| / | 移动 | Perf / CLS / LCP / TBT | 60 / **0.931** / 3.1s / 280ms | 51 / **0** / 5.8s / 520ms |
| /templates | 移动 | Perf / CLS / LCP / TBT | **4** / 0.931 / 11.9s / **1820ms** | **51** / **0** / 8.2s / **510ms** |
| /templates | 桌面 | Perf / CLS / LCP / TBT | 59 / 0.415 / 1.9s / 290ms | **87** / **0** / 2.0s / 40ms |

- layout-shifts 审计中三份 JSON 均无任何 footer 位移条目（第 98 轮首条均为 `footer.no-print` 0.93）——`min-h-svh` 修复目标达成。
- /templates 移动 bootup 榜首从 TemplateThumb 1611ms + templates chunk 1551ms 变为页面主文档 198ms——defer 懒渲染目标达成。
- 诚实注记：/ 移动 Perf 60→51、LCP 3.1→5.8s 系单次采样波动（本轮 server-response-time 1480ms，属第 98 轮已报 P3 根文档响应时延波动区间；CLS/TBT 主因均已消除，FCP 4.3s 亦受其拖累），非 #120 引入回归。已复测第二次采样：/ 移动 Perf 61 / CLS 0 / LCP 4.5s / TBT 640ms，根文档仅 60ms——确认首采低分系服务端时延波动（JSON：m_home_run2.json）。
- 原始 JSON：`/home/ubuntu/r99_lighthouse/`（m_home / m_templates / d_templates）。

## 2. 功能回归：defer 懒渲染 — passed

- /templates 首屏（1280px，clean）：222 个缩略图容器仅 9 个实际渲染内层 LabelCard，首屏卡片像素正常（`r99_templates_top.png`）。
- 快速滚到底 + 回滚中部：视口±400px 内 nearUnrevealed=0，无空灰块残留（`r99_templates_bottom.png`、`r99_templates_middle.png`）。
- 搜索「婚」过滤后 19 张，视口内全部渲染（`r99_templates_search.png`）。
- 工坊选择器：「浏览全部 222 款模板」打开 → 225 个缩略图仅 9 个渲染；滚动中部/底部视口内全部补渲染（一个计数为“未渲染”的元素经核实被对话框滚动容器完全裁剪在可视区外，IntersectionObserver 判定正确，非可见空块）；点选「小学新生桌贴」切换成功、选中卡带勾且缩略图正常（`r99_picker_open/scrolled/bottom/switched_top.png`）。

## 3. 视觉回归：footer 首帧 — passed

- 390×844 与 1280×800 clean 加载 / 与 /studio：首帧（~0.35s）截图 footer 均不在首屏；加载完成后 footer 文档位置 top=6927/2125/3928/1999px，均在视口外（`r99_footer_{home,studio}_{390,1280}_{firstframe,loaded}.png`）。
- 短内容页 /privacy：滚到底 footer 完整显示在页尾（产品/教程/资源栏 + 备案号），无消失/重叠（`r99_privacy_footer.png`）。

## 4. /seating 打印 — passed

- 点击「打印座位表（A4 横向）」（stub window.print 避免阻塞对话框，打印宿主挂载期间用 Page.printToPDF preferCSSPageSize 捕获）：**1 页** A4 横向（841.92×594.96pt），内容为完整座位表（讲台+6排×8列+页脚），**无因 min-h-svh 产生的多余空白尾页**——`print:min-h-0` 生效（`r99_seating_print_page1.png`）。
- 方法注记：系统打印对话框本身无法在 headless CDP 中交互，以上通过真实点击打印按钮 + 打印媒体渲染管线捕获，等价核验分页结果。


# 第 98 轮：线上性能与加载体验审计（www.seatmark.cn，bundle index-Y9DXCqri.js，无代码改动）

**日期**: 2026-08-09　**环境**: npx lighthouse 13.4.1 + Chromium headless（移动=moto G4 仿真+4x CPU+slow4G 节流；桌面=--preset=desktop），五页 × 双端各一轮；弱网/CLS 目测用 CDP Network.emulateNetworkConditions + 390×844 连拍。未录屏。未改任何产品代码。
**结论**: **SEO 全 100、A11y 96-100、桌面性能尚可（74-89）；但移动端 Lighthouse 性能普遍偏低（4-60），核心问题两条 P2（全站移动 CLS≈0.93 的 footer 位移、/templates 移动端 222 模板全量渲染致 TBT 1.8s/LCP 11.9s）+ 2 条 P3。防回归项全过：首屏无 pdf/xlsx chunk、br 压缩、immutable 缓存、弱网无白屏。**

## 分数表（Perf / A11y / BP / SEO · LCP / CLS / TBT）

| 页面 | 移动 | 桌面 |
|---|---|---|
| `/` 首页 | **60**/100/58/100 · 3.1s/0.93/280ms | 74/100/58/100 · 1.1s/0.46/10ms |
| `/studio` | **54**/96/58/100 · 4.1s/0.96/250ms | 76/96/58/100 · 1.2s/0.42/0ms |
| `/templates` | **4**/96/73/100 · **11.9s/0.93/1820ms** | 59/96/58/100 · 1.9s/0.42/290ms |
| `/guides/label-print-troubleshooting` | **38**/100/58/100 · 8.4s/0.93/200ms | 78/100/58/100 · 1.1s/0.42/0ms |
| `/templates/weddingPlace` | 41/96/73/100 · 6.9s/0.93/280ms | **89**/96/58/100 · 1.3s/0.17/0ms |

注：INP 实验室不可测，以 TBT 为代理；移动分含 Lighthouse 4x CPU 节流，非真机绝对值。

## Top 问题清单（只列可行动项）

- **P2 全站移动 CLS≈0.93（桌面 0.42-0.46），元凶 `footer.no-print`**：五页 layout-shifts 首条均为 footer 位移 0.93——SPA 挂载后内容撑开将首屏可见的 footer 推出视口，Lighthouse 判为大位移。建议：给 `#app` 首屏容器设 `min-height:100vh`（或骨架占位），使 footer 初始即在视口外。注：390px 连拍目测首屏内容本身稳定无跳动（截图 r98_cls_*），伤害主要在 CWV 指标/搜索排名而非肉眼体验。
- **P2 /templates 移动端性能 4 分**：TBT 1820ms、LCP 11.9s、SI 9.7s；bootup 前两名 TemplateThumb.vue 1611ms + templates chunk 1551ms——222 张模板缩略图（SVG 逐张渲染）首屏全量挂载。建议：列表虚拟化或 IntersectionObserver 懒渲染缩略图、首屏只渲染可视区。
- **P3 第三方分析脚本拖累 BP 与主线程**：GTM/GA(165KB)+Microsoft Clarity+百度 hm 三家齐上，9 个第三方 Cookie 使全站 Best Practices 仅 58-73，GA 在 /templates bootup 占 1505ms；另有 `unload` 事件监听 deprecation 警告。建议：延迟到 idle/交互后注入、评估三家是否都保留、移除 unload 监听。
- **P3 根文档服务端响应 750-1420ms**（server-response-time 机会项，五页均出现，EdgeOne 边缘函数路径）。建议排查边缘函数冷启动/回源。

## 防回归与弱网（全部通过）

- 首屏网络清单（/ 33 请求、/studio 38 请求 · 共 501KB）**无 vendor-pdf/jspdf/xlsx chunk**（导出/导入仍按需加载）— passed
- 资源卫生：HTML/JS br 压缩；`/assets/*` `cache-control: public, max-age=31536000, immutable`；无 >150KB 图片（唯一 >150KB 是 GA 脚本）；无 render-blocking 字体（font-display insight 通过，仅 13KB CSS 阻塞属正常）— passed
- 弱网 Slow 4G（CDP 1.6Mbps/750kbps/RTT150ms，未加 CPU 节流）：`/` 首内容 0.5s（SSG 直出文案）、load 2.3s；`/studio` 首内容 2.1s、load 2.3s——无白屏死等（截图 r98_slow4g_*）— passed
- 390px 加载期目测：首页/工坊连拍 3 帧 + 终帧对比，首屏无可见跳动（截图 r98_cls_home_f0-2/final、r98_cls_studio_f0-2/final）— passed（与 Lighthouse CLS 的矛盾见 P2 第一条解释）

**产物**: Lighthouse JSON `/tmp/lh/*.json`（10 份）；截图 `/home/ubuntu/screenshots/r98_slow4g_home_firstcontent.png`、`r98_slow4g_home_loaded.png`、`r98_slow4g_studio_firstcontent.png`、`r98_slow4g_studio_loaded.png`、`r98_cls_home_f0.png`~`f2`/`final`、`r98_cls_studio_f0.png`~`f2`/`final`；计划 `/home/ubuntu/repos/SeatMark/test-plan-round98.md`。

---

# 第 97 轮：线上回归 PR #119（squash 0301d24）——多 sheet 工作表切换

**日期**: 2026-08-09　**环境**: 线上 www.seatmark.cn，等 EdgeOne 部署（bundle 由 `index-BVRp4ipW.js` 更新为 **`index-Y9DXCqri.js`** 后开测），clean state（清 SW/caches/storage），CDP 1280×800 真实 UI 操作；复用 `r95_multisheet.xlsx`（sheet「甲」3 行 /「乙」5 行）与 `r95_big300.xlsx`。未录屏，截图为证。未改任何产品代码。
**结论**: **四测项全部通过（第 95 轮 P3「多 sheet 静默取第一个」闭环）：多 sheet 出下拉可切换、toast 提示、覆写清除、往返正常、单 sheet 无退化、刷新恢复态正确不出下拉。无新增问题。**

## 断言结果

1. **多 sheet 导入 + 切换 — passed**
   - 上传 r95_multisheet.xlsx → toast「Excel 导入成功 已读取 3 条数据**；文件含 2 个工作表，可在导入面板切换**」（截图 `r97_1_import_toast.png`）；面板出现 `select[aria-label="切换工作表"]`（选项 甲/乙，当前值 甲）、表 3 行 甲1-甲3。
   - 先给「甲2」卡设单张覆写「覆写甲2」（toast「单张覆写已保存」，截图 `r97_1b_override_set.png`）→ 切到「乙」：toast「**已切换到工作表「乙」 已读取 5 条数据**」+「**单张覆写已清除**」双 toast 像素可见；表 5 行 乙1-乙5、表头 姓名/部门、下拉值=乙、预览回第 1 页且逐卡显示 乙1-乙5（自动映射生效）、覆写文字无残留（截图 `r97_2_switched_yi.png`）。
2. **往返切回「甲」— passed**：toast「已切换到工作表「甲」 已读取 3 条数据」、表 3 行 甲1-甲3（截图 `r97_3_back_jia.png`）。
3. **单 sheet 无退化（r95_big300.xlsx）— passed**：无 select，显示旧样式「工作表「监考名单」」，导入 toast 不含「文件含 N 个工作表」（截图 `r97_4_single_sheet.png`）。
4. **刷新恢复态不出下拉 — passed**：重新上传 multisheet（有下拉）→ 刷新 /studio：sessionStorage 恢复 3 行 甲1-甲3、文件名 r95_multisheet.xlsx 保留，**无 select**、显示「工作表「甲」」旧样式（原始 File 已失，符合设计）（截图 `r97_5_reload_no_select.png`）。

**诚实注记**: ① select 切换经 `value 赋值 + change 事件` 触发（原生下拉展开无法经 CDP 像素级仿真），与用户在下拉中选择走同一 @change 处理器；选项列表、当前值与切换后全部状态均经 DOM+截图核验。② 首次点预览卡设覆写时被「小技巧」提示浮层与误开的反馈弹窗遮挡两次，关闭后正常——属测试操作插曲，非产品缺陷。

**产物**: 截图 `/home/ubuntu/screenshots/r97_1_import_toast.png`、`r97_1b_override_set.png`、`r97_2_switched_yi.png`、`r97_3_back_jia.png`、`r97_4_single_sheet.png`、`r97_5_reload_no_select.png`；计划 `/home/ubuntu/repos/SeatMark/test-plan-round97.md`。

---

# 第 96 轮：线上回归 PR #118（squash 8b21e9c）——Excel 导入健壮性三修复

**日期**: 2026-08-09　**环境**: 线上 www.seatmark.cn，等 EdgeOne 部署（bundle 由 `index-Bx1XWLOr.js` 更新为 **`index-BVRp4ipW.js`** 后开测），clean state（清 SW/caches/storage），CDP 1280×800 真实 UI 操作；复用第 95 轮测试文件 + 新造 `r96_singlecol.xlsx` 反例。未录屏，截图为证。未改任何产品代码。
**结论**: **三修复全部线上生效（第 95 轮 P2 + 2 条 P3 闭环），单列长表头反例不误跳，正常 300 行 xlsx 无退化。无新增问题。**

## 断言结果

1. **合并表头补列（r95_merged.xlsx，第 95 轮 P2 闭环）— passed**：表头 =「姓名 / 部门职务 / **列3**」3 列；数据行 甲乙|教务处|**监考员**、|招生办|巡考员、丙丁|人事处|考务员——C 列职务不再丢（旧行为仅 2 列）。截图 `r96_merged.png`。
2. **前置大标题自动跳过（r95_titlerows.xlsx，第 95 轮 P3 闭环）— passed**：表头 =「姓名 / 部门 / 职务」（真实表头，旧行为是「2026 年监考安排表」），共 2 条 测试一/测试二；自动映射生效——预览卡片显示「测试一」「测试二」（截图 `r96_titlerows.png`、`r96_titlerows_preview.png`）。
   - **反例不误跳（r96_singlecol.xlsx：首行「参会人员姓名列表」8 字单列 + 2 行名字）— passed**：表头仍为「参会人员姓名列表」、共 2 条 张伟/王芳（multiColumn 守卫生效，未把单列表头当标题跳掉）。截图 `r96_singlecol.png`。
3. **CSV 口径统一（r95_test.csv，第 95 轮 P3 闭环）— passed**：file input `accept=".xlsx,.xls,.csv"`（DOM 核验）；上传区文案「支持 .xlsx / .xls / .csv」；经文件选择器通道上传 → toast「Excel 导入成功 已读取 2 条数据」、表头 姓名/部门、数据 丙丁|财务处、戊己|科研处。截图 `r96_csv.png`。
4. **Regression 正常 xlsx 无退化（r95_big300.xlsx）— passed**：toast「已读取 300 条数据」、表头恰好 姓名/部门/职务 3 列（columnCount 按数据最大列数建列未多出「列N」）、「300 个标签 13 页」与第 95 轮一致。截图 `r96_big300_regression.png`。

**产物**: 截图 `/home/ubuntu/screenshots/r96_merged.png`、`r96_titlerows.png`、`r96_titlerows_preview.png`、`r96_singlecol.png`、`r96_csv.png`、`r96_big300_regression.png`；新测试文件 `/home/ubuntu/r96_singlecol.xlsx`；计划 `/home/ubuntu/repos/SeatMark/test-plan-round96.md`。

---

# 第 95 轮：线上走查——Excel 导入健壮性与大名单性能（www.seatmark.cn，无代码改动）

**日期**: 2026-08-09　**环境**: 线上 www.seatmark.cn（bundle `index-Bx1XWLOr.js`），clean state（清 SW/caches/storage），CDP 1280×800 真实 UI 操作；测试文件用 openpyxl/xlwt/csv 现造（`/home/ubuntu/r95_*.xlsx|xls|csv`）。按约定未录屏，关键截图为证。未改任何产品代码。
**结论**: **大名单性能与多数脏数据场景表现良好；发现 1 条 P2（合并表头静默丢整列数据）+ 3 条 P3（多 sheet 无选择、标题行误当表头无引导、CSV 支持口径不一致）。**

## 问题清单

- **P2 合并表头导致整列数据静默丢弃**：`r95_merged.xlsx` 表头 B1:C1 合并「部门职务」→ 导入后表头仅「姓名/部门职务」2 列，**C 列（职务：监考员/巡考员/考务员）数据整列静默丢失**，无任何警示。复现：xlsx 表头行含合并单元格 → 上传 → 数据表列数变少。根因：sheet_to_json(header:1) 合并区仅左上格有值，headers 只按首行非空格建列。建议：解析时检测表头行合并/空洞并 toast 警示（或展开合并值）。另：数据区 A2:A3 合并 → 第 2 行姓名为空（Excel 语义使然，属可接受，预览显示空）。
- **P3 多 sheet 无选择交互**：`r95_multisheet.xlsx`（sheet「甲」3 行 +「乙」5 行）→ 固定读第一个 sheet，「乙」静默忽略、无选择/提示（面板显示「工作表「甲」」算部分可发现）。建议：多 sheet 时给一次性选择或提示。
- **P3 标题行文件被误当表头且无引导**：`r95_titlerows.xlsx`（第 1 行大标题、第 3 行真表头）→ 表头=「2026 年监考安排表」，真表头「姓名/部门/职务」成了数据行，自动映射全失效，无任何「表头看起来不对」引导。建议：检测首行仅 1 个非空格 / 与第二行列数差异大时提示「第一行可能是标题」。
- **P3 CSV 支持口径不一致**：解析器实际完美支持 CSV（强行送入 `r95_test.csv` → 「Excel 导入成功 已读取 2 条数据」、表头/中文/BOM 全正常），错误文案也写着「请重新选择 .xlsx / .xls / .csv 文件」；但 file input `accept=".xlsx,.xls"` 选择器里看不到 csv、拖拽路径正则拒绝并提示「请拖入 .xlsx 或 .xls 文件」。建议：三处统一（放开 accept+拖拽，或文案删去 .csv）。

## 断言结果

1. **大名单 300 行全链路（standard）— passed**
   - `r95_big300.xlsx`（姓名/部门/职务 300 行）上传 → toast「Excel 导入成功 已读取 300 条数据」，**导入耗时 0.95s**（截图 `r95_1_big300_toast.png`）；预览「300 个标签 13 页」（=ceil(300/24)）；页码输入 13 → 第 13 页正常渲染不卡死（截图 `r95_1_page13.png`）；图片版 PDF 带水印导出 **19s** 完成，`pdfinfo` Pages=13、1.6MB，第 13 页栅格非空白（mean 249.8/std 21.1）。
2. **脏数据**
   - a 合并单元格 — **failed（P2，见上）**：导入不报错但 C 列数据静默丢失（截图 `r95_2_merged.png`）。
   - b 首行标题 — **failed（P3，见上）**：标题被当表头、无引导（截图 `r95_2_titlerows.png`）。
   - c 空行夹杂 — passed：3 个全空行全部滤除，3 行数据完整（甲一/乙二/丙三）。
   - d 纯数字工号 — passed：2301/2026061001/9876543210 全部完整字符串显示，无科学计数。
   - e 超长字段+emoji — passed：50+ 字姓名与 emoji🎉/®/换行导入成功，预览卡片内截断省略号显示、无溢出（label-field scrollWidth 核验 + 截图 `r95_2_long_emoji_preview.png`）。
3. **多 sheet — failed（P3，见上）**：只读 sheet「甲」3 行，「乙」静默忽略、无选择交互（截图 `r95_2_multisheet.png`）。
4. **CSV / .xls**
   - CSV — 口径不一致（P3，见上，截图 `r95_4_csv.png`）；拖拽拒绝文案「文件类型不支持 请拖入 .xlsx 或 .xls 文件」本身清晰（代码 DataImportPanel.vue L158 核验；真实拖拽事件未仿真，标注 code-verified）。
   - .xls 老格式（xlwt BIFF）— passed：正常导入 2 行、工作表「老格式」（截图 `r95_4_xls.png`）。

**产物**: 截图 `/home/ubuntu/screenshots/r95_*.png`；测试文件 `/home/ubuntu/r95_big300.xlsx`、`r95_merged.xlsx`、`r95_titlerows.xlsx`、`r95_gaps.xlsx`、`r95_numeric.xlsx`、`r95_long_emoji.xlsx`、`r95_multisheet.xlsx`、`r95_test.csv`、`r95_old.xls`；导出 `/home/ubuntu/Downloads/标准考场版-20260809-2113.pdf`（13 页）；计划 `/home/ubuntu/repos/SeatMark/test-plan-round95.md`。

---

# 第 94 轮：线上回归 PR #116 —— 索引色量化分块局部质量下限（www.seatmark.cn，squash 2db8d84）

**日期**: 2026-08-09　**环境**: 线上 www.seatmark.cn，等待部署（bundle 由 `index-BoDH-XW9.js` 更新为 `index-Bx1XWLOr.js` 后开测），clean state（清 SW/caches/storage），CDP 1280×800 真实 UI 操作；产物用 PIL/NumPy/pdfimages/pdftoppm/unzip 客观核验。按约定未录屏。未改任何产品代码。
**改动**: indexedPng.ts 量化分支新增 64×64 分块局部质量下限（MIN_QUANTIZE_BLOCK_PSNR=33）——任一块量化 PSNR<33dB 返回 null 交回 JPEG/RGB 回退，修第 93 轮 P3（小面积照片页被整页加权 PSNR 掩盖仍走索引色）。
**结论**: **修复生效 + 回归不误伤，全部通过。照片页 PDF 现走 `rgb/jpeg`（第 93 轮同流程为 `index`），无照片页仍 index；aurora/standard PNG 与 aurora PDF 体积/编码与第 91 轮完全一致。无新增 P0/P1/P2/P3。**

## 断言结果

1. **修复验证：withPhoto 照片页 PDF 走 JPEG — passed**
   - 同第 93 轮流程：`/studio?template=withPhoto&demo=1` → 照片匹配列「姓名」→ 上传 3 张伪照片（张伟改为高噪声照片风图，更接近真实照片；王芳/李娜仍为渐变）→「已导入 3 张照片，匹配 3/26 行」（截图 `r94_1_photo_loaded.png`）→ 图片版 PDF 带水印导出（815KB）。
   - `pdfimages -list`：第 1 页（含 3 张照片行）**`rgb 3comp 8bpc enc=jpeg` 518K**（第 93 轮同页为 `index 8bpc` 162K）；第 2/3 页（无照片行）仍 `index 8bpc` 162K/110K——精确按"有照片的页回退、无照片的页保持索引色压缩"生效。
   - 240dpi 栅格裁照片区：唯一色 32511、std 60.4，噪声纹理逐像素保留，无量化色阶/色块（截图 `r94_1_pdf_photo_crop.png`；第 93 轮索引色通道下该区唯一色仅 117）。
2. **Regression aurora 不误伤 — passed**
   - PNG 逐张带水印 ZIP：18 张全部 IHDR `bitdepth 8 / colortype 3`（mode P 索引色）、2127×1063、35–45KB/张——与第 91 轮（35–45KB）完全一致，分块阈值未误伤平滑单向渐变。
   - 图片版 PDF：682KB（第 91 轮 666KB 同量级），`pdfimages -list` 6 页全部 `index/Flate 8bpc` 108–112K/页，无一变 jpeg。
3. **Regression standard 不误伤 — passed**
   - PNG 逐张带水印 ZIP：26 张全部 `bitdepth 8 / colortype 3`、1000×534、18–24KB/张（第 91 轮 17–24KB 同量级）。

**产物**: 截图 `/home/ubuntu/screenshots/r94_1_photo_loaded.png`、`r94_1_pdf_photo_crop.png`；导出 `/home/ubuntu/Downloads/照片核验版-20260809-2105.pdf`、`会议桌牌·极光渐变-20260809-2106.zip`、`会议桌牌·极光渐变-20260809-2106.pdf`、`标准考场版-20260809-2106.zip`；计划 `/home/ubuntu/repos/SeatMark/test-plan-round94.md`。

---

# 第 93 轮：新角度线上 UX/QA 走查——照片链路 / 单张覆写 / eink / 390px 全流程（www.seatmark.cn，无代码改动）

**日期**: 2026-08-09　**环境**: 线上 www.seatmark.cn（bundle `index-BoDH-XW9.js`，无新代码本轮不等新 bundle），clean state（清 SW/caches/storage），CDP 1280×800（照片/覆写/eink）+ 390×844 mobile（手机全流程）真实 UI 操作；产物用 PIL/NumPy/pdfimages/pdftoppm/unzip 客观核验。按约定未录屏，截图为证。未改任何产品代码。
**结论**: **四条链路全部走通，无新增 P0/P1/P2。1 条 P3 观察项（照片页 PDF 仍走索引色通道而非 JPEG/rich，但客观核验本例未毁色）+ 2 条诚实注记。**

## 断言结果

1. **照片/图片链路（withPhoto「照片核验版」，1280px）— passed（附 P3 观察）**
   - `/studio?template=withPhoto&demo=1` → 字段映射区「照片匹配」选匹配列「姓名」→ 上传 3 张伪造彩色渐变照片（张伟/王芳/李娜.jpg，120×160 JPEG）→ 文案「已导入 3 张照片，匹配 3/26 行（覆盖率 12%）」（截图 `r93_1_photo_stats.png`）。
   - 预览前 3 张卡照片区显示对应彩色渐变图（张伟=红→蓝、王芳=绿→黄、李娜=紫→青），其余行显示「照片」占位（截图 `r93_1_photo_preview.png`）。
   - PNG 逐张导出：照片卡 1063×591，照片区渐变平滑（左缘竖条带最大跨行色阶 5.3/255，端点色 [238,79,76]→[75,81,236] 与原图一致），未毁色。
   - 图片版 PDF（带水印，452KB）：`pdfimages -list` 3 页全部 `index 8bpc`（**照片页未走 JPEG/rich 通道**）；pdftoppm 240dpi 栅格裁照片区核验：渐变平滑（最大跨行色阶 8/255）、端点色保持，客观未毁色（截图 `r93_1_pdf_photo_crop.png`）→ 判定通过，但列 P3 观察。
   - **P3 观察**：照片页 PDF 仍进索引色量化通道，因 #114 的 PSNR≥40dB 门槛是**整页 count 加权**——本例照片仅占页面小面积，页面大部分为白底文字，加权 PSNR 轻松过关。若名单照片覆盖率高/照片面积大（如整页 10 张真人照），局部照片可能在不触发 40dB 门槛的情况下出现可见色阶。建议裁量：含 image 字段且照片有匹配的页直接走 JPEG/rich 通道（或对照片区域单独计 PSNR）。复现：withPhoto + 照片匹配 + 图片版 PDF → pdfimages -list 全 index。
2. **单张覆写 rowOverrides（1280px）— passed**
   - 预览点击第 2 张标签（王芳卡）→ 弹「单张覆写：只改这一张标签」→ 姓名改「覆写测试」→「保存覆写」→ toast「单张覆写已保存」（截图 `r93_2_override_saved.png`）；预览中「覆写测试」恰 1 处、「王芳」0 处、名单表仍显示王芳（数据未被改动，符合"只影响这一张"）。
   - PNG 逐张导出第 2 张栅格显示「覆写测试」（截图 `r93_2_override_png_card2.png`）；照片仍按原行值「王芳」匹配显示王芳照片（覆写只改显示文本，照片匹配用原始行值，属合理行为，注记）。
   - 清空名单 → 重载演示数据：预览「覆写测试」0 处、「王芳」恢复 1 处，无覆写残留（截图 `r93_2_override_cleared.png`）。
3. **eink 电子墨水导出（快速回归）— passed**
   - `/studio?template=eink800&demo=1` → 图片 PNG 对话框默认「精确像素（电子墨水屏 800×480）」+ 预设「800×480（7.5 英寸）」+「纯黑白输出」已勾选（截图 `r93_3_eink_dialog.png`）→ 带水印导出 ZIP 18 张。
   - PIL/IHDR 核验：每张恰 **800×480**、`bitdepth 1 / colortype 3`（1bit 索引）、唯一色恰 2、单张约 1KB、非空白（mean 248.8，姓名/单位/职务清晰，截图 `r93_3_eink_sample.png`）。
4. **Regression 390px 手机端全流程 — passed**
   - 390×844 mobile（innerWidth=390 校验），clean storage 首访 /studio → 点「标准考场版」卡 →「用演示数据先试试」→ 名单 26 条（截图 `r93_4_mobile_demo_390.png`）；无横向溢出（scrollWidth==clientWidth==380）。
   - 切「预览」标签页 →「图片 PNG」→ 导出对话框正常（截图 `r93_4_mobile_png_dialog_390.png`）→ 带水印导出 ZIP 26 张 1000×534，抽样非空白（mean 241.7/std 47.2，截图 `r93_4_mobile_zip_sample.png`）。
   - 诚实注记：手机端导出入口在「预览」标签页内（「设置」页无导出按钮），首次寻找导出按钮未果后切换标签即正常——属既有信息架构，非缺陷。

**产物**: 截图 `/home/ubuntu/screenshots/r93_*.png`；导出 `/home/ubuntu/Downloads/照片核验版-20260809-2048.pdf`、`照片核验版-20260809-2050.zip`、`电子座签 800×480-20260809-2052.zip`、`标准考场版-20260809-2055.zip`；伪造照片 `/home/ubuntu/r93_photos/`；计划 `/home/ubuntu/repos/SeatMark/test-plan-round93.md`。

---

# 第 92 轮：线上回归 PR #115 —— 切模板时演示名单跟随场景（www.seatmark.cn，squash b687938）

**日期**: 2026-08-09　**环境**: 线上 www.seatmark.cn，等待部署（bundle 已更新为 `index-BoDH-XW9.js` ≠ `index-CHOzqHip.js`），clean state（清 SW/caches/storage），CDP 1280×800 真实 UI 操作。按约定未录屏，截图为证。
**改动**: workspace.ts selectTemplate——名单为演示数据且 `demoExcelFor(新模板).sheetName` 不同（跨场景）时自动 applyExcel 换用新场景演示数据 + 精确映射，toast 追加「，演示数据已换为「××」」；同场景不重载；用户导入名单不动。
**结论**: **三项全部通过：跨场景切换演示名单自动换（婚宴→考场座位，toast/文件名/预览全部同步）；同场景（standard→examNo，同「考场座位」数据集）名单不重载、无换数据提示；用户自制名单跨场景切换保持不变。无新增 P0/P1/P2/P3。**

## 断言结果

1. **跨场景演示名单跟随 — passed**
   - `/studio?template=weddingPlace&demo=1`（名单=婚宴席卡：张伟/1/同心桌/陈嘉铭♥林晚晴…）→ UI 点「标准考场版」模板卡。
   - toast「模板已切换 当前模板：标准考场版，演示数据已换为「考场座位」」像素可见（截图 `r92_1_cross_scene_toast.png`）；名单表首行变「张伟 男 第1考场 01 2026061001 高三（1）班…」；导入面板文件名变「考场演示数据.xlsx」、演示数据徽章仍在（=1）；页面无婚宴残留（「桌名/新人/喜宴」全 false）；预览逐卡显示考场数据（准考证号 2026061001…）。
2. **同场景不重载 — passed**
   - 接上态点「考号贴」（同 exam 数据集）：toast 仅「模板已切换 当前模板：考号贴」，**不含**「演示数据已换为」；名单前两行切换前后逐字符一致（张伟…2026061001 / 王芳…2026061002）；文件名保持「考场演示数据.xlsx」（截图 `r92_2_same_scene_toast.png`）。
3. **用户名单不被替换 — passed**
   - 上传自制 `r92_custom.xlsx`（3 行：测试甲/乙/丙 + 桌号）→ 演示徽章消失（=0）→ 经「浏览全部」搜索切到「婚礼席位卡」（跨场景）→ 名单仍 3 行 测试甲/乙/丙、文件名保持 `r92_custom.xlsx`、无演示徽章、无「演示数据已换为」，预览按婚礼模板渲染 测试甲/桌号1（截图 `r92_3_user_roster_kept.png`）；再切回「标准考场版」（再次跨场景）名单仍不变，仅未提供的考场/准考证号列显示「未映射」占位（截图 `r92_4_user_roster_cross_back.png`，属正常映射行为）。

## 诚实注记
- 第 2 步截图中「标准考场版/考号贴」两张模板卡瞬时显示红/粉底色——为合成点击 pressed/过渡态的单帧现象，随后帧与计算样式（backgroundColor transparent）均正常，非持久缺陷，未列级。

**截图**: /home/ubuntu/screenshots/r92_1_cross_scene_toast.png、r92_2_same_scene_toast.png、r92_3_user_roster_kept.png、r92_4_user_roster_cross_back.png
**既知环境**: 生产 `x-seatmark-storage: memory` 不变，与本轮无关。

---

# 第 91 轮：线上回归 PR #114 —— 索引色量化 PSNR≥40dB 质量下限（www.seatmark.cn，squash 64ec78a）

**日期**: 2026-08-09　**环境**: 线上 www.seatmark.cn，等待部署（bundle 由 `index-DaVwUIZw.js` 更新为 `index-CHOzqHip.js` 后开测），clean state（清 SW/caches/storage），CDP 1280×800 真实 UI 操作导出；产物用 unzip/PIL/NumPy + pdfimages 客观核验。无 UI 变化，按约定未录屏。
**改动**: indexedPng.ts 新增 `MIN_QUANTIZE_PSNR=40`——median-cut 量化分支（唯一色>256）count 加权 PSNR<40dB 时返回 null 交回 JPEG/RGB-PNG 回退。现有模板（aurora 54.8dB）不应受影响，本轮为回归确认无劣化。
**结论**: **三项全部通过：aurora 逐张 PNG 仍索引色（colortype 3）35–45KB/张、渐变无条带；aurora PDF 页面图仍 index/Flate 8bpc、666KB；standard PNG 仍索引色 KB 级。#114 未误触回退，无劣化。**

## 断言结果

1. **deluxeConfAurora PNG（逐张，带水印）— passed**
   - `/studio?template=deluxeConfAurora&demo=1` → 图片 PNG → 带水印导出 → `会议桌牌·极光渐变-20260809-2031.zip`（18 张 PNG）。
   - PIL：全部 `mode=P`（IHDR colortype 3，索引色路径未误触回退）；2127×1063；单张 35–45KB（均值 41KB，数十 KB 量级，无 MB 暴涨）；调色板 255 色；抽样图非空白（mean 231.2/std 57.6），渐变带目视平滑无条带、姓名/水印清晰（`/home/ubuntu/screenshots/r91_aurora_png_sample.png`）。
2. **deluxeConfAurora PDF（带水印）— passed**
   - `会议桌牌·极光渐变-20260809-2032.pdf` 666KB（量级正常）；`pdfimages -list`：6 页页面图全部 `type=image, color=index, comp=1, bpc=8, enc=image`（即索引色 Flate，非 jpeg），108–112K/页。
3. **Regression standard 默认桌牌 PNG — passed（附注记）**
   - `/studio?template=standard&demo=1` → 带水印 ZIP（26 张，`标准考场版-20260809-2032.zip`）与无水印 ZIP（26 张，`标准考场版-20260809-2033.zip`，用掉当日 1 次配额）均为 `mode=P` colortype 3，1000×534，17–24KB/张。
   - 诚实注记：计划预期「1/2bit 位深」，实测两版均 bitdepth 8——实际页面因文字抗锯齿灰阶唯一色达 255/256（≤256 走精确调色板分支，位深自适应 8bit 属正确行为，非 #114 引入）；体积仍 KB 级，无劣化，判定通过但按实测修正预期。

**产物**: `/home/ubuntu/Downloads/会议桌牌·极光渐变-20260809-2031.zip`、`会议桌牌·极光渐变-20260809-2032.pdf`、`标准考场版-20260809-2032.zip`、`标准考场版-20260809-2033.zip`；抽样图 `/home/ubuntu/screenshots/r91_aurora_png_sample.png`
**既知环境**: 生产 `x-seatmark-storage: memory` 不变，与本轮无关。

---

# 第 90 轮：线上抽查 PR #112 —— 设计器移动端侧栏锚定内容区（www.seatmark.cn，squash 207cd93）

**日期**: 2026-08-09　**环境**: 线上 www.seatmark.cn，等待部署（bundle 由 `index-DYQvX8Ty.js` 更新为 `index-DaVwUIZw.js` 后开测），clean profile + 清 SW/caches/storage，CDP 390×844 mobile / 1280×800 仿真真实 UI 操作。按惯例未录屏，截图为证。
**改动**: TemplateDesigner.vue L1477 内容区容器 `flex min-h-0 flex-1` → `relative flex min-h-0 flex-1`——移动端两个 absolute 侧栏（字段列表/属性面板）改锚定内容区，不再从屏顶铺到底遮挡头部「保存」（第 88 轮注记项闭环）。
**结论**: **三项全部通过：390px 属性面板/字段列表侧栏均从工具栏之下开始（top=100px > 工具栏 bottom=87.5px），头部「取消/保存」完全可见可点；两种侧栏展开状态下直接点「保存」均成功出「模板已保存」toast；1280px 桌面三栏并排无回归。无新增 P0/P1/P2/P3。**

## 断言结果

1. **390px 属性面板不遮头部 + 面板展开直接保存 — passed**
   - 新建模板 → 添加「姓名（带标签名）」字段 → 属性面板展开：面板 rect top=100、左=92、宽 288、高 712；头部「保存」rect top=12.5/bottom=42.5（l=322~368）、「取消」同排均在面板之外；`elementFromPoint`（保存按钮中心）命中 `BUTTON:保存`（未被面板覆盖）；工具栏 bottom=87.5 < 面板 top=100（面板顶边在工具栏之下）。截图 `r90_1_property_panel_390.png`（取消/保存像素可见，面板含字段属性表单）。
   - 面板展开状态直接点「保存」→ toast「模板已保存」（截图 `r90_3_saved_390.png`），设计器关闭返回工坊（第 88 轮此步需先收起面板，现已闭环）。
2. **390px 字段列表侧栏不遮头部 — passed**
   - 重开设计器 → 汉堡展开字段列表：侧栏 rect top=100、宽 256；「保存」中心 `elementFromPoint` 命中 `BUTTON:保存`；截图 `r90_2_field_list_390.png`（头部 取消/另存/保存 完整可见，列表顶边在工具栏之下）。
   - 字段列表展开状态直接点「保存」→ toast「模板已保存」。
3. **Regression 1280px 桌面三栏 — passed**
   - 字段列表（left=0，宽 224，非 absolute）| 画布 | 属性面板（left=950，宽 320，非 absolute）三栏并排；头部「取消/另存/保存」正常。截图 `r90_4_desktop_designer_1280.png`。

## 诚实注记
- 第一次 390px 会话中途 CDP 设备仿真被重置为桌面宽度（既知 clean profile 现象），重新下发 override 并以 `innerWidth=390` 校验后继续，最终证据均为 390px 视口。
- 生产存储仍 `x-seatmark-storage: memory`（既有开放项，与本轮无关）。

**截图**: /home/ubuntu/screenshots/r90_1_property_panel_390.png、r90_2_field_list_390.png、r90_3_saved_390.png、r90_4_desktop_designer_1280.png

---

# 第 89 轮：768px 平板走查 + 模板详情 SEO 承接（www.seatmark.cn，无新代码改动）

**日期**: 2026-08-09　**环境**: 线上 www.seatmark.cn，clean profile + 清 SW/caches/storage，CDP 768×1024 仿真（innerWidth=768 校验）。按惯例未录屏，截图为证。
**结论**: **768px 新用户完整漏斗（首页→模板库→详情→工坊双栏→带水印 PNG 导出）与 3 个不同分类模板详情 SEO 承接全部通过，教程页无横向溢出。本轮无新增 P0/P1/P2/P3。**

- **A 768px 漏斗**：首页/模板库/详情/教程全程 `scrollWidth==clientWidth`（758/758，无横向溢出）![home](/home/ubuntu/screenshots/r89_A1_home_768.png) ![templates](/home/ubuntu/screenshots/r89_A2_templates_768.png)；导航「模板」→ 点婚礼席位卡卡片 → 详情 →「用此模板开始」→ `/studio?template=weddingPlace` 且工坊选中婚礼席位卡（勾选徽标）；**工坊 768px 双栏**：grid 计算列 `320px 390px`，左配置右预览并排（#73 双栏线上复查通过）![studio](/home/ubuntu/screenshots/r89_A4_studio_twocol_768.png)；「先用演示数据看看效果」→ toast「已载入「婚宴席卡」演示数据」18 标签 2 页；图片 PNG 带水印导出 → `婚礼席位卡-20260809-2009.zip` 含 18 张 1063×614 PNG，抽样非空白（沈佳宜风格喜宴卡、张伟/桌号1、右下 seatmark.cn 水印）![label](/home/ubuntu/screenshots/r89_A5_zip_label_sample.png)　**passed**
- **B 模板详情 SEO 承接（weddingPlace / meetingTent / examNo）**：三页均含规格徽标（尺寸/枚每页/纸张）、适用场景、使用步骤、打印建议区（教程中心 + 打印常见问题排查等 guides 链接 5 个）、底部同类推荐 3 款 ![wedding](/home/ubuntu/screenshots/r89_B_wedding_detail_768.png) ![meeting](/home/ubuntu/screenshots/r89_B_meeting_detail_768.png) ![examno](/home/ubuntu/screenshots/r89_B_examno_detail_768.png)；examNo CTA → 工坊选中「考号贴」（勾选徽标 + 预览按该模板重排既有名单）![cta](/home/ubuntu/screenshots/r89_B_examno_cta_studio_768.png)；推荐卡点击（weddingPlace→interviewNo）正确跳详情 ![related](/home/ubuntu/screenshots/r89_B_related_nav_768.png)　**passed**
- **C 768px 教程页**：/guides 列表（76 篇 + 主题/群体双维筛选）与长文 label-print-troubleshooting 均无横向溢出、排版正常 ![guides](/home/ubuntu/screenshots/r89_C_guides_768.png) ![guide](/home/ubuntu/screenshots/r89_C_guide_detail_768.png)　**passed**

**开放项**：无新增；既有开放项不变（生产 KV 绑定待运维、aurora flat 判定口径、151 个 color-contrast 装饰小字、登录链路待 SES+KV）。

---

# 第 88 轮：线上抽查 #110（www.seatmark.cn，squash 46d853c）+ 补做 390px 设计器链路

**日期**: 2026-08-09　**环境**: 线上 www.seatmark.cn（bundle 由 `index-C5DeoN5I.js` 更新为 `index-DYQvX8Ty.js` 后开测；前置确认线上存储仍 `x-seatmark-storage: memory`），clean profile + 清 SW/caches/storage，CDP 1280×800（分享）/ 390×844 mobile（设计器）。按惯例未录屏，截图为证。
**结论**: **#110 线上生效：存储 memory 时「微信扫码打开」不再发出必失效的短码二维码，改出「短链服务暂时不可用」失败态（重试 + 长链兜底）；长链二维码解码为 `#tpl=` 链接且清态承接可导入。第 87 轮 P1 的前端侧止血闭环（KV 绑定仍待运维）。补做的 390px 设计器新建→保存→使用链路通过。**

- **1 扫码弹窗失败态**：/studio 婚礼席位卡 →「微信扫码打开」→ 弹窗「短链服务暂时不可用：已自动重试仍未成功…」+「重试」「改用长链接二维码」两按钮，**无短码二维码**（第 87 轮此处直接展示扫不开的 `/?s=` 码）。![failed](/home/ubuntu/screenshots/r88_1_qr_failed_state.png)　**passed**
- **2 长链二维码兜底 + 承接**：点「改用长链接二维码」→ 出 QR（注明「模板数据全部编码在链接里，不经过任何服务器」），zbarimg 解码 = `https://www.seatmark.cn/studio#tpl=v1.…`（1120 字符，非 `/?s=`）![qr](/home/ubuntu/screenshots/r88_2_longlink_qr.png)；清 storage 导航该 URL → 弹「收到一个分享模板：婚礼席位卡」→「保存并应用」→ toast「已加入我的模板并应用」![landing](/home/ubuntu/screenshots/r88_2_longlink_landing.png)　**passed**
- **3 390px 设计器链路（补第 87 轮 C）**：「新建模板」→ 设计器打开（390 视口）→「+ 添加字段」菜单可见、点「姓名（带标签名）」画布出新字段 ![menu](/home/ubuntu/screenshots/r88_3_addfield_menu_390.png) ![added](/home/ubuntu/screenshots/r88_3_field_added_390.png)；字段列表点选滑入属性面板、字号 14→30（面板复查确认 30）![props](/home/ubuntu/screenshots/r88_3_props_check.png)；改名「第88轮测试模板」→ 保存 → toast「模板已保存：『第88轮测试模板』已加入我的模板并应用」、卡片带「自定义」徽标置顶选中 ![saved](/home/ubuntu/screenshots/r88_3_saved_390.png)；载入演示数据 → 预览 18 标签 1 页、「姓名 张伟」大字逐卡渲染（字号 30 生效可见）![preview](/home/ubuntu/screenshots/r88_3_preview_custom_390.png)；刷新 /studio → 模板仍在「我的模板」并保持选中（本地持久化）![persist](/home/ubuntu/screenshots/r88_3_reload_persist_390.png)　**passed**

**诚实注记**：① 设计器画布内新字段因 30×10mm 字段框 + 单行截断显示「姓名 张…」，字号生效以属性面板值与预览大字为准；② 保存按钮在属性面板展开时被面板遮挡，需先收起面板（点左上收起箭头）再点保存——移动端交互可用但略绕，未达 P 级问题，供产品参考。
**开放项**：第 87 轮 P1 的根因（生产 KV 未绑定）仍待运维处理，前端止血已上线；既有开放项不变。

---

# 第 87 轮：新角度线上走查（www.seatmark.cn，无新代码改动）

**日期**: 2026-08-09　**环境**: 线上 www.seatmark.cn，clean profile + 清 SW/caches/storage，CDP 1280×800（/seating 及分享链路）。按约定未录屏，截图为证。按「发现 P0/P1 立即停止扩面」约定，发现 **P1** 后终止了原计划第 C 部分（390px 设计器链路），未执行。
**结论**: **发现 1 个 P1：微信扫码短码分享链路线上完全不可用——生产环境边缘函数 KV 未生效（响应头 `x-seatmark-storage: memory`），短码写入不持久，扫码落地即「分享模板暂时无法打开」。/seating 全流程与长链 `#tpl=` 分享导入均正常。**

## 问题清单

- **P1 微信扫码短码分享线上不可用（存储降级 memory）**：
  - 复现 1（UI）：/studio 选婚礼席位卡 →「微信扫码打开」→ 弹窗出二维码（zbarimg 解码为 `https://www.seatmark.cn/?s=a685cfb661`）→ 清 storage 后导航该 URL → 首页 toast「分享模板暂时无法打开：链接可能已过期或网络波动…」，模板未导入。![landing](/home/ubuntu/screenshots/r87_B_shortcode_landing.png)
  - 复现 2（API 客观证据）：`POST /api/share/tpl` 返回 `{"ok":true,"code":"597381e074"}`（HTTP 200），**紧接着** `GET /api/share/tpl?code=597381e074` 即 404 `{"error":"短码不存在或已过期"}`。三个不同短码（aaf32471d2 / a685cfb661 / 597381e074）全部立即 404。
  - 根因指向：响应头 `x-seatmark-storage: memory` —— 生产环境 KV/Blob 均未绑定，边缘函数按 `edge-functions/api/[[default]].js` L39-40 注释降级到进程内存（「数据不持久，仅本地联调」），POST 与 GET 落在不同 isolate 导致读不到。**同一存储还承载分享送次数计数、登录验证码、团队预订等，均不持久**（与既有开放项「登录链路待 SES+KV」同根因，但扫码分享是当前已上线且引导用户使用的功能，故定 P1）。
  - 建议：EdgeOne 生产环境绑定 KV（或 Pages Blob）；在存储为 memory 时前端隐藏/禁用「微信扫码打开」按钮或直接出长链二维码兜底，避免发出必然失效的二维码。
- 无新增 P0/P2/P3。

## 通过项

- **A /seating 全流程（1280px）**：粘贴 12 人名单（含性别列）→「已输入 12 人 / 座位 12 个」；设 3 排×4 列；「完全随机」排座 12 人全部落座 ![random](/home/ubuntu/screenshots/r87_A_random_seated.png)；点选两个座位（键盘 Enter 选中→交换）王芳↔吴霞 互换成功 ![swap](/home/ubuntu/screenshots/r87_A_swap_after.png)；「一键生成对应桌贴」→ 跳 /studio + toast「座位表名单已带入 共 12 人」，clean 会话默认标准考场版不触发切换（#105 预期），座位号/姓名自动映射 2/4，交换结果（吴霞=1 号）正确带入 ![handoff](/home/ubuntu/screenshots/r87_A_handoff_toast.png)；图片 PNG 带水印导出 → ZIP 含 12 张 1000×534 PNG，抽样非空白、姓名/座位号/水印正确、未映射字段优雅留空 ![label](/home/ubuntu/screenshots/r87_A_zip_label_sample.png)　**passed**
- **B1/B2 长链分享**：「复制当前模板分享链接」→ toast「链接已复制」，剪贴板 URL 含 `#tpl=v1.`（1120 字符）![copy](/home/ubuntu/screenshots/r87_B_copy_toast.png)；清 storage 导航该 URL → 弹「收到一个分享模板：婚礼席位卡（90×52mm，10 枚/页，3 个字段）」![landing2](/home/ubuntu/screenshots/r87_B_share_landing.png)，点「保存并应用」→ toast「已加入我的模板并应用」　**passed**
- **B3 扫码弹窗 UI 本身**：二维码渲染正常、短码模式生成成功（前端无感知失败）![qr](/home/ubuntu/screenshots/r87_B_qr_modal.png)　**passed**（但承接失败见 P1）
- **C 390px 设计器新建→保存→使用**：按 P1 停扩面约定**未执行**　untested

**开放项**：新增 P1（生产 KV 未生效致短码分享不可用）；既有开放项不变。

---

# 第 86 轮：线上抽查 #108（www.seatmark.cn，squash 48e0f62）

**日期**: 2026-08-09　**环境**: 线上 www.seatmark.cn（bundle 由 `index-CHl-Q9Zq.js` 更新为 `index-C5DeoN5I.js`，chunk `excel-_EEUv0gx.js` 含「会议办公」→ #108 已部署），clean profile + 清 SW/caches/storage，CDP 1280×800。按约定未录屏，截图为证。
**结论**: **meeting 数据集场景名「会议桌牌」→「会议办公」线上生效（toast + 样例 Excel 文件名），会议桌牌模板 demo 链路无回归。第 84 轮 P3 观察项闭环。**

- **1 staffIdCard demo toast**：/studio?template=staffIdCard&demo=1 → toast「已载入「会议办公」演示数据」截图捕获（旧文案「会议桌牌」不再出现），工作证逐卡渲染正常（张伟/技术部/首席技术官…）。![toast](/home/ubuntu/screenshots/r86_1_toast_meeting_office.png)　**passed**
- **2 下载样例 Excel 文件名**：「导入数据」面板点「下载样例 Excel」→ 下载文件 `会议办公样例.xlsx`，openpyxl 核验 sheet 名「会议办公」、表头 姓名/单位/职务/部门/工号/桌号/座位号、5 行样例。　**passed**
- **3 Regression 会议大桌牌 demo**：/studio?template=meetingTent&demo=1 → 同 toast「已载入「会议办公」演示数据」，18 个标签 9 页，姓名特大字+单位题头逐卡正常。![tent](/home/ubuntu/screenshots/r86_3_meetingTent_regression.png)　**passed**

**开放项**：无新增；既有开放项不变。

---

# 第 85 轮：线上抽查 #107（www.seatmark.cn，squash eeddd01）

**日期**: 2026-08-09　**环境**: 线上 www.seatmark.cn（bundle 由 `index-BZMgDEn3.js` 更新为 `index-CHl-Q9Zq.js` → #107 已部署），clean profile + 清 SW/caches/storage，CDP 设备仿真 390×844。按约定未录屏，截图为证。
**结论**: **/papers 无效 slug 改渲染 404（URL 保持）线上生效；有效纸型详情与列表页无回归。第 84 轮 P3 观察项闭环。**

- **1 无效 slug → 404（390px）**：/papers/fake-paper 显示自定义 404 页（「404 NOT FOUND / 页面不存在或已被移动」+ 返回首页/进入标签工坊/模板库/教程/定价入口 + 教程推荐），location.pathname 保持 `/papers/fake-paper` 不再跳列表页。![404](/home/ubuntu/screenshots/r85_1_fake_paper_404_390.png)　**passed**
- **2 Regression 有效详情（390px）**：/papers/a4-8up 正常渲染面包屑、版式示意（2×4 八格）、标题「A4 8格不干胶（2 列 × 4 行）」、规格表（105 × 74.25 mm、2 列 × 4 行每页 8 枚、直角满切）、「用此纸型开始排版」CTA。![detail](/home/ubuntu/screenshots/r85_2_a4_8up_detail_390.png)　**passed**
- **3 Regression /papers 列表（390px）**：正常渲染 16 张纸型卡片 + 切角筛选（全部/直角/圆角）。![list](/home/ubuntu/screenshots/r85_3_papers_list_390.png)　**passed**

**开放项**：无新增；既有开放项不变。

---

# 第 84 轮：线上抽查 #106（www.seatmark.cn，squash 269c9bb）+ 新角度走查

**日期**: 2026-08-09　**环境**: 线上 www.seatmark.cn（bundle `index-BZMgDEn3.js`；`StudioView-hE_dv79r.js` 含「已换用适配该纸型的模板」、`PricingView-D1oUnVYq.js` 含「请输入正确的邮箱地址」→ #106 已上线），clean profile + 清 SW/caches/storage，CDP 设备仿真 1280×800 / 390×844。按约定未录屏，全程截图。
**结论**: **Part 1 #106 两项线上抽查全部通过；Part 2 新角度走查（404/账户页/教程搜索/PDF 导出核验）未发现 P0/P1/P2，仅 2 条 P3 观察项。**

## Part 1-1 纸型深链兜底（1280px）
- 前置 UI 选课桌姓名贴 → /studio?paper=a4-8up（无 template）：toast「已换用适配该纸型的模板：原模板与『A4 8格不干胶（2 列 × 4 行）』适配度不足，已切换到『驾校学员车贴』并按纸型锁定排版（每页 8 枚）」截图捕获；纸张排版 105×74.25、2 列 × 4 行（DOM 值 105,74.25,2,4），预览「8 枚 / 页」。![toast](/home/ubuntu/screenshots/r84_1_fallback_toast_online.png)　**passed**

## Part 1-2 预订登记中文校验 + 拆段（390px）
- /pricing 首屏说明拆两段（第二段「专业版 Beta 期间限时免费试用；团队版支付开通前可预订登记。」）。![split](/home/ubuntu/screenshots/r84_2_pricing_split_390_online.png)　**passed**
- 预订登记空邮箱提交：无原生英文气泡，弹窗内中文红字「请输入正确的邮箱地址」（计算色 red-600）。![cn](/home/ubuntu/screenshots/r84_2_cn_validation_390_online.png)　**passed**

## Part 2 新角度走查
- **A 404/错误路径（390px）**：/nonexistent-page、/templates/notATemplate、/guides/fake-slug 均为自定义 404 页（「404 NOT FOUND / 页面不存在或已被移动」+ 返回首页/工坊/模板库/教程/定价入口 + 教程推荐）。![404](/home/ubuntu/screenshots/r84_A_404_390_online.png)　**passed**。P3 观察：/papers/fake-paper 不走 404 而是直接展示纸型库列表页（兜底合理但与 templates/guides 的 404 行为不一致）。
- **B /account 未登录 390px**：布局完整无横向溢出（scrollWidth=clientWidth=380），登录说明、本地处理声明、「今日本设备剩余 1/1 次无水印导出」清晰。![account](/home/ubuntu/screenshots/r84_B_account_390_online.png)　**passed**
- **C guides 搜索/筛选（390px）**：拼音首字母 `jkz` → 「共 1 篇教程」命中监考照片核验教程；`zzzzz` → 「共 0 篇教程」空态 + 「清除筛选」；`dayin` 命中 40/40（几乎所有教程含「打印」，属数据使然）。![jkz](/home/ubuntu/screenshots/r84_C_guides_jkz_390_online.png) ![empty](/home/ubuntu/screenshots/r84_C_guides_empty_390_online.png)　**passed**
- **D PDF 导出文件核验（1280px）**：standard+demo（会话纸型沿用 a4-8up，UI 显示 26 标签/4 页）。带水印导出：pdfinfo 4 页 A4，pdftoppm 100dpi 栅格非空白（std 34.3），每枚标签底部「seatmark.cn」徽章式水印+右下角页脚水印可见。![wm](/home/ubuntu/screenshots/r84_D_pdf_p1_bottom2x.png)　**passed**。无水印导出（配额 1 次）：文件同 4 页，同位置无任何水印徽章；导出后 banner「今日无水印次数已用完」、再开弹窗显示「无水印导出（今日剩余 0 次）」并置灰不可选。![nowm](/home/ubuntu/screenshots/r84_D_pdf_nowm_bottom2x.png) ![quota0](/home/ubuntu/screenshots/r84_D_quota_zero_dialog.png)　**passed**。P3 观察：demo 数据末两行（唐瑶/许辉）字段留空为 demoDatasets.ts 有意的边界样例，PDF 渲染优雅留白无「未映射」残字，非缺陷。

**开放项**：无新增 P0/P1/P2；既有开放项不变。

---

# 第 83 轮：本地验证 PR #106（第 82 轮 2 P2 + 1 P3，dev @ localhost:5174）

**日期**: 2026-08-09　**环境**: 本地 dev server http://localhost:5174（分支 `devin/1786301846-round83-p2-paperlink-pricing`，commit 1adb992），CDP 设备仿真 1280×800 / 390×844，清 storage。按约定未录屏，全程截图。
**结论**: **三项修复（纸型深链兜底换模板、预订表单中文校验、定价页说明拆段）全部通过，无阻断项。**

## 1. 纸型深链兜底（1280px）
- a) 前置选课桌姓名贴（90×30）→ /studio?paper=a4-8up（无 template）：toast「已换用适配该纸型的模板：原模板与『A4 8格不干胶（2 列 × 4 行）』适配度不足，已切换到『驾校学员车贴』并按纸型锁定排版（每页 8 枚）」；模板选中变「驾校学员车贴」（带「适配」徽标），纸张排版 105×74.25、2 列 × 4 行，demo 48 人 6 页（8 枚/页）不拉伸。![toast](/home/ubuntu/screenshots/r83_1a_toast.png) ![switched](/home/ubuntu/screenshots/r83_1a_switched.png)　**passed**
- b) 反向（显式 template）：同前置后 /studio?template=staffIdCard&paper=a4-8up&demo=1：仍出「纸型与当前模板适配度不足…已保持模板默认排版」警告，模板保持工作证 54×86、3×3 竖版逐卡正常，不被换。![kept](/home/ubuntu/screenshots/r83_1b_explicit_kept.png)　**passed**
- c) Regression 适配深链：/studio?template=standard&paper=a4-24up-round&demo=1：toast「已按纸型锁定排版」，纸型 63.5×33.9、3×8（24 枚/页）。![lock](/home/ubuntu/screenshots/r83_1c_lock_regression.png)　**passed**

## 2. 预订表单中文校验（390px）
- 空邮箱提交：无浏览器原生英文气泡，弹窗内中文红字「请输入正确的邮箱地址」。![cn](/home/ubuntu/screenshots/r83_2_cn_validation_390.png)　**passed**
- `bad@` 提交：红字保持。![bad](/home/ubuntu/screenshots/r83_2_bad_email_390.png)　**passed**
- test@example.com 提交：「预订登记成功」弹窗 + toast（回归正常）。![ok](/home/ubuntu/screenshots/r83_2_success_390.png)　**passed**

## 3. 定价页说明拆段（390px）
- 首屏说明拆为两段：第一段配额（带水印/无水印/分享），第二段「专业版 Beta 期间限时免费试用；团队版支付开通前可预订登记。」，行文较第 82 轮单段更易读。![split](/home/ubuntu/screenshots/r83_3_pricing_split_390.png)　**passed**

---

# 第 82 轮：线上抽查 #105 + 新角度走查（定价页 / 模板详情 / 纸型落地页 / 768px 转化路径，www.seatmark.cn）

**日期**: 2026-08-09　**环境**: 线上（bundle `index-3bRHojcA.js`，`TemplatesView-DOLo1OWN.js` 含「分类下无匹配」、`StudioView-D7eYmTeD.js` 含「已切换到课桌贴模板」，curl 核实即含 #105；清 SW/caches + storage），CDP 设备仿真 390×844 / 768×1024 / 1280×800。按约定未录屏，全程截图。
**结论**: **Part 1 #105 三项线上抽查全部通过；Part 2 走查发现 2 个 P2 + 1 个 P3，无 P0/P1。**

## Part 1 #105 线上抽查
1. **搜索×分类回退提示（390px）**：/templates 搜 `hunli` 点「考试」→ 提示「『考试』分类下无匹配，已在全部分类中找到 15 款」，结果为婚礼模板。![f](/home/ubuntu/screenshots/r82_1_fallback_online.png)　**passed**
2. **座位表带入自动切模板（1280px）**：前置 staffIdCard → /seating 48 人 →「一键生成对应桌贴」：双 toast「座位表名单已带入」+「已切换到课桌贴模板」，模板选中「课桌姓名贴」，大字姓名逐卡。![s](/home/ubuntu/screenshots/r82_2_autoswitch_online.png)　**passed**
3. **宽表首列 sticky（390px 顺带）**：对比总表横滚到最右（52/52，SeatMark 列完整），「维度」列固定左缘白底不透字。![t](/home/ubuntu/screenshots/r82_3_sticky_online.png)　**passed**

## Part 2 新角度走查（2 P2 + 1 P3）
- **P2-1 纸型落地页 CTA 遇适配门槛成「死胡同」**：/papers/a4-8up「用此纸型开始排版」→ /studio?paper=a4-8up，当会话当前模板与该纸型宽高比差异大（如课桌姓名贴 90×30）时出「纸型与当前模板适配度不足…已保持模板默认排版」——门槛本身正确（#104 预期），但用户从纸型页进来的意图就是**用这张纸**，被拒后没有下一步指引。建议：该深链被拒时附带推荐适配该纸型的模板（或 CTA「查看适配模板」）。![gate](/home/ubuntu/screenshots/r82_C_paper_gate_390.png)
- **P2-2 团队版预订表单校验为浏览器原生英文提示**：/pricing 390px「预订登记（免费）」弹窗空邮箱提交出英文原生气泡「Please fill out this field.」，与全站中文文案不一致（受浏览器 locale 影响，中文用户多数场景显示中文，但自定义校验可控性更好）。正常提交 test@example.com 后「预订登记成功」弹窗+toast 正常。![v](/home/ubuntu/screenshots/r82_A_reserve_success_390.png)
- **P3 定价页顶部说明段信息密度高**：390px 首屏副标题一段话塞了带水印/无水印/登录/分享/专业版/团队版六个概念（截图 r82_A_pricing_390_top.png），可拆行或分点；非阻断。
- 其余正常：定价页三卡（免费/专业 Beta/团队 ¥99）390px 布局完整、CTA 去向清晰（/account 登录）；weddingPlace 模板详情 390px 无横向溢出、样例卡/适用场景/打印建议/相关模板完整；/papers 列表与 a4-8up 详情参数表完整；768px 首页 hero→「用演示数据先试试」→ 工坊三步引导+26 张预览+「已载入考场座位演示数据」toast 一步到位。![pricing](/home/ubuntu/screenshots/r82_A_pricing_390_top.png) ![wed](/home/ubuntu/screenshots/r82_B_wedding_detail_390.png) ![768](/home/ubuntu/screenshots/r82_D_studio_768_demo.png)

---

# 第 81 轮：本地验证 PR #105（第 80 轮 3 P2 清扫，dev @ localhost:5174）

**日期**: 2026-08-09　**环境**: 本地 dev server http://localhost:5174（分支 `devin/1786298187-round81-p2-sweep`，commit b9922db），CDP 设备仿真 390×844 / 1280×800，清 sessionStorage/localStorage。按约定未录屏，全程截图。
**结论**: **三项修复（搜索×分类叠加、座位表带入自动切课桌贴、教程宽表首列 sticky）全部通过，无阻断项。**

## 1. 模板库搜索×分类叠加（390px）
- a) 搜 `hunli` 后点「考试」分类：提示变为「『考试』分类下无匹配，已在全部分类中找到 15 款」，结果为婚礼模板（回退全库有解释，不再与选中态矛盾）。![fallback](/home/ubuntu/screenshots/r81_1a_fallback_note.png)　**passed**
- b) 「考试」分类下搜 `kaohao`：提示「在『考试』分类中找到 2 款」，结果为考号贴等考试类模板（叠加过滤真实生效）。![inscope](/home/ubuntu/screenshots/r81_1b_inscope_note.png)　**passed**
- c) Regression：清搜索后「考试 31」分类 + 子分类「考号与证件 7」筛选正常（URL ?cat=exam&sub=exam-id，结果为考号贴/出入证）。![subcat](/home/ubuntu/screenshots/r81_1c_subcat_regression.png)　**passed**

## 2. /seating 一键生成桌贴自动切模板（1280px）
- a) 前置选 staffIdCard 后走 /seating 48 人示例 →「一键生成对应桌贴」：双 toast「座位表名单已带入」+「已切换到课桌贴模板：原模板字段与座位名单不匹配…」，模板选中变「课桌姓名贴」，卡面大字姓名逐卡正常（仅「学号」一栏未映射——座位名单本无学号列，非大面积破相）。![switch](/home/ubuntu/screenshots/r81_2a_autoswitch_toast.png)　**passed**
- b) 默认 standard 场景（清 storage）同流程：仅「座位表名单已带入」toast，无「已切换」toast，模板保持「标准考场版」（座位号/姓名 2/4 映射达阈值不触发）。![nosw](/home/ubuntu/screenshots/r81_2b_standard_no_switch.png)　**passed**

## 3. 教程宽表首列 sticky（390px）
- /guides/online-label-tools-review「对比总表」横滚到最右（scrollLeft 42/42，SeatMark 列完整）：「维度」首列（Excel 批量导入/A4 多枚毫米排版/照片批量匹配…）固定于左缘，td 白底、th 灰底不透字（第 80 轮为首列滚出视口）。![t0](/home/ubuntu/screenshots/r81_3_table_start.png) ![t1](/home/ubuntu/screenshots/r81_3_table_scrolled.png)　**passed**

---

# 第 80 轮：线上抽查 #104 + 新角度走查（/seating 移动端、模板搜索/筛选、教程移动端，www.seatmark.cn）

**日期**: 2026-08-09　**环境**: 线上（bundle `index-m0qzqg4h.js`，StudioView chunk `StudioView-Bjvg1UIQ.js` 已核实含 #104 字符串；清 SW/caches），CDP 设备仿真 390×844 / 1280×800。按约定未录屏，全程截图。
**结论**: **Part 1 #104 四项线上抽查全部通过；Part 2 走查发现 3 个 P2 新问题，无 P0/P1。**

## Part 1 #104 线上抽查
1. **390px 添加字段菜单**：/studio?design=new 点「+ 添加字段」菜单在视口内真实可见，点「姓名（带标签名）」画布出现「姓名 张同学」。![menu](/home/ubuntu/screenshots/r80_1_menu_390_online.png) ![added](/home/ubuntu/screenshots/r80_1_field_added_online.png)　**passed**
2. **390px 属性面板**：字段列表点选字段**自动滑入**属性面板；头部属性按钮切换正常；真实键盘改字号 14→36、HEX 键入 d62828 → 画布「姓名 张」变大变红。![auto](/home/ubuntu/screenshots/r80_2_props_autoslide_online.png) ![red](/home/ubuntu/screenshots/r80_2_canvas_red_online.png)　**passed**
3. **?paper= 深链门槛**：`staffIdCard&paper=a4-8up&demo=1`（清 storage）出 toast「纸型与当前模板适配度不足…已保持模板默认排版」，卡面保持 54×86 竖版 3×3（18 人 2 页）不拉伸。![toast](/home/ubuntu/screenshots/r80_3_gate_toast_online.png) ![nostretch](/home/ubuntu/screenshots/r80_3_no_stretch_online.png)　**passed**
4. **ColorField HEX**：并入 #2 —— 390px HEX 框键入 `d62828`（无 #）回车后归一化生效，色块与画布变红。![props](/home/ubuntu/screenshots/r80_2_props_changed_online.png)　**passed**

## Part 2 新角度走查（3 P2）
- **P2-1 模板库搜索与分类筛选状态冲突（390/概念性与视口无关）**：搜索 `hunli` 时点「考试 31」分类，URL 变 `?q=hunli&cat=exam`、pill 高亮「考试」并展开考试子分类行，但结果仍为跨全部分类的婚礼模板（提示「在全部分类中找到 15 款」）——选中态与结果相互矛盾，易误导（建议：搜索激活时禁用/清空分类 pill，或让分类真正约束搜索范围）。![conflict](/home/ubuntu/screenshots/r80_B_search_cat_conflict_390.png)
- **P2-2 /seating「一键生成对应桌贴」沿用先前模板致大量未映射**：座位表 48 人带入工坊后沿用会话中上一次选择的「工作证」模板，预览卡面「单位 未映射」「部门/职务 未映射」明显破相，与按钮「选模板即可批量输出课桌贴」的预期有断层（建议：该入口跳转时自动切到桌贴类模板或弹推荐）。注记：需会话先前选过非桌贴模板才触发，全新用户默认 standard 不受影响。![unmapped](/home/ubuntu/screenshots/r80_A_studio_preview_unmapped.png)
- **P2-3 教程对比表格 390px 横向滚动后首列不固定**：/guides/online-label-tools-review「对比总表」可横向滚动（可达 SeatMark 列），但滚动后首列「维度」跟着滚出视口，行含义丢失（建议首列 sticky）。![t1](/home/ubuntu/screenshots/r80_C_table_390.png) ![t2](/home/ubuntu/screenshots/r80_C_table_390_scrolled.png)
- 其余正常：/seating 390px 全流程（示例名单 48 人→完全随机/男女混排 toast「已按男女混排」→教师/学生视角→输出区按钮可达，无布局溢出）![seating](/home/ubuntu/screenshots/r80_A_seating_390_output.png)；模板库拼音搜索 `hunli` 命中 15 款婚礼模板、空态文案（「没有匹配…清除搜索条件 / 从空白新建模板」+ 推荐列表）良好 ![empty](/home/ubuntu/screenshots/r80_B_empty_state_390.png)；教程列表/长文 390px 无横向溢出（scrollWidth=clientWidth=380，抽查 label-print-troubleshooting、online-label-tools-review）。

---

# 第 79 轮：本地验证 PR #104（第 78 轮 2 P1 + 2 P2 设计器/纸型修复，dev @ localhost:5174）

**日期**: 2026-08-09　**环境**: 本地 dev server http://localhost:5174（分支 `devin/1786296061-round79-designer-p1s`，commit 5a9a871），CDP 设备仿真 1280×800 / 390×844，clean profile + 清 sessionStorage/localStorage。按约定未录屏，全程截图。
**结论**: **四项修复（P1-1 添加字段菜单 Teleport、P1-2 390px 属性面板、P2-1 ?paper= 深链门槛、P2-2 ColorField HEX 输入）全部通过，无阻断项。**

## P1-1 「+ 添加字段」菜单（Teleport 到 body）
- 1280px：点击按钮后菜单真实可见（「常用考务字段」列表），elementFromPoint(菜单中心) 命中菜单内元素；点击预设「姓名（带标签名）」字段 2→3、画布出现新字段；外点关闭、**Esc 关闭**均生效。![menu1280](/home/ubuntu/screenshots/r79_1_menu_1280.png) ![added](/home/ubuntu/screenshots/r79_1_field_added.png) ![esc](/home/ubuntu/screenshots/r79_1_menu_esc_closed.png)
- 390px：菜单在视口内完整可见，点「姓名（带标签名）」成功添加（卡面出现「姓名 张同学」）。![menu390](/home/ubuntu/screenshots/r79_1_menu_390_visible.png) ![added390](/home/ubuntu/screenshots/r79_1_menu_390_added.png)
- 第 78 轮 FAIL 行为（箭头翻转但菜单被 overflow 裁切不可见）不再复现。**passed**

## P1-2 390px 属性面板（头部切换按钮）
- 390px 设计器头部属性按钮始终可见，点击后属性面板滑入视口（「字段属性·座位号」「字号 (pt)」「X (mm)」全部可见）。![panel](/home/ubuntu/screenshots/r79_2_panel_390_open.png)
- 真实键盘修改：字号 28→36、X 2→10、HEX 键入 d62828 → 画布「12」变大变红并右移，属性面板色块变红显示 #D62828。![canvas](/home/ubuntu/screenshots/r79_2_canvas_390_changed.png)
- 1280px 回归：双栏布局正常，属性面板常驻右侧。![desktop](/home/ubuntu/screenshots/r79_2_desktop_two_col.png)　**passed**

## P2-1 ?paper= 深链适配门槛
- a) `/studio?template=staffIdCard&paper=a4-8up&demo=1`（清 storage）：toast「纸型与当前模板适配度不足：『A4 8格不干胶（2 列 × 4 行）』与本模板适配度：勉强，已保持模板默认排版」；卡面保持 54×86 竖版 3×3（18 人 2 页），无第 78 轮的横向拉伸。![gate](/home/ubuntu/screenshots/r79_3a_gate_toast.png)　**passed**
- b) `/studio?template=standard&paper=a4-24up-round&demo=1`：正常锁定纸型，DOM 核实 63.5×33.9、3 列 × 8 行（24 枚/页），26 人 2 页。![applied](/home/ubuntu/screenshots/r79_3b_fit_applied.png)　**passed**
- c) 纸型选择器评级抽查：weddingPlace 下拉中「A4 10格不干胶（2 列 × 5 行）」仍标「推荐」，宽高比门槛未造成异常降级。![sel](/home/ubuntu/screenshots/r79_3c_selector_recommended.png)　**passed**

## P2-2 ColorField HEX 文本输入（真实键盘键入）
- `#D62828` + 回车 → 色块与画布字段变红。![red](/home/ubuntu/screenshots/r79_4_hex_red.png)
- `0a0` + 回车 → 归一化 #00AA00，字段变绿。![green](/home/ubuntu/screenshots/r79_4_hex_0a0.png)
- `zzz` + 回车 → 回退显示上一个合法值 #00AA00，颜色不变。![revert](/home/ubuntu/screenshots/r79_4_hex_invalid_revert.png)
- 原生取色器仍在（`input[type=color]` 覆盖于色块之上，DOM 核实）。**passed**

注记：390px 颜色修改用的即是新 HEX 框（无 # 前缀 6 位输入亦被接受并归一化），与 P2-2 交叉印证。

---

# 第 78 轮：线上抽查 #103 四个 P2 + 新角度走查（纸型库套打 / 自定义模板设计器，www.seatmark.cn）

**日期**: 2026-08-09　**环境**: 线上（bundle `index-Cdn01mzs.js`，含 #103；清 SW/caches 后核实），CDP 设备仿真 390×844 / 1280×800，PDF 用 pdftoppm 150dpi 栅格检查。
**结论**: **Part 1 四个 P2 线上抽查全部通过；Part 2 走查发现 2 个 P1 + 2 个 P2 新问题。**

## Part 1：#103 四个 P2 线上抽查（全部 passed）
- **P2-1**：390px weddingPlace 页视图横向滚动两端可达（scrollLeft 0→482=max），第 2 列完整可见 ![left](https://app.devin.ai/attachments/002723b5-2354-4365-b97f-28ca0f8bac1d/r78_1_left_end.png) ![right](https://app.devin.ai/attachments/522c4841-158a-4c6b-a9c3-d3e2c6a0956d/r78_1_right_end.png)
- **P2-2**：390px「图片 PNG」弹窗底部「登录后无水印导出每天 3 次…」完整可见于视口内 ![dlg](https://app.devin.ai/attachments/e069f615-df1b-4a91-a3f9-974f97e9732c/r78_2_dialog_390.png)
- **P2-3**：standard / weddingPlace 带水印图片版 PDF 栅格放大，水印与准考证号行 / 桌号徽章均留可见间隙无重叠 ![std](https://app.devin.ai/attachments/247ca994-0f8e-4fd0-b337-85781444de05/r78_3_std_crop.png) ![wed](https://app.devin.ai/attachments/b29aaa1a-5f6e-464a-991b-f93fabcddea9/r78_3_wed_crop.png)
- **P2-4**：教程 CTA「一键载入『工作证』模板 + 演示数据」→ staffIdCard 竖版工作证，姓名/部门/职务/工号逐卡映射，无「EXAM PASS」 ![staff](https://app.devin.ai/attachments/23a607bb-6614-4ecd-98ff-4a17fc6828e4/r78_4_staffIdCard_online.png)

## Part 2：走查问题清单（P0 无）
- **P1-1 设计器「+ 添加字段」下拉菜单被工具栏完全裁切（桌面与移动均复现）**：TemplateDesigner 工具栏容器 `overflow-x-auto`（计算样式 overflow-y 也变 auto），下拉菜单（208×320，DOM 中 open、opacity 1）整个被裁切不可见，elementFromPoint 命中底层面板——用户点「+ 添加字段」只见箭头翻转、菜单永远不出现，**无法通过 UI 添加任何字段**（复制 Ctrl+D 是唯一变通）。修复方向：菜单 teleport 到 body 或工具栏去掉 overflow-x-auto。 ![clip](https://app.devin.ai/attachments/bd1e1cfe-ce3a-4892-8b99-6fee41e24c10/r78_B_addfield_clipped_full.png) ![zoom](https://app.devin.ai/attachments/6903670b-701e-4372-b421-e517fdd17dd6/r78_B_addfield_clipped_zoom.png)
- **P1-2 390px 设计器右侧「字段属性」面板完全不可达**：设计器 fixed 容器内容宽 678 > 视口 390 且 overflow visible、页面 scrollWidth=390——属性面板位于 x=407 之外，无横向滚动、无折叠入口，移动端**无法编辑字号/颜色/位置**。 ![m](https://app.devin.ai/attachments/bebc5265-2ed0-49ee-a053-da6646c613f2/r78_B_designer_390_no_panel.png)
- **P2-1 /studio?paper= 纸型深链无适配度门槛**：StudioView.vue L122-128 对 URL paper 直接 applyLabelPaper，不做 evaluatePaperFit（第 76 轮 #102 门槛只在模板切换路径）。实测 staffIdCard（54×86 竖版）+ ?paper=a4-8up（105×74.25）被直接应用，卡面横向拉伸变形，仅有 toast「已按纸型锁定排版」，无适配度警告；且该纸型经 localStorage 持久化，后续加载其他模板继续沿用。 ![stretch](https://app.devin.ai/attachments/1213b9da-841f-40f5-9166-7e007c433a52/r78_A_staff_stretched.png)（对照正常竖版工作证见 Part 1 P2-4 图） ![no-warn](https://app.devin.ai/attachments/fcda1c9a-4bea-418d-b7f2-bb83eeb5266b/r78_A_paper_no_warning.png)
- **P2-2 设计器颜色文本不可直接键入**：颜色控件仅原生 `input[type=color]` 色块 + 只读展示的 HEX 文本，无法粘贴/键入品牌色号；建议加可编辑 HEX 输入框。

## Part 2 正常路径（passed）
- /papers 列表与 /papers/a4-8up 详情在 1280 与 390 布局正常、CTA「用这款纸开始制作」链路通畅 ![papers](https://app.devin.ai/attachments/43d01444-0674-4a40-9f7c-e33430d12d8b/r78_A_papers_1280.png) ![detail390](https://app.devin.ai/attachments/278369cb-6281-4606-82b3-6907d84c9460/r78_A_paper_detail_390.png)
- 设计器（1280）：字段选中/属性编辑（字号 26→40pt、颜色 #D62828 生效）、真实拖拽移动（按住中途截图 X/Y 实时更新）、Delete 删除字段、改姓名字段 22pt 后保存——toast「模板已保存，已加入我的模板并应用」，工坊预览按新模板渲染、演示数据逐卡映射 ![red](https://app.devin.ai/attachments/72ddf4c1-5080-4c9c-923a-013ddafb44b4/r78_B_field_40pt_red.png) ![drag](https://app.devin.ai/attachments/c4670e17-3768-4f86-bbe9-40eb512ab8ef/r78_B_drag_mid.png) ![saved](https://app.devin.ai/attachments/15fd1e2c-3a75-426b-afd6-3320d9ed058f/r78_B_saved_applied.png)
- 注记：P1-1 因菜单 UI 不可见，测试中通过 DOM click 变通添加字段以继续验证后续编辑/保存链路；颜色亦经 JS 设值变通（见 P2-2）。

---

# 第 77 轮：本地验证 PR #103（第 75 轮 4 个 P2 清扫，dev @ localhost:5173）

**日期**: 2026-08-09　**环境**: 本地 dev server（分支 `devin/1786293800-round77-p2-sweep`），CDP 设备仿真（390×844 / 1280×800），真实 UI 操作，PDF 用 pdftoppm 150dpi 栅格放大检查，PNG zip 用 PIL diff-bbox 检查。
**结论**: **四个 P2 修复全部通过 + 回归通过，无阻断项。**

- **P2-1（预览横向滚动，390px）**：weddingPlace demo 页视图 100% 缩放（scrollWidth 818 > clientWidth 336）：滚动到最左端第 1 列完整、页左缘可见；滚动到最右端（scrollLeft=482=max）第 2 列王芳/刘洋整卡完整可见——两端均可达，无裁死区（第 75 轮右端不可达）— passed ![left](https://app.devin.ai/attachments/5c441184-0b22-439f-b411-28d7752a69c1/r77_1_left_end.png) ![right](https://app.devin.ai/attachments/0d60338f-ee43-4642-b0b7-bf815eaf147c/r77_1_right_end.png)
- **P2-2（弹窗 dvh 高度，390px）**：「导出图片（PNG）」弹窗底部说明「登录后无水印导出每天 3 次，分享链接每被点开 1 次再得 1 次；同时获得专业版 Beta 限时免费试用。」**完整可见**于视口内，弹窗底缘未超出（第 75 轮被截断）— passed ![dialog](https://app.devin.ai/attachments/1808a3cd-53d3-44f2-be41-ad93f3239d43/r77_2_dialog_390.png)
- **P2-3（水印避让，150dpi 栅格）**：standard 带水印图片版 PDF——水印位于准考证号 2026061001 下方独立一行，有明显间隙不压字段笔画；weddingPlace——水印与桌号徽章右侧留有可见间隙、无重叠（第 75 轮贴叠）；classDoor 抽查——兜底位按最小重叠面积移至**右上角**（底部被班主任行占用），卡内位置合理、无字段覆盖，属新逻辑的预期跳位 — passed ![std](https://app.devin.ai/attachments/f351083b-6d1e-4cae-ac46-9c3bc411d4b8/r77_3_std_label_crop.png) ![wed](https://app.devin.ai/attachments/5415466b-0ac1-4f1e-a086-407ab9804e1e/r77_3_wed_label_crop.png) ![cd](https://app.devin.ai/attachments/6a2e465e-7c5c-4581-b601-31f4c2e695e1/r77_3_classDoor_crop.png)
- **P2-4（教程 CTA→工作证）**：/guides/badge-visitor-card-batch CTA 文案「一键载入『工作证』模板 + 演示数据」→ 落地 /studio?template=staffIdCard&demo=1，卡面为竖版工作证（单位顶条/照片位/姓名/部门/职务/工号逐卡映射：张伟·技术部·首席技术官·HZ1001…），无「考试出入证 EXAM PASS」字样 — passed ![cta](https://app.devin.ai/attachments/90fb92e5-3a1c-42bc-b13a-c8cfb67a5225/r77_4_guide_cta.png) ![staff](https://app.devin.ai/attachments/35c5a437-195c-41bc-92c0-5fb20a209375/r77_4_staffIdCard.png)
- **Regression**：390px weddingPlace 逐张带水印 PNG 18 张全部 1063×614 零空白、首张水印与徽章有间隙 — passed ![png](https://app.devin.ai/attachments/02526775-a2fd-4cc5-9caa-2785de8a8c65/r77_5_png_first.png)；1280 桌面预览仍居中、导出弹窗高度正常 — passed ![center](https://app.devin.ai/attachments/24260792-2a46-46ea-bdbe-45915ed9c72e/r77_reg_desktop_center.png)

---

# 第 76 轮：本地验证 PR #102（第 75 轮三个 P1 修复，dev @ localhost:5173）

**日期**: 2026-08-09　**环境**: 本地 dev server（分支 `devin/1786292508-round76-walkthrough-p1s`），CDP 设备仿真（1280×800 / 390×844），真实 UI 操作，PNG zip / PDF 产物离线像素级检查（PIL diff-bbox）。
**结论**: **A/B/C/D 四组全部通过，无阻断项，三个 P1 均验证闭环。**

- **A（P1-2 纸型残留）**：badge demo 选「A4 4格不干胶（2列×2行）」→ UI 更换模板到婚礼席位卡：toast「已选纸型与新模板适配度不足：…适配度：勉强，已恢复模板默认排版」出现，预览恢复 90×52、2 列 × 5 行 10 枚/页，**无**「勉强」黄色警告残留；随后逐张带水印 PNG 导出 26 张全部 **1063×614（90:52 设计尺寸）**、零空白，非第 75 轮的 1240×1754 拉伸 — passed ![toast](https://app.devin.ai/attachments/483a69b2-7436-4a58-a9a2-7e4d22a50da6/r76_a_fit_toast.png) ![png](https://app.devin.ai/attachments/f22c7bcf-261a-413a-9278-618823e31d2a/r76_a_png1.png)
- **B（P1-1 逐张 PNG 空白/偏移）**：390px 视口婚礼席位卡 18 条演示数据带水印逐张导出 **连跑 3 次**：3 个 zip 各 18 张全部 1063×614、PIL 判定零空白，首张内容居中、seatmark.cn 水印完整不被左缘裁切 — passed ![first](https://app.devin.ai/attachments/a1e30aed-293a-49c0-a934-e04d7865d752/r76_b_run1_first.png)
- **C1（P1-3 演示名单替换）**：session 内先有婚宴演示数据（18 条），再访问 /studio?template=badge&demo=1：名单**替换**为「考场演示数据.xlsx 26 条」，字段映射 4/4，卡面无「未映射」（第 75 轮为保留婚宴数据、映射 1/4）— passed ![replaced](https://app.devin.ai/attachments/35c4ea16-838e-4a50-9bbd-a0819d141a21/r76_c1_demo_replaced.png)
- **C2（自导入名单保护）**：手动上传餐饮门店样例.xlsx（5 条自导入名单）后再访问 demo=1 URL：名单保留（张先生/王先生…5 个标签）+ toast「已保留你当前的名单」出现 — passed ![kept](https://app.devin.ai/attachments/5af4786f-0909-4f3a-89ed-ed567848784c/r76_c2_keep_toast.png)
- **D1 Regression（适配纸型仍沿用）**：weddingPlace 选推荐纸型「A4 10格不干胶（2列×5行）」→ 切到同 90×52 的面试候场号牌：toast「模板已切换…已保留纸型『A4 10格不干胶（2 列 × 5 行）』」— passed ![carried](https://app.devin.ai/attachments/fb063db1-ae87-4846-8d44-19e5b5b623a1/r76_d1_paper_kept.png)
- **D2 Regression（整页导出）**：weddingPlace 带水印图片版 PDF 2 页，页 1 十枚逐卡姓名/桌号正常、每格水印可见、无空白格 — passed ![pdf](https://app.devin.ai/attachments/85bc4f9b-1369-4ca4-8d6f-c5cbc0cfd1de/r76d2-1.png)

注记：P1-1 为间歇性缺陷，3 次复跑通过证明常规路径稳定；renderAndCutPage 的「空白即重渲/报错」防线属竞态兜底，未能在本地人工触发原始空白竞态（第 75 轮线上仅出现过一次），该防线逻辑以单测（292 tests）与代码路径为准。

---

# 第 75 轮：线上体验走查（无特定 PR，www.seatmark.cn）

**日期**: 2026-08-09　**环境**: 线上 https://www.seatmark.cn ，CDP 设备仿真三视口（390×844 mobile / 1280×800 desktop / 768×1024 tablet），全程真实 UI 操作，导出产物（PNG zip / PDF）离线像素级检查。
**结论**: 三条路径均走通，但发现 **3 个 P1、4 个 P2** 新问题；无 P0。

## 问题清单

### P1
- **P1-1 逐张 PNG 导出出现空白图片与内容偏移（间歇性）**：390px 首次「婚礼席位卡 demo=18 条 → 带水印图片 PNG」导出的 zip（1606，18 张 1063×614）中 **002/004/006/008/010 共 5 张纯白空图**，且第 1 张内容整体左移、桌号徽章与 seatmark.cn 水印被左边缘裁切。随后两次复测（换纸型前后）均 18 张正常，未能再现——间歇性但产物损坏用户难以察觉，建议排查逐张 canvas 渲染竞态。![blank/offset](https://app.devin.ai/attachments/eede1674-3b33-4b50-a988-79dde172ca64/r75_m_png_full.png) 正常对照：![ok](https://app.devin.ai/attachments/b8be4754-7f91-423b-a2ef-3fb388ff795e/r75_m_png3_full.png)
- **P1-2 纸型设置跨模板残留 + 逐张 PNG 按纸型单格成图**：在出入证模板改过纸型（A4 4格）后，即使清 sessionStorage 重新进入 `?template=weddingPlace&demo=1`，仍沿用 A4 4格，入口即弹「适配度：勉强」长警告（390px 下挤成窄列、可读性差）；且此时逐张 PNG 尺寸=纸型单格 105×148.5mm（1240×1754 竖版）而非模板设计尺寸 90×52mm，成图严重拉伸留白。建议：切换模板时纸型跟随模板推荐值，逐张 PNG 恒按设计尺寸成图。![warning](https://app.devin.ai/attachments/581987ba-dd68-413d-a5bf-b34b203dd059/r75_m_paper_warning.png) ![stretched](https://app.devin.ai/attachments/6ef10ce6-0fd1-4026-b6c9-079bd1067a89/r75_m_png2_full.png)
- **P1-3 教程 quickStart CTA 不替换已有名单**：先体验过婚礼 demo 的会话中，点教程《出入证胸卡批量制作》的「一键载入出入证胸卡版 + 演示数据」，落地 studio 后名单仍是**婚宴数据**（姓名/桌号/新人/日期），字段映射仅 1/4、卡面大量「未映射」，与 CTA 承诺的「先看成品效果」断层。清空会话后同 URL 则正常载入考场数据 4/4。建议：CTA demo=1 且已有数据时提示「替换为演示数据？」。🔴![dirty](https://app.devin.ai/attachments/e82b1774-5611-448a-89a6-1b854e1ad0b7/r75_d_badge_mapping_dirty.png) 🟢![clean](https://app.devin.ai/attachments/bdea8dd1-877d-4991-a46c-929c74f03152/r75_d_badge_clean.png)

### P2
- **P2-1** 390px 预览切「页」视图时页面右侧第二列标签被裁切，需横向拖动才可见，无缩放提示。![clip](https://app.devin.ai/attachments/82c9f46a-27ad-4515-b063-1e311a614175/r75_m_preview_clipped.png)
- **P2-2** 390px PNG 导出弹窗底部「登录后无水印导出每天 3 次…」说明文字在折行中被视口截断，需滚动才能读完整。![dialog](https://app.devin.ai/attachments/8bf7aafb-53e7-453e-9ab7-d6f0aca2ebe2/r75_m_png_dialog2.png)
- **P2-3** 带水印打印/PDF 中，页脚 seatmark.cn 水印与标签底部内容（准考证号行、婚礼卡桌号徽章）视觉贴近甚至部分重叠。![pdf](https://app.devin.ai/attachments/dfe4151c-2b08-48a8-8022-726bd26bd0a7/r75_d_pdf_watermark_crop.png)
- **P2-4** 教程《出入证胸卡批量制作》主题为员工/访客胸卡，但 CTA 载入的「出入证胸卡版」卡面为「考试出入证 · EXAM PASS」考试字样与考场字段，与教程场景有措辞落差。

## 三条路径结果
- 路径 1（390px 手机）首页→模板库搜「婚礼」→详情→一键开始→演示数据→带水印 PNG：整体走通，首页/详情/三步引导在 390px 布局良好，caption 前缀可读；配额文案（无水印今日剩余 N 次/带水印不限次）清晰 — passed（除 P1-1/P2-1/P2-2）![detail](https://app.devin.ai/attachments/194ab36f-11de-4c29-8bc9-8189185cddd6/r75_m_wedding_detail.png)
- 路径 2（1280px 桌面）教程 badge-visitor-card-batch→quickStart→单张覆写改名「测试改名」→换纸型（纸型库 A4 4格）→打印/矢量 PDF（带水印）：PDF 产物核实含改名、caption、页脚水印 — passed（除 P1-3/P2-3/P2-4）
- 路径 3（768px 平板）/seating 载入示例 48 人→随机排座→打印座位表：布局无溢出，打印 toast 提示可见，PDF 座位表 48 人 6×8 完整、讲台/页脚信息正常 — passed ![seatpdf](https://app.devin.ai/attachments/252f8112-212b-49ee-86c4-a9d959495faa/r75_t_seating_pdf.png) ![preview](https://app.devin.ai/attachments/d8a71248-8ecb-4598-95dc-69efc3bbfb0d/r75_t_print_preview.png)

---

# 第 74 轮：线上回归 PR #97（caption 迁移，www.seatmark.cn）

**日期**: 2026-08-09　**环境**: 线上 https://www.seatmark.cn ；清 SW/caches（1 SW + 1 cache）后核实实际加载**新 bundle `index-19L6DgAq.js`**；方法同第 72 轮（未导入样例看 /templates/<id> 详情页整卡，映射后 demo=1 清 sessionStorage，`.label-field__caption` + 截图双判据）；全程录屏。
**结论**: **四组抽查全部通过，无阻断项**，与第 72 轮本地结果一致。注：#98/#100 同义词自动映射尚未上线，wardBed demo 开箱自动匹配仍命中合成常量列（全「程医生/苏护士」）属**预期**，手动改映射后验证通过。

- wardBed：详情页样例「主管医生 程医生」「责任护士 苏护士」；demo=1 手动改映射 医生/护士 列后前缀保留、姓名逐卡变化（王医生/李医生/赵医生…；刘护士/陈护士/杨护士…）— passed ![ws](https://app.devin.ai/attachments/52ee276f-4c51-4de4-9da5-15d56a95a839/r74_wardBed_sample_online.png) ![wm](https://app.devin.ai/attachments/239004a1-074a-4007-8f31-f1dae5e0909b/r74_wardBed_mapped_online.png)
- esportsSeat demo=1：「战队 夜枭电子竞技俱乐部 / 赤霄战队 / 星轨电竞」轮转，DOM 断言无「战队 战队：」双前缀（double=false）— passed ![es](https://app.devin.ai/attachments/c8ca362b-fdb9-4507-85a5-5abc69a79f55/r74_esportsSeat_online.png)
- morningCheck：详情页样例「接送人 安爸爸」caption 前缀正常 — passed ![mc](https://app.devin.ai/attachments/30337ac8-539b-4553-a8b0-d92274a378d0/r74_morningCheck_sample_online.png)
- Regression standard demo=1（26 张逐卡）/ deluxeClassChalk demo=1（「班主任 王老师/李老师/张老师」逐卡）均正常 — passed ![sr](https://app.devin.ai/attachments/f89493dc-eb2c-49e9-865e-37e0116743d6/r74_standard_regression_online.png) ![cr](https://app.devin.ai/attachments/ccae2b0e-0811-4729-ac88-7547cbd6be06/r74_classChalk_regression_online.png)

**录屏**: rec-7efeb8a7-9bbd-43a0-b569-51564d7cd038-edited.mp4

## 74b：#100/#101 合入部署后最终口径复测（同日）

清 SW/caches 后核实实际加载**再新 bundle `index-jWA_hbim.js`**（excel chunk `excel-sPrZk6dQ.js` 含「主治医生」同义词，curl 核实）。**开箱（不手动改映射）**：

- wardBed demo=1 开箱：映射面板 **主管医生→医生、责任护士→护士**（5/5 自动匹配）；卡面「主管医生 王医生/李医生/赵医生…」「责任护士 刘护士/陈护士/杨护士…」逐卡变化——不再是常量列 — passed ![wb](https://app.devin.ai/attachments/f9e20041-4fa1-47be-a512-a822a8d3b9c0/r74b_wardBed_outofbox_online.png)
- morningCheck demo=1 开箱：映射面板 **接送人→家长**（3/3）；「接送人 张伟/王芳/李娜…」逐卡变化 — passed ![mc](https://app.devin.ai/attachments/f8ec2897-0a38-4bcd-a14c-7f7dd0e56b37/r74b_morningCheck_outofbox_online.png)
- esportsSeat demo=1（新 bundle 复测）：「战队 夜枭/赤霄/星轨」轮转、无双前缀（double=false）— passed ![es](https://app.devin.ai/attachments/0c470006-e619-490c-85ae-f85b8c1395a3/r74b_esportsSeat_online.png)
- Regression standard / deluxeClassChalk（新 bundle 复测）均正常 — passed ![sr](https://app.devin.ai/attachments/6758d170-22c1-43e6-ad8a-e6a88b4aa7c5/r74b_standard_regression_online.png) ![cr](https://app.devin.ai/attachments/93276a25-1d32-41cd-aee6-4f98c6351f89/r74b_classChalk_regression_online.png)

**录屏（最终口径）**: rec-c81c5107-98cd-4b13-a31e-630e93105bb4-edited.mp4

---

# 第 73 轮：本地验证 PR #98（autoMap 同义词补充，demo 开箱逐卡变化）

**日期**: 2026-08-09　**环境**: 分支 devin/1786284943-round73-automap-synonyms（堆叠于 #97，共享工作树），本地 dev server http://localhost:5173；demo=1 开箱、不手动改映射，清 sessionStorage 后 clean 加载，映射面板 + `.label-field__caption` + 截图判据；全程录屏。代码依据：autoMap.ts L22-26（新增 teacher/doctor/nurse/guardian/phone 同义词组）。
**结论**: **四组验证全部通过，无阻断项**。第 72 轮机制性观察（合成常量列被自动匹配命中）至此闭环。

- wardBed demo=1 开箱：字段映射面板显示 **主管医生→医生、责任护士→护士**（真实列，5/5 自动匹配）；卡面「主管医生 王医生/李医生/赵医生…」「责任护士 刘护士/陈护士/杨护士…」逐卡变化（第 72 轮开箱为全「程医生/苏护士」）— passed ![wb](https://app.devin.ai/attachments/02e7c894-30fb-4378-b72c-9411d34c23f2/r73_wardBed_outofbox.png)
- morningCheck demo=1 开箱：映射面板 **接送人→家长**（3/3 自动匹配）；卡面「接送人 张伟/王芳/李娜…」逐卡变化（第 72 轮开箱为全「安爸爸」）— passed ![mc](https://app.devin.ai/attachments/2c9e152a-e141-4ed7-baf7-a5b515b8b7b4/r73_morningCheck_outofbox.png) ![mp](https://app.devin.ai/attachments/3e4a622d-1777-4eb7-a93e-75a0ec9e7145/r73_morningCheck_mapping.png)
- Regression standard demo=1：26 张逐卡（张伟/2026061001/第1考场…）正常 — passed ![sr](https://app.devin.ai/attachments/7e9a39c9-cc0f-4530-b065-389f37843958/r73_standard_regression.png)
- Regression deluxeClassChalk demo=1：「班主任 王老师/李老师/张老师」前缀逐卡正常 — passed ![cr](https://app.devin.ai/attachments/4b76b5c2-81ae-4031-bebe-38cad209d773/r73_classChalk_regression.png)

**录屏**: rec-0612ad92-386a-404e-be88-498ded299a8e-edited.mp4

---

# 第 72 轮：本地抽查 PR #97（55+ 个「前缀：内容」字段统一迁移 caption 机制）

**日期**: 2026-08-09　**环境**: 分支 devin/1786283579-round72-caption-migration（共享工作树），本地 dev server http://localhost:5173；未导入样例看 /templates/<id> 详情页整卡，映射后 demo=1（清 sessionStorage），DOM `.label-field__caption` + 截图双判据；全程录屏。代码依据：defaultTemplatesLife.ts L69-80、defaultTemplatesCampus.ts L1151-1174、defaultTemplatesRound4.ts L669、demoDatasets.ts L308、LabelCard.vue L352。
**结论**: **五组抽查全部通过，无阻断项**。一条机制性观察（非本 PR 缺陷）见下。

- wardBed：详情页样例「主管医生 程医生」「责任护士 苏护士」；demo 自动匹配命中 sampleData 合成常量列（逐卡同名），手动改映射到数据集「医生/护士」列后**前缀保留、姓名逐卡变化**（王医生/李医生/赵医生…）— passed ![ws](https://app.devin.ai/attachments/cb50c17b-ed16-4e23-a5f1-3acca6625707/r72_wardBed_sample.png) ![wm](https://app.devin.ai/attachments/d78e50f8-dae4-443e-a553-7361430bc0bb/r72_wardBed_mapped.png)
- esportsSeat demo=1：卡面「战队 夜枭电子竞技俱乐部 / 赤霄战队 / 星轨电竞」——caption 前缀 + 4 队轮转，**无「战队 战队：xxx」双前缀**（数据集硬编码前缀已去）— passed ![es](https://app.devin.ai/attachments/62b59f57-3695-401c-ac6c-5d21821ecb06/r72_esportsSeat.png)
- Regression techEsportsSeat demo=1：「战队位次」夜枭·上单 / 赤霄·打野 / 星轨·中单 逐卡正常 — passed ![tes](https://app.devin.ai/attachments/aed54b38-56e5-4162-9920-d23e848738a7/r72_techEsportsSeat.png)
- morningCheck（晨检提示卡，接送人 caption）：详情页样例「接送人 安爸爸」；demo 改映射「家长」列后 接送人 张伟/王芳/李娜 逐卡变化、前缀保留 — passed ![ms](https://app.devin.ai/attachments/ee36a1fb-66e6-4c01-a053-cf03f1eca0f1/r72_morningCheck_sample.png) ![mm](https://app.devin.ai/attachments/3fa802bc-938b-452d-bbf3-c5307d274fa2/r72_morningCheck_mapped.png)
- Regression standard / deluxeClassChalk（#96 已合入）demo=1：26 张逐卡数据正常；「班主任 王老师/李老师」前缀逐卡正常 — passed ![sr](https://app.devin.ai/attachments/8425c118-4462-4f71-b9d2-e8402439fd87/r72_standard_regression.png) ![cr](https://app.devin.ai/attachments/fcfc1744-2ff4-48ef-80a9-97438c3604e1/r72_classChalk_regression.png)

**机制性观察（既有行为，非本 PR 缺陷）**：demo 数据表会把模板 sampleData 中数据集缺失的字段合成为**常量列**（如 wardBed 的「主管医生=程医生」、morningCheck 的「接送人=安爸爸」），自动匹配优先命中同名合成列导致逐卡同值；改映射到真实列（医生/护士/家长）即逐卡变化。若希望 demo 开箱即逐卡不同，可考虑给医院/幼儿园数据集补真实的主管医生/责任护士/接送人列。

**录屏**: rec-8f2d7cb4-8b9e-4c66-af64-c71de2bd064c-edited.mp4

---

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
