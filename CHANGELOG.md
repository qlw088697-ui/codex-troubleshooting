# 更新日志

本项目的全部重要变更。格式参考 [Keep a Changelog](https://keepachangelog.com/)，版本号遵循语义化。

> codex-doctor CLI 的版本号（`--version`）独立演进，与仓库 Release 版本号不同步，以 npm 页面为准。

## [1.17.0] - 2026-09-05

### 安全

- 仓库开启 Secret Scanning 与 Push Protection（GitHub 安全基线）

### 新增

- `CHANGELOG.md` 变更日志
- README 增加 npm 下载量徽章

## [1.16.0] - 2026-09-05

### 新增

- codex-doctor CLI **1.0.0 稳定版**
- `config` 命令：只读配置摘要（模型 / provider / 审批沙箱 / profiles / 中转 / MCP / 认证方式，敏感值脱敏）
- Release 发布后自动生成并附带最新版 PDF 手册（release-pdf.yml）

### 修复

- 嵌套 TOML 表（如 `[mcp_servers.x.env]`）被误判为 MCP server 实体

## [1.15.0] - 2026-09-05

### 新增

- 离线 PDF 手册：`scripts/build-pdf.mjs` 合并全部文档（marked 渲染 + Chrome/Edge headless 打印），随 Release 附件分发

## [1.14.0] - 2026-09-05

### 新增

- `sessions --show --out`：会话导出 Markdown（含元信息头）
- `npm test` / `npm run check:*` 快捷入口；CONTRIBUTING 维护者备忘

## [1.13.0] - 2026-09-05

### 新增

- `sessions --show [--search 关键词] [--pick N] [--full]`：查看会话完整对话

### 修复

- CLI 漏导入 `CODEX_DIR` 导致 show 提示行报错

## [1.12.0] - 2026-09-05

### 新增

- `sessions --search 关键词 [--deep]`：会话关键词搜索（默认头部 256KB，--deep 全文）

## [1.11.0] - 2026-09-05

### 新增

- `sessions` 命令：浏览历史会话（时间 / 工作目录 / 来源 / 首条提问预览）

## [1.10.0] - 2026-09-05

### 变更

- doctor 输出按「基础环境 / 配置与凭据 / 环境变量 / 网络 / 系统坑位 / 维护」分节
- npm 包元数据：keywords + homepage

## [1.9.0] - 2026-09-05

### 新增

- **npm Trusted Publishing（OIDC）**：tag 推送自动跑夹具测试并发布 npm，免 token
- CLI `-v/--version` 旗标

## [1.8.0] - 2026-09-05

### 新增

- doctor `auth-expiry` 检查：解码 auth.json 的 JWT 过期时间，登录态过期/临期提前预警

### 修复

- `update` 改查 npm registry；修复 `/latest` + 缩略 Accept 导致的 HTTP 406

## [1.7.0] - 2026-09-05

### 新增

- codex-doctor 上架 npm（`@qqq123456789/codex-doctor`），文档 npx 命令升级

## [1.6.0] - 2026-09-05

### 新增

- doctor **中转模式感知**：自动探测 config.toml 里的中转端点，官方端点对中转用户降级为参考信息
- Windows 系统代理检测；网络探测重试

### 实战

- 首次真实体检即命中：本地中转未运行才是用户 codex 故障的根因

## [1.5.0] - 2026-09-05

### 新增

- doctor：codex 版本过期检测、Windows PowerShell 执行策略检查、网络探测并行化

## [1.4.0] - 2026-09-05

### 新增

- `archive list/delete`：归档管理闭环
- 首次 Issue/PR 欢迎工作流

## [1.3.0] - 2026-09-05

### 新增

- **codex-doctor CLI 诞生**：doctor / clean / backup / restore / auth reset / versions，零依赖
- CI 夹具回归测试；npm 包定义

### 修复

- 冒烟测试在无 codex 的 runner 上的误报断言
- clean 只检查顶层目录 mtime 漏掉深层旧文件

## [1.2.0] - 2026-09-05

### 新增

- docs/12 实战演练（从零用 Codex 搭项目）；stale 不活动清理；版本追踪日更

## [1.1.0] - 2026-09-05

### 新增

- **全量双语**：全部主题文档提供英文版；CI 结构一致性检查

## [1.0.0] - 2026-09-05

### 首个正式版

- 11 篇排障文档、双语速查表、跨平台自检脚本、CI、每日版本追踪、docsify 在线站点、Discussions、Issue 模板
