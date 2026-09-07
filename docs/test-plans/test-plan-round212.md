# 第 212 轮：AI 设计免费通道复测（#214/#215 上线后）

代码依据：edge-functions/api/ai-design.js:27-28/161-189（无密钥时服务端代理 Pollinations openai/openai-fast，全败返回 502 `AI 服务暂时不可用…（透出上游错误码）`）；前端回退链不变 aiDesign.ts:240-258（/api/ai-design → 浏览器直连 pollinations openai → openai-fast，全败「免费通道暂时繁忙（…）」）。前端 bundle 无改动（entry 仍 index-zn4iqgIG.js，#214/#215 仅边缘函数）。

环境预查：本机 curl 直连 pollinations（带浏览器 UA+Origin）刚实测 **402**，与 lead 所述「稳定 200」矛盾 → 可能间歇性限流，浏览器实测为准，两种结果都要如实记录。

## T1 免费通道真实 UI 重测
- 新 tab → 清 localStorage `seatmark.ai-config` → /studio?design=new → 「AI 自动设计」→ 填「正式考务桌贴，姓名大字+考场/座位号」→ 页内 fetch 钩子记录状态码与响应体 → 点「生成设计」。
- 断言（分支 A 成功）：/api/ai-design 502（约 30s，响应体含上游 402 透出文案）→ 浏览器直连 pollinations 某档 200 → toast「AI 设计已生成」、弹窗关闭、画布渲染出字段；属性面板抽查字段几何/字号在合法范围（x≥0、宽≤画布、字号 4-120）；pageerror=0。
- 断言（分支 B 仍 402）：三次请求 502/402/402；记录 402 响应体全文（是否 legacy deprecation 文案）；最终错误「免费通道暂时繁忙（…）」、不白屏、可重试。
- 额外核验 /api/ai-design 响应体是否含 #215 的上游错误码透出（对比 r209 的裸 501）。

## T2 收尾
- pageerror=0；清 storage + 关闭全部测试 tab；第 212 轮置顶追加 test-report.md（main 工作树，不提交）。
