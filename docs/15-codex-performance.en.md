English | [中文](15-codex-performance.md)

# 15 · Performance: when Codex gets slower and slower

> Keywords: getting slow, sluggish replies, laggy, "getting dumber", high token usage, compact
>
> Sources: the official [Speed](https://developers.openai.com/codex/speed), [Configuration Reference](https://developers.openai.com/codex/config-reference) and [slash commands](https://developers.openai.com/codex/cli/slash-commands) pages (checked 2026-09); config keys may change between versions — trust the docs for your `codex --version`.

## First: which kind of "slow" is it?

There are four kinds, with completely different fixes — don't reinstall right away:

| Symptom | Type | See |
|---|---|---|
| Every reply takes long (including the first) | High reasoning effort / Fast mode off | ① |
| Fast at first, slower and "forgetful" as the chat grows | Context bloat | ② |
| Slow startup, stuck before the first action | MCP startup / update check | ③ |
| Choppy rendering (remote SSH, low-end machine) | Terminal rendering | ④ |

Triage step one is `/status`: it shows the session config, token usage and **remaining context capacity** — if capacity is nearly gone, jump straight to ②.

## ① Model & reasoning effort: the first speed dial

- `/model` doesn't just switch models — it also switches the **reasoning effort**. On the same model, `low`/`medium` is clearly faster than `high`/`xhigh`. Use low/medium for everyday coding, raise temporarily for hard problems;
- To persist it: `model_reasoning_effort = "minimal" | "low" | "medium" | "high" | "xhigh"` in config.toml (as supported by your version);
- Verbose replies cost time too: `model_verbosity = "low"` keeps output tighter;
- **Fast mode**: ChatGPT sign-in users can toggle `/fast on` (persist with `service_tier = "fast"`) — faster responses at a higher credit rate; exact multipliers live on the official Speed page and your plan page. Not available on API-key billing (may change between versions);
- The official Speed page also lists a lightweight-model track for rapid iteration (research preview, limited availability) — see [05 Models & limits](05-models-limits.en.md).

## ② Context management: why long chats get slow and "dumb"

Mechanism: every request carries the session's entire prior context. The longer the session, the more input tokens — longer waits, more limit triggers ([05](05-models-limits.en.md)), and more stream drops ([03](03-network-proxy.en.md)).

Evidence from this handbook's own machine: `codex-doctor sessions --stats --top 3` once surfaced a single 30-day, 184-million-token session among 320+ sessions — typically one conversation rolling for hundreds of turns.

**Compaction is the official answer**:

- As the context approaches the limit, Codex **auto-compacts** history (threshold: `model_auto_compact_token_limit`; unset uses model defaults);
- You can also run `/compact` manually — officially: "Summarize the visible conversation to free tokens. Use after long runs so Codex retains key points without blowing the context window";
- Compaction trades away detail: the summary replaces the old history. Session files show a `compacted` event where history is replaced by `replacement_history`. So **write important conclusions to disk** (a file / AGENTS.md / a commit), don't leave them only in the chat; old details remain viewable via `codex-doctor sessions show`.

Supporting habits:

1. **Split sessions**: one topic per session. `/new` starts fresh, `/resume` returns to an old one, `/fork` branches from the current point — all healthier than "endless top-ups";
2. **Cap single tool outputs**: dumps from big file reads or long commands enter history wholesale — prefer grep / reading in chunks; `tool_output_token_limit` limits the history budget of a single tool output;
3. **AGENTS.md is billed every turn**: global + project-root + subdirectory memory files are joined into every request. A bloated AGENTS.md burns tokens on every turn. `project_doc_max_bytes` caps per-file reads; trimming principles in [11 Efficiency tips](11-tips.en.md).

## ③ Startup & tools: MCP is suspect #1

- Each MCP server gets only **10 seconds by default** to start (`mcp_servers.<id>.startup_timeout_sec`); one slow server stalls the whole startup;
- **Disable servers you don't use**: `mcp_servers.<id>.enabled = false` — no need to delete the config;
- Tool calls time out at 60 seconds by default (`tool_timeout_sec`);
- `codex-doctor doctor --mcp-smoke` deep-checks which server won't start ([13](13-codex-doctor.en.md)); the full checklist is in [07 MCP](07-mcp.en.md);
- Offline / intranet machines: disable the startup update check with `check_for_update_on_startup = false`.

Two official speed features ship enabled by default — leave them on: `features.shell_snapshot` (snapshot shell environment, speeds up repeated commands) and `features.enable_request_compression` (zstd request compression, helps on weak networks).

## ④ Terminal & UI

- Choppy output over remote SSH / low-end machines: `tui.animations = false`;
- Too much scrolling: `hide_agent_reasoning = true`, or `model_reasoning_summary = "concise"`;
- Garbled Chinese on Windows: confirm `features.powershell_utf8` (enabled by default on Windows) + `chcp 65001` in the terminal — see [06 Sandbox & Windows](06-sandbox-windows.en.md).

## A minimal "make it fast" config

```toml
# Everyday speed-first settings (pick what fits)
model_reasoning_effort = "low"   # raise temporarily via /model for hard tasks
model_verbosity = "low"

[mcp_servers.heavy-mcp]
enabled = false                  # disable servers you rarely use
```

## Self-check list

- [ ] `/status`: what's the current reasoning effort? how much context remains?
- [ ] `/usage`: how much has this window burned?
- [ ] `codex-doctor sessions --stats --top 5`: which sessions cost the most?
- [ ] Any rarely-used MCP servers in config? (`enabled = false` them)
- [ ] Is AGENTS.md growing unbounded?

---

> Related: [05 Models & limits](05-models-limits.en.md) (429 / quota), [03 Network & proxy](03-network-proxy.en.md) (stream drops), [07 MCP](07-mcp.en.md) (tool troubleshooting), [11 Efficiency tips](11-tips.en.md), [13 codex-doctor CLI](13-codex-doctor.en.md) (usage stats & deep checks)
