English | [中文](13-codex-doctor.md)

# 13 · codex-doctor CLI: One Command for Maintenance

> The repo ships a **zero-dependency** CLI (Node 18.15+, standard library only): environment checks, archiving, backups, release tracking — no more manual checklist walks.

## Run it

```bash
# Option 1: npx (published on npm, no install)
npx -y @qqq123456789/codex-doctor doctor

# Option 2: run straight from GitHub (skips npm)
npx github:qlw088697-ui/codex-troubleshooting doctor

# Option 3: clone and run locally
git clone https://github.com/qlw088697-ui/codex-troubleshooting.git
node codex-troubleshooting/tool/cli.mjs --help
```

> 📌 The tool always follows the `CODEX_HOME` environment variable: when set, every check targets that directory; otherwise `~/.codex` (the official relocation mechanism). The standalone scripts `scripts/codex-doctor.sh` / `.ps1` honor it too.

## Subcommands

| Command | Purpose | Risk |
|---|---|---|
| `doctor` | Full environment check (**relay-aware**, codex outdated-version detection, MCP command availability, Windows execution policy & system proxy, OneDrive pitfalls, login-state expiry, log directory size; `--no-network` skips probes, `--json` for scripts, `--strict` fails on warnings) | read-only |
| `clean sessions [--days 30]` | Archive session files older than N days (**dry-run by default**, `--yes` to execute) | low (archive, not delete) |
| `clean logs [--days 14]` | Same, for logs | low |
| `backup [--out DIR]` | Back up config.toml + auth.json into a timestamped directory | read-only |
| `restore <dir>` | Restore from a backup directory | medium (overwrites) |
| `auth reset` | Back up and delete auth.json, then re-run `codex login` (the 401 last resort, one command) | medium |
| `archive list` | List archive folders with sizes | read-only |
| `archive delete <name\|--all>` | Delete archives (interactive confirm by default, `--yes` to skip) | medium (deletes, requires confirm) |
| `versions [-n 10]` | List the latest openai/codex releases (prerelease flagged) | read-only |
| `config` | Read-only summary: model / provider / approval & sandbox / profiles / relays / MCP / auth mode (secrets masked) | read-only |
| `sessions [-n 10] [--dir keyword]` | Browse past sessions: time, workdir, source, first-prompt preview; `--dir` filters by directory — find "that conversation" | read-only |
| `sessions --search keyword [--deep]` | Search sessions by keyword (first 256KB of each file by default, `--deep` scans fully) | read-only |
| `sessions --show [--search keyword] [--pick N] [--full]` | Print a session's full transcript (latest by default; messages truncated to 400 chars unless `--full`) | read-only |
| `sessions --stats [--days 7] [--dir keyword]` | Session usage stats: input/output/total tokens per session plus window totals — self-check for 429s and where the quota went | read-only |
| `logs [-n 10]` | List log files under `~/.codex/log/` (time, size) | read-only |
| `logs --tail 50 [--file keyword]` | Print the last N lines of a log (newest by default, `--file` picks by name substring) | read-only |
| `logs --search keyword [--all]` | Search logs for a keyword (newest file only by default, `--all` scans everything) | read-only |
| `logs --errors [--all]` | Show only ERROR/WARN/PANIC/FATAL lines — run this to grab evidence before filing an issue | read-only |
| `update` | Check the latest npm version and how to update | read-only |
| `report [--out FILE]` | One-shot redacted evidence report (Markdown): doctor checks + config summary + error log lines + 7-day usage; keys/tokens/emails auto-masked — run it before filing an issue | read-only (writes one report file) |

## Design principles

1. **Zero dependencies**: Node standard library only — no supply-chain surface;
2. **Safe by default**: destructive operations are dry-run unless `--yes`; `clean` **archives** into `~/.codex/archive/` instead of deleting;
3. **auth.json is a password**: `backup` reminds you to guard the backup directory;
4. **Non-interactive protection**: without a TTY (CI/scripts) confirmations are unavailable — you must pass `--yes` explicitly.

## Examples

```bash
# weekly checkup
codex-doctor doctor

# see what's older than 30 days in sessions (dry run, changes nothing)
codex-doctor clean sessions --days 30

# actually archive
codex-doctor clean sessions --days 30 --yes

# before migrating machines
codex-doctor backup
# on the new machine
codex-doctor restore ~/.codex-backups/2026-08-31-10-00-00

# grab evidence before filing an issue (logs carry far more context than the terminal)
codex-doctor logs --errors

# close to the limit? see which sessions consumed the last 7 days
codex-doctor sessions --stats --days 7

# one-shot evidence report before filing an issue / discussion (auto-redacted; skim before sharing)
codex-doctor report
```

## Relation to scripts/

`scripts/codex-doctor.ps1` / `.sh` are single-file, read-only checkers — handy to toss at a friend. The CLI is the full maintenance tool with identical checks plus cleaning/backup/restore/version tracking. Pick either; results match.
