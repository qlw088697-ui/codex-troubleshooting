# 09 · 日常维护：升级、清理、备份、迁移、重置

> 面向长期使用 Codex 的用户：把这几件例行操作流程化，出问题时能快速恢复。

## `~/.codex` 目录导览

```
~/.codex/
├── config.toml    # 你的配置（自建/修改）
├── auth.json      # 登录凭据（等同密码，勿外传）
├── log/           # 运行日志，排障重点看这里
└── sessions/      # 会话历史记录（占用会随使用增长）
```

不同版本目录内容略有差异，以实际为准。

## 版本策略与升级

- **稳定优先**：正在赶工期就别升级；升级放在任务间隙，并预留回滚时间。
- **升级流程**：
  ```bash
  codex --version                          # 1. 记下当前版本
  npm install -g @openai/codex@latest      # 2. 升级（brew 用户：brew upgrade codex）
  codex --version                          # 3. 确认新版本
  ```
- **回滚**：
  ```bash
  npm install -g @openai/codex@<旧版本号>
  ```
- 升级后首次使用，用 `/status` 核对模型与配置是否如常——大版本偶尔伴随配置键变更。

## 例行清理

| 对象 | 操作 | 频率 |
|---|---|---|
| 会话历史 `~/.codex/sessions/` | 确认不需要回溯后按需删除/归档 | 按需 |
| 日志 `~/.codex/log/` | 可直接清空 | 出问题前先留档 |
| npm 缓存 | `npm cache clean --force` | npm 异常时 |

> 💡 清理前不需要停 Codex，但正在进行的会话记录会被影响，别在重要任务进行中清。

## 备份与迁移机器

**需要备份的只有两样**：

```bash
cp ~/.codex/config.toml ~/codex-backup-config.toml
cp ~/.codex/auth.json  ~/codex-backup-auth.json
```

1. `config.toml` 是纯文本配置，随便备份、随便看；
2. `auth.json` 是凭据——**备份文件本身要当作密码对待**：不要进网盘明文、不要进 git、迁移完就删。

新机器恢复：装好 Codex 后把两个文件放回 `~/.codex/` 即可。如果 auth.json 较旧导致 401，重新 `codex login` 一次。

## 完全重置（终极大招）

适用：配置怎么改都不生效、401 查不出原因、想从零开始。**会清掉所有会话历史，先备份。**

```bash
# 1. 备份（见上节）
# 2. 登出并清理
codex logout
rm -rf ~/.codex
# 3. 重新登录（凭据回到初始状态）
codex login
# 4. 对照 04 篇重建 config.toml —— 建议只加你确认需要的配置，逐项验证
```

重置后如果问题**消失**，说明是旧配置/凭据残留；如果**还在**，按 [08 速查表](08-errors-quickref.md) 走网络与版本路线。

## 排障日志

- 日志在 `~/.codex/log/`，报错上下文（完整 URL、状态码、重试过程）通常比终端一行话详细得多，提 Issue / 求助时**先翻日志**；
- 提交日志前脱敏：里面的 URL、账号信息可能含敏感内容。
