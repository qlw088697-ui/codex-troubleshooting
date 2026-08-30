# 04 · config.toml 配置

> 报错关键词：`failed to parse config`、`TOML parse error`、**「配置写了但不生效」**、401（配置冲突型）
>
> English version: [04-config.en.md](04-config.en.md)

## 文件位置

```
~/.codex/config.toml
Windows: C:\Users\<你>\\.codex\\config.toml
```

没有就自己建一个。**修改后重启 Codex 会话才会生效**。

## 第一大坑：TOML 的「根级键必须写在所有 `[表]` 之前」

TOML 里 `model = "..."` 这类**根级键，一旦写在某个 `[xxx]` 段落之后，就会被解析成那个表的子键**——不报错、不生效，是「配置不生效」的头号原因。

❌ 错误示例：

```toml
[model_providers.myproxy]
name = "myproxy"
base_url = "https://relay.example.com/v1"

model = "gpt-5-codex"          # ← 写在 [表] 后面，属于 myproxy 表，不生效！
```

✅ 正确示例：

```toml
model = "gpt-5-codex"          # 根级键全部放最上面
model_provider = "openai"
approval_policy = "on-request"
sandbox_mode = "workspace-write"

[model_providers.myproxy]      # 表放在后面
name = "myproxy"
base_url = "https://relay.example.com/v1"
```

> 💡 自检脚本会扫描这个错误模式并给出警告。

## 常用根级配置

```toml
model = "gpt-5-codex"            # 模型名以官方文档为准，可在 TUI 里用 /model 切换
model_provider = "openai"        # 默认官方；用中转时改成你定义的 provider id
approval_policy = "on-request"   # untrusted / on-failure / on-request / never
sandbox_mode = "workspace-write" # read-only / workspace-write / danger-full-access
```

审批与沙箱模式的详细说明见 [06 沙箱与 Windows](06-sandbox-windows.md)。

## 配置第三方中转（自定义 provider）

```toml
# 根级：指向你的 provider
model_provider = "myrelay"

# 表：定义 provider（放在根级键之后）
[model_providers.myrelay]
name = "My Relay"
base_url = "https://relay.example.com/v1"   # 按中转站要求，通常以 /v1 结尾
env_key = "MYRELAY_API_KEY"                  # 从哪个环境变量读 Key
wire_api = "responses"                       # 中转站只支持 Chat Completions 时改为 "chat"
```

```bash
# 把 Key 放进环境变量（不要写进 config.toml 明文）
export MYRELAY_API_KEY=sk-xxxx
```

要点：

- `wire_api` 不匹配是「中转站连上了但一直报错」的常见原因，两种都试一下；
- `env_key` 对应的环境变量不存在时，部分版本表现为未认证/401；
- 中转站给的是 OpenAI 兼容接口还是完整 Responses 接口，直接决定 `wire_api` 该填什么。

## Profiles：多套配置一键切换

官方/中转两套配置来回切很麻烦，用 profile：

```toml
[profiles.official]
model_provider = "openai"

[profiles.relay]
model_provider = "myrelay"
model = "gpt-5-codex"
```

```bash
codex --profile relay
```

## 改完配置怎么验证生效

1. 重启 Codex 会话；
2. 在 TUI 里输入 `/status`，核对显示的 **model / provider / approval / sandbox** 是否是你要的值。

## 401 排障时的配置检查清单

逐项过（配合 [02 登录与认证](02-login-auth.md)）：

- [ ] 根级 `model_provider` 指向谁？是不是以为在用官方、实际指向了中转（或相反）？
- [ ] 有没有**残留的** `[model_providers.*]`——用过中转又切回官方的最容易中招；
- [ ] `env_key` 对应的环境变量是否存在、是否是那家平台的 Key；
- [ ] `base_url` 路径是否符合中转站要求（多数要 `/v1` 结尾）；
- [ ] 环境变量里有没有残留的 `OPENAI_BASE_URL`（见 [02](02-login-auth.md) 第④步）；
- [ ] `auth.json` 里的凭据和你指向的端点是否匹配（官方 tokens vs 中转 sk-key）。

## 配置文件语法报错

`failed to parse config` / `TOML parse error` 时，报错信息会带行号，常见原因：

- 引号没配对、字符串没加引号（URL、路径必须加引号）；
- 复制粘贴带进了全角引号 `“”` 或全角冒号；
- 表名重复定义。
