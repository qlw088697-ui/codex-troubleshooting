English | [中文](README.md)

# Codex Troubleshooting — Maintenance & Troubleshooting Guide for Codex CLI

> A community-maintained guide for [Codex CLI](https://github.com/openai/codex), focused on the problems users actually hit: **401 after login, config not taking effect, network timeouts, usage limits (429), sandbox on Windows, missing MCP tools** — each with a symptom → cause → fix path.
>
> **Every topic guide is available in English** — the map below links straight to the English versions; each one cross-links back to the Chinese original.

[![CI](https://github.com/qlw088697-ui/codex-troubleshooting/actions/workflows/ci.yml/badge.svg)](https://github.com/qlw088697-ui/codex-troubleshooting/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/qlw088697-ui/codex-troubleshooting?label=release)](https://github.com/qlw088697-ui/codex-troubleshooting/releases)
[![Latest Codex](https://img.shields.io/github/v/release/openai/codex?label=latest%20codex)](docs/releases.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20WSL-lightgrey)](docs/06-sandbox-windows.md)

> 📖 **Read online**：<https://qlw088697-ui.github.io/codex-troubleshooting/> (docsify site with full-text search, kept in sync with this repo)

## Quick start: run the environment self-check first

When anything misbehaves, start with the doctor script (read-only, changes nothing):

```bash
# macOS / Linux / WSL
curl -fsSL https://raw.githubusercontent.com/qlw088697-ui/codex-troubleshooting/main/scripts/codex-doctor.sh | bash
```

```powershell
# Windows PowerShell
irm https://raw.githubusercontent.com/qlw088697-ui/codex-troubleshooting/main/scripts/codex-doctor.ps1 | iex
```

## Symptom → doc map

Guides are written in Chinese (commands and error strings are universal):

| Symptom | Read |
|---|---|
| Install fails / `codex: command not found` / upgrade & rollback | [01 Installation](docs/01-installation.en.md) |
| **401 Unauthorized** after successful login / `Exceeded retry limit` | [02 Login & auth](docs/02-login-auth.en.md) + [08 Quick reference](docs/08-errors-quickref.en.md) |
| 403 Forbidden | [02 Login & auth](docs/02-login-auth.en.md) |
| 429 / "You've hit your usage limit" | [05 Models & limits](docs/05-models-limits.en.md) |
| Timeouts / stream error / unreachable from some regions | [03 Network & proxy](docs/03-network-proxy.en.md) |
| Custom relay endpoints / config not taking effect | [04 config.toml](docs/04-config.en.md) |
| Sandbox blocks writes / Windows quirks / prefer WSL2 | [06 Sandbox & Windows](docs/06-sandbox-windows.en.md) |
| MCP tools missing / server won't start | [07 MCP](docs/07-mcp.en.md) |
| 401 / config drift inside VS Code / Cursor | [10 IDE integration](docs/10-ide-vscode.en.md) |
| Use Codex faster & cheaper (commands / project memory / scripting) | [11 Efficiency tips](docs/11-tips.en.md) |
| Cleanup / backup / migrate to a new machine / full reset | [09 Maintenance](docs/09-maintenance.en.md) |
| Track new Codex releases | [Release tracker](docs/releases.md) (auto-updated weekly by CI) |

## The five-step triage (works for ~80% of issues)

1. **Version**: run `codex --version` — upgrade first, many bugs are version-specific;
2. **State**: in the TUI run `/status` — confirm the model, provider, approval & sandbox mode are what you think they are;
3. **Doctor**: run `scripts/codex-doctor` — it covers connectivity and the classic config mistakes;
4. **Logs**: check `~/.codex/log/` — far more context than the one-line terminal error;
5. **Minimal repro**: empty directory + move `~/.codex/config.toml` aside + re-login ([09](docs/09-maintenance.en.md)).

## Repo layout

```
docs/        eleven topic guides, fully bilingual (中文 + English) + releases.md (auto tracker)
scripts/     codex-doctor.ps1 / .sh (self-check), check-links.sh & check-consistency.sh (CI), gen-releases.mjs (CI)
index.html   docsify site (served via GitHub Pages)
AGENTS.md    contribution guide for AI coding agents
.github/     CI workflows & issue template
```

## Contributing

💬 Questions and discussions: [Discussions](https://github.com/qlw088697-ui/codex-troubleshooting/discussions).

See [CONTRIBUTING.md](CONTRIBUTING.md) (Chinese, short): paste the raw error (redacted), note your Codex version + OS, include a verification step. CI runs script syntax checks and relative-link checks on every PR.

## Links

- [openai/codex — official repo](https://github.com/openai/codex) (its Issues are the best living troubleshooting database)
- [Official Codex docs](https://developers.openai.com/codex/)

## License

[MIT](LICENSE) © 2026
