# 更新日志

本项目的全部重要变更。格式参考 [Keep a Changelog](https://keepachangelog.com/)，版本号遵循语义化。

> codex-doctor CLI 的版本号（`--version`）独立演进，与仓库 Release 版本号不同步，以 npm 页面为准。

## [1.24.0] - 2026-09-26

### 新增

- codex-doctor CLI **1.7.0**
- `history` 命令：浏览 `~/.codex/history.jsonl` 输入历史（`--search` 过滤、坏行自动跳过、最新在前）——「找回」三件套补齐：sessions 找回对话、logs 找回报错、history 找回输入

### 文档

- ROADMAP 勾选 `history` 项；README/13 同步

## [1.23.0] - 2026-09-26

### 新增

- codex-doctor CLI **1.6.0**
- doctor **auth.json 结构校验**：文件存在但损坏（非 JSON）/ 空壳（无任何凭据）可被直接检出——401 循环的隐形原因，此前只检查文件存在性；docs/02 增补两种损坏形态的案例与解法
- `ROADMAP.md` 迭代待办清单：沉淀后续迭代方向（工具 / 文档 / 工程化），AGENTS 与 CONTRIBUTING 挂接续指引

## [1.22.0] - 2026-09-26

### 新增

- codex-doctor CLI **1.5.0**
- `report` 命令：一键生成脱敏取证报告（Markdown，`--out` 指定路径）——环境自检 + 配置摘要 + 报错级别日志行 + 7 天用量；sk-* Key、Bearer token、邮箱、URL 凭证参数自动打码，`auth.json` 内容绝不入报告

## [1.21.0] - 2026-09-26

### 新增

- codex-doctor CLI **1.4.0**
- **`CODEX_HOME` 全程跟随**：设置该环境变量时，CLI 的所有命令与 doctor 检查自动指向重定位后的目录（此前硬编码 `~/.codex`，重定位用户全部检查落空）；doctor 新增 `codex-home` 提示项

### 修复

- 自检脚本 `codex-doctor.sh` / `.ps1` 同步支持 `CODEX_HOME`；目录相关提示措辞不再写死 `~/.codex`

## [1.20.0] - 2026-09-26

### 新增

- codex-doctor CLI **1.3.0**
- `sessions --stats`：会话用量统计（每个会话的输入/输出/合计 tokens + 时间窗口汇总，429 自查；`--days` 窗口、`--dir` 过滤）

### 文档

- 新增 [14 · `~/.codex` 目录解剖](docs/14-codex-home-anatomy.md)：每个文件是什么、能否删、常见误区（中英双语）

## [1.19.0] - 2026-09-26

### 新增

- codex-doctor CLI **1.2.0**
- `logs` 命令：日志查看与取证（列表 / `--tail` 末尾 N 行 / `--search` 关键词搜索 / `--errors` 一键过滤报错级别行；`--file` 按文件名选择，`--all` 扫全部日志）
- doctor 新增 log 目录体积检查（≥100 MB 提示取证与归档）

## [1.18.1] - 2026-09-05

### 修复

- CLI 版本号误降为 0.10.0（低于 1.0.0），修正回 1.1.0

## [1.18.0] - 2026-09-05

### 新增

- doctor MCP server 启动命令可达性检查（「工具不出现」的头号原因）
- docsify 站点封面页

### 修复

- CLI `commandExists` 未导入 `execSync` 导致报错

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
