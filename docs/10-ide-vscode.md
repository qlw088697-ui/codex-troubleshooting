# 10 · IDE 集成（VS Code / Cursor）

> 关键词：插件装不上、插件里 401、插件配置不生效、插件和终端行为不一致
>
> English version: [10-ide-vscode.en.md](10-ide-vscode.en.md)

## 先搞清架构，排障不走弯路

- IDE 扩展和 CLI **共享同一份** `~/.codex`（`config.toml`、`auth.json`）——所以 [02 登录与认证](02-login-auth.md)、[04 config.toml](04-config.md) 里的排障方法对插件同样适用；
- 插件与 CLI 是**两个独立的发布物**：CLI 升级了插件不一定跟着升级，反之亦然；
- 排障第一步永远是把两边版本都记下来：终端 `codex --version` + 插件面板里的版本号。

## 常见问题

### 插件反复要求登录 / 登录成功后仍 401

1. 先在终端跑一遍 [02 的 401 决策树](02-login-auth.md)——凭据是共享的，CLI 侧不通插件必然不通；
2. CLI 侧正常、只有插件异常时：执行「Developer: Reload Window」让插件刷新缓存的凭据；
3. 仍不行：删除 `~/.codex/auth.json`，然后**在插件的登录入口里**重新登录（而不是先在终端登）；
4. 多个 IDE（VS Code + Cursor）共用同一账号时，一边刷新 token 可能让另一边会话失效——在报 401 的那个 IDE 里重登一次即可。

### 改了配置，插件里不生效

- `config.toml` 是共享的，但**已开启的会话不会热加载**——在插件里新开一个对话；
- 重要坑：从图形界面启动 IDE 时，进程读不到 shell 配置文件（`.bashrc` / PowerShell `$PROFILE`）里的环境变量。依赖环境变量的东西——`OPENAI_BASE_URL`、代理、MCP 的 `env`——要么写进 `config.toml` / 插件设置，要么从 IDE 启动器里配，指望终端里 `export` 过是不行的。

### 插件里模型的行为和终端不一致

- 确认 IDE 实际运行在哪个环境：Windows 原生还是 WSL Remote（见 [06](06-sandbox-windows.md)）——两边可能装了**不同版本的 CLI**、不同的默认 shell；
- WSL 用户推荐路径：装「WSL」扩展 → VS Code 连入 WSL → 在 WSL 内安装 CLI 和插件，行为与 Linux 一致；
- 在插件里用 `/status`，和终端里的 `/status` 输出对比，差异点就是问题所在。

### Windows 版选了 WSL agent 后进不去 / 崩溃

Codex 的「在 WSL 中运行」开关状态保存在 `C:\Users\<你>\.codex\codex-global-state.json`：

1. 完全退出 Codex / IDE；
2. 编辑该文件，把 `runCodexInWindowsSubsystemForLinux` 改回 `false`（或直接删除该文件让应用重建默认值）；
3. 把 Microsoft Store 里的 WSL 相关组件与扩展更新到最新再重启——旧版本组合有崩溃案例（参考 [openai/codex #13699](https://github.com/openai/codex/issues/13699)）。

### 代理：终端能用，插件不通

IDE 启动的 codex 进程继承的是 **IDE 的环境**，不是你终端的环境：

1. 先在 VS Code 集成终端里跑 [03 的连通性测试](03-network-proxy.md)——终端通、插件不通，基本就是环境差异；
2. 解决：把代理配在系统层面（对 GUI 程序生效），或在 IDE 设置里指定代理，或让 IDE 从登录 shell 启动（VS Code 设置 `terminal.integrated.inheritEnv` 等）；
3. 改完重启 IDE（不只是重开窗口）。

### 日志在哪看

- VS Code：Output 面板 → 下拉选择 Codex 的输出通道；
- CLI 侧：`~/.codex/log/`（见 [09](09-maintenance.md)）；
- 提 Issue 前两边都翻一遍，很多"插件 bug"其实是 CLI 报错被插件吞掉了。

### 更新与降级

- 插件：扩展面板更新；想回退用「Install Another Version…」；
- CLI：`npm install -g @openai/codex@<版本号>`（见 [01](01-installation.md)）；
- 升级后出问题时，先固定一边版本二分定位是插件还是 CLI 引入的。

## Cursor 及其他 fork

排查思路完全同上（共享 `~/.codex`、共享凭据与配置）。个别 IDE 版本对扩展 API 的兼容差异可能导致插件异常：先在**原版 VS Code** 里复测一次，排除 IDE 差异之后再定位，能少走很多弯路。
