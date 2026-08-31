# 11 · 效率技巧：斜杠命令、项目记忆与脚本化

> 这篇不是报错排查，而是把 Codex 用得更快、更省、更稳。具体命令以你版本 `/help` 的实际输出为准——Codex 迭代很快。
>
> English version: [11-tips.en.md](11-tips.en.md)

## TUI 斜杠命令速记

在交互界面输入 `/` 可以看到全部命令。最常用的几个：

| 命令 | 用途 |
|---|---|
| `/status` | 查看当前模型、provider、审批/沙箱模式——排障第一步（见 [08](08-errors-quickref.md)） |
| `/model` | 切换模型（见 [05](05-models-limits.md)） |
| `/init` | 为当前项目生成 `AGENTS.md` 初始版 |
| `/logout` | 清除登录态——401 排障常用（见 [02](02-login-auth.md)） |
| `/help` | 全量命令与说明 |

## AGENTS.md：项目记忆

Codex 执行任务会读取指令文件 `AGENTS.md`，项目根目录的优先于用户全局的（`~/.codex/AGENTS.md`）。适合放：

- **项目约定**：构建/测试命令、代码风格、目录结构说明；
- **边界**：哪些目录不要动、哪些操作必须先问；
- **已知坑**：你踩过的项目特殊行为，别让它再踩一遍。

三个要点：

1. **保持精炼**——它每轮都会进入上下文，写大段废话既费额度又稀释重点；
2. 用 `/init` 生成初版，然后手工修剪成你真正想要的；
3. 团队共享的约定直接提交进仓库。本仓库自己就有一份 [AGENTS.md](../AGENTS.md) 规范 AI 代理的贡献行为，可以当模板参考。

## `codex exec`：脚本化与 CI

非交互模式，把 Codex 嵌进脚本和流水线：

```bash
codex exec "修复 src/utils.ts 里的类型错误并跑通 npm test"
```

要点：

- 输出是纯结果流，适合程序化消费与日志留档；
- 权限控制和交互模式一致（`approval_policy` / `sandbox_mode`，见 [06](06-sandbox-windows.md)）——CI 里建议只读模式或一次性容器；
- 配合 `--profile` 在不同配置间切换（见 [04](04-config.md)）。

## 会话管理

- **长任务拆会话**：上下文越滚越大，又贵又慢还容易断流（见 [03](03-network-proxy.md)、[05](05-models-limits.md)）；
- 会话历史在 `~/.codex/sessions/`，可回溯、可清理归档（见 [09](09-maintenance.md)）；
- 较新版本支持恢复上次会话（以 `/help` 与 `codex --help` 的实际输出为准）。
