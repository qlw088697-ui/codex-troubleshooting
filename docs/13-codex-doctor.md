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

> 📌 工具全程跟随 `CODEX_HOME` 环境变量：设置了就检查该目录，未设置用 `~/.codex`（官方重定位机制）。自检脚本 `scripts/codex-doctor.sh` / `.ps1` 同样支持。

## 子命令一览

| 命令 | 作用 | 危险性 |
|---|---|---|
| `doctor` | 全套环境自检（**中转模式感知**、codex 版本过期检测、MCP 启动命令可达性、auth.json 结构校验（损坏/空壳检出）、Windows 执行策略与系统代理、OneDrive 坑位、登录态有效期、log 目录体积；`--no-network` 跳过网络探测，`--json` 供脚本消费，`--strict` 有警告也返回非零） | 只读 |
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
| `sessions --stats [--days 7] [--dir 关键字]` | 会话用量统计：每个会话的输入/输出/合计 tokens 与窗口内总计——429 自查、看额度花在哪 | 只读 |
| `logs [-n 10]` | 列出 `~/.codex/log/` 下的日志文件（时间、大小） | 只读 |
| `logs --tail 50 [--file 关键字]` | 查看日志末尾 N 行（默认最新一个文件，`--file` 按文件名关键字选择） | 只读 |
| `logs --search 关键词 [--all]` | 在日志里搜关键词（默认只搜最新一个，`--all` 扫全部日志） | 只读 |
| `logs --errors [--all]` | 一键过滤 ERROR/WARN/PANIC/FATAL 级别行——提 Issue 前先跑它取证 | 只读 |
| `history [-n 20] [--search 关键词]` | 浏览 `~/.codex/history.jsonl` 输入历史，找回「刚才想用的那条命令」（坏行自动跳过） | 只读 |
| `update` | 查询 npm 上工具的最新版本与更新方式 | 只读 |
| `report [--out FILE]` | 一键生成脱敏取证报告（Markdown）：环境自检 + 配置摘要 + 报错日志 + 7 天用量，Key/token/邮箱自动打码——提 Issue 前跑它 | 只读（写出一个报告文件） |

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

# 提 Issue 前快速取证（报错上下文比终端一行话详细得多）
codex-doctor logs --errors

# 额度快花完时，看看最近 7 天用量都花在哪些会话
codex-doctor sessions --stats --days 7

# 提 Issue / 发 Discussions 前一键取证（自动脱敏，分享前快速过一遍即可）
codex-doctor report
```

## 与 scripts/ 下自检脚本的关系

`scripts/codex-doctor.ps1` / `.sh` 是单文件只读自检，方便直接甩给朋友跑；本 CLI 是完整维护工具，检查项一致且多了清理/备份/恢复/版本查询能力。二选一即可，检查结果相同。
