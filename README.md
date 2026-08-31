# Codex Troubleshooting — Codex CLI 维护与排障手册

中文 | [English](README.en.md)

> 一份面向中文用户的 [Codex CLI](https://github.com/openai/codex) 维护支持手册：安装、登录认证、网络代理、配置文件、用量限额、MCP、Windows 兼容等常见问题的**症状 → 原因 → 解决步骤**速查。
>
> A Chinese-first troubleshooting & maintenance guide for OpenAI Codex CLI.

[![CI](https://github.com/qlw088697-ui/codex-troubleshooting/actions/workflows/ci.yml/badge.svg)](https://github.com/qlw088697-ui/codex-troubleshooting/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/qlw088697-ui/codex-troubleshooting?label=release)](https://github.com/qlw088697-ui/codex-troubleshooting/releases)
[![Latest Codex](https://img.shields.io/github/v/release/openai/codex?label=latest%20codex)](docs/releases.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20WSL-lightgrey)](docs/06-sandbox-windows.md)

> 📖 **在线阅读**：<https://qlw088697-ui.github.io/codex-troubleshooting/>（支持全文搜索，内容与仓库同步）

---

## 这份手册能解决什么

Codex CLI 迭代很快，社区里反复出现的问题高度集中：**登录成功却一直 401、配置写了不生效、国内网络超时断流、Windows 下沙箱报错、MCP 工具不出现、用量 429**……本手册把这些问题的排查路径整理成文档，并附带一个跨平台的环境自检脚本，帮你 5 分钟内定位大部分问题。

> ⚠️ Codex 版本更新频繁，具体命令与配置键以 [官方文档](https://developers.openai.com/codex/) 和 `codex --version` 实际输出为准。发现过时内容欢迎提 PR。

## 快速开始：先跑一次环境自检

遇到任何异常，先跑自检脚本收集环境信息：

```powershell
# Windows PowerShell
irm https://raw.githubusercontent.com/qlw088697-ui/codex-troubleshooting/main/scripts/codex-doctor.ps1 | iex
```

```bash
# macOS / Linux / WSL
curl -fsSL https://raw.githubusercontent.com/qlw088697-ui/codex-troubleshooting/main/scripts/codex-doctor.sh | bash
```

（也可以下载 `scripts/` 目录里的脚本本地运行。脚本只读环境信息，不会修改任何配置。）

## 症状速查导航

| 我遇到的症状 | 应该看 |
|---|---|
| 安装失败 / `codex` 命令找不到 / 想升级回滚 | [01 安装与更新](docs/01-installation.md) |
| 登录成功但一直 **401 Unauthorized** / `Exceeded retry limit` | [02 登录与认证](docs/02-login-auth.md) + [08 报错速查](docs/08-errors-quickref.md) |
| 403 Forbidden | [02 登录与认证](docs/02-login-auth.md) |
| 429 / "You've hit your usage limit" 用量达上限 | [05 模型与用量限额](docs/05-models-limits.md) |
| 超时 / stream error / 国内网络连不上 | [03 网络与代理](docs/03-network-proxy.md) |
| 想用第三方中转 / 配置不生效 | [04 config.toml 配置](docs/04-config.md) |
| Windows 写文件被拒 / 沙箱报错 / 想在 WSL 里跑 | [06 沙箱与 Windows](docs/06-sandbox-windows.md) |
| MCP 工具不出现 / MCP server 启动失败 | [07 MCP 配置](docs/07-mcp.md) |
| VS Code / Cursor 插件里 401、配置不生效 | [10 IDE 集成](docs/10-ide-vscode.md) |
| 想把 Codex 用得更快更省（命令 / 项目记忆 / 脚本化） | [11 效率技巧](docs/11-tips.md) |
| 想看完整实战：从零用 Codex 做一个项目 | [12 实战演练](docs/12-walkthrough.md) |
| 想清理 / 备份 / 迁移机器 / 完全重置 | [09 日常维护](docs/09-maintenance.md) |
| 想看 Codex 出了哪些新版本 | [版本追踪](docs/releases.md)（CI 每周自动更新） |

## 文档目录

```
docs/
├── 01-installation.md      安装、更新与回滚（npm / brew / 二进制）
├── 02-login-auth.md        登录与认证：401 / 403 排障决策树
├── 03-network-proxy.md     网络与代理：超时、断流、镜像加速
├── 04-config.md            config.toml：根级键位置、第三方中转、profiles
├── 05-models-limits.md     模型选择与用量限额（429）
├── 06-sandbox-windows.md   审批/沙箱模式、Windows 原生与 WSL2 方案
├── 07-mcp.md               MCP server 配置与排障
├── 08-errors-quickref.md   常见报错速查表（报错关键词 → 处理方案）
├── 09-maintenance.md       日常维护：升级、清理、备份、迁移、重置
├── 10-ide-vscode.md        IDE 集成：VS Code / Cursor 插件排障
├── 11-tips.md              效率技巧：斜杠命令、AGENTS.md 项目记忆、codex exec
├── 12-walkthrough.md       实战演练：从零用 Codex 搭一个项目
└── releases.md             Codex 版本追踪（CI 每天自动生成）

> 🌍 所有主题文档均有英文版（`docs/*.en.md`，共 12 篇），目录树不一一列出；中英版本在文首互链。
scripts/
├── codex-doctor.ps1        Windows 环境自检脚本
├── codex-doctor.sh         macOS / Linux / WSL 环境自检脚本
├── check-links.sh          Markdown 相对链接检查（CI 同款）
└── gen-releases.mjs        版本追踪生成器（CI 每周运行）
```

## 通用排查五步法

不管遇到什么报错，按这个顺序走一遍能解决 80% 的问题：

1. **确认版本**：`codex --version`，老版本先升级（很多 bug 是版本-specific 的）；
2. **确认状态**：在 Codex 交互界面输入 `/status`，核对当前模型、provider、审批/沙箱模式是不是你以为的那样；
3. **跑自检脚本**：`scripts/codex-doctor`，重点看网络连通性和配置文件检查项；
4. **看日志**：`~/.codex/log/` 下有运行日志，报错上下文往往比终端一句话详细得多；
5. **最小化复现**：换一个空目录 + 备份并移走 `~/.codex/config.toml` 后重新登录测试，排除配置残留干扰（[09 日常维护](docs/09-maintenance.md)）。

## 如何贡献

💬 只想提问、讨论？直接去 [Discussions](https://github.com/qlw088697-ui/codex-troubleshooting/discussions) 开帖，不必改文件。

欢迎补充新的「症状 + 原因 + 解法」！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)，格式很简单，注意**脱敏**（不要贴 `auth.json`、API Key、真实邮箱）。

## 参考资源

- [openai/codex — 官方仓库](https://github.com/openai/codex)（Issues 区本身就是最好的排障库）
- [Codex 官方文档](https://developers.openai.com/codex/)
- 社区排障文章（本手册部分案例来源）：
  - [Codex 插件 ChatGPT 登录成功但一直 401 Unauthorized — CSDN](https://blog.csdn.net/baobao181/article/details/157249679)
  - [Codex 报 401 / 无响应？99% 是这两个配置文件问题 — 知乎](https://zhuanlan.zhihu.com/p/2054216866801902921)
  - [Codex CLI 认证故障分层排查：401、403、浏览器回调与 429 — 腾讯云](https://cloud.tencent.com/developer/article/2713604)
  - [Windows 版 401、配置不生效排查 — 知乎](https://zhuanlan.zhihu.com/p/2052467135138490173)
  - [Codex CLI Windows 避坑指南：从安装到沙箱报错 — 腾讯云](https://cloud.tencent.com/developer/article/2716156)
  - [WSL 环境 Codex 登录问题完全解决方案 — CSDN](https://blog.csdn.net/gxy03/article/details/157246287)
  - [官方社区：stream disconnected before completion](https://community.openai.com/t/bug-codex-stream-disconnected-before-completion-on-backend-api-codex-responses-feb-8-2026/1373656)

## License

[MIT](LICENSE) © 2026
