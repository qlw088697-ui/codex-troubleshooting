English | [中文](03-network-proxy.md)

# 03 · Network & Proxy

> Keywords: `stream error`, `stream disconnected`, `connection reset`, `ETIMEDOUT`, `ECONNREFUSED`, endless spinner with no response.
>
> Typical cases: users on restricted/unstable networks, corporate proxies.

## The core fact

Codex needs stable access to `chatgpt.com` (login & subscription quota) and/or `api.openai.com` (API billing). **"The command runs but streams keep breaking / timing out" is normal on restricted direct connections** — verify the network path first, then suspect everything else.

## Step 1: verify connectivity

In **the same terminal** you run codex from:

```bash
curl -I --max-time 10 https://chatgpt.com
curl -I --max-time 10 https://api.openai.com
```

- Any HTTP status (even 4xx) → network is fine; the problem is elsewhere (see [02](02-login-auth.en.md) / [04](04-config.en.md));
- Hangs, timeouts, `Connection reset` → it's the network path; continue below.

## Step 2: configure a proxy

CLI programs **don't necessarily use the system proxy** — setting environment variables explicitly is the reliable way (set them in the terminal session that launches codex; no need to go global):

```powershell
# Windows PowerShell
$env:HTTPS_PROXY = "http://127.0.0.1:7890"
$env:HTTP_PROXY  = "http://127.0.0.1:7890"
$env:NO_PROXY    = "localhost,127.0.0.1"
codex
```

```bash
# macOS / Linux / WSL
export HTTPS_PROXY=http://127.0.0.1:7890
export HTTP_PROXY=http://127.0.0.1:7890
export NO_PROXY=localhost,127.0.0.1
codex
```

Notes:

1. **The port must match what your proxy client actually listens on** (7890/1080/10809… — check your client);
2. The proxy client must allow local/LAN connections as required;
3. For "permanent" effect put the lines into your shell profile (`.bashrc` / PowerShell `$PROFILE`) — think twice; a permanent global proxy interferes with other tools;
4. Re-run the `curl` test from step 1 — **if the proxy itself is unreachable you'll get `ECONNREFUSED`** (can't connect to the proxy port).

### Corporate networks (MITM proxy): TLS certificate errors

Corporate proxies often replace TLS certificates, producing `unable to verify the first certificate` / `self-signed certificate`. Fix: get the corporate root certificate from IT and install it into the system trust chain. Never "work around" it by disabling certificate verification.

## Step 3: mirrors & acceleration

### npm install/update slow or failing

```bash
npm config set registry https://registry.npmmirror.com
```

### Slow git clones of GitHub repos

Use a mirror prefix for cloning (clone only):

```bash
git clone https://ghfast.top/https://github.com/openai/codex.git
```

### Third-party API relays

If a proxy is inconvenient, you can point Codex at a third-party API relay via `model_providers` — see [04 config.toml](04-config.en.md). Vet the relay carefully; never send API keys to parties you don't trust.

## Deep dive: `stream disconnected before completion`

One of the most-reported Codex issues overall. Troubleshoot by hit rate:

1. **Classify first**: occasional = network jitter, configure a proxy per above; only continue if it reproduces stably;
2. **Project inside OneDrive / a sync folder**: file locks from sync engines interfere with long sessions' local streaming I/O — move the project out of OneDrive and retest (a frequent trap on Windows);
3. **Very long sessions**: streams break more often as context approaches compaction — start a fresh session and compare; split long tasks into separate sessions (saves quota too, see [05](05-models-limits.en.md));
4. **Proxy unstable on SSE long connections**: switch to nodes/clients that handle long connections; TUN mode is usually steadier than terminal-only proxying;
5. **Server side**: if `/backend-api/codex/responses` disconnects coincide with a [known community incident thread](https://community.openai.com/t/bug-codex-stream-disconnected-before-completion-on-backend-api-codex-responses-feb-8-2026/1373656), just wait for the fix; relay users should check `wire_api` ([04](04-config.en.md)).

## Symptom cheat sheet

| Symptom | Likely cause | Fix |
|---|---|---|
| Generation dies mid-way with `stream error` | Network path jitter | Configure proxy; if configured, switch nodes |
| `ETIMEDOUT`, endless spinner | Direct connection blocked or proxy not applied | Proxy or relay |
| `ECONNREFUSED` | Proxy port closed or wrong | Verify the client's port |
| TUI hangs but `curl` works | Proxy unstable on SSE long connections | Switch to long-connection-friendly nodes/client |
| Login page won't open | Browser not proxied | Check the browser's proxy separately |

> 💡 The [doctor script](../scripts/codex-doctor.sh) runs the connectivity probes automatically and interprets the results.
