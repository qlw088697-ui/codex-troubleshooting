# 08 · Error Quick Reference (English)

> Usage: Ctrl+F for the keyword from your terminal → follow the row to the full guide. The full guides are in Chinese; commands and error strings are universal.
>
> 中文版见 [08-errors-quickref.md](08-errors-quickref.md)。

## Status codes first

| Code | Meaning | Details |
|---|---|---|
| `401` | Authentication failed — invalid/expired credentials, or credentials sent to the wrong endpoint | [02 Login & auth](02-login-auth.md) |
| `403` | Authorization failed — authenticated but not permitted (model access / region / org policy) | [02 Login & auth](02-login-auth.md) |
| `429` | Usage — quota exhausted or rate limited | [05 Models & limits](05-models-limits.md) |
| `5xx` | Server / relay outage | Retry later; relay users check relay status first |

## Error keyword → fix

| Error / symptom | Likely cause | Guide |
|---|---|---|
| `Exceeded retry limit, last error: 401 Unauthorized` | Expired/broken login state, or credential↔endpoint mismatch | [02 decision tree](02-login-auth.md) |
| ChatGPT login succeeds but 401 persists | Config conflict: leftover third-party provider / env vars | [02 steps ②⑤](02-login-auth.md), [04 checklist](04-config.md) |
| `403 Forbidden` | Model permission / region / org policy | [02](02-login-auth.md) |
| `You've hit your usage limit` (429) | Subscription quota window exhausted | [05](05-models-limits.md) |
| `insufficient_quota` | API account out of credit | [05](05-models-limits.md) |
| `model_not_found` | Wrong model name / no access / relay doesn't serve it | [05](05-models-limits.md) |
| `stream error` / `stream disconnected` | Unstable network path | [03 Network & proxy](03-network-proxy.md) |
| `ETIMEDOUT` / endless spinner | Direct connection blocked or proxy not applied | [03](03-network-proxy.md) |
| `ECONNREFUSED` | Proxy port closed or wrong | [03](03-network-proxy.md) |
| TLS / certificate errors | Corporate MITM proxy replacing certs | [03](03-network-proxy.md) |
| `failed to parse config` / `TOML parse error` | config.toml syntax error | [04](04-config.md) |
| Config written but **not taking effect** | Root keys placed after a `[table]` / session not restarted | [04 gotcha](04-config.md) |
| `codex: command not found` | PATH problem | [01 Installation](01-installation.md) |
| `EACCES` / `EPERM` (during install) | npm global directory permissions | [01](01-installation.md) |
| PowerShell "running scripts is disabled" | Execution policy blocking `codex.ps1` | [01](01-installation.md) |
| Writes denied / commands intercepted | Sandbox working as intended, policy too strict | [06 Sandbox & Windows](06-sandbox-windows.md) |
| Sandbox issues on Windows | Native support still maturing | [06](06-sandbox-windows.md), or use WSL2 |
| MCP tools missing | Server failed to start (Windows `cmd /c` wrapper) | [07 MCP](07-mcp.md) |
| 401 / config drift **inside VS Code / Cursor** | Shared `~/.codex` but stale IDE caches / env | [10 IDE](10-ide-vscode.md) |
| Device-code login fails / `token exchange failed` | Device-code auth disabled by default | [02 device code](02-login-auth.md) |
| WSL login credentials never arrive back | WSL ↔ Windows localhost isolation | [02 WSL section](02-login-auth.md) |
| `stream disconnected before completion` | Network / OneDrive folder / very long session | [03 deep dive](03-network-proxy.md) |
| "Trust this folder" prompt on every launch | Directory not trusted / version behavior | [06](06-sandbox-windows.md) |
| Weekly limit reset date keeps moving | Rolling 7-day window, by design | [05](05-models-limits.md) |

## The five-step triage (cheat sheet)

```
1. codex --version          ← version; upgrade first if old
2. /status                  ← current model / provider / sandbox as expected?
3. run the doctor script     ← scripts/codex-doctor.sh or .ps1
4. check ~/.codex/log/       ← far more context than the terminal line
5. minimal repro             ← empty dir + move config.toml aside + re-login
```
