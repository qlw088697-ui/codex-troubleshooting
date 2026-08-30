English | [中文](02-login-auth.md)

# 02 · Login & Authentication (where most 401/403 live)

> Keywords: `401 Unauthorized`, `Exceeded retry limit, last error: 401`, `403 Forbidden`, `Not logged in`, logged in fine but no response

## Two auth methods — first figure out which one you're using

| Method | Command | Billing | Stored in |
|---|---|---|---|
| ChatGPT account (Plus / Pro / Team subscriptions) | `codex login` | Subscription quota | `tokens` in `~/.codex/auth.json` |
| API Key | `codex login --api-key` or env `OPENAI_API_KEY` | Pay per use | `auth.json` or environment variable |

Both can coexist — and that is the root of most 401s: **credentials from A sent to the endpoint of B**.

## The 401 decision tree

Ask these five questions in order:

### ① Where is the request actually going?

Look at the URL in the terminal error (or search for URLs in `~/.codex/log/`):

- `chatgpt.com` / `api.openai.com` → official endpoints;
- Any third-party domain → a leftover relay provider config. See the checklist in [04 config.toml](04-config.en.md).

### ② Is a third-party key being sent to official endpoints?

A relay-bought `sk-xxx` sent to `api.openai.com` will always 401 — and vice versa. Fixes:

- Official account: remove custom `model_providers` and the root `model_provider` from `config.toml`, remove `OPENAI_BASE_URL` from the environment, then `codex login` again;
- Relay: make sure the root `model_provider` points at the matching provider (see [04](04-config.en.md)).

### ③ Is the login state expired or corrupted?

`Exceeded retry limit, last error: 401 Unauthorized` is almost always login state:

```bash
codex logout
codex login
```

Still failing — clear credentials completely and re-login (quit Codex and IDE extensions first):

```bash
rm ~/.codex/auth.json
codex login
```

VS Code / Cursor users: run "Developer: Reload Window" once after re-login so the extension refreshes its cached credentials.

### ④ Any leftover environment variables?

Env vars silently override what you think is configured:

```bash
env | grep -i openai        # macOS / Linux
Get-ChildItem Env: | Where-Object Name -like "*OPENAI*"   # PowerShell
```

Delete stale `OPENAI_API_KEY` / `OPENAI_BASE_URL` and reopen the terminal. Watch out: one-click setup scripts often persist them into shell profiles (`.bashrc` / PowerShell `$PROFILE`) — editing the current session is not enough.

### ⑤ Logged into ChatGPT fine, but sessions still 401?

The most-reported 401 scenario: **the login flow is fine, the configuration conflicts** — a leftover relay provider or env var is redirecting requests elsewhere. Walk the checklist in [04](04-config.en.md). If nothing surfaces, do the full reset in [09 Maintenance](09-maintenance.md) (backup, delete `~/.codex`, log in again). If it disappears afterwards, it was stale config/credentials.

## 403 Forbidden

401 = "we don't know who you are"; 403 = "we know you, but no":

- Account (or org) lacks access to the requested model;
- Regional restrictions on some services/models;
- Enterprise / team workspace policy.

Check entitlements, or switch to a model you do have access to (`/model`).

## Login callback fails / no browser: device-code login

On headless boxes / remote SSH / when the default browser is broken, the OAuth callback hangs. Use device-code login and authorize on any device with a browser:

```bash
codex login --device-auth
```

Three failure modes:

| Symptom | Cause | Fix |
|---|---|---|
| Never reach the code-entry page, fails immediately | **Device-code auth is disabled by default** | ChatGPT web → Settings → Security → enable "Enable device code authorization for Codex", then retry |
| `token exchange failed` | Stale session interference | `codex logout` first, then `codex login --device-auth` |
| `Invalid device code` | Code expired (very short TTL) | Re-run to generate a fresh code and enter it promptly |

> Field references: [openai/codex #25670](https://github.com/openai/codex/issues/25670), [OpenAI community: token exchange failed](https://community.openai.com/t/codex-cli-desktop-auth-failed-with-token-exchange-failed/1385469)

## WSL: login succeeds but credentials never arrive

WSL and Windows localhost are isolated: the browser that `codex login` opens authorizes on the Windows side, and the callback cannot reach codex inside WSL. In order of preference:

1. **Mirrored networking on newer WSL2**: put `networkingMode=mirrored` in `.wslconfig` (Windows user dir), restart WSL — usually fixes it outright;
2. **Copy credentials manually**: complete login on the Windows side, then from WSL:
   ```bash
   mkdir -p ~/.codex
   cp /mnt/c/Users/<WindowsUsername>/.codex/auth.json ~/.codex/auth.json
   ```
   The CLI in WSL now uses your subscription quota; redo this when the token eventually expires;
3. Still failing: check WSL-side proxy in [03 Network & proxy](03-network-proxy.md) — inside WSL, `127.0.0.1` points to WSL itself.

> Field reference: [Complete fix for Codex login in WSL — CSDN](https://blog.csdn.net/gxy03/article/details/157246287)

## What is auth.json

`~/.codex/auth.json` holds credentials, roughly two shapes:

```jsonc
// ChatGPT login
{ "tokens": { "id_token": "...", "access_token": "...", "refresh_token": "...", "account_id": "..." }, "OPENAI_API_KEY": null }
// API key mode
{ "OPENAI_API_KEY": "sk-..." }
```

> 🔒 This file is a password: always redact it before posting or screenshotting; when migrating machines, back it up separately and never commit it to any repository.
