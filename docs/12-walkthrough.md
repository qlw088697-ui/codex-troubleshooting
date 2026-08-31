# 12 · 实战：用 Codex 从零搭一个项目

> 这篇把手册里散落的最佳实践串成一条完整路径：从空目录到能跑的项目。命令细节以你版本 `/help` 的实际输出为准。
>
> English version: [12-walkthrough.en.md](12-walkthrough.en.md)

## 步骤 0：干净的地基

1. 项目目录建在普通用户目录下，**不要放 OneDrive / 同步盘**（原因见 [03](03-network-proxy.md)）；Windows 用户建议在 WSL 内干活（[06](06-sandbox-windows.md)）；
2. 先跑一次[环境自检脚本](../scripts/codex-doctor.sh)，确认网络与凭据健康，省得中途排查；
3. **先 `git init` 再启动 codex**——有版本控制，对话产出的每一步都可回溯、可审查。

## 步骤 1：先教它，再用它

进入目录启动 `codex`，第一件事：

```text
/init
```

它会扫描项目生成 `AGENTS.md` 初版。然后**手工修剪**（详见 [11](11-tips.md)）：

- 写清构建/测试命令：`npm test`、`pytest` 之类；
- 写清边界：`永远不要改 .env；涉及数据库迁移的改动必须先问我`；
- 写清风格：`提交信息用中文；所有入口参数做校验`。

这份文件每轮任务都会生效——前期花 10 分钟，后面每个任务都省口舌。

## 步骤 2：第一个任务

用「**目标 + 约束 + 验收标准**」的格式描述，别一句话糊上去：

```text
实现一个 CLI 待办工具：
1. add / list / done 三个子命令，数据存 JSON 文件
2. 每个命令先写测试再写实现
3. 完成标准：npm test 全绿，README 有用法示例
先给我实施计划，我确认后再动手。
```

让它**先出计划再写码**——你审一份计划比审 500 行代码快得多。审批/沙箱日常建议 `--full-auto`（详见 [06](06-sandbox-windows.md)）。

## 步骤 3：迭代节奏

- **小步快跑**：一个功能一个会话，做完就 `git commit`。上下文小 = 便宜 + 快 + 不容易断流（[03](03-network-proxy.md)、[05](05-models-limits.md)）；
- **让它自证完成**：每个任务以「跑测试并贴出输出」收尾，不要脑补它做完了；
- **随时对齐**：拿不准它改了什么就 `git diff`，别攒到最后一起审。

## 步骤 4：把踩坑沉淀进 AGENTS.md

发现它反复犯同一个错（比如总忘记跑格式化），别每次口头纠正——写进 `AGENTS.md` 一行：`提交前必须跑 npm run lint:fix`。项目记忆是复利，越写越省。

## 步骤 5：例行工作脚本化

稳定的重复任务交给非交互模式（详见 [11](11-tips.md)）：

```bash
# 依赖升级后生成 PR 描述
codex exec "对比 package.json 与上次发布的差异，生成中文 PR 描述"

# 周报素材
codex exec "总结本周 git log，按 feature/fix 分类输出"
```

放进 CI 时用只读沙箱或一次性容器（[06](06-sandbox-windows.md)）。

## 常见误区清单

| 误区 | 后果 | 正解 |
|---|---|---|
| 一句话塞十个需求 | 模型自由发挥，大范围返工 | 拆任务，一次一个验收点 |
| 不看 `/status` 就抱怨"模型不行" | 其实是跑错了模型/配置 | 排障第一步永远是 `/status` |
| 项目放在 OneDrive 里 | 断流高发 | 移出同步盘 |
| 一个会话聊一整天 | 越来越贵、越来越慢、容易断 | 拆会话 |
| 让它把 API Key 写进代码 | 密钥泄露 | 密钥走环境变量 / `.env` 并加入 `.gitignore` |

## 遇到问题

按 [08 速查表](08-errors-quickref.md) 搜关键词；查不到就去 [Discussions](https://github.com/qlw088697-ui/codex-troubleshooting/discussions) 提问，或按 [CONTRIBUTING](../CONTRIBUTING.md) 补充案例。
