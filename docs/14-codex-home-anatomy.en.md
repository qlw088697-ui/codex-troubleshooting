English | [中文](14-codex-home-anatomy.md)

# 14 · Anatomy of `~/.codex`: what's what, what's safe to touch

> Before you touch anything while troubleshooting or cleaning up, know each file's identity: which ones are "passwords", which are "garbage", and what happens if you delete them.

## Three rules before you touch anything

1. **Back up before editing `config.toml` / `auth.json`**: `codex-doctor backup` ([13](13-codex-doctor.en.md)) — restore anytime;
2. **Archive before deleting large files**: `clean` moves files into `~/.codex/archive/` instead of deleting, so you can always move them back ([09](09-maintenance.en.md));
3. **Redact before asking for help**: never share `auth.json`, tokens, or real emails ([CONTRIBUTING](../CONTRIBUTING.md)).

## Item by item

| Path | What it is | Safe to delete? | Notes |
|---|---|---|---|
| `config.toml` | Main config: model, provider/relay, MCP, approval & sandbox | ⚠️ back up first | Root-level keys must sit at the top of the file ([04](04-config.en.md)) |
| `auth.json` | Login credentials (OAuth token / API key) | ❌ never delete or share | **Treat as a password**; the 401 last resort = back up, delete, re-login ([02](02-login-auth.en.md)) |
| `AGENTS.md` | Global project memory, injected into every session | ✅ editable / deletable | The project-root AGENTS.md takes precedence ([11](11-tips.en.md)) |
| `sessions/` | Full session records (date-nested JSONL, incl. token usage) | ✅ archivable | `clean sessions` to archive, `sessions --stats` for usage ([13](13-codex-doctor.en.md)) |
| `log/` | Runtime logs (full error context: URLs, status codes, retries) | ✅ clearable | `logs --errors` for one-shot evidence, `clean logs` to archive ([13](13-codex-doctor.en.md)) |
| `history.jsonl` | The prompts you typed in the terminal | ✅ deletable | Loses only input history; config and credentials unaffected |
| `archive/` | Where `codex-doctor clean` archives to (created by this tool) | ✅ deletable after review | `archive list` / `archive delete` ([13](13-codex-doctor.en.md)) |
| `codex-global-state.json` | IDE global state (incl. the "run in WSL" switch) | ⚠️ carefully | Check it first when the VS Code extension won't open / crashes ([10](10-ide-vscode.en.md)) |
| `requirements.toml` | Enterprise managed policy (pushed by admins) | — | Its presence means the device is managed (likely); deleting it gets it re-pushed |

> Directory contents vary between versions: new files appear, old ones disappear. Research unfamiliar files before touching them; when unsure, **rename** instead of deleting — a rename is reversible.

## Common mistakes

- **"Nuke the whole `~/.codex` and start over"** — wipes login, config, session history and project memory all at once; the most expensive fix. Be surgical instead: 401 → only `auth.json` ([02](02-login-auth.en.md)); config issues → only `config.toml` ([04](04-config.en.md)); disk pressure → archive only `sessions/` and `log/` ([09](09-maintenance.en.md)).
- **Putting `~/.codex` inside a sync drive** (OneDrive etc.) — sync tools taking over credentials and state files is a top cause of stream disconnected and config drift ([03](03-network-proxy.en.md)).
- **Sharing your backup folder** — `codex-doctor backup` output contains `auth.json`; treat it as a password, keep it out of chats and cloud drives.
- **Editing without verifying** — after config changes run `codex-doctor doctor` (read-only checkup) plus `/status` in the TUI to confirm before getting back to work ([13](13-codex-doctor.en.md)).

## Quick map: which symptom, which file

| You want to… | Touch | See |
|---|---|---|
| Re-login / fix 401 | `auth.json` | [02](02-login-auth.en.md) |
| Change model / add relay / add MCP | `config.toml` | [04](04-config.en.md), [07](07-mcp.en.md) |
| Free disk space | archive `sessions/` + `log/` | [09](09-maintenance.en.md), [13](13-codex-doctor.en.md) |
| Read full error context | `log/` | `logs --errors` in [13](13-codex-doctor.en.md) |
| Find a past conversation | `sessions/` | `sessions --search` in [13](13-codex-doctor.en.md) |
| See where the quota went | `sessions/` | `sessions --stats` in [13](13-codex-doctor.en.md) |
| IDE won't open / crashes | `codex-global-state.json` | [10](10-ide-vscode.en.md) |
