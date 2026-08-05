# 第三轮收录进展报告（2026-08-05）

> 核验方式：浏览器逐一执行 `site:seatmark.cn` 查询（2026-08-05 15:0x UTC，即北京时间 23:0x）。
> 上轮基线见 `../seo-indexing-report-2026-08-05.md`（当日早间）。证据截图存 `evidence/`。

## 收录快照（与上轮对比）

| 引擎 | 上轮（08-05 早） | 本轮（08-05 晚） | 变化 | 证据 |
|---|---|---|---|---|
| 百度 | 无法核验（安全验证） | **约 1 个**（首页已收录，标题/描述正常展示） | ✅ 首次确认收录 | `evidence/baidu-site-query-2026-08-05.png` |
| Google | 未测 | **1 个**（首页已收录） | ✅ 新基线 | `evidence/google-site-query-2026-08-05.png` |
| 必应 Bing | ~0 | **已收录**（`www.seatmark.cn/guides` 教程中心出现在结果首位；总数字含无关兜底结果不可信，实际有效收录 ≥1） | ✅ 从 0 到有 | `evidence/bing-site-query-2026-08-05.png` |
| 搜狗 | 0 | **约 5 条**（首页已收录；经 m.sogou.com 核验，PC 端触发验证码） | ✅ 从 0 到 5 | `evidence/sogou-site-query-2026-08-05.png` |
| 360 搜索 | 0 | **0**（明确返回"未找到相关搜索结果"） | ➖ 无变化 | `evidence/360-site-query-2026-08-05.png` |

**结论**：冷启动已破冰——百度/Google/搜狗/Bing 四家均已收录首页级页面，但 238 条 URL 中被收录的仍是个位数。收录深度（教程页/模板页长尾）是下一阶段核心瓶颈，最大杠杆仍是「百度站长平台验证 + API 推送」（人工 P0）。360 需站长平台提交（需账号）。

## IndexNow 全量推送回执（本轮已执行）

从 main 构建产物 `dist/sitemap.xml` 提取全部 **238 条 URL**（任务描述中的 284 条与实际不符——当前 main 构建即 238 条，线上 sitemap 同为 238 条），单次 POST 推送至各 IndexNow 端点：

| 端点 | HTTP 状态 | 结论 |
|---|---|---|
| `https://www.bing.com/indexnow` | **200** | ✅ 接收成功（Bing/Copilot） |
| `https://yandex.com/indexnow` | **202** `{"success":true}` | ✅ 接收成功 |
| `https://search.seznam.cz/indexnow` | **200** | ✅ 接收成功 |
| `https://searchadvisor.naver.com/indexnow` | **200** | ✅ 接收成功 |
| `https://api.indexnow.org/indexnow` | 403 `SiteVerificationNotCompleted` | ⚠️ 聚合端点仍在校验 key 文件，等待生效即可（key 文件线上可访问已核验）；不影响上面四个直连端点 |

推送 payload：`host=www.seatmark.cn`，key `f04fd03b147f6e5178d97e8e20770a6d`（线上 `https://www.seatmark.cn/f04fd03b147f6e5178d97e8e20770a6d.txt` 返回 200，内容一致，已核验）。

复现命令（后续每次发新页面后重跑一次即可）：

```bash
python3 - <<'EOF'
import re, json, urllib.request
xml = urllib.request.urlopen('https://www.seatmark.cn/sitemap.xml').read().decode()
urls = re.findall(r'<loc>(.*?)</loc>', xml)
payload = json.dumps({
  "host": "www.seatmark.cn",
  "key": "f04fd03b147f6e5178d97e8e20770a6d",
  "keyLocation": "https://www.seatmark.cn/f04fd03b147f6e5178d97e8e20770a6d.txt",
  "urlList": urls,
}).encode()
for ep in ["https://www.bing.com/indexnow", "https://yandex.com/indexnow", "https://api.indexnow.org/indexnow"]:
    req = urllib.request.Request(ep, payload, {"Content-Type": "application/json; charset=utf-8"})
    try:
        print(ep, urllib.request.urlopen(req).status)
    except urllib.error.HTTPError as e:
        print(ep, e.code, e.read().decode()[:120])
EOF
```

## 免登录提交入口执行情况

| 入口 | 结果 |
|---|---|
| IndexNow（Bing/Yandex/Seznam/Naver） | ✅ 已推送 238 条（见上） |
| 360 匿名提交 `info.so.com/site_submit.html` | ❌ 强制跳转 360 账号登录（与上轮一致），转人工清单 |
| 百度普通收录 | ❌ 需站长平台验证 + token，转人工清单（P0） |
| Google | 无匿名提交口，需 Search Console 验证，转人工清单 |

## 复查记录（时间序列）

| 日期 | 百度 | Bing | 360 | 搜狗 | Google | 备注 |
|---|---|---|---|---|---|---|
| 2026-08-05 早 | 待核验 | ~0 | 0 | 0 | — | 上轮基线 |
| 2026-08-05 晚 | ~1 | ≥1（/guides） | 0 | ~5 | 1 | 本轮；IndexNow 全量 238 条已推送 |
