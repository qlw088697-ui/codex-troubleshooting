English | [中文](07-mcp.md)

# 07 · MCP Configuration & Troubleshooting

> Keywords: MCP tools missing, MCP server fails to start, tool call timeouts

## Basic configuration

MCP servers are configured in `~/.codex/config.toml` (remember [04](04-config.en.md): tables go below root keys):

```toml
[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]

[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "D:/projects"]
env = { "SOME_VAR" = "value" }
```

**Restart the Codex session** after config changes — servers are launched per session.

## Gotcha #1 on Windows: wrap `npx` with `cmd`

On Windows, `command = "npx"` directly often fails to start (`.cmd` resolution). Wrap it:

```toml
[mcp_servers.context7]
command = "cmd"
args = ["/c", "npx", "-y", "@upstash/context7-mcp"]
```

Check this first whenever tools don't show up on Windows — it resolves most "configured MCP but nothing happens" cases.

## Tools not showing up: ordered checklist

1. **Restart the session** — config only applies to new sessions;
2. **Verify the server actually starts**: run `command + args` manually in a terminal — a stdio server should start and wait for input (Ctrl+C to quit);
   - "command not found" → `npx`/`node` not on PATH;
   - "module not found" → wrong package name, or `npm i -g` needed first;
3. **Windows** → check whether the `cmd /c` wrapper is needed (see above);
4. **Confirm the section name** is `[mcp_servers.<name>]`, not some variant like `[mcp.<name>]`;
5. Try renaming the server — duplicate names or special characters can break loading;
6. Still failing: search `~/.codex/log/` for MCP-related errors.

## Call errors / timeouts

- **Timeouts**: the server itself is slow (e.g. fetches remote data) — use a faster source or increase timeouts if your version supports it;
- **Auth failures**: for HTTP-based servers, put required headers/tokens into `env` or per the server's docs;
- **One broken server slows startup**: comment out the servers you don't use and bisect to find the culprit.

## Environment variables note

If `env = { ... }` depends on variables from your shell, remember Codex may be launched from a different environment than your terminal (e.g. IDE-launched processes don't read `.bashrc`). Putting the value directly into `env` is more reliable — but **never commit sensitive keys to any repository**.
