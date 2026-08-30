# 07 · MCP 配置与排障

> 报错关键词：MCP 工具不出现、`mcp server` 启动失败、工具调用超时

## 基本配置

MCP server 配置在 `~/.codex/config.toml`（注意 [04](04-config.md) 说的：表要放在根级键之后）：

```toml
[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]

[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "D:/projects"]
env = { "SOME_VAR" = "value" }
```

修改配置后**重启 Codex 会话**才会重新拉起 MCP server。

## Windows 上的第一大坑：npx 需要 cmd 包装

Windows 下直接 `command = "npx"` 经常起不来（`.cmd` 解析问题）。用 cmd 包一层：

```toml
[mcp_servers.context7]
command = "cmd"
args = ["/c", "npx", "-y", "@upstash/context7-mcp"]
```

工具不出现先查这一条，能解决 Windows 下的大多数「MCP 配置了但没反应」。

## 工具不出现的排查步骤

按顺序：

1. **重启会话**——配置只在新会话生效；
2. **手动验证 server 能不能启动**：把 `command + args` 拼起来在终端直接跑，看是否正常输出/挂起等待（stdio 型 server 正常时会等待输入，Ctrl+C 退出）；
   - 报「命令不存在」→ `npx`/`node` 不在 PATH 里；
   - 报模块找不到 → 包名写错，或需要先 `npm i -g`；
3. **Windows** → 检查是否需要 `cmd /c` 包装（见上）；
4. **确认配置段落名**是 `[mcp_servers.<name>]`，不是 `[mcp.<name>]` 之类的变体；
5. 换个名字试试——server 名重复或含特殊字符可能导致加载失败；
6. 仍不行，看 `~/.codex/log/` 日志里 MCP 相关报错。

## 调用报错 / 超时

- **超时**：server 本身响应慢（比如联网拉数据的），换更快的源或加大超时（如版本支持相应配置项）；
- **认证失败**：HTTP 型 MCP 需要的 header/token 配进 `env` 或按 server 文档配置；
- **一个 server 崩了拖慢启动**：把不常用的 server 注释掉，二分定位是哪一个的问题。

## 环境变量注意

`env = { ... }` 里引用的 Key 如果依赖你 shell 里的环境变量，注意 Codex 启动环境可能和你当前终端不同（比如从 IDE 启动时读不到 `.bashrc` 里的变量）——直接把值写进 `env` 更可靠，但注意**别把敏感 Key 提交进任何仓库**。
