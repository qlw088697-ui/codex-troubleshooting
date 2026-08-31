English | [中文](05-models-limits.md)

# 05 · Models & Usage Limits

> Keywords: `429`, `You've hit your usage limit`, `rate limit`, `insufficient_quota`, `model_not_found`

## Two billing modes — the limit logic is completely different

| | ChatGPT subscription (`codex login`) | API key (pay per use) |
|---|---|---|
| Limiting | **Rolling 5-hour window + weekly** allowance (varies by plan) | Platform-side RPM/TPM rate limits |
| Error | `You've hit your usage limit` | `rate limit exceeded` / `insufficient_quota` |
| Fix | Wait for the window to reset, or upgrade the plan | Top up, reduce concurrency, retry later |

## Handling 429

**Subscription quota (429 + usage-limit message):**

1. Read the **reset time** in the message (it usually states when you get access back);
2. Check the quota isn't being consumed elsewhere — the same account shares quota across devices/sessions;
3. Consistently not enough → upgrade the plan, or switch to API-key billing within the limited window.

> 💡 **The weekly limit is a rolling 7-day window, not a calendar week** — the reset time "drifting" forward every day is by design, not a bug. OpenAI has also added flexible on-demand limit resets (triggered from the ChatGPT side; entry point depends on the product). Reference: [community thread: weekly limit ran out](https://community.openai.com/t/weekly-limit-ran-out-even-though-i-never-hit-the-5-hour-limit/1376981).

**API key (429):**

1. `insufficient_quota` → account out of credit; top up on the platform;
2. `rate limit exceeded` → too frequent or too large requests; back off and retry;
3. Behind a relay → determine whether the limit is the relay's or upstream's (ask the relay's docs/support).

> Note the distinction: 429 is a **usage** problem; 401/403 are **auth/permission** problems — the troubleshooting paths don't mix (see [02](02-login-auth.en.md)).

## Model-related errors

### `model_not_found` / no access to a model

- Misspelled model name, or the name was retired/renamed — trust the official docs, not copied-from-the-internet old configs;
- Account/org lacks access (some models are gated by plan or allowlist);
- Behind a relay: the `model` name isn't in the relay's catalog — use the exact names from the relay's documentation.

### Choosing models

- For coding tasks prefer the Codex-family models (tuned for agent workflows);
- Switch models with `/model` in the TUI; check the current one with `/status`;
- Behind a relay, model names follow **the relay's catalog** and may differ from official naming.

## Consuming less

1. Don't stretch one session forever — context grows every turn; split long tasks into sessions;
2. Describe the task precisely to reduce "guess what I meant" round-trips;
3. Use `/status` to confirm you're not on a more expensive model than you intended.
