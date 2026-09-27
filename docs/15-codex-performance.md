# 15 · 性能与体验：越用越慢怎么救

> 报错关键词：越来越慢、回复迟钝、卡、变笨、token 消耗大、compact
>
> English version: [15-codex-performance.en.md](15-codex-performance.en.md)
>
> 依据：官方 [Speed](https://developers.openai.com/codex/speed)、[Configuration Reference](https://developers.openai.com/codex/config-reference) 与 [斜杠命令文档](https://developers.openai.com/codex/cli/slash-commands)（2026-09 核对）；配置键名可能随版本变化，以 `codex --version` 对应版本的文档为准。

## 先分清「慢」在哪一层

「慢」有四种，处理方式完全不同，别一上来就重装：

| 症状 | 类型 | 见 |
|---|---|---|
| 每条回复都等很久（包括第一条） | 推理档太高 / Fast 未开 | ① |
| 前面很快，越聊越慢、越来越「忘事」 | 上下文膨胀 | ② |
| 启动慢、第一个动作前卡住 | MCP 启动 / 更新检查 | ③ |
| 输出刷屏卡顿（远程 SSH、低配机） | 终端渲染 | ④ |

分诊第一步是 `/status`：它显示会话配置、token 用量和**剩余上下文容量**——如果剩余容量所剩无几，直接去 ②。

## ① 模型与推理档：速度的第一开关

- `/model` 不只切模型，还能切**推理档**（reasoning effort）。同一模型，`low`/`medium` 明显快于 `high`/`xhigh`——日常改码用低中档，硬骨头再临时调高；
- 想持久化：config.toml 里 `model_reasoning_effort = "minimal" | "low" | "medium" | "high" | "xhigh"`（以版本支持为准）；
- 回复啰嗦也是时间成本：`model_verbosity = "low"` 让输出更精炼；
- **Fast mode**：ChatGPT 登录用户可用 `/fast on` 临时开（持久化 `service_tier = "fast"`），响应更快但积分消耗率更高，具体倍率以官方 Speed 页和你的套餐页为准；API Key 计费不适用（可能随版本变化）；
- 官方 Speed 页还有面向「快速迭代」的轻量模型路线（研究预览，可用性受限）——见 [05 模型与限额](05-models-limits.md)。

## ② 上下文管理：「越聊越慢变笨」的根源

机制：每轮请求都携带会话此前的全部上下文。会话越长，输入 token 越多——等待变久、更易触发限额（[05](05-models-limits.md)）、也更容易断流（[03](03-network-proxy.md)）。

本手册实证：`codex-doctor sessions --stats --top 3` 曾在 320+ 个会话里找到 30 天烧 1.8 亿 token 的单会话——基本都是一个会话里滚了几百轮的「大赛」。

**压缩（compaction）是官方解法**：

- 上下文接近上限时，Codex 会**自动压缩**历史（阈值可用 `model_auto_compact_token_limit` 调整；不设则用模型默认值）；
- 也可手动 `/compact`——官方定义：「总结当前对话以释放 token。长任务后使用，让 Codex 保留要点而不撑爆上下文窗口」；
- 压缩有代价：细节会被摘要替换。本机会话文件里能看到 `compacted` 事件：压缩就是把旧历史替换成 `replacement_history`。所以**重要结论让它落盘**（写进文件 / AGENTS.md / 提交记录），别只留在对话里；旧细节可用 `codex-doctor sessions show` 回看。

配套习惯：

1. **会话拆分**：一个主题一个会话。`/new` 开新对话、`/resume` 回旧对话、`/fork` 从当前位置分叉支线，都比「无限续杯」健康；
2. **控制单条工具输出的体量**：读大文件、跑长命令的输出会整段进入历史——让 Codex 优先 grep / 分段读；`tool_output_token_limit` 可限制单条工具输出占用的历史预算；
3. **AGENTS.md 每轮都计费**：全局 + 项目根 + 子目录的记忆文件会拼进每轮请求，写成百科全书等于每轮都在烧 token。`project_doc_max_bytes` 可限制单文件读取量；精简原则见 [11 效率技巧](11-tips.md)。

## ③ 启动与工具：MCP 是头号嫌疑

- 每个 MCP server 启动默认只有 **10 秒超时**（`mcp_servers.<id>.startup_timeout_sec` 可调），慢 server 会拖住整个启动；
- **不用的 server 直接关掉**：`mcp_servers.<id>.enabled = false`——不用删配置，想用再开；
- 工具调用超时默认 60 秒（`tool_timeout_sec`）；
- `codex-doctor doctor --mcp-smoke` 深检哪个 server 起不来（[13](13-codex-doctor.md)）；排查步骤详见 [07 MCP](07-mcp.md)；
- 离线 / 内网机器可关启动时的更新检查：`check_for_update_on_startup = false`。

另有两个默认开启的官方提速特性，别关：`features.shell_snapshot`（快照 shell 环境，重复命令更快）与 `features.enable_request_compression`（请求 zstd 压缩，弱网有益）。

## ④ 终端与界面

- 远程 SSH / 低配机器刷屏卡顿：`tui.animations = false` 关动画；
- 刷屏太多：`hide_agent_reasoning = true` 隐藏推理过程，或 `model_reasoning_summary = "concise"` 让摘要更简短；
- Windows 中文乱码影响体验：确认 `features.powershell_utf8`（Windows 默认开启）+ 终端 `chcp 65001`，详见 [06 沙箱与 Windows](06-sandbox-windows.md)。

## 一份「提速最小配置」

```toml
# 追求响应速度的日常档位（按需取舍）
model_reasoning_effort = "low"   # 难任务临时 /model 调高
model_verbosity = "low"

[mcp_servers.heavy-mcp]
enabled = false                  # 不常用的 server 先关掉
```

## 自查清单

- [ ] `/status`：当前推理档是什么？剩余上下文还剩多少？
- [ ] `/usage`：本窗口已烧多少？
- [ ] `codex-doctor sessions --stats --top 5`：哪几个会话最烧钱？
- [ ] config 里有没有常年不用的 MCP server？（`enabled = false` 关掉）
- [ ] AGENTS.md 是不是越写越长了？

---

> 相关：[05 模型与限额](05-models-limits.md)（429 / 额度）、[03 网络与代理](03-network-proxy.md)（断流重试）、[07 MCP](07-mcp.md)（工具排障）、[11 效率技巧](11-tips.md)、[13 codex-doctor CLI](13-codex-doctor.md)（用量统计与深检）
