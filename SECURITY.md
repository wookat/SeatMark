# 安全政策

## 支持的版本

SeatMark 座签是持续部署的在线服务（https://www.seatmark.cn），
仅 `main` 分支对应的线上版本接受安全维护。

## 报告安全漏洞

**请勿在公开 Issue 中披露安全漏洞。**

如发现安全问题（如 XSS、依赖漏洞、数据泄露风险等），请通过以下方式私下报告：

1. 优先使用 GitHub 的 [Private Vulnerability Reporting](https://github.com/wookat/SeatMark/security/advisories/new)（Security → Report a vulnerability）；
2. 或通过官网 https://www.seatmark.cn 站内「反馈」入口留下联系方式，注明「安全问题」。

报告请尽量包含：漏洞描述、复现步骤、影响范围评估与建议修复方案。

我们会在 72 小时内确认收到，并在评估后尽快修复。修复发布前请勿公开披露细节。

## 安全设计说明

- 用户上传的 Excel 名单与照片全部在浏览器本地处理，不经过服务器，
  服务端不存储任何用户数据。
- 站点为纯静态托管（腾讯 EdgeOne Pages），无后端与数据库。
- 可选的 AI 设计与反馈功能经 Edge Function 同源代理转发，密钥仅存放于
  平台环境变量，不出现在前端代码中。
