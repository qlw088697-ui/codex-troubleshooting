# 08 · 常见报错速查表

> 用法：Ctrl+F 搜你终端里的报错关键词 → 按表跳详细文档。
>
> 先跑一次 [环境自检脚本](../scripts/codex-doctor.ps1)，它覆盖了本表里一半以上的检查项。

## 状态码先分清

| 状态码 | 含义 | 详细文档 |
|---|---|---|
| `401` | 认证失败——没认出你是谁（凭据无效/过期/发错端点） | [02 登录与认证](02-login-auth.md) |
| `403` | 授权失败——认出你了，但你没权限（模型权限/地区/组织策略） | [02 登录与认证](02-login-auth.md) |
| `429` | 用量问题——额度用完或速率超限 | [05 模型与限额](05-models-limits.md) |
| `5xx` | 服务端/中转站故障 | 稍后重试；中转站用户先确认中转站状态 |

## 报错关键词 → 处理

| 报错/症状 | 大概率原因 | 去哪看 |
|---|---|---|
| `Exceeded retry limit, last error: 401 Unauthorized` | 登录态过期/损坏，或凭据与端点不匹配 | [02](02-login-auth.md) 决策树 |
| ChatGPT 登录成功但一直 401 | 配置冲突：第三方 provider / 环境变量残留 | [02](02-login-auth.md) 第②⑤步、[04](04-config.md) 清单 |
| `403 Forbidden` | 模型权限 / 地区 / 组织策略 | [02](02-login-auth.md) |
| `You've hit your usage limit`（429） | 订阅额度窗口用完 | [05](05-models-limits.md) |
| `insufficient_quota` | API 账户欠费 | [05](05-models-limits.md) |
| `model_not_found` | 模型名错误 / 无权限 / 中转站不支持 | [05](05-models-limits.md) |
| `stream error` / `stream disconnected` | 网络路径抖动（国内直连高发） | [03 网络与代理](03-network-proxy.md) |
| `ETIMEDOUT` / 长时间转圈 | 直连被阻断或代理没生效 | [03](03-network-proxy.md) |
| `ECONNREFUSED` | 代理端口没开/写错 | [03](03-network-proxy.md) |
| TLS / 证书类报错 | 企业 MITM 代理替换证书 | [03](03-network-proxy.md) |
| `failed to parse config` / `TOML parse error` | config.toml 语法错误 | [04](04-config.md) |
| 配置写了但**不生效** | 根级键写在 `[表]` 之后 / 忘了重启会话 | [04](04-config.md) 第一大坑 |
| `codex: command not found` | PATH 问题 | [01](01-installation.md) |
| `EACCES` / `EPERM`（安装时） | npm 全局目录权限 | [01](01-installation.md) |
| PowerShell「禁止运行脚本」 | 执行策略拦截 `codex.ps1` | [01](01-installation.md) |
| 写文件被拒 / 命令被拦截 | 沙箱正常工作，策略太严 | [06 沙箱与 Windows](06-sandbox-windows.md) |
| Windows 沙箱异常 | 原生支持不完善 | [06](06-sandbox-windows.md)，或改用 WSL2 |
| MCP 工具不出现 | server 没起来（Windows `cmd /c` 坑） | [07 MCP](07-mcp.md) |

## 通用排查五步法（速记）

```
1. codex --version          ← 版本，旧版先升级
2. /status                  ← 当前 model / provider / 沙箱模式是否符合预期
3. 跑自检脚本                ← scripts/codex-doctor
4. 看日志 ~/.codex/log/      ← 报错上下文比终端一句话详细
5. 最小化复现                ← 空目录 + 移走 config.toml 重登测试
```
