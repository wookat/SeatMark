# 第 308 轮：PR #315 五处 UI 小改生产复测（www.seatmark.cn）

代码依据（d3ae60a→origin/main 7fdb154 diff）：
- PreviewArea.vue L1355：带水印导出说明改「每张标签底边叠加细线签名式品牌水印（细线 + seatmark.cn 小字，配色随模板自适应），不遮挡姓名等核心内容」；L1009 导出角标 `-top-2.5 -right-2 … ring-1 ring-white`。
- TemplatesView.vue L195：placeholder=「搜索模板 / 场景，支持拼音、首字母」（删长版含 jkz）。
- PricingView.vue L145-152：badge `rounded-full … whitespace-nowrap shadow-sm`，带徽章卡 `pt-7`。
- AccountView.vue L450-453：未登录配额提示 `mx-auto mt-6 max-w-md rounded-lg bg-slate-100 px-4 py-2.5`。

部署门槛：生产 StudioView chunk 含「细线签名式」且「徽章式」0 命中（当前 index-CkHzKmPK.js 时代仍旧版，等待新 bundle）。本轮未改边缘函数，Rev 头不变。全程匿名。

## T1 导出弹窗新文案（1280）
- /studio?demo=1 依次打开 图片 PNG / 图片版 PDF / 打印 三个导出弹窗，看「带水印导出」说明。
- PASS：三处均为「底边叠加**细线签名式**品牌水印（细线 + seatmark.cn 小字…）」；「徽章式」「座位格标记」字样 0 出现。旧文案残留=FAIL。

## T2 模板库 placeholder（390）
- /templates 390 设备模式看搜索框。
- PASS：placeholder 完整显示「搜索模板 / 场景，支持拼音、首字母」不截断（无“如”后被切）。1280 同文案。

## T3 定价页徽章（390+1280）
- /pricing 双宽度看专业版/团队版顶部徽章。
- PASS：徽章胶囊形（rounded-full）单行不换行；卡片 pt-7 后徽章不压卡内标题、与顶部描边间距正常；390 不溢出。

## T4 账户页信息条（390+1280）
- /account 未登录底部提示。
- PASS：呈浅灰圆角信息条（bg-slate-100，居中 max-w-md），非裸文本；双宽度不溢出。

## T5 工坊导出角标（1280）
- /studio?demo=1 匿名看「图片版 PDF」按钮右上「今日剩余 1 次」角标。
- PASS：角标外移（-top-2.5/-right-2）且带白描边 ring，与按钮文字不再紧贴（对比 r306 截图 r306_ui_studio_1280 局部）。

## 硬判据与收尾
- 上述各页 390/1280 `scrollWidth ≤ innerWidth`、window error=0。
- 发现回归标 P 级；截图留存；报告置顶第 308 轮（简短）；结束清浏览器状态。
