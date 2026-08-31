English | [中文](10-ide-vscode.md)

# 10 · IDE Integration (VS Code / Cursor)

> Keywords: extension won't install, 401 inside the extension, extension config not taking effect, extension behaves differently from the terminal

## Understand the architecture first — it saves half the detour

- The IDE extension and the CLI **share the same** `~/.codex` (`config.toml`, `auth.json`) — so the troubleshooting in [02 Login & auth](02-login-auth.en.md) and [04 config.toml](04-config.en.md) applies to the extension too;
- The extension and the CLI are **two independently released artifacts**: upgrading one doesn't necessarily upgrade the other;
- Step one is always recording both versions: `codex --version` in the terminal + the version shown in the extension panel.

## Common problems

### The extension keeps asking to log in / 401 after login

1. Credentials are shared: run the [02 401 decision tree](02-login-auth.en.md) in the terminal first — if the CLI side is broken, the extension can't work;
2. CLI fine, only the extension broken: run "Developer: Reload Window" so the extension refreshes its cached credentials;
3. Still failing: delete `~/.codex/auth.json`, then re-login **from the extension's own login entry** (not the terminal);
4. Multiple IDEs (VS Code + Cursor) on the same account: one side refreshing tokens can invalidate the other's session — re-login in whichever IDE shows the 401.

### Changed config, the extension doesn't pick it up

- `config.toml` is shared, but **already-open sessions don't hot-reload** — start a new conversation in the extension;
- Big trap: an IDE launched from the GUI cannot read environment variables from shell profiles (`.bashrc` / PowerShell `$PROFILE`). Anything env-dependent — `OPENAI_BASE_URL`, proxy, MCP `env` — must be configured in `config.toml` / the extension settings, or injected by the IDE launcher. Hoping your terminal `export` carries over will not work.

### The extension behaves differently from the terminal

- Confirm which environment the IDE actually runs in: native Windows or WSL Remote (see [06](06-sandbox-windows.en.md)) — they can have **different CLI versions** and different default shells;
- WSL users, recommended path: install the "WSL" extension → connect VS Code into WSL → install the CLI and extension inside WSL — behaves like native Linux;
- Run `/status` in the extension and diff it against the terminal's `/status` — the difference is the problem.

### Proxy: terminal works, extension doesn't

The codex process launched by the IDE inherits **the IDE's environment**, not your terminal's:

1. Run the [03 connectivity test](03-network-proxy.en.md) in the VS Code integrated terminal — terminal OK + extension failing = environment difference;
2. Fix: configure the proxy at the system level (affects GUI apps), or in IDE settings, or launch the IDE from a login shell;
3. Restart the whole IDE afterwards (not just the window).

### Where are the logs

- VS Code: Output panel → select the Codex output channel;
- CLI side: `~/.codex/log/` (see [09](09-maintenance.en.md));
- Read both before filing an issue — many "extension bugs" are CLI errors swallowed by the extension.

### Update & downgrade

- Extension: update from the extensions panel; "Install Another Version…" to roll back;
- CLI: `npm install -g @openai/codex@<version>` (see [01](01-installation.en.md));
- When something breaks after an upgrade, pin one side's version to bisect whether the extension or the CLI introduced it.

### Windows: can't enter after choosing the WSL agent / crashes

The "run in WSL" toggle lives in `C:\Users\<you>\.codex\codex-global-state.json`:

1. Fully quit Codex / the IDE;
2. Edit the file and set `runCodexInWindowsSubsystemForLinux` back to `false` (or delete the file to rebuild defaults);
3. Update the WSL components/extensions from the Microsoft Store and restart — old version combinations have crash cases (see [openai/codex #13699](https://github.com/openai/codex/issues/13699)).

## Cursor and other forks

The same logic applies (shared `~/.codex`, shared credentials and config). Some IDE versions have extension-API compatibility quirks: retest in **vanilla VS Code** first to rule out IDE differences before digging deeper.
