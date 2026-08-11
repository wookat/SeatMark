# 第 221 轮：浏览器历史导航与状态完整性走查

代码依据：/templates 筛选状态同步 route.query（TemplatesView.vue:21-41，cat/sub/q 参数）+ 后退恢复滚动位（router/index.ts:114-127 savedPosition 双 rAF）；SPA 弹窗**无** popstate/history 集成（全库 grep popstate/pushState 0 命中）→ 弹窗开着按后退预期是路由级后退（弹窗随视图卸载），判据聚焦名单是否保留；名单会话持久化 sessionStorage `seatmark.workspace-roster.v1`（workspace.ts:171）+ pinia 内存（SPA 内后退不销毁 store）；模板选择持久化 localStorage `seatmark.workspace-template.v1`；分享短链消费 App.vue:44-54（?s= → fetchSharedPayload → router.replace('/studio'+#tpl=)）；/seating 状态 localStorage `seatmark.seating-state.v1`。

夹具：3 行名单「历史审计孙一221/钱二221/李三221」（xlsx 复用 r218 方法生成新文件 r221_roster.xlsx）。

## T1 /studio 导入+改模板 → 后退 → 前进
- / → /studio（SPA 点导航建历史）→ 导入 xlsx → 模板切换（点另一模板卡）→ history.back() → 断言回 /（无白屏，body 有 Hero 文案）→ history.forward() → 断言回 /studio 且数据表仍「共 3 条」、预览含「历史审计孙一221」、所选模板保持切换后的 — 全部具体值断言+截图。

## T2 /templates 深度状态回归（#79 口径）
- /templates → 搜索框键入「桌牌」→ 点一个分类 → 滚动到中部（记录 scrollY>300）→ 点进模板详情 → history.back() → 断言 URL 含 q=桌牌 与分类参数、搜索框值=桌牌、分类高亮、scrollY 恢复（±100px）；截图。

## T3 导出对话框开着按后退
- /studio（含名单）打开「图片 PNG」导出对话框 → history.back() → 如实记录：弹窗关闭留在 /studio 还是整页跳走；再回 /studio 断言名单仍在（「共 3 条」）。若名单丢失 → 定级。

## T4 /seating 排座后 后退→前进
- /seating 粘贴名单+完全随机 → back → forward → 断言排座结果保持（网格与随机后一致，localStorage arranged 不变）。

## T5 分享长链页后退
- 打开 `/studio#tpl=v1.xxx`（本轮由「复制分享链接」生成的真实链接，直接 nav）→ 导入确认流程如实记录 → 从该页 back → 断言不卡死/不循环重定向、pageerror=0。

## T6 刷新中断导出
- /studio 名单+点带水印 PNG 导出（多页демо或 3 行小名单，点击后立即 F5/Page.reload）→ 恢复后断言：页面正常渲染、名单仍在（sessionStorage 恢复）、无残留 loading 遮罩/禁用态、可重新导出成功（下载完成事件）。

## T7 收尾
- 全程 pageerror=0；清 storage + 关全部 tab；第 221 轮置顶追加 test-report.md（基于最新 main）。
