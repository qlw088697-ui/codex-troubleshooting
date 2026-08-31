English | [中文](11-tips.md)

# 11 · Efficiency Tips: Slash Commands, Project Memory & Scripting

> Not troubleshooting — using Codex faster, cheaper, steadier. Exact commands depend on your version's `/help` output; Codex iterates fast.

## TUI slash commands cheat sheet

Type `/` in the interactive UI to see all commands. The most-used ones:

| Command | Purpose |
|---|---|
| `/status` | Current model, provider, approval/sandbox mode — troubleshooting step one (see [08](08-errors-quickref.en.md)) |
| `/model` | Switch models (see [05](05-models-limits.en.md)) |
| `/init` | Generate a starter `AGENTS.md` for the current project |
| `/logout` | Clear login state — common in 401 troubleshooting (see [02](02-login-auth.en.md)) |
| `/help` | The full command list |

## AGENTS.md: project memory

Codex reads instruction files (`AGENTS.md`) for every task; a project-root file takes precedence over the user-global one (`~/.codex/AGENTS.md`). Good things to put there:

- **Project conventions**: build/test commands, code style, directory layout;
- **Boundaries**: directories not to touch, actions that require asking first;
- **Known traps**: project-specific quirks you've already hit — so it never hits them again.

Three rules:

1. **Keep it lean** — it enters the context every turn; verbose filler costs quota and dilutes what matters;
2. Generate a starter with `/init`, then prune it down to what you actually want;
3. Commit team-wide conventions into the repo. This very repository ships an [AGENTS.md](../AGENTS.md) governing AI-agent contributions — use it as a template.

## `codex exec`: scripting & CI

Non-interactive mode, for embedding Codex into scripts and pipelines:

```bash
codex exec "Fix the type errors in src/utils.ts and make npm test pass"
```

Key points:

- Output is a plain result stream — easy to consume programmatically and to keep in logs;
- Permissions work the same as interactive mode (`approval_policy` / `sandbox_mode`, see [06](06-sandbox-windows.en.md)) — in CI prefer read-only mode or a disposable container;
- Combine with `--profile` to switch setups (see [04](04-config.en.md)).

## Session management

- **Split long tasks into sessions**: context grows every turn — more expensive, slower, and more stream-drop-prone (see [03](03-network-proxy.en.md), [05](05-models-limits.en.md));
- Session history lives in `~/.codex/sessions/` — revisit or clean it up per [09](09-maintenance.en.md);
- Newer versions support resuming the last session (check `/help` and `codex --help` for your version's actual output).
