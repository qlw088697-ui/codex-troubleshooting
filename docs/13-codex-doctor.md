# 13 · codex-doctor CLI：把维护变成一条命令

> 仓库自带的**零依赖**命令行工具（Node 18.15+，仅用标准库）。自检、清理、备份、版本追踪，不用再手动对照文档操作。
>
> English version: [13-codex-doctor.en.md](13-codex-doctor.en.md)

## 运行方式

```bash
# 方式一：npx 直跑（发布在 npm，无需安装）
npx -y @qqq123456789/codex-doctor doctor

# 方式二：直接从 GitHub 跑（不经过 npm）
npx github:qlw088697-ui/codex-troubleshooting doctor

# 方式三：克隆仓库后本地跑
git clone https://github.com/qlw088697-ui/codex-troubleshooting.git
node codex-troubleshooting/tool/cli.mjs --help
```

## 子命令一览

| 命令 | 作用 | 危险性 |
|---|---|---|
| `doctor` | 全套环境自检（**中转模式感知**：自动探测你配置的中转端点而非官方端点；含 codex 版本过期检测、Windows 执行策略与系统代理、OneDrive 坑位；`--no-network` 跳过探测，`--json` 供脚本消费，`--strict` 有警告也返回非零） | 只读 |
| `clean sessions [--days 30]` | 归档超过 N 天的会话文件（默认**预演**，`--yes` 才执行） | 低（归档而非删除） |
| `clean logs [--days 14]` | 同上，针对日志 | 低 |
| `backup [--out DIR]` | 备份 config.toml + auth.json 到带时间戳目录 | 只读 |
| `restore <dir>` | 从备份目录恢复 | 中（覆盖现有文件） |
| `auth reset` | 备份并删除 auth.json，引导重新 `codex login`（401 终极大招的一键化） | 中 |
| `archive list` | 查看归档目录与体积 | 只读 |
| `archive delete <名称\|--all>` | 删除归档（默认需交互确认，`--yes` 跳过） | 中（删除，需确认） |
| `versions [-n 10]` | 查看 openai/codex 最近 N 个版本（含预发布标记） | 只读 |
| `config` | 只读摘要：模型 / provider / 审批沙箱 / profiles / 中转 / MCP / 认证方式（敏感值脱敏） | 只读 |
| `sessions [-n 10] [--dir 关键字]` | 浏览历史会话：时间、工作目录、来源、首条提问预览；`--dir` 按目录过滤，找回「上次那个对话」 | 只读 |
| `sessions --search 关键词 [--deep]` | 按关键词搜索会话（默认搜每个文件开头 256KB，`--deep` 全文扫描） | 只读 |
| `sessions --show [--search 关键词] [--pick N] [--full]` | 查看会话完整对话（默认最近一次；默认单条截断 400 字） | 只读 |
| `update` | 查询 npm 上工具的最新版本与更新方式 | 只读 |

## 设计原则

1. **零依赖**：只用 Node 标准库，装了 Node 就能跑，不存在供应链风险；
2. **安全默认**：一切破坏性操作默认预演（dry-run），加 `--yes` 才真正执行；`clean` 是**归档**到 `~/.codex/archive/` 而不是删除，随时可搬回来；
3. **auth.json 等同密码**：`backup` 完成时会提醒你保管好备份目录；
4. **非交互环境保护**：没有 TTY 时（CI / 脚本）确认交互不可用，必须显式 `--yes`，防止误执行。

## 使用示例

```bash
# 每周例行体检
codex-doctor doctor

# 查看 30 天前的会话都有些什么（预演，不改动）
codex-doctor clean sessions --days 30

# 确认后真正归档
codex-doctor clean sessions --days 30 --yes

# 迁移机器前
codex-doctor backup
# 新机器上
codex-doctor restore ~/.codex-backups/2026-08-31-10-00-00
```

## 与 scripts/ 下自检脚本的关系

`scripts/codex-doctor.ps1` / `.sh` 是单文件只读自检，方便直接甩给朋友跑；本 CLI 是完整维护工具，检查项一致且多了清理/备份/恢复/版本查询能力。二选一即可，检查结果相同。
