# 01 · 安装、更新与回滚

> 适用：Windows / macOS / Linux / WSL。报错关键词：`command not found`、`codex 不是内部或外部命令`、`EACCES`、`EPERM`、`ERR_SOCKET_TIMEOUT`
>
> English version: [01-installation.en.md](01-installation.en.md)

## 三种安装方式

```bash
# 方式一：npm（跨平台，需要 Node.js 20+，建议用当前 LTS 版本）
npm install -g @openai/codex

# 方式二：Homebrew（macOS / Linux）
brew install codex

# 方式三：二进制（不依赖 Node）
# 到 https://github.com/openai/codex/releases 下载对应平台的压缩包，解压后把可执行文件放进 PATH
```

安装后验证：

```bash
codex --version
```

## Windows 安装建议

- Windows 原生（PowerShell / CMD）可以直接用；如果遇到沙箱、权限类问题，社区最稳的路径是 WSL2，见 [06 沙箱与 Windows](06-sandbox-windows.md)。
- npm 全局安装会在 `C:\Users\<你>\AppData\Roaming\npm` 下生成 `codex.cmd` / `codex.ps1`，该目录默认在 PATH 里；如果你自定义过 npm prefix，需要手动把它加进 PATH。

## 常见安装问题

### `codex: command not found` / `codex 不是内部或外部命令`

**原因**：npm 全局 bin 目录不在 PATH 里，或者安装后没有重开终端。

**解决步骤**：

1. 查看全局 bin 目录：
   ```bash
   npm config get prefix        # Windows
   npm bin -g 2>/dev/null || npm config get prefix   # macOS/Linux
   ```
2. 把输出目录（Windows）或其下的 `bin` 目录（macOS/Linux）加入 PATH；
3. **关闭并重开终端**再试（PATH 改动对已打开的会话不生效）；
4. 仍不行就重装一次，观察安装日志里有没有报错。

### PowerShell 提示「禁止运行脚本」（execution policy）

**原因**：npm 在 Windows 上通过 `codex.ps1` 启动，PowerShell 默认执行策略拦截了它。

**解决步骤**：

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

然后重开终端。这条策略只影响当前用户，是官方推荐的安全默认值。

### `EACCES` / `EPERM` 权限错误（npm 安装时）

**原因**：npm 全局目录没有写权限。**不要用 `sudo` 硬装**，会把权限问题越搞越乱。

**解决步骤**（macOS / Linux）：用 nvm 管理 Node，全局安装自然落在用户目录：

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
nvm install --lts
npm install -g @openai/codex
```

Windows 下则以管理员身份运行一次安装，或者用 `npm config set prefix` 把全局目录改到用户目录下。

### 安装超时 / `ERR_SOCKET_TIMEOUT` / 下载中断

**原因**：默认 npm 源在国内网络下不稳定，属于网络问题而不是 Node 问题。

**解决步骤**：换镜像源后重装（更多见 [03 网络与代理](03-network-proxy.md)）：

```bash
npm config set registry https://registry.npmmirror.com
npm install -g @openai/codex
```

## 更新与回滚

```bash
# 查看当前版本
codex --version

# npm 安装的更新
npm install -g @openai/codex@latest

# brew 安装的更新
brew upgrade codex

# 回滚到指定版本（版本号去 npm 或 Releases 页面查）
npm install -g @openai/codex@<版本号>
```

> 💡 升级前记下当前版本号，出问题随时可回滚；`~/.codex/config.toml` 不会被升级覆盖，但大版本升级后建议按 [09 日常维护](09-maintenance.md) 做一次配置核对。
