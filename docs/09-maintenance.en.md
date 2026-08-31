English | [中文](09-maintenance.md)

# 09 · Maintenance: Upgrade, Cleanup, Backup, Migration, Reset

> For long-term Codex users: turning these routines into habits means fast recovery when things break.

## A tour of `~/.codex`

```
~/.codex/
├── config.toml    # your configuration (created/edited by you)
├── auth.json      # login credentials (treat as a password, never share)
├── log/           # runtime logs — the first place to look when troubleshooting
└── sessions/      # session history (grows with usage)
```

Directory contents vary slightly between versions; trust what you actually see.

## Version strategy & upgrading

- **Stability first**: don't upgrade mid-sprint; upgrade between tasks and keep rollback time in reserve.
- **Upgrade routine**:
  ```bash
  codex --version                          # 1. note the current version
  npm install -g @openai/codex@latest      # 2. upgrade (brew: brew upgrade codex)
  codex --version                          # 3. confirm the new version
  ```
- **Rollback**:
  ```bash
  npm install -g @openai/codex@<old-version>
  ```
- After a major upgrade, use `/status` on first run to confirm model and config behave as before — major versions occasionally change config keys.

## Routine cleanup

| Target | Action | Frequency |
|---|---|---|
| Session history `~/.codex/sessions/` | Archive or delete once you don't need to revisit them | As needed |
| Logs `~/.codex/log/` | Safe to clear | Keep them until a problem is diagnosed first |
| npm cache | `npm cache clean --force` | When npm misbehaves |

> 💡 You don't need to stop Codex, but in-flight sessions are affected — never clean in the middle of an important task.

## Backup & machine migration

**Only two things need backing up**:

```bash
cp ~/.codex/config.toml ~/codex-backup-config.toml
cp ~/.codex/auth.json  ~/codex-backup-auth.json
```

1. `config.toml` is plain text — back it up freely, read it freely;
2. `auth.json` is a credential — **treat the backup itself as a password**: no plaintext cloud drives, never into git, delete after migrating.

Restore on a new machine: install Codex, put both files back into `~/.codex/`. If an older `auth.json` causes 401, just `codex login` once more.

## Full reset (the last resort)

Use when: config changes never take effect, 401s with no identifiable cause, or starting from scratch. **Wipes all session history — back up first.**

```bash
# 1. back up (see above)
# 2. log out and clear
codex logout
rm -rf ~/.codex
# 3. log in again (credentials back to a pristine state)
codex login
# 4. rebuild config.toml against 04 — add only what you know you need, verify item by item
```

If the problem **disappears** afterwards, it was stale config/credentials; if it **persists**, follow the network & version routes in [08](08-errors-quickref.md).

## Logs

- Logs live in `~/.codex/log/` — the error context (full URL, status code, retries) is far richer than the terminal's one-liner; **read the log before filing an issue or asking anywhere**;
- Redact before submitting: URLs and account info inside logs can be sensitive.
