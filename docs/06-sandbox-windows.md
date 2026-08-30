# 06 · 审批、沙箱与 Windows

> 报错关键词：`sandbox`、`exec denied`、写入文件被拒、命令被拦截、Windows 下各种沙箱异常

## 两个核心概念

| 配置 | 可选值 | 含义 |
|---|---|---|
| `approval_policy` | `untrusted` / `on-failure` / `on-request` / `never` | 什么时候要你点确认 |
| `sandbox_mode` | `read-only` / `workspace-write` / `danger-full-access` | 模型能碰哪些文件、能不能联网 |

常用组合：

```bash
codex                                   # 默认：较保守，安全优先
codex --full-auto                       # workspace-write + 少打扰，日常开发的平衡点
codex --dangerously-bypass-approvals-and-sandbox   # 全关，见下方风险提示
```

> ⚠️ **风险提示**：完全绕过审批与沙箱等于让模型直接以你的用户权限执行任意命令、读写任意文件。只应在**一次性容器 / 虚拟机**里使用，不要在日常工作机上长期使用。

## 常见问题

### 模型想写文件被拒 / 命令被拦截

这是沙箱在正常工作，不是 bug。处理顺序：

1. 用 `/status` 确认当前 `approval_policy` 和 `sandbox_mode`；
2. `read-only` 模式下所有写操作都会被拒——日常开发切到 `workspace-write`；
3. 写入目标在项目目录**外**（比如系统目录、用户主目录）也会被拒——把项目放到普通用户目录下，别放在受系统保护的位置；
4. 需要装依赖、跑构建这类被拦的命令，在审批弹窗里批准即可；总是被拦的固定命令考虑调整策略而不是次次手点。

### Windows 原生版沙箱异常

Windows 原生支持仍在持续完善，社区常见问题集中在沙箱实现上：

- 升级到最新版再试（沙箱相关修复很频繁）；
- 确认 PowerShell 执行策略没拦脚本（见 [01](01-installation.md)）；
- 报错稳定复现且升级无效 → 走 WSL2 方案，兼容性最好。

## WSL2 方案（社区最稳路径）

```powershell
# 管理员 PowerShell 里安装 WSL2（默认装 Ubuntu）
wsl --install
```

然后在 Ubuntu 里按 [01](01-installation.md) 正常安装 Node 和 Codex。要点：

1. **项目文件放在 WSL 文件系统里**（如 `~/projects/...`），不要放在 `/mnt/c/...`——跨文件系统 I/O 慢好几倍，权限行为也容易出怪问题；
2. VS Code 用「WSL」扩展连入 WSL，再在 WSL 内运行 Codex，体验和原生一致；
3. WSL 里的代理要单独配置（[03 网络与代理](03-network-proxy.md)），`127.0.0.1` 指向的是 WSL 自己；新版 WSL2 可用 mirrored 网络模式共享 Windows 侧代理，或在代理客户端里开启「允许局域网连接」并写 Windows 主机在 WSL 里的网关 IP。

## 什么时候才需要 `danger-full-access`

- 在 Docker / VM / 一次性云主机里跑自动化任务；
- 明确知道模型要做什么，且任务本身需要大范围系统访问。

即使在这些场景，也建议先试 `workspace-write`——大部分开发任务它就够了。
