English | [中文](04-config.md)

# 04 · config.toml

> Keywords: `failed to parse config`, `TOML parse error`, **"config not taking effect"**, 401 (config-conflict type)

## File location

```
~/.codex/config.toml
Windows: C:\Users\<you>\.codex\config.toml
```

Create it if missing. **Restart the Codex session after every edit.**

## Gotcha #1: root keys must precede every `[table]`

In TOML, a root key like `model = "..."` written **after** any `[xxx]` section header silently becomes a key *of that table* — no error, no effect. This is the #1 cause of "my config isn't taking effect".

❌ Wrong:

```toml
[model_providers.myproxy]
name = "myproxy"
base_url = "https://relay.example.com/v1"

model = "gpt-5-codex"          # ← now belongs to myproxy; ignored as a root setting!
```

✅ Right:

```toml
model = "gpt-5-codex"          # all root keys go on top
model_provider = "openai"
approval_policy = "on-request"
sandbox_mode = "workspace-write"

[model_providers.myproxy]      # tables go below
name = "myproxy"
base_url = "https://relay.example.com/v1"
```

> 💡 The [doctor script](../scripts/codex-doctor.sh) scans for this pattern and warns about it.

## Common root keys

```toml
model = "gpt-5-codex"            # model names per official docs; switch with /model in the TUI
model_provider = "openai"        # default official; your provider id when using a relay
approval_policy = "on-request"   # untrusted / on-failure / on-request / never
sandbox_mode = "workspace-write" # read-only / workspace-write / danger-full-access
```

Approval and sandbox details: [06 Sandbox & Windows](06-sandbox-windows.md).

## Custom relay provider

```toml
# root: point at your provider
model_provider = "myrelay"

# table: define it (below all root keys)
[model_providers.myrelay]
name = "My Relay"
base_url = "https://relay.example.com/v1"   # per your relay's docs, usually ends with /v1
env_key = "MYRELAY_API_KEY"                  # env var that holds the key
wire_api = "responses"                       # set to "chat" if the relay only supports Chat Completions
```

```bash
# keep the key in an env var, not in config.toml
export MYRELAY_API_KEY=sk-xxxx
```

Key points:

- A `wire_api` mismatch is the classic "relay connects but everything errors" cause — try both values;
- A missing `env_key` variable can surface as unauthenticated / 401;
- Whether the relay speaks plain OpenAI-compatible chat or the full Responses API decides `wire_api`.

## Profiles: switch setups with one flag

```toml
[profiles.official]
model_provider = "openai"

[profiles.relay]
model_provider = "myrelay"
model = "gpt-5-codex"
```

```bash
codex --profile relay
```

## How to verify the config took effect

1. Restart the session;
2. Run `/status` in the TUI and check the displayed **model / provider / approval / sandbox** are what you intended.

## The 401 config checklist

Work through together with [02 Login & auth](02-login-auth.en.md):

- [ ] Root `model_provider` — does it point where you think?
- [ ] Any **leftover** `[model_providers.*]` — most common after switching back from a relay to official;
- [ ] Does the `env_key` variable exist, and is it a key for that platform;
- [ ] `base_url` path matches the relay's requirement (usually ends with `/v1`);
- [ ] Any leftover `OPENAI_BASE_URL` environment variable (see [02 step ④](02-login-auth.en.md));
- [ ] Does `auth.json` match the endpoint you're pointing at (official tokens vs relay sk-key).

## Syntax errors

On `failed to parse config` / `TOML parse error`, the message includes a line number. Usual suspects:

- Unbalanced quotes, or unquoted strings (URLs and paths must be quoted);
- Full-width quotes `“”` or full-width colons pasted from chat apps;
- Duplicate table names.
