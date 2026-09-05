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

## Subcommands

| Command | Purpose | Risk |
|---|---|---|
| `doctor` | Full environment check (**relay-aware**: probes your configured relay endpoint instead of official ones; codex outdated-version detection, Windows execution policy & system proxy, OneDrive pitfalls; `--no-network` skips probes, `--json` for scripts, `--strict` fails on warnings) | read-only |
| `clean sessions [--days 30]` | Archive session files older than N days (**dry-run by default**, `--yes` to execute) | low (archive, not delete) |
| `clean logs [--days 14]` | Same, for logs | low |
| `backup [--out DIR]` | Back up config.toml + auth.json into a timestamped directory | read-only |
| `restore <dir>` | Restore from a backup directory | medium (overwrites) |
| `auth reset` | Back up and delete auth.json, then re-run `codex login` (the 401 last resort, one command) | medium |
| `archive list` | List archive folders with sizes | read-only |
| `archive delete <name\|--all>` | Delete archives (interactive confirm by default, `--yes` to skip) | medium (deletes, requires confirm) |
| `versions [-n 10]` | List the latest openai/codex releases (prerelease flagged) | read-only |
| `update` | Check the repo's latest release and how to update | read-only |

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
```

## Relation to scripts/

`scripts/codex-doctor.ps1` / `.sh` are single-file, read-only checkers — handy to toss at a friend. The CLI is the full maintenance tool with identical checks plus cleaning/backup/restore/version tracking. Pick either; results match.
