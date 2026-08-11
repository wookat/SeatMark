# 第 225 轮：#226 哨兵方案弹窗返回键拦截三测（生产）

代码依据：ModalDialog.vue:1-52（#226 重写）——打开时 `pushState({...当前state, seatmarkModalDepth: openStack.length}, '', 同URL)`；popstate 落到 depth<openStack.length 的条目时关顶层弹窗（vue-router 因 state 含原 position 视为原地不动）；Esc/遮罩/程序关闭时若当前条目仍是本弹窗哨兵则 history.back() 回收；无 router 守卫。
判据核心=与 r223 失败形态对照：后退时【URL 仍 /studio + 弹窗关 + 名单在】。

## T0 部署确认
- 轮询 entry 翻转离开 `index-DvH8Q9XM.js`，且新 bundle 含 `seatmarkModalDepth`。

## T1 单层弹窗后退（两通道，核心）
- /（点链接）→ /studio 导入 3 行名单 → 开「图片 PNG」弹窗 → 断言 history.state 含 seatmarkModalDepth=0…实际值取证 → history.back()：弹窗关、URL 仍 /studio、「共 3 条」在、history.state 恢复无哨兵 → 再 back：真正离开到 /。重复一次用 CDP Page.navigateToHistoryEntry 原生返回通道验证（注意原生通道 entries 会多一条同 URL 哨兵条目，取当前-1）。截图弹窗态/关后态。

## T2 叠层弹窗逐层关
- 运行时探索两层 ModalDialog 可叠路径（候选：侧栏「浏览全部 N 款模板」+「微信扫码打开」）；可叠则连续 back 断言第一次只关顶层（底层 dialog 数-1）、第二次关底层且 URL 仍 /studio、第三次离开。无稳定路径则 untested 如实记录。

## T3 Esc/遮罩关后哨兵回收
- 开弹窗 → Esc：弹窗关且 history.state 无 seatmarkModalDepth（哨兵被 back 回收）→ 一次 back 即离开 /studio（不多跳）。遮罩点击同法验证一遍。

## T4 弹窗内站内链接
- 置配额 used=1 → 配额弹窗 → 点 /account 链接：正常跳转；随后 back 的落点如实取证（哨兵是否残留在历史，#226 特有风险⑥）。

## T5 前进键行为（#226 特有风险）
- 开弹窗 → back 关弹窗 → history.forward()：如实记录（预期落回哨兵条目：URL 不变、弹窗不重开、无 pageerror；若出现异常态则定级）。

## T6 回归
- 无弹窗 back/forward /studio↔/ 名单保持；/templates `?cat&q` 返回保状态+scrollY。

## T7 收尾
- 全程 pageerror=0；清 storage + 关全部 tab；第 224（代码轮）/225 轮置顶追加 test-report.md。
