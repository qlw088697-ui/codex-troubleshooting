English | [中文](01-installation.md)

# 01 · Installation, Update & Rollback

> Applies to: Windows / macOS / Linux / WSL. Keywords: `command not found`, `EACCES`, `EPERM`, `ERR_SOCKET_TIMEOUT`, `running scripts is disabled`

## Three ways to install

```bash
# 1) npm (cross-platform, needs Node.js 20+ — use the current LTS)
npm install -g @openai/codex

# 2) Homebrew (macOS / Linux)
brew install codex

# 3) Binary (no Node dependency)
# Download the archive for your platform from https://github.com/openai/codex/releases,
# extract it, and put the executable on your PATH
```

Verify:

```bash
codex --version
```

## Windows advice

- Native Windows (PowerShell / CMD) works out of the box; if you hit sandbox or permission problems, the community's most reliable path is WSL2 — see [06 Sandbox & Windows](06-sandbox-windows.en.md).
- A global npm install creates `codex.cmd` / `codex.ps1` under `C:\Users\<you>\AppData\Roaming\npm`, which is on PATH by default; if you customized the npm prefix, add that directory to PATH manually.

## Common install problems

### `codex: command not found`

**Cause**: the npm global bin directory is not on PATH, or the terminal wasn't restarted after install.

**Steps**:

1. Find the global directory:
   ```bash
   npm config get prefix        # Windows
   npm bin -g 2>/dev/null || npm config get prefix   # macOS/Linux
   ```
2. Add that directory (Windows) or its `bin` subdirectory (macOS/Linux) to PATH;
3. **Close and reopen the terminal** — PATH changes don't affect already-open sessions;
4. Still failing: reinstall once and read the install log for the real error.

### PowerShell: "running scripts is disabled"

**Cause**: npm launches codex via `codex.ps1` on Windows, and the default execution policy blocks it.

**Steps**:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Then reopen the terminal. This only affects the current user and is the recommended safe default.

### `EACCES` / `EPERM` during `npm install -g`

**Cause**: no write permission on the npm global directory. **Do not force it with `sudo`** — it makes the mess worse.

**Steps** (macOS / Linux): manage Node with nvm so global installs land in your home directory:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
nvm install --lts
npm install -g @openai/codex
```

On Windows: run the install once as administrator, or move the global prefix into your user directory with `npm config set prefix`.

### Install times out / `ERR_SOCKET_TIMEOUT` / download interrupted

**Cause**: the default npm registry is unstable on some networks — it's a network problem, not a Node problem.

**Steps**: switch the registry and retry (more in [03 Network & proxy](03-network-proxy.en.md)):

```bash
npm config set registry https://registry.npmmirror.com
npm install -g @openai/codex
```

## Update & rollback

```bash
# current version
codex --version

# update (npm)
npm install -g @openai/codex@latest

# update (brew)
brew upgrade codex

# roll back to a specific version (see npm / Releases pages for numbers)
npm install -g @openai/codex@<version>
```

> 💡 Note the current version before upgrading so you can always roll back. `~/.codex/config.toml` is not overwritten by upgrades, but after a major upgrade it's worth a config review per [09 Maintenance](09-maintenance.en.md).
