# 14 · `~/.codex` 目录解剖：什么是什么，什么能动

> 排障和维护要动手之前，先搞清每个文件的身份：哪些是「密码」，哪些是「垃圾」，删了会怎样。
>
> English version: [14-codex-home-anatomy.en.md](14-codex-home-anatomy.en.md)

## 动手前三个原则

1. **改 `config.toml` / `auth.json` 之前先备份**：`codex-doctor backup`（[13](13-codex-doctor.md)），出问题随时还原；
2. **大文件先归档再删**：`clean` 是移动到 `~/.codex/archive/` 而不是直接删，随时能搬回来（[09](09-maintenance.md)）；
3. **求助前脱敏**：`auth.json`、token、真实邮箱绝不外传（[CONTRIBUTING](../CONTRIBUTING.md)）。

## 逐项说明

| 路径 | 是什么 | 能否删除 | 备注 |
|---|---|---|---|
| `config.toml` | 主配置：模型、provider/中转、MCP、审批与沙箱 | ⚠️ 改前备份 | 根级键必须写在文件顶部（[04](04-config.md)） |
| `auth.json` | 登录凭据（OAuth token / API Key） | ❌ 不删、不分享 | **等同密码**；401 终极大招 = 备份后删除重登（[02](02-login-auth.md)） |
| `AGENTS.md` | 全局项目记忆，注入所有会话 | ✅ 可改可删 | 项目根目录的 AGENTS.md 优先级更高（[11](11-tips.md)） |
| `sessions/` | 会话完整记录（按日期分层 JSONL，含 token 用量） | ✅ 可归档 | `clean sessions` 归档、`sessions --stats` 查用量（[13](13-codex-doctor.md)） |
| `log/` | 运行日志（完整报错上下文：URL、状态码、重试） | ✅ 可清空 | `logs --errors` 一键取证、`clean logs` 归档（[13](13-codex-doctor.md)） |
| `history.jsonl` | 你在终端输入过的提问历史 | ✅ 可删 | 只丢输入历史，不影响配置与凭据 |
| `archive/` | `codex-doctor clean` 的归档区（本工具创建） | ✅ 确认后可删 | `archive list` / `archive delete`（[13](13-codex-doctor.md)） |
| `codex-global-state.json` | IDE 全局状态（含「在 WSL 中运行」开关等） | ⚠️ 谨慎 | VS Code 插件进不去 / 崩溃先看它（[10](10-ide-vscode.md)） |
| `requirements.toml` | 企业托管策略（管理员下发） | — | 见到它说明设备受管理（可能）；删了会被重新下发 |

> 版本间目录内容略有差异：新文件随版本出现，老文件会消失。没见过的文件先搜再动；不确定时**改名**比删除安全——改错了改回来就行。
>
> 📌 目录位置可整体重定位：设置 `CODEX_HOME` 环境变量后，本文所有路径均相对它（默认 `~/.codex`）。`codex-doctor` 全套工具与自检脚本都会跟随。

## 常见误区

- **「整个删掉 `~/.codex` 重来」**——登录、配置、会话历史、项目记忆一次性全清空，代价最大。更精准的做法：401 只动 `auth.json`（[02](02-login-auth.md)），配置问题只动 `config.toml`（[04](04-config.md)），磁盘紧张只归档 `sessions/` 和 `log/`（[09](09-maintenance.md)）。
- **把 `~/.codex` 放进同步盘**（OneDrive 等）——凭据与状态文件被同步盘接管，是 stream disconnected 和配置失效的高发原因（[03](03-network-proxy.md)）。
- **备份目录随手转发**——`codex-doctor backup` 的备份里含 `auth.json`，等同密码，别进群聊、别传网盘。
- **徒手编辑后不验证**——改完配置跑一次 `codex-doctor doctor`（只读体检）+ 交互界面里 `/status`，确认生效再继续干活（[13](13-codex-doctor.md)）。

## 速查：什么症状动什么

| 你想做的事 | 动哪里 | 详见 |
|---|---|---|
| 重新登录 / 解决 401 | `auth.json` | [02](02-login-auth.md) |
| 换模型 / 配中转 / 加 MCP | `config.toml` | [04](04-config.md)、[07](07-mcp.md) |
| 磁盘空间紧张 | `sessions/` + `log/` 归档 | [09](09-maintenance.md)、[13](13-codex-doctor.md) |
| 查报错上下文 | `log/` | [13](13-codex-doctor.md) 的 `logs --errors` |
| 找回上次对话 | `sessions/` | [13](13-codex-doctor.md) 的 `sessions --search` |
| 查额度花在哪 | `sessions/` | [13](13-codex-doctor.md) 的 `sessions --stats` |
| IDE 进不去 / 崩溃 | `codex-global-state.json` | [10](10-ide-vscode.md) |
