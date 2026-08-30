# 02 · 登录与认证（401 / 403 高发区）

> 报错关键词：`401 Unauthorized`、`Exceeded retry limit, last error: 401`、`403 Forbidden`、`Not logged in`、登录后一直无响应

## 两种认证方式，先分清你在用哪种

| 方式 | 命令 | 计费 | 凭据存放 |
|---|---|---|---|
| ChatGPT 账号登录（Plus / Pro / Team 等订阅） | `codex login` | 订阅额度内 | `~/.codex/auth.json` 中的 tokens |
| API Key | `codex login --api-key` 或环境变量 `OPENAI_API_KEY` | 平台按量计费 | `auth.json` 或环境变量 |

两者**可以同时存在**，这正是大量 401 问题的根源——实际请求用了 A 方式的凭据、打到了 B 方式的端点。

## 401 排障决策树

按顺序问自己这五个问题：

### ① 请求到底发去了哪里？

看终端报错里的 URL（或在 `~/.codex/log/` 日志里搜 URL）：

- 指向 `chatgpt.com` / `api.openai.com` → 官方端点；
- 指向某个第三方域名 → 你的配置里残留了第三方中转，见 [04 config.toml](04-config.md) 的检查清单。

### ② 第三方 Key 是否被发给了官方端点？

中转站买的 `sk-xxx` 发给 `api.openai.com` 必然 401。反过来，官方账号凭据发给中转站也 401。修复：

- 用官方账号：清理 `config.toml` 里的自定义 `model_providers` 和根级 `model_provider`，清理 `OPENAI_BASE_URL` 环境变量，重新 `codex login`；
- 用中转站：确保 `config.toml` 中 `model_provider` 指向对应的中转 provider（见 [04](04-config.md)）。

### ③ 登录态是不是过期/损坏了？

`Exceeded retry limit, last error: 401 Unauthorized` 绝大多数是登录态问题：

```bash
codex logout
codex login
```

仍不行，**彻底清理凭据后重登**（先完全退出 Codex 和 IDE 里的 Codex 插件）：

```bash
# 删除凭据文件（Windows 路径：C:\Users\<你>\.codex\auth.json）
rm ~/.codex/auth.json
codex login
```

VS Code / Cursor 用户：重登后执行一次「Developer: Reload Window」，插件缓存才会刷新。

### ④ 环境变量里有没有残留？

环境变量的优先级会覆盖你以为的配置，逐项检查：

```bash
env | grep -i openai        # macOS/Linux
Get-ChildItem Env: | Where-Object Name -like "*OPENAI*"   # PowerShell
```

发现过期/无效的 `OPENAI_API_KEY`、`OPENAI_BASE_URL`，删除（或改成正确值）后重开终端。特别注意：有些「一键配置脚本」会把它们写进 shell 配置文件（`.bashrc` / PowerShell `$PROFILE`），改当前会话没用，要去配置文件里删。

### ⑤ ChatGPT 登录成功，但会话里还是 401？

这是社区最高频的 401 场景：**登录流程没问题，是配置冲突**——`config.toml` 里残留的第三方 provider 或环境变量把请求引去了别处。回到 [04 config.toml](04-config.md) 的检查清单逐项排除；实在找不到，按 [09 日常维护](09-maintenance.md) 的「完全重置」流程走一遍（备份后删除整个 `~/.codex`，重新登录）。

## 403 Forbidden

401 是「没认出你是谁」，403 是「认出来了，但不允许」：

- 账号（或所在组织）没有你请求的那个模型的权限；
- 地区限制——部分服务/模型不对特定地区开放；
- 企业/团队工作区策略限制。确认账号资格、换用你有权限的模型（`/model`）。

## 登录回调失败 / 浏览器打不开

远程 SSH、无图形界面、默认浏览器异常时，OAuth 回调会卡住。改用设备码登录（新版本支持，具体入口以 `codex login --help` 为准），在任意有浏览器的设备上完成授权。

## auth.json 是什么

`~/.codex/auth.json` 保存登录凭据，大致两种形态：

```jsonc
// ChatGPT 登录
{ "tokens": { "id_token": "...", "access_token": "...", "refresh_token": "...", "account_id": "..." }, "OPENAI_API_KEY": null }
// API Key 方式
{ "OPENAI_API_KEY": "sk-..." }
```

> 🔒 这个文件等同密码：排障发帖、截图、求助时**务必脱敏**；换机器迁移时单独备份，不要提交进任何仓库。
