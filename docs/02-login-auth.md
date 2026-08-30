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

## 登录回调失败 / 浏览器打不开：设备码登录

远程 SSH、无图形界面、默认浏览器异常时，OAuth 回调会卡住。此时用设备码登录，在任意有浏览器的设备上完成授权：

```bash
codex login --device-auth
```

设备码登录的三类报错：

| 报错/现象 | 原因 | 处理 |
|---|---|---|
| 进不到输入设备码的页面，直接失败 | **设备码授权默认是关闭的** | 到 ChatGPT 网页 → Settings → Security，开启「Enable device code authorization for Codex」再重试 |
| `token exchange failed` | 旧会话残留干扰 | 先 `codex logout`，再执行 `codex login --device-auth` |
| `Invalid device code` | 码过期（有效期很短） | 重新运行命令生成新码，尽快输入 |

> 实测参考：[openai/codex #25670](https://github.com/openai/codex/issues/25670)、[OpenAI 社区：token exchange failed](https://community.openai.com/t/codex-cli-desktop-auth-failed-with-token-exchange-failed/1385469)

## WSL 里登录成功但凭据传不回来

WSL 与 Windows 的 localhost 相互隔离：`codex login` 拉起的浏览器在 Windows 侧完成授权后，回调无法送达 WSL 里的 codex。按优先级处理：

1. **新版 WSL2 开镜像网络模式**：Windows 用户目录 `.wslconfig` 里写 `networkingMode=mirrored` 后重启 WSL，localhost 打通后通常直接解决；
2. **手动迁移凭据**：在 Windows 侧的 Codex 完成登录，然后把凭据复制进 WSL：
   ```bash
   # Windows 侧登录成功后，在 WSL 里执行（<Windows用户名> 按实际改）
   mkdir -p ~/.codex
   cp /mnt/c/Users/<Windows用户名>/.codex/auth.json ~/.codex/auth.json
   ```
   之后 WSL 里的 codex 即可使用订阅额度；token 过期后需重做一次；
3. 仍不通：回 [03 网络与代理](03-network-proxy.md) 检查 WSL 的代理（WSL 里 `127.0.0.1` 指向的是 WSL 自己）。

> 实测参考：[WSL 环境 Codex 登录问题完全解决方案 — CSDN](https://blog.csdn.net/gxy03/article/details/157246287)

## auth.json 是什么

`~/.codex/auth.json` 保存登录凭据，大致两种形态：

```jsonc
// ChatGPT 登录
{ "tokens": { "id_token": "...", "access_token": "...", "refresh_token": "...", "account_id": "..." }, "OPENAI_API_KEY": null }
// API Key 方式
{ "OPENAI_API_KEY": "sk-..." }
```

> 🔒 这个文件等同密码：排障发帖、截图、求助时**务必脱敏**；换机器迁移时单独备份，不要提交进任何仓库。
