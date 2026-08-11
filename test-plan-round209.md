# 第 209 轮：设计器「AI 设计」全链路走查（报告记为 test-report.md 第 209 轮）

代码依据：入口 TemplateDesigner.vue:1402「AI 自动设计」按钮 → AiDesignDialog.vue（fieldsText/requirements/宽高，generate() 调 generateLabelDesign）；通道 aiDesign.ts:240-261（free：/api/ai-design → pollinations openai → openai-fast，各 90s 超时；全败报「免费通道暂时繁忙（…）」:258）；自定义通道 :211-232（TypeError→「无法连接 AI 接口：请检查接口地址与网络…」:228）；clamp :294-356（x/y/width/height 限画布内、fontSize 4-120、lineHeight 0.8-3、maxLines 1-6、颜色 hex 校验）；应用 TemplateDesigner:1041-1066（toast「AI 设计已生成」）。设计器入口：/studio?design=new。

**环境预查（setup 已证）**：生产 POST /api/ai-design = **501**（EdgeOne 环境变量未配置）；text.pollinations.ai/openai 匿名 = **402 Payment Required**（旧接口对匿名弃用）→ 免费通道预期全败。可用密钥核查：DEEPSEEK_API_KEY/DEEPSEEK_KEY 均「Insufficient Balance」、LLM_RELAY_API_KEY 对 api.aicdks.com 无效 → **无任何可用真实通道**，成功路径（生成→clamp→应用→保存→导出）改用 CDP Fetch 拦截 stub /api/ai-design 返回（含越界值的对抗 JSON），如实标注为 stub 验证前端管线。

## T1 免费通道真实行为（生产、无 stub）
- /studio?design=new → 点「AI 自动设计」→ 弹窗打开（默认字段文本预填）→ 填设计要求「正式考务桌贴，姓名大字+考场/座位号」→ 点生成。
- 断言：Network 依次出现 POST /api/ai-design（501）→ POST text.pollinations.ai/openai ×2（记录状态码）；最终 UI 错误文案含「免费通道暂时繁忙」；不白屏、弹窗仍可交互可重试；截图。
- 隐私断言（用户第 4 点）：抓 /api/ai-design 请求 payload 全文——仅含 messages（system prompt + 字段示例/要求/画布尺寸），**不含名单数据**（提前在 /studio 导入含「甲乙丙」独特姓名的名单再进设计器，payload 中 0 处出现）。

## T2 自定义 API 失败路径（真实）
- 切「自定义 API」，填无效地址 https://invalid.seatmark-test.example/v1 + 任意 key/model → 生成。
- 断言：错误文案=「无法连接 AI 接口：请检查接口地址与网络（接口未开放浏览器跨域时也会失败）」；不白屏；再点生成可重试（loading 态再现）。

## T3 成功路径（CDP Fetch stub /api/ai-design，如实标注）
- stub 返回 choices[0].message.content 为对抗 JSON：字段含越界 x=-5、width=999、fontSize=300、lineHeight=9、maxLines=99、非法色 "red"、重复 id。
- 断言（clamp 逐项）：应用后 designer store 中该字段 x≥0、x+width≤画布宽、fontSize≤120、lineHeight≤3、maxLines≤6、非法色被丢弃、id 去重；toast「AI 设计已生成」；预览画布渲染出字段（截图）；保存为自定义模板成功；用该模板整页 PNG 导出成功（下载事件 + zip 非空页）。
- 注：此项证明的是前端 parse/clamp/apply/save/export 管线，不能证明线上任何 AI 通道可用（T1 已证不可用）。

## T4 收尾
- 全程 pageerror 0；清 storage + 关闭全部测试 tab；报告置顶追加 test-report.md「第 209 轮」（main 工作树，不提交）。

预期升级项：免费通道在生产**全链路不可用**（501+402+402）→ 用户可见即「免费通道暂时繁忙」，属 P2 候选（功能宣称开箱即用但实际不可用），执行中确认后立即回报。
