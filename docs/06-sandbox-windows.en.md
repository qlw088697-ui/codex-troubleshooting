English | [中文](06-sandbox-windows.md)

# 06 · Approvals, Sandbox & Windows

> Keywords: `sandbox`, `exec denied`, writes refused, commands intercepted, sandbox quirks on Windows

## Two core concepts

| Setting | Values | Meaning |
|---|---|---|
| `approval_policy` | `untrusted` / `on-failure` / `on-request` / `never` | When you get asked to confirm |
| `sandbox_mode` | `read-only` / `workspace-write` / `danger-full-access` | Which files the model may touch |

Common presets:

```bash
codex                                   # default: conservative, safety first
codex --full-auto                       # workspace-write + fewer interruptions — the daily-driver balance
codex --dangerously-bypass-approvals-and-sandbox   # everything off — see the risk note below
```

> ⚠️ **Risk note**: bypassing approvals and sandbox lets the model run arbitrary commands and read/write arbitrary files with your user privileges. Reserve it for disposable containers / VMs — don't run it long-term on your daily machine.

## Common problems

### Writes refused / commands intercepted

The sandbox is working, not broken. In order:

1. `/status` to confirm the current `approval_policy` and `sandbox_mode`;
2. `read-only` refuses all writes — switch to `workspace-write` for daily development;
3. Writes **outside** the project directory (system dirs, your home dir) are refused too — keep projects in a normal user directory, not system-protected locations;
4. Dependency installs / builds that keep getting intercepted: approve them in the prompt; for recurring commands, adjust the policy instead of clicking every time.

### "Trust this folder" prompt on every launch

Newer versions no longer trust directories by default and ask on first use. If the prompt keeps coming back:

1. Choose to trust the directory, then **restart the session**;
2. `/status` to confirm trust state and the approval/sandbox settings took effect;
3. VS Code users: also mark the folder as a Trusted Workspace in VS Code and reload the window — **both** sides must trust it;
4. Still prompting on every launch: upgrade to the latest version — the prompt's persistence has been fixed repeatedly across versions (see [openai/codex #14547](https://github.com/openai/codex/issues/14547), [#14345](https://github.com/openai/codex/issues/14345)).

> Don't reach for `--dangerously-bypass-approvals-and-sandbox` just to skip the prompt — that's a different, bigger risk (see above).

### Sandbox quirks on native Windows

Native Windows support is still maturing; most reported issues concentrate in the sandbox implementation:

- Upgrade to the latest version first (sandbox fixes land frequently);
- Make sure PowerShell execution policy isn't blocking scripts (see [01](01-installation.md));
- Stably reproducible even after upgrading → use the WSL2 route below, the most compatible path;
- Sharing projects between Windows and WSL causes "corrupted files / line-ending warnings": add a `.gitattributes` to pin line endings (e.g. `* text=auto eol=lf`) and stop the CRLF/LF ping-pong;
- Scripts and CI that need a fixed shell: specify the shell explicitly instead of relying on "the default shell" — on Windows it differs by terminal (PowerShell / cmd / Git Bash).

## WSL2 route (the most reliable path)

```powershell
# Admin PowerShell (installs Ubuntu by default)
wsl --install
```

Then install Node and Codex inside Ubuntu per [01](01-installation.md). Key points:

1. **Keep project files inside the WSL filesystem** (e.g. `~/projects/...`), not `/mnt/c/...` — cross-filesystem I/O is several times slower and permission behavior gets weird;
2. VS Code: install the "WSL" extension, connect into WSL, then install the CLI and extension inside WSL — behaves like native Linux;
3. Proxy must be configured separately inside WSL ([03](03-network-proxy.md)) — inside WSL, `127.0.0.1` points to WSL itself. Newer WSL2 offers a mirrored networking mode that shares the Windows-side proxy; alternatively enable "allow LAN connections" in your proxy client and point WSL at the Windows host gateway IP. Login-callback problems (browser authorized but credentials never arrive in WSL) are covered in [02's WSL section](02-login-auth.en.md).

## When do you actually need danger-full-access

- Automation inside Docker / VMs / disposable cloud boxes;
- You know exactly what the model will do, and the task genuinely requires broad system access.

Even then, try `workspace-write` first — it covers most development work.
