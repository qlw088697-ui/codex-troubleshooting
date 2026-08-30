# 03 · 网络与代理

> 报错关键词：`stream error`、`stream disconnected`、`connection reset`、`ETIMEDOUT`、`ECONNREFUSED`、长时间转圈无响应
>
> 典型人群：国内网络直连用户、公司内网/企业代理用户。

## 核心认知

Codex 需要稳定访问 `chatgpt.com`（登录与订阅额度）和/或 `api.openai.com`（API 计费）。**「命令能跑但经常断流、超时」在国内直连网络下是常态**，先按下面步骤确认网络路径，再去怀疑其他配置。

## 第一步：验证连通性

在**运行 codex 的同一个终端**里：

```bash
curl -I --max-time 10 https://chatgpt.com
curl -I --max-time 10 https://api.openai.com
```

- 能返回 HTTP 状态码（哪怕 4xx）→ 网络通，问题在别处（去 [02](02-login-auth.md) / [04](04-config.md)）；
- 卡住、超时、`Connection reset` → 就是网络路径问题，继续往下。

## 第二步：配置代理

命令行程序**不一定走系统代理**，显式设置环境变量最可靠（在启动 codex 的那个终端里设置即可，不必全局）：

```powershell
# Windows PowerShell
$env:HTTPS_PROXY = "http://127.0.0.1:7890"
$env:HTTP_PROXY  = "http://127.0.0.1:7890"
$env:NO_PROXY    = "localhost,127.0.0.1"
codex
```

```bash
# macOS / Linux / WSL
export HTTPS_PROXY=http://127.0.0.1:7890
export HTTP_PROXY=http://127.0.0.1:7890
export NO_PROXY=localhost,127.0.0.1
codex
```

注意：

1. **端口要和你代理客户端实际监听的端口一致**（7890/1080/10809…以你的客户端为准）；
2. 代理客户端要开着「允许局域网连接」的对应模式；
3. 想「永久生效」就把这几行写进 shell 配置文件（`.bashrc` / PowerShell `$PROFILE`）——但想清楚再写，长期全局代理会干扰其他工具；
4. 设置后用第一步的 `curl` 再验证一遍，**代理本身不通时会报 `ECONNREFUSED`**（连不上代理端口）。

### 企业内网（MITM 代理）的 TLS 证书报错

公司网络常出现 `unable to verify the first certificate` / `self-signed certificate` 类错误：企业代理会替换 TLS 证书。解决：向 IT 要企业根证书并安装到系统信任链；不要用关闭证书校验的方式「绕过」。

## 第三步：镜像与加速

### npm 安装/更新慢或失败

```bash
npm config set registry https://registry.npmmirror.com
```

### git clone 官方仓库慢

用镜像前缀加速（仅克隆用）：

```bash
git clone https://ghfast.top/https://github.com/openai/codex.git
```

### 用中转站（第三方 API 中转）

如果代理不方便，可以把 Codex 配置成走第三方 API 中转，见 [04 config.toml](04-config.md) 的 `model_providers` 配置。注意甄别中转站资质，API Key 不要发给不可信的第三方。

## `stream disconnected before completion` 深挖

这是社区上报量最大的单一条目之一。按命中率排查：

1. **先分类**：偶发多为网络抖动，按上文配代理；稳定复现才继续往下；
2. **项目在 OneDrive / 同步盘路径里**：同步盘的文件锁会干扰长会话的本地流式读写，把项目移出 OneDrive 再试（Windows 用户高频踩坑）；
3. **超长会话**：上下文接近压缩（compaction）阈值时更容易断——开个新会话对比验证，长任务养成拆分会话的习惯（也省额度，见 [05](05-models-limits.md)）；
4. **代理对 SSE 长连接不稳定**：换支持长连接的节点/客户端，TUN 模式通常比仅终端代理稳；
5. **服务端侧**：`/backend-api/codex/responses` 的断流如与官方社区事故帖时间吻合，等修复即可——[参考帖子](https://community.openai.com/t/bug-codex-stream-disconnected-before-completion-on-backend-api-codex-responses-feb-8-2026/1373656)；走中转的用户检查 `wire_api` 配置（见 [04](04-config.md)）。

## 常见症状对照

| 症状 | 大概率原因 | 处理 |
|---|---|---|
| 生成到一半断掉，报 `stream error` | 网络路径抖动 | 配代理；已配则换节点 |
| `ETIMEDOUT`，一直转圈 | 直连被阻断 | 配代理或换中转 |
| `ECONNREFUSED` | 代理端口没开/写错 | 核对代理客户端端口 |
| 只在 TUI 卡死，`curl` 却正常 | 代理对长连接（SSE）不稳定 | 换支持长连接的节点/客户端 |
| 登录页打不开 | 浏览器没走代理 | 浏览器侧单独确认 |

> 💡 自检脚本 `scripts/codex-doctor` 会自动做连通性探测并给出结论。
