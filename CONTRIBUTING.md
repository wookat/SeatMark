# 贡献指南

感谢你对 SeatMark 座签的关注！我们欢迎 Issue 反馈与 Pull Request 贡献。

> 注意：本项目采用专有许可证（见 [LICENSE](LICENSE)）。提交贡献即表示你同意
> 将该贡献授权给项目版权持有人使用（含商业使用）。

## 开发环境

- Node.js ≥ 20，npm ≥ 10
- 前端应用位于 `app/` 目录

```bash
cd app
npm install
npm run dev       # 开发服务器
npm run test      # 单元测试（Vitest）
npm run build     # vue-tsc 严格类型检查 + 构建 + 预渲染
```

提交 PR 前请确保 `npm run test` 与 `npm run build` 全部通过。

## 项目约定

- **LabelCard 是唯一标签渲染源**：预览、缩略图、设计器、导出、打印全部复用，
  不要另起渲染实现。
- **毫米（mm）物理单位贯穿**：模板数据与打印相关 CSS 均使用 mm，保证打印精度。
- **数据不出浏览器**：不得引入任何将用户名单/照片上传到服务器的代码；
  保持纯静态部署（EdgeOne Pages），不引入后端与数据库。
- **UI 图标使用内联 SVG**，不使用 emoji 作为图标。
- **移动端响应式**：390 / 768 / 1280 宽度下不得出现横向溢出。
- TypeScript 严格模式，禁止 `any` 逃逸；遵循现有代码风格（见 `.editorconfig`）。

## 提交流程

1. Fork 并从 `main` 切出特性分支。
2. 完成开发并通过本地测试与构建。
3. 提交 PR：标题使用中文简述变更；描述包含变更要点与自测截图
   （涉及 UI 时请附 390 / 768 / 1280 三档宽度截图）。
4. 等待维护者审查合并。

## Issue 反馈

- Bug 反馈请使用 Bug 模板，附复现步骤、浏览器版本与截图。
- 功能建议请使用 Feature 模板，说明使用场景与期望效果。

## 安全问题

请勿在公开 Issue 中披露安全漏洞，参见 [SECURITY.md](SECURITY.md)。
